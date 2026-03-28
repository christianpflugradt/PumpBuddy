use super::{DomainRepository, PersistenceError};
use crate::domain::{
    EquipmentStation, Exercise, ExerciseVariant, Gym, GymSummary, PlanExerciseOption,
    PlanExerciseOptionSummary, TrainingPlan, TrainingPlanExercise, TrainingPlanSummary,
};
use sqlx::{postgres::PgRow, types::JsonValue, Row};
use std::collections::{HashMap, HashSet};

pub(super) async fn fetch_training_plan(
    repository: &DomainRepository,
    training_plan_id: &str,
) -> Result<Option<TrainingPlan>, PersistenceError> {
    let maybe_plan_row = sqlx::query(
        "SELECT id::text AS id, name
         FROM training_plans
         WHERE id = $1::uuid",
    )
    .bind(training_plan_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(plan_row) = maybe_plan_row else {
        return Ok(None);
    };

    let mut plan = TrainingPlan {
        id: plan_row.get("id"),
        name: plan_row.get("name"),
        exercises: Vec::new(),
    };

    let exercise_rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT
            tpe.id::text AS training_plan_exercise_id,
            tpe.position,
            tpe.target_sets,
            tpe.target_reps_min,
            tpe.target_reps_max,
            e.id::text AS exercise_id,
            e.name AS exercise_name
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         JOIN exercises e ON e.id = tpe.exercise_id
         ORDER BY tpe.position ASC",
    )
    .bind(training_plan_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut index_by_plan_exercise_id = HashMap::new();

    for row in exercise_rows {
        let training_plan_exercise_id: String = row.get("training_plan_exercise_id");
        index_by_plan_exercise_id.insert(training_plan_exercise_id.clone(), plan.exercises.len());

        plan.exercises.push(TrainingPlanExercise {
            id: training_plan_exercise_id,
            position: row.get("position"),
            target_sets: row.get("target_sets"),
            target_reps_min: row.get("target_reps_min"),
            target_reps_max: row.get("target_reps_max"),
            exercise: Exercise {
                id: row.get("exercise_id"),
                name: row.get("exercise_name"),
            },
            options: Vec::new(),
        });
    }

    let option_rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT
            peo.id::text AS option_id,
            peo.training_plan_exercise_id::text AS training_plan_exercise_id,
            g.id::text AS gym_id,
            g.name AS gym_name,
            ev.id::text AS variant_id,
            ev.exercise_id::text AS variant_exercise_id,
            ev.name AS variant_name,
            ev.variant_type,
            es.id::text AS station_id,
            es.gym_id::text AS station_gym_id,
            es.name AS station_name,
            es.load_profile_id::text AS station_load_profile_id
         FROM plan_exercise_options peo
         JOIN gyms g ON g.id = peo.gym_id
         JOIN exercise_variants ev ON ev.id = peo.exercise_variant_id
         LEFT JOIN LATERAL (
            SELECT
                es.id,
                es.gym_id,
                es.name,
                es.load_profile_id
            FROM exercise_variant_equipment_compatibilities evec
            JOIN equipment_stations es ON es.id = evec.equipment_station_id
            WHERE evec.exercise_variant_id = peo.exercise_variant_id
              AND evec.is_enabled = TRUE
              AND es.gym_id = peo.gym_id
              AND ev.requires_station = TRUE
         ) es ON TRUE
         JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE ev.requires_station = FALSE OR es.id IS NOT NULL
         ORDER BY
            tpe.position ASC,
            peo.selection_order ASC,
            peo.id ASC,
            es.id ASC NULLS FIRST",
    )
    .bind(training_plan_id)
    .fetch_all(&repository.pool)
    .await?;

    for row in option_rows {
        let training_plan_exercise_id: String = row.get("training_plan_exercise_id");
        if let Some(exercise_index) = index_by_plan_exercise_id.get(&training_plan_exercise_id) {
            plan.exercises[*exercise_index]
                .options
                .push(PlanExerciseOption {
                    id: row.get("option_id"),
                    training_plan_exercise_id,
                    gym: Gym {
                        id: row.get("gym_id"),
                        name: row.get("gym_name"),
                    },
                    variant: ExerciseVariant {
                        id: row.get("variant_id"),
                        exercise_id: row.get("variant_exercise_id"),
                        name: row.get("variant_name"),
                        variant_type: row.get("variant_type"),
                    },
                    station: row.get::<Option<String>, _>("station_id").map(|id| {
                        EquipmentStation {
                            id,
                            gym_id: row.get("station_gym_id"),
                            name: row.get("station_name"),
                            load_profile_id: row.get("station_load_profile_id"),
                        }
                    }),
                });
        }
    }

    Ok(Some(plan))
}

