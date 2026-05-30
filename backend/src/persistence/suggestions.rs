use super::{DomainRepository, PersistenceError};
use crate::domain::{normalize_repetition_kind, ActiveWorkoutSet};
use crate::workout_suggestion_logic;
use sqlx::Row;

#[derive(Debug, Clone, Copy, Default)]
struct HistoricalScope<'a> {
    variant_eq: Option<&'a str>,
    variant_ne: Option<&'a str>,
    gym_eq: Option<&'a str>,
    gym_ne: Option<&'a str>,
    station_eq: Option<&'a str>,
    station_ne: Option<&'a str>,
    station_is_null_only: bool,
    set_side_eq: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub(super) struct HistoricalSuggestionRuleContext<'a> {
    pub(super) user_id: &'a str,
    pub(super) current_workout_id: &'a str,
    pub(super) exercise_id: &'a str,
    pub(super) current_gym_id: Option<&'a str>,
    pub(super) selected_variant_id: Option<&'a str>,
    pub(super) selected_station_id: Option<&'a str>,
    pub(super) requested_set_side: &'a str,
    pub(super) idx: i32,
    pub(super) last_current: Option<ActiveWorkoutSet>,
    pub(super) repetition_kind: &'a str,
}

#[allow(clippy::too_many_arguments)]
async fn fetch_historical_suggestions_for_scope(
    repository: &DomainRepository,
    user_id: &str,
    current_workout_id: &str,
    exercise_id: &str,
    set_index: i32,
    allow_null_load: bool,
    repetition_kind: &str,
    scope: HistoricalScope<'_>,
) -> Result<Vec<ActiveWorkoutSet>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            ws.load_canonical_kg::double precision AS load_value,
            ws.set_side,
            ws.repetition_value AS repetition_value
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND tpe.exercise_id = $2::uuid
           AND ws.set_index = $3
           AND (NOT $10::boolean OR we.selected_station_id IS NULL)
           AND w.user_id = $11::uuid
           AND we.user_id = $11::uuid
           AND ws.user_id = $11::uuid
           AND tpe.user_id = $11::uuid
           AND ($4::uuid IS NULL OR we.selected_variant_id = $4::uuid)
           AND ($5::uuid IS NULL OR we.selected_variant_id IS NOT NULL AND we.selected_variant_id <> $5::uuid)
           AND ($6::uuid IS NULL OR w.gym_id = $6::uuid)
           AND ($7::uuid IS NULL OR w.gym_id IS NOT NULL AND w.gym_id <> $7::uuid)
           AND ($8::uuid IS NULL OR we.selected_station_id = $8::uuid)
           AND ($9::uuid IS NULL OR we.selected_station_id IS NOT NULL AND we.selected_station_id <> $9::uuid)
           AND ($12::boolean OR ws.load_canonical_kg IS NOT NULL)
           AND ($13::text IS NULL OR ws.set_side = $13)
           AND COALESCE(ev.repetition_kind, 'REPS') = $14
         ORDER BY ws.completed_at DESC, w.updated_at DESC, w.id DESC, we.id DESC, ws.id DESC",
    )
    .bind(current_workout_id)
    .bind(exercise_id)
    .bind(set_index)
    .bind(scope.variant_eq)
    .bind(scope.variant_ne)
    .bind(scope.gym_eq)
    .bind(scope.gym_ne)
    .bind(scope.station_eq)
    .bind(scope.station_ne)
    .bind(scope.station_is_null_only)
    .bind(user_id)
    .bind(allow_null_load)
    .bind(scope.set_side_eq)
    .bind(normalize_repetition_kind(Some(repetition_kind)))
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| ActiveWorkoutSet {
            set_index,
            set_side: row.get("set_side"),
            load_value: row
                .get::<Option<f64>, _>("load_value")
                .unwrap_or(workout_suggestion_logic::FREE_MODE_DEFAULT_LOAD_KG),
            repetition_value: row.get("repetition_value"),
        })
        .collect())
}

#[allow(clippy::too_many_arguments)]
async fn fetch_latest_historical_suggestion_for_scope(
    repository: &DomainRepository,
    user_id: &str,
    current_workout_id: &str,
    exercise_id: &str,
    set_index: i32,
    allow_null_load: bool,
    repetition_kind: &str,
    scope: HistoricalScope<'_>,
) -> Result<Option<ActiveWorkoutSet>, PersistenceError> {
    let candidates = fetch_historical_suggestions_for_scope(
        repository,
        user_id,
        current_workout_id,
        exercise_id,
        set_index,
        allow_null_load,
        repetition_kind,
        scope,
    )
    .await?;
    Ok(candidates.into_iter().next())
}

