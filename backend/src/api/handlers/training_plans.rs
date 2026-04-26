use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};

use crate::api::boundary::{
    load_input_mode, repetition_kind, set_tracking_mode, EnumTranslationError, LoadInputMode,
    RepetitionKind, SetTrackingMode,
};
use crate::api::models::{
    TrainingPlanDetailResponse, TrainingPlanExerciseDetailResponse,
    TrainingPlanExerciseVariantSummaryResponse, TrainingPlanExerciseVariantsQuery,
    TrainingPlanExerciseVariantsResponse, TrainingPlanSummaryResponse,
};
use crate::api::session::AuthenticatedSession;
use crate::api::ApiError;
use crate::api::AppState;
use crate::domain::PlanExerciseOptionSummary;

fn map_enum_translation_error(error: EnumTranslationError) -> ApiError {
    eprintln!("{error}");
    ApiError::Internal
}

fn repetition_kind_response(
    kind: RepetitionKind,
) -> crate::models::training_plan_exercise_variant_summary::RepetitionKind {
    match kind {
        RepetitionKind::Reps => {
            crate::models::training_plan_exercise_variant_summary::RepetitionKind::Reps
        }
        RepetitionKind::Secs => {
            crate::models::training_plan_exercise_variant_summary::RepetitionKind::Secs
        }
    }
}

fn load_input_mode_response(
    mode: LoadInputMode,
) -> crate::models::training_plan_exercise_variant_summary::LoadInputMode {
    match mode {
        LoadInputMode::Total => {
            crate::models::training_plan_exercise_variant_summary::LoadInputMode::Total
        }
        LoadInputMode::PerSide => {
            crate::models::training_plan_exercise_variant_summary::LoadInputMode::PerSide
        }
    }
}

fn set_tracking_mode_response(
    mode: SetTrackingMode,
) -> crate::models::training_plan_exercise_variant_summary::SetTrackingMode {
    match mode {
        SetTrackingMode::Bilateral => {
            crate::models::training_plan_exercise_variant_summary::SetTrackingMode::Bilateral
        }
        SetTrackingMode::Unilateral => {
            crate::models::training_plan_exercise_variant_summary::SetTrackingMode::Unilateral
        }
    }
}

fn training_plan_exercise_variant_response(
    option: PlanExerciseOptionSummary,
) -> Result<TrainingPlanExerciseVariantSummaryResponse, EnumTranslationError> {
    Ok(TrainingPlanExerciseVariantSummaryResponse {
        id: option.id,
        training_plan_exercise_id: option.training_plan_exercise_id,
        exercise_name: option.exercise_name,
        exercise_position: option.exercise_position,
        rep_min: option.rep_min,
        rep_max: option.rep_max,
        target_sets: option.target_sets,
        variant_id: option.variant_id,
        variant_name: option.variant_name,
        repetition_kind: repetition_kind_response(repetition_kind(&option.repetition_kind)?),
        load_input_mode: load_input_mode_response(load_input_mode(&option.load_input_mode)?),
        set_tracking_mode: set_tracking_mode_response(set_tracking_mode(
            &option.set_tracking_mode,
        )?),
        station_id: Some(option.station_id),
        station_name: Some(option.station_name),
        station_profile_loads_kg: Some(option.station_profile_loads_kg),
        suggested_start_load_kg: option.suggested_start_load_kg,
        last_completed_at: option.last_completed_at,
        fallback_selection_rank: option.fallback_selection_rank,
    })
}

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
                start_selection_rank: plan.start_selection_rank,
            })
            .collect(),
    ))
}

pub(crate) async fn list_training_plan_exercise_variants(
    State(state): State<AppState>,
    Extension(session): Extension<AuthenticatedSession>,
    Path(training_plan_id): Path<String>,
    Query(query): Query<TrainingPlanExerciseVariantsQuery>,
) -> Result<Json<TrainingPlanExerciseVariantsResponse>, ApiError> {
    let user_id = session.user_id.clone();
    let exercise_variants = state
        .repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            &training_plan_id,
            &query.gym_id,
            &user_id,
        )
        .await
        .map_err(|_| ApiError::Internal)?;

    Ok(Json(TrainingPlanExerciseVariantsResponse {
        training_plan_id,
        gym_id: query.gym_id,
        exercise_variants: exercise_variants
            .into_iter()
            .map(training_plan_exercise_variant_response)
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_enum_translation_error)?,
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

#[cfg(test)]
mod tests {
    use super::training_plan_exercise_variant_response;
    use crate::domain::PlanExerciseOptionSummary;

    fn sample_option() -> PlanExerciseOptionSummary {
        PlanExerciseOptionSummary {
            id: "option-id".to_owned(),
            training_plan_exercise_id: "exercise-id".to_owned(),
            exercise_name: "Bench Press".to_owned(),
            exercise_position: 1,
            rep_min: Some(8),
            rep_max: Some(12),
            target_sets: Some(3),
            variant_id: "variant-id".to_owned(),
            variant_name: "Barbell".to_owned(),
            repetition_kind: "REPS".to_owned(),
            load_input_mode: "TOTAL".to_owned(),
            set_tracking_mode: "BILATERAL".to_owned(),
            station_id: Some("station-id".to_owned()),
            station_name: Some("Rack".to_owned()),
            station_profile_loads_kg: vec![20.0, 22.5],
            suggested_start_load_kg: Some(20.0),
            last_completed_at: Some("2026-04-20T10:00:00Z".to_owned()),
            fallback_selection_rank: 1,
        }
    }

    #[test]
    fn training_plan_variant_mapping_rejects_unknown_repetition_kind() {
        let mut option = sample_option();
        option.repetition_kind = "HOLDS".to_owned();

        let error = training_plan_exercise_variant_response(option).expect_err("must fail");
        assert_eq!(error.field, "repetition_kind");
        assert_eq!(error.value, "HOLDS");
    }

    #[test]
    fn training_plan_variant_mapping_rejects_unknown_load_input_mode() {
        let mut option = sample_option();
        option.load_input_mode = "SINGLE_SIDE".to_owned();

        let error = training_plan_exercise_variant_response(option).expect_err("must fail");
        assert_eq!(error.field, "load_input_mode");
        assert_eq!(error.value, "SINGLE_SIDE");
    }

    #[test]
    fn training_plan_variant_mapping_rejects_unknown_set_tracking_mode() {
        let mut option = sample_option();
        option.set_tracking_mode = "ALTERNATING".to_owned();

        let error = training_plan_exercise_variant_response(option).expect_err("must fail");
        assert_eq!(error.field, "set_tracking_mode");
        assert_eq!(error.value, "ALTERNATING");
    }
}
