use crate::persistence::{ActiveUserSecret, DomainRepository, PersistenceError};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, SaltString},
    Argon2, PasswordVerifier,
};
use base64::{engine::general_purpose, Engine as _};
use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const SESSION_TOKEN_BYTES: usize = 32;
const DEFAULT_LOGIN_USER_ID: &str = "00000000-0000-0000-0000-000000000001";
const NEW_PASSWORD_MIN_LENGTH: usize = 8;
const MIN_MAX_LOAD_KG: f64 = 100.0;
const MAX_MAX_LOAD_KG: f64 = 999.0;

#[derive(Debug)]
pub enum AuthError {
    InvalidCredentials,
    CurrentPasswordMismatch,
    Internal,
    Validation(String),
    Persistence(PersistenceError),
}

#[derive(Debug)]
pub struct LoginSession {
    pub session_token: String,
}

#[derive(Clone, Debug)]
pub struct AuthenticatedSession {
    pub user_id: String,
    pub display_name: String,
    pub login: Option<String>,
    pub registration_date: Option<String>,
    pub favorite_gym_id: Option<String>,
    pub max_load_kg: f64,
}

pub async fn login_with_credentials(
    repository: &DomainRepository,
    login: &str,
    password: &str,
    user_agent: Option<&str>,
    ip_address: Option<&str>,
) -> Result<LoginSession, AuthError> {
    if password.is_empty() {
        return Err(AuthError::InvalidCredentials);
    }

    let secret = repository
        .fetch_active_user_secret(login, DEFAULT_LOGIN_USER_ID)
        .await
        .map_err(AuthError::Persistence)?;

    let Some(secret) = secret else {
        return Err(AuthError::InvalidCredentials);
    };

    verify_password(password, &secret)?;

    let (session_token, session_token_hash) = generate_session_token_pair();

    repository
        .create_login_session(
            &secret.id,
            &secret.user_id,
            &session_token_hash,
            user_agent,
            ip_address,
        )
        .await
        .map_err(AuthError::Persistence)?;

    Ok(LoginSession { session_token })
}

pub async fn resolve_session(
    repository: &DomainRepository,
    session_token: &str,
) -> Result<Option<AuthenticatedSession>, AuthError> {
    let session_token = session_token.trim();
    if session_token.is_empty() {
        return Ok(None);
    }

    let session_token_hash = hash_session_token(session_token);
    let session = repository
        .touch_session(&session_token_hash)
        .await
        .map_err(AuthError::Persistence)?;

    Ok(session.map(|session| AuthenticatedSession {
        user_id: session.user_id,
        display_name: session.display_name,
        login: session.login,
        registration_date: session.registration_date,
        favorite_gym_id: session.favorite_gym_id,
        max_load_kg: session.max_load_kg,
    }))
}

pub async fn update_session_display_name(
    repository: &DomainRepository,
    user_id: &str,
    display_name: &str,
    favorite_gym_id: Option<Option<&str>>,
    max_load_kg: Option<f64>,
) -> Result<Option<AuthenticatedSession>, AuthError> {
    let normalized = display_name.trim();
    if normalized.is_empty() {
        return Err(AuthError::Validation("display_name is required".to_owned()));
    }

    if normalized.len() > 120 {
        return Err(AuthError::Validation(
            "display_name must be 120 characters or fewer".to_owned(),
        ));
    }

    if let Some(favorite_gym_id) = favorite_gym_id {
        let normalized_favorite_gym_id = normalize_favorite_gym_id(favorite_gym_id)?;
        repository
            .update_favorite_gym_preference_for_user(user_id, normalized_favorite_gym_id.as_deref())
            .await
            .map_err(AuthError::Persistence)?;
    }

    if let Some(max_load_kg) = max_load_kg {
        validate_max_load_kg(max_load_kg)?;
        repository
            .update_max_load_kg_preference_for_user(user_id, max_load_kg)
            .await
            .map_err(AuthError::Persistence)?;
    }

    let session = repository
        .update_session_display_name(user_id, normalized)
        .await
        .map_err(AuthError::Persistence)?;

    Ok(session.map(|session| AuthenticatedSession {
        user_id: session.user_id,
        display_name: session.display_name,
        login: session.login,
        registration_date: session.registration_date,
        favorite_gym_id: session.favorite_gym_id,
        max_load_kg: session.max_load_kg,
    }))
}

