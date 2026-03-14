use crate::{
    domain::NewWorkout,
    persistence::{DomainRepository, PersistenceError},
};

#[derive(Debug)]
pub enum WorkoutValidationError {
    Validation(String),
    Persistence(PersistenceError),
}

pub async fn validate_exercises_match_training_plan(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
) -> Result<(), WorkoutValidationError> {
    let valid_exercise_ids = repository
        .fetch_training_plan_exercise_ids(&new_workout.training_plan_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    if new_workout
        .exercises
        .iter()
        .any(|exercise| !valid_exercise_ids.contains(&exercise.training_plan_exercise_id))
    {
        return Err(WorkoutValidationError::Validation(
            "Each exercise must belong to the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

pub async fn validate_active_workout(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    total_exercise_count: i32,
) -> Result<(), WorkoutValidationError> {
    validate_exercises_match_training_plan(repository, new_workout).await?;

    let expected_count = repository
        .fetch_training_plan_exercise_count(&new_workout.training_plan_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    if expected_count == 0 {
        return Err(WorkoutValidationError::Validation(
            "Selected training plan has no exercises".to_owned(),
        ));
    }

    if expected_count != i64::from(total_exercise_count) {
        return Err(WorkoutValidationError::Validation(
            "total_exercise_count must match the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        validate_active_workout, validate_exercises_match_training_plan, WorkoutValidationError,
    };
    use crate::{
        domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet},
        persistence::DomainRepository,
        test_support::{
            connect_with_retry, reset_test_database, resolve_test_database_url, test_db_lock,
        },
    };
    use sqlx::PgPool;

    async fn require_pool() -> PgPool {
        let database_url = resolve_test_database_url();
        let pool = connect_with_retry(&database_url).await;

        reset_test_database(&pool).await;
        initialize_schema(&pool).await;
        pool
    }

    async fn initialize_schema(pool: &PgPool) {
        sqlx::raw_sql(include_str!("../../init.sql"))
            .execute(pool)
            .await
            .expect("init.sql should apply cleanly");
    }

    fn sample_workout() -> NewWorkout {
        NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-10T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: None,
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000801".to_owned(),
                position: 1,
                selected_variant_id: None,
                selected_station_id: None,
                selected_plan_exercise_option_id: None,
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: Some(10),
                    load_display_value: 20.0,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: 20.0,
                    completed_at: None,
                }],
            }],
        }
    }

    #[tokio::test]
    async fn validate_exercises_match_training_plan_checks_membership_against_repository() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let valid_workout = sample_workout();

        validate_exercises_match_training_plan(&repository, &valid_workout)
            .await
            .expect("matching exercises should validate");

        let mut invalid_workout = valid_workout;
        invalid_workout.exercises[0].training_plan_exercise_id =
            "00000000-0000-0000-0000-000000000806".to_owned();

        match validate_exercises_match_training_plan(&repository, &invalid_workout)
            .await
            .expect_err("exercise from another plan should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "Each exercise must belong to the selected training plan"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn validate_active_workout_rejects_training_plans_without_exercises() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool.clone());
        sqlx::query(
            "INSERT INTO training_plans (id, name)
             VALUES ($1::uuid, $2)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind("00000000-0000-0000-0000-000000009999")
        .bind("Empty Plan")
        .execute(&pool)
        .await
        .expect("empty training plan should insert");

        let mut workout = sample_workout();
        workout.training_plan_id = "00000000-0000-0000-0000-000000009999".to_owned();
        workout.exercises.clear();

        match validate_active_workout(&repository, &workout, 1)
            .await
            .expect_err("plans without exercises should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(message, "Selected training plan has no exercises");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn validate_active_workout_rejects_total_count_mismatch() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let workout = sample_workout();

        match validate_active_workout(&repository, &workout, 4)
            .await
            .expect_err("mismatched counts should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "total_exercise_count must match the selected training plan"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
