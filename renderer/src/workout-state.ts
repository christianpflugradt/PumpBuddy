import type {
  ActiveWorkoutResponse,
  ActiveWorkoutProgressPayload,
  CreateWorkoutRequest,
  ExerciseStep,
  LoadInputMode,
  PlanExerciseOptionSummary,
  SetSide,
  SetTrackingMode,
  StartScreenState,
  TrainingPlanDetailResponse,
  TrainingPlanOptionsResponse,
  TrainingPlanSummary,
  ViewState,
  WorkoutPlan,
  WorkoutSetDraft,
  WorkoutSetDraftInput,
} from "./workout-types";
import { formatLoadInputDisplay, LOAD_DISPLAY_DECIMAL_PLACES } from "./workout-load-display";

const DEFAULT_SUGGESTED_LOAD_KG = 10;
const DEFAULT_SUGGESTED_REPS = 10;
const MIN_REPS = 1;
const PER_SIDE_FACTOR = 2;
const LOAD_DISPLAY_ROUNDING_TOLERANCE = 1 / 10 ** LOAD_DISPLAY_DECIMAL_PLACES;
const FLOAT_TOLERANCE = 1e-9;

type LoadStepDirection = "increase" | "decrease";

const approxEq = (left: number, right: number): boolean => Math.abs(left - right) <= FLOAT_TOLERANCE;

const isValidProfileLoads = (loads: number[]): boolean => loads.length > 0 && loads.every((load) => Number.isFinite(load));

const normalizeLoadInputMode = (mode: LoadInputMode | null | undefined): LoadInputMode =>
  mode === "PER_SIDE" ? "PER_SIDE" : "TOTAL";

const normalizeSetTrackingMode = (mode: SetTrackingMode | null | undefined): SetTrackingMode =>
  mode === "UNILATERAL" ? "UNILATERAL" : "BILATERAL";

const normalizeSetSide = (side: SetSide | null | undefined): SetSide | null => {
  if (side === "LEFT" || side === "RIGHT" || side === "BILATERAL") {
    return side;
  }

  return null;
};

const toInputLoadValue = (
  canonicalTotalLoadValue: number | null,
  loadInputMode: LoadInputMode | null | undefined,
): number | null => {
  if (canonicalTotalLoadValue === null) {
    return null;
  }

  return normalizeLoadInputMode(loadInputMode) === "PER_SIDE"
    ? canonicalTotalLoadValue / PER_SIDE_FACTOR
    : canonicalTotalLoadValue;
};

const toCanonicalTotalLoadValue = (
  inputLoadValue: number | null,
  loadInputMode: LoadInputMode | null | undefined,
): number | null => {
  if (inputLoadValue === null) {
    return null;
  }

  return normalizeLoadInputMode(loadInputMode) === "PER_SIDE"
    ? inputLoadValue * PER_SIDE_FACTOR
    : inputLoadValue;
};

const suggestStartSet = (suggestedStartLoadKg: number | null | undefined): WorkoutSetDraft => ({
  loadValue: suggestedStartLoadKg ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: DEFAULT_SUGGESTED_REPS,
});

const isStationlessOption = (option: Pick<PlanExerciseOptionSummary, "station_id">): boolean =>
  option.station_id === null || option.station_id.trim().length === 0;

export const optionSelectionKey = (option: Pick<PlanExerciseOptionSummary, "id" | "station_id">): string =>
  `${option.id}::${option.station_id ?? ""}`;

const selectedOptionSelectionKey = (
  selectedPlanExerciseOptionId: string | null,
  selectedStationId: string | null,
): string | null =>
  selectedPlanExerciseOptionId === null ? null : `${selectedPlanExerciseOptionId}::${selectedStationId ?? ""}`;

const suggestStartSetForOption = (option: PlanExerciseOptionSummary): WorkoutSetDraft =>
  isStationlessOption(option)
    ? {
        loadValue: null,
        reps: DEFAULT_SUGGESTED_REPS,
      }
    : suggestStartSet(option.suggested_start_load_kg ?? null);

const normalizeStationId = (stationId: string | null): string | null =>
  stationId === null || stationId.trim().length === 0 ? null : stationId;