pub async fn update_password(
    repository: &DomainRepository,
    user_id: &str,
    current_password: &str,
    new_password: &str,
    confirm_new_password: &str,
) -> Result<(), AuthError> {
    if current_password.is_empty() {
        return Err(AuthError::Validation(
            "current_password is required".to_owned(),
        ));
    }

    if new_password.is_empty() {
        return Err(AuthError::Validation("new_password is required".to_owned()));
    }

    if new_password.chars().count() < NEW_PASSWORD_MIN_LENGTH {
        return Err(AuthError::Validation(
            "new_password must be at least 8 characters".to_owned(),
        ));
    }

    if confirm_new_password.is_empty() {
        return Err(AuthError::Validation(
            "confirm_new_password is required".to_owned(),
        ));
    }

    if new_password != confirm_new_password {
        return Err(AuthError::Validation(
            "new_password and confirm_new_password must match".to_owned(),
        ));
    }

    let Some(secret) = repository
        .fetch_active_user_secret_for_user(user_id)
        .await
        .map_err(AuthError::Persistence)?
    else {
        return Err(AuthError::Internal);
    };

    match verify_password(current_password, &secret) {
        Ok(()) => {}
        Err(AuthError::InvalidCredentials) => return Err(AuthError::CurrentPasswordMismatch),
        Err(other) => return Err(other),
    }

    let replacement_secret_hash = hash_password(new_password)?;

    repository
        .rotate_user_secret(user_id, &secret.id, &replacement_secret_hash)
        .await
        .map_err(AuthError::Persistence)?;

    Ok(())
}

fn normalize_favorite_gym_id(favorite_gym_id: Option<&str>) -> Result<Option<String>, AuthError> {
    let Some(favorite_gym_id) = favorite_gym_id else {
        return Ok(None);
    };

    let normalized = favorite_gym_id.trim();
    if normalized.is_empty() {
        return Err(AuthError::Validation(
            "favorite_gym_id must be a valid uuid".to_owned(),
        ));
    }

    Uuid::parse_str(normalized)
        .map_err(|_| AuthError::Validation("favorite_gym_id must be a valid uuid".to_owned()))?;

    Ok(Some(normalized.to_owned()))
}

fn validate_max_load_kg(max_load_kg: f64) -> Result<(), AuthError> {
    if !max_load_kg.is_finite() || !(MIN_MAX_LOAD_KG..=MAX_MAX_LOAD_KG).contains(&max_load_kg) {
        return Err(AuthError::Validation(
            "max_load_kg must be between 100 and 999".to_owned(),
        ));
    }

    Ok(())
}

fn verify_password(password: &str, secret: &ActiveUserSecret) -> Result<(), AuthError> {
    let parsed_hash = PasswordHash::new(&secret.secret_hash).map_err(|_| AuthError::Internal)?;
    let argon2 = Argon2::default();

    argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| AuthError::InvalidCredentials)
}

fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| AuthError::Internal)
        .map(|hash| hash.to_string())
}

fn generate_session_token_pair() -> (String, String) {
    let mut raw_token = [0u8; SESSION_TOKEN_BYTES];
    OsRng.fill_bytes(&mut raw_token);

    let session_token = general_purpose::URL_SAFE_NO_PAD.encode(raw_token);
    let session_token_hash = hash_session_token(&session_token);

    (session_token, session_token_hash)
}

