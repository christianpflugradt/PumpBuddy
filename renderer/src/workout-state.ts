import type {
  CompletedExerciseSet,
  ExerciseStep,
  StartScreenState,
  ViewState,
  WorkoutPlan,
} from "./workout-types";
import {
  DEFAULT_SUGGESTED_LOAD_KG,
  FLOAT_TOLERANCE,
  LOAD_DISPLAY_ROUNDING_TOLERANCE,
  MIN_REPS,
  findRoundedCanonicalProfileLoad,
  formatLoadInputValue,
  isStationlessOption,
  normalizeLoadForSelectionAndProfile,
  normalizeLoadInputMode,
  normalizeRepetitionKind,
  normalizeSetTrackingMode,
  optionSelectionKey,
  stepWithinProfileLoads,
  stepWithinProfileLoadsForInputMode,
  suggestStartSetForOption,
  toCanonicalTotalLoadValue,
  toDraftSetInput,
} from "./workout-plan-core";

export {
  formatLoadInputValue,
  optionSelectionKey,
  stepWithinProfileLoads,
  stepWithinProfileLoadsForInputMode,
};

const selectedOptionSelectionKey = (
  selectedTrainingPlanExerciseVariantId: string | null,
  selectedStationId: string | null,
): string | null =>
  selectedTrainingPlanExerciseVariantId === null
    ? null
    : `${selectedTrainingPlanExerciseVariantId}::${selectedStationId ?? ""}`;

export const isDigitsOnly = (value: string): boolean => /^[0-9]+$/.test(value);

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
  (startScreen.selectedWorkoutMode === "free-mode" ||
    startScreen.selectedGymId.length > 0) &&
  startScreen.errorMessage === null &&
  startScreen.blockedStartModal === null;

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
          exercise.fallbackOptions.find(
            (option) => option.id === selectedOptionSelection,
          ) ??
          null;

  if (!selectedOption) {
    return nextPlan;
  }

  if (
    selectedOptionSelectionKey(
      exercise.selectedTrainingPlanExerciseVariantId,
      exercise.selectedStationId,
    ) === optionSelectionKey(selectedOption) &&
    exercise.selectedVariantId === selectedOption.variant_id
  ) {
    return nextPlan;
  }

  exercise.selectedTrainingPlanExerciseVariantId = selectedOption.id;
  exercise.selectedVariantId = selectedOption.variant_id;
  exercise.selectedStationId = isStationlessOption(selectedOption)
    ? null
    : selectedOption.station_id;
  exercise.selectedStationProfileLoadsKg = isStationlessOption(selectedOption)
    ? []
    : [...(selectedOption.station_profile_loads_kg ?? [])];
  exercise.loadInputMode = normalizeLoadInputMode(selectedOption.load_input_mode);
  exercise.repetitionKind = normalizeRepetitionKind(selectedOption.repetition_kind);
  exercise.setTrackingMode = normalizeSetTrackingMode(
    selectedOption.set_tracking_mode,
  );
  exercise.isFallbackOptionConfirmed = exercise.fallbackOptions.length === 1;
  const suggestedSet = suggestStartSetForOption(selectedOption);
  exercise.suggestedSet = suggestedSet;
  exercise.activeSet = { ...suggestedSet };
  exercise.activeSetInput = toDraftSetInput(suggestedSet);
  exercise.currentSetIndex = 1;
  exercise.currentSetSide =
    exercise.setTrackingMode === "UNILATERAL" ? "LEFT" : "BILATERAL";
  exercise.isSecsTimerRunning = false;

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

  if (!exercise.selectedTrainingPlanExerciseVariantId) {
    return nextPlan;
  }

  exercise.isFallbackOptionConfirmed = true;

  return nextPlan;
};

export const canReopenFallbackOptionSelection = (exercise: ExerciseStep): boolean =>
  exercise.fallbackOptions.length > 1 &&
  exercise.isFallbackOptionConfirmed &&
  exercise.completedSets.length === 0 &&
  exercise.selectedTrainingPlanExerciseVariantId !== null;

export const withFallbackOptionSelectionReopened = (
  workoutPlan: WorkoutPlan,
  exerciseIndex: number,
): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(workoutPlan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise || !canReopenFallbackOptionSelection(exercise)) {
    return nextPlan;
  }

  exercise.isFallbackOptionConfirmed = false;
  exercise.isSecsTimerRunning = false;

  return nextPlan;
};

