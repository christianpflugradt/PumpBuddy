mod support;

use self::support::{active_workout_fixture, test_lock, TestDatabase};
use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use pumpbuddy_backend::persistence::DomainRepository;
use sqlx::Row;
use std::collections::{BTreeMap, HashMap, HashSet};

const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";
const USER_B_ID: &str = "00000000-0000-0000-0000-000000000012";

#[tokio::test]
async fn seed_invariants_match_current_seed_requirements() {
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

    assert_eq!(plan_counts.len(), 3);
    assert_eq!(plan_counts.get("Leg Day"), Some(&6));
    assert_eq!(plan_counts.get("Push Day"), Some(&6));
    assert_eq!(plan_counts.get("Pull Day"), Some(&6));

    let multi_variant_rows = sqlx::query(
        "SELECT tp.name, COUNT(*)::bigint AS multi_variant_exercise_count
         FROM (
             SELECT tpv.training_plan_id, tpe.id
             FROM training_plan_exercises tpe
             JOIN training_plan_versions tpv ON tpv.id = tpe.training_plan_version_id
             JOIN training_plan_exercise_variants peo ON peo.training_plan_exercise_id = tpe.id
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
            >= 1
    );

    let option_diff_rows = sqlx::query(
        "SELECT
            string_agg(exercise_variant_id::text, ',' ORDER BY exercise_variant_id::text) AS variants
         FROM training_plan_exercise_variants
         WHERE training_plan_exercise_id = $1::uuid",
    )
    .bind("32000000-0000-0000-0000-000000000009")
    .fetch_all(pool)
    .await
    .expect("option variant query should succeed");

    assert_eq!(option_diff_rows.len(), 1);
    let configured_gym_variants: String = option_diff_rows[0].get("variants");
    assert!(configured_gym_variants.contains("20000000-0000-0000-0000-000000000010"));
    assert!(configured_gym_variants.contains("20000000-0000-0000-0000-000000000011"));
}

#[tokio::test]
async fn load_input_mode_does_not_backfill_preexisting_variants() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;

    sqlx::raw_sql(
        "DROP TABLE IF EXISTS \
        workout_sets, \
        workout_exercises, \
        training_plan_exercise_variants, \
        exercise_variant_equipment_compatibilities, \
        exercise_variants \
        CASCADE",
    )
    .execute(pool)
    .await
    .expect("should drop variant-dependent tables");

    sqlx::raw_sql(
        "CREATE TABLE exercise_variants (
            id UUID PRIMARY KEY,
            exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            variant_type TEXT NOT NULL,
            requires_station BOOLEAN NOT NULL DEFAULT TRUE,
            user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT exercise_variants_exercise_name_unique UNIQUE (exercise_id, user_id, name),
            CONSTRAINT exercise_variants_id_user_unique UNIQUE (id, user_id)
        )",
    )
    .execute(pool)
    .await
    .expect("should create old exercise_variants shape");

    sqlx::query(
        "INSERT INTO exercise_variants (
            id,
            exercise_id,
            name,
            variant_type,
            requires_station,
            user_id
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)",
    )
    .bind("29999999-0000-0000-0000-000000000001")
    .bind("10000000-0000-0000-0000-000000000001")
    .bind("Pre-Migration Variant")
    .bind("barbell")
    .bind(true)
    .bind("00000000-0000-0000-0000-000000000001")
    .execute(pool)
    .await
    .expect("should insert pre-migration variant row");

    sqlx::raw_sql(include_str!("../../runtime/database/00-schema.sql"))
        .execute(pool)
        .await
        .expect("schema initialization should keep fresh-install baseline behavior");

    let read_err = sqlx::query(
        "SELECT load_input_mode
         FROM exercise_variants
         WHERE id = $1::uuid",
    )
    .bind("29999999-0000-0000-0000-000000000001")
    .fetch_one(pool)
    .await
    .expect_err("legacy table shape should remain unmigrated in fresh-install baseline");

    assert!(read_err.to_string().contains("load_input_mode"));
}

