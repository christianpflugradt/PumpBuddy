use super::{logging, progression, suggestions, workouts, DomainRepository, PersistenceError};
use crate::domain::{
    normalize_repetition_kind, ActiveWorkout, ActiveWorkoutExercise, CompletedActiveWorkoutSet,
    NewWorkout, NewWorkoutExercise, WorkoutSummary,
};
use crate::workout_metrics;
use crate::workout_suggestion_logic::{self, HistoricalProgressionSample, SuggestedSetInput};
use sqlx::Row;
use std::collections::HashMap;
use uuid::Uuid;

const ACTIVE_WORKOUT_CONFLICT_MESSAGE: &str = "An active workout already exists";
const ACTIVE_WORKOUT_UNIQUE_INDEX: &str = "workouts_single_active_per_user_unique";

#[allow(clippy::too_many_arguments)]
async fn fetch_reps_progression_history(
    repository: &DomainRepository,
    user_id: &str,
    current_workout_id: &str,
    exercise_id: &str,
    selected_variant_id: Option<&str>,
    selected_station_id: Option<&str>,
    requested_set_side: &str,
    set_index: i32,
) -> Result<Vec<HistoricalProgressionSample>, PersistenceError> {
    let Some(selected_variant_id) = selected_variant_id else {
        return Ok(Vec::new());
    };

    if set_index <= 0 {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        "SELECT
            ws.repetition_value,
            ws.load_canonical_kg::double precision AS load_value
         FROM workouts w
         JOIN workout_exercises we ON we.workout_id = w.id
         JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND w.user_id = $2::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid
           AND tpe.user_id = $2::uuid
           AND tpe.exercise_id = $3::uuid
           AND we.selected_variant_id = $4::uuid
           AND (
             ($5::uuid IS NULL AND we.selected_station_id IS NULL)
             OR we.selected_station_id = $5::uuid
           )
           AND ws.set_side = $6
           AND ws.set_index = $7
           AND ws.repetition_value IS NOT NULL
           AND COALESCE(ev.repetition_kind, 'REPS') = 'REPS'
         ORDER BY ws.completed_at DESC, w.updated_at DESC, w.id DESC, we.id DESC, ws.id DESC",
    )
    .bind(current_workout_id)
    .bind(user_id)
    .bind(exercise_id)
    .bind(selected_variant_id)
    .bind(selected_station_id)
    .bind(requested_set_side)
    .bind(set_index)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| HistoricalProgressionSample {
            reps: row.get("repetition_value"),
            load_value: row.get("load_value"),
        })
        .collect())
}

async fn fetch_latest_no_load_prior_set_repetition_value(
    repository: &DomainRepository,
    user_id: &str,
    current_workout_id: &str,
    exercise_id: &str,
    selected_variant_id: Option<&str>,
    set_index: i32,
    repetition_kind: &str,
) -> Result<Option<i32>, PersistenceError> {
    let Some(selected_variant_id) = selected_variant_id else {
        return Ok(None);
    };

    if set_index <= 0 {
        return Ok(None);
    }

    let row = sqlx::query(
        "WITH current_workout AS (
            SELECT training_plan_version_id
            FROM workouts
            WHERE id = $1::uuid
              AND user_id = $2::uuid
         )
         SELECT ws.repetition_value
         FROM current_workout cw
         JOIN workouts w ON w.training_plan_version_id = cw.training_plan_version_id
         JOIN workout_exercises we ON we.workout_id = w.id
         JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND w.completed_at IS NOT NULL
           AND w.user_id = $2::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid
           AND tpe.user_id = $2::uuid
           AND tpe.exercise_id = $3::uuid
           AND we.selected_variant_id = $4::uuid
           AND we.selected_station_id IS NULL
           AND ws.set_index = $5
           AND ws.repetition_value IS NOT NULL
           AND COALESCE(ev.repetition_kind, 'REPS') = $6
         ORDER BY w.completed_at DESC, ws.completed_at DESC, w.updated_at DESC, w.id DESC, we.id DESC, ws.id DESC
         LIMIT 1",
    )
    .bind(current_workout_id)
    .bind(user_id)
    .bind(exercise_id)
    .bind(selected_variant_id)
    .bind(set_index)
    .bind(normalize_repetition_kind(Some(repetition_kind)))
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.and_then(|r| r.get::<Option<i32>, _>("repetition_value")))
}

