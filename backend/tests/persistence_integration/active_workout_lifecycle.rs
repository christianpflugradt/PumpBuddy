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
async fn active_workout_progress_does_not_autocomplete_current_exercise_or_delete_omitted_rows() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();
    let created = repository
        .create_active_workout(&NewWorkout {
            current_exercise_position: Some(2),
            exercises: vec![
                initial.exercises[0].clone(),
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
            ..initial.clone()
        })
        .await
        .expect("active workout create should succeed");

    let created_rows = sqlx::query(
        "SELECT position, completed_at IS NULL AS completion_is_null
         FROM workout_exercises
         WHERE workout_id = $1::uuid
         ORDER BY position ASC",
    )
    .bind(&created.id)
    .fetch_all(&db.pool)
    .await
    .expect("created exercise query should succeed");
    assert_eq!(created_rows.len(), 2);
    assert!(
        !created_rows[0].get::<bool, _>("completion_is_null"),
        "position 1 should be completed immediately when the active cursor starts at position 2"
    );
    assert!(
        created_rows[1].get::<bool, _>("completion_is_null"),
        "position 2 should remain incomplete while it is the active exercise"
    );

    repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                current_exercise_position: Some(2),
                exercises: vec![initial.exercises[0].clone()],
                ..initial
            },
        )
        .await
        .expect("active workout update should succeed");

    let merged_rows = sqlx::query(
        "SELECT position,
                completed_at IS NOT NULL AS completion_is_present
         FROM workout_exercises
         WHERE workout_id = $1::uuid
         ORDER BY position ASC",
    )
    .bind(&created.id)
    .fetch_all(&db.pool)
    .await
    .expect("merged exercise query should succeed");
    assert_eq!(merged_rows.len(), 2);

    assert!(
        merged_rows[0].get::<bool, _>("completion_is_present"),
        "position 1 should complete when the active cursor moves past it"
    );

    assert!(
        !merged_rows[1].get::<bool, _>("completion_is_present"),
        "position 2 should remain incomplete while it is still the active exercise"
    );
}

#[tokio::test]
async fn reopening_previous_exercise_clears_and_rewrites_exercise_completion_timestamp() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();
    let second_pending_exercise = NewWorkoutExercise {
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
    };
    let created = repository
        .create_active_workout(&NewWorkout {
            current_exercise_position: Some(2),
            exercises: vec![
                initial.exercises[0].clone(),
                second_pending_exercise.clone(),
            ],
            ..initial.clone()
        })
        .await
        .expect("active workout create should succeed");

    let original_completion: String = sqlx::query(
        "SELECT completed_at::text AS completed_at
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND position = 1",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("original completion query should succeed")
    .get("completed_at");

    repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                current_exercise_position: Some(1),
                exercises: vec![
                    NewWorkoutExercise {
                        completed_at: None,
                        ..initial.exercises[0].clone()
                    },
                    second_pending_exercise.clone(),
                ],
                ..initial.clone()
            },
        )
        .await
        .expect("reopen previous exercise update should succeed");

    let cleared_on_reopen: bool = sqlx::query(
        "SELECT completed_at IS NULL AS cleared
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND position = 1",
    )
    .bind(&created.id)
    .fetch_one(&db.pool)
    .await
    .expect("cleared completion query should succeed")
    .get("cleared");
    assert!(
        cleared_on_reopen,
        "reopened previous exercise should clear its completion marker"
    );

    repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                current_exercise_position: Some(2),
                exercises: vec![
                    NewWorkoutExercise {
                        completed_at: None,
                        sets: vec![
                            initial.exercises[0].sets[0].clone(),
                            NewWorkoutSet {
                                set_index: 2,
                                set_side: "BILATERAL".to_owned(),
                                repetition_value: Some(4),
                                load_display_value: Some(42.0),
                                load_display_unit: "kg".to_owned(),
                                load_canonical_kg: Some(42.0),
                                completed_at: Some("2026-02-01T09:20:00Z".to_owned()),
                            },
                        ],
                        ..initial.exercises[0].clone()
                    },
                    second_pending_exercise,
                ],
                ..initial
            },
        )
        .await
        .expect("reconfirming reopened exercise should succeed");

    let rewritten_after_reconfirm: bool = sqlx::query(
        "SELECT completed_at > $2::timestamptz AS rewritten
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND position = 1",
    )
    .bind(&created.id)
    .bind(&original_completion)
    .fetch_one(&db.pool)
    .await
    .expect("rewritten completion query should succeed")
    .get("rewritten");
    assert!(
        rewritten_after_reconfirm,
        "reconfirming the reopened exercise should write a newer completion timestamp"
    );
}

