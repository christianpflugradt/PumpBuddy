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
const FORMULA_BASELINE_LOAD_KG = 20;
const BOUNDED_DISCRETE_START_RATIO = 0.3;
const FLOAT_TOLERANCE = 1e-9;

type LoadStepDirection = "increase" | "decrease";

const approxEq = (left: number, right: number): boolean => Math.abs(left - right) <= FLOAT_TOLERANCE;

const isValidProfileLoads = (loads: number[]): boolean => loads.length > 0 && loads.every((load) => Number.isFinite(load));

const isFormulaMinStepProfile = (profileLoadsKg: number[]): boolean => {
  if (profileLoadsKg.length < 2) {
    return false;
  }

  const firstDelta = profileLoadsKg[1] - profileLoadsKg[0];
  if (firstDelta <= FLOAT_TOLERANCE) {
    return false;
  }

  for (let index = 2; index < profileLoadsKg.length; index += 1) {
    const delta = profileLoadsKg[index]! - profileLoadsKg[index - 1]!;
    if (Math.abs(delta - firstDelta) > FLOAT_TOLERANCE) {
      return false;
    }
  }

  return true;
};

const suggestProfileStartLoad = (profileLoadsKg: number[]): number | null => {
  if (!isValidProfileLoads(profileLoadsKg)) {
    return null;
  }

  if (isFormulaMinStepProfile(profileLoadsKg)) {
    if (profileLoadsKg.some((load) => approxEq(load, FORMULA_BASELINE_LOAD_KG))) {
      return FORMULA_BASELINE_LOAD_KG;
    }

    return (
      profileLoadsKg.find((load) => load > FORMULA_BASELINE_LOAD_KG + FLOAT_TOLERANCE) ??
      profileLoadsKg[profileLoadsKg.length - 1] ??
      null
    );
  }

  const max = profileLoadsKg[profileLoadsKg.length - 1];
  if (max === undefined) {
    return null;
  }

  const target = max * BOUNDED_DISCRETE_START_RATIO;
  return profileLoadsKg.find((load) => load + FLOAT_TOLERANCE >= target) ?? max;
};

const suggestStartSet = (profileLoadsKg: number[]): WorkoutSetDraft => ({
  loadValue: suggestProfileStartLoad(profileLoadsKg) ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: DEFAULT_SUGGESTED_REPS,
});

const isStationlessOption = (option: Pick<PlanExerciseOptionSummary, "station_id">): boolean =>
  option.station_id === null || option.station_id.trim().length === 0;

const suggestStartSetForOption = (option: PlanExerciseOptionSummary): WorkoutSetDraft =>
  isStationlessOption(option)
    ? {
        loadValue: null,
        reps: DEFAULT_SUGGESTED_REPS,
      }
    : suggestStartSet(option.station_profile_loads_kg);

export const stepProfileLoad = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  direction: LoadStepDirection,
): number | null => {
  if (!isValidProfileLoads(profileLoadsKg) || !Number.isFinite(currentLoadKg)) {
    return null;
  }

  const min = profileLoadsKg[0]!;
  const max = profileLoadsKg[profileLoadsKg.length - 1]!;
  const second = profileLoadsKg[1] ?? min;
  const penultimate = profileLoadsKg[profileLoadsKg.length - 2] ?? max;

  if (currentLoadKg <= min) {
    return direction === "decrease" ? min : second;
  }
  if (currentLoadKg >= max) {
    return direction === "increase" ? max : penultimate;
  }

  for (let index = 0; index < profileLoadsKg.length; index += 1) {
    const load = profileLoadsKg[index]!;
    if (approxEq(currentLoadKg, load)) {
      if (direction === "decrease") {
        return index === 0 ? load : profileLoadsKg[index - 1]!;
      }
      return index + 1 >= profileLoadsKg.length ? load : profileLoadsKg[index + 1]!;
    }

    if (currentLoadKg < load) {
      return direction === "decrease" ? profileLoadsKg[index - 1]! : load;
    }
  }

  return max;
};

const snapToProfileLoad = (profileLoadsKg: number[], currentLoadKg: number): number | null => {
  if (!isValidProfileLoads(profileLoadsKg) || !Number.isFinite(currentLoadKg)) {
    return null;
  }

  if (profileLoadsKg.some((load) => approxEq(load, currentLoadKg))) {
    return currentLoadKg;
  }

  const lower = stepProfileLoad(profileLoadsKg, currentLoadKg, "decrease");
  const upper = stepProfileLoad(profileLoadsKg, currentLoadKg, "increase");
  if (lower === null || upper === null) {
    return null;
  }

  const lowerDistance = Math.abs(currentLoadKg - lower);
  const upperDistance = Math.abs(upper - currentLoadKg);
  return upperDistance + FLOAT_TOLERANCE < lowerDistance ? upper : lower;
};

