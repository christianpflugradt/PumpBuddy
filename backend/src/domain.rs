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
    pub last_completed_at: Option<String>,
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
    pub load_input_mode: String,
    pub set_tracking_mode: String,
    pub repetition_kind: String,
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
    pub rep_min: Option<i32>,
    pub rep_max: Option<i32>,
    pub target_sets: Option<i32>,
    pub gym: Gym,
    pub variant: ExerciseVariant,
    pub station: Option<EquipmentStation>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlanExerciseOptionSummary {
    pub id: String,
    pub training_plan_exercise_id: String,
    pub exercise_name: String,
    pub exercise_position: i32,
    pub rep_min: Option<i32>,
    pub rep_max: Option<i32>,
    pub target_sets: Option<i32>,
    pub variant_id: String,
    pub variant_name: String,
    pub variant_type: String,
    pub repetition_kind: String,
    pub load_input_mode: String,
    pub set_tracking_mode: String,
    pub station_id: Option<String>,
    pub station_name: Option<String>,
    pub station_profile_loads_kg: Vec<f64>,
    pub suggested_start_load_kg: Option<f64>,
    pub last_completed_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Workout {
    pub id: String,
    pub training_plan_id: String,
    pub gym_id: Option<String>,
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
    pub selected_training_plan_exercise_variant_id: Option<String>,
    pub performance_score: Option<i32>,
    pub skipped_at: Option<String>,
    pub completed_at: Option<String>,
    pub sets: Vec<WorkoutSet>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WorkoutSet {
    pub id: String,
    pub set_index: i32,
    pub set_side: String,
    pub reps: Option<i32>,
    pub load_display_value: Option<f64>,
    pub load_display_unit: String,
    pub load_canonical_kg: Option<f64>,
    pub completed_at: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct WorkoutSummary {
    pub id: String,
    pub training_plan_id: String,
    pub training_plan_name: String,
    pub gym_id: Option<String>,
    pub gym_name: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exercise_count: i64,
    pub completed_set_count: i64,
    pub average_duration_minutes: Option<i64>,
    pub workout_progress: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActiveWorkout {
    pub id: String,
    pub training_plan_id: String,
    pub training_plan_name: String,
    pub gym_id: Option<String>,
    pub gym_name: Option<String>,
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
    pub selected_training_plan_exercise_variant_id: Option<String>,
    pub selected_variant_id: Option<String>,
    pub selected_variant_name: Option<String>,
    pub repetition_kind: Option<String>,
    pub load_input_mode: Option<String>,
    pub set_tracking_mode: Option<String>,
    pub selected_station_id: Option<String>,
    pub selected_station_name: Option<String>,
    pub skipped_at: Option<String>,
    pub completed_at: Option<String>,
    pub completed_sets: Vec<CompletedActiveWorkoutSet>,
    pub suggested_set: ActiveWorkoutSet,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompletedActiveWorkoutSet {
    pub set_index: i32,
    pub set_side: String,
    pub load_value: Option<f64>,
    pub reps: Option<i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ActiveWorkoutSet {
    pub set_index: i32,
    pub set_side: String,
    pub load_value: f64,
    pub reps: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct NewWorkout {
    pub training_plan_id: String,
    pub gym_id: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub current_exercise_position: Option<i32>,
    pub exercises: Vec<NewWorkoutExercise>,
}

impl NewWorkout {
    pub fn validate_mode_invariants(&self) -> Result<(), String> {
        let configured_gym_mode = self
            .gym_id
            .as_ref()
            .is_some_and(|gym_id| !gym_id.trim().is_empty());

        for exercise in &self.exercises {
            let has_option = has_value(&exercise.selected_training_plan_exercise_variant_id);
            let has_variant = has_value(&exercise.selected_variant_id);
            let has_station = has_value(&exercise.selected_station_id);

            if configured_gym_mode {
                if !has_option {
                    return Err(
                        "configured-gym workouts require selected_training_plan_exercise_variant_id for every exercise"
                            .to_owned(),
                    );
                }

                if !has_variant {
                    return Err(
                        "configured-gym workouts require selected_variant_id for every exercise"
                            .to_owned(),
                    );
                }
            } else if has_option || has_variant || has_station {
                return Err(
                    "free-mode workouts must not include selected option, variant, or station references"
                        .to_owned(),
                );
            }
        }

        Ok(())
    }
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
    pub selected_training_plan_exercise_variant_id: Option<String>,
    pub set_tracking_mode: Option<String>,
    pub skipped_at: Option<String>,
    pub completed_at: Option<String>,
    pub sets: Vec<NewWorkoutSet>,
}

#[derive(Debug, Clone)]
pub struct NewWorkoutSet {
    pub set_index: i32,
    pub set_side: String,
    // Reps stay optional for now because the current vertical slice can still rely on temporary
    // fixed reps or omit them entirely until the renderer captures real reps entry.
    pub reps: Option<i32>,
    pub load_display_value: Option<f64>,
    pub load_display_unit: String,
    pub load_canonical_kg: Option<f64>,
    pub completed_at: Option<String>,
}

pub const REPETITION_KIND_REPS: &str = "REPS";
pub const REPETITION_KIND_SECS: &str = "SECS";

pub fn normalize_repetition_kind(kind: Option<&str>) -> &'static str {
    match kind {
        Some(REPETITION_KIND_SECS) => REPETITION_KIND_SECS,
        _ => REPETITION_KIND_REPS,
    }
}

fn has_value(value: &Option<String>) -> bool {
    value
        .as_ref()
        .is_some_and(|candidate| !candidate.trim().is_empty())
}