pub(super) async fn fetch_training_plan_for_user(
    repository: &DomainRepository,
    training_plan_id: &str,
    user_id: &str,
) -> Result<Option<TrainingPlan>, PersistenceError> {
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

    let mut plan = TrainingPlan {
        id: plan_row.get("id"),
        name: plan_row.get("name"),
        exercises: Vec::new(),
    };

    let exercise_rows = sqlx::query(
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
            tpe.target_sets,
            tpe.target_reps_min,
            tpe.target_reps_max,
            e.id::text AS exercise_id,
            e.name AS exercise_name
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         JOIN exercises e ON e.id = tpe.exercise_id
         WHERE tpe.user_id = $2::uuid
         ORDER BY tpe.position ASC",
    )
    .bind(training_plan_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut index_by_plan_exercise_id = HashMap::new();

    for row in exercise_rows {
        let training_plan_exercise_id: String = row.get("training_plan_exercise_id");
        index_by_plan_exercise_id.insert(training_plan_exercise_id.clone(), plan.exercises.len());

        plan.exercises.push(TrainingPlanExercise {
            id: training_plan_exercise_id,
            position: row.get("position"),
            target_sets: row.get("target_sets"),
            target_reps_min: row.get("target_reps_min"),
            target_reps_max: row.get("target_reps_max"),
            exercise: Exercise {
                id: row.get("exercise_id"),
                name: row.get("exercise_name"),
            },
            options: Vec::new(),
        });
    }

    let option_rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
              AND tpv.user_id = $2::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT
            peo.id::text AS option_id,
            peo.training_plan_exercise_id::text AS training_plan_exercise_id,
            g.id::text AS gym_id,
            g.name AS gym_name,
            ev.id::text AS variant_id,
            ev.exercise_id::text AS variant_exercise_id,
            ev.name AS variant_name,
            ev.variant_type,
            es.id::text AS station_id,
            es.gym_id::text AS station_gym_id,
            es.name AS station_name,
            es.load_profile_id::text AS station_load_profile_id
         FROM plan_exercise_options peo
         JOIN gyms g ON g.id = peo.gym_id
         JOIN exercise_variants ev ON ev.id = peo.exercise_variant_id
         LEFT JOIN LATERAL (
            SELECT
                es.id,
                es.gym_id,
                es.name,
                es.load_profile_id
            FROM exercise_variant_equipment_compatibilities evec
            JOIN equipment_stations es ON es.id = evec.equipment_station_id
            WHERE evec.exercise_variant_id = peo.exercise_variant_id
              AND evec.is_enabled = TRUE
              AND es.gym_id = peo.gym_id
              AND ev.requires_station = TRUE
         ) es ON TRUE
         JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE tpe.user_id = $2::uuid
           AND peo.user_id = $2::uuid
           AND (ev.requires_station = FALSE OR es.id IS NOT NULL)
         ORDER BY
            tpe.position ASC,
            peo.selection_order ASC,
            peo.id ASC,
            es.id ASC NULLS FIRST",
    )
    .bind(training_plan_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    for row in option_rows {
        let training_plan_exercise_id: String = row.get("training_plan_exercise_id");
        if let Some(exercise_index) = index_by_plan_exercise_id.get(&training_plan_exercise_id) {
            plan.exercises[*exercise_index]
                .options
                .push(PlanExerciseOption {
                    id: row.get("option_id"),
                    training_plan_exercise_id,
                    gym: Gym {
                        id: row.get("gym_id"),
                        name: row.get("gym_name"),
                    },
                    variant: ExerciseVariant {
                        id: row.get("variant_id"),
                        exercise_id: row.get("variant_exercise_id"),
                        name: row.get("variant_name"),
                        variant_type: row.get("variant_type"),
                    },
                    station: row.get::<Option<String>, _>("station_id").map(|id| {
                        EquipmentStation {
                            id,
                            gym_id: row.get("station_gym_id"),
                            name: row.get("station_name"),
                            load_profile_id: row.get("station_load_profile_id"),
                        }
                    }),
                });
        }
    }

    Ok(Some(plan))
}

// NOTE: Listing training plans is user-scoped. Callers must provide the authenticated user_id.

pub(super) async fn fetch_gym_summaries(
    repository: &DomainRepository,
) -> Result<Vec<GymSummary>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            id::text AS id,
            name
         FROM gyms
         ORDER BY created_at ASC, id ASC",
    )
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| GymSummary {
            id: row.get("id"),
            name: row.get("name"),
        })
        .collect())
}

