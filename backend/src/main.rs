use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use pumpbuddy_backend::domain::{
    ActiveWorkout, ActiveWorkoutExercise, ActiveWorkoutSet, NewWorkout, NewWorkoutExercise,
    NewWorkoutSet,
};
use pumpbuddy_backend::persistence::DomainRepository;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::{collections::HashSet, env, net::SocketAddr};

#[derive(Clone)]
struct AppState {
    repository: DomainRepository,
}

#[derive(Serialize)]
struct HelloWorldResponse {
    value: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    message: String,
}

#[derive(Serialize)]
struct TrainingPlanSummaryResponse {
    id: String,
    name: String,
    exercise_count: i64,
}

#[derive(Serialize)]
struct GymSummaryResponse {
    id: String,
    name: String,
}

#[derive(Serialize)]
struct PlanExerciseOptionSummaryResponse {
    id: String,
    training_plan_exercise_id: String,
    exercise_name: String,
    exercise_position: i32,
    variant_id: String,
    variant_name: String,
    variant_type: String,
    station_id: String,
    station_name: String,
}

#[derive(Serialize)]
struct TrainingPlanOptionsResponse {
    training_plan_id: String,
    gym_id: String,
    options: Vec<PlanExerciseOptionSummaryResponse>,
}

#[derive(Serialize)]
struct WorkoutSummaryResponse {
    id: String,
    training_plan_id: String,
    training_plan_name: String,
    gym_id: String,
    gym_name: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    exercise_count: i64,
    completed_set_count: i64,
}

#[derive(Serialize)]
struct ActiveWorkoutResponse {
    workout: ActiveWorkoutDetailResponse,
}

#[derive(Serialize)]
struct ActiveWorkoutDetailResponse {
    id: String,
    training_plan_id: String,
    training_plan_name: String,
    gym_id: String,
    gym_name: String,
    started_at: String,
    updated_at: String,
    current_exercise_position: i32,
    total_exercise_count: i32,
    exercises: Vec<ActiveWorkoutExerciseResponse>,
}

#[derive(Serialize)]
struct ActiveWorkoutExerciseResponse {
    training_plan_exercise_id: String,
    position: i32,
    exercise_name: String,
    selected_plan_exercise_option_id: Option<String>,
    selected_variant_id: Option<String>,
    selected_variant_name: Option<String>,
    selected_station_id: Option<String>,
    selected_station_name: Option<String>,
    set: Option<ActiveWorkoutSetResponse>,
}

#[derive(Serialize)]
struct ActiveWorkoutSetResponse {
    load_value: f64,
    reps: Option<i32>,
}

#[derive(Deserialize)]
struct CreateWorkoutRequest {
    training_plan_id: String,
    gym_id: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    exercises: Vec<CreateWorkoutExerciseInput>,
}

#[derive(Deserialize)]
struct CreateWorkoutExerciseInput {
    training_plan_exercise_id: String,
    position: i32,
    selected_plan_exercise_option_id: Option<String>,
    selected_variant_id: Option<String>,
    selected_station_id: Option<String>,
    set: CreateWorkoutSetInput,
}

#[derive(Deserialize)]
struct CreateWorkoutSetInput {
    load_value: f64,
    reps: Option<i32>,
}

#[derive(Deserialize)]
struct CreateActiveWorkoutRequest {
    training_plan_id: String,
    gym_id: String,
    started_at: String,
    current_exercise_position: i32,
    total_exercise_count: i32,
    exercises: Vec<ActiveWorkoutExerciseInput>,
    first_confirmed_exercise_position: i32,
}

#[derive(Deserialize)]
struct UpdateActiveWorkoutRequest {
    training_plan_id: String,
    gym_id: String,
    started_at: String,
    current_exercise_position: i32,
    total_exercise_count: i32,
    exercises: Vec<ActiveWorkoutExerciseInput>,
    last_confirmed_exercise_position: i32,
}

