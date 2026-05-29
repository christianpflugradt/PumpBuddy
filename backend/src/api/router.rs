use axum::{
    extract::{Extension, Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};

// `WorkoutValidationError` helper moved to handlers module; router doesn't need it.

use super::handlers::{
    cancel_active_workout, complete_active_workout, create_active_workout, create_workout,
    get_about_metadata, get_active_workout, get_gym_detail, get_gym_station_detail,
    get_training_plan, get_workout_detail, get_workout_exercises_performance, get_workout_progress,
    get_workout_summary, list_gyms, list_training_plan_exercise_variants, list_training_plans,
    list_workouts, update_active_workout,
};

use super::middleware;
use super::models::{
    CompleteActiveWorkoutRequest, CreateActiveWorkoutRequest, CreateWorkoutRequest,
    TrainingPlanExerciseVariantsQuery, UpdateActiveWorkoutRequest,
};
use super::session::AuthenticatedSession;
use super::AppState;
// router does not need persistence error mapping or ApiError directly
pub fn app_router(app_state: AppState) -> Router {
    let api = Router::new()
        .route(
            "/about",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    get_about_metadata(State(state), Extension(session)).await
                },
            ),
        )
        .route(
            "/gyms",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    list_gyms(State(state), Extension(session)).await
                },
            ),
        )
        .route(
            "/gyms/{gym_id}",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(gym_id): Path<String>| async move {
                    get_gym_detail(State(state), Extension(session), Path(gym_id)).await
                },
            ),
        )
        .route(
            "/gyms/{gym_id}/stations/{station_id}",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path((gym_id, station_id)): Path<(String, String)>| async move {
                    get_gym_station_detail(
                        State(state),
                        Extension(session),
                        Path((gym_id, station_id)),
                    )
                    .await
                },
            ),
        )
        .route(
            "/training-plans",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    list_training_plans(State(state), Extension(session)).await
                },
            ),
        )
        .route(
            "/training-plans/{training_plan_id}",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(training_plan_id): Path<String>| async move {
                    get_training_plan(State(state), Extension(session), Path(training_plan_id))
                        .await
                },
            ),
        )
        .route(
            "/training-plans/{training_plan_id}/options",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(training_plan_id): Path<String>,
                 Query(query): Query<TrainingPlanExerciseVariantsQuery>| async move {
                    list_training_plan_exercise_variants(
                        State(state),
                        Extension(session),
                        Path(training_plan_id),
                        Query(query),
                    )
                    .await
                },
            ),
        )
        .route(
            "/workouts",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    list_workouts(State(state), Extension(session)).await
                },
            )
            .post(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Json(payload): Json<CreateWorkoutRequest>| async move {
                    create_workout(State(state), Extension(session), Json(payload)).await
                },
            ),
        )
        .route(
            "/workouts/progress",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    get_workout_progress(State(state), Extension(session)).await
                },
            ),
        )
        .route(
            "/workouts/exercises-performance",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    get_workout_exercises_performance(State(state), Extension(session)).await
                },
            ),
        )
        .route(
            "/active-workout",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>| async move {
                    get_active_workout(State(state), Extension(session)).await
                },
            )
            .post(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Json(payload): Json<CreateActiveWorkoutRequest>| async move {
                    create_active_workout(State(state), Extension(session), Json(payload)).await
                },
            ),
        )
        .route(
            "/active-workout/{workout_id}",
            put(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(workout_id): Path<String>,
                 Json(payload): Json<UpdateActiveWorkoutRequest>| async move {
                    update_active_workout(
                        State(state),
                        Extension(session),
                        Path(workout_id),
                        Json(payload),
                    )
                    .await
                },
            )
            .delete(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(workout_id): Path<String>| async move {
                    cancel_active_workout(State(state), Extension(session), Path(workout_id)).await
                },
            ),
        )
        .route(
            "/active-workout/{workout_id}/complete",
            post(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(workout_id): Path<String>,
                 Json(payload): Json<CompleteActiveWorkoutRequest>| async move {
                    complete_active_workout(
                        State(state),
                        Extension(session),
                        Path(workout_id),
                        Json(payload),
                    )
                    .await
                },
            ),
        )
        .route(
            "/workouts/{workout_id}/summary",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(workout_id): Path<String>| async move {
                    get_workout_summary(State(state), Extension(session), Path(workout_id)).await
                },
            ),
        )
        .route(
            "/workouts/{workout_id}",
            get(
                |State(state): State<AppState>,
                 Extension(session): Extension<AuthenticatedSession>,
                 Path(workout_id): Path<String>| async move {
                    get_workout_detail(State(state), Extension(session), Path(workout_id)).await
                },
            ),
        );

    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/auth/login", post(super::auth::login))
        .route("/auth/password", post(super::auth::update_password_handler))
        .route("/auth/logout", post(super::auth::logout))
        .route(
            "/auth/session",
            get(super::auth::session).patch(super::auth::update_session),
        )
        .nest(
            "/api",
            api.layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                middleware::require_session,
            )),
        )
        .with_state(app_state)
}
