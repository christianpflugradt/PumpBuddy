use super::{
    DomainRepository, PersistenceError, RepsProgressionCoverage, RepsProgressionCoverageQuery,
};
use crate::domain::{normalize_repetition_kind, REPETITION_KIND_REPS};
use sqlx::Row;
use std::collections::HashMap;

pub(super) async fn fetch_reps_progression_coverage(
    repository: &DomainRepository,
    query: RepsProgressionCoverageQuery,
) -> Result<RepsProgressionCoverage, PersistenceError> {
    if normalize_repetition_kind(Some(&query.repetition_kind)) != REPETITION_KIND_REPS {
        return Ok(RepsProgressionCoverage {
            matched_workout_count: 0,
            coverage_by_set_index: HashMap::new(),
        });
    }

    let Some(selected_variant_id) = query.selected_variant_id.as_deref() else {
        return Ok(RepsProgressionCoverage {
            matched_workout_count: 0,
            coverage_by_set_index: HashMap::new(),
        });
    };

    if query.max_set_index <= 0 {
        return Ok(RepsProgressionCoverage {
            matched_workout_count: 0,
            coverage_by_set_index: HashMap::new(),
        });
    }

    let matched_workout_count = sqlx::query(
        "SELECT COUNT(DISTINCT w.id)::bigint AS matched_workout_count
         FROM workouts w
         JOIN workout_exercises we ON we.workout_id = w.id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND w.user_id = $2::uuid
           AND we.user_id = $2::uuid
           AND tpe.user_id = $2::uuid
           AND tpe.exercise_id = $3::uuid
           AND we.selected_variant_id = $4::uuid
           AND (
             ($5::uuid IS NULL AND we.selected_station_id IS NULL)
             OR we.selected_station_id = $5::uuid
           )
           AND COALESCE(ev.repetition_kind, 'REPS') = $6",
    )
    .bind(&query.current_workout_id)
    .bind(&query.user_id)
    .bind(&query.exercise_id)
    .bind(selected_variant_id)
    .bind(query.selected_station_id.as_deref())
    .bind(REPETITION_KIND_REPS)
    .fetch_one(&repository.pool)
    .await?
    .get::<i64, _>("matched_workout_count");

    if matched_workout_count <= 0 {
        return Ok(RepsProgressionCoverage {
            matched_workout_count,
            coverage_by_set_index: HashMap::new(),
        });
    }

    let coverage_rows = sqlx::query(
        "SELECT
            ws.set_index,
            COUNT(DISTINCT w.id)::bigint AS covered_workout_count
         FROM workouts w
         JOIN workout_exercises we ON we.workout_id = w.id
         JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND w.user_id = $2::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid
           AND tpe.user_id = $2::uuid
           AND tpe.exercise_id = $3::uuid
           AND we.selected_variant_id = $4::uuid
           AND (
             ($5::uuid IS NULL AND we.selected_station_id IS NULL)
             OR we.selected_station_id = $5::uuid
           )
           AND ws.set_side = $6
           AND ws.set_index BETWEEN 1 AND $7
           AND COALESCE(ev.repetition_kind, 'REPS') = $8
         GROUP BY ws.set_index",
    )
    .bind(&query.current_workout_id)
    .bind(&query.user_id)
    .bind(&query.exercise_id)
    .bind(selected_variant_id)
    .bind(query.selected_station_id.as_deref())
    .bind(&query.requested_set_side)
    .bind(query.max_set_index)
    .bind(REPETITION_KIND_REPS)
    .fetch_all(&repository.pool)
    .await?;

    let coverage_by_set_index = coverage_rows
        .into_iter()
        .map(|row| {
            (
                row.get::<i32, _>("set_index"),
                row.get::<i64, _>("covered_workout_count"),
            )
        })
        .collect();

    Ok(RepsProgressionCoverage {
        matched_workout_count,
        coverage_by_set_index,
    })
}