#[derive(Deserialize)]
struct CompleteActiveWorkoutRequest {
    training_plan_id: String,
    gym_id: String,
    started_at: String,
    completed_at: String,
    current_exercise_position: i32,
    total_exercise_count: i32,
    exercises: Vec<ActiveWorkoutExerciseInput>,
    last_confirmed_exercise_position: i32,
}

#[derive(Deserialize)]
struct ActiveWorkoutExerciseInput {
    training_plan_exercise_id: String,
    position: i32,
    selected_plan_exercise_option_id: Option<String>,
    selected_variant_id: Option<String>,
    selected_station_id: Option<String>,
    set: Option<CreateWorkoutSetInput>,
}

#[derive(Deserialize)]
struct TrainingPlanOptionsQuery {
    #[serde(rename = "gymId")]
    gym_id: String,
}

enum ApiError {
    Internal,
    Conflict(String),
    NotFound(String),
    Validation(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            Self::Internal => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: "Internal server error".to_owned(),
                }),
            )
                .into_response(),
            Self::NotFound(message) => {
                (StatusCode::NOT_FOUND, Json(ErrorResponse { message })).into_response()
            }
            Self::Conflict(message) => {
                (StatusCode::CONFLICT, Json(ErrorResponse { message })).into_response()
            }
            Self::Validation(message) => {
                (StatusCode::BAD_REQUEST, Json(ErrorResponse { message })).into_response()
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help();
        return;
    }

    let host = env::var("BACKEND_HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
    let port = env::var("BACKEND_PORT").unwrap_or_else(|_| "8080".to_owned());
    let bind_addr = format!("{host}:{port}");

    let addr: SocketAddr = bind_addr.parse().unwrap_or_else(|err| {
        eprintln!("invalid bind address '{bind_addr}': {err}");
        std::process::exit(2);
    });

    let database_url = match env::var("DATABASE_URL") {
        Ok(value) => value,
        Err(_) => {
            eprintln!("DATABASE_URL is required");
            std::process::exit(2);
        }
    };

    let db_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .unwrap_or_else(|err| {
            eprintln!("failed to connect to postgres: {err}");
            std::process::exit(1);
        });

    let app_state = AppState {
        repository: DomainRepository::new(db_pool),
    };

    let app = app_router(app_state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|err| {
            eprintln!("failed to bind backend listener on {addr}: {err}");
            std::process::exit(1);
        });

    axum::serve(listener, app).await.unwrap_or_else(|err| {
        eprintln!("backend server error: {err}");
        std::process::exit(1);
    });
}

fn app_router(app_state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/hello-world", get(get_hello_world))
        .route("/api/gyms", get(list_gyms))
        .route("/api/training-plans", get(list_training_plans))
        .route(
            "/api/training-plans/{training_plan_id}/options",
            get(list_training_plan_options),
        )
        .route("/api/workouts", post(create_workout))
        .route(
            "/api/active-workout",
            get(get_active_workout).post(create_active_workout),
        )
        .route(
            "/api/active-workout/{workout_id}",
            put(update_active_workout),
        )
        .route(
            "/api/active-workout/{workout_id}/complete",
            post(complete_active_workout),
        )
        .route(
            "/api/workouts/{workout_id}/summary",
            get(get_workout_summary),
        )
        .with_state(app_state)
}

async fn get_hello_world(
    State(state): State<AppState>,
) -> Result<Json<HelloWorldResponse>, ApiError> {
    let first_plan_name = state
        .repository
        .fetch_first_training_plan_name()
        .await
        .map_err(|_| ApiError::Internal)?;

    match first_plan_name {
        Some(name) => Ok(Json(HelloWorldResponse {
            value: format!("Hello from {name}"),
        })),
        None => Err(ApiError::Internal),
    }
}

async fn list_training_plans(
    State(state): State<AppState>,
) -> Result<Json<Vec<TrainingPlanSummaryResponse>>, ApiError> {
    let plans = state
        .repository
        .fetch_training_plan_summaries()
        .await
        .map_err(|_| ApiError::Internal)?;

    let response = plans
        .into_iter()
        .map(|plan| TrainingPlanSummaryResponse {
            id: plan.id,
            name: plan.name,
            exercise_count: plan.exercise_count,
        })
        .collect();

    Ok(Json(response))
}

