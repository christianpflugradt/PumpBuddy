use super::{DomainRepository, PersistenceError};
use crate::domain::{
    GymDetail, GymExerciseGroup, GymExerciseVariantSummary, GymLoadProfileSummary,
    GymStationAvailability, GymStationDetail, GymStationExerciseGroup,
    GymStationExerciseVariantSummary, GymStationOption, GymStationSummary, GymSummary,
};
use sqlx::{postgres::PgRow, Row};

pub(super) async fn fetch_gym_summaries_for_user(
    repository: &DomainRepository,
    user_id: &str,
    favorite_gym_id: Option<&str>,
) -> Result<Vec<GymSummary>, PersistenceError> {
    let favorite_gym_id = favorite_gym_id.unwrap_or("");
    let rows = sqlx::query(
        "SELECT
            g.id::text AS id,
            g.name,
            COUNT(es.id)::bigint AS station_count,
            completion.last_visited_at
         FROM gyms g
         LEFT JOIN equipment_stations es
           ON es.gym_id = g.id
          AND es.user_id = $1::uuid
         LEFT JOIN LATERAL (
            SELECT MAX(w.completed_at)::text AS last_visited_at
            FROM workouts w
            WHERE w.gym_id = g.id
              AND w.user_id = $1::uuid
              AND w.completed_at IS NOT NULL
         ) completion ON TRUE
         WHERE g.user_id = $1::uuid
         GROUP BY g.id, g.name, completion.last_visited_at
         ORDER BY
            CASE WHEN $2 <> '' AND g.id::text = $2 THEN 0 ELSE 1 END ASC,
            lower(g.name) ASC,
            g.name ASC,
            g.id ASC",
    )
    .bind(user_id)
    .bind(favorite_gym_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| GymSummary {
            id: row.get("id"),
            name: row.get("name"),
            station_count: row.get("station_count"),
            last_visited_at: row.get("last_visited_at"),
        })
        .collect())
}

pub(super) async fn favorite_gym_exists_for_user(
    repository: &DomainRepository,
    user_id: &str,
    gym_id: &str,
) -> Result<bool, PersistenceError> {
    let row = sqlx::query(
        "SELECT EXISTS (
            SELECT 1
            FROM gyms g
            WHERE g.id = $1::uuid
              AND g.user_id = $2::uuid
         ) AS exists",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(row.get("exists"))
}

pub(super) async fn fetch_gym_detail_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Option<GymDetail>, PersistenceError> {
    let maybe_gym = sqlx::query(
        "SELECT
            g.id::text AS id,
            g.name,
            COUNT(es.id)::bigint AS station_count,
            completion.last_visited_at
         FROM gyms g
         LEFT JOIN equipment_stations es
           ON es.gym_id = g.id
          AND es.user_id = $2::uuid
         LEFT JOIN LATERAL (
            SELECT MAX(w.completed_at)::text AS last_visited_at
            FROM workouts w
            WHERE w.gym_id = g.id
              AND w.user_id = $2::uuid
              AND w.completed_at IS NOT NULL
         ) completion ON TRUE
         WHERE g.id = $1::uuid
           AND g.user_id = $2::uuid
         GROUP BY g.id, g.name, completion.last_visited_at",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(gym) = maybe_gym else {
        return Ok(None);
    };

    let stations = fetch_gym_station_summaries(repository, gym_id, user_id).await?;
    let exercise_rows = fetch_gym_exercise_variant_rows(repository, gym_id, user_id).await?;

    Ok(Some(GymDetail {
        id: gym.get("id"),
        name: gym.get("name"),
        station_count: gym.get("station_count"),
        last_visited_at: gym.get("last_visited_at"),
        stations,
        exercise_groups: group_gym_exercise_rows(exercise_rows),
    }))
}

