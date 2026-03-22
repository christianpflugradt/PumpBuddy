mod support;

use self::support::{active_workout_fixture, test_lock, TestDatabase};
use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use pumpbuddy_backend::persistence::DomainRepository;
use sqlx::Row;
use std::collections::HashMap;

#[tokio::test]
async fn seed_invariants_match_pb004_requirements() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;

    let gym_count: i64 = sqlx::query("SELECT COUNT(*)::bigint AS count FROM gyms")
        .fetch_one(pool)
        .await
        .expect("gym count query should succeed")
        .get("count");
    assert_eq!(gym_count, 2);

    let plan_rows = sqlx::query(
        "SELECT tp.name, COUNT(tpe.id)::bigint AS exercise_count
         FROM training_plans tp
         LEFT JOIN training_plan_versions tpv ON tpv.training_plan_id = tp.id
         LEFT JOIN training_plan_exercises tpe ON tpe.training_plan_version_id = tpv.id
         GROUP BY tp.name
         ORDER BY tp.name ASC",
    )
    .fetch_all(pool)
    .await
    .expect("training plan query should succeed");

    let plan_counts: HashMap<String, i64> = plan_rows
        .into_iter()
        .map(|row| (row.get("name"), row.get("exercise_count")))
        .collect();

    assert_eq!(plan_counts.len(), 2);
    assert_eq!(plan_counts.get("Push Day"), Some(&5));
    assert_eq!(plan_counts.get("Pull Day"), Some(&5));

    let multi_variant_rows = sqlx::query(
        "SELECT tp.name, COUNT(*)::bigint AS multi_variant_exercise_count
         FROM (
             SELECT tpv.training_plan_id, tpe.id
             FROM training_plan_exercises tpe
             JOIN training_plan_versions tpv ON tpv.id = tpe.training_plan_version_id
             JOIN plan_exercise_options peo ON peo.training_plan_exercise_id = tpe.id
             GROUP BY tpv.training_plan_id, tpe.id
             HAVING COUNT(DISTINCT peo.exercise_variant_id) >= 2
         ) x
         JOIN training_plans tp ON tp.id = x.training_plan_id
         GROUP BY tp.name
         ORDER BY tp.name ASC",
    )
    .fetch_all(pool)
    .await
    .expect("multi-variant query should succeed");

    let multi_variant_counts: HashMap<String, i64> = multi_variant_rows
        .into_iter()
        .map(|row| (row.get("name"), row.get("multi_variant_exercise_count")))
        .collect();

    assert!(
        multi_variant_counts
            .get("Push Day")
            .copied()
            .unwrap_or_default()
            >= 2
    );
    assert!(
        multi_variant_counts
            .get("Pull Day")
            .copied()
            .unwrap_or_default()
            >= 2
    );

    let option_diff_rows = sqlx::query(
        "SELECT
            gym_id::text AS gym_id,
            string_agg(exercise_variant_id::text, ',' ORDER BY exercise_variant_id::text) AS variants
         FROM plan_exercise_options
         WHERE training_plan_exercise_id = $1::uuid
         GROUP BY gym_id
         ORDER BY gym_id ASC",
    )
    .bind("00000000-0000-0000-0000-000000000803")
    .fetch_all(pool)
    .await
    .expect("gym option diff query should succeed");

    assert_eq!(option_diff_rows.len(), 2);
    let downtown_variants: String = option_diff_rows[0].get("variants");
    let west_variants: String = option_diff_rows[1].get("variants");
    assert_ne!(downtown_variants, west_variants);
}

