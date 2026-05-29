#[tokio::test]
async fn option_read_path_uses_enabled_variant_station_compatibility_for_realizability() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;
    let repository = DomainRepository::new(db.pool.clone());

    let training_plan_id = "30000000-0000-0000-0000-000000000002";
    let gym_id = "50000000-0000-0000-0000-000000000001";
    let station_required_variant_id = "20000000-0000-0000-0000-00000000000e";
    let disabled_station_id = "5f000000-0000-0000-0000-0000000000aa";

    let before = repository
        .fetch_training_plan_exercise_variant_summaries(training_plan_id, gym_id)
        .await
        .expect("baseline option query should succeed");
    assert!(before
        .iter()
        .any(|option| option.variant_id == station_required_variant_id));

    sqlx::query(
        "INSERT INTO load_profiles (id, user_id, name, weight_unit, definition)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)",
    )
    .bind("4f000000-0000-0000-0000-0000000000aa")
    .bind(DEV_USER_ID)
    .bind("Disabled Compat Profile")
    .bind("KG")
    .bind(r#"{"kind":"fixed_list","values":[5.0,10.0]}"#)
    .execute(pool)
    .await
    .expect("profile insert should succeed");

    sqlx::query(
        "INSERT INTO equipment_stations (id, user_id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)",
    )
    .bind(disabled_station_id)
    .bind(DEV_USER_ID)
    .bind(gym_id)
    .bind("Disabled Mapping Station")
    .bind("4f000000-0000-0000-0000-0000000000aa")
    .execute(pool)
    .await
    .expect("station insert should succeed");

    sqlx::query(
        "INSERT INTO exercise_variant_equipment_compatibilities (
             id,
             exercise_variant_id,
             equipment_station_id,
             user_id,
             is_enabled
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, FALSE)",
    )
    .bind("7f000000-0000-0000-0000-0000000000aa")
    .bind(station_required_variant_id)
    .bind(disabled_station_id)
    .bind(DEV_USER_ID)
    .execute(pool)
    .await
    .expect("disabled compatibility insert should succeed");

    let after = repository
        .fetch_training_plan_exercise_variant_summaries(training_plan_id, gym_id)
        .await
        .expect("option query with disabled compatibility should succeed");

    assert!(after
        .iter()
        .all(|option| { option.station_id.as_deref() != Some(disabled_station_id) }));
}

#[tokio::test]
async fn training_plan_option_summaries_are_definition_derived_and_deterministic() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let first_fetch = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("push-day option summary query should succeed");
    let second_fetch = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("repeat push-day option summary query should succeed");

    assert!(!first_fetch.is_empty());
    assert_eq!(first_fetch, second_fetch);

    let mut previous_position = i32::MIN;
    for option in &first_fetch {
        assert!(option.exercise_position >= previous_position);
        previous_position = option.exercise_position;
        if option.station_id.is_none() {
            assert!(option.station_profile_loads_kg.is_empty());
            assert_eq!(option.suggested_start_load_kg, None);
        } else {
            assert!(!option.station_profile_loads_kg.is_empty());
            assert!(option.suggested_start_load_kg.is_some());
        }
        assert!(option
            .station_profile_loads_kg
            .iter()
            .all(|load| load.is_finite()));
        assert!(option
            .station_profile_loads_kg
            .windows(2)
            .all(|pair| pair[0] <= pair[1]));
    }
}

#[tokio::test]
async fn option_read_path_includes_stationless_options_for_configured_gym_realizability() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let options = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("push-day option summary query should succeed");

    let stationless_option = options
        .iter()
        .find(|option| option.id == "33000000-0000-0000-0000-00000000000f")
        .expect("stationless seeded option should be included in summary read path");

    assert_eq!(
        stationless_option.training_plan_exercise_id,
        "32000000-0000-0000-0000-00000000000c"
    );
    assert_eq!(stationless_option.station_id, None);
    assert_eq!(stationless_option.station_name, None);
    assert!(stationless_option.station_profile_loads_kg.is_empty());
    assert_eq!(stationless_option.suggested_start_load_kg, None);
}