const normalizeLoadForSelection = (
  loadValue: number | null,
  selectedPlanExerciseOptionId: string | null,
  selectedStationId: string | null,
): number | null =>
  selectedPlanExerciseOptionId !== null && selectedStationId === null ? null : loadValue;

const normalizeLoadForSelectionAndProfile = (
  loadValue: number | null,
  selectedPlanExerciseOptionId: string | null,
  selectedStationId: string | null,
  selectedStationProfileLoadsKg: number[],
): number | null => {
  const selectionNormalized = normalizeLoadForSelection(
    loadValue,
    selectedPlanExerciseOptionId,
    selectedStationId,
  );

  if (selectionNormalized === null || selectedStationId === null) {
    return selectionNormalized;
  }

  const roundedCanonical = findRoundedCanonicalProfileLoad(
    selectedStationProfileLoadsKg,
    selectionNormalized,
    LOAD_DISPLAY_ROUNDING_TOLERANCE + FLOAT_TOLERANCE,
  );
  if (roundedCanonical === null) {
    return selectionNormalized;
  }

  // Only normalize values that are effectively rounded representations of a
  // canonical profile load (for example 27.22 vs 27.2155422). Keep deliberate
  // off-profile manual entries untouched.
  if (
    Math.abs(roundedCanonical - selectionNormalized) <=
    LOAD_DISPLAY_ROUNDING_TOLERANCE + FLOAT_TOLERANCE
  ) {
    return roundedCanonical;
  }

  return selectionNormalized;
};

export const stepWithinProfileLoads = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  direction: LoadStepDirection,
): number | null => {
  if (!isValidProfileLoads(profileLoadsKg) || !Number.isFinite(currentLoadKg)) {
    return null;
  }

  const min = profileLoadsKg[0]!;
  const max = profileLoadsKg[profileLoadsKg.length - 1]!;
  const exactIndex = profileLoadsKg.findIndex((load) => approxEq(load, currentLoadKg));

  if (exactIndex >= 0) {
    if (direction === "decrease") {
      return exactIndex === 0 ? min : profileLoadsKg[exactIndex - 1]!;
    }
    return exactIndex + 1 >= profileLoadsKg.length ? max : profileLoadsKg[exactIndex + 1]!;
  }

  if (currentLoadKg <= min) {
    return min;
  }

  if (currentLoadKg >= max) {
    return max;
  }

  const upperIndex = profileLoadsKg.findIndex((load) => load > currentLoadKg);
  if (upperIndex <= 0) {
    return direction === "decrease" ? min : max;
  }

  return direction === "decrease" ? profileLoadsKg[upperIndex - 1]! : profileLoadsKg[upperIndex]!;
};

export const stepWithinProfileLoadsForInputMode = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  _loadInputMode: LoadInputMode | null | undefined,
  direction: LoadStepDirection,
): number | null =>
  stepWithinProfileLoads(profileLoadsKg, currentLoadKg, direction);

const findRoundedCanonicalProfileLoad = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  tolerance: number,
): number | null => {
  if (!isValidProfileLoads(profileLoadsKg) || !Number.isFinite(currentLoadKg)) {
    return null;
  }

  const roundedMatch = profileLoadsKg.find((load) => Math.abs(load - currentLoadKg) <= tolerance);
  return roundedMatch ?? null;
};

const toDraftSet = (
  set: ActiveWorkoutResponse["workout"]["exercises"][number]["suggested_set"],
): WorkoutSetDraft => {
  const suggestedInputLoad = set?.suggested_load_input_kg;
  const suggestedTotalLoad = set?.suggested_load_total_kg ?? set?.load_value;
  const resolvedLoad = suggestedInputLoad ?? suggestedTotalLoad ?? null;

  if (resolvedLoad === null) {
    return {
      loadValue: null,
      reps: set?.reps ?? DEFAULT_SUGGESTED_REPS,
    };
  }

  return {
    loadValue: resolvedLoad,
    reps: set?.reps ?? DEFAULT_SUGGESTED_REPS,
  };
};

