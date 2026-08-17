#[derive(Clone, Copy)]
struct OwnedSuggestionReferenceIds {
    exercise_id: &'static str,
    variant_id: &'static str,
    training_plan_id: &'static str,
    training_plan_version_id: &'static str,
    training_plan_exercise_id: &'static str,
    load_profile_id: &'static str,
    gym_id: &'static str,
    station_id: &'static str,
}

const USER_A_ID: &str = "00000000-0000-0000-0000-000000000011";
const USER_A_SUGGESTION_IDS: OwnedSuggestionReferenceIds = OwnedSuggestionReferenceIds {
    exercise_id: "19000000-0000-0000-0000-000000000911",
    variant_id: "29000000-0000-0000-0000-000000000911",
    training_plan_id: "39000000-0000-0000-0000-000000000901",
    training_plan_version_id: "39100000-0000-0000-0000-000000000901",
    training_plan_exercise_id: "39200000-0000-0000-0000-000000000901",
    load_profile_id: "49000000-0000-0000-0000-000000000911",
    gym_id: "59000000-0000-0000-0000-000000000911",
    station_id: "59100000-0000-0000-0000-000000000911",
};
const USER_B_SUGGESTION_IDS: OwnedSuggestionReferenceIds = OwnedSuggestionReferenceIds {
    exercise_id: "19000000-0000-0000-0000-000000000912",
    variant_id: "29000000-0000-0000-0000-000000000912",
    training_plan_id: "39000000-0000-0000-0000-000000000912",
    training_plan_version_id: "39100000-0000-0000-0000-000000000912",
    training_plan_exercise_id: "39200000-0000-0000-0000-000000000912",
    load_profile_id: "49000000-0000-0000-0000-000000000912",
    gym_id: "59000000-0000-0000-0000-000000000912",
    station_id: "59100000-0000-0000-0000-000000000912",
};