#[tokio::test]
async fn active_workout_cross_user_update_and_complete_return_not_found() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();

    // create the active workout under user A
    let user_a = "00000000-0000-0000-0000-000000000011";
    let user_b = "00000000-0000-0000-0000-000000000012";

    let created = repository
        .create_active_workout_for_user(&initial, user_a)
        .await
        .expect("active workout create should succeed for user A");

    // cross-user update should return NotFound and must not modify the workout
    let update_err = repository
        .update_active_workout_for_user(&created.id, &initial, user_b)
        .await
        .expect_err("cross-user update should fail with NotFound");

    match update_err {
        pumpbuddy_backend::persistence::PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    // cross-user complete should return NotFound and must not mark the workout completed
    let complete_err = repository
        .complete_active_workout_for_user(&created.id, &initial, user_b)
        .await
        .expect_err("cross-user complete should fail with NotFound");

    match complete_err {
        pumpbuddy_backend::persistence::PersistenceError::NotFound(message) => {
            // completion path returns Workout not found when summary fetch fails
            assert_eq!(message, "Workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn option_read_path_is_gym_specific() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let downtown_options = repository
        .fetch_plan_exercise_option_summaries(
            "00000000-0000-0000-0000-000000000201",
            "00000000-0000-0000-0000-000000000101",
        )
        .await
        .expect("downtown option query should succeed");
    let west_options = repository
        .fetch_plan_exercise_option_summaries(
            "00000000-0000-0000-0000-000000000201",
            "00000000-0000-0000-0000-000000000102",
        )
        .await
        .expect("west option query should succeed");

    assert!(!downtown_options.is_empty());
    assert!(!west_options.is_empty());

    let downtown_ex3 = downtown_options
        .iter()
        .filter(|option| option.exercise_position == 3)
        .count();
    let west_ex3 = west_options
        .iter()
        .filter(|option| option.exercise_position == 3)
        .count();

    assert_eq!(downtown_ex3, 2);
    assert_eq!(west_ex3, 1);
}

#[tokio::test]
async fn gyms_read_path_returns_seeded_summaries_in_stable_order() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let gyms = repository
        .fetch_gym_summaries()
        .await
        .expect("gym summaries query should succeed");

    let gym_names: Vec<&str> = gyms.iter().map(|gym| gym.name.as_str()).collect();
    assert_eq!(gym_names, vec!["Forge Downtown", "Iron Temple West"]);
    assert_eq!(gyms[0].id, "00000000-0000-0000-0000-000000000101");
    assert_eq!(gyms[1].id, "00000000-0000-0000-0000-000000000102");
}

#[tokio::test]
async fn workout_write_and_read_paths_round_trip() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-01-15T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-15T09:35:00Z".to_owned()),
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
                        completed_at: Some("2026-01-15T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        reps: Some(8),
                        load_display_value: 22.5,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 22.5,
                        completed_at: Some("2026-01-15T09:10:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("workout create should succeed");

    let fetched = repository
        .fetch_workout(&created.id)
        .await
        .expect("workout fetch should succeed")
        .expect("created workout should exist");
    assert_eq!(fetched.exercises.len(), 1);
    assert_eq!(fetched.exercises[0].sets.len(), 2);
    assert_eq!(fetched.exercises[0].sets[1].load_display_value, 22.5);

    let summary = repository
        .fetch_workout_summary(&created.id)
        .await
        .expect("summary fetch should succeed")
        .expect("summary should exist");
    assert_eq!(summary.training_plan_name, "Push Day");
    assert_eq!(summary.exercise_count, 1);
    assert_eq!(summary.completed_set_count, 2);
}

#[tokio::test]
async fn create_workout_persists_one_set_per_exercise_with_placeholder_nulls() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-01-16T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-16T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![
                NewWorkoutExercise {
                    training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                    position: 1,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_plan_exercise_option_id: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        reps: None,
                        load_display_value: 20.0,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 20.0,
                        completed_at: Some("2026-01-16T09:05:00Z".to_owned()),
                    }],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "00000000-0000-0000-0000-000000000802".to_owned(),
                    position: 2,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_plan_exercise_option_id: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        reps: None,
                        load_display_value: 22.5,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 22.5,
                        completed_at: Some("2026-01-16T09:10:00Z".to_owned()),
                    }],
                },
            ],
        })
        .await
        .expect("workout create should succeed");

    assert_eq!(
        created.training_plan_id,
        "00000000-0000-0000-0000-000000000201"
    );
    assert_eq!(created.gym_id, "00000000-0000-0000-0000-000000000101");
    assert_eq!(created.exercises.len(), 2);
    assert!(created
        .exercises
        .iter()
        .all(|exercise| exercise.sets.len() == 1));
    assert!(created
        .exercises
        .iter()
        .all(|exercise| exercise.selected_variant_id.is_none()));
    assert!(created
        .exercises
        .iter()
        .all(|exercise| exercise.selected_station_id.is_none()));
    assert!(created
        .exercises
        .iter()
        .all(|exercise| exercise.selected_plan_exercise_option_id.is_none()));

    let persisted_counts = sqlx::query(
        "SELECT
            COUNT(DISTINCT we.id)::bigint AS exercise_count,
            COUNT(ws.id)::bigint AS set_count
         FROM workout_exercises we
         LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         WHERE we.workout_id = $1::uuid",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("persisted counts query should succeed");

    let exercise_count: i64 = persisted_counts.get("exercise_count");
    let set_count: i64 = persisted_counts.get("set_count");
    assert_eq!(exercise_count, 2);
    assert_eq!(set_count, 2);

    let placeholder_rows = sqlx::query(
        "SELECT
            selected_variant_id::text AS selected_variant_id,
            selected_station_id::text AS selected_station_id,
            selected_plan_exercise_option_id::text AS selected_plan_exercise_option_id
         FROM workout_exercises
         WHERE workout_id = $1::uuid
         ORDER BY position ASC",
    )
    .bind(&created.id)
    .fetch_all(&db.pool)
    .await
    .expect("placeholder query should succeed");

    assert_eq!(placeholder_rows.len(), 2);
    assert!(placeholder_rows.iter().all(|row| {
        row.get::<Option<String>, _>("selected_variant_id")
            .is_none()
            && row
                .get::<Option<String>, _>("selected_station_id")
                .is_none()
            && row
                .get::<Option<String>, _>("selected_plan_exercise_option_id")
                .is_none()
    }));
}

