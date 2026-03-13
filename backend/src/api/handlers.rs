use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};

use crate::application::workouts::{
    validate_active_workout, validate_exercises_match_training_plan, WorkoutValidationError,
};

use super::{
    error::{map_persistence_error, ApiError},
    models::{
        active_workout_response, workout_summary_response, ActiveWorkoutResponse,
        CompleteActiveWorkoutRequest, CreateActiveWorkoutRequest, CreateWorkoutRequest,
        GymSummaryResponse, PlanExerciseOptionSummaryResponse, TrainingPlanOptionsQuery,
        TrainingPlanOptionsResponse, TrainingPlanSummaryResponse, UpdateActiveWorkoutRequest,
        WorkoutSummaryResponse,
    },
    AppState,
};

pub fn app_router(app_state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/gyms", get(list_gyms))
        .route("/api/training-plans", get(list_training_plans))
        .route(
            "/api/training-plans/{training_plan_id}/options",
            get(list_training_plan_options),
        )
        .route("/api/workouts", post(create_workout))
        .route(
            "/api/active-workout",
            get(get_active_workout).post(create_active_workout),
        )
        .route(
            "/api/active-workout/{workout_id}",
            put(update_active_workout).delete(cancel_active_workout),
        )
        .route(
            "/api/active-workout/{workout_id}/complete",
            post(complete_active_workout),
        )
        .route(
            "/api/workouts/{workout_id}/summary",
            get(get_workout_summary),
        )
        .with_state(app_state)
}

fn map_workout_validation_error(error: WorkoutValidationError) -> ApiError {
    match error {
        WorkoutValidationError::Validation(message) => ApiError::Validation(message),
        WorkoutValidationError::Persistence(error) => map_persistence_error(error),
    }
}

async fn list_training_plans(
    State(state): State<AppState>,
) -> Result<Json<Vec<TrainingPlanSummaryResponse>>, ApiError> {
    let plans = state
        .repository
        .fetch_training_plan_summaries()
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(
        plans
            .into_iter()
            .map(|plan| TrainingPlanSummaryResponse {
                id: plan.id,
                name: plan.name,
                exercise_count: plan.exercise_count,
            })
            .collect(),
    ))
}

async fn list_gyms(
    State(state): State<AppState>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let gyms = state
        .repository
        .fetch_gym_summaries()
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(
        gyms.into_iter()
            .map(|gym| GymSummaryResponse {
                id: gym.id,
                name: gym.name,
            })
            .collect(),
    ))
}

async fn list_training_plan_options(
    State(state): State<AppState>,
    Path(training_plan_id): Path<String>,
    Query(query): Query<TrainingPlanOptionsQuery>,
) -> Result<Json<TrainingPlanOptionsResponse>, ApiError> {
    let options = state
        .repository
        .fetch_plan_exercise_option_summaries(&training_plan_id, &query.gym_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(TrainingPlanOptionsResponse {
        training_plan_id,
        gym_id: query.gym_id,
        options: options
            .into_iter()
            .map(|option| PlanExerciseOptionSummaryResponse {
                id: option.id,
                training_plan_exercise_id: option.training_plan_exercise_id,
                exercise_name: option.exercise_name,
                exercise_position: option.exercise_position,
                variant_id: option.variant_id,
                variant_name: option.variant_name,
                variant_type: option.variant_type,
                station_id: option.station_id,
                station_name: option.station_name,
            })
            .collect(),
    }))
}

async fn get_workout_summary(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    let maybe_summary = state
        .repository
        .fetch_workout_summary(&workout_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    let summary =
        maybe_summary.ok_or_else(|| ApiError::NotFound("Workout not found".to_owned()))?;

    Ok(Json(workout_summary_response(summary)))
}

async fn create_workout(
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_exercises_match_training_plan(&state.repository, &new_workout)
        .await
        .map_err(map_workout_validation_error)?;

    let created = state
        .repository
        .create_workout(&new_workout)
        .await
        .map_err(map_persistence_error)?;

    let summary = state
        .repository
        .fetch_workout_summary(&created.id)
        .await
        .map_err(map_persistence_error)?
        .ok_or(ApiError::Internal)?;

    Ok((StatusCode::CREATED, Json(workout_summary_response(summary))))
}

async fn get_active_workout(
    State(state): State<AppState>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let workout = state
        .repository
        .fetch_first_active_workout()
        .await
        .map_err(map_persistence_error)?
        .ok_or_else(|| ApiError::NotFound("No active workout found".to_owned()))?;

    Ok(Json(active_workout_response(workout)))
}

async fn create_active_workout(
    State(state): State<AppState>,
    Json(payload): Json<CreateActiveWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await
    .map_err(map_workout_validation_error)?;

    let created = state
        .repository
        .create_active_workout(&new_workout)
        .await
        .map_err(map_persistence_error)?;

    Ok((StatusCode::CREATED, Json(active_workout_response(created))))
}

async fn update_active_workout(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
    Json(payload): Json<UpdateActiveWorkoutRequest>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await
    .map_err(map_workout_validation_error)?;

    let updated = state
        .repository
        .update_active_workout(&workout_id, &new_workout)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(active_workout_response(updated)))
}

async fn complete_active_workout(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
    Json(payload): Json<CompleteActiveWorkoutRequest>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await
    .map_err(map_workout_validation_error)?;

    let summary = state
        .repository
        .complete_active_workout(&workout_id, &new_workout)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(workout_summary_response(summary)))
}

async fn cancel_active_workout(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state
        .repository
        .cancel_active_workout(&workout_id)
        .await
        .map_err(map_persistence_error)?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::app_router;
    use crate::{api::AppState, persistence::DomainRepository};
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    fn lazy_test_repository() -> DomainRepository {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect_lazy("postgresql://pumpbuddy:pumpbuddy@127.0.0.1:5432/pumpbuddy")
            .expect("lazy test pool should be valid");

        DomainRepository::new(pool)
    }

    #[tokio::test]
    async fn app_router_no_longer_exposes_removed_bootstrap_endpoint() {
        let removed_bootstrap_path = ["/api/", "hello", "-", "world"].concat();
        let app = app_router(AppState {
            repository: lazy_test_repository(),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(removed_bootstrap_path)
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
