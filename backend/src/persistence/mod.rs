use crate::domain::{
    ActiveWorkout, GymSummary, NewWorkout, PlanExerciseOptionSummary, TrainingPlan,
    TrainingPlanSummary, Workout, WorkoutSummary,
};
use sqlx::PgPool;
use std::collections::HashSet;

mod active_workouts;
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

async fn fetch_latest_historical_suggestion(
    repository: &DomainRepository,
    current_workout_id: &str,
    exercise_id: &str,
    selected_variant_id: Option<&str>,
    selected_station_id: Option<&str>,
) -> Result<Option<crate::domain::ActiveWorkoutSet>, PersistenceError> {
    use sqlx::Row;

    let row = sqlx::query(
        "SELECT
            ws.load_display_value::double precision AS load_value,
            ws.reps
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         WHERE w.id <> $1::uuid
           AND tpe.exercise_id = $2::uuid
           AND ($3::uuid IS NULL OR we.selected_variant_id = $3::uuid)
           AND ($4::uuid IS NULL OR we.selected_station_id = $4::uuid)
         ORDER BY ws.completed_at DESC, w.updated_at DESC, ws.set_index DESC
         LIMIT 1",
    )
    .bind(current_workout_id)
    .bind(exercise_id)
    .bind(selected_variant_id)
    .bind(selected_station_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| crate::domain::ActiveWorkoutSet {
        load_value: row.get("load_value"),
        reps: row.get("reps"),
    }))
}

fn default_suggested_set() -> crate::domain::ActiveWorkoutSet {
    crate::domain::ActiveWorkoutSet {
        load_value: 10.0,
        reps: Some(10),
    }
}
