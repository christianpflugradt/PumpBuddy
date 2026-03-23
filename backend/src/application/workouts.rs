use crate::{
    domain::{ActiveWorkoutExercise, NewWorkout, NewWorkoutExercise},
    persistence::{DomainRepository, PersistenceError},
};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingExerciseRealizability {
    pub training_plan_exercise_id: String,
    pub exercise_name: String,
    pub exercise_position: i32,
    pub reason: String,
}

#[derive(Debug)]
pub enum WorkoutValidationError {
    Validation(String),
    ConfiguredGymStartBlocked {
        message: String,
        missing_exercises: Vec<MissingExerciseRealizability>,
    },
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
    validate_active_workout_base(repository, new_workout, total_exercise_count).await?;
    validate_selected_option_context(repository, new_workout).await?;
    validate_configured_gym_profile_loads(repository, new_workout).await?;

    Ok(())
}

async fn validate_active_workout_base(
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

pub async fn validate_active_workout_start(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    total_exercise_count: i32,
) -> Result<(), WorkoutValidationError> {
    validate_active_workout_base(repository, new_workout, total_exercise_count).await?;
    validate_configured_gym_start_realizability(repository, new_workout).await?;
    validate_selected_option_context(repository, new_workout).await?;
    Ok(())
}

pub async fn validate_fallback_selection_lock(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
    new_workout: &NewWorkout,
) -> Result<(), WorkoutValidationError> {
    let existing_workout = repository
        .fetch_active_workout_for_user(workout_id, user_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or_else(|| {
            WorkoutValidationError::Persistence(PersistenceError::NotFound(
                "Active workout not found".to_owned(),
            ))
        })?;

    let exercise_lookup: HashMap<&str, &NewWorkoutExercise> = new_workout
        .exercises
        .iter()
        .map(|exercise| (exercise.training_plan_exercise_id.as_str(), exercise))
        .collect();

    for existing_exercise in existing_workout
        .exercises
        .iter()
        .filter(|exercise| !exercise.completed_sets.is_empty())
    {
        let Some(next_exercise) =
            exercise_lookup.get(existing_exercise.training_plan_exercise_id.as_str())
        else {
            return Err(WorkoutValidationError::Validation(
                "Fallback selection cannot change after first completed set".to_owned(),
            ));
        };

        if has_selection_changed(existing_exercise, next_exercise) {
            return Err(WorkoutValidationError::Validation(
                "Fallback selection cannot change after first completed set".to_owned(),
            ));
        }
    }

    Ok(())
}

async fn validate_selected_option_context(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
) -> Result<(), WorkoutValidationError> {
    if new_workout.gym_id.trim().is_empty() || new_workout.exercises.is_empty() {
        return Ok(());
    }

    let option_summaries = repository
        .fetch_plan_exercise_option_summaries(&new_workout.training_plan_id, &new_workout.gym_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    if option_summaries.is_empty() {
        return Err(WorkoutValidationError::Validation(
            "No selectable exercise options exist for the selected training plan and gym"
                .to_owned(),
        ));
    }

    let mut option_lookup = std::collections::HashMap::with_capacity(option_summaries.len());
    for option in option_summaries {
        option_lookup.insert(
            (option.training_plan_exercise_id, option.id),
            (option.variant_id, option.station_id),
        );
    }

    for exercise in &new_workout.exercises {
        let Some(option_id) = trimmed(&exercise.selected_plan_exercise_option_id) else {
            continue;
        };
        let Some(variant_id) = trimmed(&exercise.selected_variant_id) else {
            continue;
        };
        let Some(station_id) = trimmed(&exercise.selected_station_id) else {
            continue;
        };

        let key = (
            exercise.training_plan_exercise_id.clone(),
            option_id.to_owned(),
        );
        let Some((expected_variant_id, expected_station_id)) = option_lookup.get(&key) else {
            return Err(WorkoutValidationError::Validation(
                "selected_plan_exercise_option_id must belong to the matching training plan exercise"
                    .to_owned(),
            ));
        };

        if expected_variant_id != variant_id {
            return Err(WorkoutValidationError::Validation(
                "selected_variant_id must match selected_plan_exercise_option_id".to_owned(),
            ));
        }

        if expected_station_id != station_id {
            return Err(WorkoutValidationError::Validation(
                "selected_station_id must match selected_plan_exercise_option_id".to_owned(),
            ));
        }
    }

    Ok(())
}

async fn validate_configured_gym_start_realizability(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
) -> Result<(), WorkoutValidationError> {
    if new_workout.gym_id.trim().is_empty() {
        return Ok(());
    }

    let training_plan = repository
        .fetch_training_plan(&new_workout.training_plan_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?
        .ok_or_else(|| {
            WorkoutValidationError::Validation("Selected training plan was not found".to_owned())
        })?;

    let option_summaries = repository
        .fetch_plan_exercise_option_summaries(&new_workout.training_plan_id, &new_workout.gym_id)
        .await
        .map_err(WorkoutValidationError::Persistence)?;

    let realizable_exercise_ids: HashSet<String> = option_summaries
        .into_iter()
        .map(|option| option.training_plan_exercise_id)
        .collect();

    let missing_exercises: Vec<MissingExerciseRealizability> = training_plan
        .exercises
        .into_iter()
        .filter(|exercise| !realizable_exercise_ids.contains(&exercise.id))
        .map(|exercise| MissingExerciseRealizability {
            training_plan_exercise_id: exercise.id,
            exercise_name: exercise.exercise.name,
            exercise_position: exercise.position,
            reason: "no_realizable_option_in_selected_gym".to_owned(),
        })
        .collect();

    if missing_exercises.is_empty() {
        return Ok(());
    }

    Err(WorkoutValidationError::ConfiguredGymStartBlocked {
        message: "Configured-gym workout start requires realizable options for every plan exercise"
            .to_owned(),
        missing_exercises,
    })
}

async fn validate_configured_gym_profile_loads(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
) -> Result<(), WorkoutValidationError> {
    if new_workout.gym_id.trim().is_empty() {
        return Ok(());
    }

    let mut profile_loads_by_station = HashMap::new();

    for exercise in &new_workout.exercises {
        if exercise.sets.is_empty() {
            continue;
        }

        let Some(station_id) = trimmed(&exercise.selected_station_id) else {
            continue;
        };

        if !profile_loads_by_station.contains_key(station_id) {
            let fetched = repository
                .fetch_station_profile_loads(station_id)
                .await
                .map_err(WorkoutValidationError::Persistence)?;
            profile_loads_by_station.insert(station_id.to_owned(), fetched);
        }
        let profile_loads = &profile_loads_by_station[station_id];

        if profile_loads.is_empty() {
            return Err(WorkoutValidationError::Validation(
                "selected_station_id must reference a station with load steps".to_owned(),
            ));
        }

        for set in &exercise.sets {
            let snapped =
                DomainRepository::snap_to_profile_load(profile_loads, set.load_canonical_kg)
                    .ok_or_else(|| {
                        WorkoutValidationError::Validation(
                            "set.load_value must be a finite number".to_owned(),
                        )
                    })?;

            if (snapped - set.load_canonical_kg).abs() > 1e-9 {
                return Err(WorkoutValidationError::Validation(
                    "set.load_value must match selected station load profile steps in configured-gym mode"
                        .to_owned(),
                ));
            }
        }
    }

    Ok(())
}

fn trimmed(value: &Option<String>) -> Option<&str> {
    let candidate = value.as_deref()?.trim();
    if candidate.is_empty() {
        None
    } else {
        Some(candidate)
    }
}

fn trimmed_str(value: &Option<String>) -> Option<&str> {
    let candidate = value.as_deref()?.trim();
    if candidate.is_empty() {
        None
    } else {
        Some(candidate)
    }
}

fn has_selection_changed(existing: &ActiveWorkoutExercise, next: &NewWorkoutExercise) -> bool {
    trimmed_str(&existing.selected_plan_exercise_option_id)
        != trimmed_str(&next.selected_plan_exercise_option_id)
        || trimmed_str(&existing.selected_variant_id) != trimmed_str(&next.selected_variant_id)
        || trimmed_str(&existing.selected_station_id) != trimmed_str(&next.selected_station_id)
}

#[cfg(test)]
mod tests {
    use super::{
        validate_active_workout, validate_active_workout_start,
        validate_exercises_match_training_plan, validate_fallback_selection_lock,
        WorkoutValidationError,
    };
    use crate::{
        domain::{NewWorkout, NewWorkoutExercise, NewWorkoutSet},
        persistence::DomainRepository,
        test_support::{
            connect_with_retry, reset_test_database, resolve_test_database_url, test_db_lock,
        },
    };
    use sqlx::PgPool;

    const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";

    async fn require_pool() -> PgPool {
        let database_url = resolve_test_database_url().await;
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

    fn workout_with_multi_option_exercise() -> NewWorkout {
        NewWorkout {
            training_plan_id: "00000000-0000-0000-0000-000000000201".to_owned(),
            gym_id: "00000000-0000-0000-0000-000000000101".to_owned(),
            started_at: Some("2026-02-10T09:00:00Z".to_owned()),
            completed_at: None,
            current_exercise_position: Some(1),
            exercises: vec![NewWorkoutExercise {
                training_plan_exercise_id: "00000000-0000-0000-0000-000000000803".to_owned(),
                position: 1,
                selected_variant_id: Some("00000000-0000-0000-0000-000000000404".to_owned()),
                selected_station_id: Some("00000000-0000-0000-0000-000000000703".to_owned()),
                selected_plan_exercise_option_id: Some(
                    "00000000-0000-0000-0000-000000001005".to_owned(),
                ),
                sets: vec![],
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

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_variant_mismatch_for_option() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000402".to_owned());
        workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000701".to_owned());

        match validate_active_workout(&repository, &workout, 5)
            .await
            .expect_err("mismatched option context should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_variant_id must match selected_plan_exercise_option_id"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_option_for_other_exercise() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001003".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000403".to_owned());
        workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000706".to_owned());

        match validate_active_workout(&repository, &workout, 5)
            .await
            .expect_err("option from another exercise should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_plan_exercise_option_id must belong to the matching training plan exercise"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_station_mismatch_for_option() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000401".to_owned());
        workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000706".to_owned());

        match validate_active_workout(&repository, &workout, 5)
            .await
            .expect_err("station mismatch should fail")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "selected_station_id must match selected_plan_exercise_option_id"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_when_no_options_exist_for_gym() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        sqlx::query(
            "INSERT INTO gyms (id, name)
             VALUES ($1::uuid, $2)
             ON CONFLICT (id) DO NOTHING",
        )
        .bind("00000000-0000-0000-0000-000000009001")
        .bind("No Options Gym")
        .execute(&pool)
        .await
        .expect("gym insert should succeed");

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.gym_id = "00000000-0000-0000-0000-000000009001".to_owned();

        match validate_active_workout_start(&repository, &workout, 5)
            .await
            .expect_err("gym without options should fail")
        {
            WorkoutValidationError::ConfiguredGymStartBlocked {
                message,
                missing_exercises,
            } => {
                assert_eq!(
                    message,
                    "Configured-gym workout start requires realizable options for every plan exercise"
                );
                assert_eq!(missing_exercises.len(), 5);
                assert!(missing_exercises
                    .iter()
                    .all(|exercise| exercise.reason == "no_realizable_option_in_selected_gym"));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_start_rejects_when_any_plan_exercise_is_unrealizable_in_selected_gym() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        sqlx::query(
            "DELETE FROM plan_exercise_options
             WHERE gym_id = $1::uuid
               AND training_plan_exercise_id = $2::uuid",
        )
        .bind("00000000-0000-0000-0000-000000000101")
        .bind("00000000-0000-0000-0000-000000000805")
        .execute(&pool)
        .await
        .expect("option delete should succeed");

        let repository = DomainRepository::new(pool);
        let workout = sample_workout();

        match validate_active_workout_start(&repository, &workout, 5)
            .await
            .expect_err("single unrealizable exercise should block configured-gym start")
        {
            WorkoutValidationError::ConfiguredGymStartBlocked {
                message,
                missing_exercises,
            } => {
                assert_eq!(
                    message,
                    "Configured-gym workout start requires realizable options for every plan exercise"
                );
                assert_eq!(missing_exercises.len(), 1);
                assert_eq!(
                    missing_exercises[0].training_plan_exercise_id,
                    "00000000-0000-0000-0000-000000000805"
                );
                assert_eq!(
                    missing_exercises[0].reason,
                    "no_realizable_option_in_selected_gym"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_accepts_matching_option_variant_station() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000401".to_owned());
        workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000701".to_owned());

        validate_active_workout(&repository, &workout, 5)
            .await
            .expect("matching option context should validate");
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_off_profile_set_loads_in_configured_gym()
    {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001001".to_owned());
        workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000401".to_owned());
        workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000701".to_owned());
        workout.exercises[0].sets[0].load_display_value = 22.5;
        workout.exercises[0].sets[0].load_canonical_kg = 22.5;

        match validate_active_workout(&repository, &workout, 5)
            .await
            .expect_err("off-profile load should fail in configured-gym mode")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "set.load_value must match selected station load profile steps in configured-gym mode"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_allows_non_profile_loads_in_free_mode() {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut workout = sample_workout();
        workout.gym_id.clear();
        workout.exercises[0].sets[0].load_display_value = 22.5;
        workout.exercises[0].sets[0].load_canonical_kg = 22.5;

        validate_active_workout(&repository, &workout, 5)
            .await
            .expect("free mode should not enforce station profile steps");
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_allows_fallback_change_before_first_completed_set(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let initial_workout = workout_with_multi_option_exercise();
        let created = repository
            .create_active_workout(&initial_workout)
            .await
            .expect("active workout should be created");

        let mut updated_workout = initial_workout;
        updated_workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001006".to_owned());
        updated_workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000405".to_owned());
        updated_workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000702".to_owned());

        validate_fallback_selection_lock(&repository, &created.id, DEV_USER_ID, &updated_workout)
            .await
            .expect("fallback should remain mutable before first completed set");
    }

    #[tokio::test]
    async fn active_workout_selection_consistency_rejects_fallback_change_after_first_completed_set(
    ) {
        let _guard = test_db_lock().lock().await;
        let pool = require_pool().await;

        let repository = DomainRepository::new(pool);
        let mut initial_workout = workout_with_multi_option_exercise();
        initial_workout.exercises[0].sets.push(NewWorkoutSet {
            set_index: 1,
            reps: Some(10),
            load_display_value: 20.0,
            load_display_unit: "kg".to_owned(),
            load_canonical_kg: 20.0,
            completed_at: None,
        });

        let created = repository
            .create_active_workout(&initial_workout)
            .await
            .expect("active workout should be created");

        let mut updated_workout = initial_workout;
        updated_workout.exercises[0].selected_plan_exercise_option_id =
            Some("00000000-0000-0000-0000-000000001006".to_owned());
        updated_workout.exercises[0].selected_variant_id =
            Some("00000000-0000-0000-0000-000000000405".to_owned());
        updated_workout.exercises[0].selected_station_id =
            Some("00000000-0000-0000-0000-000000000702".to_owned());

        match validate_fallback_selection_lock(
            &repository,
            &created.id,
            DEV_USER_ID,
            &updated_workout,
        )
        .await
        .expect_err("fallback change should be locked after first completed set")
        {
            WorkoutValidationError::Validation(message) => {
                assert_eq!(
                    message,
                    "Fallback selection cannot change after first completed set"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    // Residual gap accepted for this item:
    // combinations where only one or two selection IDs are present are already validated by
    // API-layer invariant tests; duplicating them here would add low signal.
}
