#[tokio::test]
async fn reps_gate_routes_fallback_per_exercise_without_blocking_eligible_progression() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    for index in 0..3 {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-2{}T08:00:00Z", index)),
                completed_at: Some(format!("2026-03-2{}T08:20:00Z", index)),
                current_exercise_position: None,
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
                        repetition_value: Some(7),
                        load_display_value: Some(30.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(30.0),
                        completed_at: Some(format!("2026-03-2{}T08:10:00Z", index)),
                    }],
                }],
            })
            .await
            .expect("ineligible-target historical workout should create");
    }

    for index in 3..5 {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-2{}T08:00:00Z", index)),
                completed_at: Some(format!("2026-03-2{}T08:20:00Z", index)),
                current_exercise_position: None,
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
                    sets: vec![],
                }],
            })
            .await
            .expect("ineligible-target uncovered workout should create");
    }

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-30T08:00:00Z".to_owned()),
            completed_at: Some("2026-03-30T08:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000008".to_owned(),
                position: 2,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000009".to_owned()),
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
                    completed_at: Some("2026-03-30T08:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("eligible historical workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-31T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![
                NewWorkoutExercise {
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
                    sets: vec![],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000008".to_owned(),
                    position: 2,
                    selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000009".to_owned()),
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000009".to_owned(),
                    ),
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![],
                },
            ],
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 30.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(7));

    let second_exercise = &created.exercises[1];
    assert!(second_exercise.completed_sets.is_empty());
    assert!((second_exercise.suggested_set.load_value - 18.1436948).abs() < 1e-9);
    assert_eq!(second_exercise.suggested_set.repetition_value, Some(8));
}

#[tokio::test]
async fn weighted_reps_progression_uses_three_five_window_for_loadless_options() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    sqlx::query(
        "UPDATE training_plan_exercise_variants
         SET rep_min = $1, rep_max = $2
         WHERE id = $3::uuid",
    )
    .bind(9_i32)
    .bind(11_i32)
    .bind("33000000-0000-0000-0000-000000000004")
    .execute(&db.pool)
    .await
    .expect("rep bounds update should succeed");

    let historical_reps = [6, 8, 10, 12, 14];
    for (index, reps) in historical_reps.into_iter().enumerate() {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-1{}T09:00:00Z", index)),
                completed_at: Some(format!("2026-03-1{}T09:20:00Z", index)),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                    position: 3,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000004".to_owned(),
                    ),
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(reps),
                        load_display_value: None,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: None,
                        completed_at: Some(format!("2026-03-1{}T09:10:00Z", index)),
                    }],
                }],
            })
            .await
            .expect("historical workout should create");
    }

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-20T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let nordic_curl = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 3)
        .expect("nordic curl exercise should exist");
    assert_eq!(nordic_curl.suggested_set.repetition_value, Some(11));
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn load_bearing_progression_promotes_profile_load_and_reduces_reps_after_increase() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "UPDATE training_plan_exercise_variants
         SET rep_min = $1, rep_max = $2
         WHERE id = $3::uuid",
    )
    .bind(8_i32)
    .bind(12_i32)
    .bind("33000000-0000-0000-0000-000000000008")
    .execute(&db.pool)
    .await
    .expect("rep bounds update should succeed");

    for index in 0..8 {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-0{}T08:00:00Z", index + 1)),
                completed_at: Some(format!("2026-03-0{}T08:20:00Z", index + 1)),
                current_exercise_position: None,
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
                        repetition_value: Some(12),
                        load_display_value: Some(30.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(30.0),
                        completed_at: Some(format!("2026-03-0{}T08:10:00Z", index + 1)),
                    }],
                }],
            })
            .await
            .expect("historical workout should create");
    }

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-20T09:00:00Z".to_owned()),
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
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(10));
    assert!((first_exercise.suggested_set.load_value - 32.5).abs() < 1e-9);
}

