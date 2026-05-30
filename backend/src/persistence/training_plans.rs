use super::{DomainRepository, PersistenceError};
use crate::domain::{
    PlanExerciseOptionSummary, TrainingPlanDetail, TrainingPlanDetailExercise, TrainingPlanSummary,
};
use sqlx::{postgres::PgRow, types::JsonValue, Row};
use std::collections::HashSet;

pub(super) async fn fetch_training_plan_detail_for_user(
    repository: &DomainRepository,
    training_plan_id: &str,
    user_id: &str,
) -> Result<Option<TrainingPlanDetail>, PersistenceError> {
    let maybe_plan_row = sqlx::query(
        "SELECT id::text AS id, name
         FROM training_plans
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(training_plan_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(plan_row) = maybe_plan_row else {
        return Ok(None);
    };

    let exercises = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
              AND tpv.user_id = $2::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT
            tpe.id::text AS training_plan_exercise_id,
            tpe.position,
            e.name AS exercise_name
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         JOIN exercises e ON e.id = tpe.exercise_id
         WHERE tpe.user_id = $2::uuid
           AND e.user_id = $2::uuid
         ORDER BY tpe.position ASC",
    )
    .bind(training_plan_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?
    .into_iter()
    .map(|row| TrainingPlanDetailExercise {
        id: row.get("training_plan_exercise_id"),
        exercise_name: row.get("exercise_name"),
        position: row.get("position"),
    })
    .collect();

    Ok(Some(TrainingPlanDetail {
        id: plan_row.get("id"),
        name: plan_row.get("name"),
        exercises,
    }))
}

// NOTE: Listing training plans is user-scoped. Callers must provide the authenticated user_id.
pub(super) async fn fetch_training_plan_summaries_for_user(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
    // user_id must be provided; tests may pass an empty string during transition but
    // after DB recreation callers will always provide a user_id.
    let rows = if user_id.is_empty() {
        // during transition the seed data may exist with NULL user_id; to support a fresh
        // DB recreation we treat NULL as not applicable here and return an empty set when
        // caller did not provide a user_id. In practice callers must pass a user_id.
        Vec::new()
    } else {
        sqlx::query(
            "SELECT
                tp.id::text AS id,
                tp.name,
                exercise_totals.exercise_count,
                completion.last_completed_at,
                ROW_NUMBER() OVER (
                    ORDER BY completion.last_completed_at ASC NULLS FIRST, tp.created_at ASC, tp.id ASC
                )::int AS start_selection_rank
             FROM training_plans tp
             LEFT JOIN LATERAL (
                SELECT COUNT(tpe.id)::bigint AS exercise_count
                FROM training_plan_exercises tpe
                WHERE tpe.training_plan_version_id = (
                    SELECT tpv.id
                    FROM training_plan_versions tpv
                    WHERE tpv.training_plan_id = tp.id
                    ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
                    LIMIT 1
                )
             ) exercise_totals ON TRUE
             LEFT JOIN LATERAL (
                SELECT MAX(w.completed_at)::text AS last_completed_at
                FROM training_plan_versions tpv
                JOIN workouts w ON w.training_plan_version_id = tpv.id
                WHERE tpv.training_plan_id = tp.id
                  AND w.user_id = $1::uuid
                  AND w.completed_at IS NOT NULL
             ) completion ON TRUE
             WHERE tp.user_id = $1::uuid
             ORDER BY tp.created_at ASC, tp.id ASC",
        )
        .bind(user_id)
        .fetch_all(&repository.pool)
        .await?
    };

    Ok(rows
        .into_iter()
        .map(|row| TrainingPlanSummary {
            id: row.get("id"),
            name: row.get("name"),
            exercise_count: row.get("exercise_count"),
            last_completed_at: row.get("last_completed_at"),
            start_selection_rank: row.get("start_selection_rank"),
        })
        .collect())
}

// User-scoped variant for plan exercise option summaries
pub(super) async fn fetch_training_plan_exercise_variant_summaries_for_user(
    repository: &DomainRepository,
    training_plan_id: &str,
    gym_id: &str,
    user_id: &str,
) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
    let max_load_kg = repository
        .fetch_max_load_kg_preference_for_user(user_id)
        .await?;
    let rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         ),
         compatible_variant_stations AS (
            SELECT
                evec.exercise_variant_id,
                es.id AS station_id,
                es.name AS station_name,
                es.load_profile_id AS station_load_profile_id
            FROM exercise_variant_equipment_compatibilities evec
            JOIN equipment_stations es ON es.id = evec.equipment_station_id
            WHERE evec.user_id = $3::uuid
              AND evec.is_enabled = TRUE
              AND es.gym_id = $2::uuid
              AND es.user_id = $3::uuid
         )
         SELECT
             peo.id::text AS training_plan_exercise_variant_id,
             tpe.id::text AS training_plan_exercise_id,
             e.name AS exercise_name,
             tpe.position AS exercise_position,
             peo.rep_min,
             peo.rep_max,
             peo.target_sets,
             peo.selection_order,
             ev.id::text AS variant_id,
             ev.name AS variant_name,
             ev.repetition_kind,
             ev.load_input_mode,
             ev.set_tracking_mode,
             cvs.station_id::text AS station_id,
            cvs.station_name AS station_name,
            lp.definition AS station_profile_definition,
            lp.weight_unit AS station_profile_weight_unit,
            variant_recency.last_completed_at,
            ROW_NUMBER() OVER (
                PARTITION BY tpe.id
                ORDER BY
                    variant_recency.last_completed_at DESC NULLS LAST,
                    peo.selection_order ASC,
                    peo.id ASC,
                    cvs.station_id ASC NULLS FIRST
            )::int AS fallback_selection_rank
         FROM training_plan_exercise_variants peo
         JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
         JOIN exercises e ON e.id = tpe.exercise_id
         JOIN exercise_variants ev ON ev.id = peo.exercise_variant_id
         LEFT JOIN compatible_variant_stations cvs ON cvs.exercise_variant_id = peo.exercise_variant_id
         LEFT JOIN load_profiles lp ON lp.id = cvs.station_load_profile_id AND lp.user_id = $3::uuid
         LEFT JOIN LATERAL (
            SELECT MAX(w.completed_at)::text AS last_completed_at
            FROM workout_exercises we
            JOIN workouts w ON w.id = we.workout_id
            WHERE we.training_plan_exercise_id = peo.training_plan_exercise_id
              AND we.selected_variant_id = peo.exercise_variant_id
              AND (
                (we.selected_station_id IS NULL AND cvs.station_id IS NULL)
                OR we.selected_station_id = cvs.station_id
              )
              AND we.user_id = $3::uuid
              AND w.user_id = $3::uuid
              AND w.completed_at IS NOT NULL
         ) variant_recency ON TRUE
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE tpe.user_id = $3::uuid
           AND peo.user_id = $3::uuid
           AND e.user_id = $3::uuid
           AND ev.user_id = $3::uuid
           AND (ev.requires_station = FALSE OR cvs.station_id IS NOT NULL)
         ORDER BY
            tpe.position ASC,
            peo.selection_order ASC,
            peo.id ASC,
            cvs.station_id ASC NULLS FIRST",
    )
    .bind(training_plan_id)
    .bind(gym_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    rows.into_iter()
        .map(|row| map_training_plan_exercise_variant_summary_row(row, max_load_kg))
        .collect()
}

