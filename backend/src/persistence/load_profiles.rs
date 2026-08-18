use super::{logging, DomainRepository, PersistenceError};
use crate::domain::{
    LoadProfileDefinitionInput, LoadProfileSummary, LoadProfileUpdate, NewLoadProfile,
};
use serde_json::json;
use sqlx::{types::JsonValue, Row};
use uuid::Uuid;

const POUNDS_TO_KILOGRAMS: f64 = 0.453_592_37;
const DEFAULT_FORMULA_LOAD_CAP_KG: f64 = 300.0;
const FLOAT_TOLERANCE: f64 = 1e-9;

#[derive(Debug, Clone)]
struct StoredLoadProfile {
    id: String,
    name: String,
    status: String,
    definition_kind: String,
    weight_unit: String,
    station_count: i64,
    definition: JsonValue,
}

pub(super) async fn fetch_load_profile_summaries_for_user(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<LoadProfileSummary>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            lp.id::text AS id,
            lp.name,
            lp.status,
            lp.definition->>'kind' AS definition_kind,
            lp.weight_unit,
            COUNT(es.id)::bigint AS station_count
         FROM load_profiles lp
         LEFT JOIN equipment_stations es
           ON es.load_profile_id = lp.id
          AND es.user_id = $1::uuid
         WHERE lp.user_id = $1::uuid
         GROUP BY lp.id, lp.name, lp.status, lp.definition, lp.weight_unit
         ORDER BY
            CASE WHEN lp.status = 'inactive' THEN 1 ELSE 0 END ASC,
            lower(lp.name) ASC,
            lp.name ASC,
            lp.id ASC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    rows.into_iter()
        .map(|row| {
            let definition_kind =
                row.get::<Option<String>, _>("definition_kind")
                    .ok_or_else(|| {
                        PersistenceError::Conflict(
                            "load profile definition is missing kind for list summary".to_string(),
                        )
                    })?;

            Ok(LoadProfileSummary {
                id: row.get("id"),
                name: row.get("name"),
                status: row.get("status"),
                definition_kind,
                weight_unit: row.get("weight_unit"),
                station_count: row.get("station_count"),
            })
        })
        .collect()
}

pub(super) async fn load_profile_name_exists_for_user(
    repository: &DomainRepository,
    user_id: &str,
    name: &str,
    excluding_id: Option<&str>,
) -> Result<bool, PersistenceError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1
            FROM load_profiles
            WHERE user_id = $1::uuid
              AND lower(btrim(name)) = lower(btrim($2))
              AND ($3::uuid IS NULL OR id <> $3::uuid)
        )",
    )
    .bind(user_id)
    .bind(name)
    .bind(excluding_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(exists)
}

