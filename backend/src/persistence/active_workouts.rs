use super::{suggestions, workouts, DomainRepository, PersistenceError};
use crate::domain::{
    ActiveWorkout, ActiveWorkoutExercise, ActiveWorkoutSet, CompletedActiveWorkoutSet, NewWorkout,
    NewWorkoutExercise, NewWorkoutSet, WorkoutSummary, REPETITION_KIND_SECS,
};
use sqlx::Row;
use std::collections::HashMap;

fn map_suggestion_to_station_profile(
    suggestion: ActiveWorkoutSet,
    load_input_mode: Option<&str>,
    profile_loads: &[f64],
    suggestion_uses_profile_units: bool,
) -> ActiveWorkoutSet {
    let profile_candidate = match (load_input_mode, suggestion_uses_profile_units) {
        (Some("PER_SIDE"), true) => suggestion.load_value,
        (Some("PER_SIDE"), false) => suggestion.load_value / 2.0,
        _ => suggestion.load_value,
    };
    let Some(snapped_load) = suggestions::snap_to_profile_load(profile_loads, profile_candidate)
    else {
        return suggestion;
    };

    let canonical_snapped_load = match load_input_mode {
        Some("PER_SIDE") => snapped_load * 2.0,
        _ => snapped_load,
    };

    ActiveWorkoutSet {
        set_index: suggestion.set_index,
        set_side: suggestion.set_side,
        load_value: canonical_snapped_load,
        reps: suggestion.reps,
    }
}

fn set_side_order(side: &str) -> i32 {
    match side {
        "LEFT" => 0,
        "RIGHT" => 1,
        _ => 2,
    }
}

fn pending_unilateral_right_side_from_new(exercise: &NewWorkoutExercise) -> bool {
    if !matches!(exercise.set_tracking_mode.as_deref(), Some("UNILATERAL")) {
        return false;
    }

    exercise
        .sets
        .iter()
        .max_by_key(|set: &&NewWorkoutSet| (set.set_index, set_side_order(&set.set_side)))
        .is_some_and(|set| set.set_side == "LEFT")
}

fn pending_unilateral_right_side_from_active(exercise: &ActiveWorkoutExercise) -> bool {
    if !matches!(exercise.set_tracking_mode.as_deref(), Some("UNILATERAL")) {
        return false;
    }

    exercise
        .completed_sets
        .iter()
        .max_by_key(|set: &&CompletedActiveWorkoutSet| {
            (set.set_index, set_side_order(&set.set_side))
        })
        .is_some_and(|set| set.set_side == "LEFT")
}

fn apply_unilateral_pending_position_from_new_workout(
    current_exercise_position: Option<i32>,
    exercises: &[NewWorkoutExercise],
) -> Option<i32> {
    let requested_position = current_exercise_position?;

    let pending_position = exercises
        .iter()
        .filter(|exercise| pending_unilateral_right_side_from_new(exercise))
        .map(|exercise| exercise.position)
        .min();

    match pending_position {
        Some(position) if position < requested_position => Some(position),
        _ => Some(requested_position),
    }
}

