use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use pumpbuddy_backend::persistence::DomainRepository;
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool, Row,
};
use std::{collections::HashMap, env, str::FromStr, sync::OnceLock};
use testcontainers::{
    core::{wait::WaitFor, IntoContainerPort},
    runners::AsyncRunner,
    GenericImage, ImageExt,
};
use tokio::time::{sleep, timeout, Duration};

fn test_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

struct TestDatabase {
    _container: Option<testcontainers::ContainerAsync<GenericImage>>,
    pool: PgPool,
}

impl TestDatabase {
    async fn provision() -> Self {
        let external_database_url = env::var("TEST_DATABASE_URL")
            .ok()
            .or_else(|| env::var("DATABASE_URL").ok());

        if let Some(database_url) = external_database_url {
            let pool = connect_with_retry(&database_url).await;

            initialize_schema(&pool).await;
            return Self {
                _container: None,
                pool,
            };
        }

        let postgres = GenericImage::new("postgres", "17-alpine")
            .with_exposed_port(5432.tcp())
            .with_wait_for(WaitFor::message_on_stderr(
                "database system is ready to accept connections",
            ))
            .with_env_var("POSTGRES_DB", "pumpbuddy")
            .with_env_var("POSTGRES_USER", "pumpbuddy")
            .with_env_var("POSTGRES_PASSWORD", "pumpbuddy");

        let container = postgres
            .start()
            .await
            .expect("should start postgres test container");
        let host_port = container
            .get_host_port_ipv4(5432.tcp())
            .await
            .expect("should expose postgres port");

        let database_url =
            format!("postgresql://pumpbuddy:pumpbuddy@127.0.0.1:{host_port}/pumpbuddy");

        let pool = connect_with_retry(&database_url).await;

        initialize_schema(&pool).await;

        Self {
            _container: Some(container),
            pool,
        }
    }
}

async fn connect_with_retry(database_url: &str) -> PgPool {
    let mut last_error = None;
    for _ in 0..60 {
        let connect_options = PgConnectOptions::from_str(database_url)
            .expect("database URL should be valid");

        match timeout(
            Duration::from_secs(2),
            PgPoolOptions::new()
                .max_connections(5)
                .connect_with(connect_options),
        )
        .await
        {
            Ok(Ok(pool)) => return pool,
            Ok(Err(err)) => {
                last_error = Some(err.to_string());
                sleep(Duration::from_secs(1)).await;
            }
            Err(err) => {
                last_error = Some(err.to_string());
                sleep(Duration::from_secs(1)).await;
            }
        }
    }

    panic!(
        "should connect to postgres within retry budget: {}",
        last_error
            .map(|err| err.to_string())
            .unwrap_or_else(|| "unknown error".to_owned())
    );
}

async fn initialize_schema(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../init.sql"))
        .execute(pool)
        .await
        .expect("init.sql should apply cleanly");
}

#[tokio::test]
async fn seed_invariants_match_pb004_requirements() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::provision().await;
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
         LEFT JOIN training_plan_exercises tpe ON tpe.training_plan_id = tp.id
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
             SELECT tpe.training_plan_id, tpe.id
             FROM training_plan_exercises tpe
             JOIN plan_exercise_options peo ON peo.training_plan_exercise_id = tpe.id
             GROUP BY tpe.training_plan_id, tpe.id
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

    assert!(multi_variant_counts.get("Push Day").copied().unwrap_or_default() >= 2);
    assert!(multi_variant_counts.get("Pull Day").copied().unwrap_or_default() >= 2);

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
async fn option_read_path_is_gym_specific() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::provision().await;
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
async fn workout_write_and_read_paths_round_trip() {
    let _guard = test_lock().lock().await;
    let db = TestDatabase::provision().await;
    let repository = DomainRepository::new(db.pool);

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-01-15T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-15T09:35:00Z".to_owned()),
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
