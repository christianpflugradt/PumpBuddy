use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use pumpbuddy_backend::persistence::DomainRepository;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::{collections::HashSet, env, net::SocketAddr};

#[derive(Clone)]
struct AppState {
    repository: DomainRepository,
}

#[derive(Serialize)]
struct HelloWorldResponse {
    value: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    message: String,
}

#[derive(Serialize)]
struct TrainingPlanSummaryResponse {
    id: String,
    name: String,
    exercise_count: i64,
}

#[derive(Serialize)]
struct GymSummaryResponse {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct PlanExerciseOptionSummaryResponse {
    id: String,
    training_plan_exercise_id: String,
    exercise_name: String,
    exercise_position: i32,
    variant_id: String,
    variant_name: String,
    variant_type: String,
    station_id: String,
    station_name: String,
}

#[derive(Serialize)]
struct TrainingPlanOptionsResponse {
    training_plan_id: String,
    gym_id: String,
    options: Vec<PlanExerciseOptionSummaryResponse>,
}

#[derive(Serialize)]
struct WorkoutSummaryResponse {
    id: String,
    training_plan_id: String,
    training_plan_name: String,
    gym_id: String,
    gym_name: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    exercise_count: i64,
    completed_set_count: i64,
}

#[derive(Deserialize)]
struct CreateWorkoutRequest {
    training_plan_id: String,
    gym_id: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    exercises: Vec<CreateWorkoutExerciseInput>,
}

#[derive(Deserialize)]
struct CreateWorkoutExerciseInput {
    training_plan_exercise_id: String,
    position: i32,
    selected_plan_exercise_option_id: Option<String>,
    selected_variant_id: Option<String>,
    selected_station_id: Option<String>,
    set: CreateWorkoutSetInput,
}

#[derive(Deserialize)]
struct CreateWorkoutSetInput {
    load_value: f64,
    reps: Option<i32>,
}

#[derive(Deserialize)]
struct TrainingPlanOptionsQuery {
    #[serde(rename = "gymId")]
    gym_id: String,
}

enum ApiError {
    Internal,
    NotFound(String),
    Validation(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "Internal server error".to_owned(),
                }),
            )
                .into_response(),
            Self::NotFound(message) => {
                (StatusCode::NOT_FOUND, Json(ErrorResponse { message })).into_response()
            }
            Self::Validation(message) => {
                (StatusCode::BAD_REQUEST, Json(ErrorResponse { message })).into_response()
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help();
        return;
    }

    let host = env::var("BACKEND_HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
    let port = env::var("BACKEND_PORT").unwrap_or_else(|_| "8080".to_owned());
    let bind_addr = format!("{host}:{port}");

    let addr: SocketAddr = bind_addr.parse().unwrap_or_else(|err| {
        eprintln!("invalid bind address '{bind_addr}': {err}");
        std::process::exit(2);
    });

    let database_url = match env::var("DATABASE_URL") {
        Ok(value) => value,
        Err(_) => {
            eprintln!("DATABASE_URL is required");
            std::process::exit(2);
        }
    };

    let db_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .unwrap_or_else(|err| {
            eprintln!("failed to connect to postgres: {err}");
            std::process::exit(1);
        });

    let app_state = AppState {
        repository: DomainRepository::new(db_pool),
    };

    let app = app_router(app_state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|err| {
            eprintln!("failed to bind backend listener on {addr}: {err}");
            std::process::exit(1);
        });

    axum::serve(listener, app).await.unwrap_or_else(|err| {
        eprintln!("backend server error: {err}");
        std::process::exit(1);
    });
}

fn app_router(app_state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/hello-world", get(get_hello_world))
        .route("/api/gyms", get(list_gyms))
        .route("/api/training-plans", get(list_training_plans))
        .route(
            "/api/training-plans/{training_plan_id}/options",
            get(list_training_plan_options),
        )
        .route("/api/workouts", post(create_workout))
        .route(
            "/api/workouts/{workout_id}/summary",
            get(get_workout_summary),
        )
        .with_state(app_state)
}