#[tokio::test]
async fn training_plan_option_summaries_for_user_match_seeded_defaults() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let expected = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("generic option summary query should succeed");
    let actual = repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("user-scoped option summary query should succeed");

    assert!(!actual.is_empty());
    assert_eq!(actual, expected);
}

#[tokio::test]
async fn training_plan_option_summaries_for_user_clamp_profile_loads_to_configured_max() {
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

    let options = repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
            DEV_USER_ID,
        )
        .await
        .expect("user-scoped option summary query should succeed");

    let barbell_formula_option = options
        .iter()
        .find(|option| option.station_id.as_deref() == Some("50000000-0000-0000-0000-000000000001"))
        .expect("barbell formula station option should be present");

    assert!(!barbell_formula_option.station_profile_loads_kg.is_empty());
    assert!(barbell_formula_option
        .station_profile_loads_kg
        .iter()
        .all(|load| *load <= 200.0 + 1e-9));
    assert_eq!(
        barbell_formula_option
            .station_profile_loads_kg
            .last()
            .copied(),
        Some(200.0)
    );
    assert_eq!(barbell_formula_option.suggested_start_load_kg, Some(20.0));
}

#[tokio::test]
async fn formula_profile_option_loads_are_deterministic_finite_sorted_and_capped_at_200kg_by_default(
) {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let first_fetch = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("push-day option query should succeed");
    let second_fetch = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("repeat push-day option query should succeed");

    let first_formula_option = first_fetch
        .iter()
        .find(|option| option.station_id.as_deref() == Some("50000000-0000-0000-0000-000000000001"))
        .expect("barbell formula station option should be present");
    let second_formula_option = second_fetch
        .iter()
        .find(|option| option.station_id.as_deref() == Some("50000000-0000-0000-0000-000000000001"))
        .expect("barbell formula station option should be present on repeated fetch");

    assert_eq!(
        first_formula_option.station_profile_loads_kg,
        second_formula_option.station_profile_loads_kg
    );

    let loads = &first_formula_option.station_profile_loads_kg;
    assert!(!loads.is_empty());
    assert_eq!(loads.first().copied(), Some(20.0));
    assert_eq!(loads.last().copied(), Some(200.0));
    assert!(loads.iter().all(|load| load.is_finite()));
    assert!(loads.windows(2).all(|pair| pair[0] <= pair[1]));
    assert!(loads.iter().all(|load| *load <= 200.0 + 1e-9));
    assert!(loads.iter().any(|load| (*load - 200.0).abs() <= 1e-9));
    assert_eq!(first_formula_option.suggested_start_load_kg, Some(20.0));
    assert_eq!(second_formula_option.suggested_start_load_kg, Some(20.0));
}

#[tokio::test]
async fn formula_profile_option_loads_with_zero_min_include_200kg_by_default() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let options = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000003",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("pull-day option query should succeed");

    let formula_option = options
        .iter()
        .find(|option| option.station_id.as_deref() == Some("50000000-0000-0000-0000-000000000007"))
        .expect("chest-supported lever row formula station should be present");

    let loads = &formula_option.station_profile_loads_kg;
    assert!(!loads.is_empty());
    assert!((loads[0] - 0.0).abs() <= 1e-9);
    assert!((loads[loads.len() - 1] - 200.0).abs() <= 1e-9);
    assert!(loads.iter().all(|load| load.is_finite()));
    assert!(loads.windows(2).all(|pair| pair[0] <= pair[1]));
    assert!(loads.iter().all(|load| *load <= 200.0 + 1e-9));
    assert!(loads.iter().any(|load| (*load - 200.0).abs() <= 1e-9));
    assert_eq!(formula_option.suggested_start_load_kg, Some(20.0));
}

