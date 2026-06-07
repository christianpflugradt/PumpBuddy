// Generated OpenAPI model wiring.
// Refresh with `make refresh-backend-api-client`.
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

pub mod active_workout_next_set_hint {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_next_set_hint.rs"
    ));
}
pub use active_workout_next_set_hint::ActiveWorkoutNextSetHint;

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

pub mod active_workout_set_draft_input {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_set_draft_input.rs"
    ));
}
pub use active_workout_set_draft_input::ActiveWorkoutSetDraftInput;

pub mod active_workout_set_input {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/active_workout_set_input.rs"
    ));
}
pub use active_workout_set_input::ActiveWorkoutSetInput;

pub mod auth_increment_side_menu_middle_click_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_increment_side_menu_middle_click_request.rs"
    ));
}
pub use auth_increment_side_menu_middle_click_request::AuthIncrementSideMenuMiddleClickRequest;

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

pub mod auth_update_display_name_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_update_display_name_request.rs"
    ));
}
pub use auth_update_display_name_request::AuthUpdateDisplayNameRequest;

pub mod auth_update_password_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/auth_update_password_request.rs"
    ));
}
pub use auth_update_password_request::AuthUpdatePasswordRequest;

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

pub mod confirm_active_workout_set_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/confirm_active_workout_set_request.rs"
    ));
}
pub use confirm_active_workout_set_request::ConfirmActiveWorkoutSetRequest;

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

pub mod reopen_active_workout_exercise_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/reopen_active_workout_exercise_request.rs"
    ));
}
pub use reopen_active_workout_exercise_request::ReopenActiveWorkoutExerciseRequest;

pub mod select_active_workout_exercise_option_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/select_active_workout_exercise_option_request.rs"
    ));
}
pub use select_active_workout_exercise_option_request::SelectActiveWorkoutExerciseOptionRequest;

pub mod skip_active_workout_exercise_request {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/skip_active_workout_exercise_request.rs"
    ));
}
pub use skip_active_workout_exercise_request::SkipActiveWorkoutExerciseRequest;

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

pub mod gym_detail_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_detail_response.rs"
    ));
}
pub use gym_detail_response::GymDetailResponse;

pub mod gym_exercise_group {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_exercise_group.rs"
    ));
}
pub use gym_exercise_group::GymExerciseGroup;

pub mod gym_exercise_variant_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_exercise_variant_summary.rs"
    ));
}
pub use gym_exercise_variant_summary::GymExerciseVariantSummary;

pub mod gym_load_profile_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_load_profile_summary.rs"
    ));
}
pub use gym_load_profile_summary::GymLoadProfileSummary;

pub mod gym_station_detail_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_station_detail_response.rs"
    ));
}
pub use gym_station_detail_response::GymStationDetailResponse;

pub mod gym_station_exercise_group {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_station_exercise_group.rs"
    ));
}
pub use gym_station_exercise_group::GymStationExerciseGroup;

pub mod gym_station_exercise_variant_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_station_exercise_variant_summary.rs"
    ));
}
pub use gym_station_exercise_variant_summary::GymStationExerciseVariantSummary;

pub mod gym_station_option {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_station_option.rs"
    ));
}
pub use gym_station_option::GymStationOption;

pub mod gym_station_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/gym_station_summary.rs"
    ));
}
pub use gym_station_summary::GymStationSummary;

pub mod missing_exercise_detail {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/missing_exercise_detail.rs"
    ));
}
pub use missing_exercise_detail::MissingExerciseDetail;

pub mod side_menu_middle_click_counts {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/side_menu_middle_click_counts.rs"
    ));
}
pub use side_menu_middle_click_counts::SideMenuMiddleClickCounts;

pub mod training_plan_detail_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_detail_response.rs"
    ));
}
pub use training_plan_detail_response::TrainingPlanDetailResponse;

pub mod training_plan_exercise_detail {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_exercise_detail.rs"
    ));
}
pub use training_plan_exercise_detail::TrainingPlanExerciseDetail;

pub mod training_plan_exercise_variant_detail {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_exercise_variant_detail.rs"
    ));
}
pub use training_plan_exercise_variant_detail::TrainingPlanExerciseVariantDetail;

pub mod training_plan_exercise_variant_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_exercise_variant_summary.rs"
    ));
}
pub use training_plan_exercise_variant_summary::TrainingPlanExerciseVariantSummary;

pub mod training_plan_exercise_variants_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/training_plan_exercise_variants_response.rs"
    ));
}
pub use training_plan_exercise_variants_response::TrainingPlanExerciseVariantsResponse;

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

pub mod workout_detail_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_detail_response.rs"
    ));
}
pub use workout_detail_response::WorkoutDetailResponse;

pub mod workout_detail_hero {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_detail_hero.rs"
    ));
}
pub use workout_detail_hero::WorkoutDetailHero;

pub mod workout_detail_completion_stats {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_detail_completion_stats.rs"
    ));
}
pub use workout_detail_completion_stats::WorkoutDetailCompletionStats;

pub mod workout_detail_exercise {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_detail_exercise.rs"
    ));
}
pub use workout_detail_exercise::WorkoutDetailExercise;

pub mod workout_detail_set_line {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_detail_set_line.rs"
    ));
}
pub use workout_detail_set_line::WorkoutDetailSetLine;

pub mod workout_exercises_performance_group {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_performance_group.rs"
    ));
}
pub use workout_exercises_performance_group::WorkoutExercisesPerformanceGroup;

pub mod workout_exercises_performance_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_performance_response.rs"
    ));
}
pub use workout_exercises_performance_response::WorkoutExercisesPerformanceResponse;

pub mod workout_exercises_performance_row {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_performance_row.rs"
    ));
}
pub use workout_exercises_performance_row::WorkoutExercisesPerformanceRow;

pub mod workout_exercises_personal_record_entry {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_personal_record_entry.rs"
    ));
}
pub use workout_exercises_personal_record_entry::WorkoutExercisesPersonalRecordEntry;

pub mod workout_exercises_personal_records12m {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_personal_records12m.rs"
    ));
}
pub use workout_exercises_personal_records12m::WorkoutExercisesPersonalRecords12m;

pub mod workout_exercises_score_trend_point {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_score_trend_point.rs"
    ));
}
pub use workout_exercises_score_trend_point::WorkoutExercisesScoreTrendPoint;

pub mod workout_exercises_score_trend30d {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_score_trend30d.rs"
    ));
}
pub use workout_exercises_score_trend30d::WorkoutExercisesScoreTrend30d;

pub mod workout_exercises_strength_metric_mode {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_strength_metric_mode.rs"
    ));
}
pub use workout_exercises_strength_metric_mode::WorkoutExercisesStrengthMetricMode;

pub mod workout_exercises_strength_point {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_strength_point.rs"
    ));
}
pub use workout_exercises_strength_point::WorkoutExercisesStrengthPoint;

pub mod workout_exercises_strength_progression12m {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_exercises_strength_progression12m.rs"
    ));
}
pub use workout_exercises_strength_progression12m::WorkoutExercisesStrengthProgression12m;

pub mod workout_history_summary {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_history_summary.rs"
    ));
}
pub use workout_history_summary::WorkoutHistorySummary;

pub mod workout_progress_entry {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_progress_entry.rs"
    ));
}
pub use workout_progress_entry::WorkoutProgressEntry;

pub mod workout_progress_response {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/target/generated/openapi/rust/src/models/workout_progress_response.rs"
    ));
}
pub use workout_progress_response::WorkoutProgressResponse;
