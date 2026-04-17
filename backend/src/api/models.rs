use crate::domain::{
    ActiveWorkout as DomainActiveWorkout, ActiveWorkoutExercise as DomainActiveWorkoutExercise,
    ActiveWorkoutSet as DomainActiveWorkoutSet,
    CompletedActiveWorkoutSet as DomainCompletedActiveWorkoutSet, NewWorkout, NewWorkoutExercise,
    NewWorkoutSet, WorkoutSummary as DomainWorkoutSummary,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use super::error::ApiError;

pub use crate::models::active_workout::ActiveWorkout as ActiveWorkoutDetailResponse;
pub use crate::models::active_workout_exercise::ActiveWorkoutExercise as ActiveWorkoutExerciseResponse;
use crate::models::active_workout_exercise::LoadInputMode as ActiveWorkoutExerciseLoadInputModeResponse;
use crate::models::active_workout_exercise::SetTrackingMode as ActiveWorkoutExerciseSetTrackingModeResponse;
pub use crate::models::active_workout_exercise_input::ActiveWorkoutExerciseInput;
use crate::models::active_workout_exercise_input::SetTrackingMode as ActiveWorkoutExerciseSetTrackingModeInput;
pub use crate::models::active_workout_response::ActiveWorkoutResponse;
pub use crate::models::active_workout_set::ActiveWorkoutSet as ActiveWorkoutSetResponse;
use crate::models::active_workout_set::RepetitionKind as ActiveWorkoutSetRepetitionKindResponse;
use crate::models::active_workout_set::SetSide as ActiveWorkoutSetSideResponse;
pub use crate::models::active_workout_set_input::ActiveWorkoutSetInput;
use crate::models::active_workout_set_input::SetSide as ActiveWorkoutSetSideInput;
pub use crate::models::auth_login_request::AuthLoginRequest;
pub use crate::models::auth_login_response::AuthLoginResponse;
pub use crate::models::auth_session_response::AuthSessionResponse;
pub use crate::models::auth_session_user::AuthSessionUser as AuthSessionUserResponse;
pub use crate::models::auth_update_display_name_request::AuthUpdateDisplayNameRequest;
pub use crate::models::auth_update_password_request::AuthUpdatePasswordRequest;
pub use crate::models::complete_active_workout_request::CompleteActiveWorkoutRequest;
pub use crate::models::completed_active_workout_set::CompletedActiveWorkoutSet as CompletedActiveWorkoutSetResponse;
use crate::models::completed_active_workout_set::RepetitionKind as CompletedActiveWorkoutSetRepetitionKindResponse;
use crate::models::completed_active_workout_set::SetSide as CompletedActiveWorkoutSetSideResponse;
pub use crate::models::create_active_workout_request::CreateActiveWorkoutRequest;
#[allow(unused_imports)]
pub use crate::models::create_workout_exercise_input::CreateWorkoutExerciseInput;
pub use crate::models::create_workout_request::CreateWorkoutRequest;
pub use crate::models::create_workout_set_input::CreateWorkoutSetInput;
pub use crate::models::gym_summary::GymSummary as GymSummaryResponse;
pub use crate::models::training_plan_exercise_variant_summary::TrainingPlanExerciseVariantSummary as TrainingPlanExerciseVariantSummaryResponse;
pub use crate::models::training_plan_exercise_variants_response::TrainingPlanExerciseVariantsResponse;
pub use crate::models::training_plan_summary::TrainingPlanSummary as TrainingPlanSummaryResponse;
pub use crate::models::update_active_workout_request::UpdateActiveWorkoutRequest;
use crate::models::workout_summary::WorkoutProgressStatus;
pub use crate::models::workout_summary::WorkoutSummary as WorkoutSummaryResponse;

#[derive(Serialize)]
pub struct TrainingPlanDetailResponse {
    pub id: String,
    pub name: String,
    pub exercises: Vec<TrainingPlanExerciseDetailResponse>,
}

#[derive(Serialize)]
pub struct AboutMetadataResponse {
    pub app_version: String,
    pub commit_hash_short: String,
    pub build_timestamp_utc: String,
    pub channel: String,
}

#[derive(Serialize)]
pub struct TrainingPlanExerciseDetailResponse {
    pub training_plan_exercise_id: String,
    pub exercise_name: String,
    pub exercise_position: i32,
}

#[derive(Deserialize)]
pub struct TrainingPlanExerciseVariantsQuery {
    #[serde(rename = "gymId")]
    pub gym_id: String,
}

impl CreateWorkoutRequest {
    pub fn validate_and_into_domain(self) -> Result<NewWorkout, ApiError> {
        if self.training_plan_id.trim().is_empty() {
            return Err(ApiError::Validation(
                "training_plan_id is required".to_owned(),
            ));
        }
        let gym_id = empty_string_to_none(self.gym_id);
        let started_at = flatten_nullable(self.started_at);
        let completed_at = flatten_nullable(self.completed_at);

        let mut seen_positions = HashSet::new();
        let mut exercises = Vec::with_capacity(self.exercises.len());

        for exercise in self.exercises {
            if exercise.training_plan_exercise_id.trim().is_empty() {
                return Err(ApiError::Validation(
                    "training_plan_exercise_id is required".to_owned(),
                ));
            }

            if exercise.position < 1 {
                return Err(ApiError::Validation(
                    "Exercise position must be at least 1".to_owned(),
                ));
            }

            if !seen_positions.insert(exercise.position) {
                return Err(ApiError::Validation(
                    "Exercise positions must be unique".to_owned(),
                ));
            }

            validate_create_set_input(&exercise.set)?;

            exercises.push(NewWorkoutExercise {
                training_plan_exercise_id: exercise.training_plan_exercise_id,
                position: exercise.position,
                selected_variant_id: empty_string_to_none(flatten_nullable(
                    exercise.selected_variant_id,
                )),
                selected_station_id: empty_string_to_none(flatten_nullable(
                    exercise.selected_station_id,
                )),
                selected_training_plan_exercise_variant_id: empty_string_to_none(flatten_nullable(
                    exercise.selected_training_plan_exercise_variant_id,
                )),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: completed_at.clone(),
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: flatten_nullable(exercise.set.repetition_value),
                    load_display_value: exercise.set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: exercise.set.load_value,
                    completed_at: completed_at.clone(),
                }],
            });
        }

        let workout = NewWorkout {
            training_plan_id: self.training_plan_id,
            gym_id,
            started_at,
            completed_at,
            current_exercise_position: None,
            exercises,
        };

        workout
            .validate_mode_invariants()
            .map_err(ApiError::Validation)?;

        Ok(workout)
    }
}

