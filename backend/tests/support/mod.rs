use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};
use std::{env, path::PathBuf, str::FromStr, sync::OnceLock};
use testcontainers::{
    core::{wait::WaitFor, IntoContainerPort},
    runners::AsyncRunner,
    GenericImage, ImageExt,
};
use tokio::time::{sleep, timeout, Duration};

pub fn test_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

pub struct TestDatabase {
    _container: Option<testcontainers::ContainerAsync<GenericImage>>,
    pub pool: PgPool,
}

impl TestDatabase {
    pub async fn provision() -> Option<Self> {
        let external_database_url = env::var("TEST_DATABASE_URL")
            .ok()
            .or_else(|| env::var("DATABASE_URL").ok());

        if let Some(database_url) = external_database_url {
            let pool = connect_with_retry(&database_url).await;
            initialize_schema(&pool).await;
            return Some(Self {
                _container: None,
                pool,
            });
        }

        if !docker_socket_exists() {
            eprintln!(
                "skipping integration test because no postgres test environment is available"
            );
            return None;
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
                eprintln!("skipping integration test because docker is not usable: {err}");
                return None;
            }
            Err(err) => panic!("should start postgres test container: {err}"),
        };
        let host_port = container
            .get_host_port_ipv4(5432.tcp())
            .await
            .expect("should expose postgres port");

        let database_url =
            format!("postgresql://pumpbuddy:pumpbuddy@127.0.0.1:{host_port}/pumpbuddy");
        let pool = connect_with_retry(&database_url).await;
        initialize_schema(&pool).await;

        Some(Self {
            _container: Some(container),
            pool,
        })
    }
}

#[allow(dead_code)]
pub fn active_workout_fixture() -> NewWorkout {
    NewWorkout {
        training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
        gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
        started_at: Some("2026-02-01T09:00:00Z".to_owned()),
        completed_at: None,
        current_exercise_position: Some(1),
        exercises: vec![NewWorkoutExercise {
            training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
            position: 1,
            selected_variant_id: Some("00000000-0000-0000-0000-000000000401".to_owned()),
            selected_station_id: Some("00000000-0000-0000-0000-000000000701".to_owned()),
            selected_plan_exercise_option_id: Some(
                "00000000-0000-0000-0000-000000001001".to_owned(),
            ),
            sets: vec![NewWorkoutSet {
                set_index: 1,
                reps: Some(10),
                load_display_value: 20.0,
                load_display_unit: "kg".to_owned(),
                load_canonical_kg: 20.0,
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
    for _ in 0..60 {
        let connect_options =
            PgConnectOptions::from_str(database_url).expect("database URL should be valid");

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
        last_error.unwrap_or_else(|| "unknown error".to_owned())
    );
}

async fn initialize_schema(pool: &PgPool) {
    sqlx::raw_sql(include_str!("../../init.sql"))
        .execute(pool)
        .await
        .expect("init.sql should apply cleanly");
}
