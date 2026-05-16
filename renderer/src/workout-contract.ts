import type {
  LoadInputMode,
  RepetitionKind,
  SetSide,
  SetTrackingMode,
} from "./workout-types";

export type TrainingPlanSummary = {
  id: string;
  name: string;
  exercise_count: number;
  last_completed_at?: string | null;
  start_selection_rank?: number;
};

export type GymSummary = {
  id: string;
  name: string;
};

export type PlanExerciseOptionSummary = {
  id: string;
  training_plan_exercise_id: string;
  exercise_name: string;
  exercise_position: number;
  rep_min?: number | null;
  rep_max?: number | null;
  // Nullable in API payloads; optional here for compatibility with older cached state.
  target_sets?: number | null;
  variant_id: string;
  variant_name: string;
  repetition_kind?: RepetitionKind | string;
  station_id: string | null;
  station_name: string | null;
  station_profile_loads_kg?: number[];
  suggested_start_load_kg?: number | null;
  last_completed_at?: string | null;
  fallback_selection_rank?: number;
  load_input_mode?: LoadInputMode | null;
  set_tracking_mode?: SetTrackingMode | null;
};

export type TrainingPlanExerciseVariantSummary = PlanExerciseOptionSummary;

export type AboutMetadata = {
  app_version: string;
  commit_hash_short: string;
  build_timestamp_utc: string;
  channel: "stable";
};

export type WorkoutProgressStatus = "AVAILABLE" | "NOT_ENOUGH_DATA";
export type WorkoutProgressTone = "GREEN" | "YELLOW" | "RED" | "GRAY";

export type WorkoutSummary = {
  id: string;
  training_plan_id: string;
  training_plan_name: string;
  gym_id: string | null;
  gym_name: string | null;
  started_at: string;
  completed_at: string;
  exercise_count: number;
  completed_set_count: number;
  average_duration_minutes?: number | null;
  workout_progress?: number | null;
  workout_progress_status: WorkoutProgressStatus;
};

export type WorkoutHistorySummary = {
  id: string;
  training_plan_name: string;
  started_at: string | null;
  completed_at: string | null;
  gym_name: string | null;
  duration_minutes: number;
};

export type WorkoutHistoryListResponse = WorkoutHistorySummary[];

export type WorkoutProgressEntry = {
  id: string;
  training_plan_name: string;
  completed_at: string;
  workout_progress: number | null;
  workout_progress_status: WorkoutProgressStatus;
  progress_tone: WorkoutProgressTone;
};

export type WorkoutProgressResponse = {
  workouts: WorkoutProgressEntry[];
};

export type WorkoutExercisesPerformanceTone = "GREEN" | "YELLOW" | "RED" | "GRAY";

export type WorkoutExercisesPerformanceStatus = "AVAILABLE" | "NOT_ENOUGH_DATA";

export type WorkoutExercisesScoreTrendPoint = {
  occurred_at: string;
  score: number;
};

export type WorkoutExercisesScoreTrend30d = {
  entries: WorkoutExercisesScoreTrendPoint[];
};

export type WorkoutExercisesStrengthPoint = {
  occurred_at: string;
  value: number;
  station_id?: string | null;
  station_label?: string | null;
  is_primary_station?: boolean | null;
};

export type WorkoutExercisesStrengthMetricMode = {
  id: string;
  label: string;
  family: "kg" | "reps" | "time";
  station_modes: Array<"primary" | "all">;
  points: WorkoutExercisesStrengthPoint[];
};

export type WorkoutExercisesStrengthProgression12m = {
  metric_modes: WorkoutExercisesStrengthMetricMode[];
};

export type WorkoutExercisesPersonalRecordMetricFamily =
  | "load_x_reps"
  | "load_x_seconds"
  | "reps_only"
  | "seconds_only";

export type WorkoutExercisesPersonalRecordEntry = {
  occurred_at: string;
  load_kg?: number | null;
  reps?: number | null;
  seconds?: number | null;
};

export type WorkoutExercisesPersonalRecords12m = {
  metric_family: WorkoutExercisesPersonalRecordMetricFamily;
  entries: WorkoutExercisesPersonalRecordEntry[];
};

export type WorkoutExercisesPerformanceRow = {
  variant_id: string;
  exercise_name: string;
  variant_name: string;
  last_performed_at: string;
  last_performed_days_ago: number;
  last_performed_first_set_display: string;
  selected_station_average_score_30d: number | null;
  variant_session_count_30d: number;
  performance_status: WorkoutExercisesPerformanceStatus;
  performance_tone: WorkoutExercisesPerformanceTone;
  score_trend_30d?: WorkoutExercisesScoreTrend30d | null;
  strength_progression_12m?: WorkoutExercisesStrengthProgression12m | null;
  personal_records_12m?: WorkoutExercisesPersonalRecords12m | null;
};

export type WorkoutExercisesPerformanceGroup = {
  tone: WorkoutExercisesPerformanceTone;
  rows: WorkoutExercisesPerformanceRow[];
};

export type WorkoutExercisesPerformanceResponse = {
  groups: WorkoutExercisesPerformanceGroup[];
};

export type WorkoutDetailSetLine = {
  set_index: number;
  set_side: "LEFT" | "RIGHT" | "BILATERAL";
  load_value: number | null;
  repetition_kind: RepetitionKind | null;
  repetition_value: number | null;
};

