use super::{
    DomainRepository, HistoricalSuggestionCandidate, HistoricalSuggestionQuery, PersistenceError,
};
use crate::domain::normalize_repetition_kind;
use sqlx::Row;

pub(super) async fn fetch_latest_historical_suggestion(
    repository: &DomainRepository,
    query: HistoricalSuggestionQuery,
) -> Result<Option<HistoricalSuggestionCandidate>, PersistenceError> {
    let row = sqlx::query(
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
         ORDER BY ws.completed_at DESC, w.updated_at DESC, w.id DESC, we.id DESC, ws.id DESC
         LIMIT 1",
    )
    .bind(&query.current_workout_id)
    .bind(&query.exercise_id)
    .bind(query.set_index)
    .bind(query.scope.variant_eq.as_deref())
    .bind(query.scope.variant_ne.as_deref())
    .bind(query.scope.gym_eq.as_deref())
    .bind(query.scope.gym_ne.as_deref())
    .bind(query.scope.station_eq.as_deref())
    .bind(query.scope.station_ne.as_deref())
    .bind(query.scope.station_is_null_only)
    .bind(&query.user_id)
    .bind(query.allow_null_load)
    .bind(query.scope.set_side_eq.as_deref())
    .bind(normalize_repetition_kind(Some(&query.repetition_kind)))
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| HistoricalSuggestionCandidate {
        set_index: query.set_index,
        set_side: row.get("set_side"),
        load_value: row.get("load_value"),
        repetition_value: row.get("repetition_value"),
    }))
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