#[tokio::test]
async fn free_mode_workout_persists_null_gym_and_remains_readable() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "".to_owned(),
            started_at: Some("2026-01-17T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-17T09:15:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_plan_exercise_option_id: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: Some(10),
                    load_display_value: 20.0,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: 20.0,
                    completed_at: Some("2026-01-17T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("free-mode workout create should succeed");

    assert_eq!(created.gym_id, "");
    assert!(created.exercises[0].selected_variant_id.is_none());
    assert!(created.exercises[0].selected_station_id.is_none());
    assert!(created.exercises[0].selected_plan_exercise_option_id.is_none());

    let persisted_gym_id = sqlx::query("SELECT gym_id::text AS gym_id FROM workouts WHERE id = $1::uuid")
        .bind(&created.id)
        .fetch_one(&db.pool)
        .await
        .expect("workout gym query should succeed")
        .get::<Option<String>, _>("gym_id");
    assert!(persisted_gym_id.is_none());

    let fetched = repository
        .fetch_workout(&created.id)
        .await
        .expect("free-mode workout fetch should succeed")
        .expect("created free-mode workout should exist");
    assert_eq!(fetched.gym_id, "");

    let summary = repository
        .fetch_workout_summary(&created.id)
        .await
        .expect("free-mode summary fetch should succeed")
        .expect("free-mode summary should exist");
    assert_eq!(summary.gym_id, "");
    assert_eq!(summary.gym_name, "");
}

#[tokio::test]
async fn free_mode_active_workout_persists_null_gym_and_can_resume() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "".to_owned(),
            started_at: Some("2026-02-04T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_plan_exercise_option_id: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: Some(10),
                    load_display_value: 20.0,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: 20.0,
                    completed_at: Some("2026-02-04T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("free-mode active workout create should succeed");

    assert_eq!(created.gym_id, "");
    assert_eq!(created.gym_name, "");

    let persisted_gym_id = sqlx::query("SELECT gym_id::text AS gym_id FROM workouts WHERE id = $1::uuid")
        .bind(&created.id)
        .fetch_one(&db.pool)
        .await
        .expect("active workout gym query should succeed")
        .get::<Option<String>, _>("gym_id");
    assert!(persisted_gym_id.is_none());

    let resumed = repository
        .fetch_first_active_workout()
        .await
        .expect("free-mode active workout fetch should succeed")
        .expect("free-mode active workout should exist");
    assert_eq!(resumed.id, created.id);
    assert_eq!(resumed.gym_id, "");
    assert_eq!(resumed.gym_name, "");
    assert_eq!(resumed.exercises[0].selected_variant_id, None);
    assert_eq!(resumed.exercises[0].selected_station_id, None);
    assert_eq!(resumed.exercises[0].selected_plan_exercise_option_id, None);
}

#[tokio::test]
async fn active_workout_persistence_supports_resume_and_completion() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();

    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("active workout create should succeed");

    assert_eq!(created.exercises.len(), 5);
    assert_eq!(created.current_exercise_position, 1);
    assert_eq!(created.total_exercise_count, 5);
    assert_eq!(created.exercises[0].completed_sets.len(), 1);
    assert_eq!(created.exercises[0].completed_sets[0].set_index, 1);
    assert_eq!(created.exercises[0].suggested_set.load_value, 20.0);
    assert_eq!(created.exercises[0].suggested_set.reps, Some(10));
    assert!(created.exercises[1].completed_sets.is_empty());

    let resumed = repository
        .fetch_first_active_workout()
        .await
        .expect("active workout fetch should succeed")
        .expect("active workout should exist");
    assert_eq!(resumed.id, created.id);
    assert_eq!(resumed.current_exercise_position, 1);

    let updated = repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                training_plan_id: initial.training_plan_id.clone(),
                gym_id: initial.gym_id.clone(),
                started_at: initial.started_at.clone(),
                completed_at: None,
                current_exercise_position: Some(2),
                exercises: vec![
                    initial.exercises[0].clone(),
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000802"
                            .to_owned(),
                        position: 2,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000403".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000703".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001003".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(8),
                            load_display_value: 22.5,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 22.5,
                            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
                        }],
                    },
                ],
            },
        )
        .await
        .expect("active workout update should succeed");

    assert_eq!(updated.exercises.len(), 5);
    assert_eq!(updated.current_exercise_position, 2);
    assert_eq!(updated.exercises[1].completed_sets.len(), 1);
    assert_eq!(updated.exercises[1].suggested_set.load_value, 22.5);
    assert_eq!(updated.exercises[1].suggested_set.reps, Some(8));

    let second_confirmed_exercise = NewWorkoutExercise {
        training_plan_exercise_id: "00000000-0000-0000-0000-000000000802".to_owned(),
        position: 2,
        selected_variant_id: Some("00000000-0000-0000-0000-000000000403".to_owned()),
        selected_station_id: Some("00000000-0000-0000-0000-000000000706".to_owned()),
        selected_plan_exercise_option_id: Some("00000000-0000-0000-0000-000000001003".to_owned()),
        sets: vec![NewWorkoutSet {
            set_index: 1,
            reps: Some(8),
            load_display_value: 22.5,
            load_display_unit: "kg".to_owned(),
            load_canonical_kg: 22.5,
            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
        }],
    };

    let second = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-02T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_plan_exercise_option_id: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: None,
                    load_display_value: 10.0,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: 10.0,
                    completed_at: Some("2026-02-02T09:01:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("second unfinished workout should create");

    let first_active = repository
        .fetch_first_active_workout()
        .await
        .expect("first active workout query should succeed")
        .expect("an active workout should be returned");
    assert_eq!(first_active.id, created.id);

    let completion_summary = repository
        .complete_active_workout(
            &created.id,
            &NewWorkout {
                training_plan_id: initial.training_plan_id.clone(),
                gym_id: initial.gym_id.clone(),
                started_at: initial.started_at.clone(),
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
                current_exercise_position: Some(3),
                exercises: vec![
                    initial.exercises[0].clone(),
                    second_confirmed_exercise,
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000803"
                            .to_owned(),
                        position: 3,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000404".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000703".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001005".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(12),
                            load_display_value: 25.0,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 25.0,
                            completed_at: Some("2026-02-01T09:20:00Z".to_owned()),
                        }],
                    },
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000804"
                            .to_owned(),
                        position: 4,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000406".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000701".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001008".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(8),
                            load_display_value: 30.0,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 30.0,
                            completed_at: Some("2026-02-01T09:24:00Z".to_owned()),
                        }],
                    },
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000805"
                            .to_owned(),
                        position: 5,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000408".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000703".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001011".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(12),
                            load_display_value: 35.0,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 35.0,
                            completed_at: Some("2026-02-01T09:28:00Z".to_owned()),
                        }],
                    },
                ],
            },
        )
        .await
        .expect("active workout completion should succeed");

    assert_eq!(completion_summary.id, created.id);
    assert!(completion_summary.completed_at.is_some());

    let completed = repository
        .fetch_active_workout(&created.id)
        .await
        .expect("active workout fetch after completion should succeed");
    assert!(completed.is_none());

    let fallback_active = repository
        .fetch_first_active_workout()
        .await
        .expect("fallback active workout query should succeed")
        .expect("the second unfinished workout should remain active");
    assert_eq!(fallback_active.id, second.id);
}

