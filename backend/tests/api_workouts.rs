mod support;

use self::support::{test_lock, TestDatabase};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use pumpbuddy_backend::application::auth::login_with_access_key;
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
                "selected_plan_exercise_option_id": null,
                "selected_variant_id": null,
                "selected_station_id": null,
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
        "training_plan_id": "30000000-0000-0000-0000-000000000001",
        "gym_id": "50000000-0000-0000-0000-000000000001",
        "started_at": "2026-01-15T09:00:00Z",
        "completed_at": "2026-01-15T09:20:00Z",
        "exercises": [
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000001",
                "position": 1,
                "selected_plan_exercise_option_id": "33000000-0000-0000-0000-000000000001",
                "selected_variant_id": "20000000-0000-0000-0000-000000000001",
                "selected_station_id": "50000000-0000-0000-0000-000000000001",
                "set": {
                    "load_value": 20.0,
                    "reps": 10
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
    // Seed data in init.sql belongs to the dev user; auth as that user for API fixtures.
    let access_key = "correct-horse";

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let secret_hash = argon2
        .hash_password(access_key.as_bytes(), &salt)
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
    let session = login_with_access_key(&repository, access_key, Some("PumpBuddy Test"), None)
        .await
        .expect("login should succeed");

    format!("__Host-pb_session={}", session.session_token)
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
    assert!(body["workout"]["exercises"][0]["suggested_set"]["load_value"].is_number());
    assert!(body["workout"]["exercises"][0]["suggested_set"]["reps"].is_number());

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
                "selected_plan_exercise_option_id": null,
                "selected_variant_id": null,
                "selected_station_id": null,
                "set": {
                    "load_value": 20.0,
                    "reps": 10
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
    payload["exercises"][0]["selected_plan_exercise_option_id"] =
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
        6
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
                "selected_plan_exercise_option_id": null,
                "selected_variant_id": null,
                "selected_station_id": null,
                "skipped_at": null,
                "completed_sets": [
                    {
                        "load_value": 20.0,
                        "reps": 10
                    }
                ]
            },
            {
                "training_plan_exercise_id": "32000000-0000-0000-0000-000000000002",
                "position": 2,
                "selected_plan_exercise_option_id": null,
                "selected_variant_id": null,
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
    assert!(suggested_set_for_position(&update_body, 2)["load_value"].is_number());
    assert!(suggested_set_for_position(&update_body, 2)["reps"].is_number());

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
