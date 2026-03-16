use axum::{
    extract::{State, Extension, Path, Query},
    Json,
};

use crate::api::models::{
    TrainingPlanSummaryResponse, TrainingPlanOptionsQuery, TrainingPlanOptionsResponse,
    PlanExerciseOptionSummaryResponse,
};
use crate::api::AppState;
use crate::api::ApiError;

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
                station_id: option.station_id,
                station_name: option.station_name,
            })
            .collect(),
    }))
}
