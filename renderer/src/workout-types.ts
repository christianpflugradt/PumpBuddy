export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: ExerciseStep[];
};

export type WorkoutMode = "configured-gym" | "free-mode";

export type WorkoutSetDraft = {
  loadValue: number | null;
  reps: number;
};

export type RepetitionKind = "REPS" | "SECS";

export type LoadInputMode = "TOTAL" | "PER_SIDE";
export type SetTrackingMode = "UNILATERAL" | "BILATERAL";
export type SetSide = "LEFT" | "RIGHT" | "BILATERAL";

export type WorkoutSetDraftInput = {
  loadValue: string;
  reps: string;
};

export type CompletedExerciseSet = WorkoutSetDraft & {
  setIndex: number;
  setSide?: SetSide;
};

export type TrainingPlanSummary = {
  id: string;
  name: string;
  exercise_count: number;
  last_completed_at?: string | null;
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
  variant_type?: RepetitionKind | string;
  repetition_kind?: RepetitionKind | string;
  station_id: string | null;
  station_name: string;
  station_profile_loads_kg?: number[];
  suggested_start_load_kg?: number | null;
  last_completed_at?: string | null;
  load_input_mode?: LoadInputMode | null;
};

export type TrainingPlanExerciseVariantSummary = PlanExerciseOptionSummary;

export type ExerciseStep = {
  trainingPlanExerciseId: string;
  name: string;
  fallbackOptions: PlanExerciseOptionSummary[];
  selectedTrainingPlanExerciseVariantId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  selectedStationProfileLoadsKg: number[];
  loadInputMode?: LoadInputMode | null;
  repetitionKind: RepetitionKind;
  setTrackingMode?: SetTrackingMode | null;
  isFallbackOptionConfirmed: boolean;
  skippedAt?: string | null;
  suggestedSet: WorkoutSetDraft;
  activeSet: WorkoutSetDraft;
  activeSetInput: WorkoutSetDraftInput;
  completedSets: CompletedExerciseSet[];
  currentSetIndex?: number;
  currentSetSide?: SetSide;
  isReadOnly: boolean;
  isSecsTimerRunning: boolean;
};

export type ViewState =
  | { screen: "start" }
  | { screen: "settings" }
  | { screen: "about" }
  | { screen: "exercise"; exerciseIndex: number }
  | { screen: "completion" };

export type SessionUser = {
  id: string;
  displayName: string;
  login?: string;
  registrationDate?: string;
  favoriteGymId?: string | null;
};

export type AboutMetadata = {
  app_version: string;
  commit_hash_short: string;
  build_timestamp_utc: string;
  channel: "stable";
};

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
};

export type ActiveWorkoutSet = {
  set_index?: number;
  set_side?: SetSide;
  load_value?: number | null;
  suggested_load_input_kg?: number | null;
  suggested_load_total_kg?: number | null;
  repetition_kind?: RepetitionKind | null;
  repetition_value?: number | null;
  reps?: number | null;
};

export type CompletedActiveWorkoutSet = {
  set_index: number;
  set_side?: SetSide;
  load_value: number | null;
  load_value_per_side?: number | null;
  repetition_kind?: RepetitionKind | null;
  repetition_value?: number | null;
  reps?: number | null;
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
    reps?: number;
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
    reps?: number;
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

export type StartScreenState = {
  // Session user comes from existing /auth/session payload for greeting personalization.
  sessionUser?: SessionUser | null;
  isLoading: boolean;
  isStarting: boolean;
  errorMessage: string | null;
  blockedStartModal: BlockedStartModalState | null;
  trainingPlans: TrainingPlanSummary[];
  gyms: GymSummary[];
  selectedTrainingPlanId: string;
  selectedGymId: string;
  selectedWorkoutMode: WorkoutMode;
};

export type AppState = {
  sessionUser?: SessionUser | null;
  aboutScreen?: {
    metadata: AboutMetadata | null;
    errorMessage: string | null;
  };
  startScreen: StartScreenState;
  workoutPlan: WorkoutPlan | null;
  viewState: ViewState;
  completion: {
    startedAt: string | null;
    completedAt: string | null;
  };
  confirmDialog: {
    message: string | null;
    confirmActionLabel: string | null;
    onConfirm: (() => void | Promise<void>) | null;
  };
  activeWorkout: {
    id: string | null;
    startedAt: string | null;
    persistedExerciseCount: number;
  };
  workoutSave: {
    isSaving: boolean;
    errorMessage: string | null;
  };
  uiFeedback: {
    completedSetPulseToken: number;
    loadTickToken: number;
    repsTickToken: number;
  };
};
