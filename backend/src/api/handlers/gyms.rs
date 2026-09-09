use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::StatusCode,
    Extension, Json,
};

use crate::api::boundary::{
    load_input_mode, repetition_kind, set_tracking_mode, EnumTranslationError, LoadInputMode,
    RepetitionKind, SetTrackingMode,
};
use crate::api::models::{
    ConfiguratorStationCreateRequest, ConfiguratorStationLoadProfileResponse,
    ConfiguratorStationResponse, ConfiguratorStationUpdateRequest, GymDetailResponse,
    GymExerciseGroupResponse, GymExerciseVariantSummaryResponse, GymLoadProfileSummaryResponse,
    GymStationDetailResponse, GymStationExerciseGroupResponse,
    GymStationExerciseVariantSummaryResponse, GymStationOptionResponse, GymStationSummaryResponse,
    GymSummaryResponse, GymWriteRequest,
};
use crate::api::session::AuthenticatedSession;
use crate::api::ApiError;
use crate::api::AppState;
use crate::application::gyms::{
    create_configurator_station as create_configurator_station_service,
    create_gym as create_gym_service,
    delete_configurator_station as delete_configurator_station_service,
    delete_gym as delete_gym_service, get_configurator_station as get_configurator_station_service,
    get_gym_detail as get_gym_detail_service,
    get_gym_station_detail as get_gym_station_detail_service,
    list_configurator_stations as list_configurator_stations_service,
    list_gyms as list_gyms_service,
    update_configurator_station as update_configurator_station_service,
    update_gym as update_gym_service, GymServiceError,
};
use crate::domain::{
    ConfiguratorStation, GymDetail, GymExerciseGroup, GymExerciseVariantSummary,
    GymLoadProfileSummary, GymStationAvailability, GymStationDetail, GymStationExerciseGroup,
    GymStationExerciseVariantSummary, GymSummary,
};

fn map_enum_translation_error(error: EnumTranslationError) -> ApiError {
    eprintln!("{error}");
    ApiError::Internal
}

fn map_gym_service_error(error: GymServiceError) -> ApiError {
    match error {
        GymServiceError::Conflict(message) => ApiError::Conflict(message),
        GymServiceError::NotFound(message) => ApiError::NotFound(message),
        GymServiceError::Persistence(_) => ApiError::Internal,
        GymServiceError::Validation(message) => ApiError::Validation(message),
    }
}

fn repetition_kind_response(
    kind: RepetitionKind,
) -> crate::models::gym_exercise_variant_summary::RepetitionKind {
    match kind {
        RepetitionKind::Reps => crate::models::gym_exercise_variant_summary::RepetitionKind::Reps,
        RepetitionKind::Secs => crate::models::gym_exercise_variant_summary::RepetitionKind::Secs,
    }
}

fn load_input_mode_response(
    mode: LoadInputMode,
) -> crate::models::gym_exercise_variant_summary::LoadInputMode {
    match mode {
        LoadInputMode::Total => crate::models::gym_exercise_variant_summary::LoadInputMode::Total,
        LoadInputMode::PerSide => {
            crate::models::gym_exercise_variant_summary::LoadInputMode::PerSide
        }
    }
}

fn set_tracking_mode_response(
    mode: SetTrackingMode,
) -> crate::models::gym_exercise_variant_summary::SetTrackingMode {
    match mode {
        SetTrackingMode::Bilateral => {
            crate::models::gym_exercise_variant_summary::SetTrackingMode::Bilateral
        }
        SetTrackingMode::Unilateral => {
            crate::models::gym_exercise_variant_summary::SetTrackingMode::Unilateral
        }
    }
}

fn station_repetition_kind_response(
    kind: RepetitionKind,
) -> crate::models::gym_station_exercise_variant_summary::RepetitionKind {
    match kind {
        RepetitionKind::Reps => {
            crate::models::gym_station_exercise_variant_summary::RepetitionKind::Reps
        }
        RepetitionKind::Secs => {
            crate::models::gym_station_exercise_variant_summary::RepetitionKind::Secs
        }
    }
}

fn station_load_input_mode_response(
    mode: LoadInputMode,
) -> crate::models::gym_station_exercise_variant_summary::LoadInputMode {
    match mode {
        LoadInputMode::Total => {
            crate::models::gym_station_exercise_variant_summary::LoadInputMode::Total
        }
        LoadInputMode::PerSide => {
            crate::models::gym_station_exercise_variant_summary::LoadInputMode::PerSide
        }
    }
}