pub(super) async fn evaluate_historical_suggestion_rules(
    repository: &DomainRepository,
    context: HistoricalSuggestionRuleContext<'_>,
) -> Result<Option<ActiveWorkoutSet>, PersistenceError> {
    let HistoricalSuggestionRuleContext {
        user_id,
        current_workout_id,
        exercise_id,
        current_gym_id: _current_gym_id,
        selected_variant_id,
        selected_station_id,
        requested_set_side,
        idx,
        last_current,
        repetition_kind,
    } = context;
    let allow_null_load = selected_station_id.is_none();

    if idx <= 0 {
        return Ok(last_current);
    }

    // Rule 1: same variant + same station with exact index match.
    if let (Some(variant_id), Some(station_id)) = (selected_variant_id, selected_station_id) {
        let exact = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            idx,
            allow_null_load,
            repetition_kind,
            HistoricalScope {
                variant_eq: Some(variant_id),
                station_eq: Some(station_id),
                set_side_eq: Some(requested_set_side),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if exact.is_some() {
            return Ok(exact);
        }
    } else if let Some(variant_id) = selected_variant_id {
        let stationless_exact = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            idx,
            allow_null_load,
            repetition_kind,
            HistoricalScope {
                variant_eq: Some(variant_id),
                station_is_null_only: true,
                set_side_eq: Some(requested_set_side),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if stationless_exact.is_some() {
            return Ok(stationless_exact);
        }
    }
    if requested_set_side == "RIGHT"
        && last_current
            .as_ref()
            .is_some_and(|set| set.set_side == "LEFT" && set.set_index == idx)
    {
        return Ok(last_current);
    }
    if last_current.is_some() {
        return Ok(last_current);
    }

    // Rules 2-6: historical lookups are only valid for first-set LEFT/BILATERAL suggestions.
    if idx != 1 || requested_set_side == "RIGHT" {
        return Ok(None);
    }

    // Rule 2: same variant + different station.
    if let (Some(variant_id), Some(station_id)) = (selected_variant_id, selected_station_id) {
        let rule_2 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            repetition_kind,
            HistoricalScope {
                variant_eq: Some(variant_id),
                station_ne: Some(station_id),
                set_side_eq: Some(requested_set_side),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_2.is_some() {
            return Ok(rule_2);
        }
    }

    // Rule 3: same variant.
    if let Some(variant_id) = selected_variant_id {
        let rule_3 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            repetition_kind,
            HistoricalScope {
                variant_eq: Some(variant_id),
                set_side_eq: Some(requested_set_side),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_3.is_some() {
            return Ok(rule_3);
        }
    }

    // Rule 4: same exercise + same station + other variant.
    if let (Some(variant_id), Some(station_id)) = (selected_variant_id, selected_station_id) {
        let rule_4 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            repetition_kind,
            HistoricalScope {
                variant_ne: Some(variant_id),
                station_eq: Some(station_id),
                set_side_eq: Some(requested_set_side),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_4.is_some() {
            return Ok(rule_4);
        }
    }

    // Rule 5: same exercise + other variant + other station.
    if let (Some(variant_id), Some(station_id)) = (selected_variant_id, selected_station_id) {
        let rule_5 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            repetition_kind,
            HistoricalScope {
                variant_ne: Some(variant_id),
                station_ne: Some(station_id),
                set_side_eq: Some(requested_set_side),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_5.is_some() {
            return Ok(rule_5);
        }
    }

    // Rule 6: same exercise.
    let rule_6 = fetch_latest_historical_suggestion_for_scope(
        repository,
        user_id,
        current_workout_id,
        exercise_id,
        1,
        allow_null_load,
        repetition_kind,
        HistoricalScope {
            set_side_eq: Some(requested_set_side),
            ..HistoricalScope::default()
        },
    )
    .await?;
    if rule_6.is_some() {
        return Ok(rule_6);
    }

    Ok(None)
}

pub(super) async fn fetch_station_profile_loads_for_user(
    repository: &DomainRepository,
    selected_station_id: &str,
    user_id: &str,
) -> Result<Vec<f64>, PersistenceError> {
    fetch_station_profile_loads_for_user_and_gym(repository, selected_station_id, user_id, None)
        .await
}

pub(super) async fn fetch_station_profile_loads_for_user_and_gym(
    repository: &DomainRepository,
    selected_station_id: &str,
    user_id: &str,
    gym_id: Option<&str>,
) -> Result<Vec<f64>, PersistenceError> {
    let maybe_row = sqlx::query(
        "SELECT
            lp.definition AS station_profile_definition,
            lp.weight_unit AS station_profile_weight_unit
         FROM equipment_stations es
         JOIN load_profiles lp ON lp.id = es.load_profile_id
         WHERE es.id = $1::uuid
           AND es.user_id = $2::uuid
           AND lp.user_id = $2::uuid
           AND ($3::uuid IS NULL OR es.gym_id = $3::uuid)",
    )
    .bind(selected_station_id)
    .bind(user_id)
    .bind(gym_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(row) = maybe_row else {
        return Ok(Vec::new());
    };

    let definition: sqlx::types::JsonValue = row.get("station_profile_definition");
    let weight_unit: String = row.get("station_profile_weight_unit");

    DomainRepository::load_profile_definition_to_kg(&definition, &weight_unit)
}
