use super::{DomainRepository, PersistenceError};
use sqlx::Row;

#[derive(Debug, Clone)]
pub struct ActiveUserSecret {
    pub id: String,
    pub user_id: String,
    pub secret_hash: String,
}

pub(super) async fn fetch_active_user_secret(
    repository: &DomainRepository,
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
         ORDER BY us.created_at DESC
         LIMIT 1",
    )
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
    let mut tx = repository.pool.begin().await?;

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
        return Err(PersistenceError::NotFound(
            "Active user secret not found".to_owned(),
        ));
    }

    tx.commit().await?;

    Ok(())
}