fn has_non_skipped_sets(exercise: &NewWorkoutExercise) -> bool {
    exercise.skipped_at.is_none() && !exercise.sets.is_empty()
}

fn should_complete_exercise_on_transition(
    current_exercise_position: Option<i32>,
    workout_completed_at: Option<&str>,
    exercise: &NewWorkoutExercise,
) -> bool {
    workout_completed_at.is_none()
        && current_exercise_position.is_some_and(|position| position > exercise.position)
        && has_non_skipped_sets(exercise)
}

fn should_complete_exercise_on_workout_finish(
    current_exercise_position: Option<i32>,
    workout_completed_at: Option<&str>,
    exercise: &NewWorkoutExercise,
) -> bool {
    workout_completed_at.is_some()
        && current_exercise_position == Some(exercise.position)
        && has_non_skipped_sets(exercise)
}

fn should_clear_exercise_completion_on_active_reopen(
    current_exercise_position: Option<i32>,
    workout_completed_at: Option<&str>,
    exercise: &NewWorkoutExercise,
) -> bool {
    workout_completed_at.is_none()
        && current_exercise_position.is_some_and(|position| position <= exercise.position)
}

fn active_workout_exists_conflict() -> PersistenceError {
    PersistenceError::Conflict(ACTIVE_WORKOUT_CONFLICT_MESSAGE.to_owned())
}

fn is_active_workout_unique_violation(error: &PersistenceError) -> bool {
    matches!(
        error,
        PersistenceError::Sqlx(sqlx::Error::Database(db_error))
            if db_error.is_unique_violation()
                && db_error.constraint() == Some(ACTIVE_WORKOUT_UNIQUE_INDEX)
    )
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
        return Err(active_workout_exists_conflict());
    }
    let normalized_workout = new_workout.clone();

    let created = match workouts::create_workout(repository, &normalized_workout, user_id).await {
        Ok(created) => created,
        Err(error) if is_active_workout_unique_violation(&error) => {
            return Err(active_workout_exists_conflict());
        }
        Err(error) => return Err(error),
    };
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
    merge_active_workout_progress(repository, workout_id, new_workout, user_id).await?;
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
    merge_active_workout_progress(repository, workout_id, new_workout, user_id).await?;

    workouts::fetch_workout_summary(repository, workout_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Workout not found".to_owned()))
}