async fn insert_owned_suggestion_reference_fixture(
    pool: &sqlx::PgPool,
    user_id: &str,
    ids: OwnedSuggestionReferenceIds,
    label: &str,
) {
    sqlx::query(
        "INSERT INTO exercises (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.exercise_id)
    .bind(user_id)
    .bind(format!("{label} Suggestion Exercise"))
    .execute(pool)
    .await
    .expect("owned suggestion exercise should insert");

    sqlx::query(
        "INSERT INTO exercise_variants (
             id,
             exercise_id,
             name,
             variant_type,
             requires_station,
             load_input_mode,
             set_tracking_mode,
             repetition_kind,
             user_id
         )
         VALUES ($1::uuid, $2::uuid, $3, 'machine', TRUE, 'TOTAL', 'BILATERAL', 'REPS', $4::uuid)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.variant_id)
    .bind(ids.exercise_id)
    .bind(format!("{label} Suggestion Variant"))
    .bind(user_id)
    .execute(pool)
    .await
    .expect("owned suggestion variant should insert");

    sqlx::query(
        "INSERT INTO training_plans (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.training_plan_id)
    .bind(user_id)
    .bind(format!("{label} Suggestion Plan"))
    .execute(pool)
    .await
    .expect("owned suggestion plan should insert");

    sqlx::query(
        "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
         VALUES ($1::uuid, $2::uuid, 1, $3::uuid)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.training_plan_version_id)
    .bind(ids.training_plan_id)
    .bind(user_id)
    .execute(pool)
    .await
    .expect("owned suggestion plan version should insert");

    sqlx::query(
        "INSERT INTO training_plan_exercises (
             id,
             training_plan_version_id,
             exercise_id,
             user_id,
             position
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 1)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.training_plan_exercise_id)
    .bind(ids.training_plan_version_id)
    .bind(ids.exercise_id)
    .bind(user_id)
    .execute(pool)
    .await
    .expect("owned suggestion training-plan exercise should insert");

    sqlx::query(
        "INSERT INTO load_profiles (id, user_id, name, weight_unit, definition)
         VALUES ($1::uuid, $2::uuid, $3, 'KG', $4::jsonb)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.load_profile_id)
    .bind(user_id)
    .bind(format!("{label} Suggestion Profile"))
    .bind(r#"{"kind":"fixed_list","values":[5,10,15,20]}"#)
    .execute(pool)
    .await
    .expect("owned suggestion load profile should insert");

    sqlx::query(
        "INSERT INTO gyms (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.gym_id)
    .bind(user_id)
    .bind(format!("{label} Suggestion Gym"))
    .execute(pool)
    .await
    .expect("owned suggestion gym should insert");

    sqlx::query(
        "INSERT INTO equipment_stations (id, user_id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(ids.station_id)
    .bind(user_id)
    .bind(ids.gym_id)
    .bind(format!("{label} Suggestion Station"))
    .bind(ids.load_profile_id)
    .execute(pool)
    .await
    .expect("owned suggestion station should insert");
}

#[tokio::test]
async fn suggestions_rule_1_exact_index_match_takes_precedence_over_last_current() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-10T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-10T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(8),
                        load_display_value: Some(40.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(40.0),
                        completed_at: Some("2026-01-10T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(7),
                        load_display_value: Some(45.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(45.0),
                        completed_at: Some("2026-01-10T09:10:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("historical exact-match workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
                    completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 1);
    assert_eq!(first_exercise.suggested_set.load_value, 45.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(7));
}

#[tokio::test]
async fn suggestions_rule_1_idx_rejects_mismatched_historical_index_and_uses_last_current() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-11T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-11T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(40.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(40.0),
                    completed_at: Some("2026-01-11T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("historical index-1-only workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(9),
                    load_display_value: Some(22.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(22.5),
                    completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 1);
    assert_eq!(first_exercise.suggested_set.load_value, 22.5);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(9));
}

#[tokio::test]
async fn unilateral_right_side_prefers_exact_right_history_over_current_left_fallback() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-14T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-14T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000002".to_owned(),
                position: 2,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000002".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000002".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "LEFT".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(8),
                        load_display_value: Some(30.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(30.0),
                        completed_at: Some("2026-01-14T09:06:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "RIGHT".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(7),
                        load_display_value: Some(35.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(35.0),
                        completed_at: Some("2026-01-14T09:09:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("historical unilateral workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            current_exercise_position: Some(2),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000002".to_owned(),
                position: 2,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000002".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000002".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(9),
                    load_display_value: Some(22.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(22.5),
                    completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 2)
        .expect("unilateral exercise should be present");
    assert_eq!(first_exercise.suggested_set.set_index, 1);
    assert_eq!(first_exercise.suggested_set.set_side, "RIGHT");
    assert_eq!(first_exercise.suggested_set.load_value, 35.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(7));
}

#[tokio::test]
async fn unilateral_right_side_falls_back_to_current_left_when_exact_right_history_is_missing() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-15T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-15T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000002".to_owned(),
                position: 2,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000002".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000002".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(6),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-15T09:06:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("historical unilateral left-only workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            current_exercise_position: Some(2),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000002".to_owned(),
                position: 2,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000002".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000002".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(9),
                    load_display_value: Some(22.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(22.5),
                    completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 2)
        .expect("unilateral exercise should be present");
    assert_eq!(first_exercise.suggested_set.set_index, 1);
    assert_eq!(first_exercise.suggested_set.set_side, "RIGHT");
    assert_eq!(first_exercise.suggested_set.load_value, 20.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(9));
}

#[tokio::test]
async fn suggestions_with_station_context_snap_last_current_load_to_profile() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(9),
                    load_display_value: Some(21.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(21.0),
                    completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 1);
    assert_eq!(first_exercise.suggested_set.load_value, 20.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(9));
}

#[tokio::test]
async fn suggestions_rules_2_to_6_use_last_current_when_idx_is_two_or_more() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-12T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-12T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(6),
                        load_display_value: Some(35.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(35.0),
                        completed_at: Some("2026-01-12T09:10:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(4),
                        load_display_value: Some(40.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(40.0),
                        completed_at: Some("2026-01-12T09:15:00Z".to_owned()),
                    },
                ],
            }],
        })
        .await
        .expect("rule-2 historical workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(9),
                    load_display_value: Some(22.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(22.5),
                    completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 1);
    assert_eq!(first_exercise.suggested_set.load_value, 22.5);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(9));
}

#[tokio::test]
async fn suggestions_rule_2_idx_one_prefers_newest_same_variant_same_gym_other_station_history() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-01T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-01T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-01T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("older rule-2 history should create");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-25T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-25T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(6),
                    load_display_value: Some(35.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(35.0),
                    completed_at: Some("2026-01-25T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("newer rule-2 history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 35.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(6));
}

#[tokio::test]
async fn suggestions_rule_2_idx_one_filters_fallback_by_requested_set_side() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-09T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-09T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000006".to_owned(),
                position: 5,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000005".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-00000000000b".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-09T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("left-side rule-2 history should create");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-28T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-28T09:20:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000006".to_owned(),
                position: 5,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000005".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-00000000000b".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "RIGHT".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(6),
                    load_display_value: Some(45.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(45.0),
                    completed_at: Some("2026-01-28T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("right-side rule-2 history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000001".to_owned(),
            current_exercise_position: Some(5),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000006".to_owned(),
                position: 5,
                selected_variant_id: Some("20000000-0000-0000-0000-000000000005".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-00000000000d".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000006".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active unilateral workout create should succeed");

    let unilateral = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 5)
        .expect("unilateral exercise should be present");
    assert_eq!(unilateral.suggested_set.set_side, "LEFT");
    assert_eq!(unilateral.suggested_set.load_value, 30.0);
    assert_eq!(unilateral.suggested_set.repetition_value, Some(8));
}

#[tokio::test]
async fn suggestions_history_scope_ignores_different_exercise_even_when_newer() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-04T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-04T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(7),
                    load_display_value: Some(37.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(37.5),
                    completed_at: Some("2026-01-04T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("same-exercise history should create");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-29T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-29T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000008".to_owned(),
                position: 2,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(5),
                    load_display_value: Some(60.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(60.0),
                    completed_at: Some("2026-01-29T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("different-exercise history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 37.5);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(7));
}

#[tokio::test]
async fn suggestions_history_scope_ignores_other_user_history() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    insert_owned_suggestion_reference_fixture(
        &db.pool,
        USER_A_ID,
        USER_A_SUGGESTION_IDS,
        "User A",
    )
    .await;

    repository
        .create_workout_for_user(
            &NewWorkout {
                training_plan_id: USER_A_SUGGESTION_IDS.training_plan_id.to_owned(),
                gym_id: Some(USER_A_SUGGESTION_IDS.gym_id.to_owned()),
                started_at: Some("2026-01-30T09:00:00Z".to_owned()),
                completed_at: Some("2026-01-30T09:25:00Z".to_owned()),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: USER_A_SUGGESTION_IDS
                        .training_plan_exercise_id
                        .to_owned(),
                    position: 1,
                    selected_variant_id: Some(USER_A_SUGGESTION_IDS.variant_id.to_owned()),
                    selected_station_id: Some(USER_A_SUGGESTION_IDS.station_id.to_owned()),
                    selected_training_plan_exercise_variant_id: None,
                    load_input_mode: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(4),
                        load_display_value: Some(60.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(60.0),
                        completed_at: Some("2026-01-30T09:08:00Z".to_owned()),
                    }],
                }],
            },
            USER_A_ID,
        )
        .await
        .expect("user-a workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 20.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(10));
}

#[tokio::test]
async fn suggestions_rule_3_idx_one_uses_same_variant_other_gym_when_same_gym_missing() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO gyms (id, name)
         VALUES ($1::uuid, $2)",
    )
    .bind("50000000-0000-0000-0000-000000000111")
    .bind("Branch Gym")
    .execute(&db.pool)
    .await
    .expect("secondary gym should insert");

    sqlx::query(
        "INSERT INTO equipment_stations (id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("50000000-0000-0000-0000-000000000112")
    .bind("50000000-0000-0000-0000-000000000111")
    .bind("Branch Rack")
    .bind("40000000-0000-0000-0000-000000000002")
    .execute(&db.pool)
    .await
    .expect("secondary station should insert");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000111".to_owned()),
            started_at: Some("2026-01-16T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-16T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000112".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(5),
                    load_display_value: Some(50.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(50.0),
                    completed_at: Some("2026-01-16T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("rule-3 history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 50.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(5));
}

#[tokio::test]
async fn suggestions_rule_4_idx_one_uses_same_station_other_variant_when_variant_match_missing() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-17T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-17T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(7),
                    load_display_value: Some(32.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(32.5),
                    completed_at: Some("2026-01-17T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("rule-4 history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 32.5);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(7));
}

#[tokio::test]
async fn suggestions_rule_5_idx_one_uses_same_gym_other_station_other_variant_history() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-19T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-19T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(6),
                    load_display_value: Some(37.5),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(37.5),
                    completed_at: Some("2026-01-19T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("rule-5 history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 37.5);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(6));
}

