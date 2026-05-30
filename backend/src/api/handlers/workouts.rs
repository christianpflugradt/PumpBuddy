use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use crate::application::workouts::{
    cancel_active_workout as cancel_active_workout_service,
    complete_active_workout as complete_active_workout_service,
    create_active_workout as create_active_workout_service,
    create_workout as create_workout_service, fetch_active_workout as fetch_active_workout_service,
    fetch_workout_detail as fetch_workout_detail_service, fetch_workout_exercises_performance,
    fetch_workout_history as fetch_workout_history_service,
    fetch_workout_progress as fetch_workout_progress_service,
    fetch_workout_summary as fetch_workout_summary_service,
    update_active_workout as update_active_workout_service, MissingExerciseRealizability,
    WorkoutValidationError,
};

use crate::api::boundary::EnumTranslationError;
use crate::api::error::{ErrorDetails, MissingExerciseDetail};
use crate::api::models::{
    active_workout_response, workout_detail_response, workout_exercises_performance_response,
    workout_history_list_response, workout_progress_response, workout_summary_response,
    ActiveWorkoutResponse, CreateActiveWorkoutRequest, CreateWorkoutRequest,
    UpdateActiveWorkoutRequest, WorkoutDetailResponse, WorkoutExercisesPerformanceResponse,
    WorkoutHistoryListResponse, WorkoutProgressResponse, WorkoutSummaryResponse,
};
use crate::api::session::AuthenticatedSession;
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

fn sort_missing_exercise_details(details: &mut [MissingExerciseDetail]) {
    details.sort_by(|left, right| {
        left.exercise_position
            .cmp(&right.exercise_position)
            .then_with(|| {
                left.training_plan_exercise_id
                    .cmp(&right.training_plan_exercise_id)
            })
    });
}

fn map_workout_validation_error(error: WorkoutValidationError) -> ApiError {
    match error {
        WorkoutValidationError::Validation(message) => ApiError::Validation(message),
        WorkoutValidationError::NotFound(message) => ApiError::NotFound(message),
        WorkoutValidationError::ConfiguredGymStartBlocked {
            message,
            selected_gym_id,
            missing_exercises,
        } => {
            let mut missing_exercises: Vec<MissingExerciseDetail> = missing_exercises
                .into_iter()
                .map(missing_exercise_detail)
                .collect();
            sort_missing_exercise_details(&mut missing_exercises);
            ApiError::ValidationWithDetails {
                message,
                details: ErrorDetails {
                    selected_gym_id: Some(selected_gym_id),
                    missing_exercises,
                },
            }
        }
        WorkoutValidationError::Internal => ApiError::Internal,
        WorkoutValidationError::Persistence(error) => map_persistence_error(error),
    }
}

fn session_user_id(session: &AuthenticatedSession) -> String {
    session.user_id.clone()
}

fn map_enum_translation_error(error: EnumTranslationError) -> ApiError {
    eprintln!("{error}");
    ApiError::Internal
}

pub(crate) async fn list_workouts(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<WorkoutHistoryListResponse>, ApiError> {
    let session = session_user_id(&session);
    let summaries = fetch_workout_history_service(&state.repository, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(Json(workout_history_list_response(summaries)))
}

pub(crate) async fn get_workout_progress(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<WorkoutProgressResponse>, ApiError> {
    let session = session_user_id(&session);
    let entries = fetch_workout_progress_service(&state.repository, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(Json(workout_progress_response(entries)))
}

pub(crate) async fn get_workout_exercises_performance(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<WorkoutExercisesPerformanceResponse>, ApiError> {
    let session = session_user_id(&session);
    let groups = fetch_workout_exercises_performance(&state.repository, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(Json(
        workout_exercises_performance_response(groups).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn get_workout_summary(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(workout_id): Path<String>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    let session = session_user_id(&session);
    let summary = fetch_workout_summary_service(&state.repository, &workout_id, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(Json(workout_summary_response(summary)))
}

pub(crate) async fn get_workout_detail(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(workout_id): Path<String>,
) -> Result<Json<WorkoutDetailResponse>, ApiError> {
    let session = session_user_id(&session);
    let detail = fetch_workout_detail_service(&state.repository, &workout_id, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(Json(
        workout_detail_response(detail).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn create_workout(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Json(payload): Json<CreateWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let session = session_user_id(&session);
    let new_workout = payload.validate_and_into_domain()?;
    let summary = create_workout_service(&state.repository, &new_workout, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok((StatusCode::CREATED, Json(workout_summary_response(summary))))
}

pub(crate) async fn get_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let session = session_user_id(&session);
    let workout = fetch_active_workout_service(&state.repository, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(Json(
        active_workout_response(workout).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn create_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Json(payload): Json<CreateActiveWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let session = session_user_id(&session);
    let new_workout = payload.validate_and_into_domain()?;
    let created = create_active_workout_service(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
        &session,
    )
    .await
    .map_err(map_workout_validation_error)?;

    Ok((
        StatusCode::CREATED,
        Json(active_workout_response(created).map_err(map_enum_translation_error)?),
    ))
}

pub(crate) async fn update_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(workout_id): Path<String>,
    Json(payload): Json<UpdateActiveWorkoutRequest>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    let session = session_user_id(&session);

    let updated = update_active_workout_service(
        &state.repository,
        &workout_id,
        &new_workout,
        payload.total_exercise_count,
        &session,
    )
    .await
    .map_err(map_workout_validation_error)?;

    Ok(Json(
        active_workout_response(updated).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn complete_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(workout_id): Path<String>,
    Json(payload): Json<crate::api::models::CompleteActiveWorkoutRequest>,
) -> Result<Json<crate::api::models::WorkoutSummaryResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    let session = session_user_id(&session);

    let summary = complete_active_workout_service(
        &state.repository,
        &workout_id,
        &new_workout,
        payload.total_exercise_count,
        &session,
    )
    .await
    .map_err(map_workout_validation_error)?;

    Ok(Json(workout_summary_response(summary)))
}

pub(crate) async fn cancel_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(workout_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let session = session_user_id(&session);
    cancel_active_workout_service(&state.repository, &workout_id, &session)
        .await
        .map_err(map_workout_validation_error)?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::map_workout_validation_error;
    use crate::{
        api::ApiError,
        application::workouts::{MissingExerciseRealizability, WorkoutValidationError},
    };

    #[test]
    fn configured_gym_start_blocked_mapping_includes_selected_gym_and_sorted_missing_exercises() {
        let mapped =
            map_workout_validation_error(WorkoutValidationError::ConfiguredGymStartBlocked {
                message: "blocked".to_owned(),
                selected_gym_id: "gym-1".to_owned(),
                missing_exercises: vec![
                    MissingExerciseRealizability {
                        training_plan_exercise_id: "z".to_owned(),
                        exercise_name: "Third".to_owned(),
                        exercise_position: 3,
                        reason: "no_realizable_option_in_selected_gym".to_owned(),
                    },
                    MissingExerciseRealizability {
                        training_plan_exercise_id: "a".to_owned(),
                        exercise_name: "First".to_owned(),
                        exercise_position: 1,
                        reason: "no_realizable_option_in_selected_gym".to_owned(),
                    },
                ],
            });

        match mapped {
            ApiError::ValidationWithDetails { details, .. } => {
                assert_eq!(details.selected_gym_id.as_deref(), Some("gym-1"));
                assert_eq!(details.missing_exercises.len(), 2);
                assert_eq!(details.missing_exercises[0].training_plan_exercise_id, "a");
                assert_eq!(details.missing_exercises[1].training_plan_exercise_id, "z");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