impl CreateActiveWorkoutRequest {
    pub fn validate_and_into_domain(&self) -> Result<NewWorkout, ApiError> {
        validate_confirmed_position(
            self.first_confirmed_exercise_position,
            "first_confirmed_exercise_position",
        )?;
        self.validate_common(None)
    }
}

impl UpdateActiveWorkoutRequest {
    pub fn validate_and_into_domain(&self) -> Result<NewWorkout, ApiError> {
        validate_confirmed_position(
            self.last_confirmed_exercise_position,
            "last_confirmed_exercise_position",
        )?;
        self.validate_common(None)
    }
}

impl CompleteActiveWorkoutRequest {
    pub fn validate_and_into_domain(&self) -> Result<NewWorkout, ApiError> {
        validate_confirmed_position(
            self.last_confirmed_exercise_position,
            "last_confirmed_exercise_position",
        )?;
        self.validate_common(Some(self.completed_at.clone()))
    }
}

trait ActiveWorkoutPayloadValidation {
    fn training_plan_id(&self) -> &str;
    fn gym_id(&self) -> Option<&str>;
    fn started_at(&self) -> &str;
    fn current_exercise_position(&self) -> i32;
    fn total_exercise_count(&self) -> i32;
    fn exercises(&self) -> &[ActiveWorkoutExerciseInput];

    fn validate_common(&self, completed_at: Option<String>) -> Result<NewWorkout, ApiError> {
        if self.training_plan_id().trim().is_empty() {
            return Err(ApiError::Validation(
                "training_plan_id is required".to_owned(),
            ));
        }

        let gym_id = self.gym_id().and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_owned())
            }
        });

        if self.started_at().trim().is_empty() {
            return Err(ApiError::Validation("started_at is required".to_owned()));
        }

        if self.current_exercise_position() < 1 {
            return Err(ApiError::Validation(
                "current_exercise_position must be at least 1".to_owned(),
            ));
        }

        if self.total_exercise_count() < 1 {
            return Err(ApiError::Validation(
                "total_exercise_count must be at least 1".to_owned(),
            ));
        }

        if self.current_exercise_position() > self.total_exercise_count() {
            return Err(ApiError::Validation(
                "current_exercise_position must not exceed total_exercise_count".to_owned(),
            ));
        }

        if self.exercises().is_empty() {
            return Err(ApiError::Validation(
                "Active workout must include at least one confirmed exercise".to_owned(),
            ));
        }

        let mut seen_positions = HashSet::new();
        let mut exercises = Vec::with_capacity(self.exercises().len());

        for exercise in self.exercises() {
            if exercise.training_plan_exercise_id.trim().is_empty() {
                return Err(ApiError::Validation(
                    "training_plan_exercise_id is required".to_owned(),
                ));
            }

            if exercise.position < 1 {
                return Err(ApiError::Validation(
                    "Exercise position must be at least 1".to_owned(),
                ));
            }

            if !seen_positions.insert(exercise.position) {
                return Err(ApiError::Validation(
                    "Exercise positions must be unique".to_owned(),
                ));
            }

            let has_pre_set_selection_snapshot =
                has_full_selection_context(exercise) && exercise.completed_sets.is_empty();
            let skipped_at = empty_string_to_none(flatten_nullable(exercise.skipped_at.clone()));
            let has_skip_marker = has_non_empty_value(&skipped_at);
            if has_skip_marker && !exercise.completed_sets.is_empty() {
                return Err(ApiError::Validation(
                    "Active workout exercise cannot include both completed_sets and skipped_at"
                        .to_owned(),
                ));
            }

            if exercise.completed_sets.is_empty()
                && !has_pre_set_selection_snapshot
                && !has_skip_marker
            {
                return Err(ApiError::Validation(
                    "Active workout exercise must include at least one completed set or skipped_at"
                        .to_owned(),
                ));
            }

            let mut completed_sets = Vec::with_capacity(exercise.completed_sets.len());
            for set in &exercise.completed_sets {
                validate_active_set_input(set)?;

                completed_sets.push(NewWorkoutSet {
                    set_index: set.set_index,
                    set_side: active_set_side_input_to_domain(set.set_side).to_owned(),
                    reps: flatten_nullable(set.repetition_value),
                    load_display_value: set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: set.load_value,
                    completed_at: completed_at.clone(),
                });
            }

            let completed_exercise_at = if has_skip_marker {
                skipped_at.clone()
            } else if !completed_sets.is_empty() {
                completed_at.clone()
            } else {
                None
            };

            exercises.push(NewWorkoutExercise {
                training_plan_exercise_id: exercise.training_plan_exercise_id.clone(),
                position: exercise.position,
                selected_variant_id: empty_string_to_none(exercise.selected_variant_id.clone()),
                selected_station_id: empty_string_to_none(exercise.selected_station_id.clone()),
                selected_training_plan_exercise_variant_id: empty_string_to_none(
                    exercise.selected_training_plan_exercise_variant_id.clone(),
                ),
                set_tracking_mode: Some(
                    active_set_tracking_mode_input_to_domain(exercise.set_tracking_mode).to_owned(),
                ),
                skipped_at,
                completed_at: completed_exercise_at,
                sets: completed_sets,
            });
        }

        if exercises.len() as i32 > self.total_exercise_count() {
            return Err(ApiError::Validation(
                "Confirmed exercise count must not exceed total_exercise_count".to_owned(),
            ));
        }

        let workout = NewWorkout {
            training_plan_id: self.training_plan_id().to_owned(),
            gym_id,
            started_at: Some(self.started_at().to_owned()),
            completed_at,
            current_exercise_position: Some(self.current_exercise_position()),
            exercises,
        };

        workout
            .validate_mode_invariants()
            .map_err(ApiError::Validation)?;

        Ok(workout)
    }
}