const toDraftSet = (set: { load_value: number | null; reps: number | null } | null | undefined): WorkoutSetDraft =>
  set?.load_value === null
    ? {
        loadValue: null,
        reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
      }
    : {
        loadValue: set?.load_value ?? DEFAULT_SUGGESTED_LOAD_KG,
        reps: set?.reps ?? DEFAULT_SUGGESTED_REPS,
      };

const toDraftSetInput = (set: WorkoutSetDraft): WorkoutSetDraftInput => ({
  loadValue: set.loadValue === null ? "" : String(set.loadValue),
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
    selectedStationProfileLoadsKg: [...exercise.selectedStationProfileLoadsKg],
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
  (hasTextValue(option.station_id ?? "") || isStationlessOption(option));

const resolvePersistedExerciseSelection = (
  exercise: ExerciseStep,
  persistedExercise: ActiveWorkoutResponse["workout"]["exercises"][number],
): {
  selectedPlanExerciseOptionId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  selectedStationProfileLoadsKg: number[];
  isFallbackOptionConfirmed: boolean;
} => {
  if (exercise.fallbackOptions.length === 0) {
    return {
      selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: persistedExercise.selected_station_id,
      selectedStationProfileLoadsKg: exercise.selectedStationProfileLoadsKg,
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
      selectedStationProfileLoadsKg: [...persistedSelectedOption.station_profile_loads_kg],
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
      selectedStationProfileLoadsKg: exercise.selectedStationProfileLoadsKg,
      isFallbackOptionConfirmed: exercise.isFallbackOptionConfirmed,
    };
  }

  return {
    selectedPlanExerciseOptionId: fallbackOption.id,
    selectedVariantId: fallbackOption.variant_id,
    selectedStationId: fallbackOption.station_id,
    selectedStationProfileLoadsKg: [...fallbackOption.station_profile_loads_kg],
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
      const suggestedSet = suggestStartSetForOption(selectedOption);
      const selectedStationId = isStationlessOption(selectedOption) ? null : selectedOption.station_id;
      const selectedStationProfileLoadsKg = isStationlessOption(selectedOption)
        ? []
        : [...selectedOption.station_profile_loads_kg];

      return {
        trainingPlanExerciseId: selectedOption.training_plan_exercise_id,
        name: selectedOption.exercise_name,
        fallbackOptions: exerciseOptions.map((option) => ({ ...option })),
        selectedPlanExerciseOptionId: selectedOption.id,
        selectedVariantId: selectedOption.variant_id,
        selectedStationId,
        selectedStationProfileLoadsKg,
        isFallbackOptionConfirmed: exerciseOptions.length === 1,
        suggestedSet,
        activeSet: { ...suggestedSet },
        activeSetInput: toDraftSetInput(suggestedSet),
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
  exercise.selectedStationId = isStationlessOption(selectedOption) ? null : selectedOption.station_id;
  exercise.selectedStationProfileLoadsKg = isStationlessOption(selectedOption)
    ? []
    : [...selectedOption.station_profile_loads_kg];
  exercise.isFallbackOptionConfirmed = exercise.fallbackOptions.length === 1;
  const suggestedSet = suggestStartSetForOption(selectedOption);
  exercise.suggestedSet = suggestedSet;
  exercise.activeSet = { ...suggestedSet };
  exercise.activeSetInput = toDraftSetInput(suggestedSet);

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
      selectedStationProfileLoadsKg: [],
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
        selectedStationProfileLoadsKg: selection.selectedStationProfileLoadsKg,
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

export const normalizeExerciseActiveSet = (
  exerciseStep: ExerciseStep,
  mode: "configured-gym" | "free-mode",
): void => {
  const isStationlessSelectedOption =
    exerciseStep.selectedPlanExerciseOptionId !== null && exerciseStep.selectedStationId === null;
  const fallbackLoadValue = exerciseStep.activeSet.loadValue ?? DEFAULT_SUGGESTED_LOAD_KG;
  const parsedLoadValue = parseNormalizedNumber(exerciseStep.activeSetInput.loadValue, fallbackLoadValue);
  const normalizedLoadValue =
    isStationlessSelectedOption
      ? null
      : mode === "configured-gym"
        ? (snapToProfileLoad(exerciseStep.selectedStationProfileLoadsKg, parsedLoadValue) ?? parsedLoadValue)
        : parsedLoadValue;
  const normalizedRepsValue = Math.max(
    MIN_REPS,
    parseNormalizedNumber(exerciseStep.activeSetInput.reps, exerciseStep.activeSet.reps),
  );

  exerciseStep.activeSet.loadValue = normalizedLoadValue;
  exerciseStep.activeSet.reps = normalizedRepsValue;
  exerciseStep.activeSetInput.loadValue = normalizedLoadValue === null ? "" : String(normalizedLoadValue);
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
        selectedStationProfileLoadsKg: [],
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
