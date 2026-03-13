mod support;

use self::support::{test_lock, TestDatabase};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use pumpbuddy_backend::{
    api::{app_router, AppState},
    persistence::DomainRepository,
};
use serde_json::{json, Value};
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
                "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001001",
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
                "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001001",
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

#[tokio::test]
async fn active_workout_routes_report_missing_state_and_conflicts() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;

    let app = app_router(AppState {
        repository: DomainRepository::new(db.pool),
    });

    let (status, body) = json_response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/api/active-workout")
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
            .body(Body::from(create_active_workout_payload().to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["workout"]["total_exercise_count"], 5);
    assert_eq!(
        body["workout"]["exercises"][0]["suggested_set"]["load_value"],
        20.0
    );

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/active-workout")
            .header("content-type", "application/json")
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

    let app = app_router(AppState {
        repository: DomainRepository::new(db.pool),
    });
    let mut payload = create_workout_payload();
    payload["started_at"] = json!("not-a-timestamp");

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workouts")
            .header("content-type", "application/json")
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

    let app = app_router(AppState {
        repository: DomainRepository::new(db.pool),
    });
    let mut payload = create_workout_payload();
    payload["exercises"][0]["selected_variant_id"] = json!("00000000-0000-0000-0000-000000009999");

    let (status, body) = json_response(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/workouts")
            .header("content-type", "application/json")
            .body(Body::from(payload.to_string()))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["message"], "A referenced record was not found");
}
