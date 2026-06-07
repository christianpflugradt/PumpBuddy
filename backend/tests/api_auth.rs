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
use std::net::SocketAddr;
use tower::ServiceExt;

const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";

fn test_password() -> String {
    format!("pw-{}", uuid::Uuid::new_v4().simple())
}

fn test_password_with_len(len: usize) -> String {
    let seed = format!("pw{}", uuid::Uuid::new_v4().simple());
    seed.chars().cycle().take(len).collect()
}

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

async fn insert_gym_for_login(pool: &PgPool, login: &str, gym_id: &str, name: &str) {
    let result = sqlx::query(
        "INSERT INTO gyms (id, user_id, name)
         SELECT $1::uuid, id, $2
         FROM users
         WHERE login_name = $3",
    )
    .bind(gym_id)
    .bind(name)
    .bind(login)
    .execute(pool)
    .await
    .expect("gym should insert");

    assert_eq!(result.rows_affected(), 1);
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
    let mut request = request;
    request
        .extensions_mut()
        .insert(axum::extract::ConnectInfo(SocketAddr::from((
            [127, 0, 0, 1],
            5000,
        ))));
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
    let mut request = request;
    request
        .extensions_mut()
        .insert(axum::extract::ConnectInfo(SocketAddr::from((
            [127, 0, 0, 1],
            5000,
        ))));
    let response = app.oneshot(request).await.expect("request should succeed");
    let status = response.status();
    let headers = response.headers().clone();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read")
        .to_vec();
    (status, headers, body)
}

async fn login_session_cookie(app: axum::Router, login: &str, password: &str) -> String {
    let (status, headers, _) = response_with_headers(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": login,
                    "password": password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("login should return session cookie")
        .to_owned()
}

async fn password_change_attempt_key_for_login(pool: &PgPool, login: &str) -> String {
    let user_id: String = sqlx::query(
        "SELECT id::text AS id
         FROM users
         WHERE login_name = $1",
    )
    .bind(login)
    .fetch_one(pool)
    .await
    .expect("user id should load")
    .get("id");

    format!("password_change:{user_id}")
}

#[tokio::test]
async fn auth_login_accepts_login_and_password() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-user", &password).await;

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
                    "password": password
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
async fn auth_login_rejects_blank_login_even_when_bootstrap_secret_exists() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_default_user_secret(&pool, &password).await;

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
                    "password": password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(body.is_empty(), "blank login should keep generic 401 body");
}