fn map_training_plan_exercise_variant_summary_row(
    row: PgRow,
    max_load_kg: f64,
) -> Result<PlanExerciseOptionSummary, PersistenceError> {
    let definition: Option<JsonValue> = row.get("station_profile_definition");
    let weight_unit: Option<String> = row.get("station_profile_weight_unit");
    let station_profile_loads_kg = match (definition, weight_unit) {
        (Some(definition), Some(weight_unit)) => {
            super::load_profiles::load_profile_definition_to_kg(&definition, &weight_unit)?
        }
        _ => Vec::new(),
    };
    let station_profile_loads_kg: Vec<f64> = station_profile_loads_kg
        .into_iter()
        .filter(|load| *load <= max_load_kg)
        .collect();
    let suggested_start_load_kg =
        crate::workout_suggestion_logic::suggest_profile_start_load(&station_profile_loads_kg);

    Ok(PlanExerciseOptionSummary {
        id: row.get("training_plan_exercise_variant_id"),
        training_plan_exercise_id: row.get("training_plan_exercise_id"),
        exercise_name: row.get("exercise_name"),
        exercise_position: row.get("exercise_position"),
        rep_min: row.get("rep_min"),
        rep_max: row.get("rep_max"),
        target_sets: row.get("target_sets"),
        variant_id: row.get("variant_id"),
        variant_name: row.get("variant_name"),
        repetition_kind: row.get("repetition_kind"),
        load_input_mode: row.get("load_input_mode"),
        set_tracking_mode: row.get("set_tracking_mode"),
        station_id: row.get("station_id"),
        station_name: row.get("station_name"),
        station_profile_loads_kg,
        suggested_start_load_kg,
        last_completed_at: row.get("last_completed_at"),
        fallback_selection_rank: row.get("fallback_selection_rank"),
    })
}

pub(super) async fn fetch_training_plan_exercise_ids_for_user(
    repository: &DomainRepository,
    training_plan_id: &str,
    user_id: &str,
) -> Result<HashSet<String>, PersistenceError> {
    let rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            JOIN training_plans tp ON tp.id = tpv.training_plan_id
            WHERE tpv.training_plan_id = $1::uuid
              AND tp.user_id = $2::uuid
              AND tpv.user_id = $2::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT tpe.id::text AS id
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE tpe.user_id = $2::uuid",
    )
    .bind(training_plan_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows.into_iter().map(|row| row.get("id")).collect())
}

pub(super) async fn fetch_training_plan_exercise_count_for_user(
    repository: &DomainRepository,
    training_plan_id: &str,
    user_id: &str,
) -> Result<i64, PersistenceError> {
    let row = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            JOIN training_plans tp ON tp.id = tpv.training_plan_id
            WHERE tpv.training_plan_id = $1::uuid
              AND tp.user_id = $2::uuid
              AND tpv.user_id = $2::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT COUNT(*)::bigint AS exercise_count
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE tpe.user_id = $2::uuid",
    )
    .bind(training_plan_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(row.get("exercise_count"))
}
