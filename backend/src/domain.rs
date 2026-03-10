#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrainingPlan {
    pub id: String,
    pub name: String,
    pub exercises: Vec<TrainingPlanExercise>,
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
    pub selected_variant_id: Option<String>,
    pub selected_station_id: Option<String>,
    pub selected_plan_exercise_option_id: Option<String>,
    pub sets: Vec<NewWorkoutSet>,
}

#[derive(Debug, Clone)]
pub struct NewWorkoutSet {
    pub set_index: i32,
    pub reps: Option<i32>,
    pub load_display_value: f64,
    pub load_display_unit: String,
    pub load_canonical_kg: f64,
    pub completed_at: Option<String>,
}
