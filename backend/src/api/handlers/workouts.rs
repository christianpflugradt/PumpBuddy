use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use crate::application::workouts::{
    validate_active_workout, validate_active_workout_start, validate_exercises_match_training_plan,
    validate_fallback_selection_lock, MissingExerciseRealizability, WorkoutValidationError,
};

use crate::api::error::{ErrorDetails, MissingExerciseDetail};
use crate::api::models::{
    active_workout_response, workout_summary_response, ActiveWorkoutResponse,
    CreateActiveWorkoutRequest, CreateWorkoutRequest, UpdateActiveWorkoutRequest,
    WorkoutSummaryResponse,
};
use crate::api::AppState;
use crate::api::{map_persistence_error, ApiError};

fn missing_exercise_detail(
    missing_exercise: MissingExerciseRealizability,
) -> MissingExerciseDetail {
    MissingExerciseDetail {
        training_plan_exercise_id: missing_exercise.training_plan_exercise_id,
        exercise_name: missing_exercise.exercise_name,
        exercise_position: missing_exercise.exercise_position,
        reason: missing_exercise.reason,
    }
}

fn map_workout_validation_error(error: WorkoutValidationError) -> ApiError {
    match error {
        WorkoutValidationError::Validation(message) => ApiError::Validation(message),
        WorkoutValidationError::ConfiguredGymStartBlocked {
            message,
            missing_exercises,
        } => ApiError::ValidationWithDetails {
            message,
            details: ErrorDetails {
                missing_exercises: missing_exercises
                    .into_iter()
                    .map(missing_exercise_detail)
                    .collect(),
            },
        },
        WorkoutValidationError::Persistence(error) => map_persistence_error(error),
    }
}

fn session_user_id(session: &crate::persistence::AuthenticatedSession) -> String {
    session.user_id.clone()
}

pub(crate) async fn get_workout_summary(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(workout_id): Path<String>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    let session = session_user_id(&session);
    let maybe_summary = state
        .repository
        .fetch_workout_summary_for_user(&workout_id, &session)
        .await
        .map_err(|_| ApiError::Internal)?;

    let summary =
        maybe_summary.ok_or_else(|| ApiError::NotFound("Workout not found".to_owned()))?;

    Ok(Json(workout_summary_response(summary)))
}

pub(crate) async fn create_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Json(payload): Json<CreateWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_exercises_match_training_plan(&state.repository, &new_workout)
        .await
        .map_err(map_workout_validation_error)?;

    let session = session_user_id(&session);
    let created = state
        .repository
        .create_workout_for_user(&new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    let summary = state
        .repository
        .fetch_workout_summary_for_user(&created.id, &session)
        .await
        .map_err(map_persistence_error)?
        .ok_or(ApiError::Internal)?;

    Ok((StatusCode::CREATED, Json(workout_summary_response(summary))))
}

pub(crate) async fn get_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let session = session_user_id(&session);
    let workout = state
        .repository
        .fetch_first_active_workout_for_user(&session)
        .await
        .map_err(map_persistence_error)?
        .ok_or_else(|| ApiError::NotFound("No active workout found".to_owned()))?;

    Ok(Json(active_workout_response(workout)))
}

pub(crate) async fn create_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Json(payload): Json<CreateActiveWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout_start(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await
    .map_err(|err| {
        // Log validation errors to aid debugging in test runs.
        // This is intentionally a stderr trace and does not change behavior.
        match &err {
            WorkoutValidationError::Validation(msg) => {
                eprintln!("validate_active_workout validation failed: {}", msg);
            }
            WorkoutValidationError::ConfiguredGymStartBlocked {
                message,
                missing_exercises,
            } => {
                eprintln!(
                    "validate_active_workout configured-gym start blocked: {} (missing={})",
                    message,
                    missing_exercises.len()
                );
            }
            WorkoutValidationError::Persistence(pe) => {
                eprintln!("validate_active_workout persistence error: {:?}", pe);
            }
        }

        map_workout_validation_error(err)
    })?;

    let session = session_user_id(&session);
    let created = state
        .repository
        .create_active_workout_for_user(&new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok((StatusCode::CREATED, Json(active_workout_response(created))))
}

pub(crate) async fn update_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(workout_id): Path<String>,
    Json(payload): Json<UpdateActiveWorkoutRequest>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    let session = session_user_id(&session);

    validate_fallback_selection_lock(&state.repository, &workout_id, &session, &new_workout)
        .await
        .map_err(map_workout_validation_error)?;

    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await
    .map_err(map_workout_validation_error)?;

    let updated = state
        .repository
        .update_active_workout_for_user(&workout_id, &new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(active_workout_response(updated)))
}

pub(crate) async fn complete_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(workout_id): Path<String>,
    Json(payload): Json<crate::api::models::CompleteActiveWorkoutRequest>,
) -> Result<Json<crate::api::models::WorkoutSummaryResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    let session = session_user_id(&session);

    validate_fallback_selection_lock(&state.repository, &workout_id, &session, &new_workout)
        .await
        .map_err(map_workout_validation_error)?;

    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await
    .map_err(map_workout_validation_error)?;

    let summary = state
        .repository
        .complete_active_workout_for_user(&workout_id, &new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(workout_summary_response(summary)))
}

pub(crate) async fn cancel_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(workout_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let session = session_user_id(&session);
    state
        .repository
        .cancel_active_workout_for_user(&workout_id, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok(StatusCode::NO_CONTENT)
}