pub(crate) fn hash_session_token(session_token: &str) -> String {
    let digest = Sha256::digest(session_token.as_bytes());
    general_purpose::STANDARD_NO_PAD.encode(digest)
}

#[cfg(test)]
mod tests {
    use super::{hash_session_token, login_with_credentials, AuthError};
    use crate::test_support::{
        connect_with_retry, reset_test_database, resolve_test_database_url, test_db_lock,
    };
    use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
    use rand::rngs::OsRng;
    use sqlx::{PgPool, Row};

    async fn require_pool() -> PgPool {
        let database_url = resolve_test_database_url().await;
        let pool = connect_with_retry(&database_url).await;

        reset_test_database(&pool).await;
        reset_auth_state(&pool).await;
        initialize_seed_data(&pool).await;
        pool
    }

    async fn reset_auth_state(pool: &PgPool) {
        sqlx::raw_sql("TRUNCATE TABLE sessions, user_secrets, users RESTART IDENTITY CASCADE")
            .execute(pool)
            .await
            .expect("auth tables should truncate cleanly");
    }

    async fn initialize_seed_data(pool: &PgPool) {
        sqlx::raw_sql(include_str!("../../../runtime/database/10-seed-dev.sql"))
            .execute(pool)
            .await
            .expect("10-seed-dev.sql should apply cleanly");
    }

    async fn seed_user_secret(pool: &PgPool, login: &str, password: &str) -> (String, String) {
        let user_id: String = sqlx::query(
            "INSERT INTO users (display_name, login_name)
             VALUES ($1, $2)
             RETURNING id::text AS id",
        )
        .bind("Primary User")
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

        let secret_id: String = sqlx::query(
            "INSERT INTO user_secrets (user_id, secret_hash, label)
             VALUES ($1::uuid, $2, $3)
             RETURNING id::text AS id",
        )
        .bind(&user_id)
        .bind(secret_hash)
        .bind("primary")
        .fetch_one(pool)
        .await
        .expect("secret should insert")
        .get("id");

        (user_id, secret_id)
    }

