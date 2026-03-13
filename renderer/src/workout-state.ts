import type {
  ActiveWorkoutResponse,
  ActiveWorkoutProgressPayload,
  CreateWorkoutRequest,
  ExerciseStep,
  PlanExerciseOptionSummary,
  StartScreenState,
  TrainingPlanOptionsResponse,
  TrainingPlanSummary,
  ViewState,
  WorkoutPlan,
  WorkoutSetDraft,
} from "./workout-types";

const DEFAULT_SUGGESTED_LOAD_KG = 10;
const DEFAULT_SUGGESTED_REPS = 10;

const toDraftSet = (set: { load_value: number; reps: number | null } | null | undefined): WorkoutSetDraft => ({
  loadValue: set?.load_value ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: set?.reps ?? DEFAULT_SUGGESTED_REPS,
});

const cloneWorkoutPlan = (plan: WorkoutPlan): WorkoutPlan => ({
  ...plan,
  exercises: plan.exercises.map((exercise) => ({
    ...exercise,
    suggestedSet: { ...exercise.suggestedSet },
    activeSet: { ...exercise.activeSet },
    completedSets: exercise.completedSets.map((set) => ({ ...set })),
  })),
});

export const createInitialStartScreenState = (): StartScreenState => ({
  isLoading: true,
  isStarting: false,
  errorMessage: null,
  trainingPlans: [],
  gyms: [],
  selectedTrainingPlanId: "",
  selectedGymId: "",
});

export const canStartWorkout = (startScreen: StartScreenState): boolean =>
  !startScreen.isLoading &&
  !startScreen.isStarting &&
  startScreen.selectedTrainingPlanId.length > 0 &&
  startScreen.selectedGymId.length > 0 &&
  startScreen.errorMessage === null;

export const buildWorkoutPlan = (
  selectedPlan: TrainingPlanSummary,
  optionsResponse: TrainingPlanOptionsResponse,
): WorkoutPlan => {
  const optionsByExercise = new Map<string, PlanExerciseOptionSummary>();

  for (const option of optionsResponse.options) {
    if (!optionsByExercise.has(option.training_plan_exercise_id)) {
      optionsByExercise.set(option.training_plan_exercise_id, option);
    }
  }

  const exercises = [...optionsByExercise.values()]
    .sort((left, right) => left.exercise_position - right.exercise_position)
    .map((option) => ({
      trainingPlanExerciseId: option.training_plan_exercise_id,
      name: option.exercise_name,
      selectedPlanExerciseOptionId: option.id,
      selectedVariantId: option.variant_id,
      selectedStationId: option.station_id,
      suggestedSet: {
        loadValue: DEFAULT_SUGGESTED_LOAD_KG,
        reps: DEFAULT_SUGGESTED_REPS,
      },
      activeSet: {
        loadValue: DEFAULT_SUGGESTED_LOAD_KG,
        reps: DEFAULT_SUGGESTED_REPS,
      },
      completedSets: [],
      isReadOnly: false,
    }));

  if (exercises.length === 0) {
    throw new Error("Selected training plan has no available exercises for this gym");
  }

  return {
    id: selectedPlan.id,
    name: selectedPlan.name,
    exercises,
  };
};

export const setExerciseReadOnly = (
  plan: WorkoutPlan,
  exerciseIndex: number,
  isReadOnly: boolean,
): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(plan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise) {
    return nextPlan;
  }

  exercise.isReadOnly = isReadOnly;
  return nextPlan;
};

export const withCurrentSetCompleted = (plan: WorkoutPlan, exerciseIndex: number): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(plan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise) {
    return nextPlan;
  }

  exercise.completedSets.push({
    setIndex: exercise.completedSets.length + 1,
    loadValue: exercise.activeSet.loadValue,
    reps: exercise.activeSet.reps,
  });

  return nextPlan;
};

export const buildCreateWorkoutRequest = (
  workoutPlan: WorkoutPlan,
  gymId: string,
  completedAt: string,
  startedAt: string | null = completedAt,
): CreateWorkoutRequest => ({
  training_plan_id: workoutPlan.id,
  gym_id: gymId,
  started_at: startedAt,
  completed_at: completedAt,
  exercises: workoutPlan.exercises.map((exercise, index) => ({
    training_plan_exercise_id: exercise.trainingPlanExerciseId,
    position: index + 1,
    selected_plan_exercise_option_id: exercise.selectedPlanExerciseOptionId,
    selected_variant_id: exercise.selectedVariantId,
    selected_station_id: exercise.selectedStationId,
    set: {
      load_value: exercise.activeSet.loadValue,
      reps: exercise.activeSet.reps,
    },
  })),
});