#[tokio::test]
async fn active_workout_update_and_completion_remain_immutable_when_newer_plan_version_exists() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();
    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("active workout create should succeed");

    let initial_version: String = sqlx::query(
        "SELECT training_plan_version_id::text AS training_plan_version_id
         FROM workouts
         WHERE id = $1::uuid",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("initial version query should succeed")
    .get("training_plan_version_id");

    let newer_version_id = "00000000-0000-0000-0000-000000009211";
    sqlx::query(
        "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind(newer_version_id)
    .bind(&initial.training_plan_id)
    .bind(2_i32)
    .bind("00000000-0000-0000-0000-000000000001")
    .execute(&db.pool)
    .await
    .expect("new plan version insert should succeed");
    assert_ne!(initial_version, newer_version_id);

    // Negative path: even when a newer training plan version exists, active-workout
    // update must keep the immutable original training_plan_version_id binding.
    repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                current_exercise_position: Some(2),
                exercises: vec![initial.exercises[0].clone()],
                ..initial.clone()
            },
        )
        .await
        .expect("active workout update should succeed");

    let version_after_update: String = sqlx::query(
        "SELECT training_plan_version_id::text AS training_plan_version_id
         FROM workouts
         WHERE id = $1::uuid",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("version query after update should succeed")
    .get("training_plan_version_id");
    assert_eq!(version_after_update, initial_version);

    repository
        .complete_active_workout(
            &created.id,
            &NewWorkout {
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
                current_exercise_position: Some(2),
                exercises: vec![initial.exercises[0].clone()],
                ..initial
            },
        )
        .await
        .expect("active workout completion should succeed");

    let version_after_completion: String = sqlx::query(
        "SELECT training_plan_version_id::text AS training_plan_version_id
         FROM workouts
         WHERE id = $1::uuid",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("version query after completion should succeed")
    .get("training_plan_version_id");
    assert_eq!(version_after_completion, initial_version);
}

#[tokio::test]
async fn active_workout_response_includes_completed_set_history_and_backend_suggestions() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-01-20T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-20T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000803".to_owned(),
                position: 3,
                selected_variant_id: Some("00000000-0000-0000-0000-000000000404".to_owned()),
                selected_station_id: Some("00000000-0000-0000-0000-000000000703".to_owned()),
                selected_plan_exercise_option_id: Some(
                    "00000000-0000-0000-0000-000000001005".to_owned(),
                ),
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: Some(12),
                    load_display_value: 25.0,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: 25.0,
                    completed_at: Some("2026-01-20T09:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("historical workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        reps: Some(10),
                        load_display_value: 20.0,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 20.0,
                        completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        reps: Some(8),
                        load_display_value: 22.5,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 22.5,
                        completed_at: Some("2026-02-01T09:08:00Z".to_owned()),
                    },
                ],
                ..active_workout_fixture().exercises[0].clone()
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    assert_eq!(created.exercises.len(), 5);

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 2);
    assert_eq!(first_exercise.completed_sets[0].set_index, 1);
    assert_eq!(first_exercise.completed_sets[1].set_index, 2);
    assert_eq!(first_exercise.completed_sets[1].load_value, 22.5);
    assert_eq!(first_exercise.suggested_set.load_value, 22.5);
    assert_eq!(first_exercise.suggested_set.reps, Some(8));

    let historical_suggestion = &created.exercises[2];
    assert!(historical_suggestion.completed_sets.is_empty());
    assert_eq!(historical_suggestion.suggested_set.load_value, 25.0);
    assert_eq!(historical_suggestion.suggested_set.reps, Some(12));

    let fallback_suggestion = &created.exercises[3];
    assert!(fallback_suggestion.completed_sets.is_empty());
    assert_eq!(fallback_suggestion.suggested_set.load_value, 10.0);
    assert_eq!(fallback_suggestion.suggested_set.reps, Some(10));
}