fn apply_unilateral_pending_position_from_active_workout(
    current_exercise_position: i32,
    exercises: &[ActiveWorkoutExercise],
) -> i32 {
    let pending_position = exercises
        .iter()
        .filter(|exercise| pending_unilateral_right_side_from_active(exercise))
        .map(|exercise| exercise.position)
        .min();

    match pending_position {
        Some(position) if position < current_exercise_position => position,
        _ => current_exercise_position,
    }
}

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
    let mut normalized_workout = new_workout.clone();
    normalized_workout.current_exercise_position =
        apply_unilateral_pending_position_from_new_workout(
            new_workout.current_exercise_position,
            &new_workout.exercises,
        );

    let created = workouts::create_workout(repository, &normalized_workout, user_id).await?;
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
    // Preserve not-found semantics for cross-user attempts but normalize the error
    // message for the completion path to match API expectations (avoid leaking
    // whether the parent write or the summary lookup failed).
    match replace_active_workout(repository, workout_id, new_workout, user_id).await {
        Ok(_) => {}
        Err(PersistenceError::NotFound(_)) => {
            // Distinguish between a missing workout id vs a cross-user attempt.
            // If the workout id exists in the DB but the user predicate caused
            // the update to affect no rows, surface the generic "Workout not found"
            // message to avoid leaking ownership details. If the id itself is
            // absent, return the more specific "Active workout not found".
            let exists = sqlx::query("SELECT 1 FROM workouts WHERE id = $1::uuid")
                .bind(workout_id)
                .fetch_optional(&repository.pool)
                .await?;

            if exists.is_some() {
                return Err(PersistenceError::NotFound("Workout not found".to_owned()));
            } else {
                return Err(PersistenceError::NotFound(
                    "Active workout not found".to_owned(),
                ));
            }
        }
        Err(other) => return Err(other),
    }

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
            tp.id::text AS training_plan_id,
            tp.name AS training_plan_name,
            w.gym_id::text AS gym_id,
            g.name AS gym_name,
            w.started_at::text AS started_at,
            w.updated_at::text AS updated_at,
            w.current_exercise_position,
            (
                SELECT COUNT(*)::int
                FROM training_plan_exercises tpe
                WHERE tpe.training_plan_version_id = w.training_plan_version_id
            ) AS total_exercise_count
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
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
            ev.load_input_mode AS load_input_mode,
            ev.set_tracking_mode AS set_tracking_mode,
            ev.repetition_kind AS repetition_kind,
            we.selected_station_id::text AS selected_station_id,
            es.name AS selected_station_name,
            we.skipped_at::text AS skipped_at
         FROM training_plan_exercises tpe
         JOIN exercises e ON e.id = tpe.exercise_id
         LEFT JOIN workout_exercises we
           ON we.workout_id = $1::uuid
          AND we.training_plan_exercise_id = tpe.id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         LEFT JOIN equipment_stations es ON es.id = we.selected_station_id
         WHERE tpe.training_plan_version_id = (
            SELECT training_plan_version_id
            FROM workouts
            WHERE id = $2::uuid
         )
         ORDER BY tpe.position ASC",
    )
    .bind(workout_id)
    .bind(workout_id)
    .fetch_all(&repository.pool)
    .await?;

    let set_rows = sqlx::query(
        "SELECT
            ws.workout_exercise_id::text AS workout_exercise_id,
            ws.set_index,
            ws.set_side,
            ws.load_canonical_kg::double precision AS load_value,
            COALESCE(ws.repetition_value, ws.reps) AS repetition_value
         FROM workout_sets ws
         WHERE ws.workout_exercise_id IN (
            SELECT id
            FROM workout_exercises
            WHERE workout_id = $1::uuid
         )
         ORDER BY ws.workout_exercise_id ASC,
                  ws.set_index ASC,
                  CASE ws.set_side WHEN 'LEFT' THEN 0 WHEN 'RIGHT' THEN 1 ELSE 2 END ASC",
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
                set_side: row.get("set_side"),
                load_value: row.get::<Option<f64>, _>("load_value"),
                reps: row.get("repetition_value"),
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
        let set_tracking_mode: Option<String> = row.get("set_tracking_mode");
        let repetition_kind: String = row
            .get::<Option<String>, _>("repetition_kind")
            .unwrap_or_else(|| "REPS".to_owned());
        let selected_station_id: Option<String> = row.get("selected_station_id");
        let exercise_id = row.get::<String, _>("exercise_id");
        let (idx, suggested_side) = match (
            set_tracking_mode.as_deref(),
            completed_sets.last().map(|set| set.set_side.as_str()),
            completed_sets.last().map(|set| set.set_index),
        ) {
            (Some("UNILATERAL"), Some("LEFT"), Some(last_index)) => (last_index, "RIGHT"),
            (Some("UNILATERAL"), _, Some(last_index)) => (last_index + 1, "LEFT"),
            (Some("UNILATERAL"), _, None) => (1, "LEFT"),
            (_, _, Some(last_index)) => (last_index + 1, "BILATERAL"),
            (_, _, None) => (1, "BILATERAL"),
        };
        let default_load_value = suggestions::default_suggested_set(&repetition_kind).load_value;
        let last_current = completed_sets.last().and_then(|set| {
            if let Some(load_value) = set.load_value {
                return Some(ActiveWorkoutSet {
                    set_index: set.set_index,
                    set_side: set.set_side.clone(),
                    load_value,
                    reps: set.reps,
                });
            }
            if selected_station_id.is_none() {
                return Some(ActiveWorkoutSet {
                    set_index: set.set_index,
                    set_side: set.set_side.clone(),
                    load_value: default_load_value,
                    reps: set.reps,
                });
            }
            None
        });

        let from_rules = if repetition_kind == REPETITION_KIND_SECS {
            last_current.clone()
        } else {
            suggestions::evaluate_historical_suggestion_rules(
                repository,
                suggestions::HistoricalSuggestionRuleContext {
                    user_id,
                    current_workout_id: workout_id,
                    exercise_id: &exercise_id,
                    current_gym_id: workout.gym_id.as_deref(),
                    selected_variant_id: selected_variant_id.as_deref(),
                    selected_station_id: selected_station_id.as_deref(),
                    requested_set_side: suggested_side,
                    idx,
                    last_current,
                    repetition_kind: &repetition_kind,
                },
            )
            .await?
        };

        let mut suggested_set: ActiveWorkoutSet = match (from_rules, selected_station_id.as_deref())
        {
            (Some(suggestion), Some(station_id)) => {
                let profile_loads =
                    suggestions::fetch_station_profile_loads(repository, station_id).await?;
                map_suggestion_to_station_profile(
                    suggestion,
                    row.get::<Option<String>, _>("load_input_mode").as_deref(),
                    &profile_loads,
                    false,
                )
            }
            (Some(suggestion), None) => suggestion,
            (None, Some(station_id)) => {
                let profile_loads =
                    suggestions::fetch_station_profile_loads(repository, station_id).await?;
                let suggestion =
                    suggestions::profile_start_suggested_set(&profile_loads, &repetition_kind)
                        .unwrap_or_else(|| suggestions::default_suggested_set(&repetition_kind));
                map_suggestion_to_station_profile(
                    suggestion,
                    row.get::<Option<String>, _>("load_input_mode").as_deref(),
                    &profile_loads,
                    true,
                )
            }
            (None, None) => suggestions::default_suggested_set(&repetition_kind),
        };
        suggested_set.set_index = idx;
        suggested_set.set_side = suggested_side.to_owned();

        workout.exercises.push(ActiveWorkoutExercise {
            training_plan_exercise_id: row.get("training_plan_exercise_id"),
            position,
            exercise_name: row.get("exercise_name"),
            selected_plan_exercise_option_id: row.get("selected_plan_exercise_option_id"),
            selected_variant_id,
            selected_variant_name: row.get("selected_variant_name"),
            load_input_mode: row.get("load_input_mode"),
            set_tracking_mode,
            selected_station_id,
            selected_station_name: row.get("selected_station_name"),
            skipped_at: row.get("skipped_at"),
            completed_sets,
            suggested_set,
        });
    }

    workout.current_exercise_position = apply_unilateral_pending_position_from_active_workout(
        workout.current_exercise_position,
        &workout.exercises,
    );

    Ok(Some(workout))
}

