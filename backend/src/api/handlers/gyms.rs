use axum::{extract::State, Json};

use crate::api::models::GymSummaryResponse;
use crate::api::ApiError;
use crate::api::AppState;

pub(crate) async fn list_gyms(
    State(state): State<AppState>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let gyms = state
        .repository
        .fetch_gym_summaries()
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(
        gyms.into_iter()
            .map(|gym| GymSummaryResponse {
                id: gym.id,
                name: gym.name,
            })
            .collect(),
    ))
}
