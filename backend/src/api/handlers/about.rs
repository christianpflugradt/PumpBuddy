use axum::{extract::State, Extension, Json};

use crate::api::models::AboutMetadataResponse;
use crate::api::session::AuthenticatedSession;
use crate::api::AppState;
use crate::application::build_metadata::{current_build_metadata, render_timestamp_utc};

pub(crate) async fn get_about_metadata(
    State(_state): State<AppState>,
    Extension(_session): Extension<AuthenticatedSession>,
) -> Json<AboutMetadataResponse> {
    let metadata = current_build_metadata();

    Json(AboutMetadataResponse {
        app_version: metadata.app_version.to_owned(),
        commit_hash_short: metadata.short_commit_hash(),
        build_timestamp_utc: render_timestamp_utc(metadata.build_timestamp),
        channel: metadata.channel.to_owned(),
    })
}
