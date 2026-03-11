#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingPlan {
    pub id: String,
    pub name: String,
    pub exercises: Vec<TrainingPlanExercise>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingPlanSummary {
    pub id: String,
    pub name: String,
    pub exercise_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GymSummary {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingPlanExercise {
    pub id: String,
    pub position: i32,
    pub target_sets: Option<i32>,
    pub target_reps_min: Option<i32>,
    pub target_reps_max: Option<i32>,
    pub exercise: Exercise,
    pub options: Vec<PlanExerciseOption>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Exercise {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExerciseVariant {
    pub id: String,
    pub exercise_id: String,
    pub name: String,
    pub variant_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Gym {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EquipmentStation {
    pub id: String,
    pub gym_id: String,
    pub name: String,
    pub load_profile_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanExerciseOption {
    pub id: String,
    pub training_plan_exercise_id: String,
    pub gym: Gym,
    pub variant: ExerciseVariant,
    pub station: EquipmentStation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlanExerciseOptionSummary {
    pub id: String,
    pub training_plan_exercise_id: String,
    pub exercise_name: String,
    pub exercise_position: i32,
    pub variant_id: String,
    pub variant_name: String,
    pub variant_type: String,
    pub station_id: String,
    pub station_name: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Workout {
    pub id: String,
    pub training_plan_id: String,
    pub gym_id: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exercises: Vec<WorkoutExercise>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WorkoutExercise {
    pub id: String,
    pub training_plan_exercise_id: String,
    pub position: i32,
    pub selected_variant_id: Option<String>,
    pub selected_station_id: Option<String>,
    pub selected_plan_exercise_option_id: Option<String>,
    pub sets: Vec<WorkoutSet>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WorkoutSet {
    pub id: String,
    pub set_index: i32,
    pub reps: Option<i32>,
    pub load_display_value: f64,
    pub load_display_unit: String,
    pub load_canonical_kg: f64,
    pub completed_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkoutSummary {
    pub id: String,
    pub training_plan_id: String,
    pub training_plan_name: String,
    pub gym_id: String,
    pub gym_name: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exercise_count: i64,
    pub completed_set_count: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActiveWorkout {
    pub id: String,
    pub training_plan_id: String,
    pub training_plan_name: String,
    pub gym_id: String,
    pub gym_name: String,
    pub started_at: String,
    pub updated_at: String,
    pub current_exercise_position: i32,
    pub total_exercise_count: i32,
    pub exercises: Vec<ActiveWorkoutExercise>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActiveWorkoutExercise {
    pub training_plan_exercise_id: String,
    pub position: i32,
    pub exercise_name: String,
    pub selected_plan_exercise_option_id: Option<String>,
    pub selected_variant_id: Option<String>,
    pub selected_variant_name: Option<String>,
    pub selected_station_id: Option<String>,
    pub selected_station_name: Option<String>,
    pub set: Option<ActiveWorkoutSet>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActiveWorkoutSet {
    pub load_value: f64,
    pub reps: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct NewWorkout {
    pub training_plan_id: String,
    pub gym_id: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exercises: Vec<NewWorkoutExercise>,
}

#[derive(Debug, Clone)]
pub struct NewWorkoutExercise {
    pub training_plan_exercise_id: String,
    pub position: i32,
    // These selections are still optional because the current renderer flow does not always
    // collect the final variant/station/option choice. Persist `NULL` until later plans replace
    // this placeholder path with real user-driven selections.
    pub selected_variant_id: Option<String>,
    pub selected_station_id: Option<String>,
    pub selected_plan_exercise_option_id: Option<String>,
    pub sets: Vec<NewWorkoutSet>,
}

#[derive(Debug, Clone)]
pub struct NewWorkoutSet {
    pub set_index: i32,
    // Reps stay optional for now because the current vertical slice can still rely on temporary
    // fixed reps or omit them entirely until the renderer captures real reps entry.
    pub reps: Option<i32>,
    pub load_display_value: f64,
    pub load_display_unit: String,
    pub load_canonical_kg: f64,
    pub completed_at: Option<String>,
}