const resolveSetTrackingMode = (
  persistedExercise: ActiveWorkoutResponse["workout"]["exercises"][number],
): SetTrackingMode => {
  if (persistedExercise.set_tracking_mode === "UNILATERAL") {
    return "UNILATERAL";
  }

  if (persistedExercise.set_tracking_mode === "BILATERAL") {
    return "BILATERAL";
  }

  const suggestedSide = normalizeSetSide(persistedExercise.suggested_set?.set_side);
  if (suggestedSide === "LEFT" || suggestedSide === "RIGHT") {
    return "UNILATERAL";
  }

  const hasUnilateralSetEntry = persistedExercise.completed_sets.some((set) => {
    const setSide = normalizeSetSide(set.set_side);
    return setSide === "LEFT" || setSide === "RIGHT";
  });
  return hasUnilateralSetEntry ? "UNILATERAL" : "BILATERAL";
};

const resolveCurrentSetProgress = (
  trackingMode: SetTrackingMode,
  persistedExercise: ActiveWorkoutResponse["workout"]["exercises"][number],
): { currentSetIndex: number; currentSetSide: SetSide } => {
  const suggestedSetIndex =
    typeof persistedExercise.suggested_set?.set_index === "number" &&
    persistedExercise.suggested_set.set_index > 0
      ? persistedExercise.suggested_set.set_index
      : null;
  const suggestedSetSide = normalizeSetSide(persistedExercise.suggested_set?.set_side);

  if (trackingMode === "UNILATERAL") {
    if (
      suggestedSetIndex !== null &&
      (suggestedSetSide === "LEFT" || suggestedSetSide === "RIGHT")
    ) {
      return {
        currentSetIndex: suggestedSetIndex,
        currentSetSide: suggestedSetSide,
      };
    }
  } else if (suggestedSetIndex !== null) {
    return {
      currentSetIndex: suggestedSetIndex,
      currentSetSide: "BILATERAL",
    };
  }

  const maxSetIndex = persistedExercise.completed_sets.reduce(
    (max, set) => (set.set_index > max ? set.set_index : max),
    0,
  );

  if (trackingMode !== "UNILATERAL") {
    return {
      currentSetIndex: Math.max(1, maxSetIndex + 1),
      currentSetSide: "BILATERAL",
    };
  }

  const maxIndexSetEntries = persistedExercise.completed_sets.filter((set) => set.set_index === maxSetIndex);
  const hasLeftForMaxIndex = maxIndexSetEntries.some((set) => normalizeSetSide(set.set_side) === "LEFT");
  const hasRightForMaxIndex = maxIndexSetEntries.some((set) => normalizeSetSide(set.set_side) === "RIGHT");
  if (maxSetIndex > 0 && hasLeftForMaxIndex && !hasRightForMaxIndex) {
    return {
      currentSetIndex: maxSetIndex,
      currentSetSide: "RIGHT",
    };
  }

  return {
    currentSetIndex: Math.max(1, maxSetIndex + 1),
    currentSetSide: "LEFT",
  };
};

export const formatLoadInputValue = (loadValue: number | null): string => {
  return formatLoadInputDisplay(loadValue);
};

