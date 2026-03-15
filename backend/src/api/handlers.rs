use axum::{
    extract::{Path, Query, State, Extension},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};

use crate::application::workouts::{
    validate_active_workout, validate_exercises_match_training_plan, WorkoutValidationError,
};

use super::{
    auth::{login, session},
    models::{
        active_workout_response, workout_summary_response, ActiveWorkoutResponse,
        CompleteActiveWorkoutRequest, CreateActiveWorkoutRequest, CreateWorkoutRequest,
        GymSummaryResponse, PlanExerciseOptionSummaryResponse, TrainingPlanOptionsQuery,
        TrainingPlanOptionsResponse, TrainingPlanSummaryResponse, UpdateActiveWorkoutRequest,
        WorkoutSummaryResponse,
    },
    AppState,
};
// Extension extractor is used to read the AuthenticatedSession inserted by middleware
use crate::api::{map_persistence_error, ApiError};
use super::middleware;

pub fn app_router(app_state: AppState) -> Router {
    let api = Router::new()
        .route("/gyms", get(|State(state): State<AppState>| async move {
            list_gyms(State(state)).await
        }))
        .route("/training-plans", get(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>| async move {
            list_training_plans(State(state), Extension(session)).await
        }))
        .route(
            "/training-plans/{training_plan_id}/options",
            get(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Path(training_plan_id): Path<String>, Query(query): Query<TrainingPlanOptionsQuery>| async move {
                list_training_plan_options(State(state), Extension(session), Path(training_plan_id), Query(query)).await
            }),
        )
        .route("/workouts", post(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Json(payload): Json<CreateWorkoutRequest>| async move {
            create_workout(State(state), Extension(session), Json(payload)).await
        }))
        .route(
            "/active-workout",
            get(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>| async move {
                get_active_workout(State(state), Extension(session)).await
            }).post(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Json(payload): Json<CreateActiveWorkoutRequest>| async move {
                create_active_workout(State(state), Extension(session), Json(payload)).await
            }),
        )
        .route(
            "/active-workout/{workout_id}",
            put(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Path(workout_id): Path<String>, Json(payload): Json<UpdateActiveWorkoutRequest>| async move {
                update_active_workout(State(state), Extension(session), Path(workout_id), Json(payload)).await
            }).delete(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Path(workout_id): Path<String>| async move {
                cancel_active_workout(State(state), Extension(session), Path(workout_id)).await
            }),
        )
        .route(
            "/active-workout/{workout_id}/complete",
            post(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Path(workout_id): Path<String>, Json(payload): Json<CompleteActiveWorkoutRequest>| async move {
                complete_active_workout(State(state), Extension(session), Path(workout_id), Json(payload)).await
            }),
        )
        .route(
            "/workouts/{workout_id}/summary",
            get(|State(state): State<AppState>, Extension(session): Extension<crate::persistence::AuthenticatedSession>, Path(workout_id): Path<String>| async move {
                get_workout_summary(State(state), Extension(session), Path(workout_id)).await
            }),
        )
        ;

    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/login", post(login))
        .route("/auth/session", get(session))
        .nest("/api", api.layer(axum::middleware::from_fn_with_state(app_state.clone(), middleware::require_session)))
        .with_state(app_state)
}

fn map_workout_validation_error(error: WorkoutValidationError) -> ApiError {
    match error {
        WorkoutValidationError::Validation(message) => ApiError::Validation(message),
        WorkoutValidationError::Persistence(error) => map_persistence_error(error),
    }
}

// session enforcement is applied via middleware on the /api router

async fn list_training_plans(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
) -> Result<Json<Vec<TrainingPlanSummaryResponse>>, ApiError> {
    let user_id = session_user_id(&session);
    let plans = state
        .repository
        .fetch_training_plan_summaries_for_user(&user_id)
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

// handlers receive the AuthenticatedSession via the `Extension<AuthenticatedSession>` extractor
// below we return the user_id string for convenience
fn session_user_id(session: &crate::persistence::AuthenticatedSession) -> String {
    session.user_id.clone()
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
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(training_plan_id): Path<String>,
    Query(query): Query<TrainingPlanOptionsQuery>,
) -> Result<Json<TrainingPlanOptionsResponse>, ApiError> {
    let user_id = session_user_id(&session);
    let options = state
        .repository
        .fetch_plan_exercise_option_summaries_for_user(&training_plan_id, &query.gym_id, &user_id)
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
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(workout_id): Path<String>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    // extract authenticated session inserted by middleware
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

async fn create_workout(
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

async fn get_active_workout(
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

async fn create_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
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

    let session = session_user_id(&session);
    let created = state
        .repository
        .create_active_workout_for_user(&new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok((StatusCode::CREATED, Json(active_workout_response(created))))
}

async fn update_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
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

    let session = session_user_id(&session);
    let updated = state
        .repository
        .update_active_workout_for_user(&workout_id, &new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(active_workout_response(updated)))
}

async fn complete_active_workout(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
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

    let session = session_user_id(&session);
    let summary = state
        .repository
        .complete_active_workout_for_user(&workout_id, &new_workout, &session)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(workout_summary_response(summary)))
}

async fn cancel_active_workout(
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

#[cfg(test)]
mod tests {
    use super::app_router;
    use crate::{api::AppState, persistence::DomainRepository};
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use sqlx::postgres::PgPoolOptions;
    use std::time::Instant;
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

    #[tokio::test]
    async fn health_endpoint_latency_smoke() {
        let app = app_router(AppState {
            repository: lazy_test_repository(),
        });

        for _ in 0..5 {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("GET")
                        .uri("/health")
                        .body(Body::empty())
                        .expect("request should build"),
                )
                .await
                .expect("request should succeed");

            assert_eq!(response.status(), StatusCode::OK);
        }

        let iterations = 40u128;
        let start = Instant::now();

        for _ in 0..iterations {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("GET")
                        .uri("/health")
                        .body(Body::empty())
                        .expect("request should build"),
                )
                .await
                .expect("request should succeed");

            assert_eq!(response.status(), StatusCode::OK);
        }

        let average_micros = start.elapsed().as_micros() / iterations;
        let max_allowed_ms = std::env::var("BACKEND_HEALTH_LATENCY_SMOKE_MAX_MS")
            .ok()
            .and_then(|value| value.parse::<u128>().ok())
            .unwrap_or(50);
        let max_allowed_micros = max_allowed_ms * 1_000;

        assert!(
            average_micros <= max_allowed_micros,
            "backend health latency smoke check failed: average {}us across {} requests exceeds {}us threshold (override with BACKEND_HEALTH_LATENCY_SMOKE_MAX_MS)",
            average_micros,
            iterations,
            max_allowed_micros
        );
    }
}