// User-scoped variant for listing training plan summaries
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
                COUNT(tpe.id)::bigint AS exercise_count
             FROM training_plans tp
             LEFT JOIN LATERAL (
                SELECT id
                FROM training_plan_versions tpv
                WHERE tpv.training_plan_id = tp.id
                ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
                LIMIT 1
             ) latest_version ON TRUE
             LEFT JOIN training_plan_exercises tpe
               ON tpe.training_plan_version_id = latest_version.id
             WHERE tp.user_id = $1::uuid
             GROUP BY tp.id, tp.name
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
        })
        .collect())
}

pub(super) async fn fetch_plan_exercise_option_summaries(
    repository: &DomainRepository,
    training_plan_id: &str,
    gym_id: &str,
) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
    let rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT
            peo.id::text AS option_id,
            tpe.id::text AS training_plan_exercise_id,
            e.name AS exercise_name,
            tpe.position AS exercise_position,
            ev.id::text AS variant_id,
            ev.name AS variant_name,
            ev.variant_type,
            es.id::text AS station_id,
            es.name AS station_name,
            lp.definition AS station_profile_definition,
            lp.weight_unit AS station_profile_weight_unit
         FROM plan_exercise_options peo
         JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
         JOIN exercises e ON e.id = tpe.exercise_id
         JOIN exercise_variants ev ON ev.id = peo.exercise_variant_id
         LEFT JOIN LATERAL (
            SELECT
                es.id,
                es.name,
                es.load_profile_id
            FROM exercise_variant_equipment_compatibilities evec
            JOIN equipment_stations es ON es.id = evec.equipment_station_id
            WHERE evec.exercise_variant_id = peo.exercise_variant_id
              AND evec.is_enabled = TRUE
              AND es.gym_id = peo.gym_id
              AND ev.requires_station = TRUE
         ) es ON TRUE
         LEFT JOIN load_profiles lp ON lp.id = es.load_profile_id
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE peo.gym_id = $2::uuid
           AND (ev.requires_station = FALSE OR es.id IS NOT NULL)
         ORDER BY
            tpe.position ASC,
            peo.selection_order ASC,
            peo.id ASC,
            es.id ASC NULLS FIRST",
    )
    .bind(training_plan_id)
    .bind(gym_id)
    .fetch_all(&repository.pool)
    .await?;

    rows.into_iter().map(map_option_summary_row).collect()
}

