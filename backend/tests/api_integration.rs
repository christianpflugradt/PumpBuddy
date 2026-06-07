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

const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";
const DEV_USER_LOGIN: &str = "main";

fn test_password() -> String {
    format!("pw-{}", uuid::Uuid::new_v4().simple())
}

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
    let password = test_password();

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
        &password,
        Some("PumpBuddy Test"),
    )
    .await
    .expect("login should succeed");

    format!("__Host-pb_session={}", session.session_token)
}

async fn make_seed_auth_cookie(pool: &PgPool) -> String {
    let password = test_password();

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
    .bind(DEV_USER_ID)
    .bind(secret_hash)
    .bind("integration")
    .fetch_one(pool)
    .await
    .expect("secret should insert")
    .get("id");

    let repository = DomainRepository::new(pool.clone());
    let session = login_with_credentials(
        &repository,
        DEV_USER_LOGIN,
        &password,
        Some("PumpBuddy Test"),
    )
    .await
    .expect("login should succeed");

    format!("__Host-pb_session={}", session.session_token)
}

// Route-level tests for workouts and active-workout were relocated to
// `backend/tests/api_workouts.rs` to align tests with feature ownership.

#[tokio::test]
async fn about_metadata_returns_build_and_legal_metadata_fields() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let auth_cookie = make_auth_cookie(&pool).await;

    let (status, payload) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/about")
            .header("cookie", auth_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(payload["app_version"].as_str().is_some());
    assert_eq!(payload["channel"], json!("stable"));

    let commit_hash_short = payload["commit_hash_short"]
        .as_str()
        .expect("commit_hash_short should be present");
    assert!(!commit_hash_short.trim().is_empty());
    assert!(commit_hash_short.len() <= 7);

    let build_timestamp = payload["build_timestamp_utc"]
        .as_str()
        .expect("build_timestamp_utc should be present");
    assert!(build_timestamp.ends_with(" UTC"));
    assert_eq!(build_timestamp.len(), "1970-01-01 00:00 UTC".len());
}

