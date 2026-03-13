use crate::domain::{
    ActiveWorkout, GymSummary, NewWorkout, PlanExerciseOptionSummary, TrainingPlan,
    TrainingPlanSummary, Workout, WorkoutSummary,
};
use sqlx::PgPool;
use std::collections::HashSet;

mod active_workouts;
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
        training_plans::fetch_training_plan_summaries(self).await
    }

    pub async fn fetch_gym_summaries(&self) -> Result<Vec<GymSummary>, PersistenceError> {
        training_plans::fetch_gym_summaries(self).await
    }

    pub async fn fetch_plan_exercise_option_summaries(
        &self,
        training_plan_id: &str,
        gym_id: &str,
    ) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
        training_plans::fetch_plan_exercise_option_summaries(self, training_plan_id, gym_id).await
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
        workouts::fetch_workout_summary(self, workout_id).await
    }

    pub async fn create_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<Workout, PersistenceError> {
        workouts::create_workout(self, new_workout).await
    }

    pub async fn fetch_workout(
        &self,
        workout_id: &str,
    ) -> Result<Option<Workout>, PersistenceError> {
        workouts::fetch_workout(self, workout_id).await
    }

    pub async fn create_active_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::create_active_workout(self, new_workout).await
    }

    pub async fn update_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<ActiveWorkout, PersistenceError> {
        active_workouts::update_active_workout(self, workout_id, new_workout).await
    }

    pub async fn complete_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<WorkoutSummary, PersistenceError> {
        active_workouts::complete_active_workout(self, workout_id, new_workout).await
    }

    pub async fn cancel_active_workout(&self, workout_id: &str) -> Result<(), PersistenceError> {
        active_workouts::cancel_active_workout(self, workout_id).await
    }

    pub async fn fetch_first_active_workout(
        &self,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_first_active_workout(self).await
    }

    pub async fn fetch_active_workout(
        &self,
        workout_id: &str,
    ) -> Result<Option<ActiveWorkout>, PersistenceError> {
        active_workouts::fetch_active_workout(self, workout_id).await
    }
}
