use axum::{
    extract::{Path, State},
    Extension, Json,
};

use crate::api::boundary::{
    load_input_mode, repetition_kind, set_tracking_mode, EnumTranslationError, LoadInputMode,
    RepetitionKind, SetTrackingMode,
};
use crate::api::models::{
    GymDetailResponse, GymExerciseGroupResponse, GymExerciseVariantSummaryResponse,
    GymStationOptionResponse, GymStationSummaryResponse, GymSummaryResponse,
};
use crate::api::session::AuthenticatedSession;
use crate::api::ApiError;
use crate::api::AppState;
use crate::domain::{
    GymDetail, GymExerciseGroup, GymExerciseVariantSummary, GymStationAvailability, GymSummary,
};

fn map_enum_translation_error(error: EnumTranslationError) -> ApiError {
    eprintln!("{error}");
    ApiError::Internal
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

fn gym_summary_response(gym: GymSummary) -> GymSummaryResponse {
    GymSummaryResponse {
        id: gym.id,
        name: gym.name,
        station_count: Some(Some(gym.station_count)),
        last_visited_at: Some(gym.last_visited_at),
    }
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

fn gym_detail_response(gym: GymDetail) -> Result<GymDetailResponse, EnumTranslationError> {
    Ok(GymDetailResponse {
        id: gym.id,
        name: gym.name,
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

pub(crate) async fn list_gyms(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let user_id = session.user_id.clone();
    let favorite_gym_id = session.favorite_gym_id.clone();
    let gyms = state
        .repository
        .fetch_gym_summaries_for_user_with_favorite(&user_id, favorite_gym_id.as_deref())
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(gyms.into_iter().map(gym_summary_response).collect()))
}

pub(crate) async fn get_gym_detail(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(gym_id): Path<String>,
) -> Result<Json<GymDetailResponse>, ApiError> {
    let user_id = session.user_id.clone();
    let gym = state
        .repository
        .fetch_gym_detail_for_user(&gym_id, &user_id)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or_else(|| ApiError::NotFound("Gym not found".to_owned()))?;

    Ok(Json(
        gym_detail_response(gym).map_err(map_enum_translation_error)?,
    ))
}
