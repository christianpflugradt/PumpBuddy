use crate::{
    domain::{
        ConfiguredGymTrainingPlanExerciseVariantOption, TrainingPlanDetail,
        TrainingPlanExecutionStatus, TrainingPlanSummary, TrainingPlanVariantAvailability,
    },
    persistence::{PersistenceError, TrainingPlanRepository},
};

#[derive(Debug)]
pub enum TrainingPlanServiceError {
    NotFound(String),
    Persistence(PersistenceError),
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
    user_id: &str,
) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, TrainingPlanServiceError> {
    repository
        .fetch_training_plan_exercise_variant_summaries_for_user(training_plan_id, gym_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)
}

pub(crate) async fn get_training_plan(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
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

    let plan = repository
        .fetch_training_plan_detail_for_user(training_plan_id, selected_gym_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?
        .ok_or_else(|| TrainingPlanServiceError::NotFound("Training plan not found".to_owned()))?;

    Ok(apply_training_plan_execution_metadata(plan))
}

fn apply_training_plan_execution_metadata(mut plan: TrainingPlanDetail) -> TrainingPlanDetail {
    if plan.selected_gym_id.is_none() {
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
    use super::{get_training_plan, TrainingPlanServiceError};
    use crate::{
        domain::{
            ConfiguredGymTrainingPlanExerciseVariantOption, TrainingPlanDetail, TrainingPlanSummary,
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
    }

    impl FakeTrainingPlanRepository {
        fn new(summaries: Vec<TrainingPlanSummary>, detail: Option<TrainingPlanDetail>) -> Self {
            Self {
                summaries,
                detail,
                detail_calls: AtomicUsize::new(0),
            }
        }
    }

    impl TrainingPlanRepository for FakeTrainingPlanRepository {
        async fn fetch_training_plan_summaries_for_user(
            &self,
            _user_id: &str,
        ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
            Ok(self.summaries.clone())
        }

        async fn fetch_training_plan_detail_for_user(
            &self,
            _training_plan_id: &str,
            _selected_gym_id: Option<&str>,
            _user_id: &str,
        ) -> Result<Option<TrainingPlanDetail>, PersistenceError> {
            self.detail_calls.fetch_add(1, Ordering::SeqCst);
            Ok(self.detail.clone())
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

        match get_training_plan(&repository, "missing-plan", None, "user-id")
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
}
