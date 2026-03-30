use axum::{
    extract::State,
    http::{
        header::{COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue, StatusCode,
    },
    response::IntoResponse,
    Json,
};

use crate::application::auth::{login_with_access_key, resolve_session, AuthError};

use super::{
    error::map_persistence_error,
    models::{AuthLoginRequest, AuthLoginResponse, AuthSessionResponse, AuthSessionUserResponse},
    ApiError, AppState,
};

const SESSION_COOKIE_MAX_AGE_SECONDS: u64 = 90 * 24 * 60 * 60;

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthLoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let access_key = payload.access_key.trim();
    if access_key.is_empty() {
        return Err(ApiError::Unauthorized);
    }

    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok());

    let session = login_with_access_key(&state.repository, access_key, user_agent, None)
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
        }),
    }))
}

fn map_auth_error(error: AuthError) -> ApiError {
    match error {
        AuthError::InvalidCredentials => ApiError::Unauthorized,
        AuthError::Internal => ApiError::Internal,
        AuthError::Persistence(error) => map_persistence_error(error),
    }
}

fn build_session_cookie(session_token: &str) -> String {
    format!(
        "__Host-pb_session={session_token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age={SESSION_COOKIE_MAX_AGE_SECONDS}"
    )
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
    use super::build_session_cookie;

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
}
