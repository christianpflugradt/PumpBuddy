use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use pumpbuddy_backend::persistence::DomainRepository;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::{env, net::SocketAddr};

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
struct TrainingPlanOptionsQuery {
    #[serde(rename = "gymId")]
    gym_id: String,
}

enum ApiError {
    Internal,
    NotFound(String),
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

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/hello-world", get(get_hello_world))
        .route("/api/training-plans", get(list_training_plans))
        .route(
            "/api/training-plans/{training_plan_id}/options",
            get(list_training_plan_options),
        )
        .route(
            "/api/workouts/{workout_id}/summary",
            get(get_workout_summary),
        )
        .with_state(app_state);

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
