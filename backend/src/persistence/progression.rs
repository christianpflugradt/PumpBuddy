use super::{DomainRepository, PersistenceError};
use crate::domain::{normalize_repetition_kind, REPETITION_KIND_REPS};
use crate::workout_progression::{self, ProgressionEntryPoint};
use sqlx::Row;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy)]
pub(super) struct RepsProgressionEligibilityContext<'a> {
    pub(super) user_id: &'a str,
    pub(super) current_workout_id: &'a str,
    pub(super) exercise_id: &'a str,
    pub(super) selected_variant_id: Option<&'a str>,
    pub(super) selected_station_id: Option<&'a str>,
    pub(super) requested_set_side: &'a str,
    pub(super) max_set_index: i32,
    pub(super) repetition_kind: &'a str,
}

pub(super) async fn enough_data_for_reps_progression(
    repository: &DomainRepository,
    context: RepsProgressionEligibilityContext<'_>,
) -> Result<bool, PersistenceError> {
    if !workout_progression::enough_data_for_progression(ProgressionEntryPoint::Reps) {
        return Ok(false);
    }

    if normalize_repetition_kind(Some(context.repetition_kind)) != REPETITION_KIND_REPS {
        return Ok(false);
    }

    let Some(selected_variant_id) = context.selected_variant_id else {
        return Ok(false);
    };

    if context.max_set_index <= 0 {
        return Ok(false);
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
    .bind(context.current_workout_id)
    .bind(context.user_id)
    .bind(context.exercise_id)
    .bind(selected_variant_id)
    .bind(context.selected_station_id)
    .bind(REPETITION_KIND_REPS)
    .fetch_one(&repository.pool)
    .await?
    .get::<i64, _>("matched_workout_count");

    if matched_workout_count <= 0 {
        return Ok(false);
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
    .bind(context.current_workout_id)
    .bind(context.user_id)
    .bind(context.exercise_id)
    .bind(selected_variant_id)
    .bind(context.selected_station_id)
    .bind(context.requested_set_side)
    .bind(context.max_set_index)
    .bind(REPETITION_KIND_REPS)
    .fetch_all(&repository.pool)
    .await?;

    let coverage_by_set_index: HashMap<i32, i64> = coverage_rows
        .into_iter()
        .map(|row| {
            (
                row.get::<i32, _>("set_index"),
                row.get::<i64, _>("covered_workout_count"),
            )
        })
        .collect();

    Ok(workout_progression::has_required_coverage(
        matched_workout_count,
        context.max_set_index,
        &coverage_by_set_index,
    ))
}

pub(super) fn enough_data_for_load_progression() -> bool {
    workout_progression::enough_data_for_load_progression()
}
