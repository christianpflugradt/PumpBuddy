mod domain;
mod persistence;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use persistence::DomainRepository;
use serde::Serialize;
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

enum ApiError {
    Internal,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(HelloWorldResponse {
                    value: "Internal server error".to_owned(),
                }),
            )
                .into_response(),
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