export const canReopenPreviousExercise = (
  workoutPlan: WorkoutPlan,
  exerciseIndex: number,
): boolean => {
  if (exerciseIndex <= 0) {
    return false;
  }

  const currentExercise = workoutPlan.exercises[exerciseIndex];
  const previousExercise = workoutPlan.exercises[exerciseIndex - 1];
  const previousExerciseHasPersistedProgress =
    !!previousExercise &&
    (previousExercise.completedSets.length > 0 || previousExercise.skippedAt !== null);

  return !!currentExercise &&
    !!previousExercise &&
    !currentExercise.isReadOnly &&
    currentExercise.completedSets.length === 0 &&
    currentExercise.skippedAt == null &&
    previousExerciseHasPersistedProgress;
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

export const withCurrentSetCompleted = (
  plan: WorkoutPlan,
  exerciseIndex: number,
): WorkoutPlan => {
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
      exercise.selectedTrainingPlanExerciseVariantId,
      exercise.selectedStationId,
      exercise.selectedStationProfileLoadsKg,
    ),
    reps: exercise.activeSet.reps,
  });
  exercise.isSecsTimerRunning = false;
  if (exercise.repetitionKind === "SECS") {
    exercise.activeSet.reps = 0;
    exercise.activeSetInput.reps = "0";
  }
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

export const withLatestCompletedSetRemoved = (
  plan: WorkoutPlan,
  exerciseIndex: number,
): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(plan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise || exercise.completedSets.length === 0) {
    return nextPlan;
  }

  const setTrackingMode = normalizeSetTrackingMode(exercise.setTrackingMode);
  if (setTrackingMode === "UNILATERAL") {
    const latestSetIndex = exercise.completedSets.reduce(
      (max, set) => Math.max(max, set.setIndex),
      0,
    );
    exercise.completedSets = exercise.completedSets.filter(
      (set) => set.setIndex !== latestSetIndex,
    );

    const latestRemainingSet = exercise.completedSets.reduce<CompletedExerciseSet | null>(
      (latest, set) => {
        if (!latest) {
          return set;
        }

        if (set.setIndex > latest.setIndex) {
          return set;
        }

        if (
          set.setIndex === latest.setIndex &&
          set.setSide === "RIGHT" &&
          latest.setSide !== "RIGHT"
        ) {
          return set;
        }

        return latest;
      },
      null,
    );

    if (!latestRemainingSet) {
      exercise.currentSetIndex = 1;
      exercise.currentSetSide = "LEFT";
    } else if (latestRemainingSet.setSide === "LEFT") {
      exercise.currentSetIndex = latestRemainingSet.setIndex;
      exercise.currentSetSide = "RIGHT";
    } else {
      exercise.currentSetIndex = latestRemainingSet.setIndex + 1;
      exercise.currentSetSide = "LEFT";
    }
  } else {
    exercise.completedSets = exercise.completedSets.slice(0, -1);
    const latestRemainingSet =
      exercise.completedSets[exercise.completedSets.length - 1];
    exercise.currentSetIndex = latestRemainingSet ? latestRemainingSet.setIndex + 1 : 1;
    exercise.currentSetSide = "BILATERAL";
  }

  exercise.isSecsTimerRunning = false;
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

export const normalizeExerciseActiveSet = (
  exerciseStep: ExerciseStep,
  mode: "configured-gym" | "free-mode",
): void => {
  const isStationlessSelectedOption =
    exerciseStep.selectedTrainingPlanExerciseVariantId !== null &&
    exerciseStep.selectedStationId === null;
  const fallbackLoadValue =
    exerciseStep.activeSet.loadValue ?? DEFAULT_SUGGESTED_LOAD_KG;
  const parsedLoadValue = parseNormalizedNumber(
    exerciseStep.activeSetInput.loadValue,
    fallbackLoadValue,
  );
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
    exerciseStep.repetitionKind === "SECS" ? 0 : MIN_REPS,
    parseNormalizedNumber(exerciseStep.activeSetInput.reps, exerciseStep.activeSet.reps),
  );

  exerciseStep.activeSet.loadValue = normalizedLoadValue;
  exerciseStep.activeSet.reps = normalizedRepsValue;
  exerciseStep.activeSetInput.loadValue = formatLoadInputValue(normalizedLoadValue);
  exerciseStep.activeSetInput.reps = String(normalizedRepsValue);
};

export const hasCompletedSets = (exerciseStep: ExerciseStep): boolean =>
  exerciseStep.completedSets.length > 0;

export const isDraftModified = (exerciseStep: ExerciseStep): boolean =>
  exerciseStep.activeSet.loadValue !== exerciseStep.suggestedSet.loadValue ||
  exerciseStep.activeSet.reps !== exerciseStep.suggestedSet.reps;

export const shouldConfirmForwardNavigation = (
  exerciseStep: ExerciseStep,
): boolean => !hasCompletedSets(exerciseStep);

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