export type WorkoutDetailExercise = {
  training_plan_exercise_id: string;
  variant_id?: string | null;
  exercise_position: number;
  exercise_name: string;
  variant_name: string | null;
  station_name: string | null;
  set_tracking_mode: SetTrackingMode | null;
  repetition_kind: RepetitionKind | null;
  sets: WorkoutDetailSetLine[];
};

export type WorkoutDetailResponse = {
  id: string;
  hero: {
    training_plan_name: string;
    started_at: string | null;
    completed_at: string | null;
    duration_minutes: number | null;
    gym_name: string | null;
  };
  completion_stats: {
    exercise_count: number;
    completed_set_count: number;
    average_duration_minutes: number | null;
    workout_progress: number | null;
    workout_progress_status: WorkoutProgressStatus;
  };
  exercises: WorkoutDetailExercise[];
};

export type ActiveWorkoutSet = {
  set_index?: number;
  set_side?: SetSide;
  load_value?: number | null;
  suggested_load_input_kg?: number | null;
  suggested_load_total_kg?: number | null;
  repetition_kind?: RepetitionKind | null;
  repetition_value?: number | null;
};

export type CompletedActiveWorkoutSet = {
  set_index: number;
  set_side?: SetSide;
  load_value: number | null;
  load_value_per_side?: number | null;
  repetition_kind?: RepetitionKind | null;
  repetition_value?: number | null;
};

export type ActiveWorkoutExercise = {
  training_plan_exercise_id: string;
  position: number;
  exercise_name: string;
  selected_training_plan_exercise_variant_id: string | null;
  selected_variant_id: string | null;
  selected_variant_name: string | null;
  load_input_mode?: LoadInputMode | null;
  set_tracking_mode?: SetTrackingMode | null;
  selected_station_id: string | null;
  selected_station_name: string | null;
  skipped_at?: string | null;
  completed_at?: string | null;
  completed_sets: CompletedActiveWorkoutSet[];
  suggested_set: ActiveWorkoutSet | null;
  next_set?: {
    set_index: number;
    set_side: SetSide;
  } | null;
};

export type ActiveWorkout = {
  id: string;
  training_plan_id: string;
  training_plan_name: string;
  gym_id: string | null;
  gym_name: string | null;
  started_at: string;
  updated_at: string;
  current_exercise_position: number;
  total_exercise_count: number;
  exercises: ActiveWorkoutExercise[];
};

export type ActiveWorkoutResponse = {
  workout: ActiveWorkout;
};

export type CreateWorkoutExerciseInput = {
  training_plan_exercise_id: string;
  position: number;
  selected_training_plan_exercise_variant_id: string | null;
  selected_variant_id: string | null;
  selected_station_id: string | null;
  set: {
    load_value: number | null;
    repetition_kind?: RepetitionKind;
    repetition_value?: number;
  };
};

export type CreateWorkoutRequest = {
  training_plan_id: string;
  gym_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  exercises: CreateWorkoutExerciseInput[];
};

export type ActiveWorkoutExerciseInput = {
  training_plan_exercise_id: string;
  position: number;
  selected_training_plan_exercise_variant_id: string | null;
  selected_variant_id: string | null;
  load_input_mode?: LoadInputMode;
  set_tracking_mode?: SetTrackingMode;
  selected_station_id: string | null;
  skipped_at?: string | null;
  completed_sets: Array<{
    set_index: number;
    set_side: SetSide;
    load_value: number | null;
    load_value_per_side?: number | null;
    repetition_kind?: RepetitionKind;
    repetition_value?: number;
  }>;
};

export type ActiveWorkoutProgressPayload = {
  training_plan_id: string;
  gym_id: string | null;
  started_at: string;
  current_exercise_position: number;
  total_exercise_count: number;
  exercises: ActiveWorkoutExerciseInput[];
};

export type CreateActiveWorkoutRequest = ActiveWorkoutProgressPayload & {
  first_confirmed_exercise_position: number;
};

export type UpdateActiveWorkoutRequest = ActiveWorkoutProgressPayload & {
  last_confirmed_exercise_position: number;
};

export type CompleteActiveWorkoutRequest = ActiveWorkoutProgressPayload & {
  completed_at: string;
  last_confirmed_exercise_position: number;
};

export type TrainingPlanExerciseVariantsResponse = {
  training_plan_id: string;
  gym_id: string;
  exercise_variants?: PlanExerciseOptionSummary[];
  options?: PlanExerciseOptionSummary[];
};

export type TrainingPlanExerciseDetail = {
  training_plan_exercise_id: string;
  exercise_name: string;
  exercise_position: number;
};

export type TrainingPlanDetailResponse = {
  training_plan_id: string;
  exercises: TrainingPlanExerciseDetail[];
};

export type MissingExerciseDetail = {
  training_plan_exercise_id: string;
  exercise_position: number;
  exercise_name: string;
  reason: string;
};

export type ErrorDetails = {
  selected_gym_id?: string;
  missing_exercises?: MissingExerciseDetail[];
};

export type ErrorResponse = {
  message: string;
  details?: ErrorDetails;
};

export type BlockedStartModalState = {
  message: string;
  trainingPlanName: string;
  gymName: string;
  missingExercises: MissingExerciseDetail[];
};
