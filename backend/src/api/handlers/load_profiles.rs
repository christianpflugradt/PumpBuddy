use axum::{extract::State, Extension, Json};

use crate::api::models::LoadProfileSummaryResponse;
use crate::api::session::AuthenticatedSession;
use crate::api::{ApiError, AppState};
use crate::application::load_profiles::{
    list_load_profiles as list_load_profiles_service, LoadProfileServiceError,
};
use crate::domain::LoadProfileSummary as DomainLoadProfileSummary;

fn map_load_profile_service_error(error: LoadProfileServiceError) -> ApiError {
    match error {
        LoadProfileServiceError::Persistence(_) => ApiError::Internal,
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