#[tokio::test]
async fn null_rep_bounds_disable_weighted_progression_and_keep_legacy_fallback() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    sqlx::query(
        "UPDATE training_plan_exercise_variants
         SET rep_min = NULL, rep_max = $1
         WHERE id = $2::uuid",
    )
    .bind(11_i32)
    .bind("33000000-0000-0000-0000-000000000004")
    .execute(&db.pool)
    .await
    .expect("rep bounds update should succeed");

    let historical_reps = [6, 8, 10, 12, 14];
    for (index, reps) in historical_reps.into_iter().enumerate() {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-2{}T09:00:00Z", index)),
                completed_at: Some(format!("2026-03-2{}T09:20:00Z", index)),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                    position: 3,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000004".to_owned(),
                    ),
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(reps),
                        load_display_value: None,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: None,
                        completed_at: Some(format!("2026-03-2{}T09:10:00Z", index)),
                    }],
                }],
            })
            .await
            .expect("historical workout should create");
    }

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-30T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let nordic_curl = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 3)
        .expect("nordic curl exercise should exist");
    assert_eq!(nordic_curl.suggested_set.repetition_value, Some(14));
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn stationless_history_uses_latest_reps_for_nordic_curl_suggestion() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-01T09:00:00Z".to_owned()),
            completed_at: Some("2026-03-01T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(11),
                    load_display_value: None,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: None,
                    completed_at: Some("2026-03-01T09:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("stationless historical workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-02T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("stationless active workout create should succeed");

    let nordic_curl = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 3)
        .expect("nordic curl exercise should exist");
    assert!(nordic_curl.completed_sets.is_empty());
    assert_eq!(nordic_curl.suggested_set.repetition_value, Some(11));
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn stationless_last_current_reuses_reps_when_next_set_is_suggested() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-03T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(9),
                    load_display_value: None,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: None,
                    completed_at: Some("2026-03-03T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("stationless active workout create should succeed");

    let nordic_curl = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 3)
        .expect("nordic curl exercise should exist");
    assert_eq!(nordic_curl.completed_sets.len(), 1);
    assert_eq!(nordic_curl.suggested_set.repetition_value, Some(9));
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn stationless_prior_set_lookup_ignores_other_plan_versions() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    let cross_version = repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-01T09:00:00Z".to_owned()),
            completed_at: Some("2026-03-01T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(30),
                    load_display_value: None,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: None,
                    completed_at: Some("2026-03-01T09:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("cross-version workout should create");

    sqlx::query(
        "UPDATE workouts
         SET training_plan_version_id = $1::uuid
         WHERE id = $2::uuid",
    )
    .bind("31000000-0000-0000-0000-000000000002")
    .bind(&cross_version.id)
    .execute(&db.pool)
    .await
    .expect("training_plan_version update should succeed");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-02T09:00:00Z".to_owned()),
            completed_at: Some("2026-03-02T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(11),
                    load_display_value: None,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: None,
                    completed_at: Some("2026-03-02T09:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("same-version workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-03T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000004".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let nordic_curl = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 3)
        .expect("nordic curl exercise should exist");
    assert_eq!(nordic_curl.suggested_set.repetition_value, Some(11));
}

#[tokio::test]
async fn stationless_secs_prior_set_uses_latest_matching_completed_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-04T09:00:00Z".to_owned()),
            completed_at: Some("2026-03-04T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                position: 6,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000005".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(75),
                    load_display_value: None,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: None,
                    completed_at: Some("2026-03-04T09:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("stationless secs history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-05T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(6),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                position: 6,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000005".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let plank = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 6)
        .expect("plank exercise should exist");
    assert_eq!(plank.suggested_set.repetition_value, Some(75));
}

#[tokio::test]
async fn stationless_secs_second_set_uses_latest_matching_completed_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-04T09:00:00Z".to_owned()),
            completed_at: Some("2026-03-04T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                position: 6,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000005".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(60),
                        load_display_value: None,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: None,
                        completed_at: Some("2026-03-04T09:10:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(50),
                        load_display_value: None,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: None,
                        completed_at: Some("2026-03-04T09:12:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 3,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(40),
                        load_display_value: None,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: None,
                        completed_at: Some("2026-03-04T09:14:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("stationless secs history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-05T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(6),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                position: 6,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000005".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_value: Some(62),
                    load_display_value: None,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: None,
                    completed_at: Some("2026-03-05T09:10:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let plank = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 6)
        .expect("plank exercise should exist");
    assert_eq!(plank.suggested_set.set_index, 2);
    assert_eq!(plank.suggested_set.repetition_value, Some(50));
}

#[tokio::test]
async fn secs_variant_suggestion_omits_repetition_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    clear_user_workout_history(&db.pool, DEV_USER_ID).await;

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-03-04T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(6),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                position: 6,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000005".to_owned(),
                ),
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed for secs variant");

    let plank = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 6)
        .expect("plank exercise should exist");
    assert!(plank.completed_sets.is_empty());
    assert_eq!(plank.suggested_set.repetition_value, None);
    assert_eq!(plank.suggested_set.load_value, 10.0);
}