pub(super) async fn fetch_gym_station_detail_for_user(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<Option<GymStationDetail>, PersistenceError> {
    let maybe_station = sqlx::query(
        "SELECT
            g.id::text AS gym_id,
            g.name AS gym_name,
            es.id::text AS station_id,
            es.name AS station_name,
            lp.id::text AS load_profile_id,
            lp.name AS load_profile_name,
            lp.weight_unit AS load_profile_weight_unit,
            lp.definition AS load_profile_definition,
            lp.definition->>'kind' AS load_profile_definition_kind
         FROM equipment_stations es
         JOIN gyms g
           ON g.id = es.gym_id
          AND g.user_id = $3::uuid
         JOIN load_profiles lp
           ON lp.id = es.load_profile_id
          AND lp.user_id = $3::uuid
         WHERE es.gym_id = $1::uuid
           AND es.id = $2::uuid
           AND es.user_id = $3::uuid",
    )
    .bind(gym_id)
    .bind(station_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(station) = maybe_station else {
        return Ok(None);
    };

    let definition: sqlx::types::JsonValue = station.get("load_profile_definition");
    let weight_unit: String = station.get("load_profile_weight_unit");
    let definition_kind = station
        .get::<Option<String>, _>("load_profile_definition_kind")
        .ok_or_else(|| {
            PersistenceError::Conflict(
                "load profile definition is missing kind for station detail".to_string(),
            )
        })?;
    let max_load_kg = repository
        .fetch_max_load_kg_preference_for_user(user_id)
        .await?;
    let possible_loads_kg = DomainRepository::load_profile_definition_to_kg_capped(
        &definition,
        &weight_unit,
        max_load_kg,
    )?;
    let variant_rows =
        fetch_gym_station_exercise_variant_rows(repository, gym_id, station_id, user_id).await?;

    Ok(Some(GymStationDetail {
        gym_id: station.get("gym_id"),
        gym_name: station.get("gym_name"),
        station_id: station.get("station_id"),
        station_name: station.get("station_name"),
        load_profile: GymLoadProfileSummary {
            id: station.get("load_profile_id"),
            name: station.get("load_profile_name"),
            weight_unit,
            definition_kind,
            possible_loads_kg,
        },
        suitable_variant_groups: group_gym_station_exercise_rows(variant_rows),
    }))
}

async fn fetch_gym_station_summaries(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Vec<GymStationSummary>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            es.id::text AS id,
            es.name,
            lp.name AS load_profile_name,
            COUNT(DISTINCT ev.id)::bigint AS suitable_variant_count
         FROM equipment_stations es
         JOIN load_profiles lp
           ON lp.id = es.load_profile_id
          AND lp.user_id = $2::uuid
         LEFT JOIN exercise_variant_equipment_compatibilities evec
           ON evec.equipment_station_id = es.id
          AND evec.user_id = $2::uuid
          AND evec.is_enabled = TRUE
         LEFT JOIN exercise_variants ev
           ON ev.id = evec.exercise_variant_id
          AND ev.user_id = $2::uuid
          AND ev.requires_station = TRUE
         WHERE es.gym_id = $1::uuid
           AND es.user_id = $2::uuid
         GROUP BY es.id, es.name, lp.name
         ORDER BY lower(es.name) ASC, es.name ASC, es.id ASC",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| GymStationSummary {
            id: row.get("id"),
            name: row.get("name"),
            load_profile_name: row.get("load_profile_name"),
            suitable_variant_count: row.get("suitable_variant_count"),
        })
        .collect())
}

async fn fetch_gym_exercise_variant_rows(
    repository: &DomainRepository,
    gym_id: &str,
    user_id: &str,
) -> Result<Vec<PgRow>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            e.id::text AS exercise_id,
            e.name AS exercise_name,
            ev.id::text AS variant_id,
            ev.name AS variant_name,
            ev.requires_station,
            ev.repetition_kind,
            ev.load_input_mode,
            ev.set_tracking_mode,
            es.id::text AS station_id,
            es.name AS station_name
         FROM exercise_variants ev
         JOIN exercises e
           ON e.id = ev.exercise_id
          AND e.user_id = $2::uuid
         LEFT JOIN exercise_variant_equipment_compatibilities evec
           ON ev.requires_station = TRUE
          AND evec.exercise_variant_id = ev.id
          AND evec.user_id = $2::uuid
          AND evec.is_enabled = TRUE
         LEFT JOIN equipment_stations es
           ON es.id = evec.equipment_station_id
          AND es.user_id = $2::uuid
          AND es.gym_id = $1::uuid
         WHERE ev.user_id = $2::uuid
           AND (ev.requires_station = FALSE OR es.id IS NOT NULL)
         ORDER BY
            lower(e.name) ASC,
            e.name ASC,
            e.id ASC,
            lower(ev.name) ASC,
            ev.name ASC,
            ev.id ASC,
            lower(es.name) ASC NULLS FIRST,
            es.name ASC NULLS FIRST,
            es.id ASC NULLS FIRST",
    )
    .bind(gym_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows)
}

