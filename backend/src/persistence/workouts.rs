use super::{logging, DomainRepository, PersistenceError};
use super::{WorkoutDetailReadModel, WorkoutProgressReadModel, WorkoutSummaryReadModel};
use crate::domain::{
    normalize_repetition_kind, NewWorkout, Workout, WorkoutDetailExercise, WorkoutDetailHero,
    WorkoutDetailSetLine, WorkoutExercise, WorkoutHistorySummary, WorkoutSet, REPETITION_KIND_REPS,
};
use crate::workout_metrics;
use sqlx::Row;
use std::collections::HashMap;
use uuid::Uuid;

pub(super) async fn fetch_strength_sample_rows_12m(
    repository: &DomainRepository,
    user_id: &str,
    variant_ids: &[String],
) -> Result<Vec<workout_metrics::StrengthSampleSetRow>, PersistenceError> {
    if variant_ids.is_empty() {
        return Ok(Vec::new());
    }

    let parsed_variant_ids: Vec<Uuid> = variant_ids
        .iter()
        .filter_map(|id| id.parse::<Uuid>().ok())
        .collect();
    if parsed_variant_ids.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query(
        "SELECT
            we.selected_variant_id::text AS variant_id,
            COALESCE(ev.repetition_kind, 'REPS') AS repetition_kind,
            w.completed_at::text AS completed_at,
            w.id::text AS workout_id,
            we.selected_station_id::text AS station_id,
            CASE
                WHEN es.id IS NULL THEN NULL
                WHEN g.name IS NULL OR trim(g.name) = '' THEN es.name
                ELSE (es.name || ' · ' || g.name)
            END AS station_label,
            ws.load_canonical_kg::double precision AS load_kg,
            ws.repetition_value AS repetition_value
         FROM workouts w
         JOIN workout_exercises we
           ON we.workout_id = w.id
          AND we.user_id = $1::uuid
         JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         LEFT JOIN equipment_stations es ON es.id = we.selected_station_id
         LEFT JOIN gyms g ON g.id = es.gym_id
         LEFT JOIN workout_sets ws
           ON ws.workout_exercise_id = we.id
          AND ws.user_id = $1::uuid
         WHERE w.user_id = $1::uuid
           AND w.completed_at IS NOT NULL
           AND w.completed_at >= (NOW() - INTERVAL '12 months')
           AND we.selected_variant_id = ANY($2)
         ORDER BY
           we.selected_variant_id ASC,
           w.completed_at ASC,
           w.id ASC,
           we.id ASC,
           ws.set_index ASC,
           CASE ws.set_side
             WHEN 'LEFT' THEN 0
             WHEN 'RIGHT' THEN 1
             WHEN 'BILATERAL' THEN 2
             ELSE 3
           END ASC",
    )
    .bind(user_id)
    .bind(&parsed_variant_ids)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| workout_metrics::StrengthSampleSetRow {
            variant_id: row.get("variant_id"),
            repetition_kind: row.get("repetition_kind"),
            completed_at: row.get("completed_at"),
            workout_id: row.get("workout_id"),
            station_id: row.get("station_id"),
            station_label: row.get("station_label"),
            load_kg: row.get("load_kg"),
            repetition_value: row.get("repetition_value"),
        })
        .collect())
}

pub(super) async fn fetch_workout_history(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<WorkoutHistorySummary>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.name AS training_plan_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            g.name AS gym_name,
            CASE
                WHEN w.started_at IS NOT NULL
                     AND w.completed_at IS NOT NULL
                     AND w.completed_at > w.started_at
                    THEN GREATEST(
                        1,
                        FLOOR(EXTRACT(EPOCH FROM (w.completed_at - w.started_at)) / 60.0)::bigint
                    )
                ELSE 1
            END AS duration_minutes
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
         WHERE w.user_id = $1::uuid
         ORDER BY COALESCE(w.completed_at, w.started_at, w.created_at) DESC, w.id DESC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| WorkoutHistorySummary {
            id: row.get("id"),
            training_plan_name: row.get("training_plan_name"),
            started_at: row.get("started_at"),
            completed_at: row.get("completed_at"),
            gym_name: row.get("gym_name"),
            duration_minutes: row.get("duration_minutes"),
        })
        .collect())
}

