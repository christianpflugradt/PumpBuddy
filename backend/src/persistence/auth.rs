use super::{logging, DomainRepository, PersistenceError};
use sqlx::Row;

const FAVORITE_GYM_PREFERENCE_KEY: &str = "favorite_gym_id";
const MAX_LOAD_KG_PREFERENCE_KEY: &str = "max_load_kg";
const DEFAULT_MAX_LOAD_KG: f64 = 300.0;

#[derive(Debug, Clone)]
pub struct ActiveUserSecret {
    pub id: String,
    pub user_id: String,
    pub secret_hash: String,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedSession {
    pub user_id: String,
    pub display_name: String,
    pub login: Option<String>,
    pub registration_date: Option<String>,
    pub favorite_gym_id: Option<String>,
}

pub(super) async fn fetch_active_user_secret(
    repository: &DomainRepository,
    login: &str,
    default_user_id: &str,
) -> Result<Option<ActiveUserSecret>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            us.id::text AS id,
            us.user_id::text AS user_id,
            us.secret_hash AS secret_hash
         FROM user_secrets us
         JOIN users u ON u.id = us.user_id
         WHERE us.revoked_at IS NULL
           AND u.disabled_at IS NULL
           AND (
                ($1 = '' AND u.id = $2::uuid)
                OR ($1 <> '' AND u.login_name = $1)
           )
         ORDER BY us.created_at DESC
         LIMIT 1",
    )
    .bind(login)
    .bind(default_user_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| ActiveUserSecret {
        id: row.get("id"),
        user_id: row.get("user_id"),
        secret_hash: row.get("secret_hash"),
    }))
}

pub(super) async fn fetch_active_user_secret_for_user(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Option<ActiveUserSecret>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            us.id::text AS id,
            us.user_id::text AS user_id,
            us.secret_hash AS secret_hash
         FROM user_secrets us
         JOIN users u ON u.id = us.user_id
         WHERE us.user_id = $1::uuid
           AND us.revoked_at IS NULL
           AND u.disabled_at IS NULL
         ORDER BY us.created_at DESC
         LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| ActiveUserSecret {
        id: row.get("id"),
        user_id: row.get("user_id"),
        secret_hash: row.get("secret_hash"),
    }))
}

pub(super) async fn create_login_session(
    repository: &DomainRepository,
    secret_id: &str,
    user_id: &str,
    session_token_hash: &str,
    user_agent: Option<&str>,
    ip_address: Option<&str>,
) -> Result<(), PersistenceError> {
    let mut tx =
        logging::begin_transaction(&repository.pool, "create_login_session", "session").await?;

    sqlx::query(
        "INSERT INTO sessions (
            user_id,
            session_token_hash,
            idle_expires_at,
            absolute_expires_at,
            user_agent,
            ip_address
         )
         VALUES (
            $1::uuid,
            $2,
            NOW() + interval '7 days',
            NOW() + interval '90 days',
            $3,
            $4
         )",
    )
    .bind(user_id)
    .bind(session_token_hash)
    .bind(user_agent)
    .bind(ip_address)
    .execute(&mut *tx)
    .await?;

    let update_result = sqlx::query(
        "UPDATE user_secrets
         SET last_used_at = NOW()
         WHERE id = $1::uuid",
    )
    .bind(secret_id)
    .execute(&mut *tx)
    .await?;

    if update_result.rows_affected() == 0 {
        logging::rollback_transaction(tx, "create_login_session", "session").await;
        return Err(PersistenceError::NotFound(
            "Active user secret not found".to_owned(),
        ));
    }

    logging::commit_transaction(tx, "create_login_session", "session").await?;

    Ok(())
}

pub(super) async fn rotate_user_secret(
    repository: &DomainRepository,
    user_id: &str,
    active_secret_id: &str,
    replacement_secret_hash: &str,
) -> Result<(), PersistenceError> {
    let mut tx = logging::begin_transaction(&repository.pool, "rotate_user_secret", "auth").await?;

    let revoked_row = sqlx::query(
        "UPDATE user_secrets
         SET revoked_at = NOW(),
             rotated_by_user_id = $1::uuid,
             rotation_reason = 'password_change'
         WHERE id = $2::uuid
           AND user_id = $1::uuid
           AND revoked_at IS NULL
         RETURNING label",
    )
    .bind(user_id)
    .bind(active_secret_id)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(revoked_row) = revoked_row else {
        logging::rollback_transaction(tx, "rotate_user_secret", "auth").await;
        return Err(PersistenceError::NotFound(
            "Active user secret not found".to_owned(),
        ));
    };

    let prior_label: Option<String> = revoked_row.get("label");
    let next_label = prior_label
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("primary");

    sqlx::query(
        "INSERT INTO user_secrets (user_id, secret_hash, label)
         VALUES ($1::uuid, $2, $3)",
    )
    .bind(user_id)
    .bind(replacement_secret_hash)
    .bind(next_label)
    .execute(&mut *tx)
    .await?;

    logging::commit_transaction(tx, "rotate_user_secret", "auth").await?;
    Ok(())
}

