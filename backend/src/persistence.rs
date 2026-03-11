use crate::domain::{
    EquipmentStation, Exercise, ExerciseVariant, Gym, GymSummary, NewWorkout, PlanExerciseOption,
    PlanExerciseOptionSummary, TrainingPlan, TrainingPlanExercise, TrainingPlanSummary, Workout,
    WorkoutExercise, WorkoutSet, WorkoutSummary,
};
use sqlx::{PgPool, Row};
use std::collections::HashMap;

#[derive(Debug)]
pub enum PersistenceError {
    Sqlx(sqlx::Error),
}

impl From<sqlx::Error> for PersistenceError {
    fn from(value: sqlx::Error) -> Self {
        Self::Sqlx(value)
    }
}

#[derive(Clone)]
pub struct DomainRepository {
    pool: PgPool,
}

impl DomainRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn fetch_training_plan(
        &self,
        training_plan_id: &str,
    ) -> Result<Option<TrainingPlan>, PersistenceError> {
        let maybe_plan_row = sqlx::query(
            "SELECT id::text AS id, name
             FROM training_plans
             WHERE id = $1::uuid",
        )
        .bind(training_plan_id)
        .fetch_optional(&self.pool)
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
            "SELECT
                tpe.id::text AS training_plan_exercise_id,
                tpe.position,
                tpe.target_sets,
                tpe.target_reps_min,
                tpe.target_reps_max,
                e.id::text AS exercise_id,
                e.name AS exercise_name
             FROM training_plan_exercises tpe
             JOIN exercises e ON e.id = tpe.exercise_id
             WHERE tpe.training_plan_id = $1::uuid
             ORDER BY tpe.position ASC",
        )
        .bind(training_plan_id)
        .fetch_all(&self.pool)
        .await?;

        let mut index_by_plan_exercise_id = HashMap::new();

        for row in exercise_rows {
            let training_plan_exercise_id: String = row.get("training_plan_exercise_id");
            index_by_plan_exercise_id
                .insert(training_plan_exercise_id.clone(), plan.exercises.len());

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
            "SELECT
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
             JOIN equipment_stations es ON es.id = peo.equipment_station_id
             JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
             WHERE tpe.training_plan_id = $1::uuid
             ORDER BY tpe.position ASC, peo.id ASC",
        )
        .bind(training_plan_id)
        .fetch_all(&self.pool)
        .await?;

        for row in option_rows {
            let training_plan_exercise_id: String = row.get("training_plan_exercise_id");
            if let Some(exercise_index) = index_by_plan_exercise_id.get(&training_plan_exercise_id)
            {
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
                        station: EquipmentStation {
                            id: row.get("station_id"),
                            gym_id: row.get("station_gym_id"),
                            name: row.get("station_name"),
                            load_profile_id: row.get("station_load_profile_id"),
                        },
                    });
            }
        }

        Ok(Some(plan))
    }

    pub async fn fetch_training_plan_summaries(
        &self,
    ) -> Result<Vec<TrainingPlanSummary>, PersistenceError> {
        let rows = sqlx::query(
            "SELECT
                tp.id::text AS id,
                tp.name,
                COUNT(tpe.id)::bigint AS exercise_count
             FROM training_plans tp
             LEFT JOIN training_plan_exercises tpe ON tpe.training_plan_id = tp.id
             GROUP BY tp.id, tp.name
             ORDER BY tp.created_at ASC, tp.id ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| TrainingPlanSummary {
                id: row.get("id"),
                name: row.get("name"),
                exercise_count: row.get("exercise_count"),
            })
            .collect())
    }

    pub async fn fetch_gym_summaries(&self) -> Result<Vec<GymSummary>, PersistenceError> {
        let rows = sqlx::query(
            "SELECT
                id::text AS id,
                name
             FROM gyms
             ORDER BY created_at ASC, id ASC",
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| GymSummary {
                id: row.get("id"),
                name: row.get("name"),
            })
            .collect())
    }

    pub async fn fetch_plan_exercise_option_summaries(
        &self,
        training_plan_id: &str,
        gym_id: &str,
    ) -> Result<Vec<PlanExerciseOptionSummary>, PersistenceError> {
        let rows = sqlx::query(
            "SELECT
                peo.id::text AS option_id,
                tpe.id::text AS training_plan_exercise_id,
                e.name AS exercise_name,
                tpe.position AS exercise_position,
                ev.id::text AS variant_id,
                ev.name AS variant_name,
                ev.variant_type,
                es.id::text AS station_id,
                es.name AS station_name
             FROM plan_exercise_options peo
             JOIN training_plan_exercises tpe ON tpe.id = peo.training_plan_exercise_id
             JOIN exercises e ON e.id = tpe.exercise_id
             JOIN exercise_variants ev ON ev.id = peo.exercise_variant_id
             JOIN equipment_stations es ON es.id = peo.equipment_station_id
             WHERE tpe.training_plan_id = $1::uuid
               AND peo.gym_id = $2::uuid
             ORDER BY tpe.position ASC, ev.name ASC, es.name ASC",
        )
        .bind(training_plan_id)
        .bind(gym_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| PlanExerciseOptionSummary {
                id: row.get("option_id"),
                training_plan_exercise_id: row.get("training_plan_exercise_id"),
                exercise_name: row.get("exercise_name"),
                exercise_position: row.get("exercise_position"),
                variant_id: row.get("variant_id"),
                variant_name: row.get("variant_name"),
                variant_type: row.get("variant_type"),
                station_id: row.get("station_id"),
                station_name: row.get("station_name"),
            })
            .collect())
    }

    pub async fn fetch_workout_summary(
        &self,
        workout_id: &str,
    ) -> Result<Option<WorkoutSummary>, PersistenceError> {
        let maybe_row = sqlx::query(
            "SELECT
                w.id::text AS id,
                w.training_plan_id::text AS training_plan_id,
                tp.name AS training_plan_name,
                w.gym_id::text AS gym_id,
                g.name AS gym_name,
                w.started_at::text AS started_at,
                w.completed_at::text AS completed_at,
                COUNT(DISTINCT we.id)::bigint AS exercise_count,
                COUNT(ws.id)::bigint AS completed_set_count
             FROM workouts w
             JOIN training_plans tp ON tp.id = w.training_plan_id
             JOIN gyms g ON g.id = w.gym_id
             LEFT JOIN workout_exercises we ON we.workout_id = w.id
             LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
             WHERE w.id = $1::uuid
             GROUP BY w.id, tp.name, g.name",
        )
        .bind(workout_id)
        .fetch_optional(&self.pool)
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

    pub async fn create_workout(
        &self,
        new_workout: &NewWorkout,
    ) -> Result<Workout, PersistenceError> {
        let mut tx = self.pool.begin().await?;

        let workout_row = sqlx::query(
            "INSERT INTO workouts (training_plan_id, gym_id, started_at, completed_at)
             VALUES ($1::uuid, $2::uuid, $3::timestamptz, $4::timestamptz)
             RETURNING id::text AS id",
        )
        .bind(&new_workout.training_plan_id)
        .bind(&new_workout.gym_id)
        .bind(new_workout.started_at.as_deref())
        .bind(new_workout.completed_at.as_deref())
        .fetch_one(&mut *tx)
        .await?;

        let workout_id: String = workout_row.get("id");

        for exercise in &new_workout.exercises {
            // The current renderer may not yet submit final option/variant/station selections for
            // every exercise. Those nullable columns deliberately persist `NULL` until later work
            // replaces this temporary path with real user-selected references.
            let workout_exercise_row = sqlx::query(
                "INSERT INTO workout_exercises (
                    workout_id,
                    training_plan_exercise_id,
                    position,
                    selected_variant_id,
                    selected_station_id,
                    selected_plan_exercise_option_id
                 )
                 VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid)
                 RETURNING id::text AS id",
            )
            .bind(&workout_id)
            .bind(&exercise.training_plan_exercise_id)
            .bind(exercise.position)
            .bind(exercise.selected_variant_id.as_deref())
            .bind(exercise.selected_station_id.as_deref())
            .bind(exercise.selected_plan_exercise_option_id.as_deref())
            .fetch_one(&mut *tx)
            .await?;

            let workout_exercise_id: String = workout_exercise_row.get("id");

            for set in &exercise.sets {
                sqlx::query(
                    "INSERT INTO workout_sets (
                        workout_exercise_id,
                        set_index,
                        reps,
                        load_display_value,
                        load_display_unit,
                        load_canonical_kg,
                        completed_at
                     )
                     VALUES ($1::uuid, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))",
                )
                .bind(&workout_exercise_id)
                .bind(set.set_index)
                // `reps` remains nullable for the current slice so the backend can persist either
                // temporary fixed reps or no reps until real reps entry is collected in the UI.
                .bind(set.reps)
                .bind(set.load_display_value)
                .bind(&set.load_display_unit)
                .bind(set.load_canonical_kg)
                .bind(set.completed_at.as_deref())
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;

        let created = self.fetch_workout(&workout_id).await?;
        match created {
            Some(workout) => Ok(workout),
            None => Err(PersistenceError::Sqlx(sqlx::Error::RowNotFound)),
        }
    }

    pub async fn fetch_workout(
        &self,
        workout_id: &str,
    ) -> Result<Option<Workout>, PersistenceError> {
        let maybe_workout_row = sqlx::query(
            "SELECT
                id::text AS id,
                training_plan_id::text AS training_plan_id,
                gym_id::text AS gym_id,
                started_at::text AS started_at,
                completed_at::text AS completed_at
             FROM workouts
             WHERE id = $1::uuid",
        )
        .bind(workout_id)
        .fetch_optional(&self.pool)
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
                selected_plan_exercise_option_id::text AS selected_plan_exercise_option_id
             FROM workout_exercises
             WHERE workout_id = $1::uuid
             ORDER BY position ASC",
        )
        .bind(workout_id)
        .fetch_all(&self.pool)
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
                selected_plan_exercise_option_id: row.get("selected_plan_exercise_option_id"),
                sets: Vec::new(),
            });
        }

        let set_rows = sqlx::query(
            "SELECT
                id::text AS id,
                workout_exercise_id::text AS workout_exercise_id,
                set_index,
                reps,
                load_display_value::double precision AS load_display_value,
                load_display_unit,
                load_canonical_kg::double precision AS load_canonical_kg,
                completed_at::text AS completed_at
             FROM workout_sets
             WHERE workout_exercise_id IN (
                SELECT id FROM workout_exercises WHERE workout_id = $1::uuid
             )
             ORDER BY workout_exercise_id ASC, set_index ASC",
        )
        .bind(workout_id)
        .fetch_all(&self.pool)
        .await?;

        for row in set_rows {
            let set_workout_exercise_id: String = row.get("workout_exercise_id");
            if let Some(exercise_index) = index_by_workout_exercise_id.get(&set_workout_exercise_id)
            {
                workout.exercises[*exercise_index].sets.push(WorkoutSet {
                    id: row.get("id"),
                    set_index: row.get("set_index"),
                    reps: row.get("reps"),
                    load_display_value: row.get("load_display_value"),
                    load_display_unit: row.get("load_display_unit"),
                    load_canonical_kg: row.get("load_canonical_kg"),
                    completed_at: row.get("completed_at"),
                });
            }
        }

        Ok(Some(workout))
    }

    pub async fn fetch_first_training_plan_name(&self) -> Result<Option<String>, PersistenceError> {
        let row = sqlx::query(
            "SELECT name
             FROM training_plans
             ORDER BY created_at ASC, id ASC
             LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|record| record.get("name")))
    }
}

