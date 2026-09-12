use crate::{
    domain::{
        ConfiguredGymTrainingPlanExerciseVariantOption, TrainingPlanDefinition, TrainingPlanDetail,
        TrainingPlanExecutionStatus, TrainingPlanGuidance, TrainingPlanSaveRequest,
        TrainingPlanSaveResult, TrainingPlanSummary, TrainingPlanVariantAvailability,
    },
    persistence::{PersistenceError, TrainingPlanRepository},
};

#[derive(Debug)]
pub enum TrainingPlanServiceError {
    NotFound(String),
    Persistence(PersistenceError),
    Validation(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct TrainingPlanSaveImpact {
    pub creates_new_version: bool,
}

pub(crate) async fn create_training_plan(
    repository: &(impl TrainingPlanRepository + ?Sized),
    user_id: &str,
    request: TrainingPlanSaveRequest,
) -> Result<TrainingPlanSaveResult, TrainingPlanServiceError> {
    validate_definition(repository, user_id, &request.definition).await?;
    validate_guidance(request.guidance.as_ref())?;
    let result = repository
        .create_training_plan_for_user(user_id, &request.definition)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?;
    if let Some(guidance) = request.guidance {
        repository
            .replace_training_plan_guidance_for_user(&result.training_plan_id, user_id, &guidance)
            .await
            .map_err(TrainingPlanServiceError::Persistence)?;
    }
    Ok(result)
}

pub(crate) async fn save_training_plan(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
    user_id: &str,
    request: TrainingPlanSaveRequest,
) -> Result<TrainingPlanSaveResult, TrainingPlanServiceError> {
    validate_guidance(request.guidance.as_ref())?;
    let impact =
        assess_training_plan_save(repository, training_plan_id, user_id, &request.definition)
            .await?;
    if request.guidance.is_some() {
        confirm_guidance_override_replacement(
            repository,
            training_plan_id,
            user_id,
            request.replace_existing_variant_override_count,
        )
        .await?;
    }
    let result = repository
        .save_training_plan_for_user(
            training_plan_id,
            user_id,
            &request.definition,
            impact.creates_new_version,
        )
        .await
        .map_err(TrainingPlanServiceError::Persistence)?;
    if let Some(guidance) = request.guidance {
        repository
            .replace_training_plan_guidance_for_user(training_plan_id, user_id, &guidance)
            .await
            .map_err(TrainingPlanServiceError::Persistence)?;
    }
    Ok(result)
}

fn validate_guidance(
    guidance: Option<&TrainingPlanGuidance>,
) -> Result<(), TrainingPlanServiceError> {
    guidance
        .map(TrainingPlanGuidance::validate)
        .transpose()
        .map_err(TrainingPlanServiceError::Validation)
        .map(|_| ())
}

async fn confirm_guidance_override_replacement(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
    user_id: &str,
    submitted_count: Option<i32>,
) -> Result<(), TrainingPlanServiceError> {
    let existing_count = repository
        .count_training_plan_guidance_overrides_for_user(training_plan_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?;
    if existing_count > 0 && submitted_count != i32::try_from(existing_count).ok() {
        return Err(TrainingPlanServiceError::Validation(format!(
            "replace_existing_variant_override_count must equal the {existing_count} existing variant overrides"
        )));
    }
    Ok(())
}

pub(crate) async fn assess_training_plan_save(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
    user_id: &str,
    definition: &TrainingPlanDefinition,
) -> Result<TrainingPlanSaveImpact, TrainingPlanServiceError> {
    validate_definition(repository, user_id, definition).await?;
    let current = repository
        .fetch_current_training_plan_definition_for_user(training_plan_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?
        .ok_or_else(|| TrainingPlanServiceError::NotFound("Training plan not found".into()))?;
    Ok(TrainingPlanSaveImpact {
        creates_new_version: is_version_producing_change(&current, definition),
    })
}

async fn validate_definition(
    repository: &(impl TrainingPlanRepository + ?Sized),
    user_id: &str,
    definition: &TrainingPlanDefinition,
) -> Result<(), TrainingPlanServiceError> {
    let name = definition.name.trim();
    if name.is_empty() {
        return Err(TrainingPlanServiceError::Validation(
            "name is required".into(),
        ));
    }
    let mut exercise_ids = std::collections::HashSet::new();
    let mut variant_ids = std::collections::HashSet::new();
    for exercise in &definition.exercises {
        if exercise.exercise_id.trim().is_empty() || !exercise_ids.insert(&exercise.exercise_id) {
            return Err(TrainingPlanServiceError::Validation(
                "each submitted exercise must be unique".into(),
            ));
        }
        if exercise.allowed_variant_ids.is_empty() {
            return Err(TrainingPlanServiceError::Validation(
                "each plan exercise requires at least one allowed variant".into(),
            ));
        }
        for variant_id in &exercise.allowed_variant_ids {
            if variant_id.trim().is_empty() || !variant_ids.insert(variant_id) {
                return Err(TrainingPlanServiceError::Validation(
                    "submitted variant identifiers must be unique".into(),
                ));
            }
        }
    }
    if !repository
        .training_plan_definition_is_valid_for_user(definition, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?
    {
        return Err(TrainingPlanServiceError::Validation(
            "each allowed variant must belong to its submitted exercise".into(),
        ));
    }
    Ok(())
}

fn is_version_producing_change(
    current: &TrainingPlanDefinition,
    submitted: &TrainingPlanDefinition,
) -> bool {
    if current.exercises.len() != submitted.exercises.len() {
        return true;
    }
    current
        .exercises
        .iter()
        .zip(&submitted.exercises)
        .any(|(current, submitted)| {
            current.exercise_id != submitted.exercise_id
                || current
                    .allowed_variant_ids
                    .iter()
                    .any(|variant_id| !submitted.allowed_variant_ids.contains(variant_id))
        })
}

pub(crate) async fn list_training_plans(
    repository: &(impl TrainingPlanRepository + ?Sized),
    user_id: &str,
) -> Result<Vec<TrainingPlanSummary>, TrainingPlanServiceError> {
    repository
        .fetch_training_plan_summaries_for_user(user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)
}

pub(crate) async fn list_training_plan_exercise_variants(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
    gym_id: &str,
    active_workout_id: Option<&str>,
    user_id: &str,
) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, TrainingPlanServiceError> {
    if let Some(active_workout_id) = active_workout_id.map(str::trim).filter(|id| !id.is_empty()) {
        return repository
            .fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
                training_plan_id,
                active_workout_id,
                gym_id,
                user_id,
            )
            .await
            .map_err(TrainingPlanServiceError::Persistence);
    }

    repository
        .fetch_training_plan_exercise_variant_summaries_for_user(training_plan_id, gym_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)
}

pub(crate) async fn get_training_plan(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
    selected_version_number: Option<i32>,
    selected_gym_id: Option<&str>,
    user_id: &str,
) -> Result<TrainingPlanDetail, TrainingPlanServiceError> {
    let selected_gym_id = selected_gym_id.and_then(|gym_id| {
        let trimmed = gym_id.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let summaries = repository
        .fetch_training_plan_summaries_for_user(user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?;

    if !summaries
        .iter()
        .any(|summary| summary.id == training_plan_id)
    {
        return Err(TrainingPlanServiceError::NotFound(
            "Training plan not found".to_owned(),
        ));
    }

    let plan = repository
        .fetch_training_plan_detail_for_user(
            training_plan_id,
            selected_version_number,
            selected_gym_id,
            user_id,
        )
        .await
        .map_err(TrainingPlanServiceError::Persistence)?
        .ok_or_else(|| {
            TrainingPlanServiceError::NotFound("Training plan version not found".to_owned())
        })?;

    if plan
        .versions
        .iter()
        .any(|version| version.is_current && version.version_number == plan.selected_version_number)
    {
        if let Some(gym_id) = selected_gym_id {
            let gym_exists = repository
                .training_plan_detail_gym_exists_for_user(gym_id, user_id)
                .await
                .map_err(TrainingPlanServiceError::Persistence)?;

            if !gym_exists {
                return Err(TrainingPlanServiceError::NotFound(
                    "Gym not found".to_owned(),
                ));
            }
        }
    }

    let guidance = repository
        .fetch_training_plan_guidance_for_user(training_plan_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?
        .unwrap_or_default();
    Ok(apply_training_plan_execution_metadata(apply_live_guidance(
        plan, &guidance,
    )))
}

fn apply_live_guidance(
    mut plan: TrainingPlanDetail,
    guidance: &TrainingPlanGuidance,
) -> TrainingPlanDetail {
    for exercise in &mut plan.exercises {
        let stored = guidance
            .exercises
            .iter()
            .find(|item| item.exercise_id == exercise.exercise_id);
        exercise.default_guidance = stored.map(|item| item.defaults.clone()).unwrap_or_default();
        for variant in &mut exercise.variants {
            variant.guidance_override = stored.and_then(|item| {
                item.variant_overrides
                    .iter()
                    .find(|override_| override_.variant_id == variant.variant_id)
                    .map(|override_| override_.guidance.clone())
            });
            variant.effective_guidance = variant
                .guidance_override
                .clone()
                .unwrap_or_else(|| exercise.default_guidance.clone());
            variant.rep_min = variant.effective_guidance.rep_min;
            variant.rep_max = variant.effective_guidance.rep_max;
            variant.target_sets = variant.effective_guidance.target_sets;
        }
    }
    plan
}

fn apply_training_plan_execution_metadata(mut plan: TrainingPlanDetail) -> TrainingPlanDetail {
    let is_current_version = plan.versions.iter().any(|version| {
        version.is_current && version.version_number == plan.selected_version_number
    });
    if !is_current_version || plan.selected_gym_id.is_none() {
        plan.is_executable = None;
        plan.execution_status = None;
        plan.execution_summary = None;
        for exercise in &mut plan.exercises {
            exercise.executable_variant_count = None;
            exercise.execution_status = None;
            for variant in &mut exercise.variants {
                variant.availability = None;
                variant.compatible_stations.clear();
            }
        }
        return plan;
    }

    let mut executable_exercise_count = 0;

    for exercise in &mut plan.exercises {
        let mut executable_variant_count = 0;
        for variant in &mut exercise.variants {
            let is_available = !variant.requires_station || !variant.compatible_stations.is_empty();
            variant.availability = Some(if is_available {
                TrainingPlanVariantAvailability::Available
            } else {
                TrainingPlanVariantAvailability::NotAvailable
            });

            if !variant.requires_station || !is_available {
                variant.compatible_stations.clear();
            }

            if is_available {
                executable_variant_count += 1;
            }
        }

        if executable_variant_count > 0 {
            executable_exercise_count += 1;
        }

        exercise.executable_variant_count = Some(executable_variant_count);
        exercise.execution_status = Some(status_for_counts(
            executable_variant_count,
            exercise.configured_variant_count,
        ));
    }

    let total_exercise_count = plan.exercises.len() as i32;
    let is_executable =
        total_exercise_count > 0 && executable_exercise_count == total_exercise_count;
    let unavailable_exercise_count = total_exercise_count - executable_exercise_count;
    plan.is_executable = Some(is_executable);
    plan.execution_status = Some(if is_executable {
        TrainingPlanExecutionStatus::Green
    } else {
        TrainingPlanExecutionStatus::Red
    });
    plan.execution_summary = Some(if is_executable {
        format!(
            "All {} {} at least one executable variant.",
            exercise_count_label(total_exercise_count),
            if total_exercise_count == 1 {
                "has"
            } else {
                "have"
            }
        )
    } else {
        format!(
            "{} of {} {} no executable variant.",
            unavailable_exercise_count,
            exercise_count_label(total_exercise_count),
            if unavailable_exercise_count == 1 {
                "has"
            } else {
                "have"
            }
        )
    });

    plan
}

fn exercise_count_label(count: i32) -> String {
    format!(
        "{} {}",
        count,
        if count == 1 { "exercise" } else { "exercises" }
    )
}

fn status_for_counts(executable_count: i32, configured_count: i32) -> TrainingPlanExecutionStatus {
    if configured_count <= 0 || executable_count <= 0 {
        TrainingPlanExecutionStatus::Red
    } else if executable_count >= configured_count {
        TrainingPlanExecutionStatus::Green
    } else {
        TrainingPlanExecutionStatus::Yellow
    }
}

#[cfg(test)]
mod tests {
    use super::{
        assess_training_plan_save, create_training_plan, get_training_plan,
        is_version_producing_change, list_training_plan_exercise_variants,
        TrainingPlanServiceError,
    };
    use crate::{
        domain::{
            ConfiguredGymTrainingPlanExerciseVariantOption, TrainingPlanDefinition,
            TrainingPlanDetail, TrainingPlanExerciseDefinition, TrainingPlanGuidance,
            TrainingPlanSaveRequest, TrainingPlanSummary,
        },
        persistence::{PersistenceError, TrainingPlanRepository},
    };
    use std::{
        collections::HashSet,
        sync::atomic::{AtomicUsize, Ordering},
    };

    struct FakeTrainingPlanRepository {
        summaries: Vec<TrainingPlanSummary>,
        detail: Option<TrainingPlanDetail>,
        detail_calls: AtomicUsize,
        latest_options_calls: AtomicUsize,
        active_workout_options_calls: AtomicUsize,
        definition_valid: bool,
        current_definition: Option<TrainingPlanDefinition>,
    }

    impl FakeTrainingPlanRepository {
        fn new(summaries: Vec<TrainingPlanSummary>, detail: Option<TrainingPlanDetail>) -> Self {
            Self {
                summaries,
                detail,
                detail_calls: AtomicUsize::new(0),
                latest_options_calls: AtomicUsize::new(0),
                active_workout_options_calls: AtomicUsize::new(0),
                definition_valid: false,
                current_definition: None,
            }
        }

        fn for_save(current_definition: TrainingPlanDefinition) -> Self {
            Self {
                definition_valid: true,
                current_definition: Some(current_definition),
                ..Self::new(vec![], None)
            }
        }
    }

    impl TrainingPlanRepository for FakeTrainingPlanRepository {
        async fn training_plan_definition_is_valid_for_user(
            &self,
            _definition: &TrainingPlanDefinition,
            _user_id: &str,
        ) -> Result<bool, PersistenceError> {
            Ok(self.definition_valid)
        }

        async fn fetch_current_training_plan_definition_for_user(
            &self,
            _training_plan_id: &str,
            _user_id: &str,
        ) -> Result<Option<TrainingPlanDefinition>, PersistenceError> {
            Ok(self.current_definition.clone())
        }

        async fn fetch_training_plan_summaries_for_user(
            &self,
            _user_id: &str,
        ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
            Ok(self.summaries.clone())
        }

        async fn fetch_training_plan_detail_for_user(
            &self,
            _training_plan_id: &str,
            _selected_version_number: Option<i32>,
            _selected_gym_id: Option<&str>,
            _user_id: &str,
        ) -> Result<Option<TrainingPlanDetail>, PersistenceError> {
            self.detail_calls.fetch_add(1, Ordering::SeqCst);
            Ok(self.detail.clone())
        }

        async fn fetch_training_plan_guidance_for_user(
            &self,
            _training_plan_id: &str,
            _user_id: &str,
        ) -> Result<Option<TrainingPlanGuidance>, PersistenceError> {
            Ok(Some(TrainingPlanGuidance::default()))
        }

        async fn training_plan_detail_gym_exists_for_user(
            &self,
            gym_id: &str,
            _user_id: &str,
        ) -> Result<bool, PersistenceError> {
            Ok(gym_id == "visible-gym")
        }

        async fn fetch_training_plan_exercise_variant_summaries_for_user(
            &self,
            _training_plan_id: &str,
            _gym_id: &str,
            _user_id: &str,
        ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
            self.latest_options_calls.fetch_add(1, Ordering::SeqCst);
            Ok(Vec::new())
        }

        async fn fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
            &self,
            _training_plan_id: &str,
            _active_workout_id: &str,
            _gym_id: &str,
            _user_id: &str,
        ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
            self.active_workout_options_calls
                .fetch_add(1, Ordering::SeqCst);
            Ok(Vec::new())
        }

        async fn fetch_training_plan_exercise_ids_for_user(
            &self,
            _training_plan_id: &str,
            _user_id: &str,
        ) -> Result<HashSet<String>, PersistenceError> {
            Ok(HashSet::new())
        }

        async fn fetch_training_plan_exercise_count_for_user(
            &self,
            _training_plan_id: &str,
            _user_id: &str,
        ) -> Result<i64, PersistenceError> {
            Ok(0)
        }
    }

    fn summary(id: &str) -> TrainingPlanSummary {
        TrainingPlanSummary {
            id: id.to_owned(),
            name: "Plan".to_owned(),
            exercise_count: 1,
            last_completed_at: None,
            start_selection_rank: 1,
        }
    }

    #[tokio::test]
    async fn get_training_plan_stops_at_visibility_check_when_summary_is_absent() {
        let repository = FakeTrainingPlanRepository::new(vec![summary("visible-plan")], None);

        match get_training_plan(&repository, "missing-plan", None, None, "user-id")
            .await
            .expect_err("missing summary should be treated as not found")
        {
            TrainingPlanServiceError::NotFound(message) => {
                assert_eq!(message, "Training plan not found");
            }
            other => panic!("unexpected error: {other:?}"),
        }

        assert_eq!(repository.detail_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn list_training_plan_exercise_variants_uses_active_workout_scope_when_provided() {
        let repository = FakeTrainingPlanRepository::new(vec![summary("visible-plan")], None);

        list_training_plan_exercise_variants(
            &repository,
            "visible-plan",
            "gym-id",
            Some(" active-workout-id "),
            "user-id",
        )
        .await
        .expect("active-workout scoped options should load");

        assert_eq!(
            repository
                .active_workout_options_calls
                .load(Ordering::SeqCst),
            1
        );
        assert_eq!(repository.latest_options_calls.load(Ordering::SeqCst), 0);
    }

    fn definition(allowed_variant_ids: Vec<&str>) -> TrainingPlanDefinition {
        TrainingPlanDefinition {
            name: "Plan".into(),
            exercises: vec![TrainingPlanExerciseDefinition {
                exercise_id: "exercise-id".into(),
                allowed_variant_ids: allowed_variant_ids.into_iter().map(str::to_owned).collect(),
            }],
        }
    }

    fn save_request(definition: TrainingPlanDefinition) -> TrainingPlanSaveRequest {
        TrainingPlanSaveRequest {
            definition,
            guidance: None,
            replace_existing_variant_override_count: None,
        }
    }

    #[tokio::test]
    async fn create_training_plan_rejects_empty_or_duplicate_variant_selections() {
        let repository = FakeTrainingPlanRepository::new(vec![], None);
        for definition in [
            definition(vec![]),
            definition(vec!["variant-id", "variant-id"]),
        ] {
            assert!(matches!(
                create_training_plan(&repository, "user-id", save_request(definition)).await,
                Err(TrainingPlanServiceError::Validation(_))
            ));
        }
    }

    #[tokio::test]
    async fn create_training_plan_rejects_variant_outside_submitted_exercise() {
        let repository = FakeTrainingPlanRepository::new(vec![], None);
        assert!(matches!(
            create_training_plan(
                &repository,
                "user-id",
                save_request(definition(vec!["variant-id"])),
            )
            .await,
            Err(TrainingPlanServiceError::Validation(_))
        ));
    }

    #[test]
    fn structural_exercise_changes_produce_a_new_version() {
        let current = TrainingPlanDefinition {
            name: "Plan".into(),
            exercises: vec![
                TrainingPlanExerciseDefinition {
                    exercise_id: "first-exercise".into(),
                    allowed_variant_ids: vec!["first-variant".into()],
                },
                TrainingPlanExerciseDefinition {
                    exercise_id: "second-exercise".into(),
                    allowed_variant_ids: vec!["second-variant".into()],
                },
            ],
        };
        let reordered = TrainingPlanDefinition {
            name: "Plan".into(),
            exercises: vec![current.exercises[1].clone(), current.exercises[0].clone()],
        };
        assert!(!is_version_producing_change(&current, &current));
        assert!(is_version_producing_change(&current, &reordered));
        assert!(!is_version_producing_change(
            &definition(vec!["existing"]),
            &definition(vec!["existing", "added"])
        ));
        assert!(!is_version_producing_change(
            &definition(vec!["existing"]),
            &TrainingPlanDefinition {
                name: "Renamed".into(),
                ..definition(vec!["existing"])
            }
        ));
        assert!(is_version_producing_change(
            &definition(vec!["existing"]),
            &definition(vec![])
        ));
        assert!(is_version_producing_change(
            &definition(vec!["existing"]),
            &TrainingPlanDefinition {
                name: "Plan".into(),
                exercises: vec![TrainingPlanExerciseDefinition {
                    exercise_id: "other-exercise".into(),
                    allowed_variant_ids: vec!["existing".into()]
                }],
            }
        ));
    }

    #[tokio::test]
    async fn save_impact_uses_the_backend_version_policy_for_preview_and_persisted_saves() {
        let current = definition(vec!["existing"]);
        let repository = FakeTrainingPlanRepository::for_save(current.clone());

        let additive = assess_training_plan_save(
            &repository,
            "plan-id",
            "user-id",
            &definition(vec!["existing", "added"]),
        )
        .await
        .expect("additive definition should be assessable");
        let removal = assess_training_plan_save(
            &repository,
            "plan-id",
            "user-id",
            &TrainingPlanDefinition {
                name: "Plan".into(),
                exercises: vec![],
            },
        )
        .await
        .expect("removal definition should be assessable");

        assert!(!additive.creates_new_version);
        assert!(removal.creates_new_version);
        assert_eq!(
            removal.creates_new_version,
            is_version_producing_change(
                &current,
                &TrainingPlanDefinition {
                    name: "Plan".into(),
                    exercises: vec![],
                },
            )
        );
    }
}
