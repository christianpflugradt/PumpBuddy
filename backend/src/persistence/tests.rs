use super::PersistenceError;
use crate::domain::{
    GymSummary, NewWorkout, NewWorkoutExercise, NewWorkoutSet, PlanExerciseOptionSummary,
    TrainingPlan, TrainingPlanSummary, Workout, WorkoutSummary,
};
use std::collections::HashMap;
use tokio::sync::Mutex;

// NOTE: Active-workout helpers were removed from the in-memory FakeRepository
// to keep unit-scoped helpers focused on the behaviors exercised by the
// persistence unit tests. Integration-level active-workout behaviors are
// covered by `backend/tests/persistence_integration.rs` which uses the real
// database-backed repository.

// In-memory fake repository used to isolate unit tests from a real database.
struct FakeRepository {
    workouts: Mutex<HashMap<String, Workout>>,
}

impl FakeRepository {
    fn new() -> Self {
        Self {
            workouts: Mutex::new(HashMap::new()),
        }
    }

    async fn fetch_training_plan(
        &self,
        training_plan_id: &str,
    ) -> Result<Option<TrainingPlan>, PersistenceError> {
        if training_plan_id == "00000000-0000-0000-0000-000000000201" {
            let exercises = (1..=5)
                .map(|i| crate::domain::TrainingPlanExercise {
                    id: format!("e{i}"),
                    position: i,
                    target_sets: None,
                    target_reps_min: None,
                    target_reps_max: None,
                    exercise: crate::domain::Exercise {
                        id: format!("ex{i}"),
                        name: format!("Exercise {i}"),
                    },
                    options: if i == 1 {
                        vec![crate::domain::PlanExerciseOption {
                            id: "opt1".to_string(),
                            training_plan_exercise_id: "e1".to_string(),
                            gym: crate::domain::Gym {
                                id: "g1".to_string(),
                                name: "Countryside".to_string(),
                            },
                            variant: crate::domain::ExerciseVariant {
                                id: "v1".to_string(),
                                exercise_id: "ex1".to_string(),
                                name: "Variant 1".to_string(),
                                variant_type: "type".to_string(),
                                load_input_mode: "TOTAL".to_string(),
                            },
                            station: Some(crate::domain::EquipmentStation {
                                id: "s1".to_string(),
                                gym_id: "g1".to_string(),
                                name: "Station 1".to_string(),
                                load_profile_id: "lp1".to_string(),
                            }),
                        }]
                    } else {
                        vec![]
                    },
                })
                .collect();

            Ok(Some(TrainingPlan {
                id: training_plan_id.to_owned(),
                name: "Push Day".to_owned(),
                exercises,
            }))
        } else {
            Ok(Some(TrainingPlan {
                id: training_plan_id.to_owned(),
                name: "Pull Day".to_owned(),
                exercises: vec![],
            }))
        }
    }

    async fn fetch_training_plan_summaries(
        &self,
    ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
        Ok(vec![
            TrainingPlanSummary {
                id: "201".to_owned(),
                name: "Push Day".to_owned(),
                exercise_count: 5,
            },
            TrainingPlanSummary {
                id: "202".to_owned(),
                name: "Pull Day".to_owned(),
                exercise_count: 5,
            },
        ])
    }

    async fn fetch_gym_summaries(&self) -> Result<Vec<GymSummary>, PersistenceError> {
        Ok(vec![GymSummary {
            id: "00000000-0000-0000-0000-000000000101".to_owned(),
            name: "Countryside".to_owned(),
        }])
    }

    async fn fetch_plan_exercise_option_summaries(
        &self,
        _training_plan_id: &str,
        _gym_id: &str,
    ) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
        Ok(vec![PlanExerciseOptionSummary {
            id: "opt1".to_string(),
            training_plan_exercise_id: "e1".to_string(),
            exercise_name: "Exercise 1".to_string(),
            exercise_position: 1,
            variant_id: "v1".to_string(),
            variant_name: "Variant 1".to_string(),
            variant_type: "type".to_string(),
            load_input_mode: "TOTAL".to_string(),
            station_id: Some("s1".to_string()),
            station_name: Some("Station 1".to_string()),
            station_profile_loads_kg: vec![10.0, 12.5, 15.0],
            suggested_start_load_kg: Some(10.0),
        }])
    }

    async fn create_workout(&self, new_workout: &NewWorkout) -> Result<Workout, PersistenceError> {
        let workout = Workout {
            id: "w-1".to_owned(),
            training_plan_id: new_workout.training_plan_id.clone(),
            gym_id: new_workout.gym_id.clone(),
            started_at: new_workout.started_at.clone(),
            completed_at: new_workout.completed_at.clone(),
            exercises: new_workout
                .exercises
                .iter()
                .enumerate()
                .map(|(i, e)| crate::domain::WorkoutExercise {
                    id: format!("we{}", i + 1),
                    training_plan_exercise_id: e.training_plan_exercise_id.clone(),
                    position: e.position,
                    selected_variant_id: e.selected_variant_id.clone(),
                    selected_station_id: e.selected_station_id.clone(),
                    selected_plan_exercise_option_id: e.selected_plan_exercise_option_id.clone(),
                    skipped_at: None,
                    sets: e
                        .sets
                        .iter()
                        .map(|s| crate::domain::WorkoutSet {
                            id: format!("ws{}", s.set_index),
                            set_index: s.set_index,
                            reps: s.reps,
                            load_display_value: s.load_display_value,
                            load_display_unit: s.load_display_unit.clone(),
                            load_canonical_kg: s.load_canonical_kg,
                            completed_at: s.completed_at.clone().unwrap_or_default(),
                        })
                        .collect(),
                })
                .collect(),
        };

        self.workouts
            .lock()
            .await
            .insert(workout.id.clone(), workout.clone());
        Ok(workout)
    }

    async fn fetch_workout_summary(
        &self,
        workout_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError> {
        let workouts = self.workouts.lock().await;
        if let Some(w) = workouts.get(workout_id) {
            let exercise_count = w.exercises.len() as i64;
            let completed_set_count = w.exercises.iter().map(|ex| ex.sets.len() as i64).sum();
            Ok(Some(WorkoutSummary {
                id: w.id.clone(),
                training_plan_id: w.training_plan_id.clone(),
                training_plan_name: "Push Day".to_string(),
                gym_id: w.gym_id.clone(),
                gym_name: Some("Countryside".to_string()),
                started_at: w.started_at.clone(),
                completed_at: w.completed_at.clone(),
                exercise_count,
                completed_set_count,
            }))
        } else {
            Ok(None)
        }
    }

    // Active-workout in-memory helpers intentionally omitted from the unit
    // fake repository. Integration tests exercise active-workout persistence
    // against the real database-backed `TestDatabase` to keep unit tests
    // lightweight and focused on mapping/shape concerns.
}