#[tokio::test]
async fn load_input_mode_rejects_invalid_variant_values() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let pool = &db.pool;

    let insert_err = sqlx::query(
        "INSERT INTO exercise_variants (
            id,
            exercise_id,
            name,
            variant_type,
            requires_station,
            load_input_mode
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)",
    )
    .bind("29999999-0000-0000-0000-000000000002")
    .bind("10000000-0000-0000-0000-000000000001")
    .bind("Invalid Mode Variant")
    .bind("barbell")
    .bind(true)
    .bind("INVALID_MODE")
    .execute(pool)
    .await
    .expect_err("invalid load_input_mode should violate check constraint");

    let message = insert_err.to_string();
    assert!(message.contains("exercise_variants_load_input_mode_check"));
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
async fn option_read_path_respects_gym_filter_for_seeded_plan() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool);

    let configured_gym_options = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000000001",
        )
        .await
        .expect("seeded gym option query should succeed");
    let unknown_gym_options = repository
        .fetch_training_plan_exercise_variant_summaries(
            "30000000-0000-0000-0000-000000000002",
            "50000000-0000-0000-0000-000000009999",
        )
        .await
        .expect("unknown gym option query should succeed");

    assert!(!configured_gym_options.is_empty());
    assert!(!unknown_gym_options.is_empty());
    assert!(unknown_gym_options
        .iter()
        .all(|option| option.station_id.is_none()));
    assert!(configured_gym_options.len() > unknown_gym_options.len());

    let configured_ex3 = configured_gym_options
        .iter()
        .filter(|option| option.exercise_position == 3)
        .count();
    assert!(configured_ex3 >= 2);
    let configured_ex3_variants: HashSet<String> = configured_gym_options
        .iter()
        .filter(|option| option.exercise_position == 3)
        .map(|option| option.variant_id.clone())
        .collect();
    assert!(configured_ex3_variants.contains("20000000-0000-0000-0000-000000000010"));
    assert!(configured_ex3_variants.contains("20000000-0000-0000-0000-000000000011"));

    for option in &configured_gym_options {
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
async fn formula_profile_option_loads_are_deterministic_finite_sorted_and_capped_at_300kg() {
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
    assert_eq!(loads.last().copied(), Some(300.0));
    assert!(loads.iter().all(|load| load.is_finite()));
    assert!(loads.windows(2).all(|pair| pair[0] <= pair[1]));
    assert!(loads.iter().all(|load| *load <= 300.0 + 1e-9));
    assert!(loads.iter().any(|load| (*load - 300.0).abs() <= 1e-9));
    assert_eq!(first_formula_option.suggested_start_load_kg, Some(20.0));
    assert_eq!(second_formula_option.suggested_start_load_kg, Some(20.0));
}

#[tokio::test]
async fn formula_profile_option_loads_with_zero_min_include_300kg() {
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
    assert!((loads[loads.len() - 1] - 300.0).abs() <= 1e-9);
    assert!(loads.iter().all(|load| load.is_finite()));
    assert!(loads.windows(2).all(|pair| pair[0] <= pair[1]));
    assert!(loads.iter().all(|load| *load <= 300.0 + 1e-9));
    assert!(loads.iter().any(|load| (*load - 300.0).abs() <= 1e-9));
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
                        reps: Some(10),
                        load_display_value: Some(20.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(20.0),
                        completed_at: Some("2026-01-15T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(8),
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
                        reps: None,
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
                        reps: None,
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
            selected_training_plan_exercise_variant_id::text AS selected_training_plan_exercise_variant_id
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
                    reps: Some(10),
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
                    reps: Some(10),
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
                    reps: Some(10),
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
    assert_eq!(created.exercises[0].suggested_set.reps, Some(10));
    assert!(created.exercises[1].completed_sets.is_empty());
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
                            reps: Some(8),
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
    assert_eq!(updated.exercises[1].suggested_set.reps, Some(8));
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
            reps: Some(8),
            load_display_value: Some(22.5),
            load_display_unit: "kg".to_owned(),
            load_canonical_kg: Some(22.5),
            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
        }],
    };

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
                    reps: None,
                    load_display_value: Some(10.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(10.0),
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
                            reps: Some(12),
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
                            reps: Some(8),
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
                            reps: Some(12),
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
                            reps: Some(8),
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
                            reps: Some(8),
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
                    reps: Some(12),
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
                        reps: Some(10),
                        load_display_value: Some(20.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(20.0),
                        completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(8),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(8));

    let historical_suggestion = &created.exercises[2];
    assert!(historical_suggestion.completed_sets.is_empty());
    assert_eq!(historical_suggestion.suggested_set.load_value, 10.0);
    assert_eq!(historical_suggestion.suggested_set.reps, Some(10));

    let fallback_suggestion = &created.exercises[3];
    assert!(fallback_suggestion.completed_sets.is_empty());
    assert_eq!(fallback_suggestion.suggested_set.load_value, 10.0);
    assert_eq!(fallback_suggestion.suggested_set.reps, Some(10));
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
                            reps: Some(10),
                            load_display_value: Some(20.0),
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: Some(20.0),
                            completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 1,
                            set_side: "RIGHT".to_owned(),
                            reps: Some(9),
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
                        reps: Some(8),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(8),
                        load_display_value: Some(40.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(40.0),
                        completed_at: Some("2026-01-10T09:05:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(7),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(10),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(7));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(8),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(9),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(9));
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
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "LEFT".to_owned(),
                        reps: Some(8),
                        load_display_value: Some(30.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(30.0),
                        completed_at: Some("2026-01-14T09:06:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "RIGHT".to_owned(),
                        reps: Some(7),
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
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    reps: Some(9),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(7));
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
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    reps: Some(6),
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
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    reps: Some(9),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(9));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(9),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(9));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![
                    NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(6),
                        load_display_value: Some(35.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(35.0),
                        completed_at: Some("2026-01-12T09:10:00Z".to_owned()),
                    },
                    NewWorkoutSet {
                        set_index: 2,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(4),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(9),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(9));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(8),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(6),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "LEFT".to_owned(),
                    reps: Some(8),
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
                set_tracking_mode: Some("UNILATERAL".to_owned()),
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "RIGHT".to_owned(),
                    reps: Some(6),
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
    assert_eq!(unilateral.suggested_set.load_value, 20.0);
    assert_eq!(unilateral.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(7),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(5),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
}

#[tokio::test]
async fn suggestions_history_scope_ignores_other_user_history() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

    sqlx::query(
        "INSERT INTO training_plans (id, user_id, name)
         VALUES ($1::uuid, $2::uuid, $3)",
    )
    .bind("39000000-0000-0000-0000-000000000901")
    .bind("00000000-0000-0000-0000-000000000011")
    .bind("User A Push Day")
    .execute(&db.pool)
    .await
    .expect("user-a plan should insert");

    sqlx::query(
        "INSERT INTO training_plan_versions (id, training_plan_id, version_number, user_id)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid)",
    )
    .bind("39100000-0000-0000-0000-000000000901")
    .bind("39000000-0000-0000-0000-000000000901")
    .bind(1)
    .bind("00000000-0000-0000-0000-000000000011")
    .execute(&db.pool)
    .await
    .expect("user-a plan version should insert");

    sqlx::query(
        "INSERT INTO training_plan_exercises (id, training_plan_version_id, exercise_id, user_id, position)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)",
    )
    .bind("39200000-0000-0000-0000-000000000901")
    .bind("39100000-0000-0000-0000-000000000901")
    .bind("10000000-0000-0000-0000-00000000000c")
    .bind("00000000-0000-0000-0000-000000000011")
    .bind(1)
    .execute(&db.pool)
    .await
    .expect("user-a training-plan exercise should insert");

    repository
        .create_workout_for_user(
            &NewWorkout {
                training_plan_id: "39000000-0000-0000-0000-000000000901".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some("2026-01-30T09:00:00Z".to_owned()),
                completed_at: Some("2026-01-30T09:25:00Z".to_owned()),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: "39200000-0000-0000-0000-000000000901".to_owned(),
                    position: 1,
                    selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000002".to_owned()),
                    selected_training_plan_exercise_variant_id: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(4),
                        load_display_value: Some(60.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(60.0),
                        completed_at: Some("2026-01-30T09:08:00Z".to_owned()),
                    }],
                }],
            },
            "00000000-0000-0000-0000-000000000011",
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(5),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(7),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(6),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(4),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(9),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(9));

    let second_exercise = created
        .exercises
        .iter()
        .find(|exercise| exercise.position == 2)
        .expect("position-2 exercise should be present");
    assert!(second_exercise.completed_sets.is_empty());
    assert_eq!(second_exercise.suggested_set.load_value, 10.0);
    assert_eq!(second_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(8),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(5),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(8),
                    load_display_value: Some(30.0),
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: Some(30.0),
                    completed_at: Some("2026-01-18T09:08:00Z".to_owned()),
                }],
            }],
        })
        .await
        .expect("same-user historical workout should create");

    repository
        .create_workout_for_user(
            &NewWorkout {
                training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
                gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                started_at: Some("2026-01-21T09:00:00Z".to_owned()),
                completed_at: Some("2026-01-21T09:25:00Z".to_owned()),
                current_exercise_position: None,
                exercises: vec![NewWorkoutExercise {
                    training_plan_exercise_id: "32000000-0000-0000-0000-000000000007".to_owned(),
                    position: 1,
                    selected_variant_id: Some("20000000-0000-0000-0000-00000000000e".to_owned()),
                    selected_station_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
                    selected_training_plan_exercise_variant_id: None,
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(5),
                        load_display_value: Some(70.0),
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: Some(70.0),
                        completed_at: Some("2026-01-21T09:08:00Z".to_owned()),
                    }],
                }],
            },
            "00000000-0000-0000-0000-000000000012",
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
    assert_eq!(first_exercise.suggested_set.reps, Some(8));
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(8),
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
                set_tracking_mode: None,
                skipped_at: None,
                completed_at: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    set_side: "BILATERAL".to_owned(),
                    reps: Some(6),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(6));
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
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
                    set_tracking_mode: None,
                    skipped_at: None,
                    completed_at: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        set_side: "BILATERAL".to_owned(),
                        reps: Some(6 + index),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
}

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
                        reps: Some(7),
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
                    reps: Some(8),
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
    assert_eq!(first_exercise.suggested_set.load_value, 20.0);
    assert_eq!(first_exercise.suggested_set.reps, Some(10));

    let second_exercise = &created.exercises[1];
    assert!(second_exercise.completed_sets.is_empty());
    assert!((second_exercise.suggested_set.load_value - 18.1436948).abs() < 1e-9);
    assert_eq!(second_exercise.suggested_set.reps, Some(8));
}