pub(super) async fn create_load_profile_for_user(
    repository: &DomainRepository,
    user_id: &str,
    new_load_profile: &NewLoadProfile,
) -> Result<LoadProfileSummary, PersistenceError> {
    let id = Uuid::new_v4().to_string();
    let definition = definition_json(&new_load_profile.definition);

    match sqlx::query(
        "INSERT INTO load_profiles (id, user_id, name, status, weight_unit, definition)
         VALUES ($1::uuid, $2::uuid, $3, 'new', $4, $5::jsonb)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&new_load_profile.name)
    .bind(&new_load_profile.weight_unit)
    .bind(definition)
    .execute(&repository.pool)
    .await
    {
        Ok(_) => {}
        Err(error) => return Err(map_load_profile_write_sqlx_error(error)?),
    }

    fetch_stored_load_profile_for_user(repository, &id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Load profile not found".to_owned()))
        .map(summary_from_stored)
}

pub(super) async fn update_load_profile_for_user(
    repository: &DomainRepository,
    load_profile_id: &str,
    user_id: &str,
    update: &LoadProfileUpdate,
) -> Result<LoadProfileSummary, PersistenceError> {
    let mut tx =
        logging::begin_transaction(&repository.pool, "update_load_profile", "load_profile").await?;

    let Some(current) =
        fetch_stored_load_profile_for_user_tx(&mut tx, load_profile_id, user_id).await?
    else {
        logging::rollback_transaction(tx, "update_load_profile", "load_profile").await;
        return Err(PersistenceError::NotFound(
            "Load profile not found".to_owned(),
        ));
    };

    let mut next_weight_unit = current.weight_unit.clone();
    let mut next_definition = current.definition.clone();

    if let Some(weight_unit) = &update.weight_unit {
        if current.status != "new" && weight_unit != &current.weight_unit {
            logging::rollback_transaction(tx, "update_load_profile", "load_profile").await;
            return Err(PersistenceError::Conflict(
                "Only draft load profiles can change weight_unit or definition".to_owned(),
            ));
        }
        next_weight_unit = weight_unit.clone();
    }

    if let Some(definition) = &update.definition {
        let candidate_definition = definition_json(definition);
        if current.status != "new" && candidate_definition != current.definition {
            logging::rollback_transaction(tx, "update_load_profile", "load_profile").await;
            return Err(PersistenceError::Conflict(
                "Only draft load profiles can change weight_unit or definition".to_owned(),
            ));
        }
        next_definition = candidate_definition;
    }

    match sqlx::query(
        "UPDATE load_profiles
         SET name = $3,
             weight_unit = $4,
             definition = $5::jsonb
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(load_profile_id)
    .bind(user_id)
    .bind(&update.name)
    .bind(&next_weight_unit)
    .bind(next_definition)
    .execute(&mut *tx)
    .await
    {
        Ok(_) => {}
        Err(error) => {
            logging::rollback_transaction(tx, "update_load_profile", "load_profile").await;
            return Err(map_load_profile_write_sqlx_error(error)?);
        }
    }

    let updated = fetch_stored_load_profile_for_user_tx(&mut tx, load_profile_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Load profile not found".to_owned()))?;

    logging::commit_transaction(tx, "update_load_profile", "load_profile").await?;
    Ok(summary_from_stored(updated))
}

pub(super) async fn delete_load_profile_for_user(
    repository: &DomainRepository,
    load_profile_id: &str,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx =
        logging::begin_transaction(&repository.pool, "delete_load_profile", "load_profile").await?;

    let Some(current) =
        fetch_stored_load_profile_for_user_tx(&mut tx, load_profile_id, user_id).await?
    else {
        logging::rollback_transaction(tx, "delete_load_profile", "load_profile").await;
        return Err(PersistenceError::NotFound(
            "Load profile not found".to_owned(),
        ));
    };

    if current.status != "new" {
        logging::rollback_transaction(tx, "delete_load_profile", "load_profile").await;
        return Err(PersistenceError::Conflict(
            "Only draft load profiles can be deleted".to_owned(),
        ));
    }

    if current.station_count > 0 {
        logging::rollback_transaction(tx, "delete_load_profile", "load_profile").await;
        return Err(PersistenceError::Conflict(
            "Draft load profiles referenced by stations cannot be deleted".to_owned(),
        ));
    }

    sqlx::query(
        "DELETE FROM load_profiles
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(load_profile_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    logging::commit_transaction(tx, "delete_load_profile", "load_profile").await?;
    Ok(())
}

pub(super) fn load_profile_definition_to_kg(
    definition: &JsonValue,
    weight_unit: &str,
) -> Result<Vec<f64>, PersistenceError> {
    load_profile_definition_to_kg_with_cap(
        definition,
        weight_unit,
        DEFAULT_FORMULA_LOAD_CAP_KG,
        false,
    )
}

pub(super) fn load_profile_definition_to_kg_capped(
    definition: &JsonValue,
    weight_unit: &str,
    max_load_kg: f64,
) -> Result<Vec<f64>, PersistenceError> {
    if !max_load_kg.is_finite() || max_load_kg < 0.0 {
        return Err(PersistenceError::Conflict(
            "load profile expansion cap must be finite and non-negative".to_string(),
        ));
    }

    load_profile_definition_to_kg_with_cap(definition, weight_unit, max_load_kg, true)
}

fn load_profile_definition_to_kg_with_cap(
    definition: &JsonValue,
    weight_unit: &str,
    max_load_kg: f64,
    allow_empty_after_cap: bool,
) -> Result<Vec<f64>, PersistenceError> {
    let mut loads_kg = match definition_kind(definition)? {
        "fixed_list" => expand_fixed_list_definition(definition, weight_unit)?,
        "formula" => {
            expand_formula_definition(definition, weight_unit, max_load_kg, allow_empty_after_cap)?
        }
        kind => {
            return Err(PersistenceError::Conflict(format!(
                "invalid load profile definition kind: {kind}"
            )));
        }
    };

    if allow_empty_after_cap {
        loads_kg.retain(|load| *load <= max_load_kg + FLOAT_TOLERANCE);
    }
    loads_kg.sort_by(f64::total_cmp);
    loads_kg.dedup_by(|left, right| (*left - *right).abs() <= FLOAT_TOLERANCE);

    if loads_kg.is_empty() && !allow_empty_after_cap {
        return Err(PersistenceError::Conflict(
            "load profile definition produced no valid loads".to_string(),
        ));
    }

    Ok(loads_kg)
}

fn definition_kind(definition: &JsonValue) -> Result<&str, PersistenceError> {
    definition
        .get("kind")
        .and_then(JsonValue::as_str)
        .ok_or_else(|| {
            PersistenceError::Conflict("load profile definition is missing kind".to_string())
        })
}

fn expand_fixed_list_definition(
    definition: &JsonValue,
    weight_unit: &str,
) -> Result<Vec<f64>, PersistenceError> {
    let values = definition
        .get("values")
        .and_then(JsonValue::as_array)
        .ok_or_else(|| {
            PersistenceError::Conflict(
                "fixed_list definition must include numeric values array".to_string(),
            )
        })?;

    if values.is_empty() {
        return Err(PersistenceError::Conflict(
            "fixed_list definition values must not be empty".to_string(),
        ));
    }

    values
        .iter()
        .enumerate()
        .map(|(index, value)| {
            let raw = value.as_f64().ok_or_else(|| {
                PersistenceError::Conflict(format!(
                    "fixed_list value at index {index} must be numeric"
                ))
            })?;
            canonicalize_load_kg(raw, weight_unit)
        })
        .collect()
}

fn expand_formula_definition(
    definition: &JsonValue,
    weight_unit: &str,
    max_load_kg: f64,
    allow_empty_after_cap: bool,
) -> Result<Vec<f64>, PersistenceError> {
    let min = numeric_field(definition, "min")?;
    let step = numeric_field(definition, "step")?;

    if step <= 0.0 {
        return Err(PersistenceError::Conflict(
            "formula definition step must be greater than 0".to_string(),
        ));
    }

    let min_kg = canonicalize_load_kg(min, weight_unit)?;
    let step_kg = canonicalize_load_kg(step, weight_unit)?;

    if min_kg > max_load_kg + FLOAT_TOLERANCE {
        if allow_empty_after_cap {
            return Ok(Vec::new());
        }
        return Err(PersistenceError::Conflict(format!(
            "formula definition min exceeds {max_load_kg}kg cap"
        )));
    }

    if step_kg <= FLOAT_TOLERANCE {
        return Err(PersistenceError::Conflict(
            "formula definition step resolves to zero in kg".to_string(),
        ));
    }

    let mut loads_kg = Vec::new();
    let mut current = min_kg;
    let max_iterations = 100_000;

    for _ in 0..max_iterations {
        if current > max_load_kg + FLOAT_TOLERANCE {
            break;
        }

        loads_kg.push(current.min(max_load_kg));
        current += step_kg;
    }

    if loads_kg.is_empty() && !allow_empty_after_cap {
        return Err(PersistenceError::Conflict(format!(
            "formula definition produced no values at or below {max_load_kg}kg"
        )));
    }

    Ok(loads_kg)
}

fn numeric_field(definition: &JsonValue, field: &str) -> Result<f64, PersistenceError> {
    definition
        .get(field)
        .and_then(JsonValue::as_f64)
        .ok_or_else(|| {
            PersistenceError::Conflict(format!("formula definition field {field} must be numeric"))
        })
}

fn canonicalize_load_kg(raw_value: f64, weight_unit: &str) -> Result<f64, PersistenceError> {
    if !raw_value.is_finite() || raw_value < 0.0 {
        return Err(PersistenceError::Conflict(
            "load values must be finite and non-negative".to_string(),
        ));
    }

    match weight_unit {
        "KG" => Ok(raw_value),
        "LBS" => Ok(raw_value * POUNDS_TO_KILOGRAMS),
        other => Err(PersistenceError::Conflict(format!(
            "unknown load profile weight unit: {other}"
        ))),
    }
}

fn definition_json(definition: &LoadProfileDefinitionInput) -> JsonValue {
    match definition.kind.as_str() {
        "fixed_list" => json!({
            "kind": definition.kind,
            "values": definition.values.clone().unwrap_or_default(),
        }),
        "formula" => json!({
            "kind": definition.kind,
            "min": definition.min.unwrap_or_default(),
            "step": definition.step.unwrap_or_default(),
        }),
        _ => json!({
            "kind": definition.kind,
        }),
    }
}

fn summary_from_stored(load_profile: StoredLoadProfile) -> LoadProfileSummary {
    LoadProfileSummary {
        id: load_profile.id,
        name: load_profile.name,
        status: load_profile.status,
        definition_kind: load_profile.definition_kind,
        weight_unit: load_profile.weight_unit,
        station_count: load_profile.station_count,
    }
}

async fn fetch_stored_load_profile_for_user(
    repository: &DomainRepository,
    load_profile_id: &str,
    user_id: &str,
) -> Result<Option<StoredLoadProfile>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            lp.id::text AS id,
            lp.name,
            lp.status,
            lp.definition->>'kind' AS definition_kind,
            lp.weight_unit,
            lp.definition,
            COUNT(es.id)::bigint AS station_count
         FROM load_profiles lp
         LEFT JOIN equipment_stations es
           ON es.load_profile_id = lp.id
          AND es.user_id = lp.user_id
         WHERE lp.id = $1::uuid
           AND lp.user_id = $2::uuid
         GROUP BY lp.id, lp.name, lp.status, lp.definition, lp.weight_unit",
    )
    .bind(load_profile_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    row.map(stored_load_profile_from_row).transpose()
}

async fn fetch_stored_load_profile_for_user_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    load_profile_id: &str,
    user_id: &str,
) -> Result<Option<StoredLoadProfile>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            lp.id::text AS id,
            lp.name,
            lp.status,
            lp.definition->>'kind' AS definition_kind,
            lp.weight_unit,
            lp.definition,
            COUNT(es.id)::bigint AS station_count
         FROM load_profiles lp
         LEFT JOIN equipment_stations es
           ON es.load_profile_id = lp.id
          AND es.user_id = lp.user_id
         WHERE lp.id = $1::uuid
           AND lp.user_id = $2::uuid
         GROUP BY lp.id, lp.name, lp.status, lp.definition, lp.weight_unit",
    )
    .bind(load_profile_id)
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await?;

    row.map(stored_load_profile_from_row).transpose()
}

fn stored_load_profile_from_row(
    row: sqlx::postgres::PgRow,
) -> Result<StoredLoadProfile, PersistenceError> {
    let definition_kind = row
        .get::<Option<String>, _>("definition_kind")
        .ok_or_else(|| {
            PersistenceError::Conflict(
                "load profile definition is missing kind for stored row".to_string(),
            )
        })?;

    Ok(StoredLoadProfile {
        id: row.get("id"),
        name: row.get("name"),
        status: row.get("status"),
        definition_kind,
        weight_unit: row.get("weight_unit"),
        definition: row.get("definition"),
        station_count: row.get("station_count"),
    })
}

fn map_load_profile_write_sqlx_error(
    error: sqlx::Error,
) -> Result<PersistenceError, PersistenceError> {
    if let sqlx::Error::Database(db_error) = &error {
        if db_error.code().as_deref() == Some("23505")
            && db_error.constraint() == Some("load_profiles_user_normalized_name_unique")
        {
            return Ok(PersistenceError::Conflict(
                "Load profile name already exists".to_owned(),
            ));
        }
    }

    Err(PersistenceError::Sqlx(error))
}

#[cfg(test)]
mod tests {
    use super::{load_profile_definition_to_kg, load_profile_definition_to_kg_capped};

    fn parse_json(raw: &str) -> sqlx::types::JsonValue {
        raw.parse().expect("test fixture should contain valid json")
    }

    #[test]
    fn load_profile_definition_to_kg_fixed_list_kg_returns_sorted_values() {
        let definition = parse_json(r#"{"kind":"fixed_list","values":[20.0,10.0,15.0]}"#);

        let loads = load_profile_definition_to_kg(&definition, "KG")
            .expect("fixed_list kg definition should convert");

        assert_eq!(loads, vec![10.0, 15.0, 20.0]);
    }

    #[test]
    fn load_profile_definition_to_kg_fixed_list_lbs_converts_to_kg() {
        let definition = parse_json(r#"{"kind":"fixed_list","values":[45.0,90.0]}"#);

        let loads = load_profile_definition_to_kg(&definition, "LBS")
            .expect("fixed_list lbs definition should convert");

        assert!((loads[0] - 20.41165665).abs() < 1e-9);
        assert!((loads[1] - 40.8233133).abs() < 1e-9);
    }

    #[test]
    fn load_profile_definition_to_kg_formula_reachable_cap_includes_300() {
        let definition = parse_json(r#"{"kind":"formula","min":100.0,"step":50.0}"#);

        let loads = load_profile_definition_to_kg(&definition, "KG")
            .expect("formula with reachable cap should convert");

        assert_eq!(loads, vec![100.0, 150.0, 200.0, 250.0, 300.0]);
    }

    #[test]
    fn load_profile_definition_to_kg_formula_unreachable_cap_excludes_300() {
        let definition = parse_json(r#"{"kind":"formula","min":90.0,"step":40.0}"#);

        let loads = load_profile_definition_to_kg(&definition, "KG")
            .expect("formula with unreachable cap should convert");

        assert_eq!(loads, vec![90.0, 130.0, 170.0, 210.0, 250.0, 290.0]);
        assert!(!loads.iter().any(|value| (*value - 300.0).abs() < 1e-9));
    }

    #[test]
    fn load_profile_definition_to_kg_formula_min_above_cap_returns_error() {
        let definition = parse_json(r#"{"kind":"formula","min":310.0,"step":5.0}"#);

        let error = load_profile_definition_to_kg(&definition, "KG")
            .expect_err("formula with min above cap should fail");

        let message = match error {
            super::PersistenceError::Conflict(message) => message,
            other => panic!("unexpected error variant: {other:?}"),
        };

        assert!(message.contains("exceeds 300kg cap"));
    }

    #[test]
    fn load_profile_definition_to_kg_capped_formula_can_expand_above_default_cap() {
        let definition = parse_json(r#"{"kind":"formula","min":290.0,"step":25.0}"#);

        let loads = load_profile_definition_to_kg_capped(&definition, "KG", 340.0)
            .expect("formula should expand to caller cap");

        assert_eq!(loads, vec![290.0, 315.0, 340.0]);
    }

    #[test]
    fn load_profile_definition_to_kg_capped_fixed_list_filters_above_max() {
        let definition = parse_json(r#"{"kind":"fixed_list","values":[100.0,275.0,150.0]}"#);

        let loads = load_profile_definition_to_kg_capped(&definition, "KG", 200.0)
            .expect("fixed_list should filter to caller cap");

        assert_eq!(loads, vec![100.0, 150.0]);
    }

    #[test]
    fn load_profile_definition_to_kg_capped_returns_empty_when_profile_exceeds_max() {
        let definition = parse_json(r#"{"kind":"formula","min":250.0,"step":10.0}"#);

        let loads = load_profile_definition_to_kg_capped(&definition, "KG", 200.0)
            .expect("valid formula above caller cap should produce no visible loads");

        assert!(loads.is_empty());
    }
}