#[tokio::test]
async fn training_plan_detail_and_options_routes_expose_separate_projections() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let auth_cookie = make_seed_auth_cookie(&pool).await;

    let (detail_status, detail_payload) = json_response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/api/training-plans/30000000-0000-0000-0000-000000000001")
            .header("cookie", auth_cookie.clone())
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(detail_status, StatusCode::OK);
    assert_eq!(
        detail_payload["id"],
        json!("30000000-0000-0000-0000-000000000001")
    );
    assert!(detail_payload["selected_gym_id"].is_null());
    assert!(detail_payload["is_executable"].is_null());
    assert!(detail_payload["execution_status"].is_null());
    assert!(detail_payload["execution_summary"].is_null());
    assert!(detail_payload["exercises"].is_array());
    assert!(detail_payload["exercises"]
        .as_array()
        .expect("detail exercises should be an array")
        .iter()
        .all(|exercise| {
            exercise["training_plan_exercise_id"].is_string()
                && exercise["exercise_name"].is_string()
                && exercise["exercise_position"].is_number()
                && exercise["configured_variant_count"].is_number()
                && exercise["executable_variant_count"].is_null()
                && exercise["execution_status"].is_null()
                && exercise.get("variant_id").is_none()
                && exercise["variants"]
                    .as_array()
                    .expect("detail exercise variants should be an array")
                    .iter()
                    .all(|variant| {
                        variant["id"].is_string()
                            && variant["variant_id"].is_string()
                            && variant["variant_name"].is_string()
                            && variant["requires_station"].is_boolean()
                            && variant["availability"].is_null()
                            && variant["compatible_stations"]
                                .as_array()
                                .expect("no-gym detail should not expose station options")
                                .is_empty()
                    })
        }));

    sqlx::query(
        "INSERT INTO exercise_variants (
             id,
             exercise_id,
             name,
             variant_type,
             requires_station,
             load_input_mode,
             set_tracking_mode,
             repetition_kind,
             user_id
         ) VALUES (
             '9f000000-0000-0000-0000-000000000001'::uuid,
             '10000000-0000-0000-0000-00000000000c'::uuid,
             'Garage-Only Bench Press',
             'machine',
             TRUE,
             'TOTAL',
             'BILATERAL',
             'REPS',
             $1::uuid
         )",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("unavailable exercise variant should insert");

    sqlx::query(
        "INSERT INTO training_plan_exercise_variants (
             id,
             training_plan_exercise_id,
             exercise_variant_id,
             selection_order,
             rep_min,
             rep_max,
             target_sets,
             user_id
         ) VALUES (
             '9f000000-0000-0000-0000-000000000002'::uuid,
             '32000000-0000-0000-0000-000000000007'::uuid,
             '9f000000-0000-0000-0000-000000000001'::uuid,
             2,
             6,
             10,
             3,
             $1::uuid
         )",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("unavailable plan exercise variant should insert");

    let selected_gym_uri = "/api/training-plans/30000000-0000-0000-0000-000000000002?gymId=50000000-0000-0000-0000-000000000001";
    let (selected_detail_status, selected_detail_payload) = json_response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri(selected_gym_uri)
            .header("cookie", auth_cookie.clone())
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(selected_detail_status, StatusCode::OK);
    assert_eq!(
        selected_detail_payload["selected_gym_id"],
        json!("50000000-0000-0000-0000-000000000001")
    );
    assert!(selected_detail_payload["is_executable"].is_boolean());
    assert!(selected_detail_payload["execution_status"].is_string());
    assert!(selected_detail_payload["execution_summary"].is_string());

    let selected_exercises = selected_detail_payload["exercises"]
        .as_array()
        .expect("selected-gym detail exercises should be an array");
    assert!(selected_exercises.iter().all(|exercise| {
        exercise["executable_variant_count"].is_number()
            && exercise["execution_status"].is_string()
            && exercise["variants"].is_array()
    }));

    let selected_variants = selected_exercises
        .iter()
        .flat_map(|exercise| {
            exercise["variants"]
                .as_array()
                .expect("selected-gym exercise variants should be an array")
        })
        .collect::<Vec<_>>();
    assert!(selected_variants.iter().any(|variant| {
        variant["availability"] == json!("AVAILABLE")
            && variant["requires_station"] == json!(true)
            && !variant["compatible_stations"]
                .as_array()
                .expect("available station variant should include station options")
                .is_empty()
    }));
    assert!(selected_variants.iter().any(|variant| {
        variant["availability"] == json!("AVAILABLE")
            && variant["requires_station"] == json!(false)
            && variant["compatible_stations"]
                .as_array()
                .expect("stationless variants should not include station options")
                .is_empty()
    }));
    assert!(selected_variants.iter().any(|variant| {
        variant["id"] == json!("9f000000-0000-0000-0000-000000000002")
            && variant["availability"] == json!("NOT_AVAILABLE")
            && variant["compatible_stations"]
                .as_array()
                .expect("unavailable variant should not include station options")
                .is_empty()
    }));

    let (options_status, options_payload) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/training-plans/30000000-0000-0000-0000-000000000002/options?gymId=50000000-0000-0000-0000-000000000001")
            .header("cookie", auth_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(options_status, StatusCode::OK);
    assert_eq!(
        options_payload["training_plan_id"],
        json!("30000000-0000-0000-0000-000000000002")
    );
    assert_eq!(
        options_payload["gym_id"],
        json!("50000000-0000-0000-0000-000000000001")
    );
    assert!(options_payload["exercise_variants"]
        .as_array()
        .expect("options payload should include exercise variants")
        .iter()
        .all(|variant| {
            variant["training_plan_exercise_id"].is_string()
                && variant["variant_id"].is_string()
                && variant["variant_name"].is_string()
        }));
    assert!(!options_payload["exercise_variants"]
        .as_array()
        .expect("options payload should include exercise variants")
        .iter()
        .any(|variant| variant["id"] == json!("9f000000-0000-0000-0000-000000000002")));
}
