export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: ExerciseStep[];
};

export type WorkoutSetDraft = {
  loadValue: number;
  reps: number;
};

export type CompletedExerciseSet = WorkoutSetDraft & {
  setIndex: number;
};

export type ExerciseStep = {
  trainingPlanExerciseId: string;
  name: string;
  selectedPlanExerciseOptionId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  suggestedSet: WorkoutSetDraft;
  activeSet: WorkoutSetDraft;
  completedSets: CompletedExerciseSet[];
  isReadOnly: boolean;
};

export type TrainingPlanSummary = {
  id: string;
  name: string;
  exercise_count: number;
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
  variant_id: string;
  variant_name: string;
  variant_type: string;
  station_id: string;
  station_name: string;
};

export type ViewState =
  | { screen: "start" }
  | { screen: "exercise"; exerciseIndex: number }
  | { screen: "completion" };

export type WorkoutSummary = {
  id: string;
  training_plan_id: string;
  training_plan_name: string;
  gym_id: string;
  gym_name: string;
  started_at: string | null;
  completed_at: string | null;
  exercise_count: number;
  completed_set_count: number;
};

export type ActiveWorkoutSet = {
  load_value: number;
  reps: number | null;
};

export type CompletedActiveWorkoutSet = ActiveWorkoutSet & {
  set_index: number;
};

export type ActiveWorkoutExercise = {
  training_plan_exercise_id: string;
  position: number;
  exercise_name: string;
  selected_plan_exercise_option_id: string | null;
  selected_variant_id: string | null;
  selected_variant_name: string | null;
  selected_station_id: string | null;
  selected_station_name: string | null;
  completed_sets: CompletedActiveWorkoutSet[];
  suggested_set: ActiveWorkoutSet;
};

export type ActiveWorkout = {
  id: string;
  training_plan_id: string;
  training_plan_name: string;
  gym_id: string;
  gym_name: string;
  started_at: string;
  updated_at: string;
  current_exercise_position: number;
  total_exercise_count: number;
  exercises: ActiveWorkoutExercise[];
};

export type ActiveWorkoutResponse = {
  workout: ActiveWorkout;
};

export type CreateWorkoutRequest = {
  training_plan_id: string;
  gym_id: string;
  started_at: string | null;
  completed_at: string;
  exercises: CreateWorkoutExerciseInput[];
};

export type CreateWorkoutExerciseInput = {
  training_plan_exercise_id: string;
  position: number;
  selected_plan_exercise_option_id: string | null;
  selected_variant_id: string | null;
  selected_station_id: string | null;
  set: {
    load_value: number;
    reps: number;
  };
};

export type ActiveWorkoutExerciseInput = {
  training_plan_exercise_id: string;
  position: number;
  selected_plan_exercise_option_id: string | null;
  selected_variant_id: string | null;
  selected_station_id: string | null;
  completed_sets: Array<{
    load_value: number;
    reps: number;
  }>;
};

export type ActiveWorkoutProgressPayload = {
  training_plan_id: string;
  gym_id: string;
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

export type TrainingPlanOptionsResponse = {
  training_plan_id: string;
  gym_id: string;
  options: PlanExerciseOptionSummary[];
};

export type StartScreenState = {
  isLoading: boolean;
  isStarting: boolean;
  errorMessage: string | null;
  trainingPlans: TrainingPlanSummary[];
  gyms: GymSummary[];
  selectedTrainingPlanId: string;
  selectedGymId: string;
};

export type AppState = {
  startScreen: StartScreenState;
  workoutPlan: WorkoutPlan | null;
  viewState: ViewState;
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
};