pub(super) async fn cancel_active_workout(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx =
        logging::begin_transaction(&repository.pool, "cancel_active_workout", "active_workout")
            .await?;

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
        logging::rollback_transaction(tx, "cancel_active_workout", "active_workout").await;
        return Err(PersistenceError::NotFound(
            "Active workout not found".to_owned(),
        ));
    };

    if workout.get::<Option<String>, _>("completed_at").is_some() {
        logging::rollback_transaction(tx, "cancel_active_workout", "active_workout").await;
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

    logging::commit_transaction(tx, "cancel_active_workout", "active_workout").await?;
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
            we.selected_training_plan_exercise_variant_id::text AS selected_training_plan_exercise_variant_id,
            we.selected_variant_id::text AS selected_variant_id,
            ev.name AS selected_variant_name,
            ev.load_input_mode AS load_input_mode,
            ev.set_tracking_mode AS set_tracking_mode,
            ev.repetition_kind AS repetition_kind,
            we.selected_station_id::text AS selected_station_id,
            es.name AS selected_station_name,
            we.skipped_at::text AS skipped_at,
            we.completed_at::text AS completed_at,
            peo.rep_min AS rep_min,
            peo.rep_max AS rep_max
         FROM training_plan_exercises tpe
         JOIN exercises e ON e.id = tpe.exercise_id
         LEFT JOIN workout_exercises we
           ON we.workout_id = $1::uuid
          AND we.training_plan_exercise_id = tpe.id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         LEFT JOIN equipment_stations es ON es.id = we.selected_station_id
         LEFT JOIN training_plan_exercise_variants peo ON peo.id = we.selected_training_plan_exercise_variant_id
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
            ws.repetition_value AS repetition_value
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
                repetition_value: row.get("repetition_value"),
            });
    }

    let max_load_kg = repository
        .fetch_max_load_kg_preference_for_user(user_id)
        .await?;

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
        let next_set_plan = workout_suggestion_logic::derive_next_set_plan(
            set_tracking_mode.as_deref(),
            &completed_sets,
        );
        let idx = next_set_plan.set_index;
        let suggested_side = next_set_plan.set_side;
        let last_current = workout_suggestion_logic::derive_last_current(
            &completed_sets,
            selected_station_id.as_deref(),
            &repetition_kind,
        );

        let enough_data_for_reps_progression = progression::enough_data_for_reps_progression(
            repository,
            progression::RepsProgressionEligibilityContext {
                user_id,
                current_workout_id: workout_id,
                exercise_id: &exercise_id,
                selected_variant_id: selected_variant_id.as_deref(),
                selected_station_id: selected_station_id.as_deref(),
                requested_set_side: &suggested_side,
                max_set_index: idx,
                repetition_kind: &repetition_kind,
            },
        )
        .await?;
        let enough_data_for_load_progression = progression::enough_data_for_load_progression();

        let from_rules =
            if workout_suggestion_logic::should_use_historical_suggestion_rules(&repetition_kind) {
                suggestions::evaluate_historical_suggestion_rules(
                    repository,
                    suggestions::HistoricalSuggestionRuleContext {
                        user_id,
                        current_workout_id: workout_id,
                        exercise_id: &exercise_id,
                        current_gym_id: workout.gym_id.as_deref(),
                        selected_variant_id: selected_variant_id.as_deref(),
                        selected_station_id: selected_station_id.as_deref(),
                        requested_set_side: &suggested_side,
                        idx,
                        last_current: last_current.clone(),
                        repetition_kind: &repetition_kind,
                    },
                )
                .await?
            } else {
                last_current.clone()
            };

        let profile_loads = match selected_station_id.as_deref() {
            Some(station_id) => {
                suggestions::fetch_station_profile_loads_for_user(repository, station_id, user_id)
                    .await?
            }
            None => Vec::new(),
        };
        let clamped_profile_loads =
            workout_suggestion_logic::clamp_profile_loads_to_max(&profile_loads, max_load_kg);
        let load_input_mode = row.get::<Option<String>, _>("load_input_mode");
        let selected_training_plan_exercise_variant_id: Option<String> =
            row.get("selected_training_plan_exercise_variant_id");
        let has_no_load_option_selection =
            selected_station_id.is_none() && selected_training_plan_exercise_variant_id.is_some();
        let no_load_prior_repetition_value = if has_no_load_option_selection {
            fetch_latest_no_load_prior_set_repetition_value(
                repository,
                user_id,
                workout_id,
                &exercise_id,
                selected_variant_id.as_deref(),
                idx,
                &repetition_kind,
            )
            .await?
        } else {
            None
        };
        let rep_min = row.get("rep_min");
        let rep_max = row.get("rep_max");
        let weighted_progression_history =
            if workout_suggestion_logic::can_use_weighted_reps_progression(
                &repetition_kind,
                enough_data_for_reps_progression,
                rep_min,
                rep_max,
            ) {
                fetch_reps_progression_history(
                    repository,
                    user_id,
                    workout_id,
                    &exercise_id,
                    selected_variant_id.as_deref(),
                    selected_station_id.as_deref(),
                    &suggested_side,
                    idx,
                )
                .await?
            } else {
                Vec::new()
            };
        let suggested_set = workout_suggestion_logic::build_suggested_set(SuggestedSetInput {
            repetition_kind: &repetition_kind,
            selected_station_id: selected_station_id.as_deref(),
            load_input_mode: load_input_mode.as_deref(),
            profile_loads: &clamped_profile_loads,
            from_rules,
            no_load_option_selection: has_no_load_option_selection,
            no_load_prior_repetition_value,
            enough_data_for_load_progression,
            enough_data_for_reps_progression,
            rep_min,
            rep_max,
            weighted_progression_history: &weighted_progression_history,
            set_index: idx,
            set_side: &suggested_side,
        });

        workout.exercises.push(ActiveWorkoutExercise {
            training_plan_exercise_id: row.get("training_plan_exercise_id"),
            position,
            exercise_name: row.get("exercise_name"),
            selected_training_plan_exercise_variant_id,
            selected_variant_id,
            selected_variant_name: row.get("selected_variant_name"),
            repetition_kind: Some(repetition_kind),
            load_input_mode,
            set_tracking_mode,
            selected_station_id,
            selected_station_name: row.get("selected_station_name"),
            skipped_at: row.get("skipped_at"),
            completed_at: row.get("completed_at"),
            completed_sets,
            suggested_set,
            next_set: crate::domain::ActiveWorkoutNextSetHint {
                set_index: idx,
                set_side: suggested_side,
            },
        });
    }

    Ok(Some(workout))
}