// User-scoped variant for plan exercise option summaries
pub(super) async fn fetch_plan_exercise_option_summaries_for_user(
    repository: &DomainRepository,
    training_plan_id: &str,
    gym_id: &str,
    user_id: &str,
) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
    let rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT
            peo.id::text AS option_id,
            tpe.id::text AS training_plan_exercise_id,
            e.name AS exercise_name,
            tpe.position AS exercise_position,
            ev.id::text AS variant_id,
            ev.name AS variant_name,
            ev.variant_type,
            es.id::text AS station_id,
            es.name AS station_name,
            lp.definition AS station_profile_definition,
            lp.weight_unit AS station_profile_weight_unit
         FROM plan_exercise_options peo
         JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
         JOIN exercises e ON e.id = tpe.exercise_id
         JOIN exercise_variants ev ON ev.id = peo.exercise_variant_id
         LEFT JOIN LATERAL (
            SELECT
                es.id,
                es.name,
                es.load_profile_id
            FROM exercise_variant_equipment_compatibilities evec
            JOIN equipment_stations es ON es.id = evec.equipment_station_id
            WHERE evec.exercise_variant_id = peo.exercise_variant_id
              AND evec.is_enabled = TRUE
              AND es.gym_id = peo.gym_id
              AND ev.requires_station = TRUE
         ) es ON TRUE
         LEFT JOIN load_profiles lp ON lp.id = es.load_profile_id
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id
         WHERE peo.gym_id = $2::uuid
           AND tpe.user_id = $3::uuid
           AND peo.user_id = $3::uuid
           AND (ev.requires_station = FALSE OR es.id IS NOT NULL)
         ORDER BY
            tpe.position ASC,
            peo.selection_order ASC,
            peo.id ASC,
            es.id ASC NULLS FIRST",
    )
    .bind(training_plan_id)
    .bind(gym_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    rows.into_iter().map(map_option_summary_row).collect()
}

fn map_option_summary_row(row: PgRow) -> Result<PlanExerciseOptionSummary, PersistenceError> {
    let definition: Option<JsonValue> = row.get("station_profile_definition");
    let weight_unit: Option<String> = row.get("station_profile_weight_unit");
    let station_profile_loads_kg = match (definition, weight_unit) {
        (Some(definition), Some(weight_unit)) => {
            super::load_profiles::load_profile_definition_to_kg(&definition, &weight_unit)?
        }
        _ => Vec::new(),
    };
    let suggested_start_load_kg =
        super::suggestions::suggest_profile_start_load(&station_profile_loads_kg);

    Ok(PlanExerciseOptionSummary {
        id: row.get("option_id"),
        training_plan_exercise_id: row.get("training_plan_exercise_id"),
        exercise_name: row.get("exercise_name"),
        exercise_position: row.get("exercise_position"),
        variant_id: row.get("variant_id"),
        variant_name: row.get("variant_name"),
        variant_type: row.get("variant_type"),
        station_id: row.get("station_id"),
        station_name: row.get("station_name"),
        station_profile_loads_kg,
        suggested_start_load_kg,
    })
}

pub(super) async fn fetch_training_plan_exercise_ids(
    repository: &DomainRepository,
    training_plan_id: &str,
) -> Result<HashSet<String>, PersistenceError> {
    let rows = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT tpe.id::text AS id
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id",
    )
    .bind(training_plan_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows.into_iter().map(|row| row.get("id")).collect())
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

pub(super) async fn fetch_training_plan_exercise_count(
    repository: &DomainRepository,
    training_plan_id: &str,
) -> Result<i64, PersistenceError> {
    let row = sqlx::query(
        "WITH latest_plan_version AS (
            SELECT tpv.id
            FROM training_plan_versions tpv
            WHERE tpv.training_plan_id = $1::uuid
            ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
            LIMIT 1
         )
         SELECT COUNT(*)::bigint AS exercise_count
         FROM training_plan_exercises tpe
         JOIN latest_plan_version lpv ON lpv.id = tpe.training_plan_version_id",
    )
    .bind(training_plan_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(row.get("exercise_count"))
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
