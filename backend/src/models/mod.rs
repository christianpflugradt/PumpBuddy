// Generated OpenAPI model wiring.
// Refresh with `make generate-openapi-backend`.
#![allow(unused_imports, dead_code, clippy::all)]

pub mod active_workout {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout.rs"
    ));
}
pub use active_workout::ActiveWorkout;

pub mod active_workout_exercise {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_exercise.rs"
    ));
}
pub use active_workout_exercise::ActiveWorkoutExercise;

pub mod active_workout_exercise_input {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_exercise_input.rs"
    ));
}
pub use active_workout_exercise_input::ActiveWorkoutExerciseInput;

pub mod active_workout_progress_payload {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_progress_payload.rs"
    ));
}
pub use active_workout_progress_payload::ActiveWorkoutProgressPayload;

pub mod active_workout_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_response.rs"
    ));
}
pub use active_workout_response::ActiveWorkoutResponse;

pub mod active_workout_set {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_set.rs"
    ));
}
pub use active_workout_set::ActiveWorkoutSet;

pub mod active_workout_set_input {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_set_input.rs"
    ));
}
pub use active_workout_set_input::ActiveWorkoutSetInput;

pub mod auth_login_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_login_request.rs"
    ));
}
pub use auth_login_request::AuthLoginRequest;

pub mod auth_login_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_login_response.rs"
    ));
}
pub use auth_login_response::AuthLoginResponse;

pub mod auth_session_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_session_response.rs"
    ));
}
pub use auth_session_response::AuthSessionResponse;

pub mod auth_session_user {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_session_user.rs"
    ));
}
pub use auth_session_user::AuthSessionUser;

pub mod complete_active_workout_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/complete_active_workout_request.rs"
    ));
}
pub use complete_active_workout_request::CompleteActiveWorkoutRequest;

pub mod completed_active_workout_set {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/completed_active_workout_set.rs"
    ));
}
pub use completed_active_workout_set::CompletedActiveWorkoutSet;

pub mod create_active_workout_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/create_active_workout_request.rs"
    ));
}
pub use create_active_workout_request::CreateActiveWorkoutRequest;

pub mod create_workout_exercise_input {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/create_workout_exercise_input.rs"
    ));
}
pub use create_workout_exercise_input::CreateWorkoutExerciseInput;

pub mod create_workout_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/create_workout_request.rs"
    ));
}
pub use create_workout_request::CreateWorkoutRequest;

pub mod create_workout_set_input {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/create_workout_set_input.rs"
    ));
}
pub use create_workout_set_input::CreateWorkoutSetInput;

pub mod error_details {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/error_details.rs"
    ));
}
pub use error_details::ErrorDetails;

pub mod error_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/error_response.rs"
    ));
}
pub use error_response::ErrorResponse;

pub mod gym_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_summary.rs"
    ));
}
pub use gym_summary::GymSummary;

pub mod missing_exercise_detail {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/missing_exercise_detail.rs"
    ));
}
pub use missing_exercise_detail::MissingExerciseDetail;

pub mod plan_exercise_option_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/plan_exercise_option_summary.rs"
    ));
}
pub use plan_exercise_option_summary::PlanExerciseOptionSummary;

pub mod training_plan_options_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_options_response.rs"
    ));
}
pub use training_plan_options_response::TrainingPlanOptionsResponse;

pub mod training_plan_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_summary.rs"
    ));
}
pub use training_plan_summary::TrainingPlanSummary;

pub mod update_active_workout_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/update_active_workout_request.rs"
    ));
}
pub use update_active_workout_request::UpdateActiveWorkoutRequest;

pub mod workout_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_summary.rs"
    ));
}
pub use workout_summary::WorkoutSummary;
