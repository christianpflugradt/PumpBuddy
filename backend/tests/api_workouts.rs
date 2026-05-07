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
const USER_B_ID: &str = "00000000-0000-0000-0000-000000000012";

fn test_password() -> String {
    format!("pw-{}", uuid::Uuid::new_v4().simple())
}

fn create_active_workout_payload() -> Value {
    json!({
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "",
        "started_at": "2026-02-01T09:00:00Z",
        "current_exercise_position": 1,
        "total_exercise_count": 6,
        "first_confirmed_exercise_position": 1,
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000001",
                "position": 1,
                "selected_training_plan_exercise_variant_id": null,
                "selected_variant_id": null,
                "load_input_mode": "TOTAL",
                "set_tracking_mode": "BILATERAL",
                "selected_station_id": null,
                "completed_sets": [
                    {
                        "set_index": 1,
                        "set_side": "BILATERAL",
                        "load_value": 20.0,
                        "repetition_kind": "REPS",
                        "repetition_value": 10
                    }
                ]
            }
        ]
    })
}

fn create_workout_payload() -> Value {
    json!({
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "50000000-0000-0000-0000-000000000001",
        "started_at": "2026-01-15T09:00:00Z",
        "completed_at": "2026-01-15T09:20:00Z",
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000001",
                "position": 1,
                "selected_training_plan_exercise_variant_id": "33000000-0000-0000-0000-000000000001",
                "selected_variant_id": "20000000-0000-0000-0000-000000000001",
                "selected_station_id": "50000000-0000-0000-0000-000000000001",
                "set": {
                    "load_value": 20.0,
                    "repetition_kind": "REPS",
                    "repetition_value": 10
                }
            }
        ]
    })
}

fn suggested_set_for_position(body: &Value, position: i64) -> &Value {
    body["workout"]["exercises"]
        .as_array()
        .and_then(|exercises| {
            exercises
                .iter()
                .find(|exercise| exercise["position"] == json!(position))
        })
        .map(|exercise| &exercise["suggested_set"])
        .expect("suggested_set should exist for exercise position")
}

fn exercise_for_position(body: &Value, position: i64) -> &Value {
    body["workout"]["exercises"]
        .as_array()
        .and_then(|exercises| {
            exercises
                .iter()
                .find(|exercise| exercise["position"] == json!(position))
        })
        .expect("exercise should exist for position")
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
    // Seed data in runtime/database/10-seed-dev.sql belongs to the dev user.
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
    let session = login_with_credentials(&repository, "", &password, Some("PumpBuddy Test"), None)
        .await
        .expect("login should succeed");

    format!("__Host-pb_session={}", session.session_token)
}

async fn clear_user_workout_history(pool: &PgPool, user_id: &str) {
    sqlx::query("DELETE FROM workout_sets WHERE user_id = $1::uuid")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("workout set cleanup should succeed");

    sqlx::query("DELETE FROM workout_exercises WHERE user_id = $1::uuid")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("workout exercise cleanup should succeed");

    sqlx::query("DELETE FROM workouts WHERE user_id = $1::uuid")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("workout cleanup should succeed");
}

#[tokio::test]
async fn active_workout_routes_report_missing_state_and_conflicts() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/api/active-workout")
            .header("cookie", cookie.clone())
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["message"], "No active workout found");

    let (status, body) = json_response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
            .header("cookie", cookie.clone())
            .body(Body::from(create_active_workout_payload().to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["workout"]["total_exercise_count"], 6);
    assert!(
        body["workout"]["exercises"][0]["suggested_set"]["suggested_load_input_kg"].is_number()
    );
    assert!(
        body["workout"]["exercises"][0]["suggested_set"]["suggested_load_total_kg"].is_number()
    );
    assert_eq!(
        body["workout"]["exercises"][0]["suggested_set"]["repetition_kind"],
        json!("REPS")
    );
    assert!(body["workout"]["exercises"][0]["suggested_set"]["repetition_value"].is_number());

    let created_suggested_set = suggested_set_for_position(&body, 1).clone();
    let (status, resumed_body) = json_response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/api/active-workout")
            .header("cookie", cookie.clone())
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        suggested_set_for_position(&resumed_body, 1),
        &created_suggested_set
    );

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
            .header("cookie", cookie)
            .body(Body::from(create_active_workout_payload().to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["message"], "An active workout already exists");
}

#[tokio::test]
async fn create_workout_maps_invalid_timestamp_database_errors_to_validation() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let mut payload = create_workout_payload();
    payload["started_at"] = json!("not-a-timestamp");

    let cookie = make_auth_cookie(&pool).await;

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workouts")
            .header("content-type", "application/json")
            .header("cookie", cookie)
            .body(Body::from(payload.to_string()))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body["message"],
        "Workout payload contains an invalid identifier or timestamp"
    );
}

#[tokio::test]
async fn create_workout_maps_missing_foreign_keys_to_not_found() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let mut payload = create_workout_payload();
    payload["exercises"][0]["selected_variant_id"] = json!("00000000-0000-0000-0000-000000009999");

    let cookie = make_auth_cookie(&pool).await;

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workouts")
            .header("content-type", "application/json")
            .header("cookie", cookie)
            .body(Body::from(payload.to_string()))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["message"], "A referenced record was not found");
}