impl ActiveWorkoutPayloadValidation for CreateActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> Option<&str> {
        as_deref_nullable(&self.gym_id)
    }

    fn started_at(&self) -> &str {
        &self.started_at
    }

    fn current_exercise_position(&self) -> i32 {
        self.current_exercise_position
    }

    fn total_exercise_count(&self) -> i32 {
        self.total_exercise_count
    }

    fn exercises(&self) -> &[ActiveWorkoutExerciseInput] {
        &self.exercises
    }
}

impl ActiveWorkoutPayloadValidation for UpdateActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> Option<&str> {
        as_deref_nullable(&self.gym_id)
    }

    fn started_at(&self) -> &str {
        &self.started_at
    }

    fn current_exercise_position(&self) -> i32 {
        self.current_exercise_position
    }

    fn total_exercise_count(&self) -> i32 {
        self.total_exercise_count
    }

    fn exercises(&self) -> &[ActiveWorkoutExerciseInput] {
        &self.exercises
    }
}

impl ActiveWorkoutPayloadValidation for CompleteActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> Option<&str> {
        as_deref_nullable(&self.gym_id)
    }

    fn started_at(&self) -> &str {
        &self.started_at
    }

    fn current_exercise_position(&self) -> i32 {
        self.current_exercise_position
    }

    fn total_exercise_count(&self) -> i32 {
        self.total_exercise_count
    }

    fn exercises(&self) -> &[ActiveWorkoutExerciseInput] {
        &self.exercises
    }
}

fn has_full_selection_context(exercise: &ActiveWorkoutExerciseInput) -> bool {
    has_non_empty_value(&exercise.selected_training_plan_exercise_variant_id)
        && has_non_empty_value(&exercise.selected_variant_id)
}

fn has_non_empty_value(value: &Option<String>) -> bool {
    value
        .as_ref()
        .is_some_and(|candidate| !candidate.trim().is_empty())
}

pub fn flatten_nullable<T>(value: Option<Option<T>>) -> Option<T> {
    value.flatten()
}

fn as_deref_nullable(value: &Option<Option<String>>) -> Option<&str> {
    value.as_ref().and_then(|inner| inner.as_deref())
}

pub fn empty_string_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|candidate| {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    })
}

pub fn validate_create_set_input(set: &CreateWorkoutSetInput) -> Result<(), ApiError> {
    if let Some(load_value) = set.load_value {
        if !load_value.is_finite() || load_value < 0.0 {
            return Err(ApiError::Validation(
                "set.load_value must be a non-negative finite number when provided".to_owned(),
            ));
        }
    }

    if let Some(repetition_value) = flatten_nullable(set.repetition_value) {
        if repetition_value < 1 {
            return Err(ApiError::Validation(
                "set.repetition_value must be greater than 0 when provided".to_owned(),
            ));
        }
    }

    Ok(())
}

pub fn validate_active_set_input(set: &ActiveWorkoutSetInput) -> Result<(), ApiError> {
    if set.set_index < 1 {
        return Err(ApiError::Validation(
            "set.set_index must be greater than 0".to_owned(),
        ));
    }

    if let Some(load_value) = set.load_value {
        if !load_value.is_finite() || load_value < 0.0 {
            return Err(ApiError::Validation(
                "set.load_value must be a non-negative finite number when provided".to_owned(),
            ));
        }
    }

    if let Some(repetition_value) = flatten_nullable(set.repetition_value) {
        if repetition_value < 1 {
            return Err(ApiError::Validation(
                "set.repetition_value must be greater than 0 when provided".to_owned(),
            ));
        }
    }

    Ok(())
}

pub fn validate_confirmed_position(position: i32, field_name: &str) -> Result<(), ApiError> {
    if position < 1 {
        return Err(ApiError::Validation(format!(
            "{field_name} must be at least 1"
        )));
    }

    Ok(())
}

pub fn active_workout_response(workout: DomainActiveWorkout) -> ActiveWorkoutResponse {
    ActiveWorkoutResponse {
        workout: Box::new(ActiveWorkoutDetailResponse {
            id: workout.id,
            training_plan_id: workout.training_plan_id,
            training_plan_name: workout.training_plan_name,
            gym_id: workout.gym_id,
            gym_name: workout.gym_name,
            started_at: workout.started_at,
            updated_at: workout.updated_at,
            current_exercise_position: workout.current_exercise_position,
            total_exercise_count: workout.total_exercise_count,
            exercises: workout
                .exercises
                .into_iter()
                .map(active_workout_exercise_response)
                .collect(),
        }),
    }
}

