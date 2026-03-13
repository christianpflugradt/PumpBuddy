use super::{DomainRepository, PersistenceError};
use crate::domain::ActiveWorkoutSet;
use sqlx::Row;

pub(super) async fn fetch_latest_historical_suggestion(
    repository: &DomainRepository,
    current_workout_id: &str,
    exercise_id: &str,
    selected_variant_id: Option<&str>,
    selected_station_id: Option<&str>,
) -> Result<Option<ActiveWorkoutSet>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            ws.load_display_value::double precision AS load_value,
            ws.reps
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         WHERE w.id <> $1::uuid
           AND tpe.exercise_id = $2::uuid
           AND ($3::uuid IS NULL OR we.selected_variant_id = $3::uuid)
           AND ($4::uuid IS NULL OR we.selected_station_id = $4::uuid)
         ORDER BY ws.completed_at DESC, w.updated_at DESC, ws.set_index DESC
         LIMIT 1",
    )
    .bind(current_workout_id)
    .bind(exercise_id)
    .bind(selected_variant_id)
    .bind(selected_station_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| ActiveWorkoutSet {
        load_value: row.get("load_value"),
        reps: row.get("reps"),
    }))
}

pub(super) fn default_suggested_set() -> ActiveWorkoutSet {
    ActiveWorkoutSet {
        load_value: 10.0,
        reps: Some(10),
    }
}
