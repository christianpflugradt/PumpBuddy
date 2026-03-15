use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};
use std::{env, path::PathBuf, str::FromStr, sync::OnceLock};
use tokio::net::TcpStream;
use tokio::time::{sleep, timeout, Duration};

const TEST_DB_CONNECT_ATTEMPT_TIMEOUT: Duration = Duration::from_secs(2);
const TEST_DB_CONNECT_TOTAL_TIMEOUT: Duration = Duration::from_secs(10);
const TEST_DB_CONNECT_RETRY_DELAY: Duration = Duration::from_millis(250);
const TEST_DB_LOCAL_PREFLIGHT_TIMEOUT: Duration = Duration::from_millis(500);

fn uses_local_compose_test_database(database_url: &str) -> bool {
    database_url.contains("@localhost:5433/") || database_url.contains("@127.0.0.1:5433/")
}

async fn preflight_local_test_database(database_url: &str) {
    if !uses_local_compose_test_database(database_url) {
        return;
    }

    match timeout(
        TEST_DB_LOCAL_PREFLIGHT_TIMEOUT,
        TcpStream::connect(("127.0.0.1", 5433)),
    )
    .await
    {
        Ok(Ok(_)) => {}
        Ok(Err(_)) | Err(_) => panic!(
            "PostgreSQL test database is unavailable at localhost:5433. Start it with: docker compose --profile test up -d postgres-test"
        ),
    }
}

pub fn test_db_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

pub fn load_test_env() {
    if env::var("TEST_DATABASE_URL").is_ok() || env::var("DATABASE_URL").is_ok() {
        return;
    }

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let path = PathBuf::from(manifest_dir).join("test.env");
    if path.exists() {
        if let Err(err) = dotenvy::from_path(&path) {
            panic!(
                "Failed to load test environment from {}: {err}",
                path.display()
            );
        }
    }
}

pub fn resolve_test_database_url() -> String {
    load_test_env();
    env::var("TEST_DATABASE_URL")
        .or_else(|_| env::var("DATABASE_URL"))
        .unwrap_or_else(|_| {
            panic!(
                "PostgreSQL-backed tests require TEST_DATABASE_URL or DATABASE_URL (see backend/test.env)."
            )
        })
}

pub async fn connect_with_retry(database_url: &str) -> PgPool {
    preflight_local_test_database(database_url).await;

    let mut last_error = None;
    let start = std::time::Instant::now();

    while start.elapsed() < TEST_DB_CONNECT_TOTAL_TIMEOUT {
        let connect_options =
            PgConnectOptions::from_str(database_url).expect("database URL should be valid");

        match timeout(
            TEST_DB_CONNECT_ATTEMPT_TIMEOUT,
            PgPoolOptions::new()
                .max_connections(1)
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
    initialize_test_schema(pool).await;
    sqlx::raw_sql(
        "TRUNCATE TABLE \
        workout_sets, \
        workout_exercises, \
        workouts, \
        plan_exercise_options, \
        exercise_variant_equipment_compatibilities, \
        exercise_variants, \
        training_plan_exercises, \
        equipment_stations, \
        load_steps, \
        load_profiles, \
        gyms, \
        exercises, \
        training_plans \
        RESTART IDENTITY CASCADE",
    )
    .execute(pool)
    .await
    .expect("test database reset should succeed");
    initialize_test_schema(pool).await;
}

pub async fn initialize_test_schema(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../init.sql"))
        .execute(pool)
        .await
        .expect("init.sql should apply cleanly");
}
