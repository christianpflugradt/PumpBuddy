use crate::domain::{
    ActiveWorkout, ConfiguredGymTrainingPlanExerciseVariantOption, GymDetail, GymStationDetail,
    GymSummary, NewWorkout, TrainingPlanDetail, TrainingPlanSummary, Workout, WorkoutDetail,
    WorkoutExercisesPerformanceGroup, WorkoutHistorySummary, WorkoutProgressEntry, WorkoutSummary,
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

pub use auth::{ActiveUserSecret, AuthenticatedSession, LoginAttemptState};

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
        ip_address: Option<&str>,
    ) -> Result<(), PersistenceError>;

    async fn fetch_login_attempt_state(
        &self,
        key_scope: &str,
        key_value: &str,
        window_seconds: i32,
    ) -> Result<Option<LoginAttemptState>, PersistenceError>;

    async fn record_failed_login_attempt(
        &self,
        key_scope: &str,
        key_value: &str,
        window_seconds: i32,
        lockout_threshold: i32,
        lockout_seconds: i32,
    ) -> Result<LoginAttemptState, PersistenceError>;

    async fn clear_login_attempt_state(
        &self,
        key_scope: &str,
        key_value: &str,
    ) -> Result<(), PersistenceError>;

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

    async fn fetch_training_plan_exercise_ids_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError>;

    async fn fetch_training_plan_exercise_count_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError>;
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

pub(crate) trait WorkoutRepository {
    async fn fetch_workout_history_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutHistorySummary>, PersistenceError>;

    async fn fetch_workout_progress_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutProgressEntry>, PersistenceError>;

    async fn fetch_workout_summary_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError>;

    async fn fetch_workout_detail_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutDetail>, PersistenceError>;

    async fn fetch_workout_exercises_performance_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutExercisesPerformanceGroup>, PersistenceError>;

    async fn create_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<Workout, PersistenceError>;

    async fn fetch_first_active_workout_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError>;

    async fn fetch_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError>;

    async fn create_active_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError>;

    async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError>;

    async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<WorkoutSummary, PersistenceError>;