#[tokio::test]
async fn suggestions_rule_6_idx_one_uses_other_gym_exercise_history_when_scoped_candidates_missing()
{
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO gyms (id, name)
         VALUES ($1::uuid, $2)",
    )
    .bind("50000000-0000-0000-0000-000000000121")
    .bind("Remote Gym")
    .execute(&db.pool)
    .await
    .expect("secondary gym should insert");

    sqlx::query(
        "INSERT INTO equipment_stations (id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("50000000-0000-0000-0000-000000000122")
    .bind("50000000-0000-0000-0000-000000000121")
    .bind("Remote Rack")
    .bind("40000000-0000-0000-0000-000000000002")
    .execute(&db.pool)
    .await
    .expect("secondary station should insert");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000121".to_owned()),
            started_at: Some("2026-01-23T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-23T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000f".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000122".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(4),
                    load_display_value: Some(55.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(55.0),
                    completed_at: Some("2026-01-23T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("rule-6 history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 55.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(4));
}

#[tokio::test]
async fn suggestions_explicitly_cover_current_workout_and_global_fallback_paths() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            started_at: Some("2026-02-05T09:00:00Z".to_owned()),
            current_exercise_position: Some(1),
            exercises: vec![
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                    position: 1,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: None,
                    load_input_mode: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(9),
                        load_display_value: Some(21.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(21.0),
                        completed_at: Some("2026-02-05T09:05:00Z".to_owned()),
                    }],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000008".to_owned(),
                    position: 2,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_training_plan_exercise_variant_id: None,
                    load_input_mode: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![],
                },
            ],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 1)
        .expect("position-1 exercise should be present");
    assert_eq!(first_exercise.suggested_set.load_value, 21.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(9));

    let second_exercise = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 2)
        .expect("position-2 exercise should be present");
    assert!(second_exercise.completed_sets.is_empty());
    assert_eq!(second_exercise.suggested_set.load_value, 10.0);
    assert_eq!(second_exercise.suggested_set.repetition_value, Some(10));
}