async fn merge_active_workout_progress(
    repository: &DomainRepository,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let mut tx = logging::begin_transaction(
        &repository.pool,
        "merge_active_workout_progress",
        "active_workout",
    )
    .await?;

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

    let Some(training_plan_version_row) = maybe_training_plan_version_row else {
        logging::rollback_transaction(tx, "merge_active_workout_progress", "active_workout").await;
        return Err(PersistenceError::NotFound(
            "Active workout not found".to_owned(),
        ));
    };
    let training_plan_version_id =
        training_plan_version_row.get::<String, _>("training_plan_version_id");

    let existing_exercise_rows = sqlx::query(
        "SELECT
            id::text AS id,
            training_plan_exercise_id::text AS training_plan_exercise_id,
            position,
            completed_at::text AS completed_at
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut existing_workout_exercise_id_by_key: HashMap<(String, i32), String> = HashMap::new();
    let mut existing_completed_at_by_exercise: HashMap<(String, i32), String> = HashMap::new();
    for row in existing_exercise_rows {
        let key = (
            row.get::<String, _>("training_plan_exercise_id"),
            row.get::<i32, _>("position"),
        );
        existing_workout_exercise_id_by_key.insert(key.clone(), row.get::<String, _>("id"));

        if let Some(completed_at) = row.get::<Option<String>, _>("completed_at") {
            existing_completed_at_by_exercise.insert(key, completed_at);
        }
    }

    let existing_set_rows = sqlx::query(
        "SELECT
            we.training_plan_exercise_id::text AS training_plan_exercise_id,
            we.position AS exercise_position,
            ws.set_index,
            ws.set_side,
            ws.completed_at::text AS completed_at
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         WHERE we.workout_id = $1::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut existing_completed_at_by_set: HashMap<(String, i32, i32, String), String> =
        HashMap::new();
    for row in existing_set_rows {
        if let Some(completed_at) = row.get::<Option<String>, _>("completed_at") {
            existing_completed_at_by_set.insert(
                (
                    row.get::<String, _>("training_plan_exercise_id"),
                    row.get::<i32, _>("exercise_position"),
                    row.get::<i32, _>("set_index"),
                    row.get::<String, _>("set_side"),
                ),
                completed_at,
            );
        }
    }

    let mut normalized_workout = new_workout.clone();
    let normalized_current_exercise_position = normalized_workout.current_exercise_position;

    for exercise in &mut normalized_workout.exercises {
        let should_clear_completion_on_active_reopen =
            should_clear_exercise_completion_on_active_reopen(
                normalized_current_exercise_position,
                normalized_workout.completed_at.as_deref(),
                exercise,
            );

        if exercise.completed_at.is_none() && !should_clear_completion_on_active_reopen {
            if let Some(completed_at) = existing_completed_at_by_exercise.get(&(
                exercise.training_plan_exercise_id.clone(),
                exercise.position,
            )) {
                exercise.completed_at = Some(completed_at.clone());
            } else if should_complete_exercise_on_workout_finish(
                normalized_current_exercise_position,
                normalized_workout.completed_at.as_deref(),
                exercise,
            ) {
                exercise.completed_at = normalized_workout.completed_at.clone();
            }
        }

        for set in &mut exercise.sets {
            if set.completed_at.is_none() {
                if let Some(completed_at) = existing_completed_at_by_set.get(&(
                    exercise.training_plan_exercise_id.clone(),
                    exercise.position,
                    set.set_index,
                    set.set_side.clone(),
                )) {
                    set.completed_at = Some(completed_at.clone());
                }
            }
        }
    }

    let update_result = sqlx::query(
        "UPDATE workouts
         SET training_plan_version_id = $2::uuid,
             gym_id = $3::uuid,
             started_at = $4::timestamptz,
             completed_at = $5::timestamptz,
             current_exercise_position = $6
         WHERE id = $1::uuid
            AND completed_at IS NULL
            AND user_id = $7::uuid",
    )
    .bind(workout_id)
    .bind(training_plan_version_id)
    .bind(normalized_workout.gym_id.as_deref())
    .bind(normalized_workout.started_at.as_deref())
    .bind(normalized_workout.completed_at.as_deref())
    .bind(normalized_current_exercise_position)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    if update_result.rows_affected() == 0 {
        logging::rollback_transaction(tx, "merge_active_workout_progress", "active_workout").await;
        return Err(PersistenceError::NotFound(
            "Active workout not found".to_owned(),
        ));
    }

    let selected_variant_ids: Vec<Uuid> = normalized_workout
        .exercises
        .iter()
        .filter_map(|exercise| {
            exercise
                .selected_variant_id
                .as_deref()
                .and_then(|id| id.parse().ok())
        })
        .collect();

    let repetition_kind_by_variant_id: HashMap<Uuid, String> = if selected_variant_ids.is_empty() {
        HashMap::new()
    } else {
        let rows = sqlx::query(
            "SELECT id, repetition_kind
             FROM exercise_variants
             WHERE id = ANY($1::uuid[])",
        )
        .bind(&selected_variant_ids)
        .fetch_all(&mut *tx)
        .await?;

        rows.into_iter()
            .map(|row| {
                (
                    row.get::<Uuid, _>("id"),
                    row.get::<String, _>("repetition_kind"),
                )
            })
            .collect()
    };

    let write_completion_scores = normalized_workout.completed_at.is_some();

    for exercise in &normalized_workout.exercises {
        let key = (
            exercise.training_plan_exercise_id.clone(),
            exercise.position,
        );
        let selected_variant_uuid: Option<Uuid> = exercise
            .selected_variant_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_station_uuid: Option<Uuid> = exercise
            .selected_station_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_plan_option_uuid: Option<Uuid> = exercise
            .selected_training_plan_exercise_variant_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_repetition_kind = selected_variant_uuid
            .as_ref()
            .and_then(|variant_id| repetition_kind_by_variant_id.get(variant_id))
            .map(|kind| normalize_repetition_kind(Some(kind.as_str())))
            .unwrap_or(crate::domain::REPETITION_KIND_REPS);
        let completion_transition_marks_exercise_completed = exercise.completed_at.is_some()
            || (exercise.skipped_at.is_none() && !exercise.sets.is_empty());
        let performance_score =
            if write_completion_scores && completion_transition_marks_exercise_completed {
                workout_metrics::compute_performance_score(&exercise.sets, selected_repetition_kind)
            } else {
                None
            };
        let should_complete_on_transition = exercise.completed_at.is_none()
            && should_complete_exercise_on_transition(
                normalized_current_exercise_position,
                normalized_workout.completed_at.as_deref(),
                exercise,
            );
        let should_clear_completion_on_active_reopen =
            should_clear_exercise_completion_on_active_reopen(
                normalized_current_exercise_position,
                normalized_workout.completed_at.as_deref(),
                exercise,
            );

        let workout_exercise_id = if let Some(existing_workout_exercise_id) =
            existing_workout_exercise_id_by_key.remove(&key)
        {
            sqlx::query(
                "UPDATE workout_exercises
                 SET training_plan_exercise_id = $2::uuid,
                     position = $3,
                     selected_variant_id = $4::uuid,
                     selected_station_id = $5::uuid,
                     selected_training_plan_exercise_variant_id = $6::uuid,
                     performance_score = $7,
                     skipped_at = $8::timestamptz,
                     completed_at = CASE
                         WHEN $11 THEN NULL
                         WHEN $9::timestamptz IS NOT NULL THEN $9::timestamptz
                         WHEN $10 THEN NOW()
                         ELSE completed_at
                     END
                 WHERE id = $1::uuid
                   AND workout_id = $12::uuid
                   AND user_id = $13::uuid",
            )
            .bind(&existing_workout_exercise_id)
            .bind(&exercise.training_plan_exercise_id)
            .bind(exercise.position)
            .bind(selected_variant_uuid)
            .bind(selected_station_uuid)
            .bind(selected_plan_option_uuid)
            .bind(performance_score)
            .bind(exercise.skipped_at.as_deref())
            .bind(exercise.completed_at.as_deref())
            .bind(should_complete_on_transition)
            .bind(should_clear_completion_on_active_reopen)
            .bind(workout_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

            existing_workout_exercise_id
        } else {
            sqlx::query(
                "INSERT INTO workout_exercises (
                    workout_id,
                    training_plan_exercise_id,
                    position,
                    selected_variant_id,
                    selected_station_id,
                    selected_training_plan_exercise_variant_id,
                    performance_score,
                    skipped_at,
                    completed_at,
                    user_id
                 )
                 VALUES (
                    $1::uuid,
                    $2::uuid,
                    $3,
                    $4::uuid,
                    $5::uuid,
                    $6::uuid,
                    $7,
                    $8::timestamptz,
                    COALESCE($9::timestamptz, CASE WHEN $10 THEN NOW() ELSE NULL END),
                    $11::uuid
                 )
                 RETURNING id::text AS id",
            )
            .bind(workout_id)
            .bind(&exercise.training_plan_exercise_id)
            .bind(exercise.position)
            .bind(selected_variant_uuid)
            .bind(selected_station_uuid)
            .bind(selected_plan_option_uuid)
            .bind(performance_score)
            .bind(exercise.skipped_at.as_deref())
            .bind(exercise.completed_at.as_deref())
            .bind(should_complete_on_transition)
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await?
            .get::<String, _>("id")
        };

        let existing_set_rows = sqlx::query(
            "SELECT
                id::text AS id,
                set_index,
                set_side
             FROM workout_sets
             WHERE workout_exercise_id = $1::uuid
               AND user_id = $2::uuid",
        )
        .bind(&workout_exercise_id)
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        let mut existing_set_id_by_key: HashMap<(i32, String), String> = HashMap::new();
        for row in existing_set_rows {
            existing_set_id_by_key.insert(
                (
                    row.get::<i32, _>("set_index"),
                    row.get::<String, _>("set_side"),
                ),
                row.get::<String, _>("id"),
            );
        }

        for set in &exercise.sets {
            let set_key = (set.set_index, set.set_side.clone());
            if let Some(existing_set_id) = existing_set_id_by_key.remove(&set_key) {
                sqlx::query(
                    "UPDATE workout_sets
                     SET repetition_value = $2,
                         load_display_value = $3,
                         load_display_unit = $4,
                         load_canonical_kg = $5,
                         completed_at = COALESCE($6::timestamptz, completed_at, NOW())
                     WHERE id = $1::uuid
                       AND user_id = $7::uuid",
                )
                .bind(&existing_set_id)
                .bind(set.repetition_value)
                .bind(set.load_display_value)
                .bind(&set.load_display_unit)
                .bind(set.load_canonical_kg)
                .bind(set.completed_at.as_deref())
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
            } else {
                sqlx::query(
                    "INSERT INTO workout_sets (
                        workout_exercise_id,
                        set_index,
                        set_side,
                        repetition_value,
                        load_display_value,
                        load_display_unit,
                        load_canonical_kg,
                        completed_at,
                        user_id
                     )
                     VALUES (
                        $1::uuid,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        COALESCE($8::timestamptz, NOW()),
                        $9::uuid
                     )",
                )
                .bind(&workout_exercise_id)
                .bind(set.set_index)
                .bind(&set.set_side)
                .bind(set.repetition_value)
                .bind(set.load_display_value)
                .bind(&set.load_display_unit)
                .bind(set.load_canonical_kg)
                .bind(set.completed_at.as_deref())
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
            }
        }

        for stale_set_id in existing_set_id_by_key.into_values() {
            sqlx::query(
                "DELETE FROM workout_sets
                 WHERE id = $1::uuid
                   AND user_id = $2::uuid",
            )
            .bind(stale_set_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    logging::commit_transaction(tx, "merge_active_workout_progress", "active_workout").await?;
    Ok(())
}