#[tokio::test]
async fn create_workout_validation_ignores_foreign_user_plan_rows() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    sqlx::query(
        "INSERT INTO training_plans (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)",
    )
    .bind("30000000-0000-0000-0000-000000009901")
    .bind(USER_B_ID)
    .bind("Foreign User Plan")
    .execute(&pool)
    .await
    .expect("foreign training plan insert should succeed");

    sqlx::query(
        "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("31000000-0000-0000-0000-000000009901")
    .bind("30000000-0000-0000-0000-000000009901")
    .bind(1_i32)
    .bind(USER_B_ID)
    .execute(&pool)
    .await
    .expect("foreign training plan version insert should succeed");

    sqlx::query(
        "INSERT INTO training_plan_exercises (
            id,
            training_plan_version_id,
            exercise_id,
            user_id,
            position
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)",
    )
    .bind("32000000-0000-0000-0000-000000009901")
    .bind("31000000-0000-0000-0000-000000009901")
    .bind("10000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .bind(1_i32)
    .execute(&pool)
    .await
    .expect("foreign training plan exercise insert should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let payload = json!({
        "training_plan_id": "30000000-0000-0000-0000-000000009901",
        "gym_id": "",
        "started_at": "2026-02-01T09:00:00Z",
        "completed_at": "2026-02-01T10:00:00Z",
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000009901",
                "position": 1,
                "selected_training_plan_exercise_variant_id": null,
                "selected_variant_id": null,
                "selected_station_id": null,
                "set": {
                    "load_value": 20.0,
                    "repetition_kind": "REPS",
                    "repetition_value": 10
                }
            }
        ]
    });

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workouts")
            .header("content-type", "application/json")
            .header("cookie", cookie)
            .body(Body::from(payload.to_string()))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body["message"],
        "Each exercise must belong to the selected training plan"
    );
}

#[tokio::test]
async fn list_workouts_returns_user_scoped_recency_order_and_duration_minutes() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    clear_user_workout_history(&pool, DEV_USER_ID).await;

    sqlx::query(
        "INSERT INTO users (id, display_name, login_name)
         VALUES ($1::uuid, $2, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(USER_B_ID)
    .bind("User B")
    .bind("user-b")
    .execute(&pool)
    .await
    .expect("user-b insert should succeed");

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz)",
    )
    .bind("41000000-0000-0000-0000-000000009901")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(DEV_USER_ID)
    .bind("2026-02-01T08:00:00Z")
    .bind("2026-02-01T08:20:00Z")
    .execute(&pool)
    .await
    .expect("oldest workout insert should succeed");

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz)",
    )
    .bind("41000000-0000-0000-0000-000000009902")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(DEV_USER_ID)
    .bind("2026-02-01T09:00:00Z")
    .bind("2026-02-01T09:59:31Z")
    .execute(&pool)
    .await
    .expect("middle workout insert should succeed");

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz)",
    )
    .bind("41000000-0000-0000-0000-000000009903")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind(None::<String>)
    .bind(DEV_USER_ID)
    .bind("2026-02-01T10:00:00Z")
    .bind(None::<String>)
    .execute(&pool)
    .await
    .expect("newest started-only workout insert should succeed");

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz)",
    )
    .bind("41000000-0000-0000-0000-000000009999")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .bind("2026-02-01T11:00:00Z")
    .bind("2026-02-01T11:30:00Z")
    .execute(&pool)
    .await
    .expect("foreign-user workout insert should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/workouts")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);

    let rows = body
        .as_array()
        .expect("history response should be an array");
    assert_eq!(rows.len(), 3);

    assert_eq!(rows[0]["id"], json!("41000000-0000-0000-0000-000000009903"));
    assert_eq!(rows[1]["id"], json!("41000000-0000-0000-0000-000000009902"));
    assert_eq!(rows[2]["id"], json!("41000000-0000-0000-0000-000000009901"));

    assert_eq!(rows[0]["duration_minutes"], json!(1));
    assert_eq!(rows[1]["duration_minutes"], json!(59));
    assert_eq!(rows[2]["duration_minutes"], json!(20));

    assert!(rows[0]["completed_at"].is_null());
    assert!(rows[0]["training_plan_name"].is_string());
}

