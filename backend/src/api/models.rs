use crate::domain::{
    ActiveWorkout, ActiveWorkoutExercise, ActiveWorkoutSet, CompletedActiveWorkoutSet, NewWorkout,
    NewWorkoutExercise, NewWorkoutSet, WorkoutSummary,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use super::error::ApiError;

#[derive(Serialize)]
pub struct TrainingPlanSummaryResponse {
    pub id: String,
    pub name: String,
    pub exercise_count: i64,
}

#[derive(Serialize)]
pub struct GymSummaryResponse {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct PlanExerciseOptionSummaryResponse {
    pub id: String,
    pub training_plan_exercise_id: String,
    pub exercise_name: String,
    pub exercise_position: i32,
    pub variant_id: String,
    pub variant_name: String,
    pub variant_type: String,
    pub station_id: String,
    pub station_name: String,
}

#[derive(Serialize)]
pub struct TrainingPlanOptionsResponse {
    pub training_plan_id: String,
    pub gym_id: String,
    pub options: Vec<PlanExerciseOptionSummaryResponse>,
}

#[derive(Serialize)]
pub struct WorkoutSummaryResponse {
    pub id: String,
    pub training_plan_id: String,
    pub training_plan_name: String,
    pub gym_id: String,
    pub gym_name: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exercise_count: i64,
    pub completed_set_count: i64,
}

#[derive(Serialize)]
pub struct ActiveWorkoutResponse {
    pub workout: ActiveWorkoutDetailResponse,
}

#[derive(Serialize)]
pub struct ActiveWorkoutDetailResponse {
    pub id: String,
    pub training_plan_id: String,
    pub training_plan_name: String,
    pub gym_id: String,
    pub gym_name: String,
    pub started_at: String,
    pub updated_at: String,
    pub current_exercise_position: i32,
    pub total_exercise_count: i32,
    pub exercises: Vec<ActiveWorkoutExerciseResponse>,
}

#[derive(Serialize)]
pub struct ActiveWorkoutExerciseResponse {
    pub training_plan_exercise_id: String,
    pub position: i32,
    pub exercise_name: String,
    pub selected_plan_exercise_option_id: Option<String>,
    pub selected_variant_id: Option<String>,
    pub selected_variant_name: Option<String>,
    pub selected_station_id: Option<String>,
    pub selected_station_name: Option<String>,
    pub completed_sets: Vec<CompletedActiveWorkoutSetResponse>,
    pub suggested_set: ActiveWorkoutSetResponse,
}

#[derive(Serialize)]
pub struct CompletedActiveWorkoutSetResponse {
    pub set_index: i32,
    pub load_value: f64,
    pub reps: Option<i32>,
}

#[derive(Serialize)]
pub struct ActiveWorkoutSetResponse {
    pub load_value: f64,
    pub reps: Option<i32>,
}

#[derive(Deserialize)]
pub struct CreateWorkoutRequest {
    pub training_plan_id: String,
    pub gym_id: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exercises: Vec<CreateWorkoutExerciseInput>,
}

#[derive(Deserialize)]
pub struct CreateWorkoutExerciseInput {
    pub training_plan_exercise_id: String,
    pub position: i32,
    pub selected_plan_exercise_option_id: Option<String>,
    pub selected_variant_id: Option<String>,
    pub selected_station_id: Option<String>,
    pub set: CreateWorkoutSetInput,
}

#[derive(Clone, Deserialize)]
pub struct CreateWorkoutSetInput {
    pub load_value: f64,
    pub reps: Option<i32>,
}

#[derive(Deserialize)]
pub struct CreateActiveWorkoutRequest {
    pub training_plan_id: String,
    pub gym_id: String,
    pub started_at: String,
    pub current_exercise_position: i32,
    pub total_exercise_count: i32,
    pub exercises: Vec<ActiveWorkoutExerciseInput>,
    pub first_confirmed_exercise_position: i32,
}

#[derive(Deserialize)]
pub struct UpdateActiveWorkoutRequest {
    pub training_plan_id: String,
    pub gym_id: String,
    pub started_at: String,
    pub current_exercise_position: i32,
    pub total_exercise_count: i32,
    pub exercises: Vec<ActiveWorkoutExerciseInput>,
    pub last_confirmed_exercise_position: i32,
}

#[derive(Deserialize)]
pub struct CompleteActiveWorkoutRequest {
    pub training_plan_id: String,
    pub gym_id: String,
    pub started_at: String,
    pub completed_at: String,
    pub current_exercise_position: i32,
    pub total_exercise_count: i32,
    pub exercises: Vec<ActiveWorkoutExerciseInput>,
    pub last_confirmed_exercise_position: i32,
}

#[derive(Clone, Deserialize)]
pub struct ActiveWorkoutExerciseInput {
    pub training_plan_exercise_id: String,
    pub position: i32,
    pub selected_plan_exercise_option_id: Option<String>,
    pub selected_variant_id: Option<String>,
    pub selected_station_id: Option<String>,
    pub completed_sets: Vec<CreateWorkoutSetInput>,
}

#[derive(Deserialize)]
pub struct TrainingPlanOptionsQuery {
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

        if self.gym_id.trim().is_empty() {
            return Err(ApiError::Validation("gym_id is required".to_owned()));
        }

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

            validate_set_input(&exercise.set)?;

            exercises.push(NewWorkoutExercise {
                training_plan_exercise_id: exercise.training_plan_exercise_id,
                position: exercise.position,
                selected_variant_id: empty_string_to_none(exercise.selected_variant_id),
                selected_station_id: empty_string_to_none(exercise.selected_station_id),
                selected_plan_exercise_option_id: empty_string_to_none(
                    exercise.selected_plan_exercise_option_id,
                ),
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: exercise.set.reps,
                    load_display_value: exercise.set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: exercise.set.load_value,
                    completed_at: self.completed_at.clone(),
                }],
            });
        }

        Ok(NewWorkout {
            training_plan_id: self.training_plan_id,
            gym_id: self.gym_id,
            started_at: self.started_at,
            completed_at: self.completed_at,
            current_exercise_position: None,
            exercises,
        })
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
    fn gym_id(&self) -> &str;
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

        if self.gym_id().trim().is_empty() {
            return Err(ApiError::Validation("gym_id is required".to_owned()));
        }

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

            if exercise.completed_sets.is_empty() {
                return Err(ApiError::Validation(
                    "Active workout exercise must include at least one completed set".to_owned(),
                ));
            }

            let mut completed_sets = Vec::with_capacity(exercise.completed_sets.len());
            for (index, set) in exercise.completed_sets.iter().enumerate() {
                validate_set_input(set)?;

                completed_sets.push(NewWorkoutSet {
                    set_index: (index + 1) as i32,
                    reps: set.reps,
                    load_display_value: set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: set.load_value,
                    completed_at: completed_at.clone(),
                });
            }

            exercises.push(NewWorkoutExercise {
                training_plan_exercise_id: exercise.training_plan_exercise_id.clone(),
                position: exercise.position,
                selected_variant_id: empty_string_to_none(exercise.selected_variant_id.clone()),
                selected_station_id: empty_string_to_none(exercise.selected_station_id.clone()),
                selected_plan_exercise_option_id: empty_string_to_none(
                    exercise.selected_plan_exercise_option_id.clone(),
                ),
                sets: completed_sets,
            });
        }

        if exercises.len() as i32 > self.total_exercise_count() {
            return Err(ApiError::Validation(
                "Confirmed exercise count must not exceed total_exercise_count".to_owned(),
            ));
        }

        Ok(NewWorkout {
            training_plan_id: self.training_plan_id().to_owned(),
            gym_id: self.gym_id().to_owned(),
            started_at: Some(self.started_at().to_owned()),
            completed_at,
            current_exercise_position: Some(self.current_exercise_position()),
            exercises,
        })
    }
}