pub(super) async fn fetch_workout_progress_read_models(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<WorkoutProgressReadModel>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.name AS training_plan_name,
            w.completed_at::text AS completed_at
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         WHERE w.user_id = $1::uuid
           AND w.completed_at IS NOT NULL
           AND w.completed_at >= (NOW() - INTERVAL '30 days')
         ORDER BY w.completed_at ASC, w.id ASC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut entries = Vec::with_capacity(rows.len());
    for row in rows {
        let workout_id: String = row.get("id");
        let exercise_scores_by_id =
            fetch_exercise_scores_by_workout_exercise_id(repository, &workout_id, user_id).await?;
        let baseline_by_exercise_id =
            fetch_historical_baseline_max_by_workout_exercise(repository, &workout_id, user_id)
                .await?;
        entries.push(WorkoutProgressReadModel {
            id: workout_id,
            training_plan_name: row.get("training_plan_name"),
            completed_at: row.get("completed_at"),
            exercise_scores_by_id,
            baseline_by_exercise_id,
        });
    }

    Ok(entries)
}

pub(super) async fn fetch_in_window_exercise_performance_samples(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<workout_metrics::ExercisePerformanceSample>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            w.id::text AS workout_id,
            we.id::text AS workout_exercise_id,
            we.selected_variant_id::text AS variant_id,
            ex.name AS exercise_name,
            ev.name AS variant_name,
            we.selected_station_id::text AS station_id,
            w.completed_at::text AS completed_at,
            w.completed_at::text AS completed_at_ordering,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - w.completed_at)) / 86400.0)::int AS last_performed_days_ago,
            we.position AS exercise_position,
            COALESCE(ev.repetition_kind, 'REPS') AS repetition_kind,
            we.performance_score AS performance_score,
            historical.max_historical_performance_score AS max_historical_performance_score
        FROM workouts w
        JOIN workout_exercises we
          ON we.workout_id = w.id
         AND we.user_id = $1::uuid
        JOIN exercise_variants ev ON ev.id = we.selected_variant_id
        JOIN exercises ex ON ex.id = ev.exercise_id
        LEFT JOIN LATERAL (
            SELECT COALESCE(
                MAX(
                    CASE
                        WHEN w_historical.completed_at >= (w.completed_at - INTERVAL '30 days')
                            THEN we_historical.performance_score
                        ELSE NULL
                    END
                ),
                MAX(we_historical.performance_score)
            ) AS max_historical_performance_score
            FROM workouts w_historical
            JOIN workout_exercises we_historical ON we_historical.workout_id = w_historical.id
            WHERE w_historical.user_id = $1::uuid
              AND we_historical.user_id = $1::uuid
              AND w_historical.completed_at IS NOT NULL
              AND w_historical.completed_at >= (w.completed_at - INTERVAL '180 days')
              AND w_historical.completed_at < w.completed_at
              AND we_historical.performance_score IS NOT NULL
              AND we_historical.selected_variant_id = we.selected_variant_id
              AND (
                    (we_historical.selected_station_id IS NULL AND we.selected_station_id IS NULL)
                    OR we_historical.selected_station_id = we.selected_station_id
              )
        ) historical ON TRUE
        WHERE w.user_id = $1::uuid
          AND w.completed_at IS NOT NULL
          AND w.completed_at >= (NOW() - INTERVAL '30 days')
          AND we.selected_variant_id IS NOT NULL
        ORDER BY w.completed_at DESC, w.id DESC, we.position ASC, we.id ASC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let performance_score: Option<i32> = row.get("performance_score");
            let baseline: Option<i32> = row.get("max_historical_performance_score");
            workout_metrics::ExercisePerformanceSample {
                workout_id: row.get("workout_id"),
                workout_exercise_id: row.get("workout_exercise_id"),
                variant_id: row.get("variant_id"),
                exercise_name: row.get("exercise_name"),
                variant_name: row.get("variant_name"),
                station_id: row.get("station_id"),
                completed_at: row.get("completed_at"),
                completed_at_ordering: row.get("completed_at_ordering"),
                last_performed_days_ago: row.get("last_performed_days_ago"),
                exercise_position: row.get("exercise_position"),
                repetition_kind: row.get("repetition_kind"),
                performance_score,
                baseline,
            }
        })
        .collect())
}

