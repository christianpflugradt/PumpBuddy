use crate::{
    domain::{PlanExerciseOptionSummary, TrainingPlanDetail, TrainingPlanSummary},
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
) -> Result<Vec<PlanExerciseOptionSummary>, TrainingPlanServiceError> {
    repository
        .fetch_training_plan_exercise_variant_summaries_for_user(training_plan_id, gym_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)
}

pub(crate) async fn get_training_plan(
    repository: &(impl TrainingPlanRepository + ?Sized),
    training_plan_id: &str,
    user_id: &str,
) -> Result<TrainingPlanDetail, TrainingPlanServiceError> {
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

    repository
        .fetch_training_plan_detail_for_user(training_plan_id, user_id)
        .await
        .map_err(TrainingPlanServiceError::Persistence)?
        .ok_or_else(|| TrainingPlanServiceError::NotFound("Training plan not found".to_owned()))
}

#[cfg(test)]
mod tests {
    use super::{get_training_plan, TrainingPlanServiceError};
    use crate::{
        domain::{PlanExerciseOptionSummary, TrainingPlanDetail, TrainingPlanSummary},
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
            _user_id: &str,
        ) -> Result<Option<TrainingPlanDetail>, PersistenceError> {
            self.detail_calls.fetch_add(1, Ordering::SeqCst);
            Ok(self.detail.clone())
        }

        async fn fetch_training_plan_exercise_variant_summaries_for_user(
            &self,
            _training_plan_id: &str,
            _gym_id: &str,
            _user_id: &str,
        ) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
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

        match get_training_plan(&repository, "missing-plan", "user-id")
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
