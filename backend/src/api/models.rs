use crate::domain::{
    ActiveWorkout as DomainActiveWorkout, ActiveWorkoutExercise as DomainActiveWorkoutExercise,
    ActiveWorkoutSet as DomainActiveWorkoutSet,
    CompletedActiveWorkoutSet as DomainCompletedActiveWorkoutSet, NewWorkout, NewWorkoutExercise,
    NewWorkoutSet, WorkoutDetail as DomainWorkoutDetail,
    WorkoutDetailExercise as DomainWorkoutDetailExercise,
    WorkoutDetailSetLine as DomainWorkoutDetailSetLine,
    WorkoutExercisesPerformanceGroup as DomainWorkoutExercisesPerformanceGroup,
    WorkoutExercisesPerformanceRow as DomainWorkoutExercisesPerformanceRow,
    WorkoutHistorySummary as DomainWorkoutHistorySummary,
    WorkoutProgressEntry as DomainWorkoutProgressEntry, WorkoutSummary as DomainWorkoutSummary,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use super::boundary::{
    load_input_mode_optional, repetition_kind, repetition_kind_optional, set_tracking_mode,
    set_tracking_mode_optional, EnumTranslationError, LoadInputMode, RepetitionKind,
    SetTrackingMode,
};
use super::error::ApiError;

pub use crate::models::active_workout::ActiveWorkout as ActiveWorkoutDetailResponse;
pub use crate::models::active_workout_exercise::ActiveWorkoutExercise as ActiveWorkoutExerciseResponse;
use crate::models::active_workout_exercise::LoadInputMode as ActiveWorkoutExerciseLoadInputModeResponse;
use crate::models::active_workout_exercise::SetTrackingMode as ActiveWorkoutExerciseSetTrackingModeResponse;
pub use crate::models::active_workout_exercise_input::ActiveWorkoutExerciseInput;
use crate::models::active_workout_exercise_input::SetTrackingMode as ActiveWorkoutExerciseSetTrackingModeInput;
pub use crate::models::active_workout_next_set_hint::ActiveWorkoutNextSetHint as ActiveWorkoutNextSetHintResponse;
use crate::models::active_workout_next_set_hint::SetSide as ActiveWorkoutNextSetSideResponse;
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
use crate::models::workout_detail_completion_stats::WorkoutProgressStatus as WorkoutDetailProgressStatus;
use crate::models::workout_detail_exercise::RepetitionKind as WorkoutDetailExerciseRepetitionKindResponse;
use crate::models::workout_detail_exercise::SetTrackingMode as WorkoutDetailExerciseSetTrackingModeResponse;
use crate::models::workout_detail_hero::WorkoutDetailHero as WorkoutDetailHeroResponse;
pub use crate::models::workout_detail_response::WorkoutDetailResponse;
use crate::models::workout_detail_set_line::RepetitionKind as WorkoutDetailSetLineRepetitionKindResponse;
use crate::models::workout_detail_set_line::SetSide as WorkoutDetailSetSideResponse;
use crate::models::workout_exercises_performance_group::Tone as WorkoutExercisesPerformanceGroupTone;
pub use crate::models::workout_exercises_performance_group::WorkoutExercisesPerformanceGroup as WorkoutExercisesPerformanceGroupResponse;
pub use crate::models::workout_exercises_performance_response::WorkoutExercisesPerformanceResponse;
use crate::models::workout_exercises_performance_row::PerformanceStatus as WorkoutExercisesPerformanceStatus;
use crate::models::workout_exercises_performance_row::PerformanceTone as WorkoutExercisesPerformanceTone;
pub use crate::models::workout_exercises_performance_row::WorkoutExercisesPerformanceRow as WorkoutExercisesPerformanceRowResponse;
use crate::models::workout_exercises_personal_record_entry::WorkoutExercisesPersonalRecordEntry as WorkoutExercisesPersonalRecordEntryResponse;
use crate::models::workout_exercises_personal_records12m::MetricFamily as WorkoutExercisesPersonalRecordsMetricFamily;
use crate::models::workout_exercises_personal_records12m::WorkoutExercisesPersonalRecords12m as WorkoutExercisesPersonalRecords12mResponse;
use crate::models::workout_exercises_score_trend30d::WorkoutExercisesScoreTrend30d as WorkoutExercisesScoreTrend30dResponse;
use crate::models::workout_exercises_score_trend_point::WorkoutExercisesScoreTrendPoint as WorkoutExercisesScoreTrendPointResponse;
use crate::models::workout_exercises_strength_metric_mode::Family as WorkoutExercisesStrengthFamily;
use crate::models::workout_exercises_strength_metric_mode::StationModes as WorkoutExercisesStrengthStationMode;
use crate::models::workout_exercises_strength_metric_mode::WorkoutExercisesStrengthMetricMode as WorkoutExercisesStrengthMetricModeResponse;
use crate::models::workout_exercises_strength_point::WorkoutExercisesStrengthPoint as WorkoutExercisesStrengthPointResponse;
use crate::models::workout_exercises_strength_progression12m::WorkoutExercisesStrengthProgression12m as WorkoutExercisesStrengthProgression12mResponse;
pub use crate::models::workout_history_summary::WorkoutHistorySummary as WorkoutHistorySummaryResponse;
use crate::models::workout_progress_entry::ProgressTone as WorkoutProgressTone;
pub use crate::models::workout_progress_entry::WorkoutProgressEntry as WorkoutProgressEntryResponse;
use crate::models::workout_progress_entry::WorkoutProgressStatus as WorkoutProgressStatusResponse;
pub use crate::models::workout_progress_response::WorkoutProgressResponse;
use crate::models::workout_summary::WorkoutProgressStatus;
pub use crate::models::workout_summary::WorkoutSummary as WorkoutSummaryResponse;
use crate::performance::{classify_average, PerformanceAvailability, PerformanceToneCategory};
pub type WorkoutHistoryListResponse = Vec<WorkoutHistorySummaryResponse>;

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
                    repetition_value: flatten_nullable(exercise.set.repetition_value),
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
    fn allows_selectionless_pre_set_snapshot(&self) -> bool {
        false
    }

    fn validate_common(
        &self,
        workout_completed_at: Option<String>,
    ) -> Result<NewWorkout, ApiError> {
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
            let has_selectionless_pre_set_snapshot = self.allows_selectionless_pre_set_snapshot()
                && gym_id.is_none()
                && exercise.completed_sets.is_empty();
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
                && !has_selectionless_pre_set_snapshot
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
                    repetition_value: flatten_nullable(set.repetition_value),
                    load_display_value: set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: set.load_value,
                    completed_at: None,
                });
            }

            let completed_exercise_at = if has_skip_marker {
                skipped_at.clone()
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
            completed_at: workout_completed_at,
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

    fn allows_selectionless_pre_set_snapshot(&self) -> bool {
        true
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

pub fn active_workout_response(
    workout: DomainActiveWorkout,
) -> Result<ActiveWorkoutResponse, EnumTranslationError> {
    Ok(ActiveWorkoutResponse {
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
                .collect::<Result<Vec<_>, _>>()?,
        }),
    })
}

