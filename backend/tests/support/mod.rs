use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};
use std::{env, path::PathBuf, str::FromStr, sync::OnceLock};
use testcontainers::{
    core::{wait::WaitFor, IntoContainerPort},
    runners::AsyncRunner,
    ContainerAsync, GenericImage, ImageExt,
};
use tokio::time::{sleep, timeout, Duration};

#[allow(dead_code)]
const TEST_DB_CONNECT_ATTEMPT_TIMEOUT: Duration = Duration::from_secs(2);
#[allow(dead_code)]
const TEST_DB_CONNECT_TOTAL_TIMEOUT: Duration = Duration::from_secs(10);
#[allow(dead_code)]
const TEST_DB_CONNECT_RETRY_DELAY: Duration = Duration::from_millis(250);
#[allow(dead_code)]
pub fn test_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

#[allow(dead_code)]
pub struct TestDatabase {
    pub pool: PgPool,
}

struct ManagedTestContainer {
    _container: ContainerAsync<GenericImage>,
    database_url: String,
}

fn testcontainer_state() -> &'static tokio::sync::Mutex<Option<ManagedTestContainer>> {
    static STATE: OnceLock<tokio::sync::Mutex<Option<ManagedTestContainer>>> = OnceLock::new();
    STATE.get_or_init(|| tokio::sync::Mutex::new(None))
}

#[derive(Debug)]
pub enum TestDatabaseError {
    MissingRuntime(String),
    UnusableRuntime(String),
}

impl std::fmt::Display for TestDatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingRuntime(message) | Self::UnusableRuntime(message) => {
                write!(f, "{message}")
            }
        }
    }
}

#[allow(dead_code)]
impl TestDatabase {
    async fn ensure_testcontainer_database_url() -> Result<String, TestDatabaseError> {
        if !docker_socket_exists() {
            return Err(TestDatabaseError::MissingRuntime(
                "PostgreSQL test runtime unavailable. Ensure Docker is running with an accessible socket for Testcontainers."
                    .to_owned(),
            ));
        }

        let mut state = testcontainer_state().lock().await;
        if let Some(existing) = state.as_ref() {
            return Ok(existing.database_url.clone());
        }

        let postgres = GenericImage::new("postgres", "17-alpine")
            .with_exposed_port(5432.tcp())
            .with_wait_for(WaitFor::message_on_stderr(
                "database system is ready to accept connections",
            ))
            .with_env_var("POSTGRES_DB", "pumpbuddy")
            .with_env_var("POSTGRES_USER", "pumpbuddy")
            .with_env_var("POSTGRES_PASSWORD", "pumpbuddy");

        let container = match postgres.start().await {
            Ok(container) => container,
            Err(err) if docker_unavailable(&err.to_string()) => {
                return Err(TestDatabaseError::UnusableRuntime(format!(
                    "PostgreSQL test runtime unavailable because Docker is not usable: {err}"
                )));
            }
            Err(err) => panic!("should start postgres test container: {err}"),
        };
        let host_port = container
            .get_host_port_ipv4(5432.tcp())
            .await
            .expect("should expose postgres port");

        let database_url =
            format!("postgresql://pumpbuddy:pumpbuddy@127.0.0.1:{host_port}/pumpbuddy");

        *state = Some(ManagedTestContainer {
            _container: container,
            database_url: database_url.clone(),
        });

        Ok(database_url)
    }

    #[allow(dead_code)]
    pub async fn provision() -> Result<Self, TestDatabaseError> {
        let database_url = Self::ensure_testcontainer_database_url().await?;
        let pool = connect_with_retry(&database_url).await;
        reset_test_database(&pool).await;

        Ok(Self { pool })
    }

    #[allow(dead_code)]
    pub async fn require() -> Self {
        match Self::provision().await {
            Ok(database) => database,
            Err(err) => panic!("PostgreSQL-backed tests require a database runtime: {err}"),
        }
    }
}

#[allow(dead_code)]
pub fn active_workout_fixture() -> NewWorkout {
    NewWorkout {
        training_plan_id: "30000000-0000-0000-0000-000000000002".to_owned(),
        gym_id: Some("50000000-0000-0000-0000-000000000001".to_owned()),
        started_at: Some("2026-02-01T09:00:00Z".to_owned()),
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
            sets: vec![NewWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                repetition_value: Some(10),
                load_display_value: Some(20.0),
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: Some(20.0),
                completed_at: Some("2026-02-01T09:05:00Z".to_owned()),
            }],
        }],
    }
}

fn docker_socket_exists() -> bool {
    let mut candidates = vec![PathBuf::from("/var/run/docker.sock")];

    if let Some(home) = env::var_os("HOME") {
        candidates.push(PathBuf::from(&home).join(".docker/run/docker.sock"));
        candidates.push(PathBuf::from(home).join(".rd/docker.sock"));
    }

    candidates.into_iter().any(|path| path.exists())
}

fn docker_unavailable(message: &str) -> bool {
    message.contains("Operation not permitted")
        || message.contains("Permission denied")
        || message.contains("client error (Connect)")
        || message.contains("failed to create a container")
}

async fn connect_with_retry(database_url: &str) -> PgPool {
    let mut last_error = None;
    let start = std::time::Instant::now();

    while start.elapsed() < TEST_DB_CONNECT_TOTAL_TIMEOUT {
        let connect_options =
            PgConnectOptions::from_str(database_url).expect("database URL should be valid");

        match timeout(
            TEST_DB_CONNECT_ATTEMPT_TIMEOUT,
            PgPoolOptions::new()
                .max_connections(5)
                .connect_with(connect_options),
        )
        .await
        {
            Ok(Ok(pool)) => return pool,
            Ok(Err(err)) => {
                last_error = Some(err.to_string());
                sleep(TEST_DB_CONNECT_RETRY_DELAY).await;
            }
            Err(err) => {
                last_error = Some(err.to_string());
                sleep(TEST_DB_CONNECT_RETRY_DELAY).await;
            }
        }
    }

    panic!(
        "should connect to postgres within {}s: {}",
        TEST_DB_CONNECT_TOTAL_TIMEOUT.as_secs(),
        last_error.unwrap_or_else(|| "unknown error".to_owned())
    );
}

async fn initialize_schema(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../../../runtime/database/00-schema.sql"))
        .execute(pool)
        .await
        .expect("00-schema.sql should apply cleanly");
}

async fn initialize_seed(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../../../runtime/database/10-seed-dev.sql"))
        .execute(pool)
        .await
        .expect("10-seed-dev.sql should apply cleanly");
}

async fn reset_test_database(pool: &PgPool) {
    // Drop tables so schema-shape tests that mutate DDL do not leak across cases.
    sqlx::raw_sql(
        "DROP TABLE IF EXISTS \
        workout_sets, \
        workout_exercises, \
        workouts, \
        training_plan_exercise_variants, \
        exercise_variant_equipment_compatibilities, \
        exercise_variants, \
        training_plan_exercises, \
        training_plan_versions, \
        equipment_stations, \
        load_profiles, \
        gyms, \
        exercises, \
        training_plans, \
        user_preferences, \
        sessions, \
        user_secrets, \
        users \
        CASCADE",
    )
    .execute(pool)
    .await
    .expect("test database reset should succeed");
    initialize_schema(pool).await;
    initialize_seed(pool).await;
}
