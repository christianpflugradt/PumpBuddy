use axum::{extract::State, Extension, Json};

use crate::api::models::GymSummaryResponse;
use crate::api::session::AuthenticatedSession;
use crate::api::ApiError;
use crate::api::AppState;

pub(crate) async fn list_gyms(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let user_id = session.user_id.clone();
    let gyms = state
        .repository
        .fetch_gym_summaries_for_user(&user_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(
        gyms.into_iter()
            .map(|gym| GymSummaryResponse {
                id: gym.id,
                name: gym.name,
                station_count: None,
                last_visited_at: None,
            })
            .collect(),
    ))
}