#[tokio::test]
async fn seeded_variant_option_parity_and_ordering() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let user_id = "00000000-0000-0000-0000-000000000001";
    let options_for_user = repository
        .fetch_training_plan_exercise_variant_summaries_for_user(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
            user_id,
        )
        .await
        .expect("seeded option query should succeed");

    assert!(!options_for_user.is_empty());

    let mut variants_by_position: BTreeMap<i32, Vec<String>> = BTreeMap::new();
    let mut option_ids_by_position: BTreeMap<i32, Vec<String>> = BTreeMap::new();
    for option in options_for_user {
        if option.station_id.is_none() {
            assert!(option.station_profile_loads_kg.is_empty());
            assert_eq!(option.suggested_start_load_kg, None);
        } else {
            assert!(!option.station_profile_loads_kg.is_empty());
            assert!(option.suggested_start_load_kg.is_some());
        }
        assert!(option
            .station_profile_loads_kg
            .iter()
            .all(|load| load.is_finite()));
        assert!(option
            .station_profile_loads_kg
            .windows(2)
            .all(|pair| pair[0] <= pair[1]));

        variants_by_position
            .entry(option.exercise_position)
            .or_default()
            .push(option.variant_id.clone());
        option_ids_by_position
            .entry(option.exercise_position)
            .or_default()
            .push(option.id);
    }

    let expected_variants_by_position = BTreeMap::from([
        (
            1,
            HashSet::from(["20000000-0000-0000-0000-00000000000e".to_owned()]),
        ),
        (
            2,
            HashSet::from(["20000000-0000-0000-0000-00000000000f".to_owned()]),
        ),
        (
            3,
            HashSet::from([
                "20000000-0000-0000-0000-000000000010".to_owned(),
                "20000000-0000-0000-0000-000000000011".to_owned(),
            ]),
        ),
        (
            4,
            HashSet::from([
                "20000000-0000-0000-0000-000000000012".to_owned(),
                "20000000-0000-0000-0000-000000000013".to_owned(),
            ]),
        ),
        (
            5,
            HashSet::from(["20000000-0000-0000-0000-000000000014".to_owned()]),
        ),
        (
            6,
            HashSet::from(["20000000-0000-0000-0000-000000000015".to_owned()]),
        ),
    ]);
    let actual_variants_by_position: BTreeMap<i32, HashSet<String>> = variants_by_position
        .iter()
        .map(|(position, variants)| (*position, variants.iter().cloned().collect()))
        .collect();
    assert_eq!(actual_variants_by_position, expected_variants_by_position);

    let expected_variant_set: HashSet<String> = expected_variants_by_position
        .values()
        .flat_map(|ids| ids.iter().cloned())
        .collect();
    let actual_variant_set: HashSet<String> = variants_by_position
        .values()
        .flat_map(|ids| ids.iter().cloned())
        .collect();
    assert_eq!(actual_variant_set, expected_variant_set);

    let expected_default_ids = BTreeMap::from([
        (1, "33000000-0000-0000-0000-000000000008"),
        (2, "33000000-0000-0000-0000-000000000009"),
        (3, "33000000-0000-0000-0000-00000000000a"),
        (4, "33000000-0000-0000-0000-00000000000c"),
        (5, "33000000-0000-0000-0000-00000000000e"),
        (6, "33000000-0000-0000-0000-00000000000f"),
    ]);

    let single_option_count = option_ids_by_position
        .values()
        .filter(|option_ids| option_ids.len() == 1)
        .count();
    let multi_option_count = option_ids_by_position
        .values()
        .filter(|option_ids| option_ids.len() > 1)
        .count();
    assert!(single_option_count >= 1);
    assert!(multi_option_count >= 1);

    for (position, option_ids) in &option_ids_by_position {
        let default_selected = option_ids.first().cloned();
        assert_eq!(
            default_selected.as_deref(),
            expected_default_ids.get(position).copied()
        );
        assert_eq!(default_selected, Some(option_ids[0].clone()));
    }
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
    assert_eq!(
        gym_names,
        vec!["Countryside Core Club", "Downtown Dumbbell Den"]
    );
    assert_eq!(gyms[0].id, "50000000-0000-0000-0000-000000000001");
}