async fn list_gyms(
    State(state): State<AppState>,
) -> Result<Json<Vec<GymSummaryResponse>>, ApiError> {
    let gyms = state
        .repository
        .fetch_gym_summaries()
        .await
        .map_err(|_| ApiError::Internal)?;

    let response = gyms
        .into_iter()
        .map(|gym| GymSummaryResponse {
            id: gym.id,
            name: gym.name,
        })
        .collect();

    Ok(Json(response))
}

async fn list_training_plan_options(
    State(state): State<AppState>,
    Path(training_plan_id): Path<String>,
    Query(query): Query<TrainingPlanOptionsQuery>,
) -> Result<Json<TrainingPlanOptionsResponse>, ApiError> {
    let options = state
        .repository
        .fetch_plan_exercise_option_summaries(&training_plan_id, &query.gym_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    let option_responses = options
        .into_iter()
        .map(|option| PlanExerciseOptionSummaryResponse {
            id: option.id,
            training_plan_exercise_id: option.training_plan_exercise_id,
            exercise_name: option.exercise_name,
            exercise_position: option.exercise_position,
            variant_id: option.variant_id,
            variant_name: option.variant_name,
            variant_type: option.variant_type,
            station_id: option.station_id,
            station_name: option.station_name,
        })
        .collect();

    Ok(Json(TrainingPlanOptionsResponse {
        training_plan_id,
        gym_id: query.gym_id,
        options: option_responses,
    }))
}

async fn get_workout_summary(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    let maybe_summary = state
        .repository
        .fetch_workout_summary(&workout_id)
        .await
        .map_err(|_| ApiError::Internal)?;

    let summary =
        maybe_summary.ok_or_else(|| ApiError::NotFound("Workout not found".to_owned()))?;

    Ok(Json(WorkoutSummaryResponse {
        id: summary.id,
        training_plan_id: summary.training_plan_id,
        training_plan_name: summary.training_plan_name,
        gym_id: summary.gym_id,
        gym_name: summary.gym_name,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
        exercise_count: summary.exercise_count,
        completed_set_count: summary.completed_set_count,
    }))
}

async fn create_workout(
    State(state): State<AppState>,
    Json(payload): Json<CreateWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_exercises_match_training_plan(&state.repository, &new_workout).await?;

    let created = state
        .repository
        .create_workout(&new_workout)
        .await
        .map_err(map_persistence_error)?;

    let summary = state
        .repository
        .fetch_workout_summary(&created.id)
        .await
        .map_err(map_persistence_error)?
        .ok_or(ApiError::Internal)?;

    Ok((StatusCode::CREATED, Json(workout_summary_response(summary))))
}

async fn get_active_workout(
    State(state): State<AppState>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let workout = state
        .repository
        .fetch_first_active_workout()
        .await
        .map_err(map_persistence_error)?
        .ok_or_else(|| ApiError::NotFound("No active workout found".to_owned()))?;

    Ok(Json(active_workout_response(workout)))
}

async fn create_active_workout(
    State(state): State<AppState>,
    Json(payload): Json<CreateActiveWorkoutRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await?;

    let created = state
        .repository
        .create_active_workout(&new_workout)
        .await
        .map_err(map_persistence_error)?;

    Ok((StatusCode::CREATED, Json(active_workout_response(created))))
}

async fn update_active_workout(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
    Json(payload): Json<UpdateActiveWorkoutRequest>,
) -> Result<Json<ActiveWorkoutResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await?;

    let updated = state
        .repository
        .update_active_workout(&workout_id, &new_workout)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(active_workout_response(updated)))
}

async fn complete_active_workout(
    State(state): State<AppState>,
    Path(workout_id): Path<String>,
    Json(payload): Json<CompleteActiveWorkoutRequest>,
) -> Result<Json<WorkoutSummaryResponse>, ApiError> {
    let new_workout = payload.validate_and_into_domain()?;
    validate_active_workout(
        &state.repository,
        &new_workout,
        payload.total_exercise_count,
    )
    .await?;

    let summary = state
        .repository
        .complete_active_workout(&workout_id, &new_workout)
        .await
        .map_err(map_persistence_error)?;

    Ok(Json(workout_summary_response(summary)))
}

