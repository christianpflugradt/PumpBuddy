pub(crate) mod about;
pub(crate) mod gyms;
pub(crate) mod load_profiles;
pub(crate) mod training_plans;
pub(crate) mod workouts;

pub(crate) use about::get_about_metadata;
pub(crate) use gyms::{get_gym_detail, get_gym_station_detail, list_gyms};
pub(crate) use load_profiles::{
    create_load_profile, delete_load_profile, get_load_profile, list_load_profiles,
    update_load_profile,
};
pub(crate) use training_plans::{
    get_training_plan, list_training_plan_exercise_variants, list_training_plans,
};
pub(crate) use workouts::{
    cancel_active_workout, complete_active_workout, confirm_active_workout_set,
    create_active_workout, create_workout, delete_latest_active_workout_set, get_active_workout,
    get_workout_detail, get_workout_exercises_performance, get_workout_progress,
    get_workout_summary, list_workouts, reopen_active_workout_exercise,
    select_active_workout_exercise_option, skip_active_workout_exercise, update_active_workout,
};