#[tokio::test]
async fn active_workout_completion_writes_deterministic_performance_scores_only_on_completion() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let build_payload =
        |completed_at: Option<&str>, exercise_completed_at: Option<&str>| NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-11T09:00:00Z".to_owned()),
            completed_at: completed_at.map(str::to_owned),
            current_exercise_position: Some(4),
            exercises: vec![
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000001".to_owned(),
                    position: 1,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000001".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000001".to_owned(),
                    ),
                    set_tracking_mode: Some("BILATERAL".to_owned()),
                    skipped_at: None,
                    completed_at: exercise_completed_at.map(str::to_owned),
                    sets: vec![
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(5),
                            load_display_value: Some(40.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(40.0),
                            completed_at: Some("2026-02-11T09:05:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 2,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(4),
                            load_display_value: Some(42.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(42.0),
                            completed_at: Some("2026-02-11T09:06:00Z".to_owned()),
                        },
                    ],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                    position: 2,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000005".to_owned(),
                    ),
                    set_tracking_mode: Some("BILATERAL".to_owned()),
                    skipped_at: None,
                    completed_at: exercise_completed_at.map(str::to_owned),
                    sets: vec![
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(30),
                            load_display_value: Some(12.5),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(12.5),
                            completed_at: Some("2026-02-11T09:10:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 2,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(20),
                            load_display_value: Some(7.5),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(7.5),
                            completed_at: Some("2026-02-11T09:11:00Z".to_owned()),
                        },
                    ],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000004".to_owned(),
                    position: 3,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000016".to_owned()),
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000004".to_owned(),
                    ),
                    set_tracking_mode: Some("BILATERAL".to_owned()),
                    skipped_at: None,
                    completed_at: exercise_completed_at.map(str::to_owned),
                    sets: vec![
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(12),
                            load_display_value: None,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: None,
                            completed_at: Some("2026-02-11T09:16:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 2,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(10),
                            load_display_value: None,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: None,
                            completed_at: Some("2026-02-11T09:17:00Z".to_owned()),
                        },
                    ],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000005".to_owned(),
                    position: 4,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000004".to_owned()),
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000005".to_owned(),
                    ),
                    set_tracking_mode: Some("BILATERAL".to_owned()),
                    skipped_at: None,
                    completed_at: exercise_completed_at.map(str::to_owned),
                    sets: vec![
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(45),
                            load_display_value: None,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: None,
                            completed_at: Some("2026-02-11T09:20:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 2,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(30),
                            load_display_value: None,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: None,
                            completed_at: Some("2026-02-11T09:21:00Z".to_owned()),
                        },
                    ],
                },
            ],
        };

    let created = repository
        .create_active_workout(&build_payload(None, None))
        .await
        .expect("active workout create should succeed");

    repository
        .update_active_workout(&created.id, &build_payload(None, None))
        .await
        .expect("active workout update before completion should succeed");

    let pre_completion_rows = sqlx::query(
        "SELECT position, performance_score
         FROM workout_exercises
         WHERE workout_id = $1::uuid
         ORDER BY position ASC",
    )
    .bind(&created.id)
    .fetch_all(&db.pool)
    .await
    .expect("pre-completion score query should succeed");
    assert_eq!(pre_completion_rows.len(), 4);
    assert!(pre_completion_rows
        .iter()
        .all(|row| row.get::<Option<i32>, _>("performance_score").is_none()));

    let completed = repository
        .complete_active_workout(
            &created.id,
            &build_payload(Some("2026-02-11T09:30:00Z"), None),
        )
        .await
        .expect("active workout completion should succeed");
    assert_eq!(completed.id, created.id);
    assert!(completed.completed_at.is_some());

    let completed_rows = sqlx::query(
        "SELECT position, performance_score
         FROM workout_exercises
         WHERE workout_id = $1::uuid
         ORDER BY position ASC",
    )
    .bind(&created.id)
    .fetch_all(&db.pool)
    .await
    .expect("completed score query should succeed");
    assert_eq!(completed_rows.len(), 4);

    let scores_by_position: BTreeMap<i32, Option<i32>> = completed_rows
        .into_iter()
        .map(|row| {
            (
                row.get::<i32, _>("position"),
                row.get::<Option<i32>, _>("performance_score"),
            )
        })
        .collect();

    assert_eq!(scores_by_position.get(&1), Some(&Some(368))); // load*reps
    assert_eq!(scores_by_position.get(&2), Some(&Some(525))); // load*secs
    assert_eq!(scores_by_position.get(&3), Some(&Some(22))); // total reps
    assert_eq!(scores_by_position.get(&4), Some(&Some(75))); // total secs
}

