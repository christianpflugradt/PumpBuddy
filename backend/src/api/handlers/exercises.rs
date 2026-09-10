use crate::{
    api::session::AuthenticatedSession,
    api::{
        models::{
            ExerciseCreateRequest, ExerciseSummaryResponse, ExerciseUpdateRequest,
            ExerciseVariantCreateRequest, ExerciseVariantResponse, ExerciseVariantUpdateRequest,
        },
        ApiError, AppState,
    },
    application::exercises::{self, ExerciseServiceError},
    domain,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
fn error(e: ExerciseServiceError) -> ApiError {
    match e {
        ExerciseServiceError::Conflict(m) => ApiError::Conflict(m),
        ExerciseServiceError::NotFound(m) => ApiError::NotFound(m),
        ExerciseServiceError::Validation(m) => ApiError::Validation(m),
        ExerciseServiceError::Persistence(_) => ApiError::Internal,
    }
}
fn status(v: &str) -> Result<crate::models::exercise_summary::Status, ApiError> {
    match v {
        "new" => Ok(crate::models::exercise_summary::Status::New),
        "active" => Ok(crate::models::exercise_summary::Status::Active),
        "inactive" => Ok(crate::models::exercise_summary::Status::Inactive),
        _ => Err(ApiError::Internal),
    }
}
fn summary(x: domain::ExerciseSummary) -> Result<ExerciseSummaryResponse, ApiError> {
    Ok(ExerciseSummaryResponse {
        id: x.id,
        name: x.name,
        status: status(&x.status)?,
        variant_count: x.variant_count,
    })
}
fn variant_status(v: &str) -> Result<crate::models::exercise_variant::Status, ApiError> {
    match v {
        "new" => Ok(crate::models::exercise_variant::Status::New),
        "active" => Ok(crate::models::exercise_variant::Status::Active),
        "inactive" => Ok(crate::models::exercise_variant::Status::Inactive),
        _ => Err(ApiError::Internal),
    }
}
fn variant(x: domain::ExerciseVariant) -> Result<ExerciseVariantResponse, ApiError> {
    Ok(ExerciseVariantResponse {
        id: x.id,
        exercise_id: x.exercise_id,
        name: x.name,
        status: variant_status(&x.status)?,
        requires_station: x.requires_station,
        load_input_mode: match x.load_input_mode.as_str() {
            "TOTAL" => crate::models::exercise_variant::LoadInputMode::Total,
            "PER_SIDE" => crate::models::exercise_variant::LoadInputMode::PerSide,
            _ => return Err(ApiError::Internal),
        },
        set_tracking_mode: match x.set_tracking_mode.as_str() {
            "BILATERAL" => crate::models::exercise_variant::SetTrackingMode::Bilateral,
            "UNILATERAL" => crate::models::exercise_variant::SetTrackingMode::Unilateral,
            _ => return Err(ApiError::Internal),
        },
        repetition_kind: match x.repetition_kind.as_str() {
            "REPS" => crate::models::exercise_variant::RepetitionKind::Reps,
            "SECS" => crate::models::exercise_variant::RepetitionKind::Secs,
            _ => return Err(ApiError::Internal),
        },
    })
}
pub(crate) async fn list_exercises(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
) -> Result<Json<Vec<ExerciseSummaryResponse>>, ApiError> {
    Ok(Json(
        exercises::list_exercises(&s.repository, &a.user_id)
            .await
            .map_err(error)?
            .into_iter()
            .map(summary)
            .collect::<Result<_, _>>()?,
    ))
}
pub(crate) async fn get_exercise(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path(id): Path<String>,
) -> Result<Json<ExerciseSummaryResponse>, ApiError> {
    Ok(Json(summary(
        exercises::get_exercise(&s.repository, &id, &a.user_id)
            .await
            .map_err(error)?,
    )?))
}
pub(crate) async fn create_exercise(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Json(x): Json<ExerciseCreateRequest>,
) -> Result<(StatusCode, Json<ExerciseSummaryResponse>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(summary(
            exercises::create_exercise(&s.repository, &a.user_id, x.into_domain())
                .await
                .map_err(error)?,
        )?),
    ))
}
pub(crate) async fn update_exercise(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path(id): Path<String>,
    Json(x): Json<ExerciseUpdateRequest>,
) -> Result<Json<ExerciseSummaryResponse>, ApiError> {
    Ok(Json(summary(
        exercises::update_exercise(&s.repository, &id, &a.user_id, x.into_domain())
            .await
            .map_err(error)?,
    )?))
}
pub(crate) async fn delete_exercise(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    exercises::delete_exercise(&s.repository, &id, &a.user_id)
        .await
        .map_err(error)?;
    Ok(StatusCode::NO_CONTENT)
}
pub(crate) async fn list_exercise_variants(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ExerciseVariantResponse>>, ApiError> {
    Ok(Json(
        exercises::list_variants(&s.repository, &id, &a.user_id)
            .await
            .map_err(error)?
            .into_iter()
            .map(variant)
            .collect::<Result<_, _>>()?,
    ))
}
pub(crate) async fn get_exercise_variant(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path((e, v)): Path<(String, String)>,
) -> Result<Json<ExerciseVariantResponse>, ApiError> {
    Ok(Json(variant(
        exercises::get_variant(&s.repository, &e, &v, &a.user_id)
            .await
            .map_err(error)?,
    )?))
}
pub(crate) async fn create_exercise_variant(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path(e): Path<String>,
    Json(x): Json<ExerciseVariantCreateRequest>,
) -> Result<(StatusCode, Json<ExerciseVariantResponse>), ApiError> {
    Ok((
        StatusCode::CREATED,
        Json(variant(
            exercises::create_variant(&s.repository, &e, &a.user_id, x.into_domain())
                .await
                .map_err(error)?,
        )?),
    ))
}
pub(crate) async fn update_exercise_variant(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path((e, v)): Path<(String, String)>,
    Json(x): Json<ExerciseVariantUpdateRequest>,
) -> Result<Json<ExerciseVariantResponse>, ApiError> {
    Ok(Json(variant(
        exercises::update_variant(&s.repository, &e, &v, &a.user_id, x.into_domain())
            .await
            .map_err(error)?,
    )?))
}
pub(crate) async fn delete_exercise_variant(
    State(s): State<AppState>,
    Extension(a): Extension<AuthenticatedSession>,
    Path((e, v)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    exercises::delete_variant(&s.repository, &e, &v, &a.user_id)
        .await
        .map_err(error)?;
    Ok(StatusCode::NO_CONTENT)
}