fn station_set_tracking_mode_response(
    mode: SetTrackingMode,
) -> crate::models::gym_station_exercise_variant_summary::SetTrackingMode {
    match mode {
        SetTrackingMode::Bilateral => {
            crate::models::gym_station_exercise_variant_summary::SetTrackingMode::Bilateral
        }
        SetTrackingMode::Unilateral => {
            crate::models::gym_station_exercise_variant_summary::SetTrackingMode::Unilateral
        }
    }
}

fn load_profile_weight_unit_response(
    weight_unit: &str,
) -> Result<crate::models::gym_load_profile_summary::WeightUnit, EnumTranslationError> {
    match weight_unit {
        "KG" => Ok(crate::models::gym_load_profile_summary::WeightUnit::Kg),
        "LBS" => Ok(crate::models::gym_load_profile_summary::WeightUnit::Lbs),
        invalid => Err(EnumTranslationError {
            field: "load_profile.weight_unit",
            value: invalid.to_owned(),
        }),
    }
}

fn load_profile_definition_kind_response(
    definition_kind: &str,
) -> Result<crate::models::gym_load_profile_summary::DefinitionKind, EnumTranslationError> {
    match definition_kind {
        "fixed_list" => Ok(crate::models::gym_load_profile_summary::DefinitionKind::FixedList),
        "formula" => Ok(crate::models::gym_load_profile_summary::DefinitionKind::Formula),
        invalid => Err(EnumTranslationError {
            field: "load_profile.definition_kind",
            value: invalid.to_owned(),
        }),
    }
}

fn station_availability_response(
    availability: GymStationAvailability,
) -> crate::models::gym_exercise_variant_summary::StationAvailability {
    match availability {
        GymStationAvailability::Stationless => {
            crate::models::gym_exercise_variant_summary::StationAvailability::Stationless
        }
        GymStationAvailability::SingleStation => {
            crate::models::gym_exercise_variant_summary::StationAvailability::SingleStation
        }
        GymStationAvailability::MultiStation => {
            crate::models::gym_exercise_variant_summary::StationAvailability::MultiStation
        }
    }
}

fn gym_status_response(
    status: &str,
) -> Result<crate::models::gym_summary::Status, EnumTranslationError> {
    match status {
        "new" => Ok(crate::models::gym_summary::Status::New),
        "active" => Ok(crate::models::gym_summary::Status::Active),
        "inactive" => Ok(crate::models::gym_summary::Status::Inactive),
        invalid => Err(EnumTranslationError {
            field: "gym.status",
            value: invalid.to_owned(),
        }),
    }
}

fn gym_detail_status_response(
    status: &str,
) -> Result<crate::models::gym_detail_response::Status, EnumTranslationError> {
    match status {
        "new" => Ok(crate::models::gym_detail_response::Status::New),
        "active" => Ok(crate::models::gym_detail_response::Status::Active),
        "inactive" => Ok(crate::models::gym_detail_response::Status::Inactive),
        invalid => Err(EnumTranslationError {
            field: "gym.status",
            value: invalid.to_owned(),
        }),
    }
}

fn gym_summary_response(gym: GymSummary) -> Result<GymSummaryResponse, EnumTranslationError> {
    Ok(GymSummaryResponse {
        id: gym.id,
        name: gym.name,
        status: gym_status_response(&gym.status)?,
        station_count: Some(Some(gym.station_count)),
        last_visited_at: Some(gym.last_visited_at),
    })
}

fn gym_exercise_variant_response(
    variant: GymExerciseVariantSummary,
) -> Result<GymExerciseVariantSummaryResponse, EnumTranslationError> {
    Ok(GymExerciseVariantSummaryResponse {
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        requires_station: variant.requires_station,
        station_availability: station_availability_response(variant.station_availability),
        repetition_kind: repetition_kind_response(repetition_kind(&variant.repetition_kind)?),
        load_input_mode: load_input_mode_response(load_input_mode(&variant.load_input_mode)?),
        set_tracking_mode: set_tracking_mode_response(set_tracking_mode(
            &variant.set_tracking_mode,
        )?),
        station_options: variant
            .station_options
            .into_iter()
            .map(|station| GymStationOptionResponse {
                station_id: station.station_id,
                station_name: station.station_name,
                station_profile_loads_kg: None,
            })
            .collect(),
    })
}