const toDraftSetInput = (set: WorkoutSetDraft): WorkoutSetDraftInput => ({
  loadValue: formatLoadInputValue(set.loadValue),
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
    skippedAt: exercise.skippedAt ?? null,
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
  loadInputMode: LoadInputMode;
  isFallbackOptionConfirmed: boolean;
} => {
  if (exercise.fallbackOptions.length === 0) {
    return {
      selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: normalizeStationId(persistedExercise.selected_station_id),
      selectedStationProfileLoadsKg: exercise.selectedStationProfileLoadsKg,
      loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode),
      isFallbackOptionConfirmed: true,
    };
  }

  const persistedSelectedOption =
    persistedExercise.selected_plan_exercise_option_id === null
      ? null
      : exercise.fallbackOptions.find(
          (option) =>
            option.id === persistedExercise.selected_plan_exercise_option_id &&
            option.station_id === persistedExercise.selected_station_id,
        ) ??
        exercise.fallbackOptions.find(
          (option) => option.id === persistedExercise.selected_plan_exercise_option_id,
        ) ?? null;

  if (persistedSelectedOption) {
    return {
      selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: normalizeStationId(persistedExercise.selected_station_id),
      selectedStationProfileLoadsKg: [...(persistedSelectedOption.station_profile_loads_kg ?? [])],
      loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode),
      isFallbackOptionConfirmed:
        exercise.fallbackOptions.length === 1
          ? true
          : exercise.isFallbackOptionConfirmed,
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
      loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode),
      isFallbackOptionConfirmed: exercise.isFallbackOptionConfirmed,
    };
  }

  return {
    selectedPlanExerciseOptionId: fallbackOption.id,
    selectedVariantId: fallbackOption.variant_id,
    selectedStationId: normalizeStationId(fallbackOption.station_id),
    selectedStationProfileLoadsKg: [...(fallbackOption.station_profile_loads_kg ?? [])],
    loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode ?? fallbackOption.load_input_mode),
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
    .map((exerciseOptions): ExerciseStep => {
      const selectedOption = exerciseOptions[0];
      if (!selectedOption) {
        throw new Error("Selected training plan has no available exercises for this gym");
      }
      const suggestedSet = suggestStartSetForOption(selectedOption);
      const selectedStationId = isStationlessOption(selectedOption) ? null : selectedOption.station_id;
      const selectedStationProfileLoadsKg = isStationlessOption(selectedOption)
        ? []
        : [...(selectedOption.station_profile_loads_kg ?? [])];

      return {
        trainingPlanExerciseId: selectedOption.training_plan_exercise_id,
        name: selectedOption.exercise_name,
        fallbackOptions: exerciseOptions.map((option) => ({ ...option })),
        selectedPlanExerciseOptionId: selectedOption.id,
        selectedVariantId: selectedOption.variant_id,
        selectedStationId,
        selectedStationProfileLoadsKg,
        loadInputMode: normalizeLoadInputMode(selectedOption.load_input_mode),
        setTrackingMode: "BILATERAL",
        isFallbackOptionConfirmed: exerciseOptions.length === 1,
        skippedAt: null,
        suggestedSet,
        activeSet: { ...suggestedSet },
        activeSetInput: toDraftSetInput(suggestedSet),
        completedSets: [],
        currentSetIndex: 1,
        currentSetSide: "BILATERAL",
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
  selectedOptionSelection: string | null,
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
    selectedOptionSelection === null
      ? exercise.fallbackOptions.length === 1
        ? exercise.fallbackOptions[0]
        : null
      : exercise.fallbackOptions.find(
          (option) => optionSelectionKey(option) === selectedOptionSelection,
        ) ??
        // Backward-compatible fallback for callers still passing plain option id.
        exercise.fallbackOptions.find((option) => option.id === selectedOptionSelection) ??
        null;

  if (!selectedOption) {
    return nextPlan;
  }

  if (
    selectedOptionSelectionKey(exercise.selectedPlanExerciseOptionId, exercise.selectedStationId) ===
      optionSelectionKey(selectedOption) &&
    exercise.selectedVariantId === selectedOption.variant_id
  ) {
    return nextPlan;
  }

  exercise.selectedPlanExerciseOptionId = selectedOption.id;
  exercise.selectedVariantId = selectedOption.variant_id;
  exercise.selectedStationId = isStationlessOption(selectedOption) ? null : selectedOption.station_id;
  exercise.selectedStationProfileLoadsKg = isStationlessOption(selectedOption)
    ? []
    : [...(selectedOption.station_profile_loads_kg ?? [])];
  exercise.loadInputMode = normalizeLoadInputMode(selectedOption.load_input_mode);
  exercise.setTrackingMode = "BILATERAL";
  exercise.isFallbackOptionConfirmed = exercise.fallbackOptions.length === 1;
  const suggestedSet = suggestStartSetForOption(selectedOption);
  exercise.suggestedSet = suggestedSet;
  exercise.activeSet = { ...suggestedSet };
  exercise.activeSetInput = toDraftSetInput(suggestedSet);
  exercise.currentSetIndex = 1;
  exercise.currentSetSide = "BILATERAL";

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
    .map((exercise): ExerciseStep => ({
      trainingPlanExerciseId: exercise.training_plan_exercise_id,
      name: exercise.exercise_name,
      fallbackOptions: [],
      selectedPlanExerciseOptionId: null,
      selectedVariantId: null,
      selectedStationId: null,
      selectedStationProfileLoadsKg: [],
      loadInputMode: "TOTAL",
      setTrackingMode: "BILATERAL",
      isFallbackOptionConfirmed: true,
      skippedAt: null,
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
      currentSetIndex: 1,
      currentSetSide: "BILATERAL",
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

  const setTrackingMode = normalizeSetTrackingMode(exercise.setTrackingMode);
  const currentSetIndex = exercise.currentSetIndex ?? exercise.completedSets.length + 1;
  const currentSetSide =
    setTrackingMode === "UNILATERAL"
      ? exercise.currentSetSide === "RIGHT"
        ? "RIGHT"
        : "LEFT"
      : "BILATERAL";

  exercise.completedSets.push({
    setIndex: currentSetIndex,
    setSide: currentSetSide,
    loadValue: normalizeLoadForSelectionAndProfile(
      toCanonicalTotalLoadValue(exercise.activeSet.loadValue, exercise.loadInputMode),
      exercise.selectedPlanExerciseOptionId,
      exercise.selectedStationId,
      exercise.selectedStationProfileLoadsKg,
    ),
    reps: exercise.activeSet.reps,
  });
  exercise.setTrackingMode = setTrackingMode;
  if (setTrackingMode === "UNILATERAL") {
    if (currentSetSide === "LEFT") {
      exercise.currentSetIndex = currentSetIndex;
      exercise.currentSetSide = "RIGHT";
    } else {
      exercise.currentSetIndex = currentSetIndex + 1;
      exercise.currentSetSide = "LEFT";
    }
  } else {
    exercise.currentSetIndex = currentSetIndex + 1;
    exercise.currentSetSide = "BILATERAL";
  }
  exercise.skippedAt = null;

  return nextPlan;
};

export const withExerciseMarkedSkipped = (
  plan: WorkoutPlan,
  exerciseIndex: number,
  skippedAt: string,
): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(plan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise) {
    return nextPlan;
  }

  exercise.skippedAt = skippedAt;

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
      load_value: normalizeLoadForSelectionAndProfile(
        toCanonicalTotalLoadValue(exercise.activeSet.loadValue, exercise.loadInputMode),
        exercise.selectedPlanExerciseOptionId,
        exercise.selectedStationId,
        exercise.selectedStationProfileLoadsKg,
      ),
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
    exercise.completedSets.length > 0 ||
    exercise.skippedAt !== null ||
    options.includeExercisePositions?.includes(index + 1)
      ? [
          {
            training_plan_exercise_id: exercise.trainingPlanExerciseId,
            position: index + 1,
            selected_plan_exercise_option_id: exercise.selectedPlanExerciseOptionId,
            selected_variant_id: exercise.selectedVariantId,
            load_input_mode: normalizeLoadInputMode(exercise.loadInputMode),
            set_tracking_mode: normalizeSetTrackingMode(exercise.setTrackingMode),
            selected_station_id: exercise.selectedStationId,
            skipped_at: exercise.skippedAt ?? null,
            completed_sets: exercise.completedSets.map((set) => ({
              set_index: set.setIndex,
              set_side:
                normalizeSetSide(set.setSide) ??
                (normalizeSetTrackingMode(exercise.setTrackingMode) === "UNILATERAL"
                  ? "LEFT"
                  : "BILATERAL"),
              load_value: normalizeLoadForSelectionAndProfile(
                set.loadValue,
                exercise.selectedPlanExerciseOptionId,
                exercise.selectedStationId,
                exercise.selectedStationProfileLoadsKg,
              ),
              load_value_per_side:
                normalizeLoadInputMode(exercise.loadInputMode) === "PER_SIDE"
                  ? toInputLoadValue(set.loadValue, "PER_SIDE")
                  : null,
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

      const selection = resolvePersistedExerciseSelection(exercise, persistedExercise);
      const suggestedSet = toDraftSet(persistedExercise.suggested_set);
      const activeSet = { ...suggestedSet };
      const trackingMode = resolveSetTrackingMode(persistedExercise);
      const currentSetProgress = resolveCurrentSetProgress(trackingMode, persistedExercise);

      return {
        trainingPlanExerciseId: persistedExercise.training_plan_exercise_id,
        name: persistedExercise.exercise_name,
        fallbackOptions: exercise.fallbackOptions,
        selectedPlanExerciseOptionId: selection.selectedPlanExerciseOptionId,
        selectedVariantId: selection.selectedVariantId,
        selectedStationId: selection.selectedStationId,
        selectedStationProfileLoadsKg: selection.selectedStationProfileLoadsKg,
        loadInputMode: selection.loadInputMode,
        setTrackingMode: trackingMode,
        isFallbackOptionConfirmed: selection.isFallbackOptionConfirmed,
        skippedAt: persistedExercise.skipped_at,
        suggestedSet,
        completedSets: persistedExercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          setSide: normalizeSetSide(set.set_side) ?? (trackingMode === "UNILATERAL" ? "LEFT" : "BILATERAL"),
          loadValue: normalizeLoadForSelectionAndProfile(
            set.load_value,
            selection.selectedPlanExerciseOptionId,
            selection.selectedStationId,
            selection.selectedStationProfileLoadsKg,
          ),
          reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
        })),
        activeSet,
        activeSetInput: toDraftSetInput(activeSet),
        currentSetIndex: currentSetProgress.currentSetIndex,
        currentSetSide: currentSetProgress.currentSetSide,
        isReadOnly: exercise.isReadOnly,
      };
    }),
  };
};

export const normalizeExerciseActiveSet = (
  exerciseStep: ExerciseStep,
  mode: "configured-gym" | "free-mode",
): void => {
  const loadInputMode = normalizeLoadInputMode(exerciseStep.loadInputMode);
  const isStationlessSelectedOption =
    exerciseStep.selectedPlanExerciseOptionId !== null && exerciseStep.selectedStationId === null;
  const fallbackLoadValue = exerciseStep.activeSet.loadValue ?? DEFAULT_SUGGESTED_LOAD_KG;
  const parsedLoadValue = parseNormalizedNumber(exerciseStep.activeSetInput.loadValue, fallbackLoadValue);
  const normalizedLoadValue =
    isStationlessSelectedOption
      ? null
      : mode === "configured-gym"
        ? (findRoundedCanonicalProfileLoad(
            exerciseStep.selectedStationProfileLoadsKg,
            parsedLoadValue,
            LOAD_DISPLAY_ROUNDING_TOLERANCE + FLOAT_TOLERANCE,
          ) ?? parsedLoadValue)
        : parsedLoadValue;
  const normalizedRepsValue = Math.max(
    MIN_REPS,
    parseNormalizedNumber(exerciseStep.activeSetInput.reps, exerciseStep.activeSet.reps),
  );

  exerciseStep.activeSet.loadValue = normalizedLoadValue;
  exerciseStep.activeSet.reps = normalizedRepsValue;
  exerciseStep.activeSetInput.loadValue = formatLoadInputValue(normalizedLoadValue);
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
        loadInputMode: normalizeLoadInputMode(exercise.load_input_mode),
        setTrackingMode: resolveSetTrackingMode(exercise),
        isFallbackOptionConfirmed: true,
        skippedAt: exercise.skipped_at,
        suggestedSet,
        completedSets: exercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          setSide:
            normalizeSetSide(set.set_side) ??
            (resolveSetTrackingMode(exercise) === "UNILATERAL" ? "LEFT" : "BILATERAL"),
          loadValue: set.load_value,
          reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
        })),
        activeSet,
        activeSetInput: toDraftSetInput(activeSet),
        ...resolveCurrentSetProgress(resolveSetTrackingMode(exercise), exercise),
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
  !hasCompletedSets(exerciseStep);

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
  response.workout.exercises.filter(
    (exercise) => exercise.completed_sets.length > 0 || exercise.skipped_at !== null,
  ).length;
