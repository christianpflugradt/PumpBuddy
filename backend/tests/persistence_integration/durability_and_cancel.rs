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
async fn active_workout_uniqueness_is_enforced_by_database_for_unfinished_rows() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    let initial = active_workout_fixture();

    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("first active workout create should succeed");

    let duplicate_error = sqlx::query(
        "INSERT INTO workouts (
            training_plan_version_id,
            gym_id,
            started_at,
            completed_at,
            current_exercise_position,
            user_id
         )
         VALUES (
            (
                SELECT tpv.id
                FROM training_plan_versions tpv
                WHERE tpv.training_plan_id = $1::uuid
                ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
                LIMIT 1
            ),
            $2::uuid,
            $3::timestamptz,
            NULL,
            $4,
            $5::uuid
         )",
    )
    .bind(&initial.training_plan_id)
    .bind(initial.gym_id.as_deref())
    .bind("2026-02-01T10:00:00Z")
    .bind(initial.current_exercise_position)
    .bind(DEV_USER_ID)
    .execute(&db.pool)
    .await
    .expect_err("database should reject a second unfinished workout for the same user");

    match duplicate_error {
        sqlx::Error::Database(db_error) => {
            assert!(db_error.is_unique_violation());
            assert_eq!(
                db_error.constraint(),
                Some("workouts_single_active_per_user_unique")
            );
        }
        other => panic!("unexpected duplicate insert error: {other:?}"),
    }

    repository
        .complete_active_workout(
            &created.id,
            &NewWorkout {
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
                ..initial.clone()
            },
        )
        .await
        .expect("active workout completion should succeed");

    repository
        .create_active_workout(&NewWorkout {
            started_at: Some("2026-02-01T10:00:00Z".to_owned()),
            ..initial
        })
        .await
        .expect("completed workout should not block a new active workout");
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
            training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
            gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
            started_at: Some("2026-02-03T10:00:00Z".to_owned()),
            completed_at: Some("2026-02-03T10:05:00Z".to_owned()),
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
                    repetition_value: Some(10),
                    load_display_value: Some(20.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(20.0),
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