#[tokio::test]
async fn free_mode_start_ignores_historical_variant_loads_and_uses_default_load() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            started_at: Some("2026-02-04T09:00:00Z".to_owned()),
            completed_at: Some("2026-02-04T09:30:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(9),
                    load_display_value: Some(10.19),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(10.19),
                    completed_at: Some("2026-02-04T09:05:00Z".to_owned()),
                }],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("historical configured-gym workout should be created");

    let created = repository
        .create_active_workout(&NewWorkout {
            gym_id: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("free-mode active workout should be created");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.selected_variant_id, None);
    assert_eq!(first_exercise.selected_station_id, None);
    assert_eq!(first_exercise.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn suggestions_rule_order_prefers_same_gym_variant_before_other_gym_variant() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO gyms (id, name)
         VALUES ($1::uuid, $2)",
    )
    .bind("50000000-0000-0000-0000-000000000101")
    .bind("Satellite Gym")
    .execute(&db.pool)
    .await
    .expect("secondary gym should insert");

    sqlx::query(
        "INSERT INTO equipment_stations (id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("50000000-0000-0000-0000-000000000190")
    .bind("50000000-0000-0000-0000-000000000101")
    .bind("Satellite Barbell Rack")
    .bind("40000000-0000-0000-0000-000000000002")
    .execute(&db.pool)
    .await
    .expect("secondary station should insert");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-14T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-14T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-14T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("same-gym variant history should create");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000101".to_owned()),
            started_at: Some("2026-01-15T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-15T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000102".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(5),
                    load_display_value: Some(50.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(50.0),
                    completed_at: Some("2026-01-15T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("other-gym variant history should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 50.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(5));
}

#[tokio::test]
async fn suggestions_history_scope_ignores_other_users_candidates() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-18T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-18T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-18T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("same-user historical workout should create");

    insert_owned_suggestion_reference_fixture(
        &db.pool,
        USER_B_ID,
        USER_B_SUGGESTION_IDS,
        "User B",
    )
    .await;

    repository
        .create_workout_for_user(
            &NewWorkout {
                training_plan_id: USER_B_SUGGESTION_IDS.training_plan_id.to_owned(),
                gym_id: Some(USER_B_SUGGESTION_IDS.gym_id.to_owned()),
                started_at: Some("2026-01-21T09:00:00Z".to_owned()),
                completed_at: Some("2026-01-21T09:25:00Z".to_owned()),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: USER_B_SUGGESTION_IDS
                        .training_plan_exercise_id
                        .to_owned(),
                    position: 1,
                    selected_variant_id: Some(USER_B_SUGGESTION_IDS.variant_id.to_owned()),
                    selected_station_id: Some(USER_B_SUGGESTION_IDS.station_id.to_owned()),
                    selected_training_plan_exercise_variant_id: None,
                    load_input_mode: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(5),
                        load_display_value: Some(70.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(70.0),
                        completed_at: Some("2026-01-21T09:08:00Z".to_owned()),
                    }],
                }],
            },
            USER_B_ID,
        )
        .await
        .expect("other-user historical workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 30.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(8));
}