#[tokio::test]
async fn gym_summaries_include_metadata_and_favorite_first_ordering() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;
    let repository = DomainRepository::new(db.pool.clone());

    clear_user_workout_history(pool, DEV_USER_ID).await;

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
            '31000000-0000-0000-0000-000000000001'::uuid,
            '50000000-0000-0000-0000-000000000002'::uuid,
            $2::uuid,
            '2026-05-01T09:00:00Z'::timestamptz,
            '2026-05-01T10:00:00Z'::timestamptz,
            1
         )",
    )
    .bind("5a000000-0000-0000-0000-000000000001")
    .bind(DEV_USER_ID)
    .execute(pool)
    .await
    .expect("completed workout should insert");

    let gyms = repository
        .fetch_gym_summaries_for_user_with_favorite(
            DEV_USER_ID,
            Some("50000000-0000-0000-0000-000000000002"),
        )
        .await
        .expect("gym summaries query should succeed");

    assert_eq!(gyms.len(), 2);
    assert_eq!(gyms[0].id, "50000000-0000-0000-0000-000000000002");
    assert_eq!(gyms[0].name, "Downtown Dumbbell Den");
    assert_eq!(gyms[0].station_count, 8);
    assert_eq!(
        gyms[0].last_visited_at.as_deref(),
        Some("2026-05-01 10:00:00+00")
    );
    assert_eq!(gyms[1].id, "50000000-0000-0000-0000-000000000001");
    assert_eq!(gyms[1].station_count, 9);
    assert_eq!(gyms[1].last_visited_at, None);
}

#[tokio::test]
async fn gyms_read_path_for_user_excludes_foreign_user_rows() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO gyms (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)",
    )
    .bind("5f000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .bind("Foreign User Gym")
    .execute(pool)
    .await
    .expect("foreign gym insert should succeed");

    let gyms = repository
        .fetch_gym_summaries_for_user(DEV_USER_ID)
        .await
        .expect("user-scoped gym summaries query should succeed");

    assert_eq!(gyms.len(), 2);
    assert!(gyms
        .iter()
        .all(|gym| gym.id != "5f000000-0000-0000-0000-000000000001"));
}

#[tokio::test]
async fn gym_detail_projection_groups_sorted_station_suitability() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let detail = repository
        .fetch_gym_detail_for_user("50000000-0000-0000-0000-000000000001", DEV_USER_ID)
        .await
        .expect("gym detail query should succeed")
        .expect("seeded gym should be visible");

    assert_eq!(detail.name, "Countryside Core Club");
    assert_eq!(detail.station_count, 9);

    let station_names: Vec<&str> = detail
        .stations
        .iter()
        .map(|station| station.name.as_str())
        .collect();
    let mut sorted_station_names = station_names.clone();
    sorted_station_names.sort_by_key(|name| name.to_lowercase());
    assert_eq!(station_names, sorted_station_names);

    let exercise_names: Vec<&str> = detail
        .exercise_groups
        .iter()
        .map(|group| group.exercise_name.as_str())
        .collect();
    let mut sorted_exercise_names = exercise_names.clone();
    sorted_exercise_names.sort_by_key(|name| name.to_lowercase());
    assert_eq!(exercise_names, sorted_exercise_names);

    let nordic_curl = detail
        .exercise_groups
        .iter()
        .find(|group| group.exercise_name == "Nordic Curl")
        .and_then(|group| group.variants.first())
        .expect("stationless Nordic Curl row should be present");
    assert!(!nordic_curl.requires_station);
    assert_eq!(
        nordic_curl.station_availability,
        GymStationAvailability::Stationless
    );
    assert!(nordic_curl.station_options.is_empty());

    let bench_press = detail
        .exercise_groups
        .iter()
        .find(|group| group.exercise_name == "Bench Press")
        .and_then(|group| group.variants.first())
        .expect("single-station Bench Press row should be present");
    assert!(bench_press.requires_station);
    assert_eq!(
        bench_press.station_availability,
        GymStationAvailability::SingleStation
    );
    assert_eq!(bench_press.station_options.len(), 1);
    assert_eq!(bench_press.station_options[0].station_name, "Barbell Rack");

    let pallof_press = detail
        .exercise_groups
        .iter()
        .find(|group| group.exercise_name == "Pallof Press")
        .and_then(|group| group.variants.first())
        .expect("multi-station Pallof Press row should be present");
    assert!(pallof_press.requires_station);
    assert_eq!(
        pallof_press.station_availability,
        GymStationAvailability::MultiStation
    );
    let station_option_names: Vec<&str> = pallof_press
        .station_options
        .iter()
        .map(|station| station.station_name.as_str())
        .collect();
    assert_eq!(
        station_option_names,
        vec!["Left Cable Tower", "Right Cable Tower", "V Cable Tower"]
    );
}

