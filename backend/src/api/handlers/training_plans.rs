use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};

use crate::api::models::{
    PlanExerciseOptionSummaryResponse, TrainingPlanDetailResponse,
    TrainingPlanExerciseDetailResponse, TrainingPlanOptionsQuery, TrainingPlanOptionsResponse,
    TrainingPlanSummaryResponse,
};
use crate::api::session::AuthenticatedSession;
use crate::api::ApiError;
use crate::api::AppState;

pub(crate) async fn list_training_plans(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
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
                last_completed_at: plan.last_completed_at,
            })
            .collect(),
    ))
}

pub(crate) async fn list_training_plan_options(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
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
        exercise_variants: options
            .into_iter()
            .map(|option| PlanExerciseOptionSummaryResponse {
                id: option.id,
                training_plan_exercise_id: option.training_plan_exercise_id,
                exercise_name: option.exercise_name,
                exercise_position: option.exercise_position,
                rep_min: option.rep_min,
                rep_max: option.rep_max,
                target_sets: option.target_sets,
                variant_id: option.variant_id,
                variant_name: option.variant_name,
                variant_type: option.variant_type,
                repetition_kind: match option.repetition_kind.as_str() {
                    "SECS" => crate::models::training_plan_exercise_variant_summary::RepetitionKind::Secs,
                    _ => crate::models::training_plan_exercise_variant_summary::RepetitionKind::Reps,
                },
                load_input_mode: match option.load_input_mode.as_str() {
                    "PER_SIDE" => {
                        crate::models::training_plan_exercise_variant_summary::LoadInputMode::PerSide
                    }
                    _ => crate::models::training_plan_exercise_variant_summary::LoadInputMode::Total,
                },
                set_tracking_mode: match option.set_tracking_mode.as_str() {
                    "UNILATERAL" => {
                        crate::models::training_plan_exercise_variant_summary::SetTrackingMode::Unilateral
                    }
                    _ => crate::models::training_plan_exercise_variant_summary::SetTrackingMode::Bilateral,
                },
                station_id: Some(option.station_id),
                station_name: Some(option.station_name),
                station_profile_loads_kg: Some(option.station_profile_loads_kg),
                suggested_start_load_kg: option.suggested_start_load_kg,
                last_completed_at: option.last_completed_at,
            })
            .collect(),
    }))
}

pub(crate) async fn get_training_plan(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
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
        .fetch_training_plan_for_user(&training_plan_id, &user_id)
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
