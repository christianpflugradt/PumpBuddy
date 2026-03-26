use crate::domain::{
    ActiveWorkout, GymSummary, NewWorkout, PlanExerciseOptionSummary, TrainingPlan,
    TrainingPlanSummary, Workout, WorkoutSummary,
};
use sqlx::PgPool;
use std::collections::HashSet;

mod active_workouts;
mod auth;
mod load_profiles;
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
    fn from(value: sqlx::Error) -> Self {
        Self::Sqlx(value)
    }
}

#[derive(Clone)]
pub struct DomainRepository {
    pool: PgPool,
}

const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";

pub use auth::{ActiveUserSecret, AuthenticatedSession};

impl DomainRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn fetch_training_plan(
        &self,
        training_plan_id: &str,
    ) -> Result<Option<TrainingPlan>, PersistenceError> {
        training_plans::fetch_training_plan(self, training_plan_id).await
    }

    pub async fn fetch_training_plan_summaries(
        &self,
    ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
        // Deprecated: require callers to use the user-scoped variant.
        // For tests that still use the non-user-scoped API, default to the seeded dev user.
        training_plans::fetch_training_plan_summaries_for_user(self, DEV_USER_ID).await
    }

    pub async fn fetch_gym_summaries(&self) -> Result<Vec<GymSummary>, PersistenceError> {
        training_plans::fetch_gym_summaries(self).await
    }

    pub async fn fetch_plan_exercise_option_summaries(
        &self,
        training_plan_id: &str,
        gym_id: &str,
    ) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
        // Deprecated: prefer the user-scoped variant
        training_plans::fetch_plan_exercise_option_summaries(self, training_plan_id, gym_id).await
    }

    pub async fn fetch_plan_exercise_option_summaries_for_user(
        &self,
        training_plan_id: &str,
        gym_id: &str,
        user_id: &str,
    ) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
        training_plans::fetch_plan_exercise_option_summaries_for_user(
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

    pub async fn fetch_training_plan_exercise_ids(
        &self,
        training_plan_id: &str,
    ) -> Result<HashSet<String>, PersistenceError> {
        training_plans::fetch_training_plan_exercise_ids(self, training_plan_id).await
    }

    pub async fn fetch_training_plan_exercise_count(
        &self,
        training_plan_id: &str,
    ) -> Result<i64, PersistenceError> {
        training_plans::fetch_training_plan_exercise_count(self, training_plan_id).await
    }

    pub async fn fetch_workout_summary(
        &self,
        workout_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError> {
        workouts::fetch_workout_summary(self, workout_id, DEV_USER_ID).await
    }

    pub async fn fetch_workout_summary_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError> {
        workouts::fetch_workout_summary(self, workout_id, user_id).await
    }

    pub async fn create_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<Workout, PersistenceError> {
        workouts::create_workout(self, new_workout, DEV_USER_ID).await
    }

    pub async fn create_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<Workout, PersistenceError> {
        workouts::create_workout(self, new_workout, user_id).await
    }

    pub async fn fetch_workout(
        &self,
        workout_id: &str,
    ) -> Result<Option<Workout>, PersistenceError> {
        workouts::fetch_workout(self, workout_id, DEV_USER_ID).await
    }

    pub async fn fetch_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<Workout>, PersistenceError> {
        workouts::fetch_workout(self, workout_id, user_id).await
    }

    pub async fn create_active_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<ActiveWorkout, PersistenceError> {
        // default (test) path without user scoping
        active_workouts::create_active_workout(self, new_workout, DEV_USER_ID).await
    }

    pub async fn create_active_workout_for_user(
        &self,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::create_active_workout(self, new_workout, user_id).await
    }

    pub async fn update_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::update_active_workout(self, workout_id, new_workout, DEV_USER_ID).await
    }

    pub async fn update_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::update_active_workout(self, workout_id, new_workout, user_id).await
    }

    pub async fn complete_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<WorkoutSummary, PersistenceError> {
        active_workouts::complete_active_workout(self, workout_id, new_workout, DEV_USER_ID).await
    }

    pub async fn complete_active_workout_for_user(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
        user_id: &str,
    ) -> Result<WorkoutSummary, PersistenceError> {
        active_workouts::complete_active_workout(self, workout_id, new_workout, user_id).await
    }

    pub async fn cancel_active_workout(&self, workout_id: &str) -> Result<(), PersistenceError> {
        active_workouts::cancel_active_workout(self, workout_id, DEV_USER_ID).await
    }

    pub async fn cancel_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<(), PersistenceError> {
        active_workouts::cancel_active_workout(self, workout_id, user_id).await
    }

    pub async fn fetch_first_active_workout(
        &self,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        // TODO: callers that need user scoping should pass user_id; default to None behavior
        // Keep the original API but delegate to the user-scoped variant with empty user to avoid breaking tests.
        active_workouts::fetch_first_active_workout(self, DEV_USER_ID).await
    }

    pub async fn fetch_first_active_workout_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_first_active_workout(self, user_id).await
    }

    pub async fn fetch_active_workout(
        &self,
        workout_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_active_workout(self, workout_id, DEV_USER_ID).await
    }

    pub async fn fetch_active_workout_for_user(
        &self,
        workout_id: &str,
        user_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_active_workout(self, workout_id, user_id).await
    }

    pub async fn fetch_station_profile_loads(
        &self,
        selected_station_id: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        suggestions::fetch_station_profile_loads(self, selected_station_id).await
    }

    pub async fn fetch_station_profile_loads_for_gym(
        &self,
        selected_station_id: &str,
        gym_id: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        suggestions::fetch_station_profile_loads_for_gym(self, selected_station_id, Some(gym_id))
            .await
    }

    pub fn load_profile_definition_to_kg(
        definition: &sqlx::types::JsonValue,
        weight_unit: &str,
    ) -> Result<Vec<f64>, PersistenceError> {
        load_profiles::load_profile_definition_to_kg(definition, weight_unit)
    }

    pub fn snap_to_profile_load(profile_loads_kg: &[f64], current_load_kg: f64) -> Option<f64> {
        suggestions::snap_to_profile_load(profile_loads_kg, current_load_kg)
    }

    pub async fn fetch_active_user_secret(
        &self,
    ) -> Result<Option<ActiveUserSecret>, PersistenceError> {
        auth::fetch_active_user_secret(self).await
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

    pub async fn touch_session(
        &self,
        session_token_hash: &str,
    ) -> Result<Option<AuthenticatedSession>, PersistenceError> {
        auth::touch_session(self, session_token_hash).await
    }
}
