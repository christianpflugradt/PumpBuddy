pub(crate) mod about;
pub(crate) mod exercises;
pub(crate) mod gyms;
pub(crate) mod load_profiles;
pub(crate) mod training_plans;
pub(crate) mod workouts;

pub(crate) use about::get_about_metadata;
pub(crate) use exercises::{
    create_exercise, create_exercise_variant, delete_exercise, delete_exercise_variant,
    get_exercise, get_exercise_variant, list_exercise_variants, list_exercises, update_exercise,
    update_exercise_variant,
};
pub(crate) use gyms::{
    create_configurator_station, create_gym, delete_configurator_station, delete_gym,
    get_configurator_exercise_variant_compatibilities, get_configurator_station,
    get_configurator_station_compatibilities, get_gym_detail, get_gym_station_detail,
    list_configurator_stations, list_gyms, reconcile_configurator_exercise_variant_compatibilities,
    reconcile_configurator_station_compatibilities, update_configurator_station, update_gym,
};
pub(crate) use load_profiles::{
    create_load_profile, delete_load_profile, get_load_profile, list_load_profiles,
    update_load_profile,
};
pub(crate) use training_plans::{
    create_training_plan, get_training_plan, list_training_plan_exercise_variants,
    list_training_plans, save_training_plan,
};
pub(crate) use workouts::{
    cancel_active_workout, complete_active_workout, confirm_active_workout_set,
    create_active_workout, create_workout, delete_latest_active_workout_set, get_active_workout,
    get_workout_detail, get_workout_exercises_performance, get_workout_progress,
    get_workout_summary, list_workouts, reopen_active_workout_exercise,
    select_active_workout_exercise_option, skip_active_workout_exercise, update_active_workout,
};
