fn plan_definition(exercises: Vec<(&str, Vec<&str>)>) -> pumpbuddy_backend::domain::TrainingPlanDefinition {
    pumpbuddy_backend::domain::TrainingPlanDefinition {
        name: "Mutable Plan".to_owned(),
        exercises: exercises
            .into_iter()
            .map(|(exercise_id, variants)| {
                pumpbuddy_backend::domain::TrainingPlanExerciseDefinition {
                    exercise_id: exercise_id.to_owned(),
                    allowed_variant_ids: variants.into_iter().map(str::to_owned).collect(),
                }
            })
            .collect(),
    }
}

#[tokio::test]
async fn training_plan_writes_create_atomic_versions_and_preserve_guidance() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());
    let initial = plan_definition(vec![(
        "10000000-0000-0000-0000-000000000003",
        vec!["20000000-0000-0000-0000-000000000003"],
    )]);
    let created = repository
        .create_training_plan_for_user(DEV_USER_ID, &initial)
        .await
        .expect("initial plan should persist");
    assert_eq!(created.version_number, 1);

    sqlx::query(
        "UPDATE training_plan_exercise_variants SET rep_min = 8, rep_max = 12, target_sets = 3
         WHERE training_plan_exercise_id IN (
             SELECT id FROM training_plan_exercises
             WHERE training_plan_version_id = (
                 SELECT id FROM training_plan_versions
                 WHERE training_plan_id = $1::uuid AND version_number = 1
             )
         )",
    )
    .bind(&created.training_plan_id)
    .execute(&db.pool)
    .await
    .expect("initial guidance should be writable for fixture setup");

    let structural = plan_definition(vec![
        (
            "10000000-0000-0000-0000-000000000003",
            vec!["20000000-0000-0000-0000-000000000003"],
        ),
        (
            "10000000-0000-0000-0000-000000000004",
            vec!["20000000-0000-0000-0000-000000000004"],
        ),
    ]);
    let saved = repository
        .save_training_plan_for_user(&created.training_plan_id, DEV_USER_ID, &structural, true)
        .await
        .expect("structural save should create a version");
    assert_eq!(saved.version_number, 2);
    assert!(saved.created_new_version);

    let guidance: Vec<_> = sqlx::query(
        "SELECT tpv.version_number, peo.rep_min, peo.rep_max, peo.target_sets
         FROM training_plan_versions tpv
         JOIN training_plan_exercises tpe ON tpe.training_plan_version_id = tpv.id
         JOIN training_plan_exercise_variants peo ON peo.training_plan_exercise_id = tpe.id
         WHERE tpv.training_plan_id = $1::uuid
           AND tpe.exercise_id = '10000000-0000-0000-0000-000000000003'::uuid
         ORDER BY tpv.version_number",
    )
    .bind(&created.training_plan_id)
    .fetch_all(&db.pool)
    .await
    .expect("version guidance should be readable")
    .into_iter()
    .map(|row| {
        (
            row.get::<i32, _>("version_number"),
            row.get::<Option<i32>, _>("rep_min"),
            row.get::<Option<i32>, _>("rep_max"),
            row.get::<Option<i32>, _>("target_sets"),
        )
    })
    .collect();
    assert_eq!(guidance, vec![(1, Some(8), Some(12), Some(3)), (2, Some(8), Some(12), Some(3))]);

    let renamed_with_addition = pumpbuddy_backend::domain::TrainingPlanDefinition {
        name: "Renamed Plan".to_owned(),
        exercises: vec![
            pumpbuddy_backend::domain::TrainingPlanExerciseDefinition {
                exercise_id: "10000000-0000-0000-0000-000000000003".to_owned(),
                allowed_variant_ids: vec![
                    "20000000-0000-0000-0000-000000000003".to_owned(),
                    "20000000-0000-0000-0000-000000000017".to_owned(),
                ],
            },
            pumpbuddy_backend::domain::TrainingPlanExerciseDefinition {
                exercise_id: "10000000-0000-0000-0000-000000000004".to_owned(),
                allowed_variant_ids: vec!["20000000-0000-0000-0000-000000000004".to_owned()],
            },
        ],
    };
    let in_place = repository
        .save_training_plan_for_user(
            &created.training_plan_id,
            DEV_USER_ID,
            &renamed_with_addition,
            false,
        )
        .await
        .expect("rename and variant addition should update in place");
    assert_eq!(in_place.version_number, 2);
    assert!(!in_place.created_new_version);
    let version_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM training_plan_versions WHERE training_plan_id = $1::uuid",
    )
    .bind(&created.training_plan_id)
    .fetch_one(&db.pool)
    .await
    .expect("version count should be readable");
    assert_eq!(version_count, 2);

    let rejected = repository
        .save_training_plan_for_user(
            &created.training_plan_id,
            DEV_USER_ID,
            &plan_definition(vec![("10000000-0000-0000-0000-000000000003", vec![])]),
            false,
        )
        .await;
    assert!(matches!(rejected, Err(PersistenceError::Conflict(_))));
}