impl CreateWorkoutRequest {
    fn validate_and_into_domain(self) -> Result<NewWorkout, ApiError> {
        if self.training_plan_id.trim().is_empty() {
            return Err(ApiError::Validation(
                "training_plan_id is required".to_owned(),
            ));
        }

        if self.gym_id.trim().is_empty() {
            return Err(ApiError::Validation("gym_id is required".to_owned()));
        }

        if self.exercises.is_empty() {
            return Err(ApiError::Validation(
                "Workout must include at least one exercise".to_owned(),
            ));
        }

        let mut seen_positions = HashSet::new();
        let mut exercises = Vec::with_capacity(self.exercises.len());

        for exercise in self.exercises {
            if exercise.training_plan_exercise_id.trim().is_empty() {
                return Err(ApiError::Validation(
                    "training_plan_exercise_id is required".to_owned(),
                ));
            }

            if exercise.position < 1 {
                return Err(ApiError::Validation(
                    "Exercise position must be at least 1".to_owned(),
                ));
            }

            if !seen_positions.insert(exercise.position) {
                return Err(ApiError::Validation(
                    "Exercise positions must be unique".to_owned(),
                ));
            }

            if !exercise.set.load_value.is_finite() || exercise.set.load_value < 0.0 {
                return Err(ApiError::Validation(
                    "set.load_value must be a non-negative finite number".to_owned(),
                ));
            }

            if let Some(reps) = exercise.set.reps {
                if reps < 1 {
                    return Err(ApiError::Validation(
                        "set.reps must be greater than 0 when provided".to_owned(),
                    ));
                }
            }

            exercises.push(NewWorkoutExercise {
                training_plan_exercise_id: exercise.training_plan_exercise_id,
                position: exercise.position,
                selected_variant_id: empty_string_to_none(exercise.selected_variant_id),
                selected_station_id: empty_string_to_none(exercise.selected_station_id),
                selected_plan_exercise_option_id: empty_string_to_none(
                    exercise.selected_plan_exercise_option_id,
                ),
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: exercise.set.reps,
                    load_display_value: exercise.set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: exercise.set.load_value,
                    completed_at: self.completed_at.clone(),
                }],
            });
        }

        Ok(NewWorkout {
            training_plan_id: self.training_plan_id,
            gym_id: self.gym_id,
            started_at: self.started_at,
            completed_at: self.completed_at,
            exercises,
        })
    }
}

impl CreateActiveWorkoutRequest {
    fn validate_and_into_domain(&self) -> Result<NewWorkout, ApiError> {
        validate_confirmed_position(
            self.first_confirmed_exercise_position,
            "first_confirmed_exercise_position",
        )?;
        self.validate_common(None)
    }
}

impl UpdateActiveWorkoutRequest {
    fn validate_and_into_domain(&self) -> Result<NewWorkout, ApiError> {
        validate_confirmed_position(
            self.last_confirmed_exercise_position,
            "last_confirmed_exercise_position",
        )?;
        self.validate_common(None)
    }
}

impl CompleteActiveWorkoutRequest {
    fn validate_and_into_domain(&self) -> Result<NewWorkout, ApiError> {
        validate_confirmed_position(
            self.last_confirmed_exercise_position,
            "last_confirmed_exercise_position",
        )?;
        self.validate_common(Some(self.completed_at.clone()))
    }
}

trait ActiveWorkoutPayloadValidation {
    fn training_plan_id(&self) -> &str;
    fn gym_id(&self) -> &str;
    fn started_at(&self) -> &str;
    fn current_exercise_position(&self) -> i32;
    fn total_exercise_count(&self) -> i32;
    fn exercises(&self) -> &[ActiveWorkoutExerciseInput];

