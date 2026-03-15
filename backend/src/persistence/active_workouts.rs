use super::{suggestions, workouts, DomainRepository, PersistenceError};
use crate::domain::{
    ActiveWorkout, ActiveWorkoutExercise, ActiveWorkoutSet, CompletedActiveWorkoutSet, NewWorkout,
    WorkoutSummary,
};
use sqlx::Row;
use std::collections::HashMap;

pub(super) async fn create_active_workout(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<ActiveWorkout, PersistenceError> {
    if fetch_first_active_workout(repository, user_id)
        .await?
        .is_some()
    {
        return Err(PersistenceError::Conflict(
            "An active workout already exists".to_owned(),
        ));
    }
    let created = workouts::create_workout(repository, new_workout, user_id).await?;
    fetch_active_workout(repository, &created.id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Active workout not found".to_owned()))
}

pub(super) async fn update_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<ActiveWorkout, PersistenceError> {
    replace_active_workout(repository, workout_id, new_workout, user_id).await?;
    fetch_active_workout(repository, workout_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Active workout not found".to_owned()))
}

pub(super) async fn complete_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<WorkoutSummary, PersistenceError> {
    replace_active_workout(repository, workout_id, new_workout, user_id).await?;
    workouts::fetch_workout_summary(repository, workout_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Workout not found".to_owned()))
}

pub(super) async fn cancel_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx = repository.pool.begin().await?;

    let maybe_workout = sqlx::query(
        "SELECT completed_at::text AS completed_at
     FROM workouts
     WHERE id = $1::uuid
       AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(workout) = maybe_workout else {
        return Err(PersistenceError::NotFound(
            "Active workout not found".to_owned(),
        ));
    };

    if workout.get::<Option<String>, _>("completed_at").is_some() {
        return Err(PersistenceError::Conflict(
            "Completed workouts cannot be cancelled".to_owned(),
        ));
    }

    sqlx::query(
        "DELETE FROM workouts WHERE id = $1::uuid AND completed_at IS NULL AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub(super) async fn fetch_first_active_workout(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Option<ActiveWorkout>, PersistenceError> {
    let maybe_id = sqlx::query(
        "SELECT id::text AS id
     FROM workouts
     WHERE completed_at IS NULL
       AND user_id = $1::uuid
     ORDER BY created_at ASC, id ASC
     LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(row) = maybe_id else {
        return Ok(None);
    };

    fetch_active_workout(repository, &row.get::<String, _>("id"), user_id).await
}

pub(super) async fn fetch_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<ActiveWorkout>, PersistenceError> {
    let maybe_workout_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            w.training_plan_id::text AS training_plan_id,
            tp.name AS training_plan_name,
            w.gym_id::text AS gym_id,
            g.name AS gym_name,
            w.started_at::text AS started_at,
            w.updated_at::text AS updated_at,
            w.current_exercise_position,
            (
                SELECT COUNT(*)::int
                FROM training_plan_exercises tpe
                WHERE tpe.training_plan_id = w.training_plan_id
            ) AS total_exercise_count
         FROM workouts w
         JOIN training_plans tp ON tp.id = w.training_plan_id
         JOIN gyms g ON g.id = w.gym_id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid
           AND w.completed_at IS NULL",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(workout_row) = maybe_workout_row else {
        return Ok(None);
    };

    let total_exercise_count: i32 = workout_row.get("total_exercise_count");
    let mut workout = ActiveWorkout {
        id: workout_row.get("id"),
        training_plan_id: workout_row.get("training_plan_id"),
        training_plan_name: workout_row.get("training_plan_name"),
        gym_id: workout_row.get("gym_id"),
        gym_name: workout_row.get("gym_name"),
        started_at: workout_row.get("started_at"),
        updated_at: workout_row.get("updated_at"),
        current_exercise_position: workout_row
            .get::<Option<i32>, _>("current_exercise_position")
            .unwrap_or(1),
        total_exercise_count,
        exercises: Vec::new(),
    };

    let exercise_rows = sqlx::query(
        "SELECT
            tpe.id::text AS training_plan_exercise_id,
            tpe.position,
            e.id::text AS exercise_id,
            e.name AS exercise_name,
            we.id::text AS workout_exercise_id,
            we.selected_plan_exercise_option_id::text AS selected_plan_exercise_option_id,
            we.selected_variant_id::text AS selected_variant_id,
            ev.name AS selected_variant_name,
            we.selected_station_id::text AS selected_station_id,
            es.name AS selected_station_name
         FROM training_plan_exercises tpe
         JOIN exercises e ON e.id = tpe.exercise_id
         LEFT JOIN workout_exercises we
           ON we.workout_id = $1::uuid
          AND we.training_plan_exercise_id = tpe.id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         LEFT JOIN equipment_stations es ON es.id = we.selected_station_id
         WHERE tpe.training_plan_id = $2::uuid
         ORDER BY tpe.position ASC",
    )
    .bind(workout_id)
    .bind(&workout.training_plan_id)
    .fetch_all(&repository.pool)
    .await?;

    let set_rows = sqlx::query(
        "SELECT
            ws.workout_exercise_id::text AS workout_exercise_id,
            ws.set_index,
            ws.load_display_value::double precision AS load_value,
            ws.reps AS reps
         FROM workout_sets ws
         WHERE ws.workout_exercise_id IN (
            SELECT id
            FROM workout_exercises
            WHERE workout_id = $1::uuid
         )
         ORDER BY ws.workout_exercise_id ASC, ws.set_index ASC",
    )
    .bind(workout_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut completed_sets_by_exercise_id: HashMap<String, Vec<CompletedActiveWorkoutSet>> =
        HashMap::new();
    for row in set_rows {
        let workout_exercise_id: String = row.get("workout_exercise_id");
        completed_sets_by_exercise_id
            .entry(workout_exercise_id)
            .or_default()
            .push(CompletedActiveWorkoutSet {
                set_index: row.get("set_index"),
                load_value: row.get("load_value"),
                reps: row.get("reps"),
            });
    }

    for row in exercise_rows {
        let position: i32 = row.get("position");
        let workout_exercise_id: Option<String> = row.get("workout_exercise_id");
        let completed_sets = workout_exercise_id
            .as_ref()
            .and_then(|id| completed_sets_by_exercise_id.remove(id))
            .unwrap_or_default();

        let selected_variant_id: Option<String> = row.get("selected_variant_id");
        let selected_station_id: Option<String> = row.get("selected_station_id");
        let suggested_set: ActiveWorkoutSet =
            if let Some(last_completed_set) = completed_sets.last() {
                ActiveWorkoutSet {
                    load_value: last_completed_set.load_value,
                    reps: last_completed_set.reps,
                }
            } else {
                suggestions::fetch_latest_historical_suggestion(
                    repository,
                    workout_id,
                    &row.get::<String, _>("exercise_id"),
                    selected_variant_id.as_deref(),
                    selected_station_id.as_deref(),
                )
                .await?
                .unwrap_or_else(suggestions::default_suggested_set)
            };

        workout.exercises.push(ActiveWorkoutExercise {
            training_plan_exercise_id: row.get("training_plan_exercise_id"),
            position,
            exercise_name: row.get("exercise_name"),
            selected_plan_exercise_option_id: row.get("selected_plan_exercise_option_id"),
            selected_variant_id,
            selected_variant_name: row.get("selected_variant_name"),
            selected_station_id,
            selected_station_name: row.get("selected_station_name"),
            completed_sets,
            suggested_set,
        });
    }

    Ok(Some(workout))
}

async fn replace_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx = repository.pool.begin().await?;

    let update_result = sqlx::query(
        "UPDATE workouts
         SET training_plan_id = $2::uuid,
             gym_id = $3::uuid,
             started_at = $4::timestamptz,
             completed_at = $5::timestamptz,
             current_exercise_position = $6,
             updated_at = NOW()
         WHERE id = $1::uuid
           AND completed_at IS NULL",
    )
    .bind(workout_id)
    .bind(&new_workout.training_plan_id)
    .bind(&new_workout.gym_id)
    .bind(new_workout.started_at.as_deref())
    .bind(new_workout.completed_at.as_deref())
    .bind(new_workout.current_exercise_position)
    .execute(&mut *tx)
    .await?;

    if update_result.rows_affected() == 0 {
        return Err(PersistenceError::NotFound(
            "Active workout not found".to_owned(),
        ));
    }

    sqlx::query(
        "DELETE FROM workout_sets
         WHERE workout_exercise_id IN (
            SELECT id FROM workout_exercises WHERE workout_id = $1::uuid
         )",
    )
    .bind(workout_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM workout_exercises WHERE workout_id = $1::uuid")
        .bind(workout_id)
        .execute(&mut *tx)
        .await?;

    workouts::insert_workout_progress(&mut tx, workout_id, new_workout, user_id).await?;
    tx.commit().await?;
    Ok(())
}