    async fn cancel_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<(), PersistenceError>;
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
        ip_address: Option<&str>,
    ) -> Result<(), PersistenceError> {
        DomainRepository::create_login_session(
            self,
            secret_id,
            user_id,
            session_token_hash,
            user_agent,
            ip_address,
        )
        .await
    }

    async fn fetch_login_attempt_state(
        &self,
        key_scope: &str,
        key_value: &str,
        window_seconds: i32,
    ) -> Result<Option<LoginAttemptState>, PersistenceError> {
        DomainRepository::fetch_login_attempt_state(self, key_scope, key_value, window_seconds)
            .await
    }

    async fn record_failed_login_attempt(
        &self,
        key_scope: &str,
        key_value: &str,
        window_seconds: i32,
        lockout_threshold: i32,
        lockout_seconds: i32,
    ) -> Result<LoginAttemptState, PersistenceError> {
        DomainRepository::record_failed_login_attempt(
            self,
            key_scope,
            key_value,
            window_seconds,
            lockout_threshold,
            lockout_seconds,
        )
        .await
    }

    async fn clear_login_attempt_state(
        &self,
        key_scope: &str,
        key_value: &str,
    ) -> Result<(), PersistenceError> {
        DomainRepository::clear_login_attempt_state(self, key_scope, key_value).await
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

    async fn fetch_training_plan_exercise_ids_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        DomainRepository::fetch_training_plan_exercise_ids_for_user(self, training_plan_id, user_id)
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

impl WorkoutRepository for DomainRepository {
    async fn fetch_workout_history_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutHistorySummary>, PersistenceError> {
        DomainRepository::fetch_workout_history_for_user(self, user_id).await
    }

    async fn fetch_workout_progress_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutProgressEntry>, PersistenceError> {
        DomainRepository::fetch_workout_progress_for_user(self, user_id).await
    }

    async fn fetch_workout_summary_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError> {
        DomainRepository::fetch_workout_summary_for_user(self, workout_id, user_id).await
    }

    async fn fetch_workout_detail_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutDetail>, PersistenceError> {
        DomainRepository::fetch_workout_detail_for_user(self, workout_id, user_id).await
    }

    async fn fetch_workout_exercises_performance_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutExercisesPerformanceGroup>, PersistenceError> {
        DomainRepository::fetch_workout_exercises_performance_for_user(self, user_id).await
    }

    async fn create_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<Workout, PersistenceError> {
        DomainRepository::create_workout_for_user(self, new_workout, user_id).await
    }

    async fn fetch_first_active_workout_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        DomainRepository::fetch_first_active_workout_for_user(self, user_id).await
    }

    async fn fetch_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        DomainRepository::fetch_active_workout_for_user(self, workout_id, user_id).await
    }

    async fn create_active_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError> {
        DomainRepository::create_active_workout_for_user(self, new_workout, user_id).await
    }

    async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError> {
        DomainRepository::update_active_workout_for_user(self, workout_id, new_workout, user_id)
            .await
    }

    async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<WorkoutSummary, PersistenceError> {
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

    pub async fn fetch_training_plan_exercise_count_for_user(
        &self,
        training_plan_id: &str,
        user_id: &str,
    ) -> Result<i64, PersistenceError> {
        training_plans::fetch_training_plan_exercise_count_for_user(self, training_plan_id, user_id)
            .await
    }

    pub async fn fetch_workout_summary_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError> {
        workouts::fetch_workout_summary(self, workout_id, user_id).await
    }

    pub async fn fetch_workout_detail_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutDetail>, PersistenceError> {
        workouts::fetch_workout_detail(self, workout_id, user_id).await
    }

    pub async fn fetch_workout_history_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutHistorySummary>, PersistenceError> {
        workouts::fetch_workout_history(self, user_id).await
    }

    pub async fn fetch_workout_progress_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutProgressEntry>, PersistenceError> {
        workouts::fetch_workout_progress(self, user_id).await
    }

    pub async fn fetch_workout_exercises_performance_for_user(
        &self,
        user_id: &str,
    ) -> Result<Vec<WorkoutExercisesPerformanceGroup>, PersistenceError> {
        workouts::fetch_workout_exercises_performance(self, user_id).await
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
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::create_active_workout(self, new_workout, user_id).await
    }

    pub async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::update_active_workout(self, workout_id, new_workout, user_id).await
    }

    pub async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<WorkoutSummary, PersistenceError> {
        active_workouts::complete_active_workout(self, workout_id, new_workout, user_id).await
    }

    pub async fn cancel_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        active_workouts::cancel_active_workout(self, workout_id, user_id).await
    }

    pub async fn fetch_first_active_workout_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_first_active_workout(self, user_id).await
    }

    pub async fn fetch_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_active_workout(self, workout_id, user_id).await
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
        ip_address: Option<&str>,
    ) -> Result<(), PersistenceError> {
        auth::create_login_session(
            self,
            secret_id,
            user_id,
            session_token_hash,
            user_agent,
            ip_address,
        )
        .await
    }

    pub async fn fetch_login_attempt_state(
        &self,
        key_scope: &str,
        key_value: &str,
        window_seconds: i32,
    ) -> Result<Option<LoginAttemptState>, PersistenceError> {
        auth::fetch_login_attempt_state(self, key_scope, key_value, window_seconds).await
    }

    pub async fn record_failed_login_attempt(
        &self,
        key_scope: &str,
        key_value: &str,
        window_seconds: i32,
        lockout_threshold: i32,
        lockout_seconds: i32,
    ) -> Result<LoginAttemptState, PersistenceError> {
        auth::record_failed_login_attempt(
            self,
            key_scope,
            key_value,
            window_seconds,
            lockout_threshold,
            lockout_seconds,
        )
        .await
    }

    pub async fn clear_login_attempt_state(
        &self,
        key_scope: &str,
        key_value: &str,
    ) -> Result<(), PersistenceError> {
        auth::clear_login_attempt_state(self, key_scope, key_value).await
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
}