#[tokio::test]
async fn auth_and_protected_unauthorized_responses_use_empty_401_bodies() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    let wrong_password = format!("wrong-{password}");
    insert_default_user_secret(&pool, &password).await;

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
                    "password": password.clone()
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
                    "password": wrong_password
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
async fn auth_login_throttles_repeated_failed_attempts_and_keeps_401_generic() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-throttle", &password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    for _ in 0..5 {
        let (status, body) = response(
            app.clone(),
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "login": "integration-auth-throttle",
                        "password": "wrong-password"
                    })
                    .to_string(),
                ))
                .expect("request should build"),
        )
        .await;

        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(body.is_empty());
    }

    let (blocked_status, blocked_body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-throttle",
                    "password": password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(blocked_status, StatusCode::UNAUTHORIZED);
    assert!(blocked_body.is_empty());

    let principal_row = sqlx::query(
        "SELECT blocked_until::text AS blocked_until
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind("integration-auth-throttle")
    .fetch_one(&pool)
    .await
    .expect("principal attempt row should exist");
    let principal_blocked_until: Option<String> = principal_row.get("blocked_until");
    assert!(principal_blocked_until.is_some());
}

#[tokio::test]
async fn auth_login_success_resets_login_failure_state() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-reset", &password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    for _ in 0..4 {
        let (status, _) = response(
            app.clone(),
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "login": "integration-auth-reset",
                        "password": "wrong-password"
                    })
                    .to_string(),
                ))
                .expect("request should build"),
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }

    let (success_status, _, _) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-reset",
                    "password": password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(success_status, StatusCode::OK);

    let remaining_attempt_rows: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind("integration-auth-reset")
    .fetch_one(&pool)
    .await
    .expect("attempt rows query should succeed")
    .get("count");
    assert_eq!(remaining_attempt_rows, 0);

    let (post_reset_status, post_reset_body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-reset",
                    "password": "wrong-password"
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(post_reset_status, StatusCode::UNAUTHORIZED);
    assert!(post_reset_body.is_empty());

    let principal_failures: i32 = sqlx::query(
        "SELECT failure_count AS failure_count
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind("integration-auth-reset")
    .fetch_one(&pool)
    .await
    .expect("principal attempt row should exist")
    .get("failure_count");
    assert_eq!(principal_failures, 1);
}

#[tokio::test]
async fn auth_login_does_not_throttle_valid_principal_after_unknown_login_spray() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-ip-target", &password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    for attempt in 0..10 {
        let (status, body) = response(
            app.clone(),
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "login": format!("unknown-{attempt}"),
                        "password": "wrong-password"
                    })
                    .to_string(),
                ))
                .expect("request should build"),
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(body.is_empty());
    }

    let (success_status, _) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(
                json!({
                    "login": "integration-auth-ip-target",
                    "password": password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(success_status, StatusCode::OK);

    let target_attempt_rows: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind("integration-auth-ip-target")
    .fetch_one(&pool)
    .await
    .expect("target attempt rows query should succeed")
    .get("count");
    assert_eq!(target_attempt_rows, 0);
}

#[tokio::test]
async fn auth_login_ignores_public_forwarding_headers_without_ip_attempt_rows() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-forwarded-header", &password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    for attempt in 0..10 {
        let spoofed = format!("198.51.100.{}", attempt + 101);
        let (status, body) = response(
            app.clone(),
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .header("x-forwarded-for", spoofed.as_str())
                .header("forwarded", format!("for={spoofed}"))
                .body(Body::from(
                    json!({
                        "login": format!("forwarded-spoof-{attempt}"),
                        "password": "wrong-password"
                    })
                    .to_string(),
                ))
                .expect("request should build"),
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert!(body.is_empty());
    }

    let (success_status, _) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/login")
            .header("content-type", "application/json")
            .header("x-forwarded-for", "198.51.100.200")
            .header("forwarded", "for=198.51.100.200")
            .body(Body::from(
                json!({
                    "login": "integration-auth-forwarded-header",
                    "password": password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(success_status, StatusCode::OK);

    let spoofed_rows: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM auth_login_attempts
         WHERE attempt_key LIKE $1",
    )
    .bind("198.51.100.%")
    .fetch_one(&pool)
    .await
    .expect("spoofed rows query should succeed")
    .get("count");
    assert_eq!(spoofed_rows, 0);
}

#[tokio::test]
async fn auth_logout_revokes_active_session_and_prevents_reuse() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-logout", &password).await;

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
                    "login": "integration-auth-logout",
                    "password": password
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

    let (logout_status, logout_headers, logout_body) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/logout")
            .header("cookie", session_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(logout_status, StatusCode::NO_CONTENT);
    assert!(logout_body.is_empty());

    let clear_cookie = logout_headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("logout should clear session cookie");
    assert!(clear_cookie.contains("__Host-pb_session="));
    assert!(clear_cookie.contains("Max-Age=0"));

    let revoked_row = sqlx::query(
        "SELECT
            revoked_at::text AS revoked_at,
            revoke_reason AS revoke_reason
         FROM sessions
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind("integration-auth-logout")
    .fetch_one(&pool)
    .await
    .expect("session row should exist");

    let revoked_at: Option<String> = revoked_row.get("revoked_at");
    let revoke_reason: Option<String> = revoked_row.get("revoke_reason");
    assert!(revoked_at.is_some());
    assert_eq!(revoke_reason.as_deref(), Some("logout"));

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
    assert_eq!(session_status, StatusCode::UNAUTHORIZED);
    assert!(session_body.is_empty());
}

#[tokio::test]
async fn auth_session_patch_persists_display_name_update() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-patch", &password).await;
    let favorite_gym_id = "00000000-0000-0000-0000-000000000123";
    insert_gym_for_login(
        &pool,
        "integration-auth-patch",
        favorite_gym_id,
        "Integration Favorite Gym",
    )
    .await;

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
                    "password": password
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
                    "favorite_gym_id": favorite_gym_id
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
    assert_eq!(payload["user"]["favorite_gym_id"], json!(favorite_gym_id));
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
    assert_eq!(persisted_favorite_gym_id, favorite_gym_id);
}

#[tokio::test]
async fn auth_session_patch_clears_favorite_gym_preference() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let login = "integration-auth-clear-favorite";
    let password = test_password();
    insert_user_with_secret(&pool, login, &password).await;

    sqlx::query(
        "INSERT INTO user_preferences (user_id, preference_key, preference_value)
         SELECT id, 'favorite_gym_id', $1
         FROM users
         WHERE login_name = $2",
    )
    .bind("71000000-0000-0000-0000-000000000003")
    .bind(login)
    .execute(&pool)
    .await
    .expect("favorite gym preference should insert");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let session_cookie = login_session_cookie(app.clone(), login, &password).await;

    let (patch_status, patch_body) = response(
        app,
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Clear Favorite",
                    "favorite_gym_id": null
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(patch_status, StatusCode::OK);

    let payload: Value = serde_json::from_slice(&patch_body).expect("body should be json");
    assert_eq!(payload["authenticated"], json!(true));
    assert_eq!(payload["user"]["favorite_gym_id"], Value::Null);

    let preference_count: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM user_preferences
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
           AND preference_key = 'favorite_gym_id'",
    )
    .bind(login)
    .fetch_one(&pool)
    .await
    .expect("favorite gym preference count should load")
    .get("count");
    assert_eq!(preference_count, 0);
}

#[tokio::test]
async fn auth_session_patch_rejects_foreign_favorite_gym_preference() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let login = "integration-auth-foreign-favorite-a";
    let foreign_login = "integration-auth-foreign-favorite-b";
    let password = test_password();
    let foreign_password = test_password();
    let owned_gym_id = "71000000-0000-0000-0000-000000000001";
    let foreign_gym_id = "71000000-0000-0000-0000-000000000002";
    insert_user_with_secret(&pool, login, &password).await;
    insert_user_with_secret(&pool, foreign_login, &foreign_password).await;
    insert_gym_for_login(&pool, login, owned_gym_id, "Owned Favorite Gym").await;
    insert_gym_for_login(&pool, foreign_login, foreign_gym_id, "Foreign Favorite Gym").await;

    sqlx::query(
        "INSERT INTO user_preferences (user_id, preference_key, preference_value)
         SELECT id, 'favorite_gym_id', $1
         FROM users
         WHERE login_name = $2",
    )
    .bind(owned_gym_id)
    .bind(login)
    .execute(&pool)
    .await
    .expect("favorite gym preference should insert");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let session_cookie = login_session_cookie(app.clone(), login, &password).await;

    let (patch_status, patch_body) = response(
        app,
        Request::builder()
            .method("PATCH")
            .uri("/auth/session")
            .header("content-type", "application/json")
            .header("cookie", session_cookie)
            .body(Body::from(
                json!({
                    "display_name": "Integration Foreign Favorite",
                    "favorite_gym_id": foreign_gym_id
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(patch_status, StatusCode::BAD_REQUEST);

    let payload: Value = serde_json::from_slice(&patch_body).expect("body should be json");
    assert_eq!(payload["message"], json!("favorite_gym_id is invalid"));

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
    .bind(login)
    .fetch_one(&pool)
    .await
    .expect("favorite gym preference should remain")
    .get("preference_value");
    assert_eq!(persisted_favorite_gym_id, owned_gym_id);
}

#[tokio::test]
async fn auth_session_get_returns_favorite_gym_preference() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-session-favorite", &password).await;

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
                    "password": password
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
async fn auth_session_get_returns_side_menu_middle_click_counts_with_malformed_fallback() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let first_password = test_password();
    let second_password = test_password();
    insert_user_with_secret(&pool, "integration-auth-session-side-menu", &first_password).await;
    insert_user_with_secret(
        &pool,
        "integration-auth-session-side-menu-malformed",
        &second_password,
    )
    .await;

    sqlx::query(
        "INSERT INTO user_preferences (user_id, preference_key, preference_value)
         SELECT id, 'side_menu_middle_click_counts', $1
         FROM users
         WHERE login_name = $2",
    )
    .bind(r#"{"history":2,"gyms":4,"unknown":99}"#)
    .bind("integration-auth-session-side-menu")
    .execute(&pool)
    .await
    .expect("side-menu preference should insert");

    sqlx::query(
        "INSERT INTO user_preferences (user_id, preference_key, preference_value)
         SELECT id, 'side_menu_middle_click_counts', $1
         FROM users
         WHERE login_name = $2",
    )
    .bind("not-json")
    .bind("integration-auth-session-side-menu-malformed")
    .execute(&pool)
    .await
    .expect("malformed side-menu preference should insert");

    let app = app_router(AppState {
        repository: DomainRepository::new(pool),
    });
    let first_session_cookie = login_session_cookie(
        app.clone(),
        "integration-auth-session-side-menu",
        &first_password,
    )
    .await;
    let second_session_cookie = login_session_cookie(
        app.clone(),
        "integration-auth-session-side-menu-malformed",
        &second_password,
    )
    .await;

    let (first_status, first_body) = response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/auth/session")
            .header("cookie", first_session_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(first_status, StatusCode::OK);

    let first_payload: Value = serde_json::from_slice(&first_body).expect("body should be json");
    assert_eq!(
        first_payload["user"]["side_menu_middle_click_counts"],
        json!({
            "progress": 0,
            "history": 2,
            "exercises": 0,
            "training_plans": 0,
            "gyms": 4
        })
    );

    let (second_status, second_body) = response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/auth/session")
            .header("cookie", second_session_cookie.as_str())
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(second_status, StatusCode::OK);

    let second_payload: Value = serde_json::from_slice(&second_body).expect("body should be json");
    assert_eq!(
        second_payload["user"]["side_menu_middle_click_counts"],
        json!({
            "progress": 0,
            "history": 0,
            "exercises": 0,
            "training_plans": 0,
            "gyms": 0
        })
    );

    let (repaired_status, repaired_body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/session/side-menu-middle-clicks")
            .header("content-type", "application/json")
            .header("cookie", second_session_cookie.as_str())
            .body(Body::from(json!({ "screen": "history" }).to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(repaired_status, StatusCode::OK);

    let repaired_payload: Value =
        serde_json::from_slice(&repaired_body).expect("body should be json");
    assert_eq!(
        repaired_payload["user"]["side_menu_middle_click_counts"],
        json!({
            "progress": 0,
            "history": 1,
            "exercises": 0,
            "training_plans": 0,
            "gyms": 0
        })
    );
}

#[tokio::test]
async fn auth_session_side_menu_increment_persists_per_user_counts() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let first_password = test_password();
    let second_password = test_password();
    insert_user_with_secret(&pool, "integration-auth-side-menu-a", &first_password).await;
    insert_user_with_secret(&pool, "integration-auth-side-menu-b", &second_password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });
    let first_session_cookie =
        login_session_cookie(app.clone(), "integration-auth-side-menu-a", &first_password).await;
    let second_session_cookie = login_session_cookie(
        app.clone(),
        "integration-auth-side-menu-b",
        &second_password,
    )
    .await;

    let (history_status, history_body) = response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/session/side-menu-middle-clicks")
            .header("content-type", "application/json")
            .header("cookie", first_session_cookie.as_str())
            .body(Body::from(json!({ "screen": "history" }).to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(history_status, StatusCode::OK);

    let history_payload: Value =
        serde_json::from_slice(&history_body).expect("body should be json");
    assert_eq!(
        history_payload["user"]["side_menu_middle_click_counts"]["history"],
        json!(1)
    );

    let (gyms_status, gyms_body) = response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/session/side-menu-middle-clicks")
            .header("content-type", "application/json")
            .header("cookie", first_session_cookie.as_str())
            .body(Body::from(json!({ "screen": "gyms" }).to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(gyms_status, StatusCode::OK);

    let gyms_payload: Value = serde_json::from_slice(&gyms_body).expect("body should be json");
    assert_eq!(
        gyms_payload["user"]["side_menu_middle_click_counts"],
        json!({
            "progress": 0,
            "history": 1,
            "exercises": 0,
            "training_plans": 0,
            "gyms": 1
        })
    );

    let (repeat_history_status, repeat_history_body) = response(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/session/side-menu-middle-clicks")
            .header("content-type", "application/json")
            .header("cookie", first_session_cookie.as_str())
            .body(Body::from(json!({ "screen": "history" }).to_string()))
            .expect("request should build"),
    )
    .await;
    assert_eq!(repeat_history_status, StatusCode::OK);

    let repeat_history_payload: Value =
        serde_json::from_slice(&repeat_history_body).expect("body should be json");
    assert_eq!(
        repeat_history_payload["user"]["side_menu_middle_click_counts"],
        json!({
            "progress": 0,
            "history": 2,
            "exercises": 0,
            "training_plans": 0,
            "gyms": 1
        })
    );

    let fresh_first_cookie =
        login_session_cookie(app.clone(), "integration-auth-side-menu-a", &first_password).await;
    let (fresh_first_status, fresh_first_body) = response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/auth/session")
            .header("cookie", fresh_first_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(fresh_first_status, StatusCode::OK);

    let fresh_first_payload: Value =
        serde_json::from_slice(&fresh_first_body).expect("body should be json");
    assert_eq!(
        fresh_first_payload["user"]["side_menu_middle_click_counts"]["history"],
        json!(2)
    );
    assert_eq!(
        fresh_first_payload["user"]["side_menu_middle_click_counts"]["gyms"],
        json!(1)
    );

    let (second_status, second_body) = response(
        app,
        Request::builder()
            .method("GET")
            .uri("/auth/session")
            .header("cookie", second_session_cookie)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(second_status, StatusCode::OK);

    let second_payload: Value = serde_json::from_slice(&second_body).expect("body should be json");
    assert_eq!(
        second_payload["user"]["side_menu_middle_click_counts"],
        json!({
            "progress": 0,
            "history": 0,
            "exercises": 0,
            "training_plans": 0,
            "gyms": 0
        })
    );

    let persisted_value: String = sqlx::query(
        "SELECT preference_value
         FROM user_preferences
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )
           AND preference_key = 'side_menu_middle_click_counts'",
    )
    .bind("integration-auth-side-menu-a")
    .fetch_one(&pool)
    .await
    .expect("side-menu preference should persist")
    .get("preference_value");
    let persisted_payload: Value =
        serde_json::from_str(&persisted_value).expect("preference should be json");
    assert_eq!(persisted_payload["history"], json!(2));
    assert_eq!(persisted_payload["gyms"], json!(1));
}

#[tokio::test]
async fn auth_session_patch_persists_max_load_kg_update() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-max-load", &password).await;

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
                    "password": password
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

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-invalid-favorite", &password).await;

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
                    "password": password
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

    let password = test_password();
    insert_user_with_secret(&pool, "integration-auth-invalid-max-load", &password).await;

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
                    "password": password
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

    let current_password = test_password();
    let new_password = test_password_with_len(8);
    insert_user_with_secret(&pool, "integration-auth-password", &current_password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let session_cookie =
        login_session_cookie(app.clone(), "integration-auth-password", &current_password).await;
    let wrong_current_password = format!("wrong-{current_password}");

    for _ in 0..2 {
        let (status, body) = response(
            app.clone(),
            Request::builder()
                .method("POST")
                .uri("/auth/password")
                .header("content-type", "application/json")
                .header("cookie", session_cookie.as_str())
                .body(Body::from(
                    json!({
                        "current_password": wrong_current_password.clone(),
                        "new_password": new_password.clone(),
                        "confirm_new_password": new_password.clone()
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
    }

    let (status, headers, body) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/password")
            .header("content-type", "application/json")
            .header("cookie", session_cookie.as_str())
            .body(Body::from(
                json!({
                    "current_password": current_password.clone(),
                    "new_password": new_password.clone(),
                    "confirm_new_password": new_password.clone()
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(body.is_empty());

    let clear_cookie = headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("password update should clear session cookie");
    assert!(clear_cookie.contains("__Host-pb_session="));
    assert!(clear_cookie.contains("Max-Age=0"));

    let attempt_key =
        password_change_attempt_key_for_login(&pool, "integration-auth-password").await;
    let remaining_attempt_rows: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind(attempt_key)
    .fetch_one(&pool)
    .await
    .expect("attempt rows query should succeed")
    .get("count");
    assert_eq!(remaining_attempt_rows, 0);

    let (protected_status, protected_body) = response(
        app.clone(),
        Request::builder()
            .method("GET")
            .uri("/api/gyms")
            .header("cookie", session_cookie.as_str())
            .body(Body::empty())
            .expect("request should build"),
    )
    .await;
    assert_eq!(protected_status, StatusCode::UNAUTHORIZED);
    assert!(protected_body.is_empty());

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
        .verify_password(new_password.as_bytes(), &parsed_hash)
        .is_ok());
    assert!(argon2
        .verify_password(current_password.as_bytes(), &parsed_hash)
        .is_err());
}

#[tokio::test]
async fn auth_password_post_revokes_all_existing_sessions_after_successful_rotation() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let current_password = test_password();
    let new_password = test_password_with_len(16);
    let login = "integration-auth-password-revoke-sessions";
    insert_user_with_secret(&pool, login, &current_password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let first_session_cookie = login_session_cookie(app.clone(), login, &current_password).await;
    let second_session_cookie = login_session_cookie(app.clone(), login, &current_password).await;

    let (status, headers, body) = response_with_headers(
        app.clone(),
        Request::builder()
            .method("POST")
            .uri("/auth/password")
            .header("content-type", "application/json")
            .header("cookie", first_session_cookie.as_str())
            .body(Body::from(
                json!({
                    "current_password": current_password,
                    "new_password": new_password.clone(),
                    "confirm_new_password": new_password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(body.is_empty());

    let clear_cookie = headers
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .expect("password update should clear session cookie");
    assert!(clear_cookie.contains("__Host-pb_session="));
    assert!(clear_cookie.contains("Max-Age=0"));

    for stale_cookie in [
        first_session_cookie.as_str(),
        second_session_cookie.as_str(),
    ] {
        let (protected_status, protected_body) = response(
            app.clone(),
            Request::builder()
                .method("GET")
                .uri("/api/gyms")
                .header("cookie", stale_cookie)
                .body(Body::empty())
                .expect("request should build"),
        )
        .await;
        assert_eq!(protected_status, StatusCode::UNAUTHORIZED);
        assert!(protected_body.is_empty());
    }

    let row = sqlx::query(
        "SELECT
            COUNT(*) FILTER (WHERE revoked_at IS NULL) AS active_count,
            COUNT(*) FILTER (
                WHERE revoked_at IS NOT NULL
                  AND revoke_reason = 'password_change'
            ) AS revoked_count
         FROM sessions
         WHERE user_id = (
             SELECT id
             FROM users
             WHERE login_name = $1
         )",
    )
    .bind(login)
    .fetch_one(&pool)
    .await
    .expect("session counts should load");

    let active_count: i64 = row.get("active_count");
    let revoked_count: i64 = row.get("revoked_count");
    assert_eq!(active_count, 0);
    assert_eq!(revoked_count, 2);
}

#[tokio::test]
async fn auth_password_post_rejects_new_password_shorter_than_8_characters() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let current_password = test_password();
    let short_password = test_password_with_len(7);
    insert_user_with_secret(&pool, "integration-auth-password-short", &current_password).await;

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
                    "password": current_password.clone()
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
                    "current_password": current_password,
                    "new_password": short_password.clone(),
                    "confirm_new_password": short_password
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
async fn auth_password_post_throttles_repeated_wrong_current_passwords_with_generic_conflict() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let current_password = test_password();
    let wrong_current_password = format!("wrong-{current_password}");
    let new_password = test_password_with_len(16);
    let login = "integration-auth-password-throttle";
    insert_user_with_secret(&pool, login, &current_password).await;

    let app = app_router(AppState {
        repository: DomainRepository::new(pool.clone()),
    });

    let session_cookie = login_session_cookie(app.clone(), login, &current_password).await;

    for _ in 0..5 {
        let (status, body) = response(
            app.clone(),
            Request::builder()
                .method("POST")
                .uri("/auth/password")
                .header("content-type", "application/json")
                .header("cookie", session_cookie.as_str())
                .body(Body::from(
                    json!({
                        "current_password": wrong_current_password.clone(),
                        "new_password": new_password.clone(),
                        "confirm_new_password": new_password.clone()
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
    }

    let attempt_key = password_change_attempt_key_for_login(&pool, login).await;
    let attempt_row = sqlx::query(
        "SELECT
            failure_count,
            blocked_until::text AS blocked_until
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind(attempt_key)
    .fetch_one(&pool)
    .await
    .expect("password-change attempt row should exist");

    let failure_count: i32 = attempt_row.get("failure_count");
    let blocked_until: Option<String> = attempt_row.get("blocked_until");
    assert_eq!(failure_count, 5);
    assert!(blocked_until.is_some());

    let (blocked_status, blocked_body) = response(
        app,
        Request::builder()
            .method("POST")
            .uri("/auth/password")
            .header("content-type", "application/json")
            .header("cookie", session_cookie.as_str())
            .body(Body::from(
                json!({
                    "current_password": current_password,
                    "new_password": new_password.clone(),
                    "confirm_new_password": new_password
                })
                .to_string(),
            ))
            .expect("request should build"),
    )
    .await;
    assert_eq!(blocked_status, StatusCode::CONFLICT);
    let payload: Value = serde_json::from_slice(&blocked_body).expect("body should be json");
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
    .bind(login)
    .fetch_one(&pool)
    .await
    .expect("active secret count should load")
    .get("count");
    assert_eq!(active_count, 1);
}

#[tokio::test]
async fn auth_password_post_rejects_wrong_current_password_with_conflict() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = db.pool.clone();

    let current_password = test_password();
    let wrong_current_password = format!("wrong-{current_password}");
    let new_password = test_password_with_len(16);
    insert_user_with_secret(
        &pool,
        "integration-auth-password-conflict",
        &current_password,
    )
    .await;

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
                    "password": current_password
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
                    "current_password": wrong_current_password,
                    "new_password": new_password.clone(),
                    "confirm_new_password": new_password
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

    let attempt_key =
        password_change_attempt_key_for_login(&pool, "integration-auth-password-conflict").await;
    let failure_count: i32 = sqlx::query(
        "SELECT failure_count
         FROM auth_login_attempts
         WHERE attempt_key = $1",
    )
    .bind(attempt_key)
    .fetch_one(&pool)
    .await
    .expect("password-change attempt row should exist")
    .get("failure_count");
    assert_eq!(failure_count, 1);
}