pub(super) async fn fetch_first_set_summaries(
    repository: &DomainRepository,
    user_id: &str,
    workout_exercise_ids: &[String],
) -> Result<HashMap<String, workout_metrics::FirstSetSummary>, PersistenceError> {
    if workout_exercise_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let parsed_ids: Vec<Uuid> = workout_exercise_ids
        .iter()
        .filter_map(|id| id.parse::<Uuid>().ok())
        .collect();
    if parsed_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query(
        "SELECT
            ws.workout_exercise_id::text AS workout_exercise_id,
            ws.load_canonical_kg::double precision AS load_kg,
            ws.repetition_value AS repetition_value
         FROM workout_sets ws
         WHERE ws.user_id = $1::uuid
           AND ws.workout_exercise_id = ANY($2)
         ORDER BY
            ws.workout_exercise_id ASC,
            ws.set_index ASC,
            CASE ws.set_side
                WHEN 'LEFT' THEN 0
                WHEN 'RIGHT' THEN 1
                WHEN 'BILATERAL' THEN 2
                ELSE 3
            END ASC",
    )
    .bind(user_id)
    .bind(&parsed_ids)
    .fetch_all(&repository.pool)
    .await?;

    let mut first_sets_by_exercise_id: HashMap<String, workout_metrics::FirstSetSummary> =
        HashMap::new();
    for row in rows {
        let workout_exercise_id: String = row.get("workout_exercise_id");
        first_sets_by_exercise_id
            .entry(workout_exercise_id)
            .or_insert_with(|| workout_metrics::FirstSetSummary {
                load_kg: row.get("load_kg"),
                repetition_value: row.get("repetition_value"),
            });
    }

    Ok(first_sets_by_exercise_id)
}

