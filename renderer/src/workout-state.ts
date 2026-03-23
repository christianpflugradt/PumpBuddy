import type {
  ActiveWorkoutResponse,
  ActiveWorkoutProgressPayload,
  CreateWorkoutRequest,
  ExerciseStep,
  PlanExerciseOptionSummary,
  StartScreenState,
  TrainingPlanDetailResponse,
  TrainingPlanOptionsResponse,
  TrainingPlanSummary,
  ViewState,
  WorkoutPlan,
  WorkoutSetDraft,
  WorkoutSetDraftInput,
} from "./workout-types";

const DEFAULT_SUGGESTED_LOAD_KG = 10;
const DEFAULT_SUGGESTED_REPS = 10;
const MIN_REPS = 1;

const toDraftSet = (set: { load_value: number; reps: number | null } | null | undefined): WorkoutSetDraft => ({
  loadValue: set?.load_value ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: set?.reps ?? DEFAULT_SUGGESTED_REPS,
});

const toDraftSetInput = (set: WorkoutSetDraft): WorkoutSetDraftInput => ({
  loadValue: String(set.loadValue),
  reps: String(set.reps),
});

const parseNormalizedNumber = (value: string, fallback: number): number => {
  const trimmedValue = value.trim();
  if (!isDigitsOnly(trimmedValue)) {
    return fallback;
  }

  return Number(trimmedValue);
};

const cloneWorkoutPlan = (plan: WorkoutPlan): WorkoutPlan => ({
  ...plan,
  exercises: plan.exercises.map((exercise) => ({
    ...exercise,
    fallbackOptions: exercise.fallbackOptions.map((option) => ({ ...option })),
    suggestedSet: { ...exercise.suggestedSet },
    activeSet: { ...exercise.activeSet },
    activeSetInput: { ...exercise.activeSetInput },
    completedSets: exercise.completedSets.map((set) => ({ ...set })),
  })),
});

const hasTextValue = (value: string): boolean => value.trim().length > 0;

const isRealizableOption = (option: PlanExerciseOptionSummary): boolean =>
  hasTextValue(option.id) &&
  hasTextValue(option.training_plan_exercise_id) &&
  hasTextValue(option.variant_id) &&
  hasTextValue(option.station_id);

const resolvePersistedExerciseSelection = (
  exercise: ExerciseStep,
  persistedExercise: ActiveWorkoutResponse["workout"]["exercises"][number],
): {
  selectedPlanExerciseOptionId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  isFallbackOptionConfirmed: boolean;
} => {
  if (exercise.fallbackOptions.length === 0) {
    return {
      selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: persistedExercise.selected_station_id,
      isFallbackOptionConfirmed: true,
    };
  }

  const persistedSelectedOption =
    persistedExercise.selected_plan_exercise_option_id === null
      ? null
      : exercise.fallbackOptions.find(
          (option) => option.id === persistedExercise.selected_plan_exercise_option_id,
        ) ?? null;

  if (persistedSelectedOption) {
    return {
      selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: persistedExercise.selected_station_id,
      isFallbackOptionConfirmed: true,
    };
  }

  const currentSelectedOption =
    exercise.selectedPlanExerciseOptionId === null
      ? null
      : exercise.fallbackOptions.find(
          (option) => option.id === exercise.selectedPlanExerciseOptionId,
        ) ?? null;
  const fallbackOption = currentSelectedOption ?? exercise.fallbackOptions[0] ?? null;

  if (!fallbackOption) {
    return {
      selectedPlanExerciseOptionId: null,
      selectedVariantId: null,
      selectedStationId: null,
      isFallbackOptionConfirmed: exercise.isFallbackOptionConfirmed,
    };
  }

  return {
    selectedPlanExerciseOptionId: fallbackOption.id,
    selectedVariantId: fallbackOption.variant_id,
    selectedStationId: fallbackOption.station_id,
    isFallbackOptionConfirmed:
      exercise.fallbackOptions.length === 1
        ? true
        : exercise.isFallbackOptionConfirmed,
  };
};

export const createInitialStartScreenState = (): StartScreenState => ({
  isLoading: true,
  isStarting: false,
  errorMessage: null,
  blockedStartModal: null,
  trainingPlans: [],
  gyms: [],
  selectedTrainingPlanId: "",
  selectedGymId: "",
  selectedWorkoutMode: "configured-gym",
});

