use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};

mod test_runtime {
    pub use pumpbuddy_backend::test_runtime::{
        TESTCONTAINERS_POSTGRES_IMAGE_NAME, TESTCONTAINERS_POSTGRES_IMAGE_TAG,
    };
}

#[path = "../../src/test_support/postgres.rs"]
mod postgres;

pub use postgres::{test_lock, TestDatabase};

#[allow(dead_code)]
pub fn active_workout_fixture() -> NewWorkout {
    NewWorkout {
        training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
        gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
        started_at: Some("2026-02-01T09:00:00Z".to_owned()),
        completed_at: None,
        current_exercise_position: Some(1),
        exercises: vec![NewWorkoutExercise {
            training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
            position: 1,
            selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
            selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            selected_training_plan_exercise_variant_id: Some(
                "33000000-0000-0000-0000-000000000008".to_owned(),
            ),
            set_tracking_mode: None,
            skipped_at: None,
            completed_at: None,
            sets: vec![NewWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                repetition_value: Some(10),
                load_display_value: Some(20.0),
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: Some(20.0),
                completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
            }],
        }],
    }
}