async fn fetch_exercise_scores_by_workout_exercise_id(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<HashMap<String, Option<i32>>, PersistenceError> {
    let exercise_score_rows = sqlx::query(
        "SELECT
            id::text AS workout_exercise_id,
            performance_score
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(exercise_score_rows
        .into_iter()
        .map(|exercise_row| {
            (
                exercise_row.get("workout_exercise_id"),
                exercise_row.get("performance_score"),
            )
        })
        .collect())
}

pub(super) async fn fetch_workout_summary(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<WorkoutSummaryReadModel>, PersistenceError> {
    let maybe_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.id::text AS training_plan_id,
            tp.name AS training_plan_name,
            w.gym_id::text AS gym_id,
            g.name AS gym_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            COUNT(DISTINCT we.id)::bigint AS exercise_count,
            COUNT(ws.id)::bigint AS completed_set_count
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
         LEFT JOIN workout_exercises we ON we.workout_id = w.id
         LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid
         GROUP BY w.id, tp.id, tp.name, g.name",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(row) = maybe_row else {
        return Ok(None);
    };

    let exercise_scores_by_id =
        fetch_exercise_scores_by_workout_exercise_id(repository, workout_id, user_id).await?;

    let baseline_by_exercise_id =
        fetch_historical_baseline_max_by_workout_exercise(repository, workout_id, user_id).await?;
    let average_duration_minutes =
        fetch_average_duration_minutes_for_matching_history(repository, workout_id, user_id)
            .await?;

    Ok(Some(WorkoutSummaryReadModel {
        id: row.get("id"),
        training_plan_id: row.get("training_plan_id"),
        training_plan_name: row.get("training_plan_name"),
        gym_id: row.get("gym_id"),
        gym_name: row.get("gym_name"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        exercise_count: row.get("exercise_count"),
        completed_set_count: row.get("completed_set_count"),
        average_duration_minutes,
        exercise_scores_by_id,
        baseline_by_exercise_id,
    }))
}

pub(super) async fn fetch_workout_detail(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<WorkoutDetailReadModel>, PersistenceError> {
    let maybe_hero_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.name AS training_plan_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            CASE
                WHEN w.started_at IS NOT NULL
                     AND w.completed_at IS NOT NULL
                     AND w.completed_at > w.started_at
                    THEN GREATEST(
                        1,
                        FLOOR(EXTRACT(EPOCH FROM (w.completed_at - w.started_at)) / 60.0)::bigint
                    )
                ELSE NULL
            END AS duration_minutes,
            g.name AS gym_name
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(hero_row) = maybe_hero_row else {
        return Ok(None);
    };

    let summary = fetch_workout_summary(repository, workout_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Workout not found".to_owned()))?;

    let exercise_rows = sqlx::query(
        "SELECT
            we.id::text AS workout_exercise_id,
            we.training_plan_exercise_id::text AS training_plan_exercise_id,
            we.position AS exercise_position,
            e.name AS exercise_name,
            we.selected_variant_id::text AS variant_id,
            ev.name AS variant_name,
            es.name AS station_name,
            ev.set_tracking_mode AS set_tracking_mode,
            ev.repetition_kind AS repetition_kind,
            ws.set_index AS set_index,
            ws.set_side AS set_side,
            ws.load_canonical_kg::double precision AS load_value,
            ws.repetition_value AS repetition_value
         FROM workout_exercises we
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         JOIN exercises e ON e.id = tpe.exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         LEFT JOIN equipment_stations es ON es.id = we.selected_station_id
         LEFT JOIN workout_sets ws
           ON ws.workout_exercise_id = we.id
          AND ws.user_id = $2::uuid
         WHERE we.workout_id = $1::uuid
           AND we.user_id = $2::uuid
         ORDER BY we.position ASC,
                  ws.set_index ASC NULLS LAST,
                  CASE ws.set_side
                      WHEN 'LEFT' THEN 0
                      WHEN 'RIGHT' THEN 1
                      WHEN 'BILATERAL' THEN 2
                      ELSE 3
                  END ASC",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut exercises: Vec<WorkoutDetailExercise> = Vec::new();
    let mut exercise_index_by_id: HashMap<String, usize> = HashMap::new();

    for row in exercise_rows {
        let workout_exercise_id: String = row.get("workout_exercise_id");
        let exercise_index = match exercise_index_by_id.get(&workout_exercise_id).copied() {
            Some(index) => index,
            None => {
                let normalized_repetition_kind = row
                    .get::<Option<String>, _>("repetition_kind")
                    .as_deref()
                    .map(|kind| normalize_repetition_kind(Some(kind)).to_owned());
                let index = exercises.len();
                exercise_index_by_id.insert(workout_exercise_id, index);
                exercises.push(WorkoutDetailExercise {
                    training_plan_exercise_id: row.get("training_plan_exercise_id"),
                    exercise_position: row.get("exercise_position"),
                    exercise_name: row.get("exercise_name"),
                    variant_id: row.get("variant_id"),
                    variant_name: row.get("variant_name"),
                    station_name: row.get("station_name"),
                    set_tracking_mode: row.get("set_tracking_mode"),
                    repetition_kind: normalized_repetition_kind,
                    sets: Vec::new(),
                });
                index
            }
        };

        let maybe_set_index: Option<i32> = row.get("set_index");
        if let Some(set_index) = maybe_set_index {
            let normalized_set_repetition_kind = row
                .get::<Option<String>, _>("repetition_kind")
                .as_deref()
                .map(|kind| normalize_repetition_kind(Some(kind)).to_owned());
            exercises[exercise_index].sets.push(WorkoutDetailSetLine {
                set_index,
                set_side: row.get("set_side"),
                load_value: row.get("load_value"),
                repetition_kind: normalized_set_repetition_kind,
                repetition_value: row.get("repetition_value"),
            });
        }
    }

    let hero = WorkoutDetailHero {
        training_plan_name: hero_row.get("training_plan_name"),
        started_at: hero_row.get("started_at"),
        completed_at: hero_row.get("completed_at"),
        duration_minutes: hero_row.get("duration_minutes"),
        gym_name: hero_row.get("gym_name"),
    };

    Ok(Some(WorkoutDetailReadModel {
        id: hero_row.get("id"),
        hero,
        summary,
        exercises,
    }))
}

async fn fetch_average_duration_minutes_for_matching_history(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<i64>, PersistenceError> {
    let row = sqlx::query(
        "WITH current_workout AS (
            SELECT
              training_plan_version_id,
              gym_id,
              COALESCE(completed_at, started_at, created_at) AS comparison_cutoff
            FROM workouts
            WHERE id = $1::uuid
              AND user_id = $2::uuid
          ),
          recent_durations AS (
            SELECT
              EXTRACT(EPOCH FROM (w.completed_at - w.started_at)) / 60.0 AS duration_minutes
            FROM workouts w
            JOIN current_workout cw ON TRUE
            WHERE w.user_id = $2::uuid
              AND w.id <> $1::uuid
              AND w.training_plan_version_id = cw.training_plan_version_id
              AND (
                (cw.gym_id IS NULL AND w.gym_id IS NULL)
                OR w.gym_id = cw.gym_id
              )
              AND w.completed_at IS NOT NULL
              AND w.started_at IS NOT NULL
              AND w.completed_at > w.started_at
              AND w.completed_at < cw.comparison_cutoff
            ORDER BY w.completed_at DESC, w.id DESC
            LIMIT 10
          )
          SELECT ROUND(AVG(duration_minutes))::bigint AS average_duration_minutes
          FROM recent_durations",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(row.get("average_duration_minutes"))
}

pub(super) async fn fetch_historical_baseline_max_by_workout_exercise(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<HashMap<String, i32>, PersistenceError> {
    let workout_exists = sqlx::query(
        "SELECT 1
         FROM workouts
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?
    .is_some();

    if !workout_exists {
        return Err(PersistenceError::NotFound("Workout not found".to_owned()));
    }

    let rows = sqlx::query(
        "SELECT
            we_current.id::text AS workout_exercise_id,
            historical.max_historical_performance_score AS max_historical_performance_score
         FROM workout_exercises we_current
         JOIN workouts w_current ON w_current.id = we_current.workout_id
         LEFT JOIN LATERAL (
            SELECT COALESCE(
                MAX(
                    CASE
                        WHEN w_historical.completed_at >= (
                            COALESCE(w_current.completed_at, w_current.started_at, w_current.created_at)
                            - INTERVAL '30 days'
                        )
                            THEN we_historical.performance_score
                        ELSE NULL
                    END
                ),
                MAX(we_historical.performance_score)
            ) AS max_historical_performance_score
            FROM workouts w_historical
            JOIN workout_exercises we_historical ON we_historical.workout_id = w_historical.id
            WHERE w_historical.user_id = $2::uuid
              AND we_historical.user_id = $2::uuid
              AND w_historical.id <> $1::uuid
              AND w_historical.completed_at IS NOT NULL
              AND w_historical.completed_at >= (
                COALESCE(w_current.completed_at, w_current.started_at, w_current.created_at)
                - INTERVAL '180 days'
              )
              AND w_historical.completed_at < COALESCE(
                w_current.completed_at,
                w_current.started_at,
                w_current.created_at
              )
              AND we_historical.performance_score IS NOT NULL
              AND we_historical.selected_variant_id = we_current.selected_variant_id
              AND (
                (we_historical.selected_station_id IS NULL AND we_current.selected_station_id IS NULL)
                OR we_historical.selected_station_id = we_current.selected_station_id
              )
         ) historical ON TRUE
         WHERE we_current.workout_id = $1::uuid
           AND we_current.user_id = $2::uuid
           AND w_current.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let baseline_by_workout_exercise_id = rows
        .into_iter()
        .filter_map(|row| {
            let baseline: Option<i32> = row.get("max_historical_performance_score");
            baseline.map(|value| (row.get::<String, _>("workout_exercise_id"), value))
        })
        .collect();

    Ok(baseline_by_workout_exercise_id)
}

pub(super) async fn create_workout(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<Workout, PersistenceError> {
    let mut tx = logging::begin_transaction(&repository.pool, "create_workout", "workout").await?;

    let workout_row = sqlx::query(
        "INSERT INTO workouts (
            training_plan_version_id,
            gym_id,
            started_at,
            completed_at,
            current_exercise_position,
            user_id
         )
         VALUES (
            (
                SELECT tpv.id
                FROM training_plan_versions tpv
                WHERE tpv.training_plan_id = $1::uuid
                ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
                LIMIT 1
            ),
            $2::uuid,
            $3::timestamptz,
            $4::timestamptz,
            $5,
            $6::uuid
         )
         RETURNING id::text AS id",
    )
    .bind(&new_workout.training_plan_id)
    .bind(new_workout.gym_id.as_deref())
    .bind(new_workout.started_at.as_deref())
    .bind(new_workout.completed_at.as_deref())
    .bind(new_workout.current_exercise_position)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    let workout_id: String = workout_row.get("id");

    insert_workout_progress(&mut tx, &workout_id, new_workout, user_id).await?;
    logging::commit_transaction(tx, "create_workout", "workout").await?;

    let created = fetch_workout(repository, &workout_id, user_id).await?;
    match created {
        Some(workout) => Ok(workout),
        None => Err(PersistenceError::Sqlx(sqlx::Error::RowNotFound)),
    }
}

pub(super) async fn insert_workout_progress(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let selected_variant_ids: Vec<Uuid> = new_workout
        .exercises
        .iter()
        .filter_map(|exercise| {
            exercise
                .selected_variant_id
                .as_deref()
                .and_then(|id| id.parse().ok())
        })
        .collect();

    let repetition_kind_by_variant_id: HashMap<Uuid, String> = if selected_variant_ids.is_empty() {
        HashMap::new()
    } else {
        let rows = sqlx::query(
            "SELECT id, repetition_kind
             FROM exercise_variants
             WHERE id = ANY($1::uuid[])",
        )
        .bind(&selected_variant_ids)
        .fetch_all(&mut **tx)
        .await?;

        rows.into_iter()
            .map(|row| {
                (
                    row.get::<Uuid, _>("id"),
                    row.get::<String, _>("repetition_kind"),
                )
            })
            .collect()
    };

    let write_completion_scores = new_workout.completed_at.is_some();

    for exercise in &new_workout.exercises {
        // The current renderer may not yet submit final option/variant/station selections for
        // every exercise. Those nullable columns deliberately persist `NULL` until later work
        // replaces this temporary path with real user-selected references.
        // Prefer sending typed UUID parameters for optional ids to avoid
        // relying on Postgres string-to-uuid parsing which can produce
        // 22P02 errors if unexpected characters slip in. Parse here and
        // bind Option<uuid::Uuid> so the client driver sends a proper UUID
        // binary parameter when available.
        let selected_variant_uuid: Option<Uuid> = exercise
            .selected_variant_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_station_uuid: Option<Uuid> = exercise
            .selected_station_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_plan_option_uuid: Option<Uuid> = exercise
            .selected_training_plan_exercise_variant_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_repetition_kind = selected_variant_uuid
            .as_ref()
            .and_then(|variant_id| repetition_kind_by_variant_id.get(variant_id))
            .map(|kind| normalize_repetition_kind(Some(kind.as_str())))
            .unwrap_or(REPETITION_KIND_REPS);
        let completion_transition_marks_exercise_completed = exercise.completed_at.is_some()
            || (exercise.skipped_at.is_none() && !exercise.sets.is_empty());
        let performance_score =
            if write_completion_scores && completion_transition_marks_exercise_completed {
                workout_metrics::compute_performance_score(&exercise.sets, selected_repetition_kind)
            } else {
                None
            };
        let should_complete_on_transition = new_workout.completed_at.is_none()
            && new_workout
                .current_exercise_position
                .is_some_and(|position| position > exercise.position)
            && exercise.skipped_at.is_none()
            && !exercise.sets.is_empty();

        let workout_exercise_row = sqlx::query(
            "INSERT INTO workout_exercises (
                workout_id,
                training_plan_exercise_id,
                position,
                selected_variant_id,
                selected_station_id,
                selected_training_plan_exercise_variant_id,
                performance_score,
                skipped_at,
                completed_at,
                user_id
             )
             VALUES (
                $1::uuid,
                $2::uuid,
                $3,
                $4::uuid,
                $5::uuid,
                $6::uuid,
                $7,
                $8::timestamptz,
                COALESCE($9::timestamptz, CASE WHEN $10 THEN NOW() ELSE NULL END),
                $11::uuid
             )
             RETURNING id::text AS id",
        )
        .bind(workout_id)
        .bind(&exercise.training_plan_exercise_id)
        .bind(exercise.position)
        .bind(selected_variant_uuid)
        .bind(selected_station_uuid)
        .bind(selected_plan_option_uuid)
        .bind(performance_score)
        .bind(exercise.skipped_at.as_deref())
        .bind(exercise.completed_at.as_deref())
        .bind(should_complete_on_transition)
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;

        let workout_exercise_id: String = workout_exercise_row.get("id");
        for set in &exercise.sets {
            let repetition_value = set.repetition_value;
            sqlx::query(
                "INSERT INTO workout_sets (
                    workout_exercise_id,
                    set_index,
                    set_side,
                    repetition_value,
                    load_display_value,
                    load_display_unit,
                    load_canonical_kg,
                    completed_at,
                    user_id
                 )
                 VALUES (
                    $1::uuid,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    COALESCE($8::timestamptz, NOW()),
                    $9::uuid
                 )",
            )
            .bind(&workout_exercise_id)
            .bind(set.set_index)
            .bind(&set.set_side)
            .bind(repetition_value)
            .bind(set.load_display_value)
            .bind(&set.load_display_unit)
            .bind(set.load_canonical_kg)
            .bind(set.completed_at.as_deref())
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

pub(super) async fn fetch_workout(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<Workout>, PersistenceError> {
    let maybe_workout_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.id::text AS training_plan_id,
            w.gym_id::text AS gym_id,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(workout_row) = maybe_workout_row else {
        return Ok(None);
    };

    let mut workout = Workout {
        id: workout_row.get("id"),
        training_plan_id: workout_row.get("training_plan_id"),
        gym_id: workout_row.get("gym_id"),
        started_at: workout_row.get("started_at"),
        completed_at: workout_row.get("completed_at"),
        exercises: Vec::new(),
    };

    let exercise_rows = sqlx::query(
        "SELECT
            id::text AS id,
            training_plan_exercise_id::text AS training_plan_exercise_id,
            position,
            selected_variant_id::text AS selected_variant_id,
            selected_station_id::text AS selected_station_id,
            selected_training_plan_exercise_variant_id::text AS selected_training_plan_exercise_variant_id,
            performance_score,
            skipped_at::text AS skipped_at,
            completed_at::text AS completed_at
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND user_id = $2::uuid
         ORDER BY position ASC",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut index_by_workout_exercise_id = HashMap::new();

    for row in exercise_rows {
        let current_workout_exercise_id: String = row.get("id");
        index_by_workout_exercise_id
            .insert(current_workout_exercise_id.clone(), workout.exercises.len());

        workout.exercises.push(WorkoutExercise {
            id: current_workout_exercise_id,
            training_plan_exercise_id: row.get("training_plan_exercise_id"),
            position: row.get("position"),
            selected_variant_id: row.get("selected_variant_id"),
            selected_station_id: row.get("selected_station_id"),
            selected_training_plan_exercise_variant_id: row
                .get("selected_training_plan_exercise_variant_id"),
            performance_score: row.get("performance_score"),
            skipped_at: row.get("skipped_at"),
            completed_at: row.get("completed_at"),
            sets: Vec::new(),
        });
    }

    let set_rows = sqlx::query(
        "SELECT
            ws.id::text AS id,
            workout_exercise_id::text AS workout_exercise_id,
            set_index,
            set_side,
            ws.repetition_value AS repetition_value,
            COALESCE(ev.repetition_kind, 'REPS') AS repetition_kind,
            load_display_value::double precision AS load_display_value,
            load_display_unit,
            load_canonical_kg::double precision AS load_canonical_kg,
            ws.completed_at::text AS completed_at
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE ws.workout_exercise_id IN (
            SELECT id
            FROM workout_exercises
            WHERE workout_id = $1::uuid
              AND user_id = $2::uuid
         )
           AND ws.user_id = $2::uuid
         ORDER BY ws.workout_exercise_id ASC,
                  ws.set_index ASC,
                  CASE ws.set_side WHEN 'LEFT' THEN 0 WHEN 'RIGHT' THEN 1 ELSE 2 END ASC",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    for row in set_rows {
        let set_workout_exercise_id: String = row.get("workout_exercise_id");
        if let Some(exercise_index) = index_by_workout_exercise_id.get(&set_workout_exercise_id) {
            let _set_repetition_kind =
                normalize_repetition_kind(Some(row.get::<String, _>("repetition_kind").as_str()));
            workout.exercises[*exercise_index].sets.push(WorkoutSet {
                id: row.get("id"),
                set_index: row.get("set_index"),
                set_side: row.get("set_side"),
                repetition_value: row.get("repetition_value"),
                load_display_value: row.get::<Option<f64>, _>("load_display_value"),
                load_display_unit: row.get("load_display_unit"),
                load_canonical_kg: row.get::<Option<f64>, _>("load_canonical_kg"),
                completed_at: row.get("completed_at"),
            });
        }
    }

    Ok(Some(workout))
}