    async fn insert_session(
        pool: &PgPool,
        user_id: &str,
        session_token_hash: &str,
        created_offset_seconds: i64,
        idle_offset_seconds: i64,
        absolute_offset_seconds: i64,
        revoked: bool,
    ) {
        sqlx::query(
            "INSERT INTO sessions (
                user_id,
                session_token_hash,
                created_at,
                last_seen_at,
                idle_expires_at,
                absolute_expires_at,
                revoked_at
             )
             VALUES (
                $1::uuid,
                $2,
                NOW() + make_interval(secs => $3),
                NOW() + make_interval(secs => $3),
                NOW() + make_interval(secs => $4),
                NOW() + make_interval(secs => $5),
                CASE WHEN $6 THEN NOW() ELSE NULL END
             )",
        )
        .bind(user_id)
        .bind(session_token_hash)
        .bind(created_offset_seconds)
        .bind(idle_offset_seconds)
        .bind(absolute_offset_seconds)
        .bind(revoked)
        .execute(pool)
        .await
        .expect("session should insert");
    }

    #[tokio::test]
    async fn login_with_credentials_creates_session_and_updates_secret_usage() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;
        let (user_id, secret_id) = seed_user_secret(&pool, "primary", "correct-horse").await;

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let session = login_with_credentials(
            &repository,
            "primary",
            "correct-horse",
            Some("PumpBuddy Test"),
            Some("127.0.0.1"),
        )
        .await
        .expect("login should succeed");

        let session_hash = hash_session_token(&session.session_token);
        let count: i64 = sqlx::query(
            "SELECT COUNT(*)::bigint AS count
             FROM sessions
             WHERE user_id = $1::uuid AND session_token_hash = $2",
        )
        .bind(&user_id)
        .bind(&session_hash)
        .fetch_one(&pool)
        .await
        .expect("session query should succeed")
        .get("count");
        assert_eq!(count, 1);

        let last_used_at: Option<String> = sqlx::query(
            "SELECT last_used_at::text AS last_used_at
             FROM user_secrets
             WHERE id = $1::uuid",
        )
        .bind(&secret_id)
        .fetch_one(&pool)
        .await
        .expect("secret query should succeed")
        .get("last_used_at");

        assert!(last_used_at.is_some());
    }

    #[tokio::test]
    async fn login_with_credentials_rejects_invalid_password() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;
        let (_, secret_id) = seed_user_secret(&pool, "primary", "correct-horse").await;

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let error = login_with_credentials(&repository, "primary", "wrong-key", None, None)
            .await
            .expect_err("invalid credentials should fail");

        match error {
            AuthError::InvalidCredentials => {}
            other => panic!("unexpected error: {other:?}"),
        }

        let session_count: i64 = sqlx::query("SELECT COUNT(*)::bigint AS count FROM sessions")
            .fetch_one(&pool)
            .await
            .expect("session count should succeed")
            .get("count");
        assert_eq!(session_count, 0);

        let last_used_at: Option<String> = sqlx::query(
            "SELECT last_used_at::text AS last_used_at
             FROM user_secrets
             WHERE id = $1::uuid",
        )
        .bind(&secret_id)
        .fetch_one(&pool)
        .await
        .expect("secret query should succeed")
        .get("last_used_at");
        assert!(last_used_at.is_none());
    }

    #[tokio::test]
    async fn login_with_credentials_allows_empty_login_with_default_user_fallback() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let secret_hash = argon2
            .hash_password("correct-horse".as_bytes(), &salt)
            .expect("hash should succeed")
            .to_string();

        let secret_id: String = sqlx::query(
            "INSERT INTO user_secrets (user_id, secret_hash, label)
             VALUES ($1::uuid, $2, $3)
             RETURNING id::text AS id",
        )
        .bind(super::DEFAULT_LOGIN_USER_ID)
        .bind(secret_hash)
        .bind("default")
        .fetch_one(&pool)
        .await
        .expect("secret should insert")
        .get("id");

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let session = login_with_credentials(
            &repository,
            "",
            "correct-horse",
            Some("PumpBuddy Test"),
            None,
        )
        .await
        .expect("login should succeed");

        let session_hash = hash_session_token(&session.session_token);
        let count: i64 = sqlx::query(
            "SELECT COUNT(*)::bigint AS count
             FROM sessions
             WHERE user_id = $1::uuid AND session_token_hash = $2",
        )
        .bind(super::DEFAULT_LOGIN_USER_ID)
        .bind(&session_hash)
        .fetch_one(&pool)
        .await
        .expect("session query should succeed")
        .get("count");
        assert_eq!(count, 1);

        let last_used_at: Option<String> = sqlx::query(
            "SELECT last_used_at::text AS last_used_at
             FROM user_secrets
             WHERE id = $1::uuid",
        )
        .bind(&secret_id)
        .fetch_one(&pool)
        .await
        .expect("secret query should succeed")
        .get("last_used_at");
        assert!(last_used_at.is_some());
    }

    #[tokio::test]
    async fn login_with_credentials_rejects_unknown_login_even_when_default_user_secret_exists() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let secret_hash = argon2
            .hash_password("correct-horse".as_bytes(), &salt)
            .expect("hash should succeed")
            .to_string();

        sqlx::query(
            "INSERT INTO user_secrets (user_id, secret_hash, label)
             VALUES ($1::uuid, $2, $3)",
        )
        .bind(super::DEFAULT_LOGIN_USER_ID)
        .bind(secret_hash)
        .bind("default")
        .execute(&pool)
        .await
        .expect("secret should insert");

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let error =
            login_with_credentials(&repository, "does-not-exist", "correct-horse", None, None)
                .await
                .expect_err("unknown login should fail");

        match error {
            AuthError::InvalidCredentials => {}
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn resolve_session_accepts_valid_session_and_updates_idle_expiry() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;
        let (user_id, _) = seed_user_secret(&pool, "primary", "correct-horse").await;

        let session_token = "session-token";
        let session_hash = hash_session_token(session_token);
        insert_session(
            &pool,
            &user_id,
            &session_hash,
            -60 * 60 * 24,
            60 * 60,
            60 * 60 * 24 * 30,
            false,
        )
        .await;

        let before_row = sqlx::query(
            "SELECT created_at::text AS created_at,
                    last_seen_at::text AS last_seen_at,
                    idle_expires_at::text AS idle_expires_at
             FROM sessions
             WHERE session_token_hash = $1",
        )
        .bind(&session_hash)
        .fetch_one(&pool)
        .await
        .expect("session should fetch");
        let before_created_at: String = before_row.get("created_at");
        let before_last_seen: String = before_row.get("last_seen_at");
        let before_idle_expires_at: String = before_row.get("idle_expires_at");

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let session = super::resolve_session(&repository, session_token)
            .await
            .expect("session check should succeed")
            .expect("session should be valid");

        assert_eq!(session.user_id, user_id);
        assert_eq!(session.display_name, "Primary User");
        assert_eq!(session.login.as_deref(), Some("primary"));
        assert!(session.registration_date.is_some());

        let after_row = sqlx::query(
            "SELECT created_at::text AS created_at,
                    last_seen_at::text AS last_seen_at,
                    idle_expires_at::text AS idle_expires_at
             FROM sessions
             WHERE session_token_hash = $1",
        )
        .bind(&session_hash)
        .fetch_one(&pool)
        .await
        .expect("session should fetch after update");
        let after_created_at: String = after_row.get("created_at");
        let after_last_seen: String = after_row.get("last_seen_at");
        let after_idle_expires_at: String = after_row.get("idle_expires_at");

        assert_eq!(before_created_at, after_created_at);
        assert_ne!(before_last_seen, after_last_seen);
        assert_ne!(before_idle_expires_at, after_idle_expires_at);
    }

    #[tokio::test]
    async fn resolve_session_rejects_revoked_session() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;
        let (user_id, _) = seed_user_secret(&pool, "primary", "correct-horse").await;

        let session_token = "session-token";
        let session_hash = hash_session_token(session_token);
        insert_session(
            &pool,
            &user_id,
            &session_hash,
            -60 * 60 * 24,
            60 * 60,
            60 * 60 * 24,
            true,
        )
        .await;

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let session = super::resolve_session(&repository, session_token)
            .await
            .expect("session check should succeed");

        assert!(session.is_none());
    }

    #[tokio::test]
    async fn resolve_session_rejects_idle_expired_session() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;
        let (user_id, _) = seed_user_secret(&pool, "primary", "correct-horse").await;

        let session_token = "session-token";
        let session_hash = hash_session_token(session_token);
        insert_session(
            &pool,
            &user_id,
            &session_hash,
            -60 * 60 * 24,
            -60,
            60 * 60 * 24,
            false,
        )
        .await;

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let session = super::resolve_session(&repository, session_token)
            .await
            .expect("session check should succeed");

        assert!(session.is_none());
    }

    #[tokio::test]
    async fn resolve_session_rejects_absolute_expired_session() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;
        let (user_id, _) = seed_user_secret(&pool, "primary", "correct-horse").await;

        let session_token = "session-token";
        let session_hash = hash_session_token(session_token);
        insert_session(
            &pool,
            &user_id,
            &session_hash,
            -60 * 60 * 24,
            60 * 60,
            -60,
            false,
        )
        .await;

        let repository = crate::persistence::DomainRepository::new(pool.clone());
        let session = super::resolve_session(&repository, session_token)
            .await
            .expect("session check should succeed");

        assert!(session.is_none());
    }
}