#[cfg(test)]
mod tests {
    use super::DomainRepository;
    use crate::domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet};
    use sqlx::{postgres::PgPoolOptions, PgPool, Row};
    use std::env;

    async fn maybe_pool() -> Option<PgPool> {
        let database_url = env::var("TEST_DATABASE_URL")
            .ok()
            .or_else(|| env::var("DATABASE_URL").ok())?;

        PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await
            .ok()
    }

    async fn schema_ready(pool: &PgPool) -> bool {
        match sqlx::query("SELECT to_regclass('public.training_plans')::text AS relation")
            .fetch_one(pool)
            .await
        {
            Ok(row) => {
                let relation: Option<String> = row.get("relation");
                relation.is_some()
            }
            Err(_) => false,
        }
    }

    #[tokio::test]
    async fn fetch_training_plan_hydrates_exercises_and_options() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let repository = DomainRepository::new(pool);
        let plan = repository
            .fetch_training_plan("00000000-0000-0000-0000-000000000201")
            .await
            .expect("fetch training plan query should succeed")
            .expect("push day seed training plan should exist");

        assert_eq!(plan.name, "Push Day");
        assert_eq!(plan.exercises.len(), 5);
        assert!(plan
            .exercises
            .iter()
            .any(|exercise| !exercise.options.is_empty()));
    }

    #[tokio::test]
    async fn fetch_training_plan_summaries_returns_seed_plans() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let repository = DomainRepository::new(pool);
        let plans = repository
            .fetch_training_plan_summaries()
            .await
            .expect("fetch training plan summaries should succeed");

        assert!(plans.len() >= 2);
        assert!(plans
            .iter()
            .any(|plan| plan.name == "Push Day" && plan.exercise_count == 5));
        assert!(plans
            .iter()
            .any(|plan| plan.name == "Pull Day" && plan.exercise_count == 5));
    }

    #[tokio::test]
    async fn fetch_gym_summaries_returns_seed_gyms_in_stable_order() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let repository = DomainRepository::new(pool);
        let gyms = repository
            .fetch_gym_summaries()
            .await
            .expect("fetch gym summaries should succeed");

        assert_eq!(
            gyms,
            vec![
                crate::domain::GymSummary {
                    id: "00000000-0000-0000-0000-000000000101".to_owned(),
                    name: "Forge Downtown".to_owned(),
                },
                crate::domain::GymSummary {
                    id: "00000000-0000-0000-0000-000000000102".to_owned(),
                    name: "Iron Temple West".to_owned(),
                },
            ]
        );
    }

    #[tokio::test]
    async fn fetch_plan_exercise_option_summaries_returns_gym_specific_options() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let repository = DomainRepository::new(pool);
        let options = repository
            .fetch_plan_exercise_option_summaries(
                "00000000-0000-0000-0000-000000000201",
                "00000000-0000-0000-0000-000000000101",
            )
            .await
            .expect("fetch option summaries should succeed");

        assert!(!options.is_empty());
        assert!(options
            .iter()
            .any(|option| option.exercise_position == 1 && !option.variant_name.is_empty()));
    }

    #[tokio::test]
    async fn create_workout_round_trip_hydrates_sets() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let repository = DomainRepository::new(pool);

        let workout = repository
            .create_workout(&NewWorkout {
                training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
                gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
                started_at: Some("2026-01-01T08:00:00Z".to_owned()),
                completed_at: None,
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
                            completed_at: Some("2026-01-01T08:05:00Z".to_owned()),
                        },
                        NewWorkoutSet {
                            set_index: 2,
                            reps: Some(8),
                            load_display_value: 22.5,
                            load_display_unit: "kg".to_owned(),
                            load_canonical_kg: 22.5,
                            completed_at: Some("2026-01-01T08:10:00Z".to_owned()),
                        },
                    ],
                }],
            })
            .await
            .expect("create workout should succeed");

        assert_eq!(
            workout.training_plan_id,
            "00000000-0000-0000-0000-000000000201"
        );
        assert_eq!(workout.exercises.len(), 1);
        assert_eq!(workout.exercises[0].sets.len(), 2);
        assert_eq!(workout.exercises[0].sets[0].set_index, 1);
        assert_eq!(workout.exercises[0].sets[1].load_display_value, 22.5);

        let summary = repository
            .fetch_workout_summary(&workout.id)
            .await
            .expect("fetch workout summary should succeed")
            .expect("created workout summary should exist");

        assert_eq!(summary.training_plan_name, "Push Day");
        assert_eq!(summary.exercise_count, 1);
        assert_eq!(summary.completed_set_count, 2);
    }
}