impl ActiveWorkoutPayloadValidation for CreateActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> &str {
        &self.gym_id
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

    fn gym_id(&self) -> &str {
        &self.gym_id
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

    fn gym_id(&self) -> &str {
        &self.gym_id
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

pub fn validate_set_input(set: &CreateWorkoutSetInput) -> Result<(), ApiError> {
    if !set.load_value.is_finite() || set.load_value < 0.0 {
        return Err(ApiError::Validation(
            "set.load_value must be a non-negative finite number".to_owned(),
        ));
    }

    if let Some(reps) = set.reps {
        if reps < 1 {
            return Err(ApiError::Validation(
                "set.reps must be greater than 0 when provided".to_owned(),
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

pub fn active_workout_response(workout: ActiveWorkout) -> ActiveWorkoutResponse {
    ActiveWorkoutResponse {
        workout: ActiveWorkoutDetailResponse {
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
        },
    }
}

fn active_workout_exercise_response(
    exercise: ActiveWorkoutExercise,
) -> ActiveWorkoutExerciseResponse {
    ActiveWorkoutExerciseResponse {
        training_plan_exercise_id: exercise.training_plan_exercise_id,
        position: exercise.position,
        exercise_name: exercise.exercise_name,
        selected_plan_exercise_option_id: exercise.selected_plan_exercise_option_id,
        selected_variant_id: exercise.selected_variant_id,
        selected_variant_name: exercise.selected_variant_name,
        selected_station_id: exercise.selected_station_id,
        selected_station_name: exercise.selected_station_name,
        completed_sets: exercise
            .completed_sets
            .into_iter()
            .map(active_workout_completed_set_response)
            .collect(),
        suggested_set: active_workout_set_response(exercise.suggested_set),
    }
}

fn active_workout_completed_set_response(
    set: CompletedActiveWorkoutSet,
) -> CompletedActiveWorkoutSetResponse {
    CompletedActiveWorkoutSetResponse {
        set_index: set.set_index,
        load_value: set.load_value,
        reps: set.reps,
    }
}

fn active_workout_set_response(set: ActiveWorkoutSet) -> ActiveWorkoutSetResponse {
    ActiveWorkoutSetResponse {
        load_value: set.load_value,
        reps: set.reps,
    }
}

pub fn workout_summary_response(summary: WorkoutSummary) -> WorkoutSummaryResponse {
    WorkoutSummaryResponse {
        id: summary.id,
        training_plan_id: summary.training_plan_id,
        training_plan_name: summary.training_plan_name,
        gym_id: summary.gym_id,
        gym_name: summary.gym_name,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
        exercise_count: summary.exercise_count,
        completed_set_count: summary.completed_set_count,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        empty_string_to_none, validate_confirmed_position, validate_set_input,
        ActiveWorkoutExerciseInput, CompleteActiveWorkoutRequest, CreateActiveWorkoutRequest,
        CreateWorkoutExerciseInput, CreateWorkoutRequest, CreateWorkoutSetInput,
        UpdateActiveWorkoutRequest,
    };
    use crate::api::error::ApiError;

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
            load_value: 20.0,
            reps: Some(10),
        }
    }

    fn sample_active_exercise(position: i32) -> ActiveWorkoutExerciseInput {
        ActiveWorkoutExerciseInput {
            training_plan_exercise_id: format!("exercise-{position}"),
            position,
            selected_plan_exercise_option_id: Some("  option-id  ".to_owned()),
            selected_variant_id: Some("  variant-id  ".to_owned()),
            selected_station_id: Some("  station-id  ".to_owned()),
            completed_sets: vec![sample_set_input()],
        }
    }

    fn sample_create_workout_request() -> CreateWorkoutRequest {
        CreateWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: "gym-id".to_owned(),
            started_at: Some("2026-01-20T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-20T09:20:00Z".to_owned()),
            exercises: vec![CreateWorkoutExerciseInput {
                training_plan_exercise_id: "exercise-1".to_owned(),
                position: 1,
                selected_plan_exercise_option_id: Some("  option-id  ".to_owned()),
                selected_variant_id: Some("  variant-id  ".to_owned()),
                selected_station_id: Some("  station-id  ".to_owned()),
                set: sample_set_input(),
            }],
        }
    }

    fn sample_create_active_workout_request() -> CreateActiveWorkoutRequest {
        CreateActiveWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: "gym-id".to_owned(),
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
        assert!(validate_set_input(&CreateWorkoutSetInput {
            load_value: 20.0,
            reps: None,
        })
        .is_ok());

        assert_validation_message(
            validate_set_input(&CreateWorkoutSetInput {
                load_value: f64::INFINITY,
                reps: Some(10),
            }),
            "set.load_value must be a non-negative finite number",
        );

        assert_validation_message(
            validate_set_input(&CreateWorkoutSetInput {
                load_value: 20.0,
                reps: Some(0),
            }),
            "set.reps must be greater than 0 when provided",
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
                .selected_plan_exercise_option_id
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
            selected_plan_exercise_option_id: None,
            selected_variant_id: None,
            selected_station_id: None,
            set: sample_set_input(),
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
        request.gym_id = "  ".to_owned();
        assert_domain_validation_message(request.validate_and_into_domain(), "gym_id is required");

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
        request.exercises[0].set.load_value = -1.0;
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "set.load_value must be a non-negative finite number",
        );

        let mut request = sample_create_workout_request();
        request.exercises[0].set.reps = Some(0);
        assert_domain_validation_message(
            request.validate_and_into_domain(),
            "set.reps must be greater than 0 when provided",
        );
    }

    #[test]
    fn active_workout_request_trims_optional_ids_and_sets_completion_time() {
        let request = CompleteActiveWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: "gym-id".to_owned(),
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
                .selected_plan_exercise_option_id
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
        request.started_at = Some("2026-01-20T09:00:00Z".to_owned());
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
        request.exercises[0]
            .completed_sets
            .push(CreateWorkoutSetInput {
                load_value: 22.5,
                reps: Some(8),
            });

        let workout = request
            .validate_and_into_domain()
            .expect("request should validate");

        assert_eq!(workout.exercises[0].sets.len(), 2);
        assert_eq!(workout.exercises[0].sets[0].set_index, 1);
        assert_eq!(workout.exercises[0].sets[1].set_index, 2);
        assert_eq!(workout.exercises[0].sets[1].load_display_value, 22.5);
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
        request.gym_id = " ".to_owned();
        assert_domain_validation_message(request.validate_and_into_domain(), "gym_id is required");

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
    fn update_active_workout_request_rejects_missing_completed_sets() {
        let request = UpdateActiveWorkoutRequest {
            training_plan_id: "plan-id".to_owned(),
            gym_id: "gym-id".to_owned(),
            started_at: "2026-02-10T09:00:00Z".to_owned(),
            current_exercise_position: 2,
            total_exercise_count: 5,
            exercises: vec![ActiveWorkoutExerciseInput {
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
                    "Active workout exercise must include at least one completed set"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
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
}
