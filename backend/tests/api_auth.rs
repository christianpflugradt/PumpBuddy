mod support;

use self::support::{test_lock, TestDatabase};
use argon2::{
    password_hash::{PasswordHash, SaltString},
    Argon2, PasswordHasher, PasswordVerifier,
};
use axum::{
    body::{to_bytes, Body},
    http::{HeaderMap, Request, StatusCode},
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

async fn response_with_headers(
    app: axum::Router,
    request: Request<Body>,
) -> (StatusCode, HeaderMap, Vec<u8>) {
    let response = app.oneshot(request).await.expect("request should succeed");
    let status = response.status();
    let headers = response.headers().clone();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read")
        .to_vec();
    (status, headers, body)
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

#[tokio::test]
async fn auth_session_patch_persists_display_name_update() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-patch", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-patch",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (patch_status, patch_body) = response(
        app,
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Renamed",
                    "favorite_gym_id": "00000000-0000-0000-0000-000000000123"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(patch_status, StatusCode::OK);

    let payload: Value = serde_json::from_slice(&patch_body).expect("body should be json");
    assert_eq!(payload["authenticated"], json!(true));
    assert_eq!(
        payload["user"]["display_name"],
        json!("Integration Renamed")
    );
    assert_eq!(
        payload["user"]["favorite_gym_id"],
        json!("00000000-0000-0000-0000-000000000123")
    );
    assert_eq!(payload["user"]["max_load_kg"], json!(200.0));

    let persisted_display_name: String = sqlx::query(
        "SELECT display_name
         FROM users
         WHERE login_name = $1",
    )
    .bind("integration-auth-patch")
    .fetch_one(&pool)
    .await
    .expect("updated user should exist")
    .get("display_name");
    assert_eq!(persisted_display_name, "Integration Renamed");

    let persisted_favorite_gym_id: String = sqlx::query(
        "SELECT preference_value
         FROM user_preferences
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
           AND preference_key = 'favorite_gym_id'",
    )
    .bind("integration-auth-patch")
    .fetch_one(&pool)
    .await
    .expect("favorite gym preference should persist")
    .get("preference_value");
    assert_eq!(
        persisted_favorite_gym_id,
        "00000000-0000-0000-0000-000000000123"
    );
}

#[tokio::test]
async fn auth_session_get_returns_favorite_gym_preference() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-session-favorite", "correct-horse").await;

    sqlx::query(
        "INSERT INTO user_preferences (user_id, preference_key, preference_value)
         SELECT id, 'favorite_gym_id', $1
         FROM users
         WHERE login_name = $2",
    )
    .bind("00000000-0000-0000-0000-000000000321")
    .bind("integration-auth-session-favorite")
    .execute(&pool)
    .await
    .expect("favorite gym preference should insert");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-session-favorite",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (session_status, session_body) = response(
        app,
        Request::builder()
            .method("GET")
            .uri("/auth/session")
            .header("cookie", session_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(session_status, StatusCode::OK);

    let payload: Value = serde_json::from_slice(&session_body).expect("body should be json");
    assert_eq!(payload["authenticated"], json!(true));
    assert_eq!(
        payload["user"]["favorite_gym_id"],
        json!("00000000-0000-0000-0000-000000000321")
    );
    assert_eq!(payload["user"]["max_load_kg"], json!(200.0));
}

#[tokio::test]
async fn auth_session_patch_persists_max_load_kg_update() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-max-load", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-max-load",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (patch_status, patch_body) = response(
        app,
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Renamed",
                    "max_load_kg": 250
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(patch_status, StatusCode::OK);

    let payload: Value = serde_json::from_slice(&patch_body).expect("body should be json");
    assert_eq!(payload["authenticated"], json!(true));
    assert_eq!(payload["user"]["max_load_kg"], json!(250.0));

    let persisted_max_load: String = sqlx::query(
        "SELECT preference_value
         FROM user_preferences
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
           AND preference_key = 'max_load_kg'",
    )
    .bind("integration-auth-max-load")
    .fetch_one(&pool)
    .await
    .expect("max-load preference should persist")
    .get("preference_value");
    assert_eq!(persisted_max_load, "250");
}

#[tokio::test]
async fn auth_session_patch_rejects_invalid_favorite_gym_uuid() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-invalid-favorite", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-invalid-favorite",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (patch_status, patch_body) = response(
        app,
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Renamed",
                    "favorite_gym_id": "not-a-uuid"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(patch_status, StatusCode::BAD_REQUEST);

    let payload: Value = serde_json::from_slice(&patch_body).expect("body should be json");
    assert_eq!(
        payload["message"],
        json!("favorite_gym_id must be a valid uuid")
    );
}

#[tokio::test]
async fn auth_session_patch_rejects_out_of_range_max_load_kg_bounds() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-invalid-max-load", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-invalid-max-load",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (low_patch_status, low_patch_body) = response(
        app.clone(),
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Renamed",
                    "max_load_kg": 99
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(low_patch_status, StatusCode::BAD_REQUEST);

    let payload: Value = serde_json::from_slice(&low_patch_body).expect("body should be json");
    assert_eq!(
        payload["message"],
        json!("max_load_kg must be between 100 and 999")
    );

    let (high_patch_status, high_patch_body) = response(
        app,
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Renamed",
                    "max_load_kg": 1000
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(high_patch_status, StatusCode::BAD_REQUEST);

    let payload: Value = serde_json::from_slice(&high_patch_body).expect("body should be json");
    assert_eq!(
        payload["message"],
        json!("max_load_kg must be between 100 and 999")
    );
}

#[tokio::test]
async fn auth_password_post_accepts_new_password_with_exactly_8_characters() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-password", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-password",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (status, body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/password")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "current_password": "correct-horse",
                    "new_password": "12345678",
                    "confirm_new_password": "12345678"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(body.is_empty());

    let row = sqlx::query(
        "SELECT
            SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END)::bigint AS active_count,
            SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END)::bigint AS revoked_count
         FROM user_secrets
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )",
    )
    .bind("integration-auth-password")
    .fetch_one(&pool)
    .await
    .expect("secret counts should load");

    let active_count: i64 = row.get("active_count");
    let revoked_count: i64 = row.get("revoked_count");
    assert_eq!(active_count, 1);
    assert_eq!(revoked_count, 1);

    let secret_hash: String = sqlx::query(
        "SELECT secret_hash
         FROM user_secrets
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
           AND revoked_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind("integration-auth-password")
    .fetch_one(&pool)
    .await
    .expect("active secret should exist")
    .get("secret_hash");

    let parsed_hash = PasswordHash::new(&secret_hash).expect("hash should parse");
    let argon2 = Argon2::default();
    assert!(argon2
        .verify_password("12345678".as_bytes(), &parsed_hash)
        .is_ok());
    assert!(argon2
        .verify_password("correct-horse".as_bytes(), &parsed_hash)
        .is_err());
}

#[tokio::test]
async fn auth_password_post_rejects_new_password_shorter_than_8_characters() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-password-short", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-password-short",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (status, body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/password")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "current_password": "correct-horse",
                    "new_password": "1234567",
                    "confirm_new_password": "1234567"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let payload: Value = serde_json::from_slice(&body).expect("body should be json");
    assert_eq!(
        payload["message"],
        json!("new_password must be at least 8 characters")
    );

    let row = sqlx::query(
        "SELECT
            SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END)::bigint AS active_count,
            SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END)::bigint AS revoked_count
         FROM user_secrets
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )",
    )
    .bind("integration-auth-password-short")
    .fetch_one(&pool)
    .await
    .expect("secret counts should load");

    let active_count: i64 = row.get("active_count");
    let revoked_count: i64 = row.get("revoked_count");
    assert_eq!(active_count, 1);
    assert_eq!(revoked_count, 0);
}

#[tokio::test]
async fn auth_password_post_rejects_wrong_current_password_with_conflict() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    insert_user_with_secret(&pool, "integration-auth-password-conflict", "correct-horse").await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let (login_status, login_headers, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-password-conflict",
                    "password": "correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(login_status, StatusCode::OK);

    let session_cookie = login_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie");

    let (status, body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/password")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "current_password": "wrong-current",
                    "new_password": "new-correct-horse",
                    "confirm_new_password": "new-correct-horse"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let payload: Value = serde_json::from_slice(&body).expect("body should be json");
    assert_eq!(
        payload["message"],
        json!("Current password validation failed")
    );

    let active_count: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM user_secrets
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
           AND revoked_at IS NULL",
    )
    .bind("integration-auth-password-conflict")
    .fetch_one(&pool)
    .await
    .expect("active secret count should load")
    .get("count");
    assert_eq!(active_count, 1);
}