    fn validate_common(&self, completed_at: Option<String>) -> Result<NewWorkout, ApiError> {
        if self.training_plan_id().trim().is_empty() {
            return Err(ApiError::Validation(
                "training_plan_id is required".to_owned(),
            ));
        }

        if self.gym_id().trim().is_empty() {
            return Err(ApiError::Validation("gym_id is required".to_owned()));
        }

        if self.started_at().trim().is_empty() {
            return Err(ApiError::Validation("started_at is required".to_owned()));
        }

        if self.current_exercise_position() < 1 {
            return Err(ApiError::Validation(
                "current_exercise_position must be at least 1".to_owned(),
            ));
        }

        if self.total_exercise_count() < 1 {
            return Err(ApiError::Validation(
                "total_exercise_count must be at least 1".to_owned(),
            ));
        }

        if self.current_exercise_position() > self.total_exercise_count() {
            return Err(ApiError::Validation(
                "current_exercise_position must not exceed total_exercise_count".to_owned(),
            ));
        }

        if self.exercises().is_empty() {
            return Err(ApiError::Validation(
                "Active workout must include at least one confirmed exercise".to_owned(),
            ));
        }

        let mut seen_positions = HashSet::new();
        let mut exercises = Vec::with_capacity(self.exercises().len());

        for exercise in self.exercises() {
            if exercise.training_plan_exercise_id.trim().is_empty() {
                return Err(ApiError::Validation(
                    "training_plan_exercise_id is required".to_owned(),
                ));
            }

            if exercise.position < 1 {
                return Err(ApiError::Validation(
                    "Exercise position must be at least 1".to_owned(),
                ));
            }

            if !seen_positions.insert(exercise.position) {
                return Err(ApiError::Validation(
                    "Exercise positions must be unique".to_owned(),
                ));
            }

            let set = exercise.set.as_ref().ok_or_else(|| {
                ApiError::Validation("Active workout exercise set is required".to_owned())
            })?;

            validate_set_input(set)?;

            exercises.push(NewWorkoutExercise {
                training_plan_exercise_id: exercise.training_plan_exercise_id.clone(),
                position: exercise.position,
                selected_variant_id: empty_string_to_none(exercise.selected_variant_id.clone()),
                selected_station_id: empty_string_to_none(exercise.selected_station_id.clone()),
                selected_plan_exercise_option_id: empty_string_to_none(
                    exercise.selected_plan_exercise_option_id.clone(),
                ),
                sets: vec![NewWorkoutSet {
                    set_index: 1,
                    reps: set.reps,
                    load_display_value: set.load_value,
                    load_display_unit: "kg".to_owned(),
                    load_canonical_kg: set.load_value,
                    completed_at: completed_at.clone(),
                }],
            });
        }

        if exercises.len() as i32 > self.total_exercise_count() {
            return Err(ApiError::Validation(
                "Confirmed exercise count must not exceed total_exercise_count".to_owned(),
            ));
        }

        Ok(NewWorkout {
            training_plan_id: self.training_plan_id().to_owned(),
            gym_id: self.gym_id().to_owned(),
            started_at: Some(self.started_at().to_owned()),
            completed_at,
            exercises,
        })
    }
}

impl ActiveWorkoutPayloadValidation for CreateActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> &str {
        &self.gym_id
    }

    fn started_at(&self) -> &str {
        &self.started_at
    }

    fn current_exercise_position(&self) -> i32 {
        self.current_exercise_position
    }

    fn total_exercise_count(&self) -> i32 {
        self.total_exercise_count
    }

    fn exercises(&self) -> &[ActiveWorkoutExerciseInput] {
        &self.exercises
    }
}

impl ActiveWorkoutPayloadValidation for UpdateActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> &str {
        &self.gym_id
    }

    fn started_at(&self) -> &str {
        &self.started_at
    }

    fn current_exercise_position(&self) -> i32 {
        self.current_exercise_position
    }

    fn total_exercise_count(&self) -> i32 {
        self.total_exercise_count
    }

    fn exercises(&self) -> &[ActiveWorkoutExerciseInput] {
        &self.exercises
    }
}

impl ActiveWorkoutPayloadValidation for CompleteActiveWorkoutRequest {
    fn training_plan_id(&self) -> &str {
        &self.training_plan_id
    }

