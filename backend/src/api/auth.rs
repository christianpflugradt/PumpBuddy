use axum::{
    extract::State,
    http::{
        header::{COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::IntoResponse,
    Json,
};

use crate::application::auth::{
    login_with_credentials, logout_session, resolve_session, update_password,
    update_session_display_name, AuthError,
};

use super::{
    error::map_persistence_error,
    models::{
        AuthLoginRequest, AuthLoginResponse, AuthSessionResponse, AuthSessionUserResponse,
        AuthUpdateDisplayNameRequest, AuthUpdatePasswordRequest,
    },
    ApiError, AppState,
};

const SESSION_COOKIE_MAX_AGE_SECONDS: u64 = 90 * 24 * 60 * 60;
const CURRENT_PASSWORD_VALIDATION_FAILED: &str = "Current password validation failed";

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthLoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok());
    let ip_address = extract_client_ip(&headers);

    let session = login_with_credentials(
        &state.repository,
        payload.login.as_str(),
        payload.password.as_str(),
        user_agent,
        ip_address,
    )
    .await
    .map_err(map_auth_error)?;

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
            favorite_gym_id: Some(session.favorite_gym_id),
            max_load_kg: session.max_load_kg,
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
        payload
            .favorite_gym_id
            .as_ref()
            .map(|value| value.as_deref()),
        payload.max_load_kg,
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
            favorite_gym_id: Some(updated_session.favorite_gym_id),
            max_load_kg: updated_session.max_load_kg,
        }),
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    if let Some(session_token) = read_session_cookie(&headers) {
        logout_session(&state.repository, &session_token)
            .await
            .map_err(map_auth_error)?;
    }

    let mut response = StatusCode::NO_CONTENT.into_response();
    let cookie = build_session_clear_cookie();

    response.headers_mut().append(
        SET_COOKIE,
        HeaderValue::from_str(&cookie).map_err(|_| ApiError::Internal)?,
    );

    Ok(response)
}

pub async fn update_password_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthUpdatePasswordRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let session_token = read_session_cookie(&headers).ok_or(ApiError::Unauthorized)?;
    let session = resolve_session(&state.repository, &session_token)
        .await
        .map_err(map_auth_error)?;
    let Some(session) = session else {
        return Err(ApiError::Unauthorized);
    };

    update_password(
        &state.repository,
        &session.user_id,
        payload.current_password.as_str(),
        payload.new_password.as_str(),
        payload.confirm_new_password.as_str(),
    )
    .await
    .map_err(map_auth_error)?;

    Ok(StatusCode::NO_CONTENT)
}

fn map_auth_error(error: AuthError) -> ApiError {
    match error {
        AuthError::InvalidCredentials => ApiError::Unauthorized,
        AuthError::CurrentPasswordMismatch => {
            ApiError::Conflict(CURRENT_PASSWORD_VALIDATION_FAILED.to_owned())
        }
        AuthError::Internal => ApiError::Internal,
        AuthError::Validation(message) => ApiError::Validation(message),
        AuthError::Persistence(error) => map_persistence_error(error),
    }
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

fn extract_client_ip(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|value| value.to_str().ok())
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
}

#[cfg(test)]
mod tests {
    use super::{build_session_clear_cookie, build_session_cookie};

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
}