#[tokio::test]
async fn get_workout_progress_returns_user_scoped_30_day_scores_and_tones() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    clear_user_workout_history(&pool, DEV_USER_ID).await;

    sqlx::query(
        "INSERT INTO users (id, display_name, login_name)
         VALUES ($1::uuid, $2, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(USER_B_ID)
    .bind("User B")
    .bind("user-b")
    .execute(&pool)
    .await
    .expect("user-b insert should succeed");

    sqlx::query(
        "INSERT INTO workouts (id, training_plan_version_id, gym_id, user_id, started_at, completed_at) VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4::uuid, NOW() - INTERVAL '20 days' - INTERVAL '45 minutes', NOW() - INTERVAL '20 days'),
         ($5::uuid, $2::uuid, $3::uuid, $4::uuid, NOW() - INTERVAL '15 days' - INTERVAL '45 minutes', NOW() - INTERVAL '15 days'),
         ($6::uuid, $2::uuid, $3::uuid, $4::uuid, NOW() - INTERVAL '10 days' - INTERVAL '45 minutes', NOW() - INTERVAL '10 days'),
         ($7::uuid, $2::uuid, $3::uuid, $4::uuid, NOW() - INTERVAL '5 days' - INTERVAL '45 minutes', NOW() - INTERVAL '5 days'),
         ($8::uuid, $2::uuid, $3::uuid, $4::uuid, NOW() - INTERVAL '40 days' - INTERVAL '45 minutes', NOW() - INTERVAL '40 days'),
         ($9::uuid, $2::uuid, $3::uuid, $10::uuid, NOW() - INTERVAL '12 days' - INTERVAL '45 minutes', NOW() - INTERVAL '12 days')",
    )
    .bind("41000000-0000-0000-0000-000000009931")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(DEV_USER_ID)
    .bind("41000000-0000-0000-0000-000000009932")
    .bind("41000000-0000-0000-0000-000000009933")
    .bind("41000000-0000-0000-0000-000000009934")
    .bind("41000000-0000-0000-0000-000000009935")
    .bind("41000000-0000-0000-0000-000000009936")
    .bind(USER_B_ID)
    .execute(&pool)
    .await
    .expect("workout inserts should succeed");

    sqlx::query(
        "INSERT INTO workout_exercises (
            id, workout_id, training_plan_exercise_id, user_id, position,
            selected_variant_id, selected_station_id, selected_training_plan_exercise_variant_id, performance_score
         ) VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 1, $5::uuid, $6::uuid, $7::uuid, $8),
         ($9::uuid, $10::uuid, $3::uuid, $4::uuid, 1, $5::uuid, $6::uuid, $7::uuid, $11),
         ($12::uuid, $13::uuid, $3::uuid, $4::uuid, 1, $5::uuid, $6::uuid, $7::uuid, $14),
         ($15::uuid, $16::uuid, $3::uuid, $4::uuid, 1, $5::uuid, $6::uuid, $7::uuid, $17),
         ($18::uuid, $19::uuid, $3::uuid, $4::uuid, 1, $20::uuid, $6::uuid, $21::uuid, $22),
         ($23::uuid, $24::uuid, $3::uuid, $25::uuid, 1, $5::uuid, $6::uuid, $7::uuid, $26)",
    )
    .bind("42000000-0000-0000-0000-000000009931")
    .bind("41000000-0000-0000-0000-000000009931")
    .bind("32000000-0000-0000-0000-000000000001")
    .bind(DEV_USER_ID)
    .bind("20000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind("33000000-0000-0000-0000-000000000001")
    .bind(100_i32)
    .bind("42000000-0000-0000-0000-000000009932")
    .bind("41000000-0000-0000-0000-000000009932")
    .bind(120_i32)
    .bind("42000000-0000-0000-0000-000000009933")
    .bind("41000000-0000-0000-0000-000000009933")
    .bind(114_i32)
    .bind("42000000-0000-0000-0000-000000009934")
    .bind("41000000-0000-0000-0000-000000009934")
    .bind(84_i32)
    .bind("42000000-0000-0000-0000-000000009935")
    .bind("41000000-0000-0000-0000-000000009935")
    .bind("20000000-0000-0000-0000-000000000002")
    .bind("33000000-0000-0000-0000-000000000002")
    .bind(130_i32)
    .bind("42000000-0000-0000-0000-000000009936")
    .bind("41000000-0000-0000-0000-000000009936")
    .bind(USER_B_ID)
    .bind(150_i32)
    .execute(&pool)
    .await
    .expect("workout exercise inserts should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/workouts/progress")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);

    let rows = body["workouts"]
        .as_array()
        .expect("progress response should include workouts array");
    assert_eq!(rows.len(), 4);

    assert_eq!(rows[0]["id"], json!("41000000-0000-0000-0000-000000009931"));
    assert_eq!(rows[1]["id"], json!("41000000-0000-0000-0000-000000009932"));
    assert_eq!(rows[2]["id"], json!("41000000-0000-0000-0000-000000009933"));
    assert_eq!(rows[3]["id"], json!("41000000-0000-0000-0000-000000009934"));

    assert!(rows[0]["workout_progress"].is_null());
    assert_eq!(rows[0]["workout_progress_status"], json!("NOT_ENOUGH_DATA"));
    assert_eq!(rows[0]["progress_tone"], json!("GRAY"));

    let progress_2 = rows[1]["workout_progress"]
        .as_f64()
        .expect("workout_progress should be numeric");
    let progress_3 = rows[2]["workout_progress"]
        .as_f64()
        .expect("workout_progress should be numeric");
    let progress_4 = rows[3]["workout_progress"]
        .as_f64()
        .expect("workout_progress should be numeric");
    assert!((progress_2 - 1.2).abs() < 1e-9);
    assert!((progress_3 - 0.95).abs() < 1e-9);
    assert!((progress_4 - 0.7).abs() < 1e-9);
    assert_eq!(rows[1]["progress_tone"], json!("GREEN"));
    assert_eq!(rows[2]["progress_tone"], json!("YELLOW"));
    assert_eq!(rows[3]["progress_tone"], json!("RED"));
}