async fn get_hello_world(
    State(state): State<AppState>,
) -> Result<Json<HelloWorldResponse>, ApiError> {
    let first_plan_name = state
        .repository
        .fetch_first_training_plan_name()
        .await
        .map_err(|_| ApiError::Internal)?;

    match first_plan_name {
        Some(name) => Ok(Json(HelloWorldResponse {
            value: format!("Hello from {name}"),
        })),
        None => Err(ApiError::Internal),
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

    let response = plans
        .into_iter()
        .map(|plan| TrainingPlanSummaryResponse {
            id: plan.id,
            name: plan.name,
            exercise_count: plan.exercise_count,
        })
        .collect();

    Ok(Json(response))
}

async fn list_gyms(
    State(state): State<AppState>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let gyms = state
        .repository
        .fetch_gym_summaries()
        .await
        .map_err(|_| ApiError::Internal)?;

    let response = gyms
        .into_iter()
        .map(|gym| GymSummaryResponse {
            id: gym.id,
            name: gym.name,
        })
        .collect();

    Ok(Json(response))
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

    let option_responses = options
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
        .collect();

    Ok(Json(TrainingPlanOptionsResponse {
        training_plan_id,
        gym_id: query.gym_id,
        options: option_responses,
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

    Ok(Json(WorkoutSummaryResponse {
        id: summary.id,
        training_plan_id: summary.training_plan_id,
        training_plan_name: summary.training_plan_name,
        gym_id: summary.gym_id,
        gym_name: summary.gym_name,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
        exercise_count: summary.exercise_count,
        completed_set_count: summary.completed_set_count,
    }))
}

async fn create_workout(
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_exercises_match_training_plan(&state.repository, &new_workout).await?;

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

impl CreateWorkoutRequest {
    fn validate_and_into_domain(self) -> Result<NewWorkout, ApiError> {
        if self.training_plan_id.trim().is_empty() {
            return Err(ApiError::Validation(
                "training_plan_id is required".to_owned(),
            ));
        }

        if self.gym_id.trim().is_empty() {
            return Err(ApiError::Validation("gym_id is required".to_owned()));
        }

        if self.exercises.is_empty() {
            return Err(ApiError::Validation(
                "Workout must include at least one exercise".to_owned(),
            ));
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

            if !exercise.set.load_value.is_finite() || exercise.set.load_value < 0.0 {
                return Err(ApiError::Validation(
                    "set.load_value must be a non-negative finite number".to_owned(),
                ));
            }

            if let Some(reps) = exercise.set.reps {
                if reps < 1 {
                    return Err(ApiError::Validation(
                        "set.reps must be greater than 0 when provided".to_owned(),
                    ));
                }
            }

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
            exercises,
        })
    }
}

fn empty_string_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|candidate| {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    })
}

async fn validate_exercises_match_training_plan(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
) -> Result<(), ApiError> {
    let valid_exercise_ids = repository
        .fetch_training_plan_exercise_ids(&new_workout.training_plan_id)
        .await
        .map_err(map_persistence_error)?;

    if new_workout
        .exercises
        .iter()
        .any(|exercise| !valid_exercise_ids.contains(&exercise.training_plan_exercise_id))
    {
        return Err(ApiError::Validation(
            "Each exercise must belong to the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

fn map_persistence_error(error: pumpbuddy_backend::persistence::PersistenceError) -> ApiError {
    match error {
        pumpbuddy_backend::persistence::PersistenceError::Sqlx(sqlx::Error::Database(db_error)) => {
            match db_error.code().as_deref() {
                Some("22P02") | Some("22007") => ApiError::Validation(
                    "Workout payload contains an invalid identifier or timestamp".to_owned(),
                ),
                Some("23503") => ApiError::NotFound("A referenced record was not found".to_owned()),
                _ => ApiError::Internal,
            }
        }
        _ => ApiError::Internal,
    }
}

fn workout_summary_response(
    summary: pumpbuddy_backend::domain::WorkoutSummary,
) -> WorkoutSummaryResponse {
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

fn print_help() {
    println!("PumpBuddy backend");
    println!();
    println!("Environment variables:");
    println!("  BACKEND_HOST  Host interface to bind (default: 0.0.0.0)");
    println!("  BACKEND_PORT  TCP port to bind (default: 8080)");
    println!("  DATABASE_URL  PostgreSQL connection string (required)");
    println!();
    println!("Usage:");
    println!("  pumpbuddy-backend");
    println!("  pumpbuddy-backend --help");
}

#[cfg(test)]
mod tests {
    use super::{app_router, AppState};
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use serde_json::{json, Value};
    use sqlx::{postgres::PgPoolOptions, PgPool};
    use std::env;
    use tower::ServiceExt;

    async fn maybe_pool() -> Option<PgPool> {
        let database_url = env::var("TEST_DATABASE_URL")
            .ok()
            .or_else(|| env::var("DATABASE_URL").ok())?;

        PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .ok()
    }

    async fn schema_ready(pool: &PgPool) -> bool {
        sqlx::query_scalar::<_, Option<String>>("SELECT to_regclass('public.training_plans')::text")
            .fetch_one(pool)
            .await
            .ok()
            .flatten()
            .is_some()
    }

    #[tokio::test]
    async fn workout_api_creates_workout_and_returns_summary() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "started_at": "2026-01-20T09:00:00Z",
                            "completed_at": "2026-01-20T09:20:00Z",
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::CREATED);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(payload["training_plan_name"], "Push Day");
        assert_eq!(payload["gym_name"], "Forge Downtown");
        assert_eq!(payload["exercise_count"], 1);
        assert_eq!(payload["completed_set_count"], 1);
    }

    #[tokio::test]
    async fn workout_api_rejects_invalid_payloads_before_write() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
            "training_plan_id": "00000000-0000-0000-0000-000000000201",
            "gym_id": "00000000-0000-0000-0000-000000000101",
            "exercises": [
                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 0,
                                    "set": {
                                        "load_value": -5.0,
                                        "reps": -1
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(payload["message"], "Exercise position must be at least 1");
    }

    #[tokio::test]
    async fn workout_api_rejects_exercises_from_a_different_training_plan() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000806",
                                    "position": 1,
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(
            payload["message"],
            "Each exercise must belong to the selected training plan"
        );
    }

    #[tokio::test]
    async fn workout_api_rejects_zero_reps_before_write() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 0
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(
            payload["message"],
            "set.reps must be greater than 0 when provided"
        );
    }
}