fn active_workout_exercise_response(
    exercise: DomainActiveWorkoutExercise,
) -> ActiveWorkoutExerciseResponse {
    let load_input_mode = parse_active_workout_load_input_mode(exercise.load_input_mode.as_deref());
    let set_tracking_mode =
        parse_active_workout_set_tracking_mode(exercise.set_tracking_mode.as_deref());
    let repetition_kind = exercise.repetition_kind.as_deref();
    ActiveWorkoutExerciseResponse {
        training_plan_exercise_id: exercise.training_plan_exercise_id,
        position: exercise.position,
        exercise_name: exercise.exercise_name,
        selected_training_plan_exercise_variant_id: exercise
            .selected_training_plan_exercise_variant_id,
        selected_variant_id: exercise.selected_variant_id,
        selected_variant_name: exercise.selected_variant_name,
        load_input_mode,
        set_tracking_mode,
        selected_station_id: exercise.selected_station_id,
        selected_station_name: exercise.selected_station_name,
        skipped_at: exercise.skipped_at.map(Some),
        completed_at: exercise.completed_at.map(Some),
        completed_sets: exercise
            .completed_sets
            .into_iter()
            .map(|set| active_workout_completed_set_response(set, load_input_mode, repetition_kind))
            .collect(),
        suggested_set: Box::new(active_workout_set_response(
            exercise.suggested_set,
            load_input_mode,
            repetition_kind,
        )),
    }
}

fn active_workout_completed_set_response(
    set: DomainCompletedActiveWorkoutSet,
    load_input_mode: Option<ActiveWorkoutExerciseLoadInputModeResponse>,
    repetition_kind: Option<&str>,
) -> CompletedActiveWorkoutSetResponse {
    let load_value_per_side = set.load_value.map(|total| match load_input_mode {
        Some(ActiveWorkoutExerciseLoadInputModeResponse::PerSide) => total / 2.0,
        _ => total,
    });

    CompletedActiveWorkoutSetResponse {
        set_index: set.set_index,
        set_side: format_completed_set_side_response(&set.set_side),
        load_value: set.load_value,
        load_value_per_side: Some(load_value_per_side),
        repetition_kind: Some(parse_completed_set_repetition_kind_response(
            repetition_kind,
        )),
        repetition_value: Some(set.reps),
    }
}

fn active_workout_set_response(
    set: DomainActiveWorkoutSet,
    load_input_mode: Option<ActiveWorkoutExerciseLoadInputModeResponse>,
    repetition_kind: Option<&str>,
) -> ActiveWorkoutSetResponse {
    let suggested_load_total_kg = Some(set.load_value);
    let suggested_load_input_kg = suggested_load_total_kg.map(|total| match load_input_mode {
        Some(ActiveWorkoutExerciseLoadInputModeResponse::PerSide) => total / 2.0,
        _ => total,
    });

    ActiveWorkoutSetResponse {
        set_index: set.set_index,
        set_side: format_active_set_side_response(&set.set_side),
        suggested_load_input_kg,
        suggested_load_total_kg,
        repetition_kind: Some(parse_active_set_repetition_kind_response(repetition_kind)),
        repetition_value: Some(set.reps),
    }
}

fn parse_active_workout_load_input_mode(
    mode: Option<&str>,
) -> Option<ActiveWorkoutExerciseLoadInputModeResponse> {
    match mode {
        Some("PER_SIDE") => Some(ActiveWorkoutExerciseLoadInputModeResponse::PerSide),
        Some("TOTAL") => Some(ActiveWorkoutExerciseLoadInputModeResponse::Total),
        _ => None,
    }
}

fn parse_active_workout_set_tracking_mode(
    mode: Option<&str>,
) -> Option<ActiveWorkoutExerciseSetTrackingModeResponse> {
    match mode {
        Some("UNILATERAL") => Some(ActiveWorkoutExerciseSetTrackingModeResponse::Unilateral),
        Some("BILATERAL") => Some(ActiveWorkoutExerciseSetTrackingModeResponse::Bilateral),
        _ => None,
    }
}

fn active_set_tracking_mode_input_to_domain(
    mode: ActiveWorkoutExerciseSetTrackingModeInput,
) -> &'static str {
    match mode {
        ActiveWorkoutExerciseSetTrackingModeInput::Unilateral => "UNILATERAL",
        ActiveWorkoutExerciseSetTrackingModeInput::Bilateral => "BILATERAL",
    }
}

fn active_set_side_input_to_domain(side: ActiveWorkoutSetSideInput) -> &'static str {
    match side {
        ActiveWorkoutSetSideInput::Left => "LEFT",
        ActiveWorkoutSetSideInput::Right => "RIGHT",
        ActiveWorkoutSetSideInput::Bilateral => "BILATERAL",
    }
}

fn format_completed_set_side_response(side: &str) -> CompletedActiveWorkoutSetSideResponse {
    match side {
        "LEFT" => CompletedActiveWorkoutSetSideResponse::Left,
        "RIGHT" => CompletedActiveWorkoutSetSideResponse::Right,
        _ => CompletedActiveWorkoutSetSideResponse::Bilateral,
    }
}

fn format_active_set_side_response(side: &str) -> ActiveWorkoutSetSideResponse {
    match side {
        "LEFT" => ActiveWorkoutSetSideResponse::Left,
        "RIGHT" => ActiveWorkoutSetSideResponse::Right,
        _ => ActiveWorkoutSetSideResponse::Bilateral,
    }
}

fn parse_active_set_repetition_kind_response(
    kind: Option<&str>,
) -> Option<ActiveWorkoutSetRepetitionKindResponse> {
    match kind {
        Some("SECS") => Some(ActiveWorkoutSetRepetitionKindResponse::Secs),
        Some("REPS") => Some(ActiveWorkoutSetRepetitionKindResponse::Reps),
        _ => None,
    }
}

fn parse_completed_set_repetition_kind_response(
    kind: Option<&str>,
) -> Option<CompletedActiveWorkoutSetRepetitionKindResponse> {
    match kind {
        Some("SECS") => Some(CompletedActiveWorkoutSetRepetitionKindResponse::Secs),
        Some("REPS") => Some(CompletedActiveWorkoutSetRepetitionKindResponse::Reps),
        _ => None,
    }
}