#[tokio::test]
async fn get_workout_exercises_performance_groups_rows_and_station_tie_break_are_deterministic() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    clear_user_workout_history(&pool, DEV_USER_ID).await;

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES
         ('41000000-0000-0000-0000-000000009981'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '50 days' - INTERVAL '30 minutes', NOW() - INTERVAL '50 days'),
         ('41000000-0000-0000-0000-000000009982'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '52 days' - INTERVAL '30 minutes', NOW() - INTERVAL '52 days'),
         ('41000000-0000-0000-0000-000000009983'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '25 days' - INTERVAL '30 minutes', NOW() - INTERVAL '25 days'),
         ('41000000-0000-0000-0000-000000009984'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '15 days' - INTERVAL '30 minutes', NOW() - INTERVAL '15 days'),
         ('41000000-0000-0000-0000-000000009985'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '12 days' - INTERVAL '30 minutes', NOW() - INTERVAL '12 days'),
         ('41000000-0000-0000-0000-000000009986'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '24 days' - INTERVAL '30 minutes', NOW() - INTERVAL '24 days'),
         ('41000000-0000-0000-0000-000000009987'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '14 days' - INTERVAL '30 minutes', NOW() - INTERVAL '14 days'),
         ('41000000-0000-0000-0000-000000009988'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '5 days' - INTERVAL '30 minutes', NOW() - INTERVAL '5 days'),
         ('41000000-0000-0000-0000-000000009989'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '60 days' - INTERVAL '30 minutes', NOW() - INTERVAL '60 days'),
         ('41000000-0000-0000-0000-000000009990'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '18 days' - INTERVAL '30 minutes', NOW() - INTERVAL '18 days'),
         ('41000000-0000-0000-0000-000000009991'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '8 days' - INTERVAL '30 minutes', NOW() - INTERVAL '8 days')",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("workout inserts should succeed");

    sqlx::query(
        "INSERT INTO workout_exercises (
            id,
            workout_id,
            training_plan_exercise_id,
            user_id,
            position,
            selected_variant_id,
            selected_station_id,
            selected_training_plan_exercise_variant_id,
            performance_score
         ) VALUES
         ('42000000-0000-0000-0000-000000009981'::uuid, '41000000-0000-0000-0000-000000009981'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 100),
         ('42000000-0000-0000-0000-000000009982'::uuid, '41000000-0000-0000-0000-000000009982'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 100),
         ('42000000-0000-0000-0000-000000009983'::uuid, '41000000-0000-0000-0000-000000009983'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 110),
         ('42000000-0000-0000-0000-000000009984'::uuid, '41000000-0000-0000-0000-000000009984'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 120),
         ('42000000-0000-0000-0000-000000009985'::uuid, '41000000-0000-0000-0000-000000009985'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 130),
         ('42000000-0000-0000-0000-000000009986'::uuid, '41000000-0000-0000-0000-000000009986'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 105),
         ('42000000-0000-0000-0000-000000009987'::uuid, '41000000-0000-0000-0000-000000009987'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 115),
         ('42000000-0000-0000-0000-000000009988'::uuid, '41000000-0000-0000-0000-000000009988'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 125),
         ('42000000-0000-0000-0000-000000009989'::uuid, '41000000-0000-0000-0000-000000009989'::uuid, '32000000-0000-0000-0000-000000000002'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 100),
         ('42000000-0000-0000-0000-000000009990'::uuid, '41000000-0000-0000-0000-000000009990'::uuid, '32000000-0000-0000-0000-000000000002'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 102),
         ('42000000-0000-0000-0000-000000009991'::uuid, '41000000-0000-0000-0000-000000009991'::uuid, '32000000-0000-0000-0000-000000000002'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 98)",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("workout exercise inserts should succeed");

    sqlx::query(
        "INSERT INTO workout_sets (
            id,
            workout_exercise_id,
            user_id,
            set_index,
            set_side,
            repetition_value,
            load_display_value,
            load_display_unit,
            load_canonical_kg,
            completed_at
         ) VALUES
         ('43000000-0000-0000-0000-000000009981'::uuid, '42000000-0000-0000-0000-000000009988'::uuid, $1::uuid, 1, 'BILATERAL', 8, 42.5, 'kg', 42.5, NOW() - INTERVAL '5 days'),
         ('43000000-0000-0000-0000-000000009982'::uuid, '42000000-0000-0000-0000-000000009991'::uuid, $1::uuid, 1, 'BILATERAL', 12, 32.0, 'kg', 32.0, NOW() - INTERVAL '8 days')",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("workout set inserts should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/workouts/exercises-performance")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let groups = body["groups"].as_array().expect("groups should be present");
    assert_eq!(groups.len(), 2);
    assert_eq!(groups[0]["tone"], json!("GREEN"));
    assert_eq!(groups[1]["tone"], json!("GRAY"));

    let green_row = &groups[0]["rows"][0];
    assert_eq!(
        green_row["variant_id"],
        json!("20000000-0000-0000-0000-000000000001")
    );
    assert_eq!(green_row["variant_session_count_30d"], json!(6));
    assert_eq!(green_row["performance_status"], json!("AVAILABLE"));
    assert_eq!(green_row["performance_tone"], json!("GREEN"));
    assert_eq!(
        green_row["last_performed_first_set_display"],
        json!("42.5 kg x 8 reps")
    );

    let selected_average = green_row["selected_station_average_score_30d"]
        .as_f64()
        .expect("selected average should be numeric");
    let expected_station2_average = (1.05_f64 + (115.0 / 105.0) + (125.0 / 115.0)) / 3.0;
    assert!((selected_average - expected_station2_average).abs() < 1e-9);
    let station1_average = (1.10_f64 + (120.0 / 110.0) + (130.0 / 120.0)) / 3.0;
    assert!((selected_average - station1_average).abs() > 1e-4);

    let gray_row = &groups[1]["rows"][0];
    assert_eq!(
        gray_row["variant_id"],
        json!("20000000-0000-0000-0000-000000000002")
    );
    assert_eq!(gray_row["variant_session_count_30d"], json!(2));
    assert_eq!(gray_row["performance_status"], json!("NOT_ENOUGH_DATA"));
    assert_eq!(gray_row["performance_tone"], json!("GRAY"));
    assert!(gray_row["selected_station_average_score_30d"].is_null());
}

