use super::{DomainRepository, PersistenceError};
use crate::domain::{NewWorkout, Workout, WorkoutExercise, WorkoutSet, WorkoutSummary};
use sqlx::Row;
use std::collections::HashMap;

pub(super) async fn fetch_workout_summary(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<WorkoutSummary>, PersistenceError> {
    let maybe_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            w.training_plan_id::text AS training_plan_id,
            tp.name AS training_plan_name,
            w.gym_id::text AS gym_id,
            g.name AS gym_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            COUNT(DISTINCT we.id)::bigint AS exercise_count,
            COUNT(ws.id)::bigint AS completed_set_count
         FROM workouts w
         JOIN training_plans tp ON tp.id = w.training_plan_id
         JOIN gyms g ON g.id = w.gym_id
         LEFT JOIN workout_exercises we ON we.workout_id = w.id
         LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid
         GROUP BY w.id, tp.name, g.name",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(maybe_row.map(|row| WorkoutSummary {
        id: row.get("id"),
        training_plan_id: row.get("training_plan_id"),
        training_plan_name: row.get("training_plan_name"),
        gym_id: row.get("gym_id"),
        gym_name: row.get("gym_name"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        exercise_count: row.get("exercise_count"),
        completed_set_count: row.get("completed_set_count"),
    }))
}

pub(super) async fn create_workout(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<Workout, PersistenceError> {
    let mut tx = repository.pool.begin().await?;

    let workout_row = sqlx::query(
        "INSERT INTO workouts (
            training_plan_id,
            gym_id,
            started_at,
            completed_at,
            current_exercise_position,
            user_id
         )
         VALUES ($1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz, $5, $6::uuid)
         RETURNING id::text AS id",
    )
    .bind(&new_workout.training_plan_id)
    .bind(&new_workout.gym_id)
    .bind(new_workout.started_at.as_deref())
    .bind(new_workout.completed_at.as_deref())
    .bind(new_workout.current_exercise_position)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    let workout_id: String = workout_row.get("id");

    insert_workout_progress(&mut tx, &workout_id, new_workout, user_id).await?;
    tx.commit().await?;

    let created = fetch_workout(repository, &workout_id, user_id).await?;
    match created {
        Some(workout) => Ok(workout),
        None => Err(PersistenceError::Sqlx(sqlx::Error::RowNotFound)),
    }
}

pub(super) async fn insert_workout_progress(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), PersistenceError> {
    for exercise in &new_workout.exercises {
        // The current renderer may not yet submit final option/variant/station selections for
        // every exercise. Those nullable columns deliberately persist `NULL` until later work
        // replaces this temporary path with real user-selected references.
        let workout_exercise_row = sqlx::query(
            "INSERT INTO workout_exercises (
                workout_id,
                training_plan_exercise_id,
                position,
                selected_variant_id,
                selected_station_id,
                selected_plan_exercise_option_id,
                user_id
             )
             VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid, $7::uuid)
             RETURNING id::text AS id",
        )
        .bind(workout_id)
        .bind(&exercise.training_plan_exercise_id)
        .bind(exercise.position)
        .bind(exercise.selected_variant_id.as_deref())
        .bind(exercise.selected_station_id.as_deref())
        .bind(exercise.selected_plan_exercise_option_id.as_deref())
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;

        let workout_exercise_id: String = workout_exercise_row.get("id");

            for set in &exercise.sets {
            sqlx::query(
                "INSERT INTO workout_sets (
                    workout_exercise_id,
                    set_index,
                    reps,
                    load_display_value,
                    load_display_unit,
                    load_canonical_kg,
                    completed_at,
                    user_id
                 )
                 VALUES ($1::uuid, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8::uuid)",
            )
            .bind(&workout_exercise_id)
            .bind(set.set_index)
            .bind(set.reps)
            .bind(set.load_display_value)
            .bind(&set.load_display_unit)
            .bind(set.load_canonical_kg)
            .bind(set.completed_at.as_deref())
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

pub(super) async fn fetch_workout(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<Workout>, PersistenceError> {
    let maybe_workout_row = sqlx::query(
        "SELECT
            id::text AS id,
            training_plan_id::text AS training_plan_id,
            gym_id::text AS gym_id,
            started_at::text AS started_at,
            completed_at::text AS completed_at
         FROM workouts
         WHERE id = $1::uuid",
    )
    .bind(workout_id)
    .fetch_optional(&repository.pool)
    .await?;

    // ensure the fetched row belongs to the provided user
    if maybe_workout_row.is_some() {
        let row_user_check = sqlx::query("SELECT 1 FROM workouts WHERE id = $1::uuid AND user_id = $2::uuid")
            .bind(workout_id)
            .bind(user_id)
            .fetch_optional(&repository.pool)
            .await?;

        if row_user_check.is_none() {
            return Ok(None);
        }
    }

    let Some(workout_row) = maybe_workout_row else {
        return Ok(None);
    };

    let mut workout = Workout {
        id: workout_row.get("id"),
        training_plan_id: workout_row.get("training_plan_id"),
        gym_id: workout_row.get("gym_id"),
        started_at: workout_row.get("started_at"),
        completed_at: workout_row.get("completed_at"),
        exercises: Vec::new(),
    };

    let exercise_rows = sqlx::query(
        "SELECT
            id::text AS id,
            training_plan_exercise_id::text AS training_plan_exercise_id,
            position,
            selected_variant_id::text AS selected_variant_id,
            selected_station_id::text AS selected_station_id,
            selected_plan_exercise_option_id::text AS selected_plan_exercise_option_id
         FROM workout_exercises
         WHERE workout_id = $1::uuid
         ORDER BY position ASC",
    )
    .bind(workout_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut index_by_workout_exercise_id = HashMap::new();

    for row in exercise_rows {
        let current_workout_exercise_id: String = row.get("id");
        index_by_workout_exercise_id
            .insert(current_workout_exercise_id.clone(), workout.exercises.len());

        workout.exercises.push(WorkoutExercise {
            id: current_workout_exercise_id,
            training_plan_exercise_id: row.get("training_plan_exercise_id"),
            position: row.get("position"),
            selected_variant_id: row.get("selected_variant_id"),
            selected_station_id: row.get("selected_station_id"),
            selected_plan_exercise_option_id: row.get("selected_plan_exercise_option_id"),
            sets: Vec::new(),
        });
    }

    let set_rows = sqlx::query(
        "SELECT
            id::text AS id,
            workout_exercise_id::text AS workout_exercise_id,
            set_index,
            reps,
            load_display_value::double precision AS load_display_value,
            load_display_unit,
            load_canonical_kg::double precision AS load_canonical_kg,
            completed_at::text AS completed_at
         FROM workout_sets
         WHERE workout_exercise_id IN (
            SELECT id FROM workout_exercises WHERE workout_id = $1::uuid
         )
         ORDER BY workout_exercise_id ASC, set_index ASC",
    )
    .bind(workout_id)
    .fetch_all(&repository.pool)
    .await?;

    for row in set_rows {
        let set_workout_exercise_id: String = row.get("workout_exercise_id");
        if let Some(exercise_index) = index_by_workout_exercise_id.get(&set_workout_exercise_id) {
            workout.exercises[*exercise_index].sets.push(WorkoutSet {
                id: row.get("id"),
                set_index: row.get("set_index"),
                reps: row.get("reps"),
                load_display_value: row.get("load_display_value"),
                load_display_unit: row.get("load_display_unit"),
                load_canonical_kg: row.get("load_canonical_kg"),
                completed_at: row.get("completed_at"),
            });
        }
    }

    Ok(Some(workout))
}
