#[tokio::test]
async fn workout_write_and_read_paths_round_trip() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-15T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-15T09:35:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(10),
                        load_display_value: Some(20.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(20.0),
                        completed_at: Some("2026-01-15T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(8),
                        load_display_value: Some(22.5),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(22.5),
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
    assert_eq!(fetched.exercises[0].sets[1].load_display_value, Some(22.5));

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
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-16T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-16T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                    position: 1,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: None,
                        load_display_value: Some(20.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(20.0),
                        completed_at: Some("2026-01-16T09:05:00Z".to_owned()),
                    }],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000008".to_owned(),
                    position: 2,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: None,
                        load_display_value: Some(22.5),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(22.5),
                        completed_at: Some("2026-01-16T09:10:00Z".to_owned()),
                    }],
                },
            ],
        })
        .await
        .expect("workout create should succeed");

    assert_eq!(
        created.training_plan_id,
        "30000000-0000-0000-0000-000000000002"
    );
    assert_eq!(
        created.gym_id.as_deref(),
        Some("50000000-0000-0000-0000-000000000001")
    );
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
    assert!(created.exercises.iter().all(|exercise| exercise
        .selected_training_plan_exercise_variant_id
        .is_none()));

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
            selected_training_plan_exercise_variant_id::text AS selected_training_plan_exercise_variant_id,
            performance_score
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
                .get::<Option<String>, _>("selected_training_plan_exercise_variant_id")
                .is_none()
            && row.get::<Option<i32>, _>("performance_score").is_none()
    }));
}