#[tokio::test]
async fn get_workout_exercises_performance_prefers_higher_scored_sample_count_over_recency() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    clear_user_workout_history(&pool, DEV_USER_ID).await;

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES
         ('41000000-0000-0000-0000-000000009971'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '45 days' - INTERVAL '30 minutes', NOW() - INTERVAL '45 days'),
         ('41000000-0000-0000-0000-000000009972'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '46 days' - INTERVAL '30 minutes', NOW() - INTERVAL '46 days'),
         ('41000000-0000-0000-0000-000000009973'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '20 days' - INTERVAL '30 minutes', NOW() - INTERVAL '20 days'),
         ('41000000-0000-0000-0000-000000009974'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '15 days' - INTERVAL '30 minutes', NOW() - INTERVAL '15 days'),
         ('41000000-0000-0000-0000-000000009975'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, $1::uuid, NOW() - INTERVAL '10 days' - INTERVAL '30 minutes', NOW() - INTERVAL '10 days'),
         ('41000000-0000-0000-0000-000000009976'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '5 days' - INTERVAL '30 minutes', NOW() - INTERVAL '5 days'),
         ('41000000-0000-0000-0000-000000009977'::uuid, '31000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, $1::uuid, NOW() - INTERVAL '4 days' - INTERVAL '30 minutes', NOW() - INTERVAL '4 days')",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("workout inserts should succeed");

    sqlx::query(
        "INSERT INTO workout_exercises (
            id,
            workout_id,
            training_plan_exercise_id,
            user_id,
            position,
            selected_variant_id,
            selected_station_id,
            selected_training_plan_exercise_variant_id,
            performance_score
         ) VALUES
         ('42000000-0000-0000-0000-000000009971'::uuid, '41000000-0000-0000-0000-000000009971'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 100),
         ('42000000-0000-0000-0000-000000009972'::uuid, '41000000-0000-0000-0000-000000009972'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 100),
         ('42000000-0000-0000-0000-000000009973'::uuid, '41000000-0000-0000-0000-000000009973'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 110),
         ('42000000-0000-0000-0000-000000009974'::uuid, '41000000-0000-0000-0000-000000009974'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 120),
         ('42000000-0000-0000-0000-000000009975'::uuid, '41000000-0000-0000-0000-000000009975'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000001'::uuid, '33000000-0000-0000-0000-000000000001'::uuid, 126),
         ('42000000-0000-0000-0000-000000009976'::uuid, '41000000-0000-0000-0000-000000009976'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 105),
         ('42000000-0000-0000-0000-000000009977'::uuid, '41000000-0000-0000-0000-000000009977'::uuid, '32000000-0000-0000-0000-000000000001'::uuid, $1::uuid, 1, '20000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, '33000000-0000-0000-0000-000000000002'::uuid, 106)",
    )
    .bind(DEV_USER_ID)
    .execute(&pool)
    .await
    .expect("workout exercise inserts should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/workouts/exercises-performance")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let groups = body["groups"].as_array().expect("groups should be present");
    assert_eq!(groups.len(), 1);
    let row = &groups[0]["rows"][0];

    let selected_average = row["selected_station_average_score_30d"]
        .as_f64()
        .expect("selected average should be numeric");
    let expected_station1_average = (1.10_f64 + (120.0 / 110.0) + (126.0 / 120.0)) / 3.0;
    assert!((selected_average - expected_station1_average).abs() < 1e-9);
    assert_eq!(row["variant_session_count_30d"], json!(5));
}

#[tokio::test]
async fn get_workout_detail_returns_contract_shape_with_ordered_exercises_and_sets() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz)",
    )
    .bind("41000000-0000-0000-0000-000000009920")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(DEV_USER_ID)
    .bind("2026-02-02T09:00:00Z")
    .bind("2026-02-02T09:30:00Z")
    .execute(&pool)
    .await
    .expect("workout insert should succeed");

    sqlx::query(
        "INSERT INTO workout_exercises (
            id,
            workout_id,
            training_plan_exercise_id,
            user_id,
            position,
            selected_variant_id,
            selected_station_id,
            selected_training_plan_exercise_variant_id,
            performance_score
         ) VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid, $7::uuid, $8::uuid, $9),
         ($10::uuid, $2::uuid, $11::uuid, $4::uuid, $12, NULL, NULL, NULL, $13)",
    )
    .bind("42000000-0000-0000-0000-000000009920")
    .bind("41000000-0000-0000-0000-000000009920")
    .bind("32000000-0000-0000-0000-000000000002")
    .bind(DEV_USER_ID)
    .bind(2_i32)
    .bind("20000000-0000-0000-0000-000000000002")
    .bind("50000000-0000-0000-0000-000000000002")
    .bind("33000000-0000-0000-0000-000000000002")
    .bind(120_i32)
    .bind("42000000-0000-0000-0000-000000009921")
    .bind("32000000-0000-0000-0000-000000000001")
    .bind(1_i32)
    .bind(100_i32)
    .execute(&pool)
    .await
    .expect("workout exercises insert should succeed");

    sqlx::query(
        "INSERT INTO workout_sets (
            id,
            workout_exercise_id,
            user_id,
            set_index,
            set_side,
            repetition_value,
            load_display_value,
            load_display_unit,
            load_canonical_kg,
            completed_at
         ) VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, 'kg', $8, $9::timestamptz),
         ($10::uuid, $2::uuid, $3::uuid, $11, $12, $13, $14, 'kg', $15, $16::timestamptz),
         ($17::uuid, $18::uuid, $3::uuid, $19, $20, $21, $22, 'kg', $23, $24::timestamptz)",
    )
    .bind("43000000-0000-0000-0000-000000009920")
    .bind("42000000-0000-0000-0000-000000009920")
    .bind(DEV_USER_ID)
    .bind(1_i32)
    .bind("RIGHT")
    .bind(12_i32)
    .bind(30.0_f64)
    .bind(30.0_f64)
    .bind("2026-02-02T09:05:00Z")
    .bind("43000000-0000-0000-0000-000000009921")
    .bind(1_i32)
    .bind("LEFT")
    .bind(12_i32)
    .bind(30.0_f64)
    .bind(30.0_f64)
    .bind("2026-02-02T09:04:00Z")
    .bind("43000000-0000-0000-0000-000000009922")
    .bind("42000000-0000-0000-0000-000000009921")
    .bind(1_i32)
    .bind("BILATERAL")
    .bind(10_i32)
    .bind(20.0_f64)
    .bind(20.0_f64)
    .bind("2026-02-02T09:03:00Z")
    .execute(&pool)
    .await
    .expect("workout sets insert should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/workouts/41000000-0000-0000-0000-000000009920")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], json!("41000000-0000-0000-0000-000000009920"));
    assert_eq!(body["hero"]["duration_minutes"], json!(30));
    assert_eq!(body["completion_stats"]["exercise_count"], json!(2));
    assert_eq!(body["completion_stats"]["completed_set_count"], json!(3));
    assert_eq!(
        body["completion_stats"]["workout_progress_status"],
        json!("NOT_ENOUGH_DATA")
    );
    assert!(body["completion_stats"]["workout_progress"].is_null());

    let exercises = body["exercises"]
        .as_array()
        .expect("exercises should be an array");
    assert_eq!(exercises.len(), 2);
    assert_eq!(exercises[0]["exercise_position"], json!(1));
    assert!(exercises[0]["variant_name"].is_null());
    assert_eq!(exercises[1]["exercise_position"], json!(2));
    assert!(exercises[1]["variant_name"].is_string());
    assert!(exercises[1]["station_name"].is_string());
    assert_eq!(exercises[1]["set_tracking_mode"], json!("UNILATERAL"));

    let exercise_two_sets = exercises[1]["sets"]
        .as_array()
        .expect("sets should be an array");
    assert_eq!(exercise_two_sets.len(), 2);
    assert_eq!(exercise_two_sets[0]["set_side"], json!("LEFT"));
    assert_eq!(exercise_two_sets[1]["set_side"], json!("RIGHT"));
}

