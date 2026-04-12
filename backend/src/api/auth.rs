use axum::{
    extract::State,
    http::{
        header::{COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::IntoResponse,
    Json,
};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::application::auth::{
    login_with_credentials, resolve_session, update_session_display_name, AuthError,
};

use super::{
    error::map_persistence_error,
    models::{
        AuthLoginRequest, AuthLoginResponse, AuthSessionResponse, AuthSessionUserResponse,
        AuthUpdateDisplayNameRequest,
    },
    ApiError, AppState,
};

const SESSION_COOKIE_MAX_AGE_SECONDS: u64 = 90 * 24 * 60 * 60;

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthLoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok());

    let login = payload.login.as_str();
    let session = login_with_credentials(
        &state.repository,
        login,
        payload.password.as_str(),
        user_agent,
        None,
    )
    .await
    .map_err(|error| map_login_auth_error(error, login, &headers))?;

    let mut response = (
        StatusCode::OK,
        Json(AuthLoginResponse {
            authenticated: true,
        }),
    )
        .into_response();

    let cookie = build_session_cookie(&session.session_token);

    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|_| ApiError::Internal)?,
    );

    Ok(response)
}

pub async fn session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let session_token = read_session_cookie(&headers).ok_or(ApiError::Unauthorized)?;

    let session = resolve_session(&state.repository, &session_token)
        .await
        .map_err(map_auth_error)?;

    let Some(session) = session else {
        return Err(ApiError::Unauthorized);
    };

    Ok(Json(AuthSessionResponse {
        authenticated: true,
        user: Box::new(AuthSessionUserResponse {
            id: session.user_id,
            display_name: session.display_name,
            login: session.login,
            registration_date: session.registration_date,
        }),
    }))
}

pub async fn update_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthUpdateDisplayNameRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let session_token = read_session_cookie(&headers).ok_or(ApiError::Unauthorized)?;
    let session = resolve_session(&state.repository, &session_token)
        .await
        .map_err(map_auth_error)?;
    let Some(session) = session else {
        return Err(ApiError::Unauthorized);
    };

    let updated_session = update_session_display_name(
        &state.repository,
        &session.user_id,
        payload.display_name.as_str(),
    )
    .await
    .map_err(map_auth_error)?;

    let Some(updated_session) = updated_session else {
        return Err(ApiError::Unauthorized);
    };

    Ok(Json(AuthSessionResponse {
        authenticated: true,
        user: Box::new(AuthSessionUserResponse {
            id: updated_session.user_id,
            display_name: updated_session.display_name,
            login: updated_session.login,
            registration_date: updated_session.registration_date,
        }),
    }))
}

pub async fn logout() -> Result<impl IntoResponse, ApiError> {
    let mut response = StatusCode::NO_CONTENT.into_response();
    let cookie = build_session_clear_cookie();

    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|_| ApiError::Internal)?,
    );

    Ok(response)
}

fn map_login_auth_error(error: AuthError, login: &str, headers: &HeaderMap) -> ApiError {
    match error {
        AuthError::InvalidCredentials => {
            log_auth_failure(login, resolve_ip_from_x_forwarded_for(headers).as_deref());
            ApiError::Unauthorized
        }
        other => map_auth_error(other),
    }
}

fn map_auth_error(error: AuthError) -> ApiError {
    match error {
        AuthError::InvalidCredentials => ApiError::Unauthorized,
        AuthError::Internal => ApiError::Internal,
        AuthError::Validation(message) => ApiError::Validation(message),
        AuthError::Persistence(error) => map_persistence_error(error),
    }
}

fn resolve_ip_from_x_forwarded_for(headers: &HeaderMap) -> Option<String> {
    headers
        .get("X-Forwarded-For")
        .and_then(|value| value.to_str().ok())
        .and_then(|raw| {
            raw.split(',').find_map(|entry| {
                let trimmed = entry.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_owned())
                }
            })
        })
}