#[tokio::test]
async fn suggestions_history_scope_prefers_newest_matching_candidate() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-05T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-05T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-05T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("older historical workout should create");

    repository
        .create_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-01-22T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-22T09:25:00Z".to_owned()),
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: None,
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(6),
                    load_display_value: Some(35.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(35.0),
                    completed_at: Some("2026-01-22T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("newer historical workout should create");

    let created = repository
        .create_active_workout(&NewWorkout {
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                position: 1,
                selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                selected_training_plan_exercise_variant_id: Some(
                    "33000000-0000-0000-0000-000000000008".to_owned(),
                ),
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
            ..active_workout_fixture()
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 35.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(6));
}

#[tokio::test]
async fn configured_gym_without_history_uses_station_profile_start_suggestion() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-02T09:00:00Z".to_owned()),
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
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 20.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(10));
}

#[tokio::test]
async fn active_workout_suggestions_clamp_to_configured_max_while_preserving_saved_over_max_loads()
{
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO user_preferences (user_id, preference_key, preference_value)
         VALUES ($1::uuid, 'max_load_kg', '200')
         ON CONFLICT (user_id, preference_key)
         DO UPDATE SET preference_value = EXCLUDED.preference_value",
    )
    .bind(DEV_USER_ID)
    .execute(&db.pool)
    .await
    .expect("max-load preference upsert should succeed");

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-02T09:00:00Z".to_owned()),
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
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    repetition_kind: None,
                    repetition_value: Some(8),
                    load_display_value: Some(230.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(230.0),
                    completed_at: Some("2026-02-02T09:05:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert_eq!(first_exercise.completed_sets.len(), 1);
    assert_eq!(first_exercise.completed_sets[0].load_value, Some(230.0));
    assert_eq!(first_exercise.suggested_set.load_value, 200.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(8));
}

#[tokio::test]
async fn reps_gate_falls_back_when_variant_station_history_coverage_is_below_threshold() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    for index in 0..3 {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-1{}T08:00:00Z", index)),
                completed_at: Some(format!("2026-03-1{}T08:20:00Z", index)),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                    position: 1,
                    selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000008".to_owned(),
                    ),
                    load_input_mode: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        repetition_kind: None,
                        repetition_value: Some(6 + index),
                        load_display_value: Some(35.0 + (index as f64 * 2.5)),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(35.0 + (index as f64 * 2.5)),
                        completed_at: Some(format!("2026-03-1{}T08:10:00Z", index)),
                    }],
                }],
            })
            .await
            .expect("historical covered workout should create");
    }

    for index in 3..5 {
        repository
            .create_workout(&NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some(format!("2026-03-1{}T08:00:00Z", index)),
                completed_at: Some(format!("2026-03-1{}T08:20:00Z", index)),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                    position: 1,
                    selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                    selected_training_plan_exercise_variant_id: Some(
                        "33000000-0000-0000-0000-000000000008".to_owned(),
                    ),
                    load_input_mode: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![],
                }],
            })
            .await
            .expect("historical uncovered workout should create");
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
                load_input_mode: None,
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![],
            }],
        })
        .await
        .expect("active workout create should succeed");

    let first_exercise = &created.exercises[0];
    assert!(first_exercise.completed_sets.is_empty());
    assert_eq!(first_exercise.suggested_set.load_value, 40.0);
    assert_eq!(first_exercise.suggested_set.repetition_value, Some(8));
}
