use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug)]
pub enum ApiError {
    Internal,
    Conflict(String),
    NotFound(String),
    Unauthorized,
    Validation(String),
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "Internal server error".to_owned(),
                }),
            )
                .into_response(),
            Self::NotFound(message) => {
                (StatusCode::NOT_FOUND, Json(ErrorResponse { message })).into_response()
            }
            Self::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    message: "Unauthorized".to_owned(),
                }),
            )
                .into_response(),
            Self::Conflict(message) => {
                (StatusCode::CONFLICT, Json(ErrorResponse { message })).into_response()
            }
            Self::Validation(message) => {
                (StatusCode::BAD_REQUEST, Json(ErrorResponse { message })).into_response()
            }
        }
    }
}

pub fn map_persistence_error(error: crate::persistence::PersistenceError) -> ApiError {
    match error {
        crate::persistence::PersistenceError::Conflict(message) => ApiError::Conflict(message),
        crate::persistence::PersistenceError::NotFound(message) => ApiError::NotFound(message),
        crate::persistence::PersistenceError::Sqlx(sqlx_error) => {
            // Try to map common Postgres error codes first. If we have a database
            // error with a code we recognize, map accurately. If not, fall back to
            // inspecting the error text for hints (safer across sqlx/driver
            // versions and boxed DB error types).
            // Log the raw sqlx error for diagnostics in test runs.
            eprintln!("map_persistence_error: sqlx error = {:?}", sqlx_error);

            match sqlx_error {
                sqlx::Error::Database(db_error) => {
                    if let Some(code) = db_error.code() {
                        match code.as_ref() {
                            "22P02" | "22007" => ApiError::Validation(
                                "Workout payload contains an invalid identifier or timestamp"
                                    .to_owned(),
                            ),
                            "23503" => {
                                ApiError::NotFound("A referenced record was not found".to_owned())
                            }
                            _ => ApiError::Internal,
                        }
                    } else {
                        // No numeric SQLSTATE code available; inspect message text
                        // for a foreign-key style hint and map to NotFound when
                        // appropriate.
                        let text = db_error.message().to_lowercase();
                        if text.contains("foreign key")
                            || text.contains("violat")
                            || text.contains("23503")
                        {
                            ApiError::NotFound("A referenced record was not found".to_owned())
                        } else if text.contains("invalid input syntax")
                            || text.contains("invalid input")
                        {
                            ApiError::Validation(
                                "Workout payload contains an invalid identifier or timestamp"
                                    .to_owned(),
                            )
                        } else {
                            ApiError::Internal
                        }
                    }
                }
                // Other sqlx error shapes (eg: RowNotFound) are treated as internal
                // here — specific persistence code paths should translate into the
                // persistence::PersistenceError variants where applicable.
                _ => ApiError::Internal,
            }
        }
        _ => ApiError::Internal,
    }
}

#[cfg(test)]
mod tests {
    use super::{map_persistence_error, ApiError};

    #[test]
    fn map_persistence_error_converts_non_database_errors_to_internal() {
        match map_persistence_error(crate::persistence::PersistenceError::Sqlx(
            sqlx::Error::RowNotFound,
        )) {
            ApiError::Internal => {}
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