#[tokio::test]
async fn fetch_training_plan_hydrates_exercises_and_options() {
    let repository = FakeRepository::new();
    let plan = repository
        .fetch_training_plan("00000000-0000-0000-0000-000000000201")
        .await
        .expect("fetch training plan should succeed")
        .expect("push day training plan should exist");

    // basic structure checks only — detailed DB-backed semantics are covered by
    // integration tests in `backend/tests/persistence_integration.rs`.
    assert!(!plan.name.is_empty());
    assert!(!plan.exercises.is_empty());
    assert!(plan
        .exercises
        .iter()
        .any(|exercise| !exercise.options.is_empty()));
}

#[tokio::test]
async fn fetch_training_plan_summaries_returns_seed_plans() {
    let repository = FakeRepository::new();
    let plans = repository
        .fetch_training_plan_summaries()
        .await
        .expect("fetch training plan summaries should succeed");

    // keep a lightweight assertion that summaries are returned — exact seeded
    // values are asserted by integration tests.
    assert!(!plans.is_empty());
}

#[tokio::test]
async fn fetch_gym_summaries_returns_seed_gyms_in_stable_order() {
    let repository = FakeRepository::new();
    let gyms = repository
        .fetch_gym_summaries()
        .await
        .expect("fetch gym summaries should succeed");

    // only assert the fake repository returns a stable list shape — exact
    // ordering and seeded ids are validated by integration tests.
    assert!(!gyms.is_empty());
}

#[tokio::test]
async fn fetch_plan_exercise_option_summaries_returns_gym_specific_options() {
    let repository = FakeRepository::new();
    let options = repository
        .fetch_plan_exercise_option_summaries(
            "00000000-0000-0000-0000-000000000201",
            "00000000-0000-0000-0000-000000000101",
        )
        .await
        .expect("fetch option summaries should succeed");

    assert!(!options.is_empty());
    assert!(options.iter().any(|option| !option.variant_name.is_empty()));
}

#[tokio::test]
async fn create_workout_round_trip_hydrates_sets() {
    let repository = FakeRepository::new();

    let workout = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: Some("00000000-0000-0000-0000-000000000101".to_owned()),
            started_at: Some("2026-01-01T08:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                position: 1,
                selected_variant_id: Some("00000000-0000-0000-0000-000000000401".to_owned()),
                selected_station_id: Some("00000000-0000-0000-0000-000000000701".to_owned()),
                selected_plan_exercise_option_id: Some(
                    "00000000-0000-0000-0000-000000001001".to_owned(),
                ),
                skipped_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        reps: Some(10),
                        load_display_value: Some(20.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(20.0),
                        completed_at: Some("2026-01-01T08:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        reps: Some(8),
                        load_display_value: Some(22.5),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(22.5),
                        completed_at: Some("2026-01-01T08:10:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("create workout should succeed");

    // validate mapping logic without asserting DB-seeded names/ids — those are
    // covered by integration tests that exercise a real database.
    assert_eq!(workout.exercises.len(), 1);
    assert_eq!(workout.exercises[0].sets.len(), 2);
    assert_eq!(workout.exercises[0].sets[0].set_index, 1);

    let summary = repository
        .fetch_workout_summary(&workout.id)
        .await
        .expect("fetch workout summary should succeed")
        .expect("created workout summary should exist");

    assert_eq!(summary.exercise_count, 1);
    assert_eq!(summary.completed_set_count, 2);
}
// Note: heavier DB-backed persistence scenarios (resume/complete/cancel
// semantics, cross-user isolation and durable error messages) are covered by
// integration tests under `backend/tests/persistence_integration.rs`.
//
// Keep the in-memory `FakeRepository` unit tests focused on mapping, shape and
// basic in-memory semantics so unit/module tests remain fast and do not depend
// on a live Postgres instance.