#[tokio::test]
async fn historical_baseline_lookup_uses_variant_and_station_keys_and_returns_max_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-10T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                10,
                12.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("exact-key historical workout should create");

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-15T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                15,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("newer exact-key historical workout should create");

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-12T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000002"),
                "33000000-0000-0000-0000-000000000001",
                30,
                20.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("station-mismatched historical workout should create");

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-12T10:00:00Z",
                "20000000-0000-0000-0000-000000000004",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000005",
                30,
                20.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("variant-mismatched historical workout should create");

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-01-10T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                50,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("out-of-window historical workout should create");

    let current = repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-20T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                8,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("current workout should create");

    let baseline_by_exercise_id = repository
        .fetch_historical_baseline_max_by_workout_exercise_for_user(&current.id, DEV_USER_ID)
        .await
        .expect("baseline lookup should succeed");

    assert_eq!(baseline_by_exercise_id.len(), 1);
    assert_eq!(
        baseline_by_exercise_id.get(&current.exercises[0].id),
        Some(&150),
        "baseline should be max exact-key value within the 30-day lookback"
    );
}

#[tokio::test]
async fn historical_baseline_lookup_uses_inclusive_lower_and_exclusive_upper_time_bounds() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-01-30T12:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                12,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("lower-bound historical workout should create");

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-01-30T11:59:59Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                40,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("out-of-window-by-one-second historical workout should create");

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-03-01T12:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                30,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("same-timestamp historical workout should create");

    let current = repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-03-01T12:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                5,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("current workout should create");

    let baseline_by_exercise_id = repository
        .fetch_historical_baseline_max_by_workout_exercise_for_user(&current.id, DEV_USER_ID)
        .await
        .expect("baseline lookup should succeed");

    assert_eq!(baseline_by_exercise_id.len(), 1);
    assert_eq!(
        baseline_by_exercise_id.get(&current.exercises[0].id),
        Some(&120),
        "baseline should include exactly 30-days-prior rows and exclude rows at or after evaluation time"
    );
}

#[tokio::test]
async fn workout_summary_progress_uses_clamped_average_and_strict_majority_coverage() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-10T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                10,
                10.0,
            ),
            DEV_USER_ID,
        )
        .await
        .expect("historical baseline workout should create");

    let covered_current = repository
        .create_workout_for_user(
            &completed_four_exercise_workout_for_progress("2026-02-20T10:00:00Z", 3),
            DEV_USER_ID,
        )
        .await
        .expect("covered current workout should create");

    let covered_summary = repository
        .fetch_workout_summary_for_user(&covered_current.id, DEV_USER_ID)
        .await
        .expect("covered summary lookup should succeed")
        .expect("covered summary should exist");

    let expected = (1.20 + 0.70 + 1.00) / 3.0;
    let actual = covered_summary
        .workout_progress
        .expect("3/4 baseline coverage should expose workout progress");
    assert!((actual - expected).abs() < 1e-9);

    repository
        .create_workout_for_user(
            &completed_single_exercise_workout(
                "2026-02-10T10:00:00Z",
                "20000000-0000-0000-0000-000000000001",
                Some("50000000-0000-0000-0000-000000000001"),
                "33000000-0000-0000-0000-000000000001",
                10,
                10.0,
            ),
            USER_B_ID,
        )
        .await
        .expect("user-b historical baseline workout should create");

    let not_enough_data_current = repository
        .create_workout_for_user(
            &completed_four_exercise_workout_for_progress("2026-02-21T10:00:00Z", 2),
            USER_B_ID,
        )
        .await
        .expect("not-enough-data current workout should create");

    let not_enough_data_summary = repository
        .fetch_workout_summary_for_user(&not_enough_data_current.id, USER_B_ID)
        .await
        .expect("not-enough-data summary lookup should succeed")
        .expect("not-enough-data summary should exist");
    assert!(
        not_enough_data_summary.workout_progress.is_none(),
        "2/4 baseline coverage must fail strict-majority gate"
    );
}