fn active_workout_exercise_response(
    exercise: DomainActiveWorkoutExercise,
) -> Result<ActiveWorkoutExerciseResponse, EnumTranslationError> {
    let load_input_mode =
        active_workout_load_input_mode_response(exercise.load_input_mode.as_deref())?;
    let set_tracking_mode =
        active_workout_set_tracking_mode_response(exercise.set_tracking_mode.as_deref())?;
    let repetition_kind = exercise.repetition_kind.as_deref();
    Ok(ActiveWorkoutExerciseResponse {
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
            .collect::<Result<Vec<_>, _>>()?,
        suggested_set: Box::new(active_workout_set_response(
            exercise.suggested_set,
            load_input_mode,
            repetition_kind,
        )?),
        next_set: Box::new(ActiveWorkoutNextSetHintResponse {
            set_index: exercise.next_set.set_index,
            set_side: format_active_next_set_side_response(&exercise.next_set.set_side),
        }),
    })
}

fn active_workout_completed_set_response(
    set: DomainCompletedActiveWorkoutSet,
    load_input_mode: Option<ActiveWorkoutExerciseLoadInputModeResponse>,
    repetition_kind: Option<&str>,
) -> Result<CompletedActiveWorkoutSetResponse, EnumTranslationError> {
    let load_value_per_side = set.load_value.map(|total| match load_input_mode {
        Some(ActiveWorkoutExerciseLoadInputModeResponse::PerSide) => total / 2.0,
        _ => total,
    });

    Ok(CompletedActiveWorkoutSetResponse {
        set_index: set.set_index,
        set_side: format_completed_set_side_response(&set.set_side),
        load_value: set.load_value,
        load_value_per_side: Some(load_value_per_side),
        repetition_kind: Some(completed_set_repetition_kind_response(repetition_kind)?),
        repetition_value: Some(set.repetition_value),
    })
}

fn active_workout_set_response(
    set: DomainActiveWorkoutSet,
    load_input_mode: Option<ActiveWorkoutExerciseLoadInputModeResponse>,
    repetition_kind: Option<&str>,
) -> Result<ActiveWorkoutSetResponse, EnumTranslationError> {
    let suggested_load_total_kg = Some(set.load_value);
    let suggested_load_input_kg = suggested_load_total_kg.map(|total| match load_input_mode {
        Some(ActiveWorkoutExerciseLoadInputModeResponse::PerSide) => total / 2.0,
        _ => total,
    });

    Ok(ActiveWorkoutSetResponse {
        set_index: set.set_index,
        set_side: format_active_set_side_response(&set.set_side),
        suggested_load_input_kg,
        suggested_load_total_kg,
        repetition_kind: Some(active_set_repetition_kind_response(repetition_kind)?),
        repetition_value: Some(set.repetition_value),
    })
}

fn active_workout_load_input_mode_response(
    mode: Option<&str>,
) -> Result<Option<ActiveWorkoutExerciseLoadInputModeResponse>, EnumTranslationError> {
    Ok(match load_input_mode_optional(mode)? {
        Some(LoadInputMode::PerSide) => Some(ActiveWorkoutExerciseLoadInputModeResponse::PerSide),
        Some(LoadInputMode::Total) => Some(ActiveWorkoutExerciseLoadInputModeResponse::Total),
        None => None,
    })
}

