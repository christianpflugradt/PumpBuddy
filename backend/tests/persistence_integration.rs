mod support;

use self::support::{active_workout_fixture, test_lock, TestDatabase};
use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use pumpbuddy_backend::persistence::DomainRepository;
use sqlx::Row;
use std::collections::{BTreeMap, HashSet};

const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";
const USER_B_ID: &str = "00000000-0000-0000-0000-000000000012";

// Test-only compatibility shim:
// keep integration tests readable while production repository APIs stay
// explicitly user-scoped.
trait LegacyRepositoryTestExt {
    async fn fetch_training_plan_exercise_variant_summaries(
        &self,
        training_plan_id: &str,
        gym_id: &str,
    ) -> Result<
        Vec<pumpbuddy_backend::domain::PlanExerciseOptionSummary>,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn fetch_gym_summaries(
        &self,
    ) -> Result<
        Vec<pumpbuddy_backend::domain::GymSummary>,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn create_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<pumpbuddy_backend::domain::Workout, pumpbuddy_backend::persistence::PersistenceError>;
    async fn fetch_workout(
        &self,
        workout_id: &str,
    ) -> Result<
        Option<pumpbuddy_backend::domain::Workout>,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn fetch_workout_summary(
        &self,
        workout_id: &str,
    ) -> Result<
        Option<pumpbuddy_backend::domain::WorkoutSummary>,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn create_active_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<
        pumpbuddy_backend::domain::ActiveWorkout,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn fetch_first_active_workout(
        &self,
    ) -> Result<
        Option<pumpbuddy_backend::domain::ActiveWorkout>,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn fetch_active_workout(
        &self,
        workout_id: &str,
    ) -> Result<
        Option<pumpbuddy_backend::domain::ActiveWorkout>,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn update_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<
        pumpbuddy_backend::domain::ActiveWorkout,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn complete_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<
        pumpbuddy_backend::domain::WorkoutSummary,
        pumpbuddy_backend::persistence::PersistenceError,
    >;
    async fn cancel_active_workout(
        &self,
        workout_id: &str,
    ) -> Result<(), pumpbuddy_backend::persistence::PersistenceError>;
}

impl LegacyRepositoryTestExt for DomainRepository {
    async fn fetch_training_plan_exercise_variant_summaries(
        &self,
        training_plan_id: &str,
        gym_id: &str,
    ) -> Result<
        Vec<pumpbuddy_backend::domain::PlanExerciseOptionSummary>,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.fetch_training_plan_exercise_variant_summaries_for_user(
            training_plan_id,
            gym_id,
            DEV_USER_ID,
        )
        .await
    }

    async fn fetch_gym_summaries(
        &self,
    ) -> Result<
        Vec<pumpbuddy_backend::domain::GymSummary>,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.fetch_gym_summaries_for_user(DEV_USER_ID).await
    }

    async fn create_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<pumpbuddy_backend::domain::Workout, pumpbuddy_backend::persistence::PersistenceError>
    {
        self.create_workout_for_user(new_workout, DEV_USER_ID).await
    }

    async fn fetch_workout(
        &self,
        workout_id: &str,
    ) -> Result<
        Option<pumpbuddy_backend::domain::Workout>,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.fetch_workout_for_user(workout_id, DEV_USER_ID).await
    }

    async fn fetch_workout_summary(
        &self,
        workout_id: &str,
    ) -> Result<
        Option<pumpbuddy_backend::domain::WorkoutSummary>,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.fetch_workout_summary_for_user(workout_id, DEV_USER_ID)
            .await
    }

    async fn create_active_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<
        pumpbuddy_backend::domain::ActiveWorkout,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.create_active_workout_for_user(new_workout, DEV_USER_ID)
            .await
    }

    async fn fetch_first_active_workout(
        &self,
    ) -> Result<
        Option<pumpbuddy_backend::domain::ActiveWorkout>,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.fetch_first_active_workout_for_user(DEV_USER_ID).await
    }

    async fn fetch_active_workout(
        &self,
        workout_id: &str,
    ) -> Result<
        Option<pumpbuddy_backend::domain::ActiveWorkout>,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.fetch_active_workout_for_user(workout_id, DEV_USER_ID)
            .await
    }

    async fn update_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<
        pumpbuddy_backend::domain::ActiveWorkout,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.update_active_workout_for_user(workout_id, new_workout, DEV_USER_ID)
            .await
    }

    async fn complete_active_workout(
        &self,
        workout_id: &str,
        new_workout: &NewWorkout,
    ) -> Result<
        pumpbuddy_backend::domain::WorkoutSummary,
        pumpbuddy_backend::persistence::PersistenceError,
    > {
        self.complete_active_workout_for_user(workout_id, new_workout, DEV_USER_ID)
            .await
    }

    async fn cancel_active_workout(
        &self,
        workout_id: &str,
    ) -> Result<(), pumpbuddy_backend::persistence::PersistenceError> {
        self.cancel_active_workout_for_user(workout_id, DEV_USER_ID)
            .await
    }
}

