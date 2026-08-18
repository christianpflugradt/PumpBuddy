use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};

use crate::api::models::{
    LoadProfileCreateRequest, LoadProfileSummaryResponse, LoadProfileUpdateRequest,
};
use crate::api::session::AuthenticatedSession;
use crate::api::{ApiError, AppState};
use crate::application::load_profiles::{
    create_load_profile as create_load_profile_service,
    delete_load_profile as delete_load_profile_service,
    list_load_profiles as list_load_profiles_service,
    update_load_profile as update_load_profile_service, LoadProfileServiceError,
};
use crate::domain::LoadProfileSummary as DomainLoadProfileSummary;

fn map_load_profile_service_error(error: LoadProfileServiceError) -> ApiError {
    match error {
        LoadProfileServiceError::Conflict(message) => ApiError::Conflict(message),
        LoadProfileServiceError::NotFound(message) => ApiError::NotFound(message),
        LoadProfileServiceError::Persistence(_) => ApiError::Internal,
        LoadProfileServiceError::Validation(message) => ApiError::Validation(message),
    }
}

fn load_profile_status_response(
    status: &str,
) -> Result<crate::models::load_profile_summary::Status, ApiError> {
    match status {
        "new" => Ok(crate::models::load_profile_summary::Status::New),
        "active" => Ok(crate::models::load_profile_summary::Status::Active),
        "inactive" => Ok(crate::models::load_profile_summary::Status::Inactive),
        _ => Err(ApiError::Internal),
    }
}

fn load_profile_definition_kind_response(
    definition_kind: &str,
) -> Result<crate::models::load_profile_summary::DefinitionKind, ApiError> {
    match definition_kind {
        "fixed_list" => Ok(crate::models::load_profile_summary::DefinitionKind::FixedList),
        "formula" => Ok(crate::models::load_profile_summary::DefinitionKind::Formula),
        _ => Err(ApiError::Internal),
    }
}

fn load_profile_weight_unit_response(
    weight_unit: &str,
) -> Result<crate::models::load_profile_summary::WeightUnit, ApiError> {
    match weight_unit {
        "KG" => Ok(crate::models::load_profile_summary::WeightUnit::Kg),
        "LBS" => Ok(crate::models::load_profile_summary::WeightUnit::Lbs),
        _ => Err(ApiError::Internal),
    }
}

fn load_profile_summary_response(
    load_profile: DomainLoadProfileSummary,
) -> Result<LoadProfileSummaryResponse, ApiError> {
    Ok(LoadProfileSummaryResponse {
        id: load_profile.id,
        name: load_profile.name,
        status: load_profile_status_response(&load_profile.status)?,
        definition_kind: load_profile_definition_kind_response(&load_profile.definition_kind)?,
        weight_unit: load_profile_weight_unit_response(&load_profile.weight_unit)?,
        station_count: load_profile.station_count,
    })
}

pub(crate) async fn list_load_profiles(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<Vec<LoadProfileSummaryResponse>>, ApiError> {
    let user_id = session.user_id.clone();
    let load_profiles = list_load_profiles_service(&state.repository, &user_id)
        .await
        .map_err(map_load_profile_service_error)?;

    Ok(Json(
        load_profiles
            .into_iter()
            .map(load_profile_summary_response)
            .collect::<Result<Vec<_>, _>>()?,
    ))
}

pub(crate) async fn create_load_profile(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Json(payload): Json<LoadProfileCreateRequest>,
) -> Result<(StatusCode, Json<LoadProfileSummaryResponse>), ApiError> {
    let created = create_load_profile_service(
        &state.repository,
        &session.user_id,
        payload.validate_and_into_domain()?,
    )
    .await
    .map_err(map_load_profile_service_error)?;

    Ok((
        StatusCode::CREATED,
        Json(load_profile_summary_response(created)?),
    ))
}

pub(crate) async fn update_load_profile(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(load_profile_id): Path<String>,
    Json(payload): Json<LoadProfileUpdateRequest>,
) -> Result<Json<LoadProfileSummaryResponse>, ApiError> {
    let updated = update_load_profile_service(
        &state.repository,
        &load_profile_id,
        &session.user_id,
        payload.validate_and_into_domain()?,
    )
    .await
    .map_err(map_load_profile_service_error)?;

    Ok(Json(load_profile_summary_response(updated)?))
}

pub(crate) async fn delete_load_profile(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(load_profile_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    delete_load_profile_service(&state.repository, &load_profile_id, &session.user_id)
        .await
        .map_err(map_load_profile_service_error)?;

    Ok(StatusCode::NO_CONTENT)
}
