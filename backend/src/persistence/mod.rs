use crate::domain::{
    CompletedActiveWorkoutSet, ConfiguredGymTrainingPlanExerciseVariantOption, GymDetail,
    GymStationDetail, GymSummary, LoadProfileSummary, NewWorkout, TrainingPlanDetail,
    TrainingPlanSummary, Workout, WorkoutHistorySummary,
};
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use std::panic::Location;

mod active_workouts;
mod auth;
mod gyms;
mod load_profiles;
mod logging;
mod progression;
mod suggestions;
#[cfg(test)]
mod tests;
mod training_plans;
mod workouts;

#[derive(Debug)]
pub enum PersistenceError {
    Conflict(String),
    NotFound(String),
    Sqlx(sqlx::Error),
}

impl From<sqlx::Error> for PersistenceError {
    #[track_caller]
    fn from(value: sqlx::Error) -> Self {
        let caller = Location::caller();
        let operation = logging::operation_from_caller(caller.file(), caller.line());
        let entity = logging::entity_from_caller(caller.file());
        logging::log_sqlx_error(&value, &operation, entity);
        Self::Sqlx(value)
    }
}

#[derive(Clone)]
pub struct DomainRepository {
    pool: PgPool,
}

pub use auth::{
    ActiveUserSecret, AuthenticatedSession, LoginAttemptState, SideMenuMiddleClickCounts,
    SideMenuMiddleScreen,
};

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ActiveWorkoutReadModel {
    pub(crate) id: String,
    pub(crate) training_plan_id: String,
    pub(crate) training_plan_name: String,
    pub(crate) gym_id: Option<String>,
    pub(crate) gym_name: Option<String>,
    pub(crate) started_at: String,
    pub(crate) updated_at: String,
    pub(crate) current_exercise_position: i32,
    pub(crate) total_exercise_count: i32,
    pub(crate) exercises: Vec<ActiveWorkoutExerciseReadModel>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ActiveWorkoutExerciseReadModel {
    pub(crate) training_plan_exercise_id: String,
    pub(crate) position: i32,
    pub(crate) exercise_name: String,
    pub(crate) exercise_id: String,
    pub(crate) workout_exercise_id: Option<String>,
    pub(crate) selected_training_plan_exercise_variant_id: Option<String>,
    pub(crate) selected_variant_id: Option<String>,
    pub(crate) selected_variant_name: Option<String>,
    pub(crate) repetition_kind: String,
    pub(crate) load_input_mode: Option<String>,
    pub(crate) set_tracking_mode: Option<String>,
    pub(crate) selected_station_id: Option<String>,
    pub(crate) selected_station_name: Option<String>,
    pub(crate) skipped_at: Option<String>,
    pub(crate) completed_at: Option<String>,
    pub(crate) rep_min: Option<i32>,
    pub(crate) rep_max: Option<i32>,
    pub(crate) completed_sets: Vec<CompletedActiveWorkoutSet>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HistoricalSuggestionQuery {
    pub(crate) user_id: String,
    pub(crate) current_workout_id: String,
    pub(crate) exercise_id: String,
    pub(crate) set_index: i32,
    pub(crate) allow_null_load: bool,
    pub(crate) repetition_kind: String,
    pub(crate) scope: HistoricalSuggestionQueryScope,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct HistoricalSuggestionQueryScope {
    pub(crate) variant_eq: Option<String>,
    pub(crate) variant_ne: Option<String>,
    pub(crate) gym_eq: Option<String>,
    pub(crate) gym_ne: Option<String>,
    pub(crate) station_eq: Option<String>,
    pub(crate) station_ne: Option<String>,
    pub(crate) station_is_null_only: bool,
    pub(crate) set_side_eq: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct HistoricalSuggestionCandidate {
    pub(crate) set_index: i32,
    pub(crate) set_side: String,
    pub(crate) load_value: Option<f64>,
    pub(crate) repetition_value: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RepsProgressionCoverageQuery {
    pub(crate) user_id: String,
    pub(crate) current_workout_id: String,
    pub(crate) exercise_id: String,
    pub(crate) selected_variant_id: Option<String>,
    pub(crate) selected_station_id: Option<String>,
    pub(crate) requested_set_side: String,
    pub(crate) max_set_index: i32,
    pub(crate) repetition_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RepsProgressionCoverage {
    pub(crate) matched_workout_count: i64,
    pub(crate) coverage_by_set_index: HashMap<i32, i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct RepsProgressionHistoryQuery {
    pub(crate) user_id: String,
    pub(crate) current_workout_id: String,
    pub(crate) exercise_id: String,
    pub(crate) selected_variant_id: Option<String>,
    pub(crate) selected_station_id: Option<String>,
    pub(crate) requested_set_side: String,
    pub(crate) set_index: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct RepsProgressionHistorySample {
    pub(crate) reps: i32,
    pub(crate) load_value: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NoLoadPriorRepetitionQuery {
    pub(crate) user_id: String,
    pub(crate) current_workout_id: String,
    pub(crate) exercise_id: String,
    pub(crate) selected_variant_id: Option<String>,
    pub(crate) set_index: i32,
    pub(crate) repetition_kind: String,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WorkoutProgressReadModel {
    pub(crate) id: String,
    pub(crate) training_plan_name: String,
    pub(crate) completed_at: String,
    pub(crate) exercise_scores_by_id: HashMap<String, Option<i32>>,
    pub(crate) baseline_by_exercise_id: HashMap<String, i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WorkoutSummaryReadModel {
    pub(crate) id: String,
    pub(crate) training_plan_id: String,
    pub(crate) training_plan_name: String,
    pub(crate) gym_id: Option<String>,
    pub(crate) gym_name: Option<String>,
    pub(crate) started_at: Option<String>,
    pub(crate) completed_at: Option<String>,
    pub(crate) exercise_count: i64,
    pub(crate) completed_set_count: i64,
    pub(crate) average_duration_minutes: Option<i64>,
    pub(crate) exercise_scores_by_id: HashMap<String, Option<i32>>,
    pub(crate) baseline_by_exercise_id: HashMap<String, i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct WorkoutDetailReadModel {
    pub(crate) id: String,
    pub(crate) hero: crate::domain::WorkoutDetailHero,
    pub(crate) summary: WorkoutSummaryReadModel,
    pub(crate) exercises: Vec<crate::domain::WorkoutDetailExercise>,
}

#[allow(async_fn_in_trait)]
pub trait AuthRepository {
    async fn fetch_active_user_secret(
        &self,
        login: &str,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError>;

    async fn create_login_session(
        &self,
        secret_id: &str,
        user_id: &str,
        session_token_hash: &str,
        user_agent: Option<&str>,
    ) -> Result<(), PersistenceError>;

    async fn fetch_login_attempt_state(
        &self,
        attempt_key: &str,
        window_seconds: i32,
    ) -> Result<Option<LoginAttemptState>, PersistenceError>;

    async fn record_failed_login_attempt(
        &self,
        attempt_key: &str,
        window_seconds: i32,
        lockout_threshold: i32,
        lockout_seconds: i32,
    ) -> Result<LoginAttemptState, PersistenceError>;

    async fn clear_login_attempt_state(&self, attempt_key: &str) -> Result<(), PersistenceError>;

    async fn fetch_active_user_secret_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError>;

    async fn rotate_user_secret(
        &self,
        user_id: &str,
        active_secret_id: &str,
        replacement_secret_hash: &str,
    ) -> Result<(), PersistenceError>;

    async fn touch_session(
        &self,
        session_token_hash: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError>;

    async fn revoke_session(
        &self,
        session_token_hash: &str,
        revoke_reason: &str,
    ) -> Result<(), PersistenceError>;

    async fn update_session_display_name(
        &self,
        user_id: &str,
        display_name: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError>;

    async fn favorite_gym_exists_for_user(
        &self,
        user_id: &str,
        gym_id: &str,
    ) -> Result<bool, PersistenceError>;

    async fn update_favorite_gym_preference_for_user(
        &self,
        user_id: &str,
        favorite_gym_id: Option<&str>,
    ) -> Result<Option<String>, PersistenceError>;

    async fn update_max_load_kg_preference_for_user(
        &self,
        user_id: &str,
        max_load_kg: f64,
    ) -> Result<f64, PersistenceError>;

    async fn increment_side_menu_middle_click_count_for_user(
        &self,
        user_id: &str,
        screen: SideMenuMiddleScreen,
    ) -> Result<SideMenuMiddleClickCounts, PersistenceError>;
}

pub(crate) trait TrainingPlanRepository {
    async fn fetch_training_plan_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<TrainingPlanSummary>, PersistenceError>;

    async fn fetch_training_plan_detail_for_user(
        &self,
        training_plan_id: &str,
        selected_gym_id: Option<&str>,
        user_id: &str,
    ) -> Result<Option<TrainingPlanDetail>, PersistenceError>;

    async fn training_plan_detail_gym_exists_for_user(
        &self,
        gym_id: &str,
        user_id: &str,
    ) -> Result<bool, PersistenceError>;

    async fn fetch_training_plan_exercise_variant_summaries_for_user(
        &self,
        training_plan_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError>;

    async fn fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
        let _ = active_workout_id;
        self.fetch_training_plan_exercise_variant_summaries_for_user(
            training_plan_id,
            gym_id,
            user_id,
        )
        .await
    }

    async fn fetch_training_plan_exercise_ids_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError>;

    async fn fetch_training_plan_exercise_ids_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        let _ = active_workout_id;
        self.fetch_training_plan_exercise_ids_for_user(training_plan_id, user_id)
            .await
    }

    async fn fetch_training_plan_exercise_count_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError>;

    async fn fetch_training_plan_exercise_count_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError> {
        let _ = active_workout_id;
        self.fetch_training_plan_exercise_count_for_user(training_plan_id, user_id)
            .await
    }
}

pub(crate) trait GymRepository {
    async fn fetch_gym_summaries_for_user_with_favorite(
        &self,
        user_id: &str,
        favorite_gym_id: Option<&str>,
    ) -> Result<Vec<GymSummary>, PersistenceError>;

    async fn fetch_gym_detail_for_user(
        &self,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Option<GymDetail>, PersistenceError>;

    async fn fetch_gym_station_detail_for_user(
        &self,
        gym_id: &str,
        station_id: &str,
        user_id: &str,
    ) -> Result<Option<GymStationDetail>, PersistenceError>;
}

pub(crate) trait LoadProfileRepository {
    async fn fetch_load_profile_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<LoadProfileSummary>, PersistenceError>;
}

pub(crate) trait WorkoutRepository {
    async fn fetch_workout_history_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutHistorySummary>, PersistenceError>;

    async fn fetch_workout_progress_read_models_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutProgressReadModel>, PersistenceError>;

    async fn fetch_workout_summary_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummaryReadModel>, PersistenceError>;

    async fn fetch_workout_detail_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutDetailReadModel>, PersistenceError>;

    async fn fetch_in_window_exercise_performance_samples_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<crate::workout_metrics::ExercisePerformanceSample>, PersistenceError>;

    async fn fetch_strength_sample_rows_12m_for_user(
        &self,
        user_id: &str,
        variant_ids: &[String],
    ) -> Result<Vec<crate::workout_metrics::StrengthSampleSetRow>, PersistenceError>;

    async fn fetch_first_set_summaries_for_user(
        &self,
        user_id: &str,
        workout_exercise_ids: &[String],
    ) -> Result<HashMap<String, crate::workout_metrics::FirstSetSummary>, PersistenceError>;

    async fn create_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<Workout, PersistenceError>;

    async fn fetch_first_active_workout_read_model_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkoutReadModel>, PersistenceError>;

    async fn fetch_active_workout_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkoutReadModel>, PersistenceError>;

    async fn create_active_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError>;

    async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError>;

    async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError>;

    async fn cancel_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<(), PersistenceError>;

    async fn fetch_max_load_kg_preference_for_user(
        &self,
        user_id: &str,
    ) -> Result<f64, PersistenceError>;

    async fn fetch_station_profile_loads_for_user(
        &self,
        selected_station_id: &str,
        user_id: &str,
    ) -> Result<Vec<f64>, PersistenceError>;

    async fn fetch_latest_historical_suggestion_for_user(
        &self,
        query: HistoricalSuggestionQuery,
    ) -> Result<Option<HistoricalSuggestionCandidate>, PersistenceError>;

    async fn fetch_reps_progression_coverage_for_user(
        &self,
        query: RepsProgressionCoverageQuery,
    ) -> Result<RepsProgressionCoverage, PersistenceError>;

    async fn fetch_reps_progression_history_for_user(
        &self,
        query: RepsProgressionHistoryQuery,
    ) -> Result<Vec<RepsProgressionHistorySample>, PersistenceError>;

    async fn fetch_latest_no_load_prior_repetition_value_for_user(
        &self,
        query: NoLoadPriorRepetitionQuery,
    ) -> Result<Option<i32>, PersistenceError>;
}

pub(crate) trait StationLoadRepository {
    async fn fetch_station_profile_loads_for_user_and_gym(
        &self,
        selected_station_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<f64>, PersistenceError>;
}

#[cfg(test)]
pub(crate) fn new_repository(pool: PgPool) -> DomainRepository {
    DomainRepository::new(pool)
}

impl AuthRepository for DomainRepository {
    async fn fetch_active_user_secret(
        &self,
        login: &str,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError> {
        DomainRepository::fetch_active_user_secret(self, login).await
    }

    async fn create_login_session(
        &self,
        secret_id: &str,
        user_id: &str,
        session_token_hash: &str,
        user_agent: Option<&str>,
    ) -> Result<(), PersistenceError> {
        DomainRepository::create_login_session(
            self,
            secret_id,
            user_id,
            session_token_hash,
            user_agent,
        )
        .await
    }

    async fn fetch_login_attempt_state(
        &self,
        attempt_key: &str,
        window_seconds: i32,
    ) -> Result<Option<LoginAttemptState>, PersistenceError> {
        DomainRepository::fetch_login_attempt_state(self, attempt_key, window_seconds).await
    }

    async fn record_failed_login_attempt(
        &self,
        attempt_key: &str,
        window_seconds: i32,
        lockout_threshold: i32,
        lockout_seconds: i32,
    ) -> Result<LoginAttemptState, PersistenceError> {
        DomainRepository::record_failed_login_attempt(
            self,
            attempt_key,
            window_seconds,
            lockout_threshold,
            lockout_seconds,
        )
        .await
    }

    async fn clear_login_attempt_state(&self, attempt_key: &str) -> Result<(), PersistenceError> {
        DomainRepository::clear_login_attempt_state(self, attempt_key).await
    }

    async fn fetch_active_user_secret_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError> {
        DomainRepository::fetch_active_user_secret_for_user(self, user_id).await
    }

    async fn rotate_user_secret(
        &self,
        user_id: &str,
        active_secret_id: &str,
        replacement_secret_hash: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::rotate_user_secret(
            self,
            user_id,
            active_secret_id,
            replacement_secret_hash,
        )
        .await
    }

    async fn touch_session(
        &self,
        session_token_hash: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError> {
        DomainRepository::touch_session(self, session_token_hash).await
    }

    async fn revoke_session(
        &self,
        session_token_hash: &str,
        revoke_reason: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::revoke_session(self, session_token_hash, revoke_reason).await
    }

    async fn update_session_display_name(
        &self,
        user_id: &str,
        display_name: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError> {
        DomainRepository::update_session_display_name(self, user_id, display_name).await
    }

    async fn favorite_gym_exists_for_user(
        &self,
        user_id: &str,
        gym_id: &str,
    ) -> Result<bool, PersistenceError> {
        DomainRepository::favorite_gym_exists_for_user(self, user_id, gym_id).await
    }

    async fn update_favorite_gym_preference_for_user(
        &self,
        user_id: &str,
        favorite_gym_id: Option<&str>,
    ) -> Result<Option<String>, PersistenceError> {
        DomainRepository::update_favorite_gym_preference_for_user(self, user_id, favorite_gym_id)
            .await
    }

    async fn update_max_load_kg_preference_for_user(
        &self,
        user_id: &str,
        max_load_kg: f64,
    ) -> Result<f64, PersistenceError> {
        DomainRepository::update_max_load_kg_preference_for_user(self, user_id, max_load_kg).await
    }

    async fn increment_side_menu_middle_click_count_for_user(
        &self,
        user_id: &str,
        screen: SideMenuMiddleScreen,
    ) -> Result<SideMenuMiddleClickCounts, PersistenceError> {
        DomainRepository::increment_side_menu_middle_click_count_for_user(self, user_id, screen)
            .await
    }
}

impl TrainingPlanRepository for DomainRepository {
    async fn fetch_training_plan_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
        DomainRepository::fetch_training_plan_summaries_for_user(self, user_id).await
    }

    async fn fetch_training_plan_detail_for_user(
        &self,
        training_plan_id: &str,
        selected_gym_id: Option<&str>,
        user_id: &str,
    ) -> Result<Option<TrainingPlanDetail>, PersistenceError> {
        DomainRepository::fetch_training_plan_detail_for_user(
            self,
            training_plan_id,
            selected_gym_id,
            user_id,
        )
        .await
    }

    async fn training_plan_detail_gym_exists_for_user(
        &self,
        gym_id: &str,
        user_id: &str,
    ) -> Result<bool, PersistenceError> {
        DomainRepository::training_plan_detail_gym_exists_for_user(self, gym_id, user_id).await
    }

    async fn fetch_training_plan_exercise_variant_summaries_for_user(
        &self,
        training_plan_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_variant_summaries_for_user(
            self,
            training_plan_id,
            gym_id,
            user_id,
        )
        .await
    }

    async fn fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
            self,
            training_plan_id,
            active_workout_id,
            gym_id,
            user_id,
        )
        .await
    }

    async fn fetch_training_plan_exercise_ids_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_ids_for_user(self, training_plan_id, user_id)
            .await
    }

    async fn fetch_training_plan_exercise_ids_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_ids_for_active_workout_for_user(
            self,
            training_plan_id,
            active_workout_id,
            user_id,
        )
        .await
    }

    async fn fetch_training_plan_exercise_count_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_count_for_user(
            self,
            training_plan_id,
            user_id,
        )
        .await
    }

    async fn fetch_training_plan_exercise_count_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_count_for_active_workout_for_user(
            self,
            training_plan_id,
            active_workout_id,
            user_id,
        )
        .await
    }
}

impl GymRepository for DomainRepository {
    async fn fetch_gym_summaries_for_user_with_favorite(
        &self,
        user_id: &str,
        favorite_gym_id: Option<&str>,
    ) -> Result<Vec<GymSummary>, PersistenceError> {
        DomainRepository::fetch_gym_summaries_for_user_with_favorite(self, user_id, favorite_gym_id)
            .await
    }

    async fn fetch_gym_detail_for_user(
        &self,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Option<GymDetail>, PersistenceError> {
        DomainRepository::fetch_gym_detail_for_user(self, gym_id, user_id).await
    }

    async fn fetch_gym_station_detail_for_user(
        &self,
        gym_id: &str,
        station_id: &str,
        user_id: &str,
    ) -> Result<Option<GymStationDetail>, PersistenceError> {
        DomainRepository::fetch_gym_station_detail_for_user(self, gym_id, station_id, user_id).await
    }
}

impl LoadProfileRepository for DomainRepository {
    async fn fetch_load_profile_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<LoadProfileSummary>, PersistenceError> {
        DomainRepository::fetch_load_profile_summaries_for_user(self, user_id).await
    }
}

impl WorkoutRepository for DomainRepository {
    async fn fetch_workout_history_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutHistorySummary>, PersistenceError> {
        DomainRepository::fetch_workout_history_for_user(self, user_id).await
    }

    async fn fetch_workout_progress_read_models_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutProgressReadModel>, PersistenceError> {
        DomainRepository::fetch_workout_progress_read_models_for_user(self, user_id).await
    }

    async fn fetch_workout_summary_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummaryReadModel>, PersistenceError> {
        DomainRepository::fetch_workout_summary_read_model_for_user(self, workout_id, user_id).await
    }

    async fn fetch_workout_detail_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutDetailReadModel>, PersistenceError> {
        DomainRepository::fetch_workout_detail_read_model_for_user(self, workout_id, user_id).await
    }

    async fn fetch_in_window_exercise_performance_samples_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<crate::workout_metrics::ExercisePerformanceSample>, PersistenceError> {
        DomainRepository::fetch_in_window_exercise_performance_samples_for_user(self, user_id).await
    }

    async fn fetch_strength_sample_rows_12m_for_user(
        &self,
        user_id: &str,
        variant_ids: &[String],
    ) -> Result<Vec<crate::workout_metrics::StrengthSampleSetRow>, PersistenceError> {
        DomainRepository::fetch_strength_sample_rows_12m_for_user(self, user_id, variant_ids).await
    }

    async fn fetch_first_set_summaries_for_user(
        &self,
        user_id: &str,
        workout_exercise_ids: &[String],
    ) -> Result<HashMap<String, crate::workout_metrics::FirstSetSummary>, PersistenceError> {
        DomainRepository::fetch_first_set_summaries_for_user(self, user_id, workout_exercise_ids)
            .await
    }

    async fn create_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<Workout, PersistenceError> {
        DomainRepository::create_workout_for_user(self, new_workout, user_id).await
    }

    async fn fetch_first_active_workout_read_model_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkoutReadModel>, PersistenceError> {
        DomainRepository::fetch_first_active_workout_read_model_for_user(self, user_id).await
    }

    async fn fetch_active_workout_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkoutReadModel>, PersistenceError> {
        DomainRepository::fetch_active_workout_read_model_for_user(self, workout_id, user_id).await
    }

    async fn create_active_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::create_active_workout_for_user(self, new_workout, user_id).await
    }

    async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::update_active_workout_for_user(self, workout_id, new_workout, user_id)
            .await
    }

    async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::complete_active_workout_for_user(self, workout_id, new_workout, user_id)
            .await
    }

    async fn cancel_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::cancel_active_workout_for_user(self, workout_id, user_id).await
    }

    async fn fetch_max_load_kg_preference_for_user(
        &self,
        user_id: &str,
    ) -> Result<f64, PersistenceError> {
        DomainRepository::fetch_max_load_kg_preference_for_user(self, user_id).await
    }

    async fn fetch_station_profile_loads_for_user(
        &self,
        selected_station_id: &str,
        user_id: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        DomainRepository::fetch_station_profile_loads_for_user(self, selected_station_id, user_id)
            .await
    }

    async fn fetch_latest_historical_suggestion_for_user(
        &self,
        query: HistoricalSuggestionQuery,
    ) -> Result<Option<HistoricalSuggestionCandidate>, PersistenceError> {
        DomainRepository::fetch_latest_historical_suggestion_for_user(self, query).await
    }

    async fn fetch_reps_progression_coverage_for_user(
        &self,
        query: RepsProgressionCoverageQuery,
    ) -> Result<RepsProgressionCoverage, PersistenceError> {
        DomainRepository::fetch_reps_progression_coverage_for_user(self, query).await
    }

    async fn fetch_reps_progression_history_for_user(
        &self,
        query: RepsProgressionHistoryQuery,
    ) -> Result<Vec<RepsProgressionHistorySample>, PersistenceError> {
        DomainRepository::fetch_reps_progression_history_for_user(self, query).await
    }

    async fn fetch_latest_no_load_prior_repetition_value_for_user(
        &self,
        query: NoLoadPriorRepetitionQuery,
    ) -> Result<Option<i32>, PersistenceError> {
        DomainRepository::fetch_latest_no_load_prior_repetition_value_for_user(self, query).await
    }
}

impl StationLoadRepository for DomainRepository {
    async fn fetch_station_profile_loads_for_user_and_gym(
        &self,
        selected_station_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        DomainRepository::fetch_station_profile_loads_for_user_and_gym(
            self,
            selected_station_id,
            gym_id,
            user_id,
        )
        .await
    }
}

impl DomainRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn fetch_training_plan_detail_for_user(
        &self,
        training_plan_id: &str,
        selected_gym_id: Option<&str>,
        user_id: &str,
    ) -> Result<Option<TrainingPlanDetail>, PersistenceError> {
        training_plans::fetch_training_plan_detail_for_user(
            self,
            training_plan_id,
            selected_gym_id,
            user_id,
        )
        .await
    }

    pub async fn training_plan_detail_gym_exists_for_user(
        &self,
        gym_id: &str,
        user_id: &str,
    ) -> Result<bool, PersistenceError> {
        training_plans::training_plan_detail_gym_exists_for_user(self, gym_id, user_id).await
    }

    pub async fn fetch_gym_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<GymSummary>, PersistenceError> {
        gyms::fetch_gym_summaries_for_user(self, user_id, None).await
    }

    pub async fn fetch_gym_summaries_for_user_with_favorite(
        &self,
        user_id: &str,
        favorite_gym_id: Option<&str>,
    ) -> Result<Vec<GymSummary>, PersistenceError> {
        gyms::fetch_gym_summaries_for_user(self, user_id, favorite_gym_id).await
    }

    pub async fn favorite_gym_exists_for_user(
        &self,
        user_id: &str,
        gym_id: &str,
    ) -> Result<bool, PersistenceError> {
        gyms::favorite_gym_exists_for_user(self, user_id, gym_id).await
    }

    pub async fn fetch_gym_detail_for_user(
        &self,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Option<GymDetail>, PersistenceError> {
        gyms::fetch_gym_detail_for_user(self, gym_id, user_id).await
    }

    pub async fn fetch_gym_station_detail_for_user(
        &self,
        gym_id: &str,
        station_id: &str,
        user_id: &str,
    ) -> Result<Option<GymStationDetail>, PersistenceError> {
        gyms::fetch_gym_station_detail_for_user(self, gym_id, station_id, user_id).await
    }

    pub async fn fetch_load_profile_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<LoadProfileSummary>, PersistenceError> {
        load_profiles::fetch_load_profile_summaries_for_user(self, user_id).await
    }

    pub async fn fetch_training_plan_exercise_variant_summaries_for_user(
        &self,
        training_plan_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
        training_plans::fetch_training_plan_exercise_variant_summaries_for_user(
            self,
            training_plan_id,
            gym_id,
            user_id,
        )
        .await
    }

    pub async fn fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<ConfiguredGymTrainingPlanExerciseVariantOption>, PersistenceError> {
        training_plans::fetch_training_plan_exercise_variant_summaries_for_active_workout_for_user(
            self,
            training_plan_id,
            active_workout_id,
            gym_id,
            user_id,
        )
        .await
    }

    pub async fn fetch_training_plan_summaries_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
        training_plans::fetch_training_plan_summaries_for_user(self, user_id).await
    }

    pub async fn fetch_training_plan_exercise_ids_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        training_plans::fetch_training_plan_exercise_ids_for_user(self, training_plan_id, user_id)
            .await
    }

    pub async fn fetch_training_plan_exercise_ids_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        training_plans::fetch_training_plan_exercise_ids_for_active_workout_for_user(
            self,
            training_plan_id,
            active_workout_id,
            user_id,
        )
        .await
    }

    pub async fn fetch_training_plan_exercise_count_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError> {
        training_plans::fetch_training_plan_exercise_count_for_user(self, training_plan_id, user_id)
            .await
    }

    pub async fn fetch_training_plan_exercise_count_for_active_workout_for_user(
        &self,
        training_plan_id: &str,
        active_workout_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError> {
        training_plans::fetch_training_plan_exercise_count_for_active_workout_for_user(
            self,
            training_plan_id,
            active_workout_id,
            user_id,
        )
        .await
    }

    pub(crate) async fn fetch_workout_summary_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummaryReadModel>, PersistenceError> {
        workouts::fetch_workout_summary(self, workout_id, user_id).await
    }

    pub(crate) async fn fetch_workout_detail_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutDetailReadModel>, PersistenceError> {
        workouts::fetch_workout_detail(self, workout_id, user_id).await
    }

    pub async fn fetch_workout_history_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutHistorySummary>, PersistenceError> {
        workouts::fetch_workout_history(self, user_id).await
    }

    pub(crate) async fn fetch_workout_progress_read_models_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutProgressReadModel>, PersistenceError> {
        workouts::fetch_workout_progress_read_models(self, user_id).await
    }

    pub(crate) async fn fetch_in_window_exercise_performance_samples_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<crate::workout_metrics::ExercisePerformanceSample>, PersistenceError> {
        workouts::fetch_in_window_exercise_performance_samples(self, user_id).await
    }

    pub(crate) async fn fetch_strength_sample_rows_12m_for_user(
        &self,
        user_id: &str,
        variant_ids: &[String],
    ) -> Result<Vec<crate::workout_metrics::StrengthSampleSetRow>, PersistenceError> {
        workouts::fetch_strength_sample_rows_12m(self, user_id, variant_ids).await
    }

    pub(crate) async fn fetch_first_set_summaries_for_user(
        &self,
        user_id: &str,
        workout_exercise_ids: &[String],
    ) -> Result<HashMap<String, crate::workout_metrics::FirstSetSummary>, PersistenceError> {
        workouts::fetch_first_set_summaries(self, user_id, workout_exercise_ids).await
    }

    pub async fn fetch_historical_baseline_max_by_workout_exercise_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<HashMap<String, i32>, PersistenceError> {
        workouts::fetch_historical_baseline_max_by_workout_exercise(self, workout_id, user_id).await
    }

    pub async fn create_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<Workout, PersistenceError> {
        workouts::create_workout(self, new_workout, user_id).await
    }

    pub async fn fetch_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<Workout>, PersistenceError> {
        workouts::fetch_workout(self, workout_id, user_id).await
    }

    pub async fn create_active_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        active_workouts::create_active_workout(self, new_workout, user_id).await
    }

    pub async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        active_workouts::update_active_workout(self, workout_id, new_workout, user_id).await
    }

    pub async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        active_workouts::complete_active_workout(self, workout_id, new_workout, user_id).await
    }

    pub async fn cancel_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        active_workouts::cancel_active_workout(self, workout_id, user_id).await
    }

    pub(crate) async fn fetch_first_active_workout_read_model_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkoutReadModel>, PersistenceError> {
        active_workouts::fetch_first_active_workout(self, user_id).await
    }

    pub(crate) async fn fetch_active_workout_read_model_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkoutReadModel>, PersistenceError> {
        active_workouts::fetch_active_workout(self, workout_id, user_id).await
    }

    pub(crate) async fn fetch_latest_historical_suggestion_for_user(
        &self,
        query: HistoricalSuggestionQuery,
    ) -> Result<Option<HistoricalSuggestionCandidate>, PersistenceError> {
        suggestions::fetch_latest_historical_suggestion(self, query).await
    }

    pub(crate) async fn fetch_reps_progression_coverage_for_user(
        &self,
        query: RepsProgressionCoverageQuery,
    ) -> Result<RepsProgressionCoverage, PersistenceError> {
        progression::fetch_reps_progression_coverage(self, query).await
    }

    pub(crate) async fn fetch_reps_progression_history_for_user(
        &self,
        query: RepsProgressionHistoryQuery,
    ) -> Result<Vec<RepsProgressionHistorySample>, PersistenceError> {
        active_workouts::fetch_reps_progression_history(self, query).await
    }

    pub(crate) async fn fetch_latest_no_load_prior_repetition_value_for_user(
        &self,
        query: NoLoadPriorRepetitionQuery,
    ) -> Result<Option<i32>, PersistenceError> {
        active_workouts::fetch_latest_no_load_prior_set_repetition_value(self, query).await
    }

    pub async fn fetch_station_profile_loads_for_user(
        &self,
        selected_station_id: &str,
        user_id: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        suggestions::fetch_station_profile_loads_for_user(self, selected_station_id, user_id).await
    }

    pub async fn fetch_station_profile_loads_for_user_and_gym(
        &self,
        selected_station_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        suggestions::fetch_station_profile_loads_for_user_and_gym(
            self,
            selected_station_id,
            user_id,
            Some(gym_id),
        )
        .await
    }

    pub fn load_profile_definition_to_kg(
        definition: &sqlx::types::JsonValue,
        weight_unit: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        load_profiles::load_profile_definition_to_kg(definition, weight_unit)
    }

    pub fn load_profile_definition_to_kg_capped(
        definition: &sqlx::types::JsonValue,
        weight_unit: &str,
        max_load_kg: f64,
    ) -> Result<Vec<f64>, PersistenceError> {
        load_profiles::load_profile_definition_to_kg_capped(definition, weight_unit, max_load_kg)
    }

    pub fn snap_to_profile_load(profile_loads_kg: &[f64], current_load_kg: f64) -> Option<f64> {
        crate::workout_suggestion_logic::snap_to_profile_load(profile_loads_kg, current_load_kg)
    }

    pub async fn fetch_active_user_secret(
        &self,
        login: &str,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError> {
        auth::fetch_active_user_secret(self, login).await
    }

    pub async fn create_login_session(
        &self,
        secret_id: &str,
        user_id: &str,
        session_token_hash: &str,
        user_agent: Option<&str>,
    ) -> Result<(), PersistenceError> {
        auth::create_login_session(self, secret_id, user_id, session_token_hash, user_agent).await
    }

    pub async fn fetch_login_attempt_state(
        &self,
        attempt_key: &str,
        window_seconds: i32,
    ) -> Result<Option<LoginAttemptState>, PersistenceError> {
        auth::fetch_login_attempt_state(self, attempt_key, window_seconds).await
    }

    pub async fn record_failed_login_attempt(
        &self,
        attempt_key: &str,
        window_seconds: i32,
        lockout_threshold: i32,
        lockout_seconds: i32,
    ) -> Result<LoginAttemptState, PersistenceError> {
        auth::record_failed_login_attempt(
            self,
            attempt_key,
            window_seconds,
            lockout_threshold,
            lockout_seconds,
        )
        .await
    }

    pub async fn clear_login_attempt_state(
        &self,
        attempt_key: &str,
    ) -> Result<(), PersistenceError> {
        auth::clear_login_attempt_state(self, attempt_key).await
    }

    pub async fn fetch_active_user_secret_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError> {
        auth::fetch_active_user_secret_for_user(self, user_id).await
    }

    pub async fn rotate_user_secret(
        &self,
        user_id: &str,
        active_secret_id: &str,
        replacement_secret_hash: &str,
    ) -> Result<(), PersistenceError> {
        auth::rotate_user_secret(self, user_id, active_secret_id, replacement_secret_hash).await
    }

    pub async fn touch_session(
        &self,
        session_token_hash: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError> {
        auth::touch_session(self, session_token_hash).await
    }

    pub async fn revoke_session(
        &self,
        session_token_hash: &str,
        revoke_reason: &str,
    ) -> Result<(), PersistenceError> {
        auth::revoke_session(self, session_token_hash, revoke_reason).await
    }

    pub async fn update_session_display_name(
        &self,
        user_id: &str,
        display_name: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError> {
        auth::update_session_display_name(self, user_id, display_name).await
    }

    pub async fn fetch_favorite_gym_preference_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<String>, PersistenceError> {
        auth::fetch_favorite_gym_preference(self, user_id).await
    }

    pub async fn update_favorite_gym_preference_for_user(
        &self,
        user_id: &str,
        favorite_gym_id: Option<&str>,
    ) -> Result<Option<String>, PersistenceError> {
        auth::update_favorite_gym_preference(self, user_id, favorite_gym_id).await
    }

    pub async fn update_max_load_kg_preference_for_user(
        &self,
        user_id: &str,
        max_load_kg: f64,
    ) -> Result<f64, PersistenceError> {
        auth::update_max_load_kg_preference(self, user_id, max_load_kg).await
    }

    pub async fn fetch_max_load_kg_preference_for_user(
        &self,
        user_id: &str,
    ) -> Result<f64, PersistenceError> {
        auth::fetch_max_load_kg_preference(self, user_id).await
    }

    pub async fn increment_side_menu_middle_click_count_for_user(
        &self,
        user_id: &str,
        screen: SideMenuMiddleScreen,
    ) -> Result<SideMenuMiddleClickCounts, PersistenceError> {
        auth::increment_side_menu_middle_click_count(self, user_id, screen).await
    }
}