    fn gym_id(&self) -> &str {
        &self.gym_id
    }

    fn started_at(&self) -> &str {
        &self.started_at
    }

    fn current_exercise_position(&self) -> i32 {
        self.current_exercise_position
    }

    fn total_exercise_count(&self) -> i32 {
        self.total_exercise_count
    }

    fn exercises(&self) -> &[ActiveWorkoutExerciseInput] {
        &self.exercises
    }
}

fn empty_string_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|candidate| {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    })
}

fn validate_set_input(set: &CreateWorkoutSetInput) -> Result<(), ApiError> {
    if !set.load_value.is_finite() || set.load_value < 0.0 {
        return Err(ApiError::Validation(
            "set.load_value must be a non-negative finite number".to_owned(),
        ));
    }

    if let Some(reps) = set.reps {
        if reps < 1 {
            return Err(ApiError::Validation(
                "set.reps must be greater than 0 when provided".to_owned(),
            ));
        }
    }

    Ok(())
}

fn validate_confirmed_position(position: i32, field_name: &str) -> Result<(), ApiError> {
    if position < 1 {
        return Err(ApiError::Validation(format!(
            "{field_name} must be at least 1"
        )));
    }

    Ok(())
}

async fn validate_exercises_match_training_plan(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
) -> Result<(), ApiError> {
    let valid_exercise_ids = repository
        .fetch_training_plan_exercise_ids(&new_workout.training_plan_id)
        .await
        .map_err(map_persistence_error)?;

    if new_workout
        .exercises
        .iter()
        .any(|exercise| !valid_exercise_ids.contains(&exercise.training_plan_exercise_id))
    {
        return Err(ApiError::Validation(
            "Each exercise must belong to the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

async fn validate_active_workout(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    total_exercise_count: i32,
) -> Result<(), ApiError> {
    validate_exercises_match_training_plan(repository, new_workout).await?;

    let expected_count = repository
        .fetch_training_plan_exercise_count(&new_workout.training_plan_id)
        .await
        .map_err(map_persistence_error)?;

    if expected_count == 0 {
        return Err(ApiError::Validation(
            "Selected training plan has no exercises".to_owned(),
        ));
    }

    if expected_count != i64::from(total_exercise_count) {
        return Err(ApiError::Validation(
            "total_exercise_count must match the selected training plan".to_owned(),
        ));
    }

    Ok(())
}

fn map_persistence_error(error: pumpbuddy_backend::persistence::PersistenceError) -> ApiError {
    match error {
        pumpbuddy_backend::persistence::PersistenceError::Conflict(message) => {
            ApiError::Conflict(message)
        }
        pumpbuddy_backend::persistence::PersistenceError::NotFound(message) => {
            ApiError::NotFound(message)
        }
        pumpbuddy_backend::persistence::PersistenceError::Sqlx(sqlx::Error::Database(db_error)) => {
            match db_error.code().as_deref() {
                Some("22P02") | Some("22007") => ApiError::Validation(
                    "Workout payload contains an invalid identifier or timestamp".to_owned(),
                ),
                Some("23503") => ApiError::NotFound("A referenced record was not found".to_owned()),
                _ => ApiError::Internal,
            }
        }
        _ => ApiError::Internal,
    }
}

fn active_workout_response(workout: ActiveWorkout) -> ActiveWorkoutResponse {
    ActiveWorkoutResponse {
        workout: ActiveWorkoutDetailResponse {
            id: workout.id,
            training_plan_id: workout.training_plan_id,
            training_plan_name: workout.training_plan_name,
            gym_id: workout.gym_id,
            gym_name: workout.gym_name,
            started_at: workout.started_at,
            updated_at: workout.updated_at,
            current_exercise_position: workout.current_exercise_position,
            total_exercise_count: workout.total_exercise_count,
            exercises: workout
                .exercises
                .into_iter()
                .map(active_workout_exercise_response)
                .collect(),
        },
    }
}

fn active_workout_exercise_response(
    exercise: ActiveWorkoutExercise,
) -> ActiveWorkoutExerciseResponse {
    ActiveWorkoutExerciseResponse {
        training_plan_exercise_id: exercise.training_plan_exercise_id,
        position: exercise.position,
        exercise_name: exercise.exercise_name,
        selected_plan_exercise_option_id: exercise.selected_plan_exercise_option_id,
        selected_variant_id: exercise.selected_variant_id,
        selected_variant_name: exercise.selected_variant_name,
        selected_station_id: exercise.selected_station_id,
        selected_station_name: exercise.selected_station_name,
        set: exercise.set.map(active_workout_set_response),
    }
}

fn active_workout_set_response(set: ActiveWorkoutSet) -> ActiveWorkoutSetResponse {
    ActiveWorkoutSetResponse {
        load_value: set.load_value,
        reps: set.reps,
    }
}

fn workout_summary_response(
    summary: pumpbuddy_backend::domain::WorkoutSummary,
) -> WorkoutSummaryResponse {
    WorkoutSummaryResponse {
        id: summary.id,
        training_plan_id: summary.training_plan_id,
        training_plan_name: summary.training_plan_name,
        gym_id: summary.gym_id,
        gym_name: summary.gym_name,
        started_at: summary.started_at,
        completed_at: summary.completed_at,
        exercise_count: summary.exercise_count,
        completed_set_count: summary.completed_set_count,
    }
}

fn print_help() {
    println!("PumpBuddy backend");
    println!();
    println!("Environment variables:");
    println!("  BACKEND_HOST  Host interface to bind (default: 0.0.0.0)");
    println!("  BACKEND_PORT  TCP port to bind (default: 8080)");
    println!("  DATABASE_URL  PostgreSQL connection string (required)");
    println!();
    println!("Usage:");
    println!("  pumpbuddy-backend");
    println!("  pumpbuddy-backend --help");
}

#[cfg(test)]
mod tests {
    use super::{app_router, AppState};
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use serde_json::{json, Value};
    use sqlx::{postgres::PgPoolOptions, PgPool};
    use std::env;
    use tower::ServiceExt;

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
        sqlx::query_scalar::<_, Option<String>>("SELECT to_regclass('public.training_plans')::text")
            .fetch_one(pool)
            .await
            .ok()
            .flatten()
            .is_some()
    }

    #[tokio::test]
    async fn workout_api_creates_workout_and_returns_summary() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "started_at": "2026-01-20T09:00:00Z",
                            "completed_at": "2026-01-20T09:20:00Z",
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::CREATED);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(payload["training_plan_name"], "Push Day");
        assert_eq!(payload["gym_name"], "Forge Downtown");
        assert_eq!(payload["exercise_count"], 1);
        assert_eq!(payload["completed_set_count"], 1);
    }

    #[tokio::test]
    async fn workout_api_rejects_invalid_payloads_before_write() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
            "training_plan_id": "00000000-0000-0000-0000-000000000201",
            "gym_id": "00000000-0000-0000-0000-000000000101",
            "exercises": [
                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 0,
                                    "set": {
                                        "load_value": -5.0,
                                        "reps": -1
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(payload["message"], "Exercise position must be at least 1");
    }

    #[tokio::test]
    async fn workout_api_rejects_exercises_from_a_different_training_plan() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000806",
                                    "position": 1,
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(
            payload["message"],
            "Each exercise must belong to the selected training plan"
        );
    }

    #[tokio::test]
    async fn workout_api_rejects_zero_reps_before_write() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/workouts")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 0
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("request should succeed");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body should read");
        let payload: Value = serde_json::from_slice(&body).expect("response json should parse");

        assert_eq!(
            payload["message"],
            "set.reps must be greater than 0 when provided"
        );
    }

    #[tokio::test]
    async fn active_workout_api_round_trips_create_resume_update_and_complete() {
        let Some(pool) = maybe_pool().await else {
            return;
        };

        if !schema_ready(&pool).await {
            return;
        }

        let app = app_router(AppState {
            repository: pumpbuddy_backend::persistence::DomainRepository::new(pool),
        });

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/active-workout")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "started_at": "2026-02-10T09:00:00Z",
                            "current_exercise_position": 2,
                            "total_exercise_count": 5,
                            "first_confirmed_exercise_position": 1,
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001001",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000401",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000701",
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("create active workout request should succeed");

        assert_eq!(create_response.status(), StatusCode::CREATED);
        let create_body = to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("create body should read");
        let created: Value =
            serde_json::from_slice(&create_body).expect("create response json should parse");
        let workout_id = created["workout"]["id"]
            .as_str()
            .expect("workout id should be a string")
            .to_owned();
        assert_eq!(created["workout"]["current_exercise_position"], 2);

        let resume_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/active-workout")
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("resume active workout request should succeed");

        assert_eq!(resume_response.status(), StatusCode::OK);
        let resume_body = to_bytes(resume_response.into_body(), usize::MAX)
            .await
            .expect("resume body should read");
        let resumed: Value =
            serde_json::from_slice(&resume_body).expect("resume response json should parse");
        assert_eq!(resumed["workout"]["id"], workout_id);

        let update_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/active-workout/{workout_id}"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "started_at": "2026-02-10T09:00:00Z",
                            "current_exercise_position": 3,
                            "total_exercise_count": 5,
                            "last_confirmed_exercise_position": 2,
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001001",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000401",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000701",
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                },
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000802",
                                    "position": 2,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001003",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000403",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000706",
                                    "set": {
                                        "load_value": 22.5,
                                        "reps": 8
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("update active workout request should succeed");

        assert_eq!(update_response.status(), StatusCode::OK);
        let update_body = to_bytes(update_response.into_body(), usize::MAX)
            .await
            .expect("update body should read");
        let updated: Value =
            serde_json::from_slice(&update_body).expect("update response json should parse");
        assert_eq!(updated["workout"]["current_exercise_position"], 3);

        let complete_response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/active-workout/{workout_id}/complete"))
                    .header("content-type", "application/json")
                    .body(Body::from(
                        json!({
                            "training_plan_id": "00000000-0000-0000-0000-000000000201",
                            "gym_id": "00000000-0000-0000-0000-000000000101",
                            "started_at": "2026-02-10T09:00:00Z",
                            "completed_at": "2026-02-10T09:30:00Z",
                            "current_exercise_position": 5,
                            "total_exercise_count": 5,
                            "last_confirmed_exercise_position": 5,
                            "exercises": [
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000801",
                                    "position": 1,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001001",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000401",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000701",
                                    "set": {
                                        "load_value": 20.0,
                                        "reps": 10
                                    }
                                },
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000802",
                                    "position": 2,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001003",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000403",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000706",
                                    "set": {
                                        "load_value": 22.5,
                                        "reps": 8
                                    }
                                },
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000803",
                                    "position": 3,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001005",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000404",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000703",
                                    "set": {
                                        "load_value": 25.0,
                                        "reps": 12
                                    }
                                },
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000804",
                                    "position": 4,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001008",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000406",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000701",
                                    "set": {
                                        "load_value": 30.0,
                                        "reps": 8
                                    }
                                },
                                {
                                    "training_plan_exercise_id": "00000000-0000-0000-0000-000000000805",
                                    "position": 5,
                                    "selected_plan_exercise_option_id": "00000000-0000-0000-0000-000000001011",
                                    "selected_variant_id": "00000000-0000-0000-0000-000000000408",
                                    "selected_station_id": "00000000-0000-0000-0000-000000000703",
                                    "set": {
                                        "load_value": 35.0,
                                        "reps": 12
                                    }
                                }
                            ]
                        })
                        .to_string(),
                    ))
                    .expect("request should build"),
            )
            .await
            .expect("complete active workout request should succeed");

        assert_eq!(complete_response.status(), StatusCode::OK);
        let complete_body = to_bytes(complete_response.into_body(), usize::MAX)
            .await
            .expect("complete body should read");
        let completed: Value =
            serde_json::from_slice(&complete_body).expect("complete response json should parse");
        assert_eq!(completed["id"], workout_id);
        assert!(completed["completed_at"].is_string());
    }
}
