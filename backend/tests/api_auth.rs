mod support;

use self::support::{test_lock, TestDatabase};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use pumpbuddy_backend::{
    api::{app_router, AppState},
    persistence::DomainRepository,
};
use rand::rngs::OsRng;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use tower::ServiceExt;

const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";

async fn insert_user_with_secret(pool: &PgPool, login: &str, password: &str) {
    let user_id: String = sqlx::query(
        "INSERT INTO users (display_name, login_name)
         VALUES ($1, $2)
         RETURNING id::text AS id",
    )
    .bind("Auth Integration User")
    .bind(login)
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

    sqlx::query(
        "INSERT INTO user_secrets (user_id, secret_hash, label)
         VALUES ($1::uuid, $2, $3)",
    )
    .bind(user_id)
    .bind(secret_hash)
    .bind("integration")
    .execute(pool)
    .await
    .expect("secret should insert");
}

async fn insert_default_user_secret(pool: &PgPool, password: &str) {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let secret_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .expect("hash should succeed")
        .to_string();

    sqlx::query(
        "INSERT INTO user_secrets (user_id, secret_hash, label)
         VALUES ($1::uuid, $2, $3)",
    )
    .bind(DEV_USER_ID)
    .bind(secret_hash)
    .bind("default-integration")
    .execute(pool)
    .await
    .expect("default secret should insert");
}

async fn response(app: axum::Router, request: Request<Body>) -> (StatusCode, Vec<u8>) {
    let response = app.oneshot(request).await.expect("request should succeed");
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read")
        .to_vec();
    (status, body)
}

#[tokio::test]
async fn auth_login_accepts_login_and_password() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-user", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool),
    });

    let (status, body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-user",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let payload: Value = serde_json::from_slice(&body).expect("body should be json");
    assert_eq!(payload["authenticated"], json!(true));
}

#[tokio::test]
async fn auth_login_allows_blank_login_with_default_user_fallback() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_default_user_secret(&pool, "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool),
    });

    let (status, body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let payload: Value = serde_json::from_slice(&body).expect("body should be json");
    assert_eq!(payload["authenticated"], json!(true));
}

#[tokio::test]
async fn auth_and_protected_unauthorized_responses_use_empty_401_bodies() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_default_user_secret(&pool, "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool),
    });

    let (invalid_login_status, invalid_login_body) = response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "does-not-exist",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(invalid_login_status, StatusCode::UNAUTHORIZED);
    assert!(invalid_login_body.is_empty());

    let (invalid_password_status, invalid_password_body) = response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "",
                    "password": "wrong-password"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(invalid_password_status, StatusCode::UNAUTHORIZED);
    assert!(invalid_password_body.is_empty());

    let (session_status, session_body) = response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/auth/session")
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(session_status, StatusCode::UNAUTHORIZED);
    assert!(session_body.is_empty());

    let (protected_status, protected_body) = response(
        app,
        Request::builder()
            .method("GET")
            .uri("/api/gyms")
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(protected_status, StatusCode::UNAUTHORIZED);
    assert!(protected_body.is_empty());
}