#[tokio::test]
async fn get_workout_detail_returns_not_found_for_inaccessible_workout() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    sqlx::query(
        "INSERT INTO users (id, display_name, login_name)
         VALUES ($1::uuid, $2, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(USER_B_ID)
    .bind("User B")
    .bind("user-b")
    .execute(&pool)
    .await
    .expect("user-b insert should succeed");

    sqlx::query(
        "INSERT INTO workouts (
            id,
            training_plan_version_id,
            gym_id,
            user_id,
            started_at,
            completed_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::timestamptz, $6::timestamptz)",
    )
    .bind("41000000-0000-0000-0000-000000009921")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .bind("2026-02-02T10:00:00Z")
    .bind("2026-02-02T10:30:00Z")
    .execute(&pool)
    .await
    .expect("foreign workout insert should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/workouts/41000000-0000-0000-0000-000000009921")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["message"], json!("Workout not found"));
}

#[tokio::test]
async fn create_active_workout_returns_missing_exercise_context_when_gym_is_unrealizable() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    sqlx::query(
        "INSERT INTO gyms (id, name)
         VALUES ($1::uuid, $2)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind("00000000-0000-0000-0000-000000009001")
    .bind("No Options Gym")
    .execute(&pool)
    .await
    .expect("gym insert should succeed");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let mut payload = create_active_workout_payload();
    payload["gym_id"] = json!("00000000-0000-0000-0000-000000009001");
    payload["exercises"][0]["selected_training_plan_exercise_variant_id"] =
        json!("33000000-0000-0000-0000-000000000001");
    payload["exercises"][0]["selected_variant_id"] = json!("20000000-0000-0000-0000-000000000001");
    payload["exercises"][0]["selected_station_id"] = json!("50000000-0000-0000-0000-000000000001");

    let cookie = make_auth_cookie(&pool).await;
    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
            .header("cookie", cookie)
            .body(Body::from(payload.to_string()))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body["message"],
        "Configured-gym workout start requires realizable options for every plan exercise"
    );
    assert_eq!(
        body["details"]["missing_exercises"]
            .as_array()
            .unwrap()
            .len(),
        4
    );
    assert_eq!(
        body["details"]["missing_exercises"][0]["reason"],
        "no_realizable_option_in_selected_gym"
    );
}

