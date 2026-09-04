#![allow(dead_code)]

use super::test_runtime::{TESTCONTAINERS_POSTGRES_IMAGE_NAME, TESTCONTAINERS_POSTGRES_IMAGE_TAG};
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

const TEST_DB_CONNECT_ATTEMPT_TIMEOUT: Duration = Duration::from_secs(2);
const TEST_DB_CONNECT_TOTAL_TIMEOUT: Duration = Duration::from_secs(10);
const TEST_DB_CONNECT_RETRY_DELAY: Duration = Duration::from_millis(250);

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

pub struct TestDatabase {
    pub pool: PgPool,
}

impl TestDatabase {
    pub async fn provision() -> Result<Self, TestDatabaseError> {
        let database_url = ensure_testcontainer_database_url().await?;
        let pool = connect_with_retry(&database_url).await;
        reset_test_database(&pool).await;

        Ok(Self { pool })
    }

    pub async fn require() -> Self {
        match Self::provision().await {
            Ok(database) => database,
            Err(err) => panic!("PostgreSQL-backed tests require a database runtime: {err}"),
        }
    }
}

pub fn test_db_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

pub fn test_lock() -> &'static tokio::sync::Mutex<()> {
    test_db_lock()
}

pub async fn resolve_test_database_url() -> String {
    match ensure_testcontainer_database_url().await {
        Ok(url) => url,
        Err(err) => panic!(
            "PostgreSQL-backed tests require a usable Docker runtime for Testcontainers; external database URLs are not supported: {err}"
        ),
    }
}

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

    let postgres = GenericImage::new(
        TESTCONTAINERS_POSTGRES_IMAGE_NAME,
        TESTCONTAINERS_POSTGRES_IMAGE_TAG,
    )
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

    let database_url = format!("postgresql://pumpbuddy:pumpbuddy@127.0.0.1:{host_port}/pumpbuddy");

    *state = Some(ManagedTestContainer {
        _container: container,
        database_url: database_url.clone(),
    });

    Ok(database_url)
}

fn docker_socket_exists() -> bool {
    if let Ok(docker_host) = env::var("DOCKER_HOST") {
        if let Some(socket_path) = docker_host.strip_prefix("unix://") {
            return PathBuf::from(socket_path).exists();
        }

        // Non-Unix Docker endpoints cannot be validated as filesystem paths.
        return true;
    }

    let mut candidates = vec![PathBuf::from("/var/run/docker.sock")];

    if let Some(home) = env::var_os("HOME") {
        candidates.push(PathBuf::from(&home).join(".docker/run/docker.sock"));
        candidates.push(PathBuf::from(&home).join(".rd/docker.sock"));
        candidates.push(PathBuf::from(&home).join(".colima/default/docker.sock"));
    }

    candidates.into_iter().any(|path| path.exists())
}

fn docker_unavailable(message: &str) -> bool {
    message.contains("Operation not permitted")
        || message.contains("Permission denied")
        || message.contains("client error (Connect)")
        || message.contains("failed to create a container")
}

pub async fn connect_with_retry(database_url: &str) -> PgPool {
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

pub async fn reset_test_database(pool: &PgPool) {
    // Drop tables to ensure schema changes in runtime SQL are applied cleanly when tests run.
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
        auth_login_attempts, \
        sessions, \
        user_secrets, \
        users \
        CASCADE",
    )
    .execute(pool)
    .await
    .expect("test database reset should succeed");

    initialize_test_schema(pool).await;
    initialize_test_seed(pool).await;
}

pub async fn initialize_test_schema(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../../../runtime/database/00-schema.sql"))
        .execute(pool)
        .await
        .expect("00-schema.sql should apply cleanly");
}

pub async fn initialize_test_seed(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../../../runtime/database/10-seed-dev.sql"))
        .execute(pool)
        .await
        .expect("10-seed-dev.sql should apply cleanly");
}