async fn clear_user_workout_history(pool: &sqlx::PgPool, user_id: &str) {
    sqlx::query("DELETE FROM workout_sets WHERE user_id = $1::uuid")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("workout set cleanup should succeed");

    sqlx::query("DELETE FROM workout_exercises WHERE user_id = $1::uuid")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("workout exercise cleanup should succeed");

    sqlx::query("DELETE FROM workouts WHERE user_id = $1::uuid")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("workout cleanup should succeed");
}

fn completed_single_exercise_workout(
    completed_at: &str,
    variant_id: &str,
    station_id: Option<&str>,
    option_id: &str,
    repetition_value: i32,
    load_kg: f64,
) -> NewWorkout {
    NewWorkout {
        training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
        gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
        started_at: Some("2026-01-01T09:00:00Z".to_owned()),
        completed_at: Some(completed_at.to_owned()),
        current_exercise_position: Some(1),
        exercises: vec![NewWorkoutExercise {
            training_plan_exercise_id: "32000000-0000-0000-0000-000000000001".to_owned(),
            position: 1,
            selected_variant_id: Some(variant_id.to_owned()),
            selected_station_id: station_id.map(str::to_owned),
            selected_training_plan_exercise_variant_id: Some(option_id.to_owned()),
            set_tracking_mode: Some("BILATERAL".to_owned()),
            skipped_at: None,
            completed_at: Some(completed_at.to_owned()),
            sets: vec![NewWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                repetition_value: Some(repetition_value),
                load_display_value: Some(load_kg),
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: Some(load_kg),
                completed_at: Some(completed_at.to_owned()),
            }],
        }],
    }
}

fn completed_four_exercise_workout_for_progress(
    completed_at: &str,
    covered_exercise_count: usize,
) -> NewWorkout {
    let covered_variant_id = "20000000-0000-0000-0000-000000000001";
    let uncovered_variant_id = "20000000-0000-0000-0000-000000000004";

    let covered_exercise =
        |position: i32, repetition_value: i32, load_kg: f64| NewWorkoutExercise {
            training_plan_exercise_id: "32000000-0000-0000-0000-000000000001".to_owned(),
            position,
            selected_variant_id: Some(covered_variant_id.to_owned()),
            selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            selected_training_plan_exercise_variant_id: Some(
                "33000000-0000-0000-0000-000000000001".to_owned(),
            ),
            set_tracking_mode: Some("BILATERAL".to_owned()),
            skipped_at: None,
            completed_at: Some(completed_at.to_owned()),
            sets: vec![NewWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                repetition_value: Some(repetition_value),
                load_display_value: Some(load_kg),
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: Some(load_kg),
                completed_at: Some(completed_at.to_owned()),
            }],
        };

    let uncovered_exercise =
        |position: i32, repetition_value: i32, load_kg: f64| NewWorkoutExercise {
            training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
            position,
            selected_variant_id: Some(uncovered_variant_id.to_owned()),
            selected_station_id: None,
            selected_training_plan_exercise_variant_id: Some(
                "33000000-0000-0000-0000-000000000005".to_owned(),
            ),
            set_tracking_mode: Some("BILATERAL".to_owned()),
            skipped_at: None,
            completed_at: Some(completed_at.to_owned()),
            sets: vec![NewWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                repetition_value: Some(repetition_value),
                load_display_value: Some(load_kg),
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: Some(load_kg),
                completed_at: Some(completed_at.to_owned()),
            }],
        };

    let mut exercises = Vec::with_capacity(4);
    exercises.push(covered_exercise(1, 20, 10.0)); // ratio 2.00 => clamp 1.20
    exercises.push(covered_exercise(2, 5, 10.0)); // ratio 0.50 => clamp 0.70
    exercises.push(if covered_exercise_count >= 3 {
        covered_exercise(3, 10, 10.0) // ratio 1.00
    } else {
        uncovered_exercise(3, 9, 10.0)
    });
    exercises.push(uncovered_exercise(4, 9, 10.0));

    NewWorkout {
        training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
        gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
        started_at: Some("2026-01-01T09:00:00Z".to_owned()),
        completed_at: Some(completed_at.to_owned()),
        current_exercise_position: Some(4),
        exercises,
    }
}

include!("persistence_integration/user_scope_and_seed.rs");
include!("persistence_integration/options_and_gyms.rs");
include!("persistence_integration/workout_persistence.rs");
include!("persistence_integration/active_workout_lifecycle.rs");
include!("persistence_integration/suggestion_engine.rs");
include!("persistence_integration/progression_and_stationless.rs");
include!("persistence_integration/durability_and_cancel.rs");