#[tokio::test]
async fn active_workout_selection_consistency_persists_through_completion_history_projection() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();
    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("active workout create should succeed");

    repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
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
                ..initial.clone()
            },
        )
        .await
        .expect("active workout update should succeed");

    repository
        .complete_active_workout(
            &created.id,
            &NewWorkout {
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
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
                ..initial
            },
        )
        .await
        .expect("active workout completion should succeed");

    let completed_projection = repository
        .fetch_workout(&created.id)
        .await
        .expect("completed workout projection should fetch")
        .expect("completed workout should exist");
    assert_eq!(completed_projection.exercises.len(), 2);

    let second_exercise = completed_projection
        .exercises
        .iter()
        .find(|exercise| exercise.position == 2)
        .expect("second exercise should be present in completed projection");

    assert_eq!(
        second_exercise
            .selected_training_plan_exercise_variant_id
            .as_deref(),
        Some("33000000-0000-0000-0000-000000000009")
    );
    assert_eq!(
        second_exercise.selected_variant_id.as_deref(),
        Some("20000000-0000-0000-0000-00000000000f")
    );
    assert_eq!(
        second_exercise.selected_station_id.as_deref(),
        Some("50000000-0000-0000-0000-000000000009")
    );
}

#[tokio::test]
async fn completing_new_exercise_preserves_existing_completed_timestamps_for_other_rows() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let initial = active_workout_fixture();
    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("active workout create should succeed");

    let first_completed_exercise = NewWorkoutExercise {
        completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
        sets: vec![NewWorkoutSet {
            completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
            ..initial.exercises[0].sets[0].clone()
        }],
        ..initial.exercises[0].clone()
    };
    let second_pending_exercise = NewWorkoutExercise {
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
    };

    repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                current_exercise_position: Some(2),
                exercises: vec![
                    first_completed_exercise.clone(),
                    second_pending_exercise.clone(),
                ],
                ..initial.clone()
            },
        )
        .await
        .expect("active workout update should succeed");

    repository
        .complete_active_workout(
            &created.id,
            &NewWorkout {
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
                current_exercise_position: Some(2),
                exercises: vec![
                    NewWorkoutExercise {
                        completed_at: None,
                        sets: vec![NewWorkoutSet {
                            completed_at: None,
                            ..first_completed_exercise.sets[0].clone()
                        }],
                        ..first_completed_exercise
                    },
                    NewWorkoutExercise {
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            set_side: "BILATERAL".to_owned(),
                            repetition_value: Some(8),
                            load_display_value: Some(22.5),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(22.5),
                            completed_at: Some("2026-02-01T09:20:00Z".to_owned()),
                        }],
                        ..second_pending_exercise
                    },
                ],
                ..initial
            },
        )
        .await
        .expect("active workout completion should succeed");

    let first_exercise_timestamp_preserved: bool = sqlx::query(
        "SELECT completed_at = $3::timestamptz AS preserved
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND user_id = $2::uuid
           AND position = 1",
    )
    .bind(&created.id)
    .bind(DEV_USER_ID)
    .bind("2026-02-01T09:05:00Z")
    .fetch_one(&db.pool)
    .await
    .expect("first exercise timestamp query should succeed")
    .get("preserved");
    assert!(
        first_exercise_timestamp_preserved,
        "position 1 workout_exercise completed_at should remain unchanged"
    );

    let first_set_timestamp_preserved: bool = sqlx::query(
        "SELECT ws.completed_at = $3::timestamptz AS preserved
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         WHERE we.workout_id = $1::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid
           AND we.position = 1
           AND ws.set_index = 1
           AND ws.set_side = 'BILATERAL'",
    )
    .bind(&created.id)
    .bind(DEV_USER_ID)
    .bind("2026-02-01T09:05:00Z")
    .fetch_one(&db.pool)
    .await
    .expect("first set timestamp query should succeed")
    .get("preserved");
    assert!(
        first_set_timestamp_preserved,
        "position 1 workout_set completed_at should remain unchanged"
    );

    let second_set_timestamp_persisted: bool = sqlx::query(
        "SELECT ws.completed_at = $3::timestamptz AS matches_expected
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         WHERE we.workout_id = $1::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid
           AND we.position = 2
           AND ws.set_index = 1
           AND ws.set_side = 'BILATERAL'",
    )
    .bind(&created.id)
    .bind(DEV_USER_ID)
    .bind("2026-02-01T09:20:00Z")
    .fetch_one(&db.pool)
    .await
    .expect("second set timestamp query should succeed")
    .get("matches_expected");
    assert!(
        second_set_timestamp_persisted,
        "newly completed position 2 workout_set should persist provided timestamp"
    );
}