fn active_workout_set_tracking_mode_response(
    mode: Option<&str>,
) -> Result<Option<ActiveWorkoutExerciseSetTrackingModeResponse>, EnumTranslationError> {
    Ok(match set_tracking_mode_optional(mode)? {
        Some(SetTrackingMode::Unilateral) => {
            Some(ActiveWorkoutExerciseSetTrackingModeResponse::Unilateral)
        }
        Some(SetTrackingMode::Bilateral) => {
            Some(ActiveWorkoutExerciseSetTrackingModeResponse::Bilateral)
        }
        None => None,
    })
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

fn format_active_next_set_side_response(side: &str) -> ActiveWorkoutNextSetSideResponse {
    match side {
        "LEFT" => ActiveWorkoutNextSetSideResponse::Left,
        "RIGHT" => ActiveWorkoutNextSetSideResponse::Right,
        _ => ActiveWorkoutNextSetSideResponse::Bilateral,
    }
}

fn active_set_repetition_kind_response(
    kind: Option<&str>,
) -> Result<Option<ActiveWorkoutSetRepetitionKindResponse>, EnumTranslationError> {
    Ok(match repetition_kind_optional(kind)? {
        Some(RepetitionKind::Secs) => Some(ActiveWorkoutSetRepetitionKindResponse::Secs),
        Some(RepetitionKind::Reps) => Some(ActiveWorkoutSetRepetitionKindResponse::Reps),
        None => None,
    })
}

fn completed_set_repetition_kind_response(
    kind: Option<&str>,
) -> Result<Option<CompletedActiveWorkoutSetRepetitionKindResponse>, EnumTranslationError> {
    Ok(match repetition_kind_optional(kind)? {
        Some(RepetitionKind::Secs) => Some(CompletedActiveWorkoutSetRepetitionKindResponse::Secs),
        Some(RepetitionKind::Reps) => Some(CompletedActiveWorkoutSetRepetitionKindResponse::Reps),
        None => None,
    })
}

pub fn workout_summary_response(summary: DomainWorkoutSummary) -> WorkoutSummaryResponse {
    let classification = classify_average(summary.workout_progress);
    let workout_progress = if classification.is_available() {
        Some(summary.workout_progress)
    } else {
        Some(None)
    };
    let workout_progress_status =
        workout_summary_progress_status_from_availability(classification.availability);

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

pub fn workout_detail_response(
    detail: DomainWorkoutDetail,
) -> Result<WorkoutDetailResponse, EnumTranslationError> {
    let classification = classify_average(detail.completion_stats.workout_progress);
    let workout_progress = if classification.is_available() {
        detail.completion_stats.workout_progress
    } else {
        None
    };
    let workout_progress_status =
        workout_detail_progress_status_from_availability(classification.availability);

    Ok(WorkoutDetailResponse {
        id: detail.id,
        hero: Box::new(WorkoutDetailHeroResponse {
            training_plan_name: detail.hero.training_plan_name,
            started_at: detail.hero.started_at,
            completed_at: detail.hero.completed_at,
            duration_minutes: detail.hero.duration_minutes,
            gym_name: detail.hero.gym_name,
        }),
        completion_stats: Box::new(
            crate::models::workout_detail_completion_stats::WorkoutDetailCompletionStats {
                exercise_count: detail.completion_stats.exercise_count,
                completed_set_count: detail.completion_stats.completed_set_count,
                average_duration_minutes: detail.completion_stats.average_duration_minutes,
                workout_progress,
                workout_progress_status,
            },
        ),
        exercises: detail
            .exercises
            .into_iter()
            .map(workout_detail_exercise_response)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn workout_detail_exercise_response(
    exercise: DomainWorkoutDetailExercise,
) -> Result<crate::models::workout_detail_exercise::WorkoutDetailExercise, EnumTranslationError> {
    Ok(
        crate::models::workout_detail_exercise::WorkoutDetailExercise {
            training_plan_exercise_id: exercise.training_plan_exercise_id,
            exercise_position: exercise.exercise_position,
            exercise_name: exercise.exercise_name,
            variant_id: Some(exercise.variant_id),
            variant_name: Some(exercise.variant_name),
            station_name: Some(exercise.station_name),
            set_tracking_mode: Some(
                exercise
                    .set_tracking_mode
                    .as_deref()
                    .map(workout_detail_set_tracking_mode_response)
                    .transpose()?,
            ),
            repetition_kind: Some(
                exercise
                    .repetition_kind
                    .as_deref()
                    .map(workout_detail_exercise_repetition_kind_response)
                    .transpose()?,
            ),
            sets: exercise
                .sets
                .into_iter()
                .map(workout_detail_set_line_response)
                .collect::<Result<Vec<_>, _>>()?,
        },
    )
}

fn workout_detail_set_line_response(
    set: DomainWorkoutDetailSetLine,
) -> Result<crate::models::workout_detail_set_line::WorkoutDetailSetLine, EnumTranslationError> {
    Ok(
        crate::models::workout_detail_set_line::WorkoutDetailSetLine {
            set_index: set.set_index,
            set_side: parse_workout_detail_set_side_response(&set.set_side),
            load_value: Some(set.load_value),
            repetition_kind: Some(
                set.repetition_kind
                    .as_deref()
                    .map(workout_detail_set_repetition_kind_response)
                    .transpose()?,
            ),
            repetition_value: Some(set.repetition_value),
        },
    )
}

fn workout_detail_set_tracking_mode_response(
    mode: &str,
) -> Result<WorkoutDetailExerciseSetTrackingModeResponse, EnumTranslationError> {
    Ok(match set_tracking_mode(mode)? {
        SetTrackingMode::Bilateral => WorkoutDetailExerciseSetTrackingModeResponse::Bilateral,
        SetTrackingMode::Unilateral => WorkoutDetailExerciseSetTrackingModeResponse::Unilateral,
    })
}

fn workout_detail_exercise_repetition_kind_response(
    kind: &str,
) -> Result<WorkoutDetailExerciseRepetitionKindResponse, EnumTranslationError> {
    Ok(match repetition_kind(kind)? {
        RepetitionKind::Secs => WorkoutDetailExerciseRepetitionKindResponse::Secs,
        RepetitionKind::Reps => WorkoutDetailExerciseRepetitionKindResponse::Reps,
    })
}

fn workout_detail_set_repetition_kind_response(
    kind: &str,
) -> Result<WorkoutDetailSetLineRepetitionKindResponse, EnumTranslationError> {
    Ok(match repetition_kind(kind)? {
        RepetitionKind::Secs => WorkoutDetailSetLineRepetitionKindResponse::Secs,
        RepetitionKind::Reps => WorkoutDetailSetLineRepetitionKindResponse::Reps,
    })
}

fn parse_workout_detail_set_side_response(side: &str) -> WorkoutDetailSetSideResponse {
    match side {
        "LEFT" => WorkoutDetailSetSideResponse::Left,
        "RIGHT" => WorkoutDetailSetSideResponse::Right,
        _ => WorkoutDetailSetSideResponse::Bilateral,
    }
}

pub fn workout_history_response(
    summary: DomainWorkoutHistorySummary,
) -> WorkoutHistorySummaryResponse {
    WorkoutHistorySummaryResponse {
        id: summary.id,
        training_plan_name: summary.training_plan_name,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
        gym_name: summary.gym_name,
        duration_minutes: summary.duration_minutes,
    }
}

pub fn workout_history_list_response(
    summaries: Vec<DomainWorkoutHistorySummary>,
) -> WorkoutHistoryListResponse {
    summaries
        .into_iter()
        .map(workout_history_response)
        .collect()
}

fn workout_progress_tone(progress: Option<f64>) -> WorkoutProgressTone {
    match classify_average(progress).tone {
        PerformanceToneCategory::Green => WorkoutProgressTone::Green,
        PerformanceToneCategory::Yellow => WorkoutProgressTone::Yellow,
        PerformanceToneCategory::Red => WorkoutProgressTone::Red,
        PerformanceToneCategory::Gray => WorkoutProgressTone::Gray,
    }
}

pub fn workout_progress_entry_response(
    entry: DomainWorkoutProgressEntry,
) -> WorkoutProgressEntryResponse {
    let classification = classify_average(entry.workout_progress);
    let workout_progress = if classification.is_available() {
        entry.workout_progress
    } else {
        None
    };
    let workout_progress_status =
        workout_progress_status_response_from_availability(classification.availability);

    WorkoutProgressEntryResponse {
        id: entry.id,
        training_plan_name: entry.training_plan_name,
        completed_at: entry.completed_at,
        workout_progress,
        workout_progress_status,
        progress_tone: workout_progress_tone(workout_progress),
    }
}

fn workout_summary_progress_status_from_availability(
    availability: PerformanceAvailability,
) -> WorkoutProgressStatus {
    match availability {
        PerformanceAvailability::Available => WorkoutProgressStatus::Available,
        PerformanceAvailability::NotEnoughData => WorkoutProgressStatus::NotEnoughData,
    }
}

fn workout_detail_progress_status_from_availability(
    availability: PerformanceAvailability,
) -> WorkoutDetailProgressStatus {
    match availability {
        PerformanceAvailability::Available => WorkoutDetailProgressStatus::Available,
        PerformanceAvailability::NotEnoughData => WorkoutDetailProgressStatus::NotEnoughData,
    }
}

fn workout_progress_status_response_from_availability(
    availability: PerformanceAvailability,
) -> WorkoutProgressStatusResponse {
    match availability {
        PerformanceAvailability::Available => WorkoutProgressStatusResponse::Available,
        PerformanceAvailability::NotEnoughData => WorkoutProgressStatusResponse::NotEnoughData,
    }
}

pub fn workout_progress_response(
    entries: Vec<DomainWorkoutProgressEntry>,
) -> WorkoutProgressResponse {
    WorkoutProgressResponse {
        workouts: entries
            .into_iter()
            .map(workout_progress_entry_response)
            .collect(),
    }
}

fn workout_exercises_performance_status_response(
    status: &str,
) -> Result<WorkoutExercisesPerformanceStatus, EnumTranslationError> {
    match status {
        "AVAILABLE" => Ok(WorkoutExercisesPerformanceStatus::Available),
        "NOT_ENOUGH_DATA" => Ok(WorkoutExercisesPerformanceStatus::NotEnoughData),
        value => Err(EnumTranslationError {
            field: "workout_exercises_performance_status",
            value: value.to_owned(),
        }),
    }
}

fn workout_exercises_performance_tone_response(
    tone: &str,
) -> Result<WorkoutExercisesPerformanceTone, EnumTranslationError> {
    match tone {
        "GREEN" => Ok(WorkoutExercisesPerformanceTone::Green),
        "YELLOW" => Ok(WorkoutExercisesPerformanceTone::Yellow),
        "RED" => Ok(WorkoutExercisesPerformanceTone::Red),
        "GRAY" => Ok(WorkoutExercisesPerformanceTone::Gray),
        value => Err(EnumTranslationError {
            field: "workout_exercises_performance_tone",
            value: value.to_owned(),
        }),
    }
}

fn workout_exercises_group_tone_response(
    tone: &str,
) -> Result<WorkoutExercisesPerformanceGroupTone, EnumTranslationError> {
    match tone {
        "GREEN" => Ok(WorkoutExercisesPerformanceGroupTone::Green),
        "YELLOW" => Ok(WorkoutExercisesPerformanceGroupTone::Yellow),
        "RED" => Ok(WorkoutExercisesPerformanceGroupTone::Red),
        "GRAY" => Ok(WorkoutExercisesPerformanceGroupTone::Gray),
        value => Err(EnumTranslationError {
            field: "workout_exercises_performance_group_tone",
            value: value.to_owned(),
        }),
    }
}

fn ensure_workout_exercises_group_row_tone_alignment(
    group_tone: &str,
    row_tone: &str,
) -> Result<(), EnumTranslationError> {
    if group_tone == row_tone {
        Ok(())
    } else {
        Err(EnumTranslationError {
            field: "workout_exercises_performance_group_row_tone_alignment",
            value: format!("group={group_tone},row={row_tone}"),
        })
    }
}

fn workout_exercises_strength_family_response(
    value: &str,
) -> Result<WorkoutExercisesStrengthFamily, EnumTranslationError> {
    match value {
        "kg" => Ok(WorkoutExercisesStrengthFamily::Kg),
        "reps" => Ok(WorkoutExercisesStrengthFamily::Reps),
        "time" => Ok(WorkoutExercisesStrengthFamily::Time),
        other => Err(EnumTranslationError {
            field: "workout_exercises_strength_family",
            value: other.to_owned(),
        }),
    }
}

fn workout_exercises_strength_station_mode_response(
    value: &str,
) -> Result<WorkoutExercisesStrengthStationMode, EnumTranslationError> {
    match value {
        "primary" => Ok(WorkoutExercisesStrengthStationMode::Primary),
        "all" => Ok(WorkoutExercisesStrengthStationMode::All),
        other => Err(EnumTranslationError {
            field: "workout_exercises_strength_station_mode",
            value: other.to_owned(),
        }),
    }
}

fn workout_exercises_personal_records_metric_family_response(
    value: &str,
) -> Result<WorkoutExercisesPersonalRecordsMetricFamily, EnumTranslationError> {
    match value {
        "load_x_reps" => Ok(WorkoutExercisesPersonalRecordsMetricFamily::LoadXReps),
        "load_x_seconds" => Ok(WorkoutExercisesPersonalRecordsMetricFamily::LoadXSeconds),
        "reps_only" => Ok(WorkoutExercisesPersonalRecordsMetricFamily::RepsOnly),
        "seconds_only" => Ok(WorkoutExercisesPersonalRecordsMetricFamily::SecondsOnly),
        other => Err(EnumTranslationError {
            field: "workout_exercises_personal_records_metric_family",
            value: other.to_owned(),
        }),
    }
}

fn workout_exercises_score_trend_response(
    source: Option<crate::domain::WorkoutExercisesScoreTrend30d>,
) -> Option<Box<WorkoutExercisesScoreTrend30dResponse>> {
    source.map(|trend| {
        Box::new(WorkoutExercisesScoreTrend30dResponse {
            entries: trend
                .entries
                .into_iter()
                .map(|entry| WorkoutExercisesScoreTrendPointResponse {
                    occurred_at: entry.occurred_at,
                    score: entry.score,
                })
                .collect(),
        })
    })
}

fn workout_exercises_strength_progression_response(
    source: Option<crate::domain::WorkoutExercisesStrengthProgression12m>,
) -> Result<Option<Box<WorkoutExercisesStrengthProgression12mResponse>>, EnumTranslationError> {
    let Some(source) = source else {
        return Ok(None);
    };

    let metric_modes = source
        .metric_modes
        .into_iter()
        .map(|mode| {
            Ok(WorkoutExercisesStrengthMetricModeResponse {
                id: mode.id,
                label: mode.label,
                family: workout_exercises_strength_family_response(&mode.family)?,
                station_modes: mode
                    .station_modes
                    .into_iter()
                    .map(|station_mode| {
                        workout_exercises_strength_station_mode_response(station_mode.as_str())
                    })
                    .collect::<Result<Vec<_>, _>>()?,
                points: mode
                    .points
                    .into_iter()
                    .map(|point| WorkoutExercisesStrengthPointResponse {
                        occurred_at: point.occurred_at,
                        value: point.value,
                        station_id: Some(point.station_id),
                        station_label: point.station_label.map(Some),
                        is_primary_station: point.is_primary_station.map(Some),
                    })
                    .collect(),
            })
        })
        .collect::<Result<Vec<_>, EnumTranslationError>>()?;

    Ok(Some(Box::new(
        WorkoutExercisesStrengthProgression12mResponse { metric_modes },
    )))
}

fn workout_exercises_personal_records_response(
    source: Option<crate::domain::WorkoutExercisesPersonalRecords12m>,
) -> Result<Option<Box<WorkoutExercisesPersonalRecords12mResponse>>, EnumTranslationError> {
    let Some(source) = source else {
        return Ok(None);
    };

    Ok(Some(Box::new(WorkoutExercisesPersonalRecords12mResponse {
        metric_family: workout_exercises_personal_records_metric_family_response(
            source.metric_family.as_str(),
        )?,
        entries: source
            .entries
            .into_iter()
            .map(|entry| WorkoutExercisesPersonalRecordEntryResponse {
                occurred_at: entry.occurred_at,
                load_kg: Some(entry.load_kg),
                reps: Some(entry.reps),
                seconds: Some(entry.seconds),
            })
            .collect(),
    })))
}

pub fn workout_exercises_performance_row_response(
    row: DomainWorkoutExercisesPerformanceRow,
) -> Result<WorkoutExercisesPerformanceRowResponse, EnumTranslationError> {
    Ok(WorkoutExercisesPerformanceRowResponse {
        variant_id: row.variant_id,
        exercise_name: row.exercise_name,
        variant_name: row.variant_name,
        last_performed_at: row.last_performed_at,
        last_performed_days_ago: row.last_performed_days_ago,
        last_performed_first_set_display: row.last_performed_first_set_display,
        selected_station_average_score_30d: row.selected_station_average_score_30d,
        variant_session_count_30d: row.variant_session_count_30d,
        performance_status: workout_exercises_performance_status_response(&row.performance_status)?,
        performance_tone: workout_exercises_performance_tone_response(&row.performance_tone)?,
        score_trend_30d: workout_exercises_score_trend_response(row.score_trend_30d),
        strength_progression_12m: workout_exercises_strength_progression_response(
            row.strength_progression_12m,
        )?,
        personal_records_12m: workout_exercises_personal_records_response(
            row.personal_records_12m,
        )?,
    })
}

pub fn workout_exercises_performance_group_response(
    group: DomainWorkoutExercisesPerformanceGroup,
) -> Result<WorkoutExercisesPerformanceGroupResponse, EnumTranslationError> {
    let group_tone = group.tone.clone();
    Ok(WorkoutExercisesPerformanceGroupResponse {
        tone: workout_exercises_group_tone_response(&group_tone)?,
        rows: group
            .rows
            .into_iter()
            .map(|row| {
                ensure_workout_exercises_group_row_tone_alignment(
                    &group_tone,
                    &row.performance_tone,
                )?;
                workout_exercises_performance_row_response(row)
            })
            .collect::<Result<Vec<_>, _>>()?,
    })
}

pub fn workout_exercises_performance_response(
    groups: Vec<DomainWorkoutExercisesPerformanceGroup>,
) -> Result<WorkoutExercisesPerformanceResponse, EnumTranslationError> {
    Ok(WorkoutExercisesPerformanceResponse {
        groups: groups
            .into_iter()
            .map(workout_exercises_performance_group_response)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        active_workout_response, empty_string_to_none, validate_confirmed_position,
        validate_create_set_input, workout_detail_response, workout_exercises_performance_response,
        workout_progress_entry_response, ActiveWorkoutExerciseInput, CompleteActiveWorkoutRequest,
        CreateActiveWorkoutRequest, CreateWorkoutExerciseInput, CreateWorkoutRequest,
        CreateWorkoutSetInput, UpdateActiveWorkoutRequest,
    };
    use crate::api::error::ApiError;
    use crate::domain::{
        ActiveWorkout as DomainActiveWorkout, ActiveWorkoutExercise as DomainActiveWorkoutExercise,
        ActiveWorkoutSet as DomainActiveWorkoutSet, WorkoutDetail as DomainWorkoutDetail,
        WorkoutDetailCompletionStats as DomainWorkoutDetailCompletionStats,
        WorkoutDetailExercise as DomainWorkoutDetailExercise,
        WorkoutDetailHero as DomainWorkoutDetailHero,
        WorkoutDetailSetLine as DomainWorkoutDetailSetLine,
        WorkoutExercisesPerformanceGroup as DomainWorkoutExercisesPerformanceGroup,
        WorkoutExercisesPerformanceRow as DomainWorkoutExercisesPerformanceRow,
        WorkoutProgressEntry as DomainWorkoutProgressEntry,
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
    fn active_workout_request_trims_optional_ids_without_flattening_child_completion_times() {
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
        assert_eq!(workout.exercises[0].sets[0].completed_at.as_deref(), None);
        assert_eq!(workout.exercises[0].completed_at.as_deref(), None);
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
    fn create_active_workout_request_allows_free_mode_start_without_sets_or_selection() {
        let request = CreateActiveWorkoutRequest {
            gym_id: None,
            exercises: vec![ActiveWorkoutExerciseInput {
                selected_training_plan_exercise_variant_id: None,
                selected_variant_id: None,
                selected_station_id: None,
                completed_sets: Vec::new(),
                ..sample_active_exercise(1)
            }],
            ..sample_create_active_workout_request()
        };

        let workout = request
            .validate_and_into_domain()
            .expect("free-mode start snapshot should validate");

        assert_eq!(workout.gym_id, None);
        assert!(workout.exercises[0].sets.is_empty());
        assert_eq!(
            workout.exercises[0]
                .selected_training_plan_exercise_variant_id
                .as_deref(),
            None
        );
        assert_eq!(workout.exercises[0].selected_variant_id.as_deref(), None);
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
                    repetition_value: Some(8),
                },
                next_set: crate::domain::ActiveWorkoutNextSetHint {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                },
            }],
        })
        .expect("response mapping should succeed");

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
                    repetition_value: Some(12),
                },
                next_set: crate::domain::ActiveWorkoutNextSetHint {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                },
            }],
        })
        .expect("response mapping should succeed");

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

    #[test]
    fn workout_detail_response_always_sets_workout_progress_field_when_unavailable() {
        let response = workout_detail_response(DomainWorkoutDetail {
            id: "workout-id".to_owned(),
            hero: DomainWorkoutDetailHero {
                training_plan_name: "Plan".to_owned(),
                started_at: Some("2026-02-10T09:00:00Z".to_owned()),
                completed_at: Some("2026-02-10T09:30:00Z".to_owned()),
                duration_minutes: Some(30),
                gym_name: Some("Gym".to_owned()),
            },
            completion_stats: DomainWorkoutDetailCompletionStats {
                exercise_count: 4,
                completed_set_count: 12,
                average_duration_minutes: Some(32),
                workout_progress: None,
            },
            exercises: Vec::new(),
        })
        .expect("response mapping should succeed");

        assert_eq!(response.completion_stats.workout_progress, None);
        assert_eq!(
            response.completion_stats.workout_progress_status,
            super::WorkoutDetailProgressStatus::NotEnoughData
        );
    }

    #[test]
    fn workout_detail_response_sets_workout_progress_when_available() {
        let response = workout_detail_response(DomainWorkoutDetail {
            id: "workout-id".to_owned(),
            hero: DomainWorkoutDetailHero {
                training_plan_name: "Plan".to_owned(),
                started_at: Some("2026-02-10T09:00:00Z".to_owned()),
                completed_at: Some("2026-02-10T09:30:00Z".to_owned()),
                duration_minutes: Some(30),
                gym_name: Some("Gym".to_owned()),
            },
            completion_stats: DomainWorkoutDetailCompletionStats {
                exercise_count: 4,
                completed_set_count: 12,
                average_duration_minutes: Some(32),
                workout_progress: Some(0.78),
            },
            exercises: Vec::new(),
        })
        .expect("response mapping should succeed");

        assert_eq!(response.completion_stats.workout_progress, Some(0.78));
        assert_eq!(
            response.completion_stats.workout_progress_status,
            super::WorkoutDetailProgressStatus::Available
        );
    }

    #[test]
    fn workout_progress_entry_response_uses_shared_tone_boundaries() {
        let gray = workout_progress_entry_response(DomainWorkoutProgressEntry {
            id: "w-gray".to_owned(),
            training_plan_name: "Plan".to_owned(),
            completed_at: "2026-02-10T09:00:00Z".to_owned(),
            workout_progress: None,
        });
        let red = workout_progress_entry_response(DomainWorkoutProgressEntry {
            id: "w-red".to_owned(),
            training_plan_name: "Plan".to_owned(),
            completed_at: "2026-02-10T09:00:00Z".to_owned(),
            workout_progress: Some(0.94),
        });
        let yellow_lower = workout_progress_entry_response(DomainWorkoutProgressEntry {
            id: "w-yellow-low".to_owned(),
            training_plan_name: "Plan".to_owned(),
            completed_at: "2026-02-10T09:00:00Z".to_owned(),
            workout_progress: Some(0.95),
        });
        let yellow_upper = workout_progress_entry_response(DomainWorkoutProgressEntry {
            id: "w-yellow-high".to_owned(),
            training_plan_name: "Plan".to_owned(),
            completed_at: "2026-02-10T09:00:00Z".to_owned(),
            workout_progress: Some(1.03),
        });
        let green = workout_progress_entry_response(DomainWorkoutProgressEntry {
            id: "w-green".to_owned(),
            training_plan_name: "Plan".to_owned(),
            completed_at: "2026-02-10T09:00:00Z".to_owned(),
            workout_progress: Some(1.04),
        });

        assert_eq!(gray.progress_tone, super::WorkoutProgressTone::Gray);
        assert_eq!(red.progress_tone, super::WorkoutProgressTone::Red);
        assert_eq!(
            yellow_lower.progress_tone,
            super::WorkoutProgressTone::Yellow
        );
        assert_eq!(
            yellow_upper.progress_tone,
            super::WorkoutProgressTone::Yellow
        );
        assert_eq!(green.progress_tone, super::WorkoutProgressTone::Green);
    }

    #[test]
    fn workout_detail_response_maps_mixed_set_formats_and_nullable_fields() {
        let response = workout_detail_response(DomainWorkoutDetail {
            id: "workout-mixed".to_owned(),
            hero: DomainWorkoutDetailHero {
                training_plan_name: "Plan".to_owned(),
                started_at: Some("2026-02-10T09:00:00Z".to_owned()),
                completed_at: Some("2026-02-10T09:30:00Z".to_owned()),
                duration_minutes: Some(30),
                gym_name: Some("Gym".to_owned()),
            },
            completion_stats: DomainWorkoutDetailCompletionStats {
                exercise_count: 2,
                completed_set_count: 3,
                average_duration_minutes: Some(32),
                workout_progress: Some(0.78),
            },
            exercises: vec![
                DomainWorkoutDetailExercise {
                    training_plan_exercise_id: "exercise-1".to_owned(),
                    exercise_position: 2,
                    exercise_name: "Split Squat".to_owned(),
                    variant_id: Some("20000000-0000-0000-0000-000000000001".to_owned()),
                    variant_name: Some("Dumbbell".to_owned()),
                    station_name: Some("Rack 2".to_owned()),
                    set_tracking_mode: Some("UNILATERAL".to_owned()),
                    repetition_kind: Some("REPS".to_owned()),
                    sets: vec![
                        DomainWorkoutDetailSetLine {
                            set_index: 1,
                            set_side: "LEFT".to_owned(),
                            load_value: Some(18.0),
                            repetition_kind: Some("REPS".to_owned()),
                            repetition_value: Some(10),
                        },
                        DomainWorkoutDetailSetLine {
                            set_index: 1,
                            set_side: "RIGHT".to_owned(),
                            load_value: Some(18.0),
                            repetition_kind: Some("REPS".to_owned()),
                            repetition_value: Some(9),
                        },
                    ],
                },
                DomainWorkoutDetailExercise {
                    training_plan_exercise_id: "exercise-2".to_owned(),
                    exercise_position: 1,
                    exercise_name: "Plank".to_owned(),
                    variant_id: None,
                    variant_name: None,
                    station_name: None,
                    set_tracking_mode: Some("BILATERAL".to_owned()),
                    repetition_kind: Some("SECS".to_owned()),
                    sets: vec![DomainWorkoutDetailSetLine {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        load_value: None,
                        repetition_kind: Some("SECS".to_owned()),
                        repetition_value: Some(45),
                    }],
                },
            ],
        })
        .expect("response mapping should succeed");

        let unilateral = &response.exercises[0];
        assert_eq!(
            unilateral.set_tracking_mode,
            Some(Some(
                super::WorkoutDetailExerciseSetTrackingModeResponse::Unilateral
            ))
        );
        assert_eq!(
            unilateral.variant_id,
            Some(Some("20000000-0000-0000-0000-000000000001".to_owned()))
        );
        assert_eq!(
            unilateral.repetition_kind,
            Some(Some(
                super::WorkoutDetailExerciseRepetitionKindResponse::Reps
            ))
        );
        assert_eq!(
            unilateral.sets[0].set_side,
            super::WorkoutDetailSetSideResponse::Left
        );
        assert_eq!(
            unilateral.sets[1].set_side,
            super::WorkoutDetailSetSideResponse::Right
        );
        assert_eq!(
            unilateral.sets[0].repetition_kind,
            Some(Some(
                super::WorkoutDetailSetLineRepetitionKindResponse::Reps
            ))
        );
        assert_eq!(unilateral.sets[0].repetition_value, Some(Some(10)));
        assert_eq!(unilateral.sets[0].load_value, Some(Some(18.0)));

        let timed = &response.exercises[1];
        assert_eq!(timed.variant_id, Some(None));
        assert_eq!(timed.variant_name, Some(None));
        assert_eq!(timed.station_name, Some(None));
        assert_eq!(
            timed.set_tracking_mode,
            Some(Some(
                super::WorkoutDetailExerciseSetTrackingModeResponse::Bilateral
            ))
        );
        assert_eq!(
            timed.repetition_kind,
            Some(Some(
                super::WorkoutDetailExerciseRepetitionKindResponse::Secs
            ))
        );
        assert_eq!(
            timed.sets[0].set_side,
            super::WorkoutDetailSetSideResponse::Bilateral
        );
        assert_eq!(
            timed.sets[0].repetition_kind,
            Some(Some(
                super::WorkoutDetailSetLineRepetitionKindResponse::Secs
            ))
        );
        assert_eq!(timed.sets[0].repetition_value, Some(Some(45)));
        assert_eq!(timed.sets[0].load_value, Some(None));
    }

    #[test]
    fn active_workout_response_rejects_unknown_load_input_mode() {
        let error = active_workout_response(DomainActiveWorkout {
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
                repetition_kind: Some("REPS".to_owned()),
                load_input_mode: Some("ONE_SIDE".to_owned()),
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
                    repetition_value: Some(12),
                },
                next_set: crate::domain::ActiveWorkoutNextSetHint {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                },
            }],
        })
        .expect_err("response mapping must fail");

        assert_eq!(error.field, "load_input_mode");
        assert_eq!(error.value, "ONE_SIDE");
    }

    #[test]
    fn workout_detail_response_rejects_unknown_set_tracking_mode() {
        let error = workout_detail_response(DomainWorkoutDetail {
            id: "workout-id".to_owned(),
            hero: DomainWorkoutDetailHero {
                training_plan_name: "Plan".to_owned(),
                started_at: Some("2026-02-10T09:00:00Z".to_owned()),
                completed_at: Some("2026-02-10T09:30:00Z".to_owned()),
                duration_minutes: Some(30),
                gym_name: Some("Gym".to_owned()),
            },
            completion_stats: DomainWorkoutDetailCompletionStats {
                exercise_count: 1,
                completed_set_count: 1,
                average_duration_minutes: Some(32),
                workout_progress: Some(1.0),
            },
            exercises: vec![DomainWorkoutDetailExercise {
                training_plan_exercise_id: "exercise-1".to_owned(),
                exercise_position: 1,
                exercise_name: "Split Squat".to_owned(),
                variant_id: Some("20000000-0000-0000-0000-000000000001".to_owned()),
                variant_name: Some("Dumbbell".to_owned()),
                station_name: Some("Rack 2".to_owned()),
                set_tracking_mode: Some("ALTERNATING".to_owned()),
                repetition_kind: Some("REPS".to_owned()),
                sets: vec![DomainWorkoutDetailSetLine {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    load_value: Some(18.0),
                    repetition_kind: Some("REPS".to_owned()),
                    repetition_value: Some(10),
                }],
            }],
        })
        .expect_err("response mapping must fail");

        assert_eq!(error.field, "set_tracking_mode");
        assert_eq!(error.value, "ALTERNATING");
    }

    #[test]
    fn workout_exercises_performance_response_accepts_matching_group_and_row_tones() {
        let response =
            workout_exercises_performance_response(vec![DomainWorkoutExercisesPerformanceGroup {
                tone: "GREEN".to_owned(),
                rows: vec![DomainWorkoutExercisesPerformanceRow {
                    variant_id: "20000000-0000-0000-0000-000000000001".to_owned(),
                    exercise_name: "Row".to_owned(),
                    variant_name: "Cable Row".to_owned(),
                    last_performed_at: "2026-04-20T10:30:00Z".to_owned(),
                    last_performed_days_ago: 2,
                    last_performed_first_set_display: "40 kg x 10 reps".to_owned(),
                    selected_station_average_score_30d: Some(1.05),
                    variant_session_count_30d: 4,
                    performance_status: "AVAILABLE".to_owned(),
                    performance_tone: "GREEN".to_owned(),
                    score_trend_30d: None,
                    strength_progression_12m: None,
                    personal_records_12m: None,
                }],
            }])
            .expect("matching tones should map");

        assert_eq!(response.groups.len(), 1);
        assert_eq!(response.groups[0].rows.len(), 1);
        assert_eq!(response.groups[0].rows[0].variant_session_count_30d, 4);
    }

    #[test]
    fn workout_exercises_performance_response_rejects_mismatched_group_and_row_tones() {
        let error =
            workout_exercises_performance_response(vec![DomainWorkoutExercisesPerformanceGroup {
                tone: "GREEN".to_owned(),
                rows: vec![DomainWorkoutExercisesPerformanceRow {
                    variant_id: "20000000-0000-0000-0000-000000000001".to_owned(),
                    exercise_name: "Row".to_owned(),
                    variant_name: "Cable Row".to_owned(),
                    last_performed_at: "2026-04-20T10:30:00Z".to_owned(),
                    last_performed_days_ago: 2,
                    last_performed_first_set_display: "40 kg x 10 reps".to_owned(),
                    selected_station_average_score_30d: Some(1.01),
                    variant_session_count_30d: 3,
                    performance_status: "AVAILABLE".to_owned(),
                    performance_tone: "YELLOW".to_owned(),
                    score_trend_30d: None,
                    strength_progression_12m: None,
                    personal_records_12m: None,
                }],
            }])
            .expect_err("mismatched row/group tones must fail");

        assert_eq!(
            error.field,
            "workout_exercises_performance_group_row_tone_alignment"
        );
        assert_eq!(error.value, "group=GREEN,row=YELLOW");
    }
}