#[tokio::test]
async fn gym_detail_projection_excludes_disabled_compatibility() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;
    let repository = DomainRepository::new(db.pool.clone());
    let disabled_station_id = "5f000000-0000-0000-0000-0000000000bb";

    sqlx::query(
        "INSERT INTO load_profiles (id, user_id, name, weight_unit, definition)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)",
    )
    .bind("4f000000-0000-0000-0000-0000000000bb")
    .bind(DEV_USER_ID)
    .bind("Disabled Gym Detail Profile")
    .bind("KG")
    .bind(r#"{"kind":"fixed_list","values":[5.0,10.0]}"#)
    .execute(pool)
    .await
    .expect("profile insert should succeed");

    sqlx::query(
        "INSERT INTO equipment_stations (id, user_id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)",
    )
    .bind(disabled_station_id)
    .bind(DEV_USER_ID)
    .bind("50000000-0000-0000-0000-000000000001")
    .bind("Disabled Detail Station")
    .bind("4f000000-0000-0000-0000-0000000000bb")
    .execute(pool)
    .await
    .expect("station insert should succeed");

    sqlx::query(
        "INSERT INTO exercise_variant_equipment_compatibilities (
             id,
             exercise_variant_id,
             equipment_station_id,
             user_id,
             is_enabled
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, FALSE)",
    )
    .bind("7f000000-0000-0000-0000-0000000000bb")
    .bind("20000000-0000-0000-0000-000000000005")
    .bind(disabled_station_id)
    .bind(DEV_USER_ID)
    .execute(pool)
    .await
    .expect("disabled compatibility insert should succeed");

    let detail = repository
        .fetch_gym_detail_for_user("50000000-0000-0000-0000-000000000001", DEV_USER_ID)
        .await
        .expect("gym detail query should succeed")
        .expect("seeded gym should be visible");

    let disabled_station = detail
        .stations
        .iter()
        .find(|station| station.id == disabled_station_id)
        .expect("disabled station should remain visible as station metadata");
    assert_eq!(disabled_station.suitable_variant_count, 0);

    let pallof_press = detail
        .exercise_groups
        .iter()
        .find(|group| group.exercise_name == "Pallof Press")
        .and_then(|group| group.variants.first())
        .expect("Pallof Press row should be present");
    assert!(pallof_press
        .station_options
        .iter()
        .all(|station| station.station_id != disabled_station_id));
}

#[tokio::test]
async fn station_profile_load_lookup_for_user_excludes_foreign_user_station() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO load_profiles (id, user_id, name, weight_unit, definition)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)",
    )
    .bind("4f000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .bind("Foreign User Fixed List")
    .bind("KG")
    .bind(r#"{"kind":"fixed_list","values":[7.5,10.0]}"#)
    .execute(pool)
    .await
    .expect("foreign load profile insert should succeed");

    sqlx::query(
        "INSERT INTO gyms (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)",
    )
    .bind("5f000000-0000-0000-0000-000000000002")
    .bind(USER_B_ID)
    .bind("Foreign User Gym 2")
    .execute(pool)
    .await
    .expect("foreign gym insert should succeed");

    sqlx::query(
        "INSERT INTO equipment_stations (id, user_id, gym_id, name, load_profile_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)",
    )
    .bind("6f000000-0000-0000-0000-000000000001")
    .bind(USER_B_ID)
    .bind("5f000000-0000-0000-0000-000000000002")
    .bind("Foreign Station")
    .bind("4f000000-0000-0000-0000-000000000001")
    .execute(pool)
    .await
    .expect("foreign station insert should succeed");

    let hidden_from_dev = repository
        .fetch_station_profile_loads_for_user("6f000000-0000-0000-0000-000000000001", DEV_USER_ID)
        .await
        .expect("dev user lookup should succeed");
    assert!(hidden_from_dev.is_empty());

    let visible_for_owner = repository
        .fetch_station_profile_loads_for_user("6f000000-0000-0000-0000-000000000001", USER_B_ID)
        .await
        .expect("owner lookup should succeed");
    assert_eq!(visible_for_owner, vec![7.5, 10.0]);
}
