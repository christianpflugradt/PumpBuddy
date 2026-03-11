use pumpbuddy_backend::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
use pumpbuddy_backend::persistence::DomainRepository;
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool, Row,
};
use std::{collections::HashMap, env, path::PathBuf, str::FromStr, sync::OnceLock};
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
    async fn provision() -> Option<Self> {
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

        Some(Self {
            _container: Some(container),
            pool,
        })
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
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
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
            >= 2
    );

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
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
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
async fn gyms_read_path_returns_seeded_summaries_in_stable_order() {
    let _guard = test_lock().lock().await;
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
    let repository = DomainRepository::new(db.pool);

    let gyms = repository
        .fetch_gym_summaries()
        .await
        .expect("gym summaries query should succeed");

    let gym_names: Vec<&str> = gyms.iter().map(|gym| gym.name.as_str()).collect();
    assert_eq!(gym_names, vec!["Forge Downtown", "Iron Temple West"]);
    assert_eq!(gyms[0].id, "00000000-0000-0000-0000-000000000101");
    assert_eq!(gyms[1].id, "00000000-0000-0000-0000-000000000102");
}

#[tokio::test]
async fn workout_write_and_read_paths_round_trip() {
    let _guard = test_lock().lock().await;
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
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

#[tokio::test]
async fn create_workout_persists_one_set_per_exercise_with_placeholder_nulls() {
    let _guard = test_lock().lock().await;
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-01-16T09:00:00Z".to_owned()),
            completed_at: Some("2026-01-16T09:20:00Z".to_owned()),
            exercises: vec![
                NewWorkoutExercise {
                    training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                    position: 1,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_plan_exercise_option_id: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        reps: None,
                        load_display_value: 20.0,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 20.0,
                        completed_at: Some("2026-01-16T09:05:00Z".to_owned()),
                    }],
                },
                NewWorkoutExercise {
                    training_plan_exercise_id: "00000000-0000-0000-0000-000000000802".to_owned(),
                    position: 2,
                    selected_variant_id: None,
                    selected_station_id: None,
                    selected_plan_exercise_option_id: None,
                    sets: vec![NewWorkoutSet {
                        set_index: 1,
                        reps: None,
                        load_display_value: 22.5,
                        load_display_unit: "kg".to_owned(),
                        load_canonical_kg: 22.5,
                        completed_at: Some("2026-01-16T09:10:00Z".to_owned()),
                    }],
                },
            ],
        })
        .await
        .expect("workout create should succeed");

    assert_eq!(
        created.training_plan_id,
        "00000000-0000-0000-0000-000000000201"
    );
    assert_eq!(created.gym_id, "00000000-0000-0000-0000-000000000101");
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
    assert!(created
        .exercises
        .iter()
        .all(|exercise| exercise.selected_plan_exercise_option_id.is_none()));

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
            selected_plan_exercise_option_id::text AS selected_plan_exercise_option_id
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
                .get::<Option<String>, _>("selected_plan_exercise_option_id")
                .is_none()
    }));
}