pub fn workout_summary_response(summary: DomainWorkoutSummary) -> WorkoutSummaryResponse {
    let (workout_progress, workout_progress_status) = match summary.workout_progress {
        Some(value) => (Some(Some(value)), WorkoutProgressStatus::Available),
        None => (Some(None), WorkoutProgressStatus::NotEnoughData),
    };

    WorkoutSummaryResponse {
        id: summary.id,
        training_plan_id: summary.training_plan_id,
        training_plan_name: summary.training_plan_name,
        gym_id: summary.gym_id,
        gym_name: summary.gym_name,
        started_at: Some(summary.started_at),
        completed_at: Some(summary.completed_at),
        exercise_count: summary.exercise_count,
        completed_set_count: summary.completed_set_count,
        average_duration_minutes: Some(summary.average_duration_minutes),
        workout_progress,
        workout_progress_status,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        active_workout_response, empty_string_to_none, validate_confirmed_position,
        validate_create_set_input, ActiveWorkoutExerciseInput, CompleteActiveWorkoutRequest,
        CreateActiveWorkoutRequest, CreateWorkoutExerciseInput, CreateWorkoutRequest,
        CreateWorkoutSetInput, UpdateActiveWorkoutRequest,
    };
    use crate::api::error::ApiError;
    use crate::domain::{
        ActiveWorkout as DomainActiveWorkout, ActiveWorkoutExercise as DomainActiveWorkoutExercise,
        ActiveWorkoutSet as DomainActiveWorkoutSet,
    };
    use crate::models::active_workout_set_input::RepetitionKind as ActiveWorkoutSetRepetitionKindInput;
    use crate::models::create_workout_set_input::RepetitionKind as CreateWorkoutSetRepetitionKindInput;

    fn assert_validation_message(result: Result<(), ApiError>, expected: &str) {
        match result.expect_err("validation should fail") {
            ApiError::Validation(message) => assert_eq!(message, expected),
            other => panic!("unexpected error: {other:?}"),
        }
    }

    fn assert_domain_validation_message<T: std::fmt::Debug>(
        result: Result<T, ApiError>,
        expected: &str,
    ) {
        match result.expect_err("validation should fail") {
            ApiError::Validation(message) => assert_eq!(message, expected),
            other => panic!("unexpected error: {other:?}"),
        }
    }

    fn sample_set_input() -> CreateWorkoutSetInput {
        CreateWorkoutSetInput {
            load_value: Some(20.0),
            repetition_kind: Some(Some(CreateWorkoutSetRepetitionKindInput::Reps)),
            repetition_value: Some(Some(10)),
        }
    }

    fn sample_active_set_input() -> crate::models::active_workout_set_input::ActiveWorkoutSetInput {
        crate::models::active_workout_set_input::ActiveWorkoutSetInput {
            set_index: 1,
            set_side: crate::models::active_workout_set_input::SetSide::Bilateral,
            load_value: Some(20.0),
            load_value_per_side: None,
            repetition_kind: Some(Some(ActiveWorkoutSetRepetitionKindInput::Reps)),
            repetition_value: Some(Some(10)),
        }
    }

    fn sample_active_exercise(position: i32) -> ActiveWorkoutExerciseInput {
        ActiveWorkoutExerciseInput {
            training_plan_exercise_id: format!("exercise-{position}"),
            position,
            selected_training_plan_exercise_variant_id: Some("  option-id  ".to_owned()),
            selected_variant_id: Some("  variant-id  ".to_owned()),
            load_input_mode: crate::models::active_workout_exercise_input::LoadInputMode::Total,
            set_tracking_mode:
                crate::models::active_workout_exercise_input::SetTrackingMode::Bilateral,
            selected_station_id: Some("  station-id  ".to_owned()),
            skipped_at: None,
            completed_sets: vec![sample_active_set_input()],
        }
    }

    fn sample_create_workout_request() -> CreateWorkoutRequest {
        CreateWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: Some("gym-id".to_owned()),
            started_at: Some(Some("2026-01-20T09:00:00Z".to_owned())),
            completed_at: Some(Some("2026-01-20T09:20:00Z".to_owned())),
            exercises: vec![CreateWorkoutExerciseInput {
                training_plan_exercise_id: "exercise-1".to_owned(),
                position: 1,
                selected_training_plan_exercise_variant_id: Some(Some("  option-id  ".to_owned())),
                selected_variant_id: Some(Some("  variant-id  ".to_owned())),
                selected_station_id: Some(Some("  station-id  ".to_owned())),
                set: Box::new(sample_set_input()),
            }],
        }
    }

    fn sample_create_active_workout_request() -> CreateActiveWorkoutRequest {
        CreateActiveWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: Some(Some("gym-id".to_owned())),
            started_at: "2026-02-10T09:00:00Z".to_owned(),
            current_exercise_position: 2,
            total_exercise_count: 5,
            exercises: vec![sample_active_exercise(1)],
            first_confirmed_exercise_position: 1,
        }
    }

    #[test]
    fn empty_string_to_none_trims_non_empty_values() {
        assert_eq!(empty_string_to_none(None), None);
        assert_eq!(empty_string_to_none(Some("   ".to_owned())), None);
        assert_eq!(
            empty_string_to_none(Some("  value  ".to_owned())),
            Some("value".to_owned())
        );
    }

    #[test]
    fn validate_set_input_rejects_invalid_values_and_accepts_optional_reps() {
        assert!(validate_create_set_input(&CreateWorkoutSetInput {
            load_value: None,
            repetition_kind: None,
            repetition_value: None,
        })
        .is_ok());

        assert_validation_message(
            validate_create_set_input(&CreateWorkoutSetInput {
                load_value: Some(f64::INFINITY),
                repetition_kind: Some(Some(CreateWorkoutSetRepetitionKindInput::Reps)),
                repetition_value: Some(Some(10)),
            }),
            "set.load_value must be a non-negative finite number when provided",
        );

        assert_validation_message(
            validate_create_set_input(&CreateWorkoutSetInput {
                load_value: Some(20.0),
                repetition_kind: Some(Some(CreateWorkoutSetRepetitionKindInput::Reps)),
                repetition_value: Some(Some(0)),
            }),
            "set.repetition_value must be greater than 0 when provided",
        );
    }

    #[test]
    fn validate_confirmed_position_rejects_positions_below_one() {
        assert!(validate_confirmed_position(1, "field_name").is_ok());
        assert_validation_message(
            validate_confirmed_position(0, "last_confirmed_exercise_position"),
            "last_confirmed_exercise_position must be at least 1",
        );
    }

    #[test]
    fn create_workout_request_maps_trimmed_optional_ids() {
        let workout = sample_create_workout_request()
            .validate_and_into_domain()
            .expect("request should validate");

        assert_eq!(workout.exercises.len(), 1);
        assert_eq!(
            workout.exercises[0]
                .selected_training_plan_exercise_variant_id
                .as_deref(),
            Some("option-id")
        );
        assert_eq!(
            workout.exercises[0].selected_variant_id.as_deref(),
            Some("variant-id")
        );
        assert_eq!(
            workout.exercises[0].selected_station_id.as_deref(),
            Some("station-id")
        );
        assert_eq!(
            workout.exercises[0].sets[0].completed_at.as_deref(),
            Some("2026-01-20T09:20:00Z")
        );
    }

    #[test]
    fn create_workout_request_rejects_duplicate_positions() {
        let mut request = sample_create_workout_request();
        request.exercises.push(CreateWorkoutExerciseInput {
            training_plan_exercise_id: "exercise-2".to_owned(),
            position: 1,
            selected_training_plan_exercise_variant_id: None,
            selected_variant_id: None,
            selected_station_id: None,
            set: Box::new(sample_set_input()),
        });

        match request
            .validate_and_into_domain()
            .expect_err("request should fail")
        {
            ApiError::Validation(message) => {
                assert_eq!(message, "Exercise positions must be unique");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn create_workout_request_rejects_missing_required_fields_and_invalid_exercise_values() {
        let mut request = sample_create_workout_request();
        request.training_plan_id = "  ".to_owned();
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "training_plan_id is required",
        );

        let mut request = sample_create_workout_request();
        request.gym_id = Some("  ".to_owned());
        request.exercises[0].selected_training_plan_exercise_variant_id = None;
        request.exercises[0].selected_variant_id = None;
        request.exercises[0].selected_station_id = None;
        assert!(request.validate_and_into_domain().is_ok());

        let mut request = sample_create_workout_request();
        request.exercises[0].training_plan_exercise_id = " ".to_owned();
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "training_plan_exercise_id is required",
        );

        let mut request = sample_create_workout_request();
        request.exercises[0].position = 0;
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "Exercise position must be at least 1",
        );

        let mut request = sample_create_workout_request();
        request.exercises[0].set.load_value = Some(-1.0);
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "set.load_value must be a non-negative finite number when provided",
        );

        let mut request = sample_create_workout_request();
        request.exercises[0].set.repetition_value = Some(Some(0));
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "set.repetition_value must be greater than 0 when provided",
        );
    }

    #[test]
    fn create_workout_request_enforces_mode_dependent_option_context() {
        let mut configured_request = sample_create_workout_request();
        configured_request.exercises[0].selected_training_plan_exercise_variant_id = None;
        assert_domain_validation_message(
            configured_request.validate_and_into_domain(),
            "configured-gym workouts require selected_training_plan_exercise_variant_id for every exercise",
        );

        let mut configured_request_without_station = sample_create_workout_request();
        configured_request_without_station.exercises[0].selected_station_id = None;
        assert!(
            configured_request_without_station
                .validate_and_into_domain()
                .is_ok(),
            "configured-gym requests may omit selected_station_id before start-time variant checks"
        );

        let mut free_mode_request = sample_create_workout_request();
        free_mode_request.gym_id = None;
        free_mode_request.exercises[0].selected_training_plan_exercise_variant_id =
            Some(Some("option-id".to_owned()));
        assert_domain_validation_message(
            free_mode_request.validate_and_into_domain(),
            "free-mode workouts must not include selected option, variant, or station references",
        );
    }

    #[test]
    fn active_workout_request_trims_optional_ids_and_sets_completion_time() {
        let request = CompleteActiveWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: Some(Some("gym-id".to_owned())),
            started_at: "2026-02-10T09:00:00Z".to_owned(),
            completed_at: "2026-02-10T09:30:00Z".to_owned(),
            current_exercise_position: 2,
            total_exercise_count: 5,
            exercises: vec![sample_active_exercise(1)],
            last_confirmed_exercise_position: 1,
        };

        let workout = request
            .validate_and_into_domain()
            .expect("request should validate");

        assert_eq!(
            workout.completed_at.as_deref(),
            Some("2026-02-10T09:30:00Z")
        );
        assert_eq!(
            workout.exercises[0]
                .selected_training_plan_exercise_variant_id
                .as_deref(),
            Some("option-id")
        );
        assert_eq!(
            workout.exercises[0].selected_variant_id.as_deref(),
            Some("variant-id")
        );
        assert_eq!(
            workout.exercises[0].selected_station_id.as_deref(),
            Some("station-id")
        );
        assert_eq!(
            workout.exercises[0].sets[0].completed_at.as_deref(),
            Some("2026-02-10T09:30:00Z")
        );
        assert_eq!(workout.exercises[0].sets[0].set_index, 1);
    }

    #[test]
    fn active_workout_create_workout_request_allows_empty_exercises_for_finish_without_sets() {
        let mut request = sample_create_workout_request();
        request.started_at = Some(Some("2026-01-20T09:00:00Z".to_owned()));
        request.exercises.clear();

        let workout = request
            .validate_and_into_domain()
            .expect("request should validate");

        assert_eq!(workout.started_at.as_deref(), Some("2026-01-20T09:00:00Z"));
        assert_eq!(
            workout.completed_at.as_deref(),
            Some("2026-01-20T09:20:00Z")
        );
        assert!(workout.exercises.is_empty());
    }

    #[test]
    fn active_workout_request_maps_multiple_completed_sets_to_incrementing_indices() {
        let mut request = sample_create_active_workout_request();
        request.exercises[0].completed_sets.push(
            crate::models::active_workout_set_input::ActiveWorkoutSetInput {
                set_index: 2,
                set_side: crate::models::active_workout_set_input::SetSide::Bilateral,
                load_value: Some(22.5),
                load_value_per_side: None,
                repetition_kind: Some(Some(ActiveWorkoutSetRepetitionKindInput::Reps)),
                repetition_value: Some(Some(8)),
            },
        );

        let workout = request
            .validate_and_into_domain()
            .expect("request should validate");

        assert_eq!(workout.exercises[0].sets.len(), 2);
        assert_eq!(workout.exercises[0].sets[0].set_index, 1);
        assert_eq!(workout.exercises[0].sets[1].set_index, 2);
        assert_eq!(workout.exercises[0].sets[1].load_display_value, Some(22.5));
    }

    #[test]
    fn create_active_workout_request_rejects_position_past_total_count() {
        let mut request = sample_create_active_workout_request();
        request.current_exercise_position = 6;

        match request
            .validate_and_into_domain()
            .expect_err("request should fail")
        {
            ApiError::Validation(message) => assert_eq!(
                message,
                "current_exercise_position must not exceed total_exercise_count"
            ),
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn create_active_workout_request_rejects_missing_required_fields() {
        let mut request = sample_create_active_workout_request();
        request.training_plan_id = " ".to_owned();
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "training_plan_id is required",
        );

        let mut request = sample_create_active_workout_request();
        request.gym_id = Some(Some(" ".to_owned()));
        request.exercises[0].selected_training_plan_exercise_variant_id = None;
        request.exercises[0].selected_variant_id = None;
        request.exercises[0].selected_station_id = None;
        assert!(request.validate_and_into_domain().is_ok());

        let mut request = sample_create_active_workout_request();
        request.started_at = " ".to_owned();
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "started_at is required",
        );

        let mut request = sample_create_active_workout_request();
        request.current_exercise_position = 0;
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "current_exercise_position must be at least 1",
        );

        let mut request = sample_create_active_workout_request();
        request.total_exercise_count = 0;
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "total_exercise_count must be at least 1",
        );

        let mut request = sample_create_active_workout_request();
        request.exercises.clear();
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "Active workout must include at least one confirmed exercise",
        );
    }

    #[test]
    fn create_active_workout_request_rejects_invalid_confirmed_exercises() {
        let mut request = sample_create_active_workout_request();
        request.exercises[0].training_plan_exercise_id = " ".to_owned();
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "training_plan_exercise_id is required",
        );

        let mut request = sample_create_active_workout_request();
        request.exercises[0].position = 0;
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "Exercise position must be at least 1",
        );

        let mut request = sample_create_active_workout_request();
        request.exercises.push(sample_active_exercise(1));
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "Exercise positions must be unique",
        );
    }

    #[test]
    fn active_workout_requests_enforce_mode_dependent_option_context() {
        let mut configured_request = sample_create_active_workout_request();
        configured_request.exercises[0].selected_variant_id = None;
        assert_domain_validation_message(
            configured_request.validate_and_into_domain(),
            "configured-gym workouts require selected_variant_id for every exercise",
        );

        let mut free_mode_request = sample_create_active_workout_request();
        free_mode_request.gym_id = None;
        free_mode_request.exercises[0].selected_station_id = Some("station-id".to_owned());
        assert_domain_validation_message(
            free_mode_request.validate_and_into_domain(),
            "free-mode workouts must not include selected option, variant, or station references",
        );
    }

    #[test]
    fn active_workout_request_keeps_load_value_as_canonical_total_in_per_side_mode() {
        let mut request = sample_create_active_workout_request();
        request.exercises[0].load_input_mode =
            crate::models::active_workout_exercise_input::LoadInputMode::PerSide;
        request.exercises[0].completed_sets[0].load_value = Some(40.0);
        request.exercises[0].completed_sets[0].load_value_per_side = Some(Some(20.0));

        let workout = request
            .validate_and_into_domain()
            .expect("request should validate");

        assert_eq!(workout.exercises[0].sets[0].load_canonical_kg, Some(40.0));
        assert_eq!(workout.exercises[0].sets[0].load_display_value, Some(40.0));
    }

    #[test]
    fn update_active_workout_request_rejects_missing_completed_sets() {
        let request = UpdateActiveWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: None,
            started_at: "2026-02-10T09:00:00Z".to_owned(),
            current_exercise_position: 2,
            total_exercise_count: 5,
            exercises: vec![ActiveWorkoutExerciseInput {
                selected_training_plan_exercise_variant_id: None,
                selected_variant_id: None,
                selected_station_id: None,
                completed_sets: Vec::new(),
                ..sample_active_exercise(1)
            }],
            last_confirmed_exercise_position: 1,
        };

        match request
            .validate_and_into_domain()
            .expect_err("request should fail")
        {
            ApiError::Validation(message) => {
                assert_eq!(
                    message,
                    "Active workout exercise must include at least one completed set or skipped_at"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn create_active_workout_request_allows_pre_set_selection_snapshot_without_completed_sets() {
        let request = CreateActiveWorkoutRequest {
            exercises: vec![ActiveWorkoutExerciseInput {
                completed_sets: Vec::new(),
                ..sample_active_exercise(1)
            }],
            ..sample_create_active_workout_request()
        };

        let workout = request
            .validate_and_into_domain()
            .expect("request should validate for pre-set selection-only persistence");

        assert!(workout.exercises[0].sets.is_empty());
        assert_eq!(
            workout.exercises[0]
                .selected_training_plan_exercise_variant_id
                .as_deref(),
            Some("option-id")
        );
        assert_eq!(
            workout.exercises[0].selected_variant_id.as_deref(),
            Some("variant-id")
        );
        assert_eq!(
            workout.exercises[0].selected_station_id.as_deref(),
            Some("station-id")
        );
    }

    #[test]
    fn create_active_workout_request_allows_stationless_pre_set_selection_snapshot() {
        let request = CreateActiveWorkoutRequest {
            exercises: vec![ActiveWorkoutExerciseInput {
                selected_station_id: None,
                completed_sets: Vec::new(),
                ..sample_active_exercise(1)
            }],
            ..sample_create_active_workout_request()
        };

        let workout = request
            .validate_and_into_domain()
            .expect("stationless pre-set selection snapshot should validate");

        assert!(workout.exercises[0].sets.is_empty());
        assert_eq!(
            workout.exercises[0]
                .selected_training_plan_exercise_variant_id
                .as_deref(),
            Some("option-id")
        );
        assert_eq!(
            workout.exercises[0].selected_variant_id.as_deref(),
            Some("variant-id")
        );
        assert_eq!(workout.exercises[0].selected_station_id.as_deref(), None);
    }

    #[test]
    fn create_active_workout_request_rejects_more_confirmed_exercises_than_total() {
        let mut request = sample_create_active_workout_request();
        request.total_exercise_count = 1;
        request.current_exercise_position = 1;
        request.exercises.push(sample_active_exercise(2));

        match request
            .validate_and_into_domain()
            .expect_err("request should fail")
        {
            ApiError::Validation(message) => assert_eq!(
                message,
                "Confirmed exercise count must not exceed total_exercise_count"
            ),
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn active_workout_response_uses_dual_suggested_load_fields_for_total_mode() {
        let response = active_workout_response(DomainActiveWorkout {
            id: "workout-id".to_owned(),
            training_plan_id: "plan-id".to_owned(),
            training_plan_name: "Plan".to_owned(),
            gym_id: None,
            gym_name: None,
            started_at: "2026-02-10T09:00:00Z".to_owned(),
            updated_at: "2026-02-10T09:05:00Z".to_owned(),
            current_exercise_position: 1,
            total_exercise_count: 1,
            exercises: vec![DomainActiveWorkoutExercise {
                training_plan_exercise_id: "exercise-id".to_owned(),
                position: 1,
                exercise_name: "Bench Press".to_owned(),
                selected_training_plan_exercise_variant_id: Some("option-id".to_owned()),
                selected_variant_id: Some("variant-id".to_owned()),
                selected_variant_name: Some("Variant".to_owned()),
                repetition_kind: Some("REPS".to_owned()),
                load_input_mode: Some("TOTAL".to_owned()),
                set_tracking_mode: Some("BILATERAL".to_owned()),
                selected_station_id: Some("station-id".to_owned()),
                selected_station_name: Some("Station".to_owned()),
                skipped_at: None,
                completed_at: None,
                completed_sets: Vec::new(),
                suggested_set: DomainActiveWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    load_value: 42.5,
                    reps: Some(8),
                },
            }],
        });

        let exercise = &response.workout.exercises[0];
        assert_eq!(
            exercise.load_input_mode,
            Some(super::ActiveWorkoutExerciseLoadInputModeResponse::Total)
        );
        assert_eq!(exercise.suggested_set.suggested_load_total_kg, Some(42.5));
        assert_eq!(exercise.suggested_set.suggested_load_input_kg, Some(42.5));
        assert_eq!(
            exercise.suggested_set.repetition_kind,
            Some(Some(super::ActiveWorkoutSetRepetitionKindResponse::Reps))
        );
        assert_eq!(exercise.suggested_set.repetition_value, Some(Some(8)));
    }

    #[test]
    fn active_workout_response_uses_per_side_input_and_total_canonical_values() {
        let response = active_workout_response(DomainActiveWorkout {
            id: "workout-id".to_owned(),
            training_plan_id: "plan-id".to_owned(),
            training_plan_name: "Plan".to_owned(),
            gym_id: None,
            gym_name: None,
            started_at: "2026-02-10T09:00:00Z".to_owned(),
            updated_at: "2026-02-10T09:05:00Z".to_owned(),
            current_exercise_position: 1,
            total_exercise_count: 1,
            exercises: vec![DomainActiveWorkoutExercise {
                training_plan_exercise_id: "exercise-id".to_owned(),
                position: 1,
                exercise_name: "Cable Fly".to_owned(),
                selected_training_plan_exercise_variant_id: Some("option-id".to_owned()),
                selected_variant_id: Some("variant-id".to_owned()),
                selected_variant_name: Some("Variant".to_owned()),
                repetition_kind: Some("SECS".to_owned()),
                load_input_mode: Some("PER_SIDE".to_owned()),
                set_tracking_mode: Some("BILATERAL".to_owned()),
                selected_station_id: Some("station-id".to_owned()),
                selected_station_name: Some("Station".to_owned()),
                skipped_at: None,
                completed_at: None,
                completed_sets: Vec::new(),
                suggested_set: DomainActiveWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    load_value: 30.0,
                    reps: Some(12),
                },
            }],
        });

        let exercise = &response.workout.exercises[0];
        assert_eq!(
            exercise.load_input_mode,
            Some(super::ActiveWorkoutExerciseLoadInputModeResponse::PerSide)
        );
        assert_eq!(exercise.suggested_set.suggested_load_total_kg, Some(30.0));
        assert_eq!(exercise.suggested_set.suggested_load_input_kg, Some(15.0));
        assert_eq!(
            exercise.suggested_set.repetition_kind,
            Some(Some(super::ActiveWorkoutSetRepetitionKindResponse::Secs))
        );
        assert_eq!(exercise.suggested_set.repetition_value, Some(Some(12)));
    }
}
