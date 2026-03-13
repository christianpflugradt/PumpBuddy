use sqlx::PgPool;
use std::{env, path::PathBuf, sync::OnceLock};

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