export const canStartWorkout = (startScreen: StartScreenState): boolean =>
  !startScreen.isLoading &&
  !startScreen.isStarting &&
  startScreen.selectedTrainingPlanId.length > 0 &&
  (startScreen.selectedWorkoutMode === "free-mode" || startScreen.selectedGymId.length > 0) &&
  startScreen.errorMessage === null;

export const buildWorkoutPlan = (
  selectedPlan: TrainingPlanSummary,
  optionsResponse: TrainingPlanOptionsResponse,
): WorkoutPlan => {
  const optionsByExercise = new Map<string, PlanExerciseOptionSummary[]>();

  for (const option of optionsResponse.options.filter(isRealizableOption)) {
    const exerciseOptions = optionsByExercise.get(option.training_plan_exercise_id) ?? [];
    exerciseOptions.push(option);
    optionsByExercise.set(option.training_plan_exercise_id, exerciseOptions);
  }

  if (optionsByExercise.size < selectedPlan.exercise_count) {
    throw new Error(
      "Configured-gym workout start is blocked because one or more exercises has no realizable option in the selected gym",
    );
  }

  const exercises = [...optionsByExercise.values()]
    .filter((exerciseOptions) => exerciseOptions.length > 0)
    .sort((left, right) => (left[0]?.exercise_position ?? 0) - (right[0]?.exercise_position ?? 0))
    .map((exerciseOptions) => {
      const selectedOption = exerciseOptions[0];
      if (!selectedOption) {
        throw new Error("Selected training plan has no available exercises for this gym");
      }

      return {
        trainingPlanExerciseId: selectedOption.training_plan_exercise_id,
        name: selectedOption.exercise_name,
        fallbackOptions: exerciseOptions.map((option) => ({ ...option })),
        selectedPlanExerciseOptionId: selectedOption.id,
        selectedVariantId: selectedOption.variant_id,
        selectedStationId: selectedOption.station_id,
        isFallbackOptionConfirmed: exerciseOptions.length === 1,
        suggestedSet: {
          loadValue: DEFAULT_SUGGESTED_LOAD_KG,
          reps: DEFAULT_SUGGESTED_REPS,
        },
        activeSet: {
          loadValue: DEFAULT_SUGGESTED_LOAD_KG,
          reps: DEFAULT_SUGGESTED_REPS,
        },
        activeSetInput: {
          loadValue: String(DEFAULT_SUGGESTED_LOAD_KG),
          reps: String(DEFAULT_SUGGESTED_REPS),
        },
        completedSets: [],
        isReadOnly: false,
      };
    });

  if (exercises.length === 0) {
    throw new Error("Selected training plan has no available exercises for this gym");
  }

  return {
    id: selectedPlan.id,
    name: selectedPlan.name,
    exercises,
  };
};

export const withFallbackOptionSelected = (
  workoutPlan: WorkoutPlan,
  exerciseIndex: number,
  selectedOptionId: string | null,
): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(workoutPlan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise || exercise.fallbackOptions.length === 0) {
    return nextPlan;
  }

  if (exercise.completedSets.length > 0) {
    return nextPlan;
  }

  const selectedOption =
    selectedOptionId === null
      ? exercise.fallbackOptions.length === 1
        ? exercise.fallbackOptions[0]
        : null
      : exercise.fallbackOptions.find((option) => option.id === selectedOptionId) ?? null;

  if (!selectedOption) {
    return nextPlan;
  }

  if (
    exercise.selectedPlanExerciseOptionId === selectedOption.id &&
    exercise.selectedVariantId === selectedOption.variant_id &&
    exercise.selectedStationId === selectedOption.station_id
  ) {
    return nextPlan;
  }

  exercise.selectedPlanExerciseOptionId = selectedOption.id;
  exercise.selectedVariantId = selectedOption.variant_id;
  exercise.selectedStationId = selectedOption.station_id;
  exercise.isFallbackOptionConfirmed = exercise.fallbackOptions.length === 1;

  return nextPlan;
};

export const withFallbackOptionSelectionConfirmed = (
  workoutPlan: WorkoutPlan,
  exerciseIndex: number,
): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(workoutPlan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise || exercise.fallbackOptions.length === 0) {
    return nextPlan;
  }

  if (!exercise.selectedPlanExerciseOptionId) {
    return nextPlan;
  }

  exercise.isFallbackOptionConfirmed = true;

  return nextPlan;
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