#[tokio::test]
async fn active_workout_persistence_supports_resume_and_completion() {
    let _guard = test_lock().lock().await;
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
    let repository = DomainRepository::new(db.pool.clone());

    let initial = NewWorkout {
        training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
        gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
        started_at: Some("2026-02-01T09:00:00Z".to_owned()),
        completed_at: None,
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
    };

    let created = repository
        .create_active_workout(&initial)
        .await
        .expect("active workout create should succeed");

    assert_eq!(created.exercises.len(), 1);
    assert_eq!(created.current_exercise_position, 2);
    assert_eq!(created.total_exercise_count, 5);

    let resumed = repository
        .fetch_first_active_workout()
        .await
        .expect("active workout fetch should succeed")
        .expect("active workout should exist");
    assert_eq!(resumed.id, created.id);
    assert_eq!(resumed.current_exercise_position, 2);

    let updated = repository
        .update_active_workout(
            &created.id,
            &NewWorkout {
                training_plan_id: initial.training_plan_id.clone(),
                gym_id: initial.gym_id.clone(),
                started_at: initial.started_at.clone(),
                completed_at: None,
                exercises: vec![
                    initial.exercises[0].clone(),
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000802"
                            .to_owned(),
                        position: 2,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000403".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000703".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001003".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(8),
                            load_display_value: 22.5,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 22.5,
                            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
                        }],
                    },
                ],
            },
        )
        .await
        .expect("active workout update should succeed");

    assert_eq!(updated.exercises.len(), 2);
    assert_eq!(updated.current_exercise_position, 3);

    let second_confirmed_exercise = NewWorkoutExercise {
        training_plan_exercise_id: "00000000-0000-0000-0000-000000000802".to_owned(),
        position: 2,
        selected_variant_id: Some("00000000-0000-0000-0000-000000000403".to_owned()),
        selected_station_id: Some("00000000-0000-0000-0000-000000000706".to_owned()),
        selected_plan_exercise_option_id: Some("00000000-0000-0000-0000-000000001003".to_owned()),
        sets: vec![NewWorkoutSet {
            set_index: 1,
            reps: Some(8),
            load_display_value: 22.5,
            load_display_unit: "kg".to_owned(),
            load_canonical_kg: 22.5,
            completed_at: Some("2026-02-01T09:10:00Z".to_owned()),
        }],
    };

    let second = repository
        .create_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-02T09:00:00Z".to_owned()),
            completed_at: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_plan_exercise_option_id: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: None,
                    load_display_value: 10.0,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: 10.0,
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

    let completion_summary = repository
        .complete_active_workout(
            &created.id,
            &NewWorkout {
                training_plan_id: initial.training_plan_id.clone(),
                gym_id: initial.gym_id.clone(),
                started_at: initial.started_at.clone(),
                completed_at: Some("2026-02-01T09:30:00Z".to_owned()),
                exercises: vec![
                    initial.exercises[0].clone(),
                    second_confirmed_exercise,
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000803"
                            .to_owned(),
                        position: 3,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000404".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000703".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001005".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(12),
                            load_display_value: 25.0,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 25.0,
                            completed_at: Some("2026-02-01T09:20:00Z".to_owned()),
                        }],
                    },
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000804"
                            .to_owned(),
                        position: 4,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000406".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000701".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001008".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(8),
                            load_display_value: 30.0,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 30.0,
                            completed_at: Some("2026-02-01T09:24:00Z".to_owned()),
                        }],
                    },
                    NewWorkoutExercise {
                        training_plan_exercise_id: "00000000-0000-0000-0000-000000000805"
                            .to_owned(),
                        position: 5,
                        selected_variant_id: Some(
                            "00000000-0000-0000-0000-000000000408".to_owned(),
                        ),
                        selected_station_id: Some(
                            "00000000-0000-0000-0000-000000000703".to_owned(),
                        ),
                        selected_plan_exercise_option_id: Some(
                            "00000000-0000-0000-0000-000000001011".to_owned(),
                        ),
                        sets: vec![NewWorkoutSet {
                            set_index: 1,
                            reps: Some(12),
                            load_display_value: 35.0,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 35.0,
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
async fn active_workout_cancellation_deletes_persisted_records_and_rejects_completed_workouts() {
    let _guard = test_lock().lock().await;
    let Some(db) = TestDatabase::provision().await else {
        return;
    };
    let repository = DomainRepository::new(db.pool.clone());

    let created = repository
        .create_active_workout(&NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-03T09:00:00Z".to_owned()),
            completed_at: None,
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
                    completed_at: Some("2026-02-03T09:05:00Z".to_owned()),
                }],
            }],
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
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-03T10:00:00Z".to_owned()),
            completed_at: Some("2026-02-03T10:05:00Z".to_owned()),
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
