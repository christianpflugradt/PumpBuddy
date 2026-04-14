use super::{logging, DomainRepository, PersistenceError};
use crate::domain::{
    normalize_repetition_kind, NewWorkout, NewWorkoutSet, Workout, WorkoutExercise, WorkoutSet,
    WorkoutSummary, REPETITION_KIND_REPS,
};
use sqlx::Row;
use std::collections::HashMap;
use uuid::Uuid;

const LOAD_MILLI_SCALE: i128 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PerformanceScoreFormula {
    LoadReps,
    LoadSecs,
    TotalReps,
    TotalSecs,
}

fn saturating_i128_to_i32(value: i128) -> i32 {
    if value <= i32::MIN as i128 {
        i32::MIN
    } else if value >= i32::MAX as i128 {
        i32::MAX
    } else {
        value as i32
    }
}

fn sum_weighted_score(sets: &[NewWorkoutSet]) -> Option<i32> {
    let mut total_milli: i128 = 0;
    let mut has_weighted_data = false;

    for set in sets {
        let (Some(load_kg), Some(repetition_value)) = (set.load_canonical_kg, set.reps) else {
            continue;
        };

        let load_milli = (load_kg * LOAD_MILLI_SCALE as f64).round() as i128;
        total_milli += load_milli * repetition_value as i128;
        has_weighted_data = true;
    }

    if !has_weighted_data {
        return None;
    }

    Some(saturating_i128_to_i32(total_milli / LOAD_MILLI_SCALE))
}

fn sum_total_repetition_value(sets: &[NewWorkoutSet]) -> Option<i32> {
    let mut total: i128 = 0;
    let mut has_repetition_data = false;

    for set in sets {
        if let Some(repetition_value) = set.reps {
            total += repetition_value as i128;
            has_repetition_data = true;
        }
    }

    if !has_repetition_data {
        return None;
    }

    Some(saturating_i128_to_i32(total))
}

fn selected_performance_formula(
    sets: &[NewWorkoutSet],
    repetition_kind: &str,
) -> Option<PerformanceScoreFormula> {
    let normalized_repetition_kind = normalize_repetition_kind(Some(repetition_kind));
    let has_weighted_data = sets
        .iter()
        .any(|set| set.load_canonical_kg.is_some() && set.reps.is_some());
    let has_repetition_data = sets.iter().any(|set| set.reps.is_some());

    if normalized_repetition_kind == REPETITION_KIND_REPS {
        if has_weighted_data {
            Some(PerformanceScoreFormula::LoadReps)
        } else if has_repetition_data {
            Some(PerformanceScoreFormula::TotalReps)
        } else {
            None
        }
    } else if has_weighted_data {
        Some(PerformanceScoreFormula::LoadSecs)
    } else if has_repetition_data {
        Some(PerformanceScoreFormula::TotalSecs)
    } else {
        None
    }
}

fn compute_performance_score(sets: &[NewWorkoutSet], repetition_kind: &str) -> Option<i32> {
    match selected_performance_formula(sets, repetition_kind) {
        Some(PerformanceScoreFormula::LoadReps | PerformanceScoreFormula::LoadSecs) => {
            sum_weighted_score(sets)
        }
        Some(PerformanceScoreFormula::TotalReps | PerformanceScoreFormula::TotalSecs) => {
            sum_total_repetition_value(sets)
        }
        None => None,
    }
}

pub(super) async fn fetch_workout_summary(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<WorkoutSummary>, PersistenceError> {
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

    Ok(maybe_row.map(|row| WorkoutSummary {
        id: row.get("id"),
        training_plan_id: row.get("training_plan_id"),
        training_plan_name: row.get("training_plan_name"),
        gym_id: row.get("gym_id"),
        gym_name: row.get("gym_name"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        exercise_count: row.get("exercise_count"),
        completed_set_count: row.get("completed_set_count"),
    }))
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
                compute_performance_score(&exercise.sets, selected_repetition_kind)
            } else {
                None
            };

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
                COALESCE($9::timestamptz, $8::timestamptz, CASE WHEN $10 > 0 THEN NOW() ELSE NULL END),
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
        .bind(i32::try_from(exercise.sets.len()).unwrap_or(i32::MAX))
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;

        let workout_exercise_id: String = workout_exercise_row.get("id");
        for set in &exercise.sets {
            let repetition_value = set.reps;
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
                reps: row.get("repetition_value"),
                load_display_value: row.get::<Option<f64>, _>("load_display_value"),
                load_display_unit: row.get("load_display_unit"),
                load_canonical_kg: row.get::<Option<f64>, _>("load_canonical_kg"),
                completed_at: row.get("completed_at"),
            });
        }
    }

    Ok(Some(workout))
}