#[tokio::test]
async fn free_mode_workout_persists_null_gym_and_remains_readable() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: None,
            started_at: Some("2026-01-17T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-17T09:15:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
                    completed_at: Some("2026-01-17T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("free-mode workout create should succeed");

    assert_eq!(created.gym_id, None);
    assert!(created.exercises[0].selected_variant_id.is_none());
    assert!(created.exercises[0].selected_station_id.is_none());
    assert!(created.exercises[0]
        .selected_training_plan_exercise_variant_id
        .is_none());

    let persisted_gym_id =
        sqlx::query("SELECT gym_id::text AS gym_id FROM workouts WHERE id = $1::uuid")
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
    assert_eq!(fetched.gym_id, None);

    let summary = repository
        .fetch_workout_summary(&created.id)
        .await
        .expect("free-mode summary fetch should succeed")
        .expect("free-mode summary should exist");
    assert_eq!(summary.gym_id, None);
    assert_eq!(summary.gym_name, None);
}

#[tokio::test]
async fn create_workout_tolerates_malformed_optional_selection_uuids() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-18T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-18T09:15:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("not-a-uuid".to_owned()),
                selected_station_id: Some("also-not-a-uuid".to_owned()),
                selected_training_plan_exercise_variant_id: Some("still-not-a-uuid".to_owned()),
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
                    completed_at: Some("2026-01-18T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("workout create should tolerate malformed optional selection ids");

    assert_eq!(created.exercises.len(), 1);
    assert!(created.exercises[0].selected_variant_id.is_none());
    assert!(created.exercises[0].selected_station_id.is_none());
    assert!(created.exercises[0]
        .selected_training_plan_exercise_variant_id
        .is_none());
}

#[tokio::test]
async fn free_mode_active_workout_persists_null_gym_and_can_resume() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: None,
            started_at: Some("2026-02-04T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
                    completed_at: Some("2026-02-04T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("free-mode active workout create should succeed");

    assert_eq!(created.gym_id, None);
    assert_eq!(created.gym_name, None);

    let persisted_gym_id =
        sqlx::query("SELECT gym_id::text AS gym_id FROM workouts WHERE id = $1::uuid")
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
    assert_eq!(resumed.gym_id, None);
    assert_eq!(resumed.gym_name, None);
    assert_eq!(resumed.exercises[0].selected_variant_id, None);
    assert_eq!(resumed.exercises[0].selected_station_id, None);
    assert_eq!(
        resumed.exercises[0].selected_training_plan_exercise_variant_id,
        None
    );
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

    let assert_station_snapshot = |workout: &pumpbuddy_backend::domain::ActiveWorkout,
                                   position: i32,
                                   expected_station_id: &str,
                                   expected_station_name: &str| {
        let exercise = workout
            .exercises
            .iter()
            .find(|exercise| exercise.position == position)
            .expect("exercise should exist at expected position");
        assert_eq!(
            exercise.selected_station_id.as_deref(),
            Some(expected_station_id)
        );
        assert_eq!(
            exercise.selected_station_name.as_deref(),
            Some(expected_station_name)
        );
    };

    assert_eq!(created.exercises.len(), 6);
    assert_eq!(created.current_exercise_position, 1);
    assert_eq!(created.total_exercise_count, 6);
    assert_eq!(created.exercises[0].completed_sets.len(), 1);
    assert_eq!(created.exercises[0].completed_sets[0].set_index, 1);
    assert_eq!(created.exercises[0].suggested_set.load_value, 20.0);
    assert_eq!(
        created.exercises[0].suggested_set.repetition_value,
        Some(10)
    );
    assert!(created.exercises[1].completed_sets.is_empty());
    let initial_exercise_one_id: String = sqlx::query(
        "SELECT id::text AS id
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND position = 1",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("initial exercise row query should succeed")
    .get("id");
    let initial_exercise_one_set_id: String = sqlx::query(
        "SELECT ws.id::text AS id
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         WHERE we.workout_id = $1::uuid
           AND we.position = 1
           AND ws.set_index = 1
           AND ws.set_side = 'BILATERAL'",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("initial set row query should succeed")
    .get("id");
    assert_station_snapshot(
        &created,
        1,
        "50000000-0000-0000-0000-000000000001",
        "Barbell Rack",
    );

    let resumed = repository
        .fetch_first_active_workout()
        .await
        .expect("active workout fetch should succeed")
        .expect("active workout should exist");
    assert_eq!(resumed.id, created.id);
    assert_eq!(resumed.current_exercise_position, 1);
    assert_station_snapshot(
        &resumed,
        1,
        "50000000-0000-0000-0000-000000000001",
        "Barbell Rack",
    );

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
                        training_plan_exercise_id: "32000000-0000-0000-0000-000000000008"
                            .to_owned(),
                        position: 2,
                        selected_variant_id: Some(
                            "20000000-0000-0000-0000-00000000000f".to_owned(),
                        ),
                        selected_station_id: Some(
                            "50000000-0000-0000-0000-000000000009".to_owned(),
                        ),
                        selected_training_plan_exercise_variant_id: Some(
                            "33000000-0000-0000-0000-000000000009".to_owned(),
                        ),
                        set_tracking_mode: None,
                        skipped_at: None,
                        completed_at: None,
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(8),
                            load_display_value: Some(22.5),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(22.5),
                            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
                        }],
                    },
                ],
            },
        )
        .await
        .expect("active workout update should succeed");

    assert_eq!(updated.exercises.len(), 6);
    assert_eq!(updated.current_exercise_position, 2);
    assert_eq!(updated.exercises[1].completed_sets.len(), 1);
    assert!((updated.exercises[1].suggested_set.load_value - 18.1436948).abs() < 1e-9);
    assert_eq!(updated.exercises[1].suggested_set.repetition_value, Some(8));
    assert_station_snapshot(
        &updated,
        1,
        "50000000-0000-0000-0000-000000000001",
        "Barbell Rack",
    );
    assert_station_snapshot(
        &updated,
        2,
        "50000000-0000-0000-0000-000000000009",
        "Left Cable Tower",
    );
    let updated_exercise_one_id: String = sqlx::query(
        "SELECT id::text AS id
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND position = 1",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("updated exercise row query should succeed")
    .get("id");
    let updated_exercise_one_set_id: String = sqlx::query(
        "SELECT ws.id::text AS id
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         WHERE we.workout_id = $1::uuid
           AND we.position = 1
           AND ws.set_index = 1
           AND ws.set_side = 'BILATERAL'",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("updated set row query should succeed")
    .get("id");
    assert_eq!(updated_exercise_one_id, initial_exercise_one_id);
    assert_eq!(updated_exercise_one_set_id, initial_exercise_one_set_id);

    let second_confirmed_exercise = NewWorkoutExercise {
        training_plan_exercise_id: "32000000-0000-0000-0000-000000000008".to_owned(),
        position: 2,
        selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
        selected_station_id: Some("50000000-0000-0000-0000-000000000006".to_owned()),
        selected_training_plan_exercise_variant_id: Some(
            "33000000-0000-0000-0000-000000000009".to_owned(),
        ),
        set_tracking_mode: None,
        skipped_at: None,
        completed_at: None,
        sets: vec![NewWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            repetition_value: Some(8),
            load_display_value: Some(22.5),
            load_display_unit: "kg".to_owned(),
            load_canonical_kg: Some(22.5),
            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
        }],
    };

    let first_active = repository
        .fetch_first_active_workout()
        .await
        .expect("first active workout query should succeed")
        .expect("an active workout should be returned");
    assert_eq!(first_active.id, created.id);
    assert_station_snapshot(
        &first_active,
        2,
        "50000000-0000-0000-0000-000000000009",
        "Left Cable Tower",
    );

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
                        training_plan_exercise_id: "32000000-0000-0000-0000-000000000009"
                            .to_owned(),
                        position: 3,
                        selected_variant_id: Some(
                            "20000000-0000-0000-0000-000000000010".to_owned(),
                        ),
                        selected_station_id: Some(
                            "50000000-0000-0000-0000-000000000009".to_owned(),
                        ),
                        selected_training_plan_exercise_variant_id: Some(
                            "33000000-0000-0000-0000-00000000000a".to_owned(),
                        ),
                        set_tracking_mode: None,
                        skipped_at: None,
                        completed_at: None,
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(12),
                            load_display_value: Some(25.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(25.0),
                            completed_at: Some("2026-02-01T09:20:00Z".to_owned()),
                        }],
                    },
                    NewWorkoutExercise {
                        training_plan_exercise_id: "32000000-0000-0000-0000-00000000000a"
                            .to_owned(),
                        position: 4,
                        selected_variant_id: Some(
                            "20000000-0000-0000-0000-000000000012".to_owned(),
                        ),
                        selected_station_id: Some(
                            "50000000-0000-0000-0000-000000000001".to_owned(),
                        ),
                        selected_training_plan_exercise_variant_id: Some(
                            "33000000-0000-0000-0000-00000000000c".to_owned(),
                        ),
                        set_tracking_mode: None,
                        skipped_at: None,
                        completed_at: None,
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(8),
                            load_display_value: Some(30.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(30.0),
                            completed_at: Some("2026-02-01T09:24:00Z".to_owned()),
                        }],
                    },
                    NewWorkoutExercise {
                        training_plan_exercise_id: "32000000-0000-0000-0000-00000000000b"
                            .to_owned(),
                        position: 5,
                        selected_variant_id: Some(
                            "20000000-0000-0000-0000-000000000014".to_owned(),
                        ),
                        selected_station_id: Some(
                            "50000000-0000-0000-0000-000000000009".to_owned(),
                        ),
                        selected_training_plan_exercise_variant_id: Some(
                            "33000000-0000-0000-0000-00000000000e".to_owned(),
                        ),
                        set_tracking_mode: None,
                        skipped_at: None,
                        completed_at: None,
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(12),
                            load_display_value: Some(35.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(35.0),
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

    let persisted_completed_station_id: Option<String> = sqlx::query(
        "SELECT selected_station_id::text AS selected_station_id
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND position = $2",
    )
    .bind(&created.id)
    .bind(2_i32)
    .fetch_one(&db.pool)
    .await
    .expect("completed workout station query should succeed")
    .get("selected_station_id");
    assert_eq!(
        persisted_completed_station_id.as_deref(),
        Some("50000000-0000-0000-0000-000000000006")
    );

    let completed = repository
        .fetch_active_workout(&created.id)
        .await
        .expect("active workout fetch after completion should succeed");
    assert!(completed.is_none());

    let second = repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-02T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: None,
                    load_display_value: Some(10.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(10.0),
                    completed_at: Some("2026-02-02T09:01:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("second unfinished workout should create after completion");

    let fallback_active = repository
        .fetch_first_active_workout()
        .await
        .expect("fallback active workout query should succeed")
        .expect("the second unfinished workout should remain active");
    assert_eq!(fallback_active.id, second.id);
}
