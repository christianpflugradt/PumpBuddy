use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};

use crate::api::models::{
    PlanExerciseOptionSummaryResponse, TrainingPlanDetailResponse,
    TrainingPlanExerciseDetailResponse, TrainingPlanOptionsQuery, TrainingPlanOptionsResponse,
    TrainingPlanSummaryResponse,
};
use crate::api::ApiError;
use crate::api::AppState;

pub(crate) async fn list_training_plans(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
) -> Result<Json<Vec<TrainingPlanSummaryResponse>>, ApiError> {
    let user_id = session.user_id.clone();
    let plans = state
        .repository
        .fetch_training_plan_summaries_for_user(&user_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(
        plans
            .into_iter()
            .map(|plan| TrainingPlanSummaryResponse {
                id: plan.id,
                name: plan.name,
                exercise_count: plan.exercise_count,
            })
            .collect(),
    ))
}

pub(crate) async fn list_training_plan_options(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(training_plan_id): Path<String>,
    Query(query): Query<TrainingPlanOptionsQuery>,
) -> Result<Json<TrainingPlanOptionsResponse>, ApiError> {
    let user_id = session.user_id.clone();
    let options = state
        .repository
        .fetch_plan_exercise_option_summaries_for_user(&training_plan_id, &query.gym_id, &user_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(TrainingPlanOptionsResponse {
        training_plan_id,
        gym_id: query.gym_id,
        options: options
            .into_iter()
            .map(|option| PlanExerciseOptionSummaryResponse {
                id: option.id,
                training_plan_exercise_id: option.training_plan_exercise_id,
                exercise_name: option.exercise_name,
                exercise_position: option.exercise_position,
                variant_id: option.variant_id,
                variant_name: option.variant_name,
                variant_type: option.variant_type,
                station_id: Some(option.station_id),
                station_name: Some(option.station_name),
                station_profile_loads_kg: Some(option.station_profile_loads_kg),
            })
            .collect(),
    }))
}

pub(crate) async fn get_training_plan(
    State(state): State<AppState>,
    Extension(session): Extension<crate::persistence::AuthenticatedSession>,
    Path(training_plan_id): Path<String>,
) -> Result<Json<TrainingPlanDetailResponse>, ApiError> {
    let user_id = session.user_id.clone();
    let visible_plan_ids = state
        .repository
        .fetch_training_plan_summaries_for_user(&user_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    if !visible_plan_ids
        .iter()
        .any(|plan| plan.id == training_plan_id)
    {
        return Err(ApiError::NotFound("Training plan not found".to_owned()));
    }

    let plan = state
        .repository
        .fetch_training_plan(&training_plan_id)
        .await
        .map_err(|_| ApiError::Internal)?
        .ok_or_else(|| ApiError::NotFound("Training plan not found".to_owned()))?;

    Ok(Json(TrainingPlanDetailResponse {
        id: plan.id,
        name: plan.name,
        exercises: plan
            .exercises
            .into_iter()
            .map(|exercise| TrainingPlanExerciseDetailResponse {
                training_plan_exercise_id: exercise.id,
                exercise_name: exercise.exercise.name,
                exercise_position: exercise.position,
            })
            .collect(),
    }))
}
