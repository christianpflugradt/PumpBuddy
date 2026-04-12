#![allow(dead_code, unused_imports)]

mod support;

use self::support::{test_lock, TestDatabase};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use pumpbuddy_backend::application::auth::login_with_credentials;
use pumpbuddy_backend::{
    api::{app_router, AppState},
    persistence::DomainRepository,
};
use rand::rngs::OsRng;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use tower::ServiceExt;

fn create_active_workout_payload() -> Value {
    json!({
        "training_plan_id": "00000000-0000-0000-0000-000000000201",
        "gym_id": "00000000-0000-0000-0000-000000000101",
        "started_at": "2026-02-01T09:00:00Z",
        "current_exercise_position": 1,
        "total_exercise_count": 5,
        "first_confirmed_exercise_position": 1,
        "exercises": [
            {
                "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                "position": 1,
                "selected_training_plan_exercise_variant_id": "00000000-0000-0000-0000-000000001001",
                "selected_variant_id": "00000000-0000-0000-0000-000000000401",
                "selected_station_id": "00000000-0000-0000-0000-000000000701",
                "completed_sets": [
                    {
                        "load_value": 20.0,
                        "reps": 10
                    }
                ]
            }
        ]
    })
}

fn create_workout_payload() -> Value {
    json!({
        "training_plan_id": "00000000-0000-0000-0000-000000000201",
        "gym_id": "00000000-0000-0000-0000-000000000101",
        "started_at": "2026-01-15T09:00:00Z",
        "completed_at": "2026-01-15T09:20:00Z",
        "exercises": [
            {
                "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                "position": 1,
                "selected_training_plan_exercise_variant_id": "00000000-0000-0000-0000-000000001001",
                "selected_variant_id": "00000000-0000-0000-0000-000000000401",
                "selected_station_id": "00000000-0000-0000-0000-000000000701",
                "set": {
                    "load_value": 20.0,
                    "reps": 10
                }
            }
        ]
    })
}

async fn json_response(app: axum::Router, request: Request<Body>) -> (StatusCode, Value) {
    let response = app.oneshot(request).await.expect("request should succeed");
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read");
    let payload = serde_json::from_slice(&body).expect("response should be json");
    (status, payload)
}

async fn make_auth_cookie(pool: &PgPool) -> String {
    // create a user and an access key secret, then login to obtain a session cookie
    let password = "correct-horse";

    let user_id: String = sqlx::query(
        "INSERT INTO users (display_name, login_name)
         VALUES ($1, $2)
         RETURNING id::text AS id",
    )
    .bind("Integration Test User")
    .bind("integration")
    .fetch_one(pool)
    .await
    .expect("user should insert")
    .get("id");

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let secret_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .expect("hash should succeed")
        .to_string();

    let _secret_id: String = sqlx::query(
        "INSERT INTO user_secrets (user_id, secret_hash, label)
         VALUES ($1::uuid, $2, $3)
         RETURNING id::text AS id",
    )
    .bind(&user_id)
    .bind(secret_hash)
    .bind("integration")
    .fetch_one(pool)
    .await
    .expect("secret should insert")
    .get("id");

    let repository = DomainRepository::new(pool.clone());
    let session = login_with_credentials(
        &repository,
        "integration",
        password,
        Some("PumpBuddy Test"),
        None,
    )
    .await
    .expect("login should succeed");

    format!("__Host-pb_session={}", session.session_token)
}

// Route-level tests for workouts and active-workout were relocated to
// `backend/tests/api_workouts.rs` to align tests with feature ownership.