#[tokio::test]
async fn weighted_reps_progression_uses_three_five_window_for_loadless_options() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
                        reps: Some(reps),
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
    assert_eq!(nordic_curl.suggested_set.reps, Some(11));
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
                        reps: Some(12),
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
    assert_eq!(first_exercise.suggested_set.reps, Some(10));
    assert!((first_exercise.suggested_set.load_value - 32.5).abs() < 1e-9);
}

#[tokio::test]
async fn null_rep_bounds_disable_weighted_progression_and_keep_legacy_fallback() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
                        reps: Some(reps),
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
    assert_eq!(nordic_curl.suggested_set.reps, Some(14));
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn stationless_history_uses_latest_reps_for_nordic_curl_suggestion() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
                    reps: Some(11),
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
    assert_eq!(nordic_curl.suggested_set.reps, Some(11));
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn stationless_last_current_reuses_reps_when_next_set_is_suggested() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
                    reps: Some(9),
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
    assert_eq!(nordic_curl.suggested_set.reps, None);
    assert_eq!(nordic_curl.suggested_set.load_value, 10.0);
}

#[tokio::test]
async fn stationless_prior_set_lookup_ignores_other_plan_versions() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
                    reps: Some(30),
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
                    reps: Some(11),
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
    assert_eq!(nordic_curl.suggested_set.reps, Some(11));
}

#[tokio::test]
async fn stationless_secs_prior_set_uses_latest_matching_completed_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
                    reps: Some(75),
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
    assert_eq!(plank.suggested_set.reps, Some(75));
}

#[tokio::test]
async fn secs_variant_suggestion_omits_repetition_value() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::require().await;
    let repository = DomainRepository::new(db.pool.clone());

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
    assert_eq!(plank.suggested_set.reps, None);
    assert_eq!(plank.suggested_set.load_value, 10.0);
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
                    reps: Some(10),
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
