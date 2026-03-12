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
        crate::persistence::PersistenceError::Sqlx(sqlx::Error::Database(db_error)) => {
            match db_error.code().as_deref() {
                Some("22P02") | Some("22007") => ApiError::Validation(
                    "Workout payload contains an invalid identifier or timestamp".to_owned(),
                ),
                Some("23503") => ApiError::NotFound("A referenced record was not found".to_owned()),
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
