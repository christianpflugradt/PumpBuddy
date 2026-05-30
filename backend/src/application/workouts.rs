use super::logging;
use crate::{
    domain::{
        ActiveWorkout, ActiveWorkoutExercise, CompletedActiveWorkoutSet, NewWorkout,
        NewWorkoutExercise, NewWorkoutSet, WorkoutDetail, WorkoutExercisesPerformanceGroup,
        WorkoutHistorySummary, WorkoutProgressEntry, WorkoutSummary,
    },
    persistence::{
        PersistenceError, StationLoadRepository, TrainingPlanRepository, WorkoutRepository,
    },
    workout_suggestion_logic::snap_to_profile_load,
};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingExerciseRealizability {
    pub training_plan_exercise_id: String,
    pub exercise_name: String,
    pub exercise_position: i32,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ActiveWorkoutSetDraft {
    pub load_value: Option<f64>,
    pub repetition_value: Option<i32>,
}

#[derive(Debug)]
pub enum WorkoutValidationError {
    Validation(String),
    NotFound(String),
    ConfiguredGymStartBlocked {
        message: String,
        selected_gym_id: String,
        missing_exercises: Vec<MissingExerciseRealizability>,
    },
    Internal,
    Persistence(PersistenceError),
}

pub(crate) async fn fetch_workout_history(
    repository: &(impl WorkoutRepository + ?Sized),
    user_id: &str,
) -> Result<Vec<WorkoutHistorySummary>, WorkoutValidationError> {
    repository
        .fetch_workout_history_for_user(user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn fetch_workout_progress(
    repository: &(impl WorkoutRepository + ?Sized),
    user_id: &str,
) -> Result<Vec<WorkoutProgressEntry>, WorkoutValidationError> {
    repository
        .fetch_workout_progress_for_user(user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn fetch_workout_exercises_performance(
    repository: &(impl WorkoutRepository + ?Sized),
    user_id: &str,
) -> Result<Vec<WorkoutExercisesPerformanceGroup>, WorkoutValidationError> {
    repository
        .fetch_workout_exercises_performance_for_user(user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn fetch_workout_summary(
    repository: &(impl WorkoutRepository + ?Sized),
    workout_id: &str,
    user_id: &str,
) -> Result<WorkoutSummary, WorkoutValidationError> {
    let maybe_summary = repository
        .fetch_workout_summary_for_user(workout_id, user_id)
        .await
        .map_err(|_| WorkoutValidationError::Internal)?;

    maybe_summary.ok_or_else(|| WorkoutValidationError::NotFound("Workout not found".to_owned()))
}

pub(crate) async fn fetch_workout_detail(
    repository: &(impl WorkoutRepository + ?Sized),
    workout_id: &str,
    user_id: &str,
) -> Result<WorkoutDetail, WorkoutValidationError> {
    let maybe_detail = repository
        .fetch_workout_detail_for_user(workout_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    maybe_detail.ok_or_else(|| WorkoutValidationError::NotFound("Workout not found".to_owned()))
}

pub(crate) async fn create_workout(
    repository: &(impl TrainingPlanRepository + WorkoutRepository + ?Sized),
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<WorkoutSummary, WorkoutValidationError> {
    validate_exercises_match_training_plan(repository, new_workout, user_id).await?;

    let created = repository
        .create_workout_for_user(new_workout, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    repository
        .fetch_workout_summary_for_user(&created.id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or(WorkoutValidationError::Internal)
}

pub(crate) async fn fetch_active_workout(
    repository: &(impl WorkoutRepository + ?Sized),
    user_id: &str,
) -> Result<ActiveWorkout, WorkoutValidationError> {
    repository
        .fetch_first_active_workout_for_user(user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or_else(|| WorkoutValidationError::NotFound("No active workout found".to_owned()))
}

pub(crate) async fn create_active_workout(
    repository: &(impl TrainingPlanRepository + WorkoutRepository + ?Sized),
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<ActiveWorkout, WorkoutValidationError> {
    validate_active_workout_start(repository, new_workout, total_exercise_count, user_id).await?;

    repository
        .create_active_workout_for_user(new_workout, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn update_active_workout(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + WorkoutRepository + ?Sized),
    workout_id: &str,
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<ActiveWorkout, WorkoutValidationError> {
    validate_fallback_selection_lock(repository, workout_id, user_id, new_workout).await?;
    validate_active_workout(repository, new_workout, total_exercise_count, user_id).await?;

    repository
        .update_active_workout_for_user(workout_id, new_workout, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn confirm_active_workout_set(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + WorkoutRepository + ?Sized),
    workout_id: &str,
    exercise_position: i32,
    draft: ActiveWorkoutSetDraft,
    user_id: &str,
) -> Result<ActiveWorkout, WorkoutValidationError> {
    validate_exercise_position(exercise_position)?;
    validate_set_draft(draft)?;

    let active_workout = fetch_active_workout_for_command(repository, workout_id, user_id).await?;
    let exercise = active_workout_exercise_at_position(&active_workout, exercise_position)?;
    validate_confirmable_exercise(&active_workout, exercise)?;

    let canonical_load = canonical_confirmed_load(
        repository,
        &active_workout,
        exercise,
        draft.load_value,
        user_id,
    )
    .await?;
    let completed_sets = completed_sets_after_confirm(exercise, canonical_load, draft);
    let command_workout =
        active_workout_command_snapshot(&active_workout, exercise_position, completed_sets)?;
    validate_active_workout_command_snapshot(
        repository,
        &command_workout,
        active_workout.total_exercise_count,
        user_id,
    )
    .await?;

    repository
        .update_active_workout_for_user(workout_id, &command_workout, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn delete_latest_active_workout_set(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + WorkoutRepository + ?Sized),
    workout_id: &str,
    exercise_position: i32,
    user_id: &str,
) -> Result<ActiveWorkout, WorkoutValidationError> {
    validate_exercise_position(exercise_position)?;

    let active_workout = fetch_active_workout_for_command(repository, workout_id, user_id).await?;
    let exercise = active_workout_exercise_at_position(&active_workout, exercise_position)?;
    if exercise.completed_sets.is_empty() {
        return Err(WorkoutValidationError::NotFound(
            "Completed active workout set not found".to_owned(),
        ));
    }

    let completed_sets = completed_sets_after_latest_delete(exercise);
    let command_workout =
        active_workout_command_snapshot(&active_workout, exercise_position, completed_sets)?;
    validate_active_workout_command_snapshot(
        repository,
        &command_workout,
        active_workout.total_exercise_count,
        user_id,
    )
    .await?;

    repository
        .update_active_workout_for_user(workout_id, &command_workout, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn complete_active_workout(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + WorkoutRepository + ?Sized),
    workout_id: &str,
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<WorkoutSummary, WorkoutValidationError> {
    validate_fallback_selection_lock(repository, workout_id, user_id, new_workout).await?;
    validate_active_workout(repository, new_workout, total_exercise_count, user_id).await?;

    repository
        .complete_active_workout_for_user(workout_id, new_workout, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

pub(crate) async fn cancel_active_workout(
    repository: &(impl WorkoutRepository + ?Sized),
    workout_id: &str,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    repository
        .cancel_active_workout_for_user(workout_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)
}

fn validate_exercise_position(exercise_position: i32) -> Result<(), WorkoutValidationError> {
    if exercise_position < 1 {
        return Err(WorkoutValidationError::Validation(
            "exercise_position must be at least 1".to_owned(),
        ));
    }

    Ok(())
}

fn validate_set_draft(draft: ActiveWorkoutSetDraft) -> Result<(), WorkoutValidationError> {
    if let Some(load_value) = draft.load_value {
        if !load_value.is_finite() || load_value < 0.0 {
            return Err(WorkoutValidationError::Validation(
                "set.load_value must be a non-negative finite number when provided".to_owned(),
            ));
        }
    }

    if let Some(repetition_value) = draft.repetition_value {
        if repetition_value < 1 {
            return Err(WorkoutValidationError::Validation(
                "set.repetition_value must be greater than 0 when provided".to_owned(),
            ));
        }
    }

    Ok(())
}

async fn fetch_active_workout_for_command(
    repository: &(impl WorkoutRepository + ?Sized),
    workout_id: &str,
    user_id: &str,
) -> Result<ActiveWorkout, WorkoutValidationError> {
    repository
        .fetch_active_workout_for_user(workout_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or_else(|| WorkoutValidationError::NotFound("Active workout not found".to_owned()))
}

fn active_workout_exercise_at_position(
    active_workout: &ActiveWorkout,
    exercise_position: i32,
) -> Result<&ActiveWorkoutExercise, WorkoutValidationError> {
    active_workout
        .exercises
        .iter()
        .find(|exercise| exercise.position == exercise_position)
        .ok_or_else(|| {
            WorkoutValidationError::NotFound("Active workout exercise not found".to_owned())
        })
}

fn validate_confirmable_exercise(
    active_workout: &ActiveWorkout,
    exercise: &ActiveWorkoutExercise,
) -> Result<(), WorkoutValidationError> {
    if derived_configured_gym_id(&active_workout.gym_id).is_some()
        && trimmed(&exercise.selected_training_plan_exercise_variant_id).is_none()
    {
        return Err(WorkoutValidationError::Validation(
            "Configured-gym exercise option must be selected before confirming a set".to_owned(),
        ));
    }

    Ok(())
}

async fn canonical_confirmed_load(
    repository: &(impl StationLoadRepository + ?Sized),
    active_workout: &ActiveWorkout,
    exercise: &ActiveWorkoutExercise,
    draft_load_value: Option<f64>,
    user_id: &str,
) -> Result<Option<f64>, WorkoutValidationError> {
    let no_load_configured_selection = exercise
        .selected_training_plan_exercise_variant_id
        .is_some()
        && exercise.selected_station_id.is_none();
    if no_load_configured_selection {
        return Ok(None);
    }

    let Some(input_load_value) = draft_load_value else {
        return Ok(None);
    };

    let input_mode = exercise.load_input_mode.as_deref().unwrap_or("TOTAL");
    let Some(station_id) = trimmed(&exercise.selected_station_id) else {
        return Ok(Some(match input_mode {
            "PER_SIDE" => input_load_value * 2.0,
            _ => input_load_value,
        }));
    };
    let Some(gym_id) = derived_configured_gym_id(&active_workout.gym_id) else {
        return Ok(Some(match input_mode {
            "PER_SIDE" => input_load_value * 2.0,
            _ => input_load_value,
        }));
    };

    let profile_loads = repository
        .fetch_station_profile_loads_for_user_and_gym(station_id, gym_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;
    if profile_loads.is_empty() {
        return Err(WorkoutValidationError::Validation(
            "selected_station_id must reference a station with load profile values".to_owned(),
        ));
    }

    let snapped = snap_to_profile_load(&profile_loads, input_load_value).ok_or_else(|| {
        WorkoutValidationError::Validation("set.load_value must be a finite number".to_owned())
    })?;

    Ok(Some(match input_mode {
        "PER_SIDE" => snapped * 2.0,
        _ => snapped,
    }))
}

fn completed_sets_after_confirm(
    exercise: &ActiveWorkoutExercise,
    canonical_load: Option<f64>,
    draft: ActiveWorkoutSetDraft,
) -> Vec<CompletedActiveWorkoutSet> {
    let mut completed_sets = exercise.completed_sets.clone();
    completed_sets.push(CompletedActiveWorkoutSet {
        set_index: exercise.next_set.set_index,
        set_side: exercise.next_set.set_side.clone(),
        load_value: canonical_load,
        repetition_value: draft.repetition_value,
    });
    sort_completed_sets(&mut completed_sets);
    completed_sets
}

fn completed_sets_after_latest_delete(
    exercise: &ActiveWorkoutExercise,
) -> Vec<CompletedActiveWorkoutSet> {
    let set_tracking_mode = exercise.set_tracking_mode.as_deref().unwrap_or("BILATERAL");
    if set_tracking_mode == "UNILATERAL" {
        let latest_set_index = exercise
            .completed_sets
            .iter()
            .map(|set| set.set_index)
            .max()
            .unwrap_or_default();
        return exercise
            .completed_sets
            .iter()
            .filter(|set| set.set_index != latest_set_index)
            .cloned()
            .collect();
    }

    let Some(latest) = exercise
        .completed_sets
        .iter()
        .max_by_key(|set| (set.set_index, set_side_sort_rank(&set.set_side)))
    else {
        return Vec::new();
    };
    let latest_key = (latest.set_index, latest.set_side.as_str());
    exercise
        .completed_sets
        .iter()
        .filter(|set| (set.set_index, set.set_side.as_str()) != latest_key)
        .cloned()
        .collect()
}

fn sort_completed_sets(completed_sets: &mut [CompletedActiveWorkoutSet]) {
    completed_sets.sort_by(|left, right| {
        left.set_index.cmp(&right.set_index).then_with(|| {
            set_side_sort_rank(&left.set_side).cmp(&set_side_sort_rank(&right.set_side))
        })
    });
}

fn set_side_sort_rank(side: &str) -> i32 {
    match side {
        "LEFT" => 0,
        "RIGHT" => 1,
        _ => 2,
    }
}

fn active_workout_command_snapshot(
    active_workout: &ActiveWorkout,
    target_exercise_position: i32,
    target_completed_sets: Vec<CompletedActiveWorkoutSet>,
) -> Result<NewWorkout, WorkoutValidationError> {
    let exercise = active_workout_exercise_at_position(active_workout, target_exercise_position)?;

    let command_workout = NewWorkout {
        training_plan_id: active_workout.training_plan_id.clone(),
        gym_id: active_workout.gym_id.clone(),
        started_at: Some(active_workout.started_at.clone()),
        completed_at: None,
        current_exercise_position: Some(target_exercise_position),
        exercises: vec![new_workout_exercise_from_active(
            exercise,
            target_completed_sets,
            true,
        )],
    };
    command_workout
        .validate_mode_invariants()
        .map_err(WorkoutValidationError::Validation)?;
    Ok(command_workout)
}

fn new_workout_exercise_from_active(
    exercise: &ActiveWorkoutExercise,
    completed_sets: Vec<CompletedActiveWorkoutSet>,
    is_target: bool,
) -> NewWorkoutExercise {
    NewWorkoutExercise {
        training_plan_exercise_id: exercise.training_plan_exercise_id.clone(),
        position: exercise.position,
        selected_variant_id: exercise.selected_variant_id.clone(),
        selected_station_id: exercise.selected_station_id.clone(),
        selected_training_plan_exercise_variant_id: exercise
            .selected_training_plan_exercise_variant_id
            .clone(),
        set_tracking_mode: exercise.set_tracking_mode.clone(),
        skipped_at: if is_target {
            None
        } else {
            exercise.skipped_at.clone()
        },
        completed_at: if is_target {
            None
        } else {
            exercise.completed_at.clone()
        },
        sets: completed_sets
            .into_iter()
            .map(new_workout_set_from_completed)
            .collect(),
    }
}

fn new_workout_set_from_completed(set: CompletedActiveWorkoutSet) -> NewWorkoutSet {
    NewWorkoutSet {
        set_index: set.set_index,
        set_side: set.set_side,
        repetition_value: set.repetition_value,
        load_display_value: set.load_value,
        load_display_unit: "kg".to_owned(),
        load_canonical_kg: set.load_value,
        completed_at: None,
    }
}

async fn validate_active_workout_command_snapshot(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + ?Sized),
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    validate_active_workout_base(repository, new_workout, total_exercise_count, user_id).await?;
    validate_selected_variant_context(repository, new_workout, false, user_id).await?;
    validate_configured_gym_profile_loads(repository, new_workout, user_id).await?;
    Ok(())
}

pub(crate) async fn validate_exercises_match_training_plan(
    repository: &(impl TrainingPlanRepository + ?Sized),
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    let valid_exercise_ids = repository
        .fetch_training_plan_exercise_ids_for_user(&new_workout.training_plan_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    if new_workout
        .exercises
        .iter()
        .any(|exercise| !valid_exercise_ids.contains(&exercise.training_plan_exercise_id))
    {
        return Err(WorkoutValidationError::Validation(
            "Each exercise must belong to the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

pub(crate) async fn validate_active_workout(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + ?Sized),
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    validate_active_workout_base(repository, new_workout, total_exercise_count, user_id).await?;
    validate_selected_variant_context(repository, new_workout, false, user_id).await?;
    validate_configured_gym_profile_loads(repository, new_workout, user_id).await?;

    Ok(())
}

async fn validate_active_workout_base(
    repository: &(impl TrainingPlanRepository + ?Sized),
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    validate_exercises_match_training_plan(repository, new_workout, user_id).await?;

    let expected_count = repository
        .fetch_training_plan_exercise_count_for_user(&new_workout.training_plan_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    if expected_count == 0 {
        return Err(WorkoutValidationError::Validation(
            "Selected training plan has no exercises".to_owned(),
        ));
    }

    if expected_count != i64::from(total_exercise_count) {
        return Err(WorkoutValidationError::Validation(
            "total_exercise_count must match the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

pub(crate) async fn validate_active_workout_start(
    repository: &(impl TrainingPlanRepository + ?Sized),
    new_workout: &NewWorkout,
    total_exercise_count: i32,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    validate_active_workout_base(repository, new_workout, total_exercise_count, user_id).await?;
    validate_configured_gym_start_realizability(repository, new_workout, user_id).await?;
    validate_selected_variant_context(repository, new_workout, true, user_id).await?;
    Ok(())
}

pub(crate) async fn validate_fallback_selection_lock(
    repository: &(impl WorkoutRepository + ?Sized),
    workout_id: &str,
    user_id: &str,
    new_workout: &NewWorkout,
) -> Result<(), WorkoutValidationError> {
    let existing_workout = repository
        .fetch_active_workout_for_user(workout_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or_else(|| {
            WorkoutValidationError::Persistence(PersistenceError::NotFound(
                "Active workout not found".to_owned(),
            ))
        })?;

    let exercise_lookup: HashMap<&str, &NewWorkoutExercise> = new_workout
        .exercises
        .iter()
        .map(|exercise| (exercise.training_plan_exercise_id.as_str(), exercise))
        .collect();

    for existing_exercise in existing_workout
        .exercises
        .iter()
        .filter(|exercise| !exercise.completed_sets.is_empty())
    {
        let Some(next_exercise) =
            exercise_lookup.get(existing_exercise.training_plan_exercise_id.as_str())
        else {
            logging::log_business_warning(
                "fallback_selection_change_rejected",
                &[
                    ("workout_id", workout_id.to_owned()),
                    (
                        "training_plan_exercise_id",
                        existing_exercise.training_plan_exercise_id.clone(),
                    ),
                    (
                        "reason",
                        "exercise_missing_in_update_after_completed_set".to_owned(),
                    ),
                ],
            );
            return Err(WorkoutValidationError::Validation(
                "Fallback selection cannot change after first completed set".to_owned(),
            ));
        };

        if has_selection_changed(existing_exercise, next_exercise) {
            logging::log_business_warning(
                "fallback_selection_change_rejected",
                &[
                    ("workout_id", workout_id.to_owned()),
                    (
                        "training_plan_exercise_id",
                        existing_exercise.training_plan_exercise_id.clone(),
                    ),
                    ("reason", "selection_changed_after_completed_set".to_owned()),
                ],
            );
            return Err(WorkoutValidationError::Validation(
                "Fallback selection cannot change after first completed set".to_owned(),
            ));
        }
    }

    Ok(())
}

async fn validate_selected_variant_context(
    repository: &(impl TrainingPlanRepository + ?Sized),
    new_workout: &NewWorkout,
    require_station_for_station_required_variants: bool,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    let Some(gym_id) = derived_configured_gym_id(&new_workout.gym_id) else {
        return Ok(());
    };

    if new_workout.exercises.is_empty() {
        return Ok(());
    }

    let variant_summaries = repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            &new_workout.training_plan_id,
            gym_id,
            user_id,
        )
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    if variant_summaries.is_empty() {
        return Err(WorkoutValidationError::Validation(
            "No selectable exercise options exist for the selected training plan and gym"
                .to_owned(),
        ));
    }

    let mut variant_lookup = std::collections::HashMap::with_capacity(variant_summaries.len());
    for variant_summary in variant_summaries {
        variant_lookup
            .entry((
                variant_summary.training_plan_exercise_id,
                variant_summary.id,
            ))
            .or_insert_with(Vec::new)
            .push((variant_summary.variant_id, variant_summary.station_id));
    }

    for exercise in &new_workout.exercises {
        let Some(training_plan_exercise_variant_id) =
            trimmed(&exercise.selected_training_plan_exercise_variant_id)
        else {
            continue;
        };
        let Some(variant_id) = trimmed(&exercise.selected_variant_id) else {
            continue;
        };

        let key = (
            exercise.training_plan_exercise_id.clone(),
            training_plan_exercise_variant_id.to_owned(),
        );
        let Some(expected_pairs) = variant_lookup.get(&key) else {
            return Err(WorkoutValidationError::Validation(
                "selected_training_plan_exercise_variant_id must belong to the matching training plan exercise"
                    .to_owned(),
            ));
        };

        if !expected_pairs
            .iter()
            .any(|(expected_variant_id, _)| expected_variant_id == variant_id)
        {
            return Err(WorkoutValidationError::Validation(
                "selected_variant_id must match selected_training_plan_exercise_variant_id"
                    .to_owned(),
            ));
        }

        let requires_station =
            expected_pairs
                .iter()
                .any(|(expected_variant_id, expected_station_id)| {
                    expected_variant_id == variant_id && expected_station_id.is_some()
                });

        let Some(station_id) = trimmed(&exercise.selected_station_id) else {
            if require_station_for_station_required_variants && requires_station {
                return Err(WorkoutValidationError::Validation(
                    "selected_station_id is required for station-required selected_training_plan_exercise_variant_id"
                        .to_owned(),
                ));
            }
            continue;
        };

        if !expected_pairs
            .iter()
            .any(|(expected_variant_id, expected_station_id)| {
                expected_variant_id == variant_id
                    && expected_station_id.as_deref() == Some(station_id)
            })
        {
            return Err(WorkoutValidationError::Validation(
                "selected_station_id must match selected_training_plan_exercise_variant_id"
                    .to_owned(),
            ));
        }
    }

    Ok(())
}

async fn validate_configured_gym_start_realizability(
    repository: &(impl TrainingPlanRepository + ?Sized),
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    let Some(gym_id) = derived_configured_gym_id(&new_workout.gym_id) else {
        return Ok(());
    };

    let training_plan = repository
        .fetch_training_plan_detail_for_user(&new_workout.training_plan_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or_else(|| {
            WorkoutValidationError::Validation("Selected training plan was not found".to_owned())
        })?;

    let variant_summaries = repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            &new_workout.training_plan_id,
            gym_id,
            user_id,
        )
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    let realizable_exercise_ids: HashSet<String> = variant_summaries
        .into_iter()
        .map(|variant_summary| variant_summary.training_plan_exercise_id)
        .collect();

    let mut missing_exercises: Vec<MissingExerciseRealizability> = training_plan
        .exercises
        .into_iter()
        .filter(|exercise| !realizable_exercise_ids.contains(&exercise.id))
        .map(|exercise| MissingExerciseRealizability {
            training_plan_exercise_id: exercise.id,
            exercise_name: exercise.exercise_name,
            exercise_position: exercise.position,
            reason: "no_realizable_option_in_selected_gym".to_owned(),
        })
        .collect();
    missing_exercises.sort_by(|left, right| {
        left.exercise_position
            .cmp(&right.exercise_position)
            .then_with(|| {
                left.training_plan_exercise_id
                    .cmp(&right.training_plan_exercise_id)
            })
    });

    if missing_exercises.is_empty() {
        return Ok(());
    }

    logging::log_business_warning(
        "configured_gym_start_blocked",
        &[
            ("training_plan_id", new_workout.training_plan_id.clone()),
            ("selected_gym_id", gym_id.to_owned()),
            (
                "missing_exercise_count",
                missing_exercises.len().to_string(),
            ),
        ],
    );

    Err(WorkoutValidationError::ConfiguredGymStartBlocked {
        message: "Configured-gym workout start requires realizable options for every plan exercise"
            .to_owned(),
        selected_gym_id: gym_id.to_owned(),
        missing_exercises,
    })
}

async fn validate_configured_gym_profile_loads(
    repository: &(impl TrainingPlanRepository + StationLoadRepository + ?Sized),
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), WorkoutValidationError> {
    let Some(gym_id) = derived_configured_gym_id(&new_workout.gym_id) else {
        return Ok(());
    };

    let variant_summaries = repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            &new_workout.training_plan_id,
            gym_id,
            user_id,
        )
        .await
        .map_err(WorkoutValidationError::Persistence)?;
    let variant_mode_by_id: HashMap<String, String> = variant_summaries
        .into_iter()
        .map(|variant_summary| (variant_summary.variant_id, variant_summary.load_input_mode))
        .collect();

    let mut profile_loads_by_station = HashMap::new();

    for exercise in &new_workout.exercises {
        if exercise.sets.is_empty() {
            continue;
        }

        let Some(station_id) = trimmed(&exercise.selected_station_id) else {
            continue;
        };

        if !profile_loads_by_station.contains_key(station_id) {
            let fetched = repository
                .fetch_station_profile_loads_for_user_and_gym(station_id, gym_id, user_id)
                .await
                .map_err(WorkoutValidationError::Persistence)?;
            profile_loads_by_station.insert(station_id.to_owned(), fetched);
        }
        let profile_loads = &profile_loads_by_station[station_id];

        if profile_loads.is_empty() {
            logging::log_business_warning(
                "configured_gym_load_profile_mismatch",
                &[
                    ("training_plan_id", new_workout.training_plan_id.clone()),
                    ("selected_gym_id", gym_id.to_owned()),
                    ("selected_station_id", station_id.to_owned()),
                    ("exercise_position", exercise.position.to_string()),
                    ("reason", "station_profile_empty".to_owned()),
                ],
            );
            return Err(WorkoutValidationError::Validation(
                "selected_station_id must reference a station with load profile values".to_owned(),
            ));
        }

        for set in &exercise.sets {
            let Some(load_canonical_kg) = set.load_canonical_kg else {
                logging::log_business_warning(
                    "configured_gym_load_profile_mismatch",
                    &[
                        ("training_plan_id", new_workout.training_plan_id.clone()),
                        ("selected_gym_id", gym_id.to_owned()),
                        ("selected_station_id", station_id.to_owned()),
                        ("exercise_position", exercise.position.to_string()),
                        ("set_index", set.set_index.to_string()),
                        ("reason", "load_value_missing".to_owned()),
                    ],
                );
                return Err(WorkoutValidationError::Validation(
                    "set.load_value must be provided when selected_station_id is set in configured-gym mode"
                        .to_owned(),
                ));
            };

            let is_per_side = exercise
                .selected_variant_id
                .as_deref()
                .and_then(|variant_id| variant_mode_by_id.get(variant_id))
                .is_some_and(|mode| mode == "PER_SIDE");
            let profile_candidate = match is_per_side {
                true => load_canonical_kg / 2.0,
                false => load_canonical_kg,
            };

            let snapped =
                snap_to_profile_load(profile_loads, profile_candidate).ok_or_else(|| {
                    logging::log_business_warning(
                        "configured_gym_load_profile_mismatch",
                        &[
                            ("training_plan_id", new_workout.training_plan_id.clone()),
                            ("selected_gym_id", gym_id.to_owned()),
                            ("selected_station_id", station_id.to_owned()),
                            ("exercise_position", exercise.position.to_string()),
                            ("set_index", set.set_index.to_string()),
                            ("reason", "load_value_not_finite".to_owned()),
                        ],
                    );
                    WorkoutValidationError::Validation(
                        "set.load_value must be a finite number".to_owned(),
                    )
                })?;

            if (snapped - profile_candidate).abs() > 1e-9 {
                logging::log_business_warning(
                    "configured_gym_load_profile_mismatch",
                    &[
                        ("training_plan_id", new_workout.training_plan_id.clone()),
                        ("selected_gym_id", gym_id.to_owned()),
                        ("selected_station_id", station_id.to_owned()),
                        ("exercise_position", exercise.position.to_string()),
                        ("set_index", set.set_index.to_string()),
                        ("reason", "load_not_in_station_profile".to_owned()),
                    ],
                );
                return Err(WorkoutValidationError::Validation(
                    "set.load_value must match selected station load profile values in configured-gym mode"
                        .to_owned(),
                ));
            }
        }
    }

    Ok(())
}

fn derived_configured_gym_id(gym_id: &Option<String>) -> Option<&str> {
    // Workout mode is derived from gym_id: no value means free mode.
    gym_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn trimmed(value: &Option<String>) -> Option<&str> {
    let candidate = value.as_deref()?.trim();
    if candidate.is_empty() {
        None
    } else {
        Some(candidate)
    }
}

fn trimmed_str(value: &Option<String>) -> Option<&str> {
    let candidate = value.as_deref()?.trim();
    if candidate.is_empty() {
        None
    } else {
        Some(candidate)
    }
}

fn has_selection_changed(existing: &ActiveWorkoutExercise, next: &NewWorkoutExercise) -> bool {
    trimmed_str(&existing.selected_training_plan_exercise_variant_id)
        != trimmed_str(&next.selected_training_plan_exercise_variant_id)
        || trimmed_str(&existing.selected_variant_id) != trimmed_str(&next.selected_variant_id)
        || trimmed_str(&existing.selected_station_id) != trimmed_str(&next.selected_station_id)
}

#[cfg(test)]
mod tests {
    use super::{
        completed_sets_after_confirm, completed_sets_after_latest_delete, validate_active_workout,
        validate_active_workout_start, validate_configured_gym_profile_loads,
        validate_exercises_match_training_plan, validate_fallback_selection_lock,
        ActiveWorkoutSetDraft, WorkoutValidationError,
    };
    use crate::{
        domain::{
            ActiveWorkoutExercise, ActiveWorkoutNextSetHint, ActiveWorkoutSet,
            CompletedActiveWorkoutSet, NewWorkout, NewWorkoutExercise, NewWorkoutSet,
        },
        persistence::{new_repository, PersistenceError},
        test_support::{
            connect_with_retry, reset_test_database, resolve_test_database_url, test_db_lock,
        },
    };
    use sqlx::PgPool;

    const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";
    const USER_B_ID: &str = "00000000-0000-0000-0000-000000000012";
    const USER_B_EXERCISE_ID: &str = "10000000-0000-0000-0000-000000009901";
    const USER_B_VARIANT_ID: &str = "20000000-0000-0000-0000-000000009901";
    const USER_B_TRAINING_PLAN_ID: &str = "30000000-0000-0000-0000-000000009901";
    const USER_B_TRAINING_PLAN_VERSION_ID: &str = "31000000-0000-0000-0000-000000009901";
    const USER_B_TRAINING_PLAN_EXERCISE_ID: &str = "32000000-0000-0000-0000-000000009901";
    const USER_B_TRAINING_PLAN_EXERCISE_VARIANT_ID: &str = "33000000-0000-0000-0000-000000009901";

    async fn require_pool() -> PgPool {
        let database_url = resolve_test_database_url().await;
        let pool = connect_with_retry(&database_url).await;

        reset_test_database(&pool).await;
        pool
    }

    async fn insert_user_b_training_plan_option_fixture(pool: &PgPool) {
        sqlx::query(
            "INSERT INTO exercises (id, user_id, name)
             VALUES ($1::uuid, $2::uuid, $3)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(USER_B_EXERCISE_ID)
        .bind(USER_B_ID)
        .bind("User B Application Exercise")
        .execute(pool)
        .await
        .expect("foreign exercise insert should succeed");

        sqlx::query(
            "INSERT INTO exercise_variants (
                 id,
                 exercise_id,
                 name,
                 variant_type,
                 requires_station,
                 load_input_mode,
                 set_tracking_mode,
                 repetition_kind,
                 user_id
             )
             VALUES ($1::uuid, $2::uuid, $3, $4, FALSE, 'TOTAL', 'BILATERAL', 'REPS', $5::uuid)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(USER_B_VARIANT_ID)
        .bind(USER_B_EXERCISE_ID)
        .bind("User B Application Variant")
        .bind("bodyweight")
        .bind(USER_B_ID)
        .execute(pool)
        .await
        .expect("foreign variant insert should succeed");

        sqlx::query(
            "INSERT INTO training_plans (id, user_id, name)
             VALUES ($1::uuid, $2::uuid, $3)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(USER_B_TRAINING_PLAN_ID)
        .bind(USER_B_ID)
        .bind("Foreign User Plan")
        .execute(pool)
        .await
        .expect("foreign training plan insert should succeed");

        sqlx::query(
            "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
             VALUES ($1::uuid, $2::uuid, $3, $4::uuid)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(USER_B_TRAINING_PLAN_VERSION_ID)
        .bind(USER_B_TRAINING_PLAN_ID)
        .bind(1_i32)
        .bind(USER_B_ID)
        .execute(pool)
        .await
        .expect("foreign training plan version insert should succeed");

        sqlx::query(
            "INSERT INTO training_plan_exercises (
                id,
                training_plan_version_id,
                exercise_id,
                user_id,
                position
             )
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(USER_B_TRAINING_PLAN_EXERCISE_ID)
        .bind(USER_B_TRAINING_PLAN_VERSION_ID)
        .bind(USER_B_EXERCISE_ID)
        .bind(USER_B_ID)
        .bind(1_i32)
        .execute(pool)
        .await
        .expect("foreign training plan exercise insert should succeed");

        sqlx::query(
            "INSERT INTO training_plan_exercise_variants (
                id,
                training_plan_exercise_id,
                exercise_variant_id,
                selection_order,
                user_id
             )
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind(USER_B_TRAINING_PLAN_EXERCISE_VARIANT_ID)
        .bind(USER_B_TRAINING_PLAN_EXERCISE_ID)
        .bind(USER_B_VARIANT_ID)
        .bind(1_i32)
        .bind(USER_B_ID)
        .execute(pool)
        .await
        .expect("foreign training plan option insert should succeed");
    }

    fn sample_workout() -> NewWorkout {
        NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-10T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000001".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
                    completed_at: None,
                }],
            }],
        }
    }

    fn workout_with_multi_option_exercise() -> NewWorkout {
        NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-10T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000006".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000005".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000009".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000006".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        }
    }

    fn active_workout_exercise_with_sets(
        set_tracking_mode: &str,
        completed_sets: Vec<CompletedActiveWorkoutSet>,
        next_set_index: i32,
        next_set_side: &str,
    ) -> ActiveWorkoutExercise {
        ActiveWorkoutExercise {
            training_plan_exercise_id: "32000000-0000-0000-0000-000000000001".to_owned(),
            position: 1,
            exercise_name: "Split Squat".to_owned(),
            selected_training_plan_exercise_variant_id: None,
            selected_variant_id: None,
            selected_variant_name: None,
            repetition_kind: Some("REPS".to_owned()),
            load_input_mode: Some("TOTAL".to_owned()),
            set_tracking_mode: Some(set_tracking_mode.to_owned()),
            selected_station_id: None,
            selected_station_name: None,
            skipped_at: None,
            completed_at: None,
            completed_sets,
            suggested_set: ActiveWorkoutSet {
                set_index: next_set_index,
                set_side: next_set_side.to_owned(),
                load_value: 0.0,
                repetition_value: Some(0),
            },
            next_set: ActiveWorkoutNextSetHint {
                set_index: next_set_index,
                set_side: next_set_side.to_owned(),
            },
        }
    }

    fn completed_set(set_index: i32, set_side: &str) -> CompletedActiveWorkoutSet {
        CompletedActiveWorkoutSet {
            set_index,
            set_side: set_side.to_owned(),
            load_value: Some(20.0),
            repetition_value: Some(10),
        }
    }

    #[test]
    fn confirm_active_workout_set_uses_backend_next_set_hint() {
        let exercise = active_workout_exercise_with_sets(
            "UNILATERAL",
            vec![
                completed_set(1, "LEFT"),
                completed_set(1, "RIGHT"),
                completed_set(2, "LEFT"),
            ],
            2,
            "RIGHT",
        );

        let completed_sets = completed_sets_after_confirm(
            &exercise,
            Some(22.5),
            ActiveWorkoutSetDraft {
                load_value: Some(21.0),
                repetition_value: Some(9),
            },
        );

        assert_eq!(
            completed_sets
                .iter()
                .map(|set| (set.set_index, set.set_side.as_str()))
                .collect::<Vec<_>>(),
            vec![(1, "LEFT"), (1, "RIGHT"), (2, "LEFT"), (2, "RIGHT")]
        );
        assert_eq!(completed_sets[3].load_value, Some(22.5));
        assert_eq!(completed_sets[3].repetition_value, Some(9));
    }

    #[test]
    fn delete_latest_active_workout_set_removes_latest_unilateral_index() {
        let exercise = active_workout_exercise_with_sets(
            "UNILATERAL",
            vec![
                completed_set(1, "LEFT"),
                completed_set(1, "RIGHT"),
                completed_set(2, "LEFT"),
                completed_set(2, "RIGHT"),
            ],
            3,
            "LEFT",
        );

        let completed_sets = completed_sets_after_latest_delete(&exercise);

        assert_eq!(
            completed_sets
                .iter()
                .map(|set| (set.set_index, set.set_side.as_str()))
                .collect::<Vec<_>>(),
            vec![(1, "LEFT"), (1, "RIGHT")]
        );
    }

    #[tokio::test]
    async fn validate_exercises_match_training_plan_checks_membership_against_repository() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let valid_workout = sample_workout();

        validate_exercises_match_training_plan(&repository, &valid_workout, DEV_USER_ID)
            .await
            .expect("matching exercises should validate");

        let mut invalid_workout = valid_workout;
        invalid_workout.exercises[0].training_plan_exercise_id =
            "32000000-0000-0000-0000-00000000000d".to_owned();

        match validate_exercises_match_training_plan(&repository, &invalid_workout, DEV_USER_ID)
            .await
            .expect_err("exercise from another plan should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "Each exercise must belong to the selected training plan"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn validate_exercises_match_training_plan_ignores_foreign_user_training_plan_rows() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        insert_user_b_training_plan_option_fixture(&pool).await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.training_plan_id = USER_B_TRAINING_PLAN_ID.to_owned();
        workout.exercises[0].training_plan_exercise_id =
            USER_B_TRAINING_PLAN_EXERCISE_ID.to_owned();

        match validate_exercises_match_training_plan(&repository, &workout, DEV_USER_ID)
            .await
            .expect_err("foreign user plan rows must not be visible during validation")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "Each exercise must belong to the selected training plan"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn validate_active_workout_rejects_training_plans_without_exercises() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool.clone());
        sqlx::query(
            "INSERT INTO training_plans (id, name)
             VALUES ($1::uuid, $2)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind("00000000-0000-0000-0000-000000009999")
        .bind("Empty Plan")
        .execute(&pool)
        .await
        .expect("empty training plan should insert");

        let mut workout = sample_workout();
        workout.training_plan_id = "00000000-0000-0000-0000-000000009999".to_owned();
        workout.exercises.clear();

        match validate_active_workout(&repository, &workout, 1, DEV_USER_ID)
            .await
            .expect_err("plans without exercises should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(message, "Selected training plan has no exercises");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn validate_active_workout_rejects_total_count_mismatch() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let workout = sample_workout();

        match validate_active_workout(&repository, &workout, 4, DEV_USER_ID)
            .await
            .expect_err("mismatched counts should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "total_exercise_count must match the selected training plan"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_variant_mismatch_for_option() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000002".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000001".to_owned());

        match validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("mismatched option context should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_variant_id must match selected_training_plan_exercise_variant_id"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_option_for_other_exercise() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000003".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000003".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000003".to_owned());

        match validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("option from another exercise should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_training_plan_exercise_variant_id must belong to the matching training plan exercise"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_station_mismatch_for_option() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000003".to_owned());

        match validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("station mismatch should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_station_id must match selected_training_plan_exercise_variant_id"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_when_no_options_exist_for_gym() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        sqlx::query(
            "INSERT INTO gyms (id, name)
             VALUES ($1::uuid, $2)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind("00000000-0000-0000-0000-000000009001")
        .bind("No Options Gym")
        .execute(&pool)
        .await
        .expect("gym insert should succeed");

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.gym_id = Some("00000000-0000-0000-0000-000000009001".to_owned());

        match validate_active_workout_start(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("gym without options should fail")
        {
            WorkoutValidationError::ConfiguredGymStartBlocked {
                message,
                selected_gym_id,
                missing_exercises,
            } => {
                assert_eq!(
                    message,
                    "Configured-gym workout start requires realizable options for every plan exercise"
                );
                assert_eq!(selected_gym_id, "00000000-0000-0000-0000-000000009001");
                assert_eq!(missing_exercises.len(), 4);
                assert!(missing_exercises
                    .iter()
                    .all(|exercise| exercise.reason == "no_realizable_option_in_selected_gym"));
                assert!(missing_exercises.windows(2).all(|window| {
                    let left = &window[0];
                    let right = &window[1];
                    (left.exercise_position, &left.training_plan_exercise_id)
                        <= (right.exercise_position, &right.training_plan_exercise_id)
                }));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_start_rejects_when_any_plan_exercise_is_unrealizable_in_selected_gym() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        sqlx::query(
            "DELETE FROM workout_exercises
             WHERE selected_training_plan_exercise_variant_id IN (
                 SELECT id
                 FROM training_plan_exercise_variants
                 WHERE training_plan_exercise_id = $1::uuid
             )",
        )
        .bind("32000000-0000-0000-0000-000000000005")
        .execute(&pool)
        .await
        .expect("dependent workout exercise delete should succeed");

        sqlx::query(
            "DELETE FROM training_plan_exercise_variants
             WHERE training_plan_exercise_id = $1::uuid",
        )
        .bind("32000000-0000-0000-0000-000000000005")
        .execute(&pool)
        .await
        .expect("option delete should succeed");

        let repository = new_repository(pool);
        let workout = sample_workout();

        match validate_active_workout_start(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("single unrealizable exercise should block configured-gym start")
        {
            WorkoutValidationError::ConfiguredGymStartBlocked {
                message,
                selected_gym_id,
                missing_exercises,
            } => {
                assert_eq!(
                    message,
                    "Configured-gym workout start requires realizable options for every plan exercise"
                );
                assert_eq!(selected_gym_id, "50000000-0000-0000-0000-000000000001");
                assert!(missing_exercises.iter().any(|exercise| {
                    exercise.training_plan_exercise_id == "32000000-0000-0000-0000-000000000005"
                        && exercise.reason == "no_realizable_option_in_selected_gym"
                }));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_start_ignores_foreign_user_options_for_realizability() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        sqlx::query(
            "DELETE FROM workout_exercises
             WHERE selected_training_plan_exercise_variant_id IN (
                 SELECT id
                 FROM training_plan_exercise_variants
                 WHERE training_plan_exercise_id = $1::uuid
                   AND user_id = $2::uuid
             )",
        )
        .bind("32000000-0000-0000-0000-000000000005")
        .bind(DEV_USER_ID)
        .execute(&pool)
        .await
        .expect("dependent workout exercise delete should succeed");

        sqlx::query(
            "DELETE FROM training_plan_exercise_variants
             WHERE training_plan_exercise_id = $1::uuid
               AND user_id = $2::uuid",
        )
        .bind("32000000-0000-0000-0000-000000000005")
        .bind(DEV_USER_ID)
        .execute(&pool)
        .await
        .expect("dev option delete should succeed");

        insert_user_b_training_plan_option_fixture(&pool).await;

        let repository = new_repository(pool);
        let workout = sample_workout();

        match validate_active_workout_start(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("foreign user options must not satisfy realizability")
        {
            WorkoutValidationError::ConfiguredGymStartBlocked {
                message,
                selected_gym_id,
                missing_exercises,
            } => {
                assert_eq!(
                    message,
                    "Configured-gym workout start requires realizable options for every plan exercise"
                );
                assert_eq!(selected_gym_id, "50000000-0000-0000-0000-000000000001");
                assert!(missing_exercises.iter().any(|exercise| {
                    exercise.training_plan_exercise_id == "32000000-0000-0000-0000-000000000005"
                        && exercise.reason == "no_realizable_option_in_selected_gym"
                }));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn validate_active_workout_start_accepts_seeded_gym_with_stationless_options() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let workout = sample_workout();

        validate_active_workout_start(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect("seeded gym should support configured start preparation");
    }

    #[tokio::test]
    async fn validate_active_workout_start_accepts_stationless_option_without_selected_station_id()
    {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].training_plan_exercise_id =
            "32000000-0000-0000-0000-000000000004".to_owned();
        workout.exercises[0].position = 4;
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000004".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000016".to_owned());
        workout.exercises[0].selected_station_id = None;

        validate_active_workout_start(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect("stationless variants should not require selected_station_id");
    }

    #[tokio::test]
    async fn validate_active_workout_start_rejects_station_required_option_without_selected_station_id(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_station_id = None;

        match validate_active_workout_start(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("station-required variants should require selected_station_id")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_station_id is required for station-required selected_training_plan_exercise_variant_id"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_accepts_matching_option_variant_station() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000001".to_owned());

        validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect("matching option context should validate");
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_off_profile_set_loads_in_configured_gym()
    {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].sets[0].load_display_value = Some(21.0);
        workout.exercises[0].sets[0].load_canonical_kg = Some(21.0);

        match validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("off-profile load should fail in configured-gym mode")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "set.load_value must match selected station load profile values in configured-gym mode"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn configured_gym_profile_load_validation_accepts_canonical_total_for_per_side_variant() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000002".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000002".to_owned());
        workout.exercises[0].sets[0].load_display_value = Some(20.0);
        workout.exercises[0].sets[0].load_canonical_kg = Some(20.0);

        validate_configured_gym_profile_loads(&repository, &workout, DEV_USER_ID)
            .await
            .expect("per-side variants should validate canonical total values against per-side profiles");
    }

    #[tokio::test]
    async fn configured_gym_profile_load_validation_rejects_off_profile_canonical_total_for_per_side_variant(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000002".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000002".to_owned());
        workout.exercises[0].sets[0].load_display_value = Some(21.0);
        workout.exercises[0].sets[0].load_canonical_kg = Some(21.0);

        match validate_configured_gym_profile_loads(&repository, &workout, DEV_USER_ID)
            .await
            .expect_err("off-profile per-side canonical total should fail in configured-gym mode")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "set.load_value must match selected station load profile values in configured-gym mode"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_null_set_loads_for_station_based_configured_gym(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].sets[0].load_display_value = None;
        workout.exercises[0].sets[0].load_canonical_kg = None;

        match validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect_err("null station-based set load should fail in configured-gym mode")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "set.load_value must be provided when selected_station_id is set in configured-gym mode"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_allows_null_set_loads_for_stationless_configured_gym(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000001".to_owned());
        workout.exercises[0].selected_station_id = None;
        workout.exercises[0].sets[0].load_display_value = None;
        workout.exercises[0].sets[0].load_canonical_kg = None;

        validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect("stationless configured-gym should allow null set loads");
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_allows_non_profile_loads_in_free_mode() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut workout = sample_workout();
        workout.gym_id = None;
        workout.exercises[0].sets[0].load_display_value = Some(22.5);
        workout.exercises[0].sets[0].load_canonical_kg = Some(22.5);

        validate_active_workout(&repository, &workout, 6, DEV_USER_ID)
            .await
            .expect("free mode should not enforce station profile values");
    }

    #[tokio::test]
    async fn configured_gym_profile_load_validation_surfaces_malformed_profile_definitions() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        sqlx::query(
            "INSERT INTO gyms (id, name)
             VALUES ($1::uuid, $2)",
        )
        .bind("00000000-0000-0000-0000-000000009101")
        .bind("Malformed Definition Gym")
        .execute(&pool)
        .await
        .expect("gym insert should succeed");

        sqlx::query(
            "INSERT INTO load_profiles (id, name, weight_unit, definition)
             VALUES ($1::uuid, $2, $3, $4::jsonb)",
        )
        .bind("00000000-0000-0000-0000-000000009201")
        .bind("Malformed Definition Profile")
        .bind("KG")
        .bind(r#"{"kind":"fixed_list","values":["bad"]}"#)
        .execute(&pool)
        .await
        .expect("load profile insert should succeed");

        sqlx::query(
            "INSERT INTO equipment_stations (id, gym_id, name, load_profile_id)
             VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
        )
        .bind("00000000-0000-0000-0000-000000009301")
        .bind("00000000-0000-0000-0000-000000009101")
        .bind("Malformed Definition Station")
        .bind("00000000-0000-0000-0000-000000009201")
        .execute(&pool)
        .await
        .expect("station insert should succeed");

        let repository = new_repository(pool);
        let workout = NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000009401".to_owned(),
            gym_id: Some("00000000-0000-0000-0000-000000009101".to_owned()),
            started_at: None,
            completed_at: None,
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000009501".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: Some("00000000-0000-0000-0000-000000009301".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
                    completed_at: None,
                }],
            }],
        };

        match validate_configured_gym_profile_loads(&repository, &workout, DEV_USER_ID)
            .await
            .expect_err("malformed profile definition should surface persistence error")
        {
            WorkoutValidationError::Persistence(PersistenceError::Conflict(message)) => {
                assert!(message.contains("fixed_list value at index 0 must be numeric"));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_allows_fallback_change_before_first_completed_set(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let initial_workout = workout_with_multi_option_exercise();
        let created = repository
            .create_active_workout_for_user(&initial_workout, DEV_USER_ID)
            .await
            .expect("active workout should be created");

        let mut updated_workout = initial_workout;
        updated_workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000007".to_owned());
        updated_workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000006".to_owned());
        updated_workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000005".to_owned());

        validate_fallback_selection_lock(&repository, &created.id, DEV_USER_ID, &updated_workout)
            .await
            .expect("fallback should remain mutable before first completed set");
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_fallback_change_after_first_completed_set(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = new_repository(pool);
        let mut initial_workout = workout_with_multi_option_exercise();
        initial_workout.exercises[0].sets.push(NewWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            repetition_value: Some(10),
            load_display_value: Some(20.0),
            load_display_unit: "kg".to_owned(),
            load_canonical_kg: Some(20.0),
            completed_at: None,
        });

        let created = repository
            .create_active_workout_for_user(&initial_workout, DEV_USER_ID)
            .await
            .expect("active workout should be created");

        let mut updated_workout = initial_workout;
        updated_workout.exercises[0].selected_training_plan_exercise_variant_id =
            Some("33000000-0000-0000-0000-000000000007".to_owned());
        updated_workout.exercises[0].selected_variant_id =
            Some("20000000-0000-0000-0000-000000000006".to_owned());
        updated_workout.exercises[0].selected_station_id =
            Some("50000000-0000-0000-0000-000000000005".to_owned());

        match validate_fallback_selection_lock(
            &repository,
            &created.id,
            DEV_USER_ID,
            &updated_workout,
        )
        .await
        .expect_err("fallback change should be locked after first completed set")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "Fallback selection cannot change after first completed set"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    // Residual gap accepted for this item:
    // combinations where only one or two selection IDs are present are already validated by
    // API-layer invariant tests; duplicating them here would add low signal.
}