export const buildFreeModeWorkoutPlan = (
  selectedPlan: TrainingPlanSummary,
  planDetail: TrainingPlanDetailResponse,
): WorkoutPlan => {
  const exercises = [...planDetail.exercises]
    .sort((left, right) => left.exercise_position - right.exercise_position)
    .map((exercise) => ({
      trainingPlanExerciseId: exercise.training_plan_exercise_id,
      name: exercise.exercise_name,
      fallbackOptions: [],
      selectedPlanExerciseOptionId: null,
      selectedVariantId: null,
      selectedStationId: null,
      isFallbackOptionConfirmed: true,
      suggestedSet: {
        loadValue: DEFAULT_SUGGESTED_LOAD_KG,
        reps: DEFAULT_SUGGESTED_REPS,
      },
      activeSet: {
        loadValue: DEFAULT_SUGGESTED_LOAD_KG,
        reps: DEFAULT_SUGGESTED_REPS,
      },
      activeSetInput: {
        loadValue: String(DEFAULT_SUGGESTED_LOAD_KG),
        reps: String(DEFAULT_SUGGESTED_REPS),
      },
      completedSets: [],
      isReadOnly: false,
    }));

  if (exercises.length === 0) {
    throw new Error("Selected training plan has no available exercises");
  }

  return {
    id: selectedPlan.id,
    name: selectedPlan.name,
    exercises,
  };
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
  gymId: string | null,
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
  gymId: string | null,
  startedAt: string,
  currentExercisePosition: number,
  options: {
    includeExercisePositions?: number[];
  } = {},
): ActiveWorkoutProgressPayload => ({
  training_plan_id: workoutPlan.id,
  gym_id: gymId,
  started_at: startedAt,
  current_exercise_position: currentExercisePosition,
  total_exercise_count: workoutPlan.exercises.length,
  exercises: workoutPlan.exercises.flatMap((exercise, index) =>
    exercise.completedSets.length > 0 || options.includeExercisePositions?.includes(index + 1)
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

      const suggestedSet = toDraftSet(persistedExercise.suggested_set);
      const activeSet = { ...suggestedSet };
      const selection = resolvePersistedExerciseSelection(exercise, persistedExercise);

      return {
        trainingPlanExerciseId: persistedExercise.training_plan_exercise_id,
        name: persistedExercise.exercise_name,
        fallbackOptions: exercise.fallbackOptions,
        selectedPlanExerciseOptionId: selection.selectedPlanExerciseOptionId,
        selectedVariantId: selection.selectedVariantId,
        selectedStationId: selection.selectedStationId,
        isFallbackOptionConfirmed: selection.isFallbackOptionConfirmed,
        suggestedSet,
        completedSets: persistedExercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          loadValue: set.load_value,
          reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
        })),
        activeSet,
        activeSetInput: toDraftSetInput(activeSet),
        isReadOnly: exercise.isReadOnly,
      };
    }),
  };
};

export const normalizeExerciseActiveSet = (exerciseStep: ExerciseStep): void => {
  const normalizedLoadValue = parseNormalizedNumber(
    exerciseStep.activeSetInput.loadValue,
    exerciseStep.activeSet.loadValue,
  );
  const normalizedRepsValue = Math.max(
    MIN_REPS,
    parseNormalizedNumber(exerciseStep.activeSetInput.reps, exerciseStep.activeSet.reps),
  );

  exerciseStep.activeSet.loadValue = normalizedLoadValue;
  exerciseStep.activeSet.reps = normalizedRepsValue;
  exerciseStep.activeSetInput.loadValue = String(normalizedLoadValue);
  exerciseStep.activeSetInput.reps = String(normalizedRepsValue);
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

export const buildWorkoutPlanFromFreeModeActiveWorkout = (
  response: ActiveWorkoutResponse,
): WorkoutPlan => {
  const exercises = [...response.workout.exercises]
    .sort((left, right) => left.position - right.position)
    .map((exercise) => {
      const suggestedSet = toDraftSet(exercise.suggested_set);
      const activeSet = { ...suggestedSet };

      return {
        trainingPlanExerciseId: exercise.training_plan_exercise_id,
        name: exercise.exercise_name,
        fallbackOptions: [],
        selectedPlanExerciseOptionId: null,
        selectedVariantId: null,
        selectedStationId: null,
        isFallbackOptionConfirmed: true,
        suggestedSet,
        completedSets: exercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          loadValue: set.load_value,
          reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
        })),
        activeSet,
        activeSetInput: toDraftSetInput(activeSet),
        isReadOnly: false,
      };
    });

  return {
    id: response.workout.training_plan_id,
    name: response.workout.training_plan_name,
    exercises,
  };
};

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