fn gym_exercise_group_response(
    group: GymExerciseGroup,
) -> Result<GymExerciseGroupResponse, EnumTranslationError> {
    Ok(GymExerciseGroupResponse {
        exercise_id: group.exercise_id,
        exercise_name: group.exercise_name,
        variants: group
            .variants
            .into_iter()
            .map(gym_exercise_variant_response)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn gym_station_exercise_variant_response(
    variant: GymStationExerciseVariantSummary,
) -> Result<GymStationExerciseVariantSummaryResponse, EnumTranslationError> {
    Ok(GymStationExerciseVariantSummaryResponse {
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        repetition_kind: station_repetition_kind_response(repetition_kind(
            &variant.repetition_kind,
        )?),
        load_input_mode: station_load_input_mode_response(load_input_mode(
            &variant.load_input_mode,
        )?),
        set_tracking_mode: station_set_tracking_mode_response(set_tracking_mode(
            &variant.set_tracking_mode,
        )?),
    })
}

fn gym_station_exercise_group_response(
    group: GymStationExerciseGroup,
) -> Result<GymStationExerciseGroupResponse, EnumTranslationError> {
    Ok(GymStationExerciseGroupResponse {
        exercise_id: group.exercise_id,
        exercise_name: group.exercise_name,
        variants: group
            .variants
            .into_iter()
            .map(gym_station_exercise_variant_response)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn gym_load_profile_response(
    load_profile: GymLoadProfileSummary,
) -> Result<GymLoadProfileSummaryResponse, EnumTranslationError> {
    Ok(GymLoadProfileSummaryResponse {
        id: load_profile.id,
        name: load_profile.name,
        weight_unit: load_profile_weight_unit_response(&load_profile.weight_unit)?,
        definition_kind: load_profile_definition_kind_response(&load_profile.definition_kind)?,
        possible_loads_kg: load_profile.possible_loads_kg,
    })
}

fn gym_station_detail_response(
    station: GymStationDetail,
) -> Result<GymStationDetailResponse, EnumTranslationError> {
    Ok(GymStationDetailResponse {
        gym_id: station.gym_id,
        gym_name: station.gym_name,
        station_id: station.station_id,
        station_name: station.station_name,
        load_profile: Box::new(gym_load_profile_response(station.load_profile)?),
        suitable_variant_groups: station
            .suitable_variant_groups
            .into_iter()
            .map(gym_station_exercise_group_response)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn gym_detail_response(gym: GymDetail) -> Result<GymDetailResponse, EnumTranslationError> {
    Ok(GymDetailResponse {
        id: gym.id,
        name: gym.name,
        status: gym_detail_status_response(&gym.status)?,
        station_count: gym.station_count,
        last_visited_at: gym.last_visited_at,
        stations: gym
            .stations
            .into_iter()
            .map(|station| GymStationSummaryResponse {
                id: station.id,
                name: station.name,
                load_profile_name: station.load_profile_name,
                suitable_variant_count: station.suitable_variant_count,
            })
            .collect(),
        exercise_groups: gym
            .exercise_groups
            .into_iter()
            .map(gym_exercise_group_response)
            .collect::<Result<Vec<_>, _>>()?,
    })
}

fn configurator_station_status_response(
    status: &str,
) -> Result<crate::models::configurator_station_response::Status, EnumTranslationError> {
    match status {
        "new" => Ok(crate::models::configurator_station_response::Status::New),
        "active" => Ok(crate::models::configurator_station_response::Status::Active),
        "inactive" => Ok(crate::models::configurator_station_response::Status::Inactive),
        value => Err(EnumTranslationError {
            field: "station.status",
            value: value.to_owned(),
        }),
    }
}
fn configurator_load_profile_status_response(
    status: &str,
) -> Result<crate::models::configurator_station_load_profile::Status, EnumTranslationError> {
    match status {
        "new" => Ok(crate::models::configurator_station_load_profile::Status::New),
        "active" => Ok(crate::models::configurator_station_load_profile::Status::Active),
        "inactive" => Ok(crate::models::configurator_station_load_profile::Status::Inactive),
        value => Err(EnumTranslationError {
            field: "load_profile.status",
            value: value.to_owned(),
        }),
    }
}
fn configurator_station_response(
    station: ConfiguratorStation,
) -> Result<ConfiguratorStationResponse, EnumTranslationError> {
    Ok(ConfiguratorStationResponse {
        id: station.id,
        gym_id: station.gym_id,
        name: station.name,
        status: configurator_station_status_response(&station.status)?,
        load_profile: Box::new(ConfiguratorStationLoadProfileResponse {
            id: station.load_profile.id,
            name: station.load_profile.name,
            status: configurator_load_profile_status_response(&station.load_profile.status)?,
        }),
    })
}

pub(crate) async fn list_gyms(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let user_id = session.user_id.clone();
    let favorite_gym_id = session.favorite_gym_id.clone();
    let gyms = list_gyms_service(&state.repository, &user_id, favorite_gym_id.as_deref())
        .await
        .map_err(map_gym_service_error)?;

    Ok(Json(
        gyms.into_iter()
            .map(gym_summary_response)
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn create_gym(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    payload: Result<Json<GymWriteRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<GymSummaryResponse>), ApiError> {
    let payload = payload
        .map_err(|_| ApiError::Validation("Invalid gym create payload".to_owned()))?
        .0;
    let gym = create_gym_service(&state.repository, &session.user_id, payload.into_new_gym())
        .await
        .map_err(map_gym_service_error)?;
    Ok((
        StatusCode::CREATED,
        Json(gym_summary_response(gym).map_err(map_enum_translation_error)?),
    ))
}

pub(crate) async fn update_gym(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(gym_id): Path<String>,
    payload: Result<Json<GymWriteRequest>, JsonRejection>,
) -> Result<Json<GymSummaryResponse>, ApiError> {
    let payload = payload
        .map_err(|_| ApiError::Validation("Invalid gym update payload".to_owned()))?
        .0;
    let gym = update_gym_service(
        &state.repository,
        &gym_id,
        &session.user_id,
        payload.into_gym_update(),
    )
    .await
    .map_err(map_gym_service_error)?;
    Ok(Json(
        gym_summary_response(gym).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn delete_gym(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(gym_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    delete_gym_service(&state.repository, &gym_id, &session.user_id)
        .await
        .map_err(map_gym_service_error)?;
    Ok(StatusCode::NO_CONTENT)
}

pub(crate) async fn get_gym_detail(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(gym_id): Path<String>,
) -> Result<Json<GymDetailResponse>, ApiError> {
    let user_id = session.user_id.clone();
    let gym = get_gym_detail_service(&state.repository, &gym_id, &user_id)
        .await
        .map_err(map_gym_service_error)?;

    Ok(Json(
        gym_detail_response(gym).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn get_gym_station_detail(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path((gym_id, station_id)): Path<(String, String)>,
) -> Result<Json<GymStationDetailResponse>, ApiError> {
    let user_id = session.user_id.clone();
    let station = get_gym_station_detail_service(&state.repository, &gym_id, &station_id, &user_id)
        .await
        .map_err(map_gym_service_error)?;

    Ok(Json(
        gym_station_detail_response(station).map_err(map_enum_translation_error)?,
    ))
}

pub(crate) async fn create_configurator_station(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(gym_id): Path<String>,
    payload: Result<Json<ConfiguratorStationCreateRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<ConfiguratorStationResponse>), ApiError> {
    let payload = payload
        .map_err(|_| ApiError::Validation("Invalid station create payload".to_owned()))?
        .0;
    let station = create_configurator_station_service(
        &state.repository,
        &gym_id,
        &session.user_id,
        payload.into_new_configurator_station(),
    )
    .await
    .map_err(map_gym_service_error)?;
    Ok((
        StatusCode::CREATED,
        Json(configurator_station_response(station).map_err(map_enum_translation_error)?),
    ))
}
pub(crate) async fn list_configurator_stations(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(gym_id): Path<String>,
) -> Result<Json<Vec<ConfiguratorStationResponse>>, ApiError> {
    let stations = list_configurator_stations_service(&state.repository, &gym_id, &session.user_id)
        .await
        .map_err(map_gym_service_error)?;
    Ok(Json(
        stations
            .into_iter()
            .map(configurator_station_response)
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_enum_translation_error)?,
    ))
}
pub(crate) async fn get_configurator_station(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path((gym_id, station_id)): Path<(String, String)>,
) -> Result<Json<ConfiguratorStationResponse>, ApiError> {
    let station =
        get_configurator_station_service(&state.repository, &gym_id, &station_id, &session.user_id)
            .await
            .map_err(map_gym_service_error)?;
    Ok(Json(
        configurator_station_response(station).map_err(map_enum_translation_error)?,
    ))
}
pub(crate) async fn update_configurator_station(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path((gym_id, station_id)): Path<(String, String)>,
    payload: Result<Json<ConfiguratorStationUpdateRequest>, JsonRejection>,
) -> Result<Json<ConfiguratorStationResponse>, ApiError> {
    let payload = payload
        .map_err(|_| ApiError::Validation("Invalid station update payload".to_owned()))?
        .0;
    let station = update_configurator_station_service(
        &state.repository,
        &gym_id,
        &station_id,
        &session.user_id,
        payload.into_configurator_station_update(),
    )
    .await
    .map_err(map_gym_service_error)?;
    Ok(Json(
        configurator_station_response(station).map_err(map_enum_translation_error)?,
    ))
}
pub(crate) async fn delete_configurator_station(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path((gym_id, station_id)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    delete_configurator_station_service(&state.repository, &gym_id, &station_id, &session.user_id)
        .await
        .map_err(map_gym_service_error)?;
    Ok(StatusCode::NO_CONTENT)
}
