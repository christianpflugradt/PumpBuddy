use crate::persistence::PersistenceError;
use sqlx::{PgPool, Postgres, Transaction};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const MAX_VALUE_LEN: usize = 180;

fn formatted_timestamp_utc() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn sanitize_value(value: &str) -> String {
    let mut out = String::with_capacity(value.len().min(MAX_VALUE_LEN) + 8);

    for ch in value.chars() {
        let mapped = match ch {
            '\n' | '\r' => ' ',
            _ => ch,
        };
        out.push(mapped);
        if out.len() >= MAX_VALUE_LEN {
            out.truncate(MAX_VALUE_LEN);
            out.push_str("...");
            break;
        }
    }

    out.replace('\\', "\\\\").replace('"', "\\\"")
}

fn write_event_line(event: &str, fields: &[(&str, String)]) {
    let mut line = format!("{} event={event}", formatted_timestamp_utc());

    for (key, value) in fields {
        let cleaned = sanitize_value(value);
        line.push(' ');
        line.push_str(key);
        line.push_str("=\"");
        line.push_str(&cleaned);
        line.push('"');
    }

    eprintln!("{line}");
}

fn caller_module(file: &str) -> String {
    let stem = file.rsplit('/').next().unwrap_or(file);
    stem.strip_suffix(".rs").unwrap_or(stem).to_owned()
}

fn infer_entity(module: &str) -> &'static str {
    match module {
        "auth" => "session",
        "workouts" => "workout",
        "active_workouts" => "active_workout",
        "training_plans" => "training_plan",
        "suggestions" => "suggestion",
        "progression" => "progression",
        _ => "persistence",
    }
}

pub(crate) fn operation_from_caller(file: &str, line: u32) -> String {
    let module = caller_module(file);
    format!("{module}_line_{line}")
}

pub(crate) fn entity_from_caller(file: &str) -> &'static str {
    let module = caller_module(file);
    infer_entity(&module)
}

fn sql_state(error: &sqlx::Error) -> String {
    match error {
        sqlx::Error::Database(db_error) => db_error
            .code()
            .map(|code| code.to_string())
            .unwrap_or_else(|| "none".to_owned()),
        _ => "none".to_owned(),
    }
}

fn error_kind(error: &sqlx::Error) -> &'static str {
    match error {
        sqlx::Error::Configuration(_) => "configuration",
        sqlx::Error::Database(_) => "database",
        sqlx::Error::Io(_) => "io",
        sqlx::Error::Tls(_) => "tls",
        sqlx::Error::Protocol(_) => "protocol",
        sqlx::Error::RowNotFound => "row_not_found",
        sqlx::Error::TypeNotFound { .. } => "type_not_found",
        sqlx::Error::ColumnIndexOutOfBounds { .. } => "column_index_out_of_bounds",
        sqlx::Error::ColumnNotFound(_) => "column_not_found",
        sqlx::Error::ColumnDecode { .. } => "column_decode",
        sqlx::Error::Decode(_) => "decode",
        sqlx::Error::PoolTimedOut => "pool_timed_out",
        sqlx::Error::PoolClosed => "pool_closed",
        sqlx::Error::WorkerCrashed => "worker_crashed",
        sqlx::Error::Migrate(_) => "migrate",
        _ => "other",
    }
}

pub(crate) fn log_sqlx_error(error: &sqlx::Error, operation: &str, entity: &str) {
    let state = sql_state(error);
    let kind = error_kind(error).to_owned();
    let message = error.to_string();

    let event = match error {
        sqlx::Error::PoolTimedOut | sqlx::Error::PoolClosed | sqlx::Error::WorkerCrashed => {
            "db_pool_acquire_failed"
        }
        sqlx::Error::ColumnDecode { .. }
        | sqlx::Error::Decode(_)
        | sqlx::Error::TypeNotFound { .. }
        | sqlx::Error::ColumnNotFound(_)
        | sqlx::Error::ColumnIndexOutOfBounds { .. } => "db_row_decode_failed",
        sqlx::Error::Database(_) if state == "40P01" => "db_deadlock_detected",
        sqlx::Error::Database(_) if state == "40001" => "db_serialization_failure",
        sqlx::Error::Database(_) if state.starts_with("23") => "db_constraint_violation",
        _ => "db_query_failed",
    };

    write_event_line(
        event,
        &[
            ("operation", operation.to_owned()),
            ("entity", entity.to_owned()),
            ("sql_state", state),
            ("error_kind", kind),
            ("message", message),
        ],
    );
}

#[allow(dead_code)]
pub(crate) fn log_idempotency_conflict(operation: &str, entity: &str, idempotency_key: &str) {
    write_event_line(
        "idempotency_conflict",
        &[
            ("operation", operation.to_owned()),
            ("entity", entity.to_owned()),
            ("idempotency_key", idempotency_key.to_owned()),
        ],
    );
}

pub(crate) fn log_transaction_begin_failed(error: &sqlx::Error, operation: &str, entity: &str) {
    write_event_line(
        "db_transaction_begin_failed",
        &[
            ("operation", operation.to_owned()),
            ("entity", entity.to_owned()),
            ("sql_state", sql_state(error)),
            ("error_kind", error_kind(error).to_owned()),
            ("message", error.to_string()),
        ],
    );
}

pub(crate) fn log_transaction_commit_failed(error: &sqlx::Error, operation: &str, entity: &str) {
    write_event_line(
        "db_transaction_commit_failed",
        &[
            ("operation", operation.to_owned()),
            ("entity", entity.to_owned()),
            ("sql_state", sql_state(error)),
            ("error_kind", error_kind(error).to_owned()),
            ("message", error.to_string()),
        ],
    );
}

pub(crate) fn log_transaction_rollback_failed(error: &sqlx::Error, operation: &str, entity: &str) {
    write_event_line(
        "db_transaction_rollback_failed",
        &[
            ("operation", operation.to_owned()),
            ("entity", entity.to_owned()),
            ("sql_state", sql_state(error)),
            ("error_kind", error_kind(error).to_owned()),
            ("message", error.to_string()),
        ],
    );
}

pub(crate) async fn begin_transaction<'a>(
    pool: &'a PgPool,
    operation: &str,
    entity: &str,
) -> Result<Transaction<'a, Postgres>, PersistenceError> {
    match pool.begin().await {
        Ok(tx) => Ok(tx),
        Err(error) => {
            log_transaction_begin_failed(&error, operation, entity);
            Err(PersistenceError::Sqlx(error))
        }
    }
}

pub(crate) async fn commit_transaction(
    tx: Transaction<'_, Postgres>,
    operation: &str,
    entity: &str,
) -> Result<(), PersistenceError> {
    match tx.commit().await {
        Ok(()) => Ok(()),
        Err(error) => {
            log_transaction_commit_failed(&error, operation, entity);
            Err(PersistenceError::Sqlx(error))
        }
    }
}

pub(crate) async fn rollback_transaction(
    tx: Transaction<'_, Postgres>,
    operation: &str,
    entity: &str,
) {
    if let Err(error) = tx.rollback().await {
        log_transaction_rollback_failed(&error, operation, entity);
    }
}