#[tokio::test]
async fn active_workout_create_update_complete_and_cancel_surface_durable_errors() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    let initial = active_workout_fixture();

    repository
        .create_active_workout(&initial)
        .await
        .expect("first active workout create should succeed");

    let create_conflict = repository
        .create_active_workout(&initial)
        .await
        .expect_err("second active workout create should fail");
    match create_conflict {
        pumpbuddy_backend::persistence::PersistenceError::Conflict(message) => {
            assert_eq!(message, "An active workout already exists");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let missing_workout_id = "00000000-0000-0000-0000-000000009999";

    let update_missing = repository
        .update_active_workout(missing_workout_id, &initial)
        .await
        .expect_err("updating a missing active workout should fail");
    match update_missing {
        pumpbuddy_backend::persistence::PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let complete_missing = repository
        .complete_active_workout(
            missing_workout_id,
            &NewWorkout {
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
                ..initial.clone()
            },
        )
        .await
        .expect_err("completing a missing active workout should fail");
    match complete_missing {
        pumpbuddy_backend::persistence::PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    let cancel_missing = repository
        .cancel_active_workout(missing_workout_id)
        .await
        .expect_err("cancelling a missing active workout should fail");
    match cancel_missing {
        pumpbuddy_backend::persistence::PersistenceError::NotFound(message) => {
            assert_eq!(message, "Active workout not found");
        }
        other => panic!("unexpected error: {other:?}"),
    }
}

#[tokio::test]
async fn active_workout_cancellation_deletes_persisted_records_and_rejects_completed_workouts() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            started_at: Some("2026-02-03T09:00:00Z".to_owned()),
            exercises: vec![NewWorkoutExercise {
                sets: vec![NewWorkoutSet {
                    completed_at: Some("2026-02-03T09:05:00Z".to_owned()),
                    ..active_workout_fixture().exercises[0].sets[0].clone()
                }],
                ..active_workout_fixture().exercises[0].clone()
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    repository
        .cancel_active_workout(&created.id)
        .await
        .expect("active workout cancel should succeed");

    let workout_count: i64 =
        sqlx::query("SELECT COUNT(*)::bigint AS count FROM workouts WHERE id = $1::uuid")
            .bind(&created.id)
            .fetch_one(&db.pool)
            .await
            .expect("workout count query should succeed")
            .get("count");
    assert_eq!(workout_count, 0);

    let exercise_count: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM workout_exercises
         WHERE workout_id = $1::uuid",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("exercise count query should succeed")
    .get("count");
    assert_eq!(exercise_count, 0);

    let set_count: i64 = sqlx::query(
        "SELECT COUNT(*)::bigint AS count
         FROM workout_sets
         WHERE workout_exercise_id IN (
            SELECT id FROM workout_exercises WHERE workout_id = $1::uuid
         )",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("set count query should succeed")
    .get("count");
    assert_eq!(set_count, 0);

    let completed = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-03T10:00:00Z".to_owned()),
            completed_at: Some("2026-02-03T10:05:00Z".to_owned()),
            current_exercise_position: None,
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
                    completed_at: Some("2026-02-03T10:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("completed workout create should succeed");

    let error = repository
        .cancel_active_workout(&completed.id)
        .await
        .expect_err("completed workout cancellation should fail");

    match error {
        pumpbuddy_backend::persistence::PersistenceError::Conflict(message) => {
            assert_eq!(message, "Completed workouts cannot be cancelled");
        }
        other => panic!("unexpected error: {other:?}"),
    }
}