async fn replace_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx = repository.pool.begin().await?;

    let maybe_training_plan_version_row = sqlx::query(
        "SELECT training_plan_version_id::text AS training_plan_version_id
         FROM workouts
         WHERE id = $1::uuid
           AND completed_at IS NULL
           AND user_id = $2::uuid
         FOR UPDATE",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let training_plan_version_id = maybe_training_plan_version_row
        .ok_or_else(|| PersistenceError::NotFound("Active workout not found".to_owned()))?
        .get::<String, _>("training_plan_version_id");

    let normalized_current_exercise_position = apply_unilateral_pending_position_from_new_workout(
        new_workout.current_exercise_position,
        &new_workout.exercises,
    );

    let update_result = sqlx::query(
        "UPDATE workouts
         SET training_plan_version_id = $2::uuid,
             gym_id = $3::uuid,
             started_at = $4::timestamptz,
             completed_at = $5::timestamptz,
             current_exercise_position = $6,
             updated_at = NOW()
         WHERE id = $1::uuid
            AND completed_at IS NULL
            AND user_id = $7::uuid",
    )
    .bind(workout_id)
    .bind(training_plan_version_id)
    .bind(new_workout.gym_id.as_deref())
    .bind(new_workout.started_at.as_deref())
    .bind(new_workout.completed_at.as_deref())
    .bind(normalized_current_exercise_position)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    if update_result.rows_affected() == 0 {
        return Err(PersistenceError::NotFound(
            "Active workout not found".to_owned(),
        ));
    }

    // remove only sets belonging to exercises for this workout and user
    sqlx::query(
        "DELETE FROM workout_sets
         WHERE workout_exercise_id IN (
            SELECT id FROM workout_exercises WHERE workout_id = $1::uuid AND user_id = $2::uuid
         )",
    )
    .bind(workout_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // remove only exercises created by the same user for this workout
    sqlx::query("DELETE FROM workout_exercises WHERE workout_id = $1::uuid AND user_id = $2::uuid")
        .bind(workout_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    workouts::insert_workout_progress(&mut tx, workout_id, new_workout, user_id).await?;
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::map_suggestion_to_station_profile;
    use crate::domain::ActiveWorkoutSet;

    #[test]
    fn map_suggestion_to_station_profile_keeps_total_mode_behavior() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 31.2,
            reps: Some(8),
        };
        let profile_loads = [10.0, 12.5, 15.0, 20.0, 30.0];

        let mapped =
            map_suggestion_to_station_profile(suggestion, Some("TOTAL"), &profile_loads, false);
        assert_eq!(mapped.load_value, 30.0);
        assert_eq!(mapped.reps, Some(8));
    }

    #[test]
    fn map_suggestion_to_station_profile_converts_per_side_and_returns_canonical_total() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 31.2,
            reps: Some(8),
        };
        let profile_loads = [10.0, 12.5, 15.0, 20.0, 30.0];

        let mapped =
            map_suggestion_to_station_profile(suggestion, Some("PER_SIDE"), &profile_loads, false);
        assert_eq!(mapped.load_value, 30.0);
        assert_eq!(mapped.reps, Some(8));
    }

    #[test]
    fn map_suggestion_to_station_profile_preserves_per_side_profile_units_for_start_suggestions() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 12.5,
            reps: Some(10),
        };
        let profile_loads = [2.5, 6.25, 12.5, 17.5];

        let mapped =
            map_suggestion_to_station_profile(suggestion, Some("PER_SIDE"), &profile_loads, true);
        assert_eq!(mapped.load_value, 25.0);
        assert_eq!(mapped.reps, Some(10));
    }
}