pub(super) async fn touch_session(
    repository: &DomainRepository,
    session_token_hash: &str,
) -> Result<Option<AuthenticatedSession>, PersistenceError> {
    let row = sqlx::query(
        "WITH updated AS (
            UPDATE sessions s
            SET last_seen_at = NOW(),
                idle_expires_at = LEAST(s.absolute_expires_at, NOW() + interval '7 days')
            FROM users u
            WHERE s.session_token_hash = $1
              AND s.user_id = u.id
              AND u.disabled_at IS NULL
              AND s.revoked_at IS NULL
              AND s.idle_expires_at > NOW()
              AND s.absolute_expires_at > NOW()
            RETURNING s.user_id
         )
         SELECT
            u.id::text AS user_id,
            u.display_name AS display_name,
            u.login_name AS login,
            u.created_at::text AS registration_date,
            up.preference_value AS favorite_gym_id
         FROM updated
         JOIN users u ON u.id = updated.user_id
         LEFT JOIN user_preferences up
           ON up.user_id = u.id
          AND up.preference_key = $2",
    )
    .bind(session_token_hash)
    .bind(FAVORITE_GYM_PREFERENCE_KEY)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| AuthenticatedSession {
        user_id: row.get("user_id"),
        display_name: row.get("display_name"),
        login: row.get("login"),
        registration_date: row.get("registration_date"),
        favorite_gym_id: row.get("favorite_gym_id"),
    }))
}

pub(super) async fn update_session_display_name(
    repository: &DomainRepository,
    user_id: &str,
    display_name: &str,
) -> Result<Option<AuthenticatedSession>, PersistenceError> {
    let row = sqlx::query(
        "WITH updated_user AS (
            UPDATE users
            SET display_name = $2
            WHERE id = $1::uuid
              AND disabled_at IS NULL
            RETURNING
              id,
              display_name,
              login_name,
              created_at
          )
          SELECT
            uu.id::text AS user_id,
            uu.display_name AS display_name,
            uu.login_name AS login,
            uu.created_at::text AS registration_date,
            up.preference_value AS favorite_gym_id
          FROM updated_user uu
          LEFT JOIN user_preferences up
            ON up.user_id = uu.id
           AND up.preference_key = $3",
    )
    .bind(user_id)
    .bind(display_name)
    .bind(FAVORITE_GYM_PREFERENCE_KEY)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| AuthenticatedSession {
        user_id: row.get("user_id"),
        display_name: row.get("display_name"),
        login: row.get("login"),
        registration_date: row.get("registration_date"),
        favorite_gym_id: row.get("favorite_gym_id"),
    }))
}

pub(super) async fn fetch_favorite_gym_preference(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Option<String>, PersistenceError> {
    fetch_user_preference(repository, user_id, FAVORITE_GYM_PREFERENCE_KEY).await
}

pub(super) async fn fetch_max_load_kg_preference(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<f64, PersistenceError> {
    let raw = fetch_user_preference(repository, user_id, MAX_LOAD_KG_PREFERENCE_KEY).await?;
    Ok(parse_max_load_kg_preference(raw))
}

pub(super) async fn update_favorite_gym_preference(
    repository: &DomainRepository,
    user_id: &str,
    favorite_gym_id: Option<&str>,
) -> Result<Option<String>, PersistenceError> {
    match favorite_gym_id {
        Some(favorite_gym_id) => {
            upsert_user_preference(
                repository,
                user_id,
                FAVORITE_GYM_PREFERENCE_KEY,
                favorite_gym_id,
            )
            .await
        }
        None => {
            clear_user_preference(repository, user_id, FAVORITE_GYM_PREFERENCE_KEY).await?;
            Ok(None)
        }
    }
}

async fn fetch_user_preference(
    repository: &DomainRepository,
    user_id: &str,
    preference_key: &str,
) -> Result<Option<String>, PersistenceError> {
    let row = sqlx::query(
        "SELECT preference_value
         FROM user_preferences
         WHERE user_id = $1::uuid
           AND preference_key = $2",
    )
    .bind(user_id)
    .bind(preference_key)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| row.get("preference_value")))
}

async fn upsert_user_preference(
    repository: &DomainRepository,
    user_id: &str,
    preference_key: &str,
    preference_value: &str,
) -> Result<Option<String>, PersistenceError> {
    let row = sqlx::query(
        "INSERT INTO user_preferences (
             user_id,
             preference_key,
             preference_value
         )
         VALUES (
             $1::uuid,
             $2,
             $3
         )
         ON CONFLICT (user_id, preference_key)
         DO UPDATE SET preference_value = EXCLUDED.preference_value
         RETURNING preference_value",
    )
    .bind(user_id)
    .bind(preference_key)
    .bind(preference_value)
    .fetch_one(&repository.pool)
    .await?;

    Ok(Some(row.get("preference_value")))
}

async fn clear_user_preference(
    repository: &DomainRepository,
    user_id: &str,
    preference_key: &str,
) -> Result<(), PersistenceError> {
    sqlx::query(
        "DELETE FROM user_preferences
         WHERE user_id = $1::uuid
           AND preference_key = $2",
    )
    .bind(user_id)
    .bind(preference_key)
    .execute(&repository.pool)
    .await?;

    Ok(())
}

fn parse_max_load_kg_preference(raw: Option<String>) -> f64 {
    let Some(raw) = raw else {
        return DEFAULT_MAX_LOAD_KG;
    };

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DEFAULT_MAX_LOAD_KG;
    }

    match trimmed.parse::<f64>() {
        Ok(parsed) if parsed.is_finite() && parsed > 0.0 => parsed,
        _ => DEFAULT_MAX_LOAD_KG,
    }
}