#[tokio::test]
async fn skipped_exercise_state_persists_and_restores_on_resume() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;

    let (status, create_body) = json_response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
            .header("cookie", cookie.clone())
            .body(Body::from(create_active_workout_payload().to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let workout_id = create_body["workout"]["id"]
        .as_str()
        .expect("workout id should be present");
    let skipped_at = "2026-02-01T09:10:00Z";
    let update_payload = json!({
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "",
        "started_at": "2026-02-01T09:00:00Z",
        "current_exercise_position": 3,
        "total_exercise_count": 6,
        "last_confirmed_exercise_position": 2,
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000001",
                "position": 1,
                "selected_training_plan_exercise_variant_id": null,
                "selected_variant_id": null,
                "load_input_mode": "TOTAL",
                "set_tracking_mode": "BILATERAL",
                "selected_station_id": null,
                "skipped_at": null,
                "completed_sets": [
                    {
                        "set_index": 1,
                        "set_side": "BILATERAL",
                        "load_value": 20.0,
                        "repetition_kind": "REPS",
                        "repetition_value": 10
                    }
                ]
            },
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000002",
                "position": 2,
                "selected_training_plan_exercise_variant_id": null,
                "selected_variant_id": null,
                "load_input_mode": "TOTAL",
                "set_tracking_mode": "BILATERAL",
                "selected_station_id": null,
                "skipped_at": skipped_at,
                "completed_sets": []
            }
        ]
    });

    let (status, update_body) = json_response(
        app.clone(),
        Request::builder()
            .method("PUT")
            .uri(format!("/api/active-workout/{workout_id}"))
            .header("content-type", "application/json")
            .header("cookie", cookie.clone())
            .body(Body::from(update_payload.to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(update_body["workout"]["current_exercise_position"], 3);
    assert_eq!(
        suggested_set_for_position(&update_body, 1),
        suggested_set_for_position(&create_body, 1)
    );
    assert!(suggested_set_for_position(&update_body, 2)["suggested_load_input_kg"].is_number());
    assert_eq!(
        suggested_set_for_position(&update_body, 2)["repetition_kind"],
        json!("REPS")
    );
    assert!(suggested_set_for_position(&update_body, 2)["repetition_value"].is_number());

    let (status, resumed_body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/active-workout")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(resumed_body["workout"]["current_exercise_position"], 3);
    assert_eq!(
        suggested_set_for_position(&resumed_body, 1),
        suggested_set_for_position(&update_body, 1)
    );
    assert_eq!(
        suggested_set_for_position(&resumed_body, 2),
        suggested_set_for_position(&update_body, 2)
    );

    let skipped_exercise = resumed_body["workout"]["exercises"]
        .as_array()
        .and_then(|exercises| {
            exercises
                .iter()
                .find(|exercise| exercise["position"] == json!(2))
        })
        .expect("skipped exercise should exist");
    let skipped_at_value = skipped_exercise["skipped_at"]
        .as_str()
        .expect("skipped_at should be a string");
    assert!(skipped_at_value.starts_with("2026-02-01 09:10:00"));
    assert_eq!(
        skipped_exercise["completed_sets"]
            .as_array()
            .expect("completed_sets should be an array")
            .len(),
        0
    );
}

#[tokio::test]
async fn unilateral_left_progress_update_persists_and_resumes_on_right_side() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;

    let create_payload = json!({
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "50000000-0000-0000-0000-000000000001",
        "started_at": "2026-02-01T09:00:00Z",
        "current_exercise_position": 2,
        "total_exercise_count": 6,
        "first_confirmed_exercise_position": 2,
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000002",
                "position": 2,
                "selected_training_plan_exercise_variant_id": "33000000-0000-0000-0000-000000000002",
                "selected_variant_id": "20000000-0000-0000-0000-000000000002",
                "load_input_mode": "PER_SIDE",
                "set_tracking_mode": "UNILATERAL",
                "selected_station_id": "50000000-0000-0000-0000-000000000002",
                "completed_sets": [
                    {
                        "set_index": 1,
                        "set_side": "LEFT",
                        "load_value": 20.0,
                        "repetition_kind": "REPS",
                        "repetition_value": 10
                    }
                ]
            }
        ]
    });

    let (status, create_body) = json_response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
            .header("cookie", cookie.clone())
            .body(Body::from(create_payload.to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let workout_id = create_body["workout"]["id"]
        .as_str()
        .expect("workout id should be present");

    let update_payload = json!({
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "50000000-0000-0000-0000-000000000001",
        "started_at": "2026-02-01T09:00:00Z",
        "current_exercise_position": 3,
        "total_exercise_count": 6,
        "last_confirmed_exercise_position": 2,
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000002",
                "position": 2,
                "selected_training_plan_exercise_variant_id": "33000000-0000-0000-0000-000000000002",
                "selected_variant_id": "20000000-0000-0000-0000-000000000002",
                "load_input_mode": "PER_SIDE",
                "set_tracking_mode": "UNILATERAL",
                "selected_station_id": "50000000-0000-0000-0000-000000000002",
                "completed_sets": [
                    {
                        "set_index": 1,
                        "set_side": "LEFT",
                        "load_value": 20.0,
                        "repetition_kind": "REPS",
                        "repetition_value": 10
                    }
                ]
            }
        ]
    });

    let (status, update_body) = json_response(
        app.clone(),
        Request::builder()
            .method("PUT")
            .uri(format!("/api/active-workout/{workout_id}"))
            .header("content-type", "application/json")
            .header("cookie", cookie.clone())
            .body(Body::from(update_payload.to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(update_body["workout"]["current_exercise_position"], 2);
    assert_eq!(
        suggested_set_for_position(&update_body, 2)["set_side"],
        json!("RIGHT")
    );
    assert_eq!(
        suggested_set_for_position(&update_body, 2)["set_index"],
        json!(1)
    );

    let (status, resumed_body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/active-workout")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(resumed_body["workout"]["current_exercise_position"], 2);
    assert_eq!(
        suggested_set_for_position(&resumed_body, 2)["set_side"],
        json!("RIGHT")
    );
    assert_eq!(
        suggested_set_for_position(&resumed_body, 2)["set_index"],
        json!(1)
    );
}

#[tokio::test]
async fn active_workout_secs_variant_serializes_repetition_kind_and_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let pool = db.pool.clone();
    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let cookie = make_auth_cookie(&pool).await;

    let create_payload = json!({
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "50000000-0000-0000-0000-000000000001",
        "started_at": "2026-02-01T09:00:00Z",
        "current_exercise_position": 6,
        "total_exercise_count": 6,
        "first_confirmed_exercise_position": 6,
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000005",
                "position": 6,
                "selected_training_plan_exercise_variant_id": "33000000-0000-0000-0000-000000000005",
                "selected_variant_id": "20000000-0000-0000-0000-000000000004",
                "load_input_mode": "TOTAL",
                "set_tracking_mode": "BILATERAL",
                "selected_station_id": null,
                "completed_sets": [
                    {
                        "set_index": 1,
                        "set_side": "BILATERAL",
                        "load_value": null,
                        "repetition_kind": "SECS",
                        "repetition_value": 45
                    }
                ]
            }
        ]
    });

    let (status, body) = json_response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
            .header("cookie", cookie.clone())
            .body(Body::from(create_payload.to_string()))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::CREATED);
    let secs_exercise = exercise_for_position(&body, 6);
    assert_eq!(
        secs_exercise["completed_sets"][0]["repetition_kind"],
        json!("SECS")
    );
    assert_eq!(
        secs_exercise["completed_sets"][0]["repetition_value"],
        json!(45)
    );
    assert_eq!(
        secs_exercise["suggested_set"]["repetition_kind"],
        json!("SECS")
    );
    assert_eq!(secs_exercise["suggested_set"]["repetition_value"], json!(86));

    let (status, resumed_body) = json_response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/active-workout")
            .header("cookie", cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let resumed_secs_exercise = exercise_for_position(&resumed_body, 6);
    assert_eq!(
        resumed_secs_exercise["completed_sets"][0]["repetition_kind"],
        json!("SECS")
    );
    assert_eq!(
        resumed_secs_exercise["completed_sets"][0]["repetition_value"],
        json!(45)
    );
    assert_eq!(
        resumed_secs_exercise["suggested_set"]["repetition_value"],
        json!(86)
    );
}
