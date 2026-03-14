use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};
use std::{env, path::PathBuf, str::FromStr, sync::OnceLock};
use tokio::time::{sleep, timeout, Duration};

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
    let mut last_error = None;
    for _ in 0..60 {
        let connect_options =
            PgConnectOptions::from_str(database_url).expect("database URL should be valid");

        match timeout(
            Duration::from_secs(2),
            PgPoolOptions::new()
                .max_connections(1)
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
        last_error.unwrap_or_else(|| "unknown error".to_owned())
    );
}

pub async fn reset_test_database(pool: &PgPool) {
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
}