async fn fetch_gym_station_exercise_variant_rows(
    repository: &DomainRepository,
    gym_id: &str,
    station_id: &str,
    user_id: &str,
) -> Result<Vec<PgRow>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            e.id::text AS exercise_id,
            e.name AS exercise_name,
            ev.id::text AS variant_id,
            ev.name AS variant_name,
            ev.repetition_kind,
            ev.load_input_mode,
            ev.set_tracking_mode
         FROM exercise_variant_equipment_compatibilities evec
         JOIN exercise_variants ev
           ON ev.id = evec.exercise_variant_id
          AND ev.user_id = $3::uuid
          AND ev.requires_station = TRUE
         JOIN exercises e
           ON e.id = ev.exercise_id
          AND e.user_id = $3::uuid
         JOIN equipment_stations es
           ON es.id = evec.equipment_station_id
          AND es.user_id = $3::uuid
          AND es.gym_id = $1::uuid
         WHERE evec.equipment_station_id = $2::uuid
           AND evec.user_id = $3::uuid
           AND evec.is_enabled = TRUE
         ORDER BY
            lower(e.name) ASC,
            e.name ASC,
            e.id ASC,
            lower(ev.name) ASC,
            ev.name ASC,
            ev.id ASC",
    )
    .bind(gym_id)
    .bind(station_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows)
}

fn group_gym_exercise_rows(rows: Vec<PgRow>) -> Vec<GymExerciseGroup> {
    let mut groups: Vec<GymExerciseGroup> = Vec::new();

    for row in rows {
        let exercise_id: String = row.get("exercise_id");
        let exercise_name: String = row.get("exercise_name");
        let variant_id: String = row.get("variant_id");
        let variant_name: String = row.get("variant_name");
        let requires_station: bool = row.get("requires_station");

        if groups
            .last()
            .is_none_or(|group| group.exercise_id != exercise_id)
        {
            groups.push(GymExerciseGroup {
                exercise_id: exercise_id.clone(),
                exercise_name,
                variants: Vec::new(),
            });
        }

        let group = groups.last_mut().expect("group should exist");
        if group
            .variants
            .last()
            .is_none_or(|variant| variant.variant_id != variant_id)
        {
            group.variants.push(GymExerciseVariantSummary {
                variant_id: variant_id.clone(),
                variant_name,
                requires_station,
                station_availability: GymStationAvailability::Stationless,
                repetition_kind: row.get("repetition_kind"),
                load_input_mode: row.get("load_input_mode"),
                set_tracking_mode: row.get("set_tracking_mode"),
                station_options: Vec::new(),
            });
        }

        if let Some(station_id) = row.get::<Option<String>, _>("station_id") {
            let station_name = row
                .get::<Option<String>, _>("station_name")
                .expect("station rows should include station_name");
            group
                .variants
                .last_mut()
                .expect("variant should exist")
                .station_options
                .push(GymStationOption {
                    station_id,
                    station_name,
                    station_profile_loads_kg: Vec::new(),
                });
        }
    }

    for group in &mut groups {
        for variant in &mut group.variants {
            variant.station_availability = if variant.requires_station {
                match variant.station_options.len() {
                    1 => GymStationAvailability::SingleStation,
                    _ => GymStationAvailability::MultiStation,
                }
            } else {
                GymStationAvailability::Stationless
            };
        }
    }

    groups
}

fn group_gym_station_exercise_rows(rows: Vec<PgRow>) -> Vec<GymStationExerciseGroup> {
    let mut groups: Vec<GymStationExerciseGroup> = Vec::new();

    for row in rows {
        let exercise_id: String = row.get("exercise_id");
        let exercise_name: String = row.get("exercise_name");

        if groups
            .last()
            .is_none_or(|group| group.exercise_id != exercise_id)
        {
            groups.push(GymStationExerciseGroup {
                exercise_id: exercise_id.clone(),
                exercise_name,
                variants: Vec::new(),
            });
        }

        groups
            .last_mut()
            .expect("group should exist")
            .variants
            .push(GymStationExerciseVariantSummary {
                variant_id: row.get("variant_id"),
                variant_name: row.get("variant_name"),
                repetition_kind: row.get("repetition_kind"),
                load_input_mode: row.get("load_input_mode"),
                set_tracking_mode: row.get("set_tracking_mode"),
            });
    }

    groups
}
