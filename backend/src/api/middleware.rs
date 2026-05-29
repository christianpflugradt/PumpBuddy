use axum::body::Body;
use axum::extract::State;
use axum::http::{header::COOKIE, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::api::session::AuthenticatedSession;
use crate::api::AppState;
use crate::application::auth::resolve_session;

// Middleware that requires a valid session for protected routes.
// If a valid session is found, the API-owned AuthenticatedSession
// is inserted into request extensions so handlers can extract it.
pub async fn require_session(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let session_token = req
        .headers()
        .get(COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_header| {
            cookie_header.split(';').find_map(|pair| {
                let (name, value) = pair.trim().split_once('=')?;
                if name == "__Host-pb_session" && !value.is_empty() {
                    Some(value.to_owned())
                } else {
                    None
                }
            })
        });

    let Some(token) = session_token else {
        return StatusCode::UNAUTHORIZED.into_response();
    };

    match resolve_session(&state.repository, &token).await {
        Ok(Some(session)) => {
            let api_session = AuthenticatedSession {
                user_id: session.user_id,
                favorite_gym_id: session.favorite_gym_id,
            };
            req.extensions_mut().insert(api_session);
            next.run(req).await
        }
        Ok(None) => StatusCode::UNAUTHORIZED.into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}