export const buildActiveWorkoutProgressPayload = (
  workoutPlan: WorkoutPlan,
  gymId: string,
  startedAt: string,
  currentExercisePosition: number,
): ActiveWorkoutProgressPayload => ({
  training_plan_id: workoutPlan.id,
  gym_id: gymId,
  started_at: startedAt,
  current_exercise_position: currentExercisePosition,
  total_exercise_count: workoutPlan.exercises.length,
  exercises: workoutPlan.exercises.flatMap((exercise, index) =>
    exercise.completedSets.length > 0
      ? [
          {
            training_plan_exercise_id: exercise.trainingPlanExerciseId,
            position: index + 1,
            selected_plan_exercise_option_id: exercise.selectedPlanExerciseOptionId,
            selected_variant_id: exercise.selectedVariantId,
            selected_station_id: exercise.selectedStationId,
            completed_sets: exercise.completedSets.map((set) => ({
              load_value: set.loadValue,
              reps: set.reps,
            })),
          },
        ]
      : [],
  ),
});

export const applyActiveWorkoutResponse = (
  workoutPlan: WorkoutPlan,
  response: ActiveWorkoutResponse,
): WorkoutPlan => {
  const exercisesByPosition = new Map(
    response.workout.exercises.map((exercise) => [exercise.position, exercise] as const),
  );

  return {
    id: response.workout.training_plan_id,
    name: response.workout.training_plan_name,
    exercises: workoutPlan.exercises.map((exercise, index) => {
      const persistedExercise = exercisesByPosition.get(index + 1);

      if (!persistedExercise) {
        return exercise;
      }

      return {
        trainingPlanExerciseId: persistedExercise.training_plan_exercise_id,
        name: persistedExercise.exercise_name,
        selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
        selectedVariantId: persistedExercise.selected_variant_id,
        selectedStationId: persistedExercise.selected_station_id,
        suggestedSet: toDraftSet(persistedExercise.suggested_set),
        completedSets: persistedExercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          loadValue: set.load_value,
          reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
        })),
        activeSet: toDraftSet(persistedExercise.suggested_set),
        isReadOnly: exercise.isReadOnly,
      };
    }),
  };
};

export const buildWorkoutPlanFromActiveWorkout = (
  response: ActiveWorkoutResponse,
  optionsResponse: TrainingPlanOptionsResponse,
): WorkoutPlan =>
  applyActiveWorkoutResponse(
    buildWorkoutPlan(
      {
        id: response.workout.training_plan_id,
        name: response.workout.training_plan_name,
        exercise_count: response.workout.total_exercise_count,
      },
      optionsResponse,
    ),
    response,
  );

export const isDigitsOnly = (value: string): boolean => /^[0-9]+$/.test(value);

export const hasCompletedSets = (exerciseStep: ExerciseStep): boolean =>
  exerciseStep.completedSets.length > 0;

export const isDraftModified = (exerciseStep: ExerciseStep): boolean =>
  exerciseStep.activeSet.loadValue !== exerciseStep.suggestedSet.loadValue ||
  exerciseStep.activeSet.reps !== exerciseStep.suggestedSet.reps;

export const shouldConfirmForwardNavigation = (exerciseStep: ExerciseStep): boolean =>
  !hasCompletedSets(exerciseStep) || isDraftModified(exerciseStep);

export const getNextViewState = (
  viewState: ViewState,
  action: "start-workout" | "next",
  totalExercises: number,
): ViewState => {
  if (action === "start-workout") {
    return { screen: "exercise", exerciseIndex: 0 };
  }

  if (viewState.screen !== "exercise") {
    return viewState;
  }

  if (viewState.exerciseIndex < totalExercises - 1) {
    return {
      ...viewState,
      exerciseIndex: viewState.exerciseIndex + 1,
    };
  }

  return { screen: "completion" };
};

export const countPersistedExercises = (response: ActiveWorkoutResponse): number =>
  response.workout.exercises.filter((exercise) => exercise.completed_sets.length > 0).length;