fn unix_timestamp_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn sanitize_log_field(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\n', '\r'], " ")
}

fn build_auth_failure_log_line(timestamp: u64, login: &str, resolved_ip: Option<&str>) -> String {
    let login = sanitize_log_field(login);
    let resolved_ip = sanitize_log_field(resolved_ip.unwrap_or(""));
    format!("{timestamp} AUTH_FAIL login=\"{login}\" ip=\"{resolved_ip}\"")
}

fn log_auth_failure(login: &str, resolved_ip: Option<&str>) {
    let timestamp = unix_timestamp_now();
    eprintln!(
        "{}",
        build_auth_failure_log_line(timestamp, login, resolved_ip)
    );
}

fn build_session_cookie(session_token: &str) -> String {
    format!(
        "__Host-pb_session={session_token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age={SESSION_COOKIE_MAX_AGE_SECONDS}"
    )
}

fn build_session_clear_cookie() -> String {
    "__Host-pb_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0".to_owned()
}

fn read_session_cookie(headers: &HeaderMap) -> Option<String> {
    let header = headers.get(COOKIE)?.to_str().ok()?;
    header.split(';').find_map(|pair| {
        let mut parts = pair.trim().splitn(2, '=');
        let name = parts.next()?.trim();
        let value = parts.next()?.trim();
        if name == "__Host-pb_session" && !value.is_empty() {
            Some(value.to_owned())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use axum::http::header::HeaderName;

    use super::{
        build_auth_failure_log_line, build_session_clear_cookie, build_session_cookie,
        resolve_ip_from_x_forwarded_for,
    };
    use axum::http::HeaderMap;

    #[test]
    fn session_cookie_includes_persistence_attributes() {
        let cookie = build_session_cookie("token123");

        assert!(cookie.contains("__Host-pb_session=token123"));
        assert!(cookie.contains("Path=/"));
        assert!(cookie.contains("Secure"));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Strict"));
        assert!(cookie.contains("Max-Age=7776000"));
    }

    #[test]
    fn clear_session_cookie_expires_immediately_and_preserves_security_attributes() {
        let cookie = build_session_clear_cookie();

        assert!(cookie.contains("__Host-pb_session="));
        assert!(cookie.contains("Path=/"));
        assert!(cookie.contains("Secure"));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Strict"));
        assert!(cookie.contains("Max-Age=0"));
    }

    #[test]
    fn resolve_ip_from_x_forwarded_for_returns_none_when_header_missing() {
        let headers = HeaderMap::new();

        let resolved = resolve_ip_from_x_forwarded_for(&headers);

        assert_eq!(resolved, None);
    }

    #[test]
    fn resolve_ip_from_x_forwarded_for_returns_single_value() {
        let mut headers = HeaderMap::new();
        headers.insert(
            HeaderName::from_static("x-forwarded-for"),
            "203.0.113.10".parse().expect("header should parse"),
        );

        let resolved = resolve_ip_from_x_forwarded_for(&headers);

        assert_eq!(resolved.as_deref(), Some("203.0.113.10"));
    }

    #[test]
    fn resolve_ip_from_x_forwarded_for_returns_first_value_from_list() {
        let mut headers = HeaderMap::new();
        headers.insert(
            HeaderName::from_static("x-forwarded-for"),
            "198.51.100.1, 203.0.113.10, 10.0.0.1"
                .parse()
                .expect("header should parse"),
        );

        let resolved = resolve_ip_from_x_forwarded_for(&headers);

        assert_eq!(resolved.as_deref(), Some("198.51.100.1"));
    }

    #[test]
    fn auth_failure_log_line_uses_required_format() {
        let line = build_auth_failure_log_line(1_741_600_000, "alice", Some("203.0.113.10"));

        assert_eq!(
            line,
            "1741600000 AUTH_FAIL login=\"alice\" ip=\"203.0.113.10\""
        );
    }
}