#[tokio::test]
async fn active_workout_response_includes_completed_set_history_and_backend_suggestions() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-20T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-20T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000009".to_owned(),
                position: 3,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000010".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000009".to_owned()),
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
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(10),
                        load_display_value: Some(20.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(20.0),
                        completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(8),
                        load_display_value: Some(22.5),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(22.5),
                        completed_at: Some("2026-02-01T09:08:00Z".to_owned()),
                    },
                ],
                ..active_workout_fixture().exercises[0].clone()
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    assert_eq!(created.exercises.len(), 6);

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 2);
    assert_eq!(first_exercise.completed_sets[0].set_index, 1);
    assert_eq!(first_exercise.completed_sets[1].set_index, 2);
    assert_eq!(first_exercise.completed_sets[1].load_value, Some(22.5));
    assert_eq!(first_exercise.suggested_set.load_value, 22.5);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(8));

    let historical_suggestion = &created.exercises[2];
    assert!(historical_suggestion.completed_sets.is_empty());
    assert_eq!(historical_suggestion.suggested_set.load_value, 25.0);
    assert_eq!(
        historical_suggestion.suggested_set.repetition_value,
        Some(12)
    );

    let fallback_suggestion = &created.exercises[3];
    assert!(fallback_suggestion.completed_sets.is_empty());
    assert_eq!(fallback_suggestion.suggested_set.load_value, 10.0);
    assert_eq!(fallback_suggestion.suggested_set.repetition_value, Some(10));
}

#[tokio::test]
async fn active_workout_persistence_keeps_unilateral_sides_distinct_and_bilateral_stable() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-01T09:00:00Z".to_owned()),
            current_exercise_position: Some(5),
            completed_at: None,
            exercises: vec![
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000006".to_owned(),
                    position: 5,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000005".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000009".to_owned()),
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000006".to_owned(),
                    ),
                    set_tracking_mode: Some("UNILATERAL".to_owned()),
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "LEFT".to_owned(),
                            repetition_value: Some(10),
                            load_display_value: Some(20.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(20.0),
                            completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "RIGHT".to_owned(),
                            repetition_value: Some(9),
                            load_display_value: Some(22.5),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(22.5),
                            completed_at: Some("2026-02-01T09:06:00Z".to_owned()),
                        },
                    ],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000001".to_owned(),
                    position: 1,
                    selected_variant_id: Some("20000000-0000-0000-0000-000000000001".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000001".to_owned(),
                    ),
                    set_tracking_mode: Some("BILATERAL".to_owned()),
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_value: Some(8),
                        load_display_value: Some(40.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(40.0),
                        completed_at: Some("2026-02-01T09:07:00Z".to_owned()),
                    }],
                },
            ],
        })
        .await
        .expect("active workout create should succeed");

    let unilateral = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 5)
        .expect("unilateral exercise should exist");
    assert_eq!(unilateral.completed_sets.len(), 2);
    assert_eq!(unilateral.completed_sets[0].set_index, 1);
    assert_eq!(unilateral.completed_sets[0].set_side, "LEFT");
    assert_eq!(unilateral.completed_sets[1].set_index, 1);
    assert_eq!(unilateral.completed_sets[1].set_side, "RIGHT");

    let bilateral = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 1)
        .expect("bilateral exercise should exist");
    assert_eq!(bilateral.completed_sets.len(), 1);
    assert_eq!(bilateral.completed_sets[0].set_index, 1);
    assert_eq!(bilateral.completed_sets[0].set_side, "BILATERAL");

    let resumed = repository
        .fetch_active_workout(&created.id)
        .await
        .expect("active workout lookup should succeed")
        .expect("active workout should exist");

    let resumed_unilateral = resumed
        .exercises
        .iter()
        .find(|exercise| exercise.position == 5)
        .expect("resumed unilateral exercise should exist");
    assert_eq!(resumed_unilateral.completed_sets.len(), 2);
    assert_eq!(resumed_unilateral.completed_sets[0].set_side, "LEFT");
    assert_eq!(resumed_unilateral.completed_sets[1].set_side, "RIGHT");

    let resumed_bilateral = resumed
        .exercises
        .iter()
        .find(|exercise| exercise.position == 1)
        .expect("resumed bilateral exercise should exist");
    assert_eq!(resumed_bilateral.completed_sets.len(), 1);
    assert_eq!(resumed_bilateral.completed_sets[0].set_side, "BILATERAL");
}
