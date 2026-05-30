fn assert_foreign_key_violation(error: sqlx::Error, constraint: &str) {
    match error {
        sqlx::Error::Database(db_error) => {
            assert_eq!(db_error.code().as_deref(), Some("23503"));
            assert_eq!(db_error.constraint(), Some(constraint));
        }
        other => panic!("unexpected cross-user reference error: {other:?}"),
    }
}

async fn insert_user_b_plan_fixture(pool: &sqlx::PgPool) {
    sqlx::query(
        "INSERT INTO training_plans (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)",
    )
    .bind("30000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind("User B Ownership Plan")
    .execute(pool)
    .await
    .expect("user B training plan fixture should insert");

    sqlx::query(
        "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("31000000-0000-0000-0000-0000000000b1")
    .bind("30000000-0000-0000-0000-0000000000b1")
    .bind(1)
    .bind(USER_B_ID)
    .execute(pool)
    .await
    .expect("user B training plan version fixture should insert");

    sqlx::query(
        "INSERT INTO exercises (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)",
    )
    .bind("10000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind("User B Ownership Exercise")
    .execute(pool)
    .await
    .expect("user B exercise fixture should insert");

    sqlx::query(
        "INSERT INTO training_plan_exercises (
             id,
             training_plan_version_id,
             exercise_id,
             user_id,
             position
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)",
    )
    .bind("32000000-0000-0000-0000-0000000000b1")
    .bind("31000000-0000-0000-0000-0000000000b1")
    .bind("10000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind(1)
    .execute(pool)
    .await
    .expect("user B training plan exercise fixture should insert");
}

async fn insert_user_b_workout_fixture(pool: &sqlx::PgPool) {
    sqlx::query(
        "INSERT INTO workouts (
             id,
             training_plan_version_id,
             gym_id,
             user_id,
             started_at,
             completed_at,
             current_exercise_position
         )
         VALUES (
             $1::uuid,
             $2::uuid,
             NULL,
             $3::uuid,
             '2026-03-01T09:00:00Z'::timestamptz,
             '2026-03-01T09:30:00Z'::timestamptz,
             1
         )",
    )
    .bind("70000000-0000-0000-0000-0000000000b1")
    .bind("31000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .execute(pool)
    .await
    .expect("user B workout fixture should insert");
}

#[tokio::test]
async fn composite_user_ownership_constraints_reject_representative_cross_user_references() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;

    let error = sqlx::query(
        "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("31000000-0000-0000-0000-0000000000e1")
    .bind("30000000-0000-0000-0000-000000000001")
    .bind(42)
    .bind(USER_B_ID)
    .execute(pool)
    .await
    .expect_err("database should reject a plan version linked to another user's plan");
    assert_foreign_key_violation(error, "training_plan_versions_plan_user_fk");

    insert_user_b_plan_fixture(pool).await;

    let error = sqlx::query(
        "INSERT INTO workouts (
             id,
             training_plan_version_id,
             gym_id,
             user_id,
             started_at,
             completed_at
         )
         VALUES (
             $1::uuid,
             $2::uuid,
             NULL,
             $3::uuid,
             '2026-03-01T10:00:00Z'::timestamptz,
             '2026-03-01T10:30:00Z'::timestamptz
         )",
    )
    .bind("70000000-0000-0000-0000-0000000000e1")
    .bind("31000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .execute(pool)
    .await
    .expect_err("database should reject a workout linked to another user's plan version");
    assert_foreign_key_violation(error, "workouts_training_plan_version_user_fk");

    let error = sqlx::query(
        "INSERT INTO workouts (
             id,
             training_plan_version_id,
             gym_id,
             user_id,
             started_at,
             completed_at
         )
         VALUES (
             $1::uuid,
             $2::uuid,
             $3::uuid,
             $4::uuid,
             '2026-03-01T11:00:00Z'::timestamptz,
             '2026-03-01T11:30:00Z'::timestamptz
         )",
    )
    .bind("70000000-0000-0000-0000-0000000000e2")
    .bind("31000000-0000-0000-0000-0000000000b1")
    .bind("50000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .execute(pool)
    .await
    .expect_err("database should reject a workout linked to another user's gym");
    assert_foreign_key_violation(error, "workouts_gym_user_fk");

    insert_user_b_workout_fixture(pool).await;

    sqlx::query(
        "INSERT INTO workout_exercises (
             id,
             workout_id,
             training_plan_exercise_id,
             user_id,
             position
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)",
    )
    .bind("71000000-0000-0000-0000-0000000000b1")
    .bind("70000000-0000-0000-0000-0000000000b1")
    .bind("32000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind(1)
    .execute(pool)
    .await
    .expect("nullable selected references should remain valid");

    let error = sqlx::query(
        "INSERT INTO workout_exercises (
             id,
             workout_id,
             training_plan_exercise_id,
             user_id,
             position,
             selected_variant_id
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid)",
    )
    .bind("71000000-0000-0000-0000-0000000000e1")
    .bind("70000000-0000-0000-0000-0000000000b1")
    .bind("32000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind(2)
    .bind("20000000-0000-0000-0000-00000000000e")
    .execute(pool)
    .await
    .expect_err("database should reject a workout exercise linked to another user's variant");
    assert_foreign_key_violation(error, "workout_exercises_selected_variant_user_fk");

    let error = sqlx::query(
        "INSERT INTO workout_exercises (
             id,
             workout_id,
             training_plan_exercise_id,
             user_id,
             position,
             selected_station_id
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid)",
    )
    .bind("71000000-0000-0000-0000-0000000000e2")
    .bind("70000000-0000-0000-0000-0000000000b1")
    .bind("32000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind(3)
    .bind("50000000-0000-0000-0000-000000000001")
    .execute(pool)
    .await
    .expect_err("database should reject a workout exercise linked to another user's station");
    assert_foreign_key_violation(error, "workout_exercises_selected_station_user_fk");

    let error = sqlx::query(
        "INSERT INTO workout_exercises (
             id,
             workout_id,
             training_plan_exercise_id,
             user_id,
             position,
             selected_training_plan_exercise_variant_id
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid)",
    )
    .bind("71000000-0000-0000-0000-0000000000e3")
    .bind("70000000-0000-0000-0000-0000000000b1")
    .bind("32000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind(4)
    .bind("33000000-0000-0000-0000-000000000008")
    .execute(pool)
    .await
    .expect_err(
        "database should reject a workout exercise linked to another user's plan option",
    );
    assert_foreign_key_violation(
        error,
        "workout_exercises_selected_tpev_user_fk",
    );

    sqlx::query(
        "INSERT INTO load_profiles (id, user_id, name, weight_unit, definition)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)",
    )
    .bind("40000000-0000-0000-0000-0000000000b1")
    .bind(USER_B_ID)
    .bind("User B Ownership Profile")
    .bind("KG")
    .bind(r#"{"kind":"fixed_list","values":[5,10]}"#)
    .execute(pool)
    .await
    .expect("user B load profile fixture should insert");

    let error = sqlx::query(
        "INSERT INTO equipment_stations (id, user_id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)",
    )
    .bind("50000000-0000-0000-0000-0000000000e1")
    .bind(USER_B_ID)
    .bind("50000000-0000-0000-0000-000000000001")
    .bind("Cross User Station")
    .bind("40000000-0000-0000-0000-0000000000b1")
    .execute(pool)
    .await
    .expect_err("database should reject a station linked to another user's gym");
    assert_foreign_key_violation(error, "equipment_stations_gym_user_fk");
}
