use super::{DomainRepository, PersistenceError};
use crate::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{env, sync::OnceLock};

fn test_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

fn active_workout_fixture() -> NewWorkout {
    NewWorkout {
        training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
        gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
        started_at: Some("2026-02-15T09:00:00Z".to_owned()),
        completed_at: None,
        current_exercise_position: Some(1),
        exercises: vec![NewWorkoutExercise {
            training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
            position: 1,
            selected_variant_id: Some("00000000-0000-0000-0000-000000000401".to_owned()),
            selected_station_id: Some("00000000-0000-0000-0000-000000000701".to_owned()),
            selected_plan_exercise_option_id: Some(
                "00000000-0000-0000-0000-000000001001".to_owned(),
            ),
            sets: vec![NewWorkoutSet {
                set_index: 1,
                reps: Some(10),
                load_display_value: 20.0,
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: 20.0,
                completed_at: Some("2026-02-15T09:05:00Z".to_owned()),
            }],
        }],
    }
}

async fn maybe_pool() -> Option<PgPool> {
    let database_url = env::var("TEST_DATABASE_URL")
        .ok()
        .or_else(|| env::var("DATABASE_URL").ok())?;

    PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .ok()
}

async fn schema_ready(pool: &PgPool) -> bool {
    match sqlx::query("SELECT to_regclass('public.training_plans')::text AS relation")
        .fetch_one(pool)
        .await
    {
        Ok(row) => {
            let relation: Option<String> = row.get("relation");
            relation.is_some()
        }
        Err(_) => false,
    }
}

#[tokio::test]
async fn fetch_training_plan_hydrates_exercises_and_options() {
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool);
    let plan = repository
        .fetch_training_plan("00000000-0000-0000-0000-000000000201")
        .await
        .expect("fetch training plan query should succeed")
        .expect("push day seed training plan should exist");

    assert_eq!(plan.name, "Push Day");
    assert_eq!(plan.exercises.len(), 5);
    assert!(plan
        .exercises
        .iter()
        .any(|exercise| !exercise.options.is_empty()));
}

#[tokio::test]
async fn fetch_training_plan_summaries_returns_seed_plans() {
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool);
    let plans = repository
        .fetch_training_plan_summaries()
        .await
        .expect("fetch training plan summaries should succeed");

    assert!(plans.len() >= 2);
    assert!(plans
        .iter()
        .any(|plan| plan.name == "Push Day" && plan.exercise_count == 5));
    assert!(plans
        .iter()
        .any(|plan| plan.name == "Pull Day" && plan.exercise_count == 5));
}

#[tokio::test]
async fn fetch_gym_summaries_returns_seed_gyms_in_stable_order() {
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool);
    let gyms = repository
        .fetch_gym_summaries()
        .await
        .expect("fetch gym summaries should succeed");

    assert_eq!(
        gyms,
        vec![
            crate::domain::GymSummary {
                id: "00000000-0000-0000-0000-000000000101".to_owned(),
                name: "Forge Downtown".to_owned(),
            },
            crate::domain::GymSummary {
                id: "00000000-0000-0000-0000-000000000102".to_owned(),
                name: "Iron Temple West".to_owned(),
            },
        ]
    );
}

#[tokio::test]
async fn fetch_plan_exercise_option_summaries_returns_gym_specific_options() {
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool);
    let options = repository
        .fetch_plan_exercise_option_summaries(
            "00000000-0000-0000-0000-000000000201",
            "00000000-0000-0000-0000-000000000101",
        )
        .await
        .expect("fetch option summaries should succeed");

    assert!(!options.is_empty());
    assert!(options
        .iter()
        .any(|option| option.exercise_position == 1 && !option.variant_name.is_empty()));
}

#[tokio::test]
async fn create_workout_round_trip_hydrates_sets() {
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool);

    let workout = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
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
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        reps: Some(10),
                        load_display_value: 20.0,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 20.0,
                        completed_at: Some("2026-01-01T08:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        reps: Some(8),
                        load_display_value: 22.5,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 22.5,
                        completed_at: Some("2026-01-01T08:10:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("create workout should succeed");

    assert_eq!(
        workout.training_plan_id,
        "00000000-0000-0000-0000-000000000201"
    );
    assert_eq!(workout.exercises.len(), 1);
    assert_eq!(workout.exercises[0].sets.len(), 2);
    assert_eq!(workout.exercises[0].sets[0].set_index, 1);
    assert_eq!(workout.exercises[0].sets[1].load_display_value, 22.5);

    let summary = repository
        .fetch_workout_summary(&workout.id)
        .await
        .expect("fetch workout summary should succeed")
        .expect("created workout summary should exist");

    assert_eq!(summary.training_plan_name, "Push Day");
    assert_eq!(summary.exercise_count, 1);
    assert_eq!(summary.completed_set_count, 2);
}

#[tokio::test]
async fn active_workout_repository_surfaces_conflict_and_not_found_states() {
    let _guard = test_lock().lock().await;
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool);
    let initial = active_workout_fixture();

    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("initial active workout should create");

    let conflict = repository
        .create_active_workout(&initial)
        .await
        .expect_err("second active workout should conflict");
    match conflict {
        PersistenceError::Conflict(message) => {
            assert_eq!(message, "An active workout already exists");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let resumed = repository
        .fetch_first_active_workout()
        .await
        .expect("active workout query should succeed")
        .expect("active workout should exist");
    assert_eq!(resumed.id, created.id);

    let missing_id = "00000000-0000-0000-0000-000000009999";

    let update_missing = repository
        .update_active_workout(missing_id, &initial)
        .await
        .expect_err("missing update should fail");
    match update_missing {
        PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let complete_missing = repository
        .complete_active_workout(
            missing_id,
            &NewWorkout {
                completed_at: Some("2026-02-15T09:25:00Z".to_owned()),
                ..initial.clone()
            },
        )
        .await
        .expect_err("missing completion should fail");
    match complete_missing {
        PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn cancel_active_workout_deletes_unfinished_records_and_rejects_completed_ones() {
    let _guard = test_lock().lock().await;
    let Some(pool) = maybe_pool().await else {
        return;
    };

    if !schema_ready(&pool).await {
        return;
    }

    let repository = DomainRepository::new(pool.clone());

    let created = repository
        .create_active_workout(&active_workout_fixture())
        .await
        .expect("active workout should create");

    repository
        .cancel_active_workout(&created.id)
        .await
        .expect("active workout cancel should succeed");

    assert!(repository
        .fetch_active_workout(&created.id)
        .await
        .expect("active workout fetch should succeed")
        .is_none());

    let persisted_count: i64 =
        sqlx::query("SELECT COUNT(*)::bigint AS count FROM workouts WHERE id = $1::uuid")
            .bind(&created.id)
            .fetch_one(&pool)
            .await
            .expect("count query should succeed")
            .get("count");
    assert_eq!(persisted_count, 0);

    let completed = repository
        .create_workout(&NewWorkout {
            completed_at: Some("2026-02-16T09:20:00Z".to_owned()),
            current_exercise_position: None,
            ..active_workout_fixture()
        })
        .await
        .expect("completed workout should create");

    let cancel_completed = repository
        .cancel_active_workout(&completed.id)
        .await
        .expect_err("completed workout cancel should fail");
    match cancel_completed {
        PersistenceError::Conflict(message) => {
            assert_eq!(message, "Completed workouts cannot be cancelled");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let cancel_missing = repository
        .cancel_active_workout("00000000-0000-0000-0000-000000009999")
        .await
        .expect_err("missing workout cancel should fail");
    match cancel_missing {
        PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }
}
