import type {
  ExerciseStep,
  LoadInputMode,
  RepetitionKind,
  SetSide,
  SetTrackingMode,
  WorkoutPlan,
  WorkoutSetDraft,
} from "./workout-types";
import type {
  ActiveWorkoutProgressPayload,
  ActiveWorkoutResponse,
  BlockedStartModalState,
  CreateWorkoutRequest,
  ErrorResponse,
  GymSummary,
  MissingExerciseDetail,
  PlanExerciseOptionSummary,
  TrainingPlanDetailResponse,
  TrainingPlanExerciseVariantsResponse,
  TrainingPlanSummary,
} from "./workout-contract";
import {
  DEFAULT_SUGGESTED_LOAD_KG,
  DEFAULT_SUGGESTED_REPS,
  DEFAULT_SUGGESTED_SECS,
  isStationlessOption,
  normalizeLoadForSelectionAndProfile,
  normalizeLoadInputMode,
  normalizeRepetitionKind,
  normalizeSetSide,
  normalizeSetTrackingMode,
  normalizeStationId,
  suggestStartSetForOption,
  toCanonicalTotalLoadValue,
  toDraftSetInput,
  toInputLoadValue,
} from "./workout-plan-core";

const toDraftSet = (
  set: ActiveWorkoutResponse["workout"]["exercises"][number]["suggested_set"],
  repetitionKind: RepetitionKind,
): WorkoutSetDraft => {
  const suggestedRepetitionValue =
    typeof set?.repetition_value === "number" ? set.repetition_value : null;
  const suggestedInputLoad = set?.suggested_load_input_kg;
  const suggestedTotalLoad = set?.suggested_load_total_kg ?? set?.load_value;
  const resolvedLoad = suggestedInputLoad ?? suggestedTotalLoad ?? null;
  const resolvedReps =
    suggestedRepetitionValue ??
    (repetitionKind === "SECS" ? DEFAULT_SUGGESTED_SECS : DEFAULT_SUGGESTED_REPS);

  if (resolvedLoad === null) {
    return {
      loadValue: null,
      reps: resolvedReps,
    };
  }

  return {
    loadValue: resolvedLoad,
    reps: resolvedReps,
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

  return "BILATERAL";
};

const resolveCurrentSetProgress = (
  trackingMode: SetTrackingMode,
  persistedExercise: ActiveWorkoutResponse["workout"]["exercises"][number],
): { currentSetIndex: number; currentSetSide: SetSide } => {
  const backendNextSetIndex =
    typeof persistedExercise.next_set?.set_index === "number" &&
    persistedExercise.next_set.set_index > 0
      ? persistedExercise.next_set.set_index
      : null;
  const backendNextSetSide = normalizeSetSide(persistedExercise.next_set?.set_side);

  if (backendNextSetIndex !== null) {
    if (
      trackingMode === "UNILATERAL" &&
      (backendNextSetSide === "LEFT" || backendNextSetSide === "RIGHT")
    ) {
      return {
        currentSetIndex: backendNextSetIndex,
        currentSetSide: backendNextSetSide,
      };
    }

    if (trackingMode === "BILATERAL") {
      return {
        currentSetIndex: backendNextSetIndex,
        currentSetSide: "BILATERAL",
      };
    }
  }

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

  if (trackingMode === "UNILATERAL") {
    return {
      currentSetIndex: 1,
      currentSetSide: "LEFT",
    };
  }

  return {
    currentSetIndex: 1,
    currentSetSide: "BILATERAL",
  };
};

const resolvePersistedRepetitionKind = (
  persistedExercise: ActiveWorkoutResponse["workout"]["exercises"][number],
  fallback: RepetitionKind,
): RepetitionKind => {
  if (persistedExercise.suggested_set?.repetition_kind === "SECS") {
    return "SECS";
  }

  if (persistedExercise.suggested_set?.repetition_kind === "REPS") {
    return "REPS";
  }

  for (const set of persistedExercise.completed_sets) {
    if (set.repetition_kind === "SECS") {
      return "SECS";
    }
    if (set.repetition_kind === "REPS") {
      return "REPS";
    }
  }

  return fallback;
};

const resolvePersistedSetReps = (
  set: ActiveWorkoutResponse["workout"]["exercises"][number]["completed_sets"][number],
  repetitionKind: RepetitionKind,
): number => {
  const persistedKind = normalizeRepetitionKind(set.repetition_kind);
  if (persistedKind === repetitionKind && typeof set.repetition_value === "number") {
    return set.repetition_value;
  }

  return repetitionKind === "SECS" ? DEFAULT_SUGGESTED_SECS : DEFAULT_SUGGESTED_REPS;
};

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
  selectedTrainingPlanExerciseVariantId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  selectedStationProfileLoadsKg: number[];
  loadInputMode: LoadInputMode;
  isFallbackOptionConfirmed: boolean;
} => {
  const isSelectionConfirmedFromPersistedProgress =
    exercise.isFallbackOptionConfirmed ||
    persistedExercise.completed_sets.length > 0 ||
    persistedExercise.skipped_at != null ||
    persistedExercise.completed_at != null;

  if (exercise.fallbackOptions.length === 0) {
    return {
      selectedTrainingPlanExerciseVariantId:
        persistedExercise.selected_training_plan_exercise_variant_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: normalizeStationId(persistedExercise.selected_station_id),
      selectedStationProfileLoadsKg: exercise.selectedStationProfileLoadsKg,
      loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode),
      isFallbackOptionConfirmed: true,
    };
  }

  const persistedSelectedOption =
    persistedExercise.selected_training_plan_exercise_variant_id === null
      ? null
      : exercise.fallbackOptions.find(
            (option) =>
              option.id ===
                persistedExercise.selected_training_plan_exercise_variant_id &&
              option.station_id === persistedExercise.selected_station_id,
          ) ??
          exercise.fallbackOptions.find(
            (option) =>
              option.id ===
              persistedExercise.selected_training_plan_exercise_variant_id,
          ) ??
          null;

  if (persistedSelectedOption) {
    return {
      selectedTrainingPlanExerciseVariantId:
        persistedExercise.selected_training_plan_exercise_variant_id,
      selectedVariantId: persistedExercise.selected_variant_id,
      selectedStationId: normalizeStationId(persistedExercise.selected_station_id),
      selectedStationProfileLoadsKg: [
        ...(persistedSelectedOption.station_profile_loads_kg ?? []),
      ],
      loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode),
      isFallbackOptionConfirmed:
        exercise.fallbackOptions.length === 1
          ? true
          : isSelectionConfirmedFromPersistedProgress,
    };
  }

  const currentSelectedOption =
    exercise.selectedTrainingPlanExerciseVariantId === null
      ? null
      : exercise.fallbackOptions.find(
            (option) => option.id === exercise.selectedTrainingPlanExerciseVariantId,
          ) ?? null;
  const fallbackOption =
    currentSelectedOption ??
    selectBackendDefaultFallbackOption(exercise.fallbackOptions) ??
    exercise.fallbackOptions[0] ??
    null;

  if (!fallbackOption) {
    return {
      selectedTrainingPlanExerciseVariantId: null,
      selectedVariantId: null,
      selectedStationId: null,
      selectedStationProfileLoadsKg: exercise.selectedStationProfileLoadsKg,
      loadInputMode: normalizeLoadInputMode(persistedExercise.load_input_mode),
      isFallbackOptionConfirmed: exercise.isFallbackOptionConfirmed,
    };
  }

  return {
    selectedTrainingPlanExerciseVariantId: fallbackOption.id,
    selectedVariantId: fallbackOption.variant_id,
    selectedStationId: normalizeStationId(fallbackOption.station_id),
    selectedStationProfileLoadsKg: [...(fallbackOption.station_profile_loads_kg ?? [])],
    loadInputMode: normalizeLoadInputMode(
      persistedExercise.load_input_mode ?? fallbackOption.load_input_mode,
    ),
    isFallbackOptionConfirmed:
      exercise.fallbackOptions.length === 1
        ? true
        : isSelectionConfirmedFromPersistedProgress,
  };
};

const compareMissingExercises = (
  left: MissingExerciseDetail,
  right: MissingExerciseDetail,
): number => {
  if (left.exercise_position !== right.exercise_position) {
    return left.exercise_position - right.exercise_position;
  }

  const exerciseNameCompare = left.exercise_name.localeCompare(right.exercise_name);
  if (exerciseNameCompare !== 0) {
    return exerciseNameCompare;
  }

  return left.reason.localeCompare(right.reason);
};

const normalizeBlockedStartMissingExercises = (
  missingExercises: MissingExerciseDetail[],
): MissingExerciseDetail[] => [...missingExercises].sort(compareMissingExercises);

export const buildBlockedStartModalState = (
  error: unknown,
  selectedPlanName: string,
  selectedGymName: string,
): BlockedStartModalState | null => {
  const maybeStatus =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : null;
  if (maybeStatus !== 400) {
    return null;
  }

  const errorBody =
    typeof error === "object" && error !== null && "body" in error
      ? ((error as { body?: unknown }).body as ErrorResponse | null)
      : null;
  const missingExercises = errorBody?.details?.missing_exercises;
  if (!missingExercises || missingExercises.length === 0) {
    return null;
  }

  return {
    message:
      errorBody?.message ??
      "Configured-gym workout start requires realizable exercise_variants for every plan exercise",
    trainingPlanName: selectedPlanName,
    gymName: selectedGymName,
    missingExercises: normalizeBlockedStartMissingExercises(missingExercises),
  };
};

const toCompletionRecencyScore = (lastCompletedAt: string | null | undefined): number => {
  if (typeof lastCompletedAt !== "string" || lastCompletedAt.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsedTimestamp = Date.parse(lastCompletedAt);
  return Number.isNaN(parsedTimestamp) ? Number.NEGATIVE_INFINITY : parsedTimestamp;
};

const selectBackendDefaultFallbackOption = (
  exerciseOptions: PlanExerciseOptionSummary[],
): PlanExerciseOptionSummary | null => {
  const rankedOptions = exerciseOptions
    .filter(
      (option) =>
        typeof option.fallback_selection_rank === "number" &&
        Number.isFinite(option.fallback_selection_rank) &&
        option.fallback_selection_rank >= 1,
    )
    .sort((left, right) => left.fallback_selection_rank! - right.fallback_selection_rank!);

  return rankedOptions[0] ?? null;
};

const selectMostRecentFallbackOption = (
  exerciseOptions: PlanExerciseOptionSummary[],
): PlanExerciseOptionSummary | null => {
  const firstOption = exerciseOptions[0];
  if (!firstOption) {
    return null;
  }

  let selectedOption = firstOption;
  let selectedRecencyScore = toCompletionRecencyScore(firstOption.last_completed_at);

  for (const candidateOption of exerciseOptions.slice(1)) {
    const candidateRecencyScore = toCompletionRecencyScore(candidateOption.last_completed_at);
    if (candidateRecencyScore > selectedRecencyScore) {
      selectedOption = candidateOption;
      selectedRecencyScore = candidateRecencyScore;
    }
  }

  return selectedOption;
};

export const selectDefaultTrainingPlanId = (
  trainingPlans: TrainingPlanSummary[],
): string => {
  const rankedPlans = trainingPlans
    .filter(
      (plan) =>
        typeof plan.start_selection_rank === "number" &&
        Number.isFinite(plan.start_selection_rank) &&
        plan.start_selection_rank >= 1,
    )
    .sort((left, right) => left.start_selection_rank! - right.start_selection_rank!);
  const rankedDefaultPlan = rankedPlans[0];

  if (rankedDefaultPlan) {
    return rankedDefaultPlan.id;
  }

  const firstPlan = trainingPlans[0];
  if (!firstPlan) {
    return "";
  }

  let selectedPlan = firstPlan;
  let selectedRecencyScore = toCompletionRecencyScore(firstPlan.last_completed_at);

  for (const candidatePlan of trainingPlans.slice(1)) {
    const candidateRecencyScore = toCompletionRecencyScore(candidatePlan.last_completed_at);
    if (candidateRecencyScore < selectedRecencyScore) {
      selectedPlan = candidatePlan;
      selectedRecencyScore = candidateRecencyScore;
    }
  }

  return selectedPlan.id;
};

export const selectDefaultGymId = (
  gyms: GymSummary[],
  favoriteGymId: string | null | undefined,
): string => {
  if (typeof favoriteGymId === "string" && favoriteGymId.length > 0) {
    const favoriteGymMatch = gyms.find((gym) => gym.id === favoriteGymId);
    if (favoriteGymMatch) {
      return favoriteGymMatch.id;
    }
  }

  return gyms[0]?.id ?? "";
};

export const buildWorkoutPlan = (
  selectedPlan: TrainingPlanSummary,
  optionsResponse: TrainingPlanExerciseVariantsResponse,
): WorkoutPlan => {
  const optionsByExercise = new Map<string, PlanExerciseOptionSummary[]>();
  const exerciseVariants = optionsResponse.exercise_variants ?? optionsResponse.options ?? [];

  for (const option of exerciseVariants.filter(isRealizableOption)) {
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
    .sort(
      (left, right) => (left[0]?.exercise_position ?? 0) - (right[0]?.exercise_position ?? 0),
    )
    .map((exerciseOptions): ExerciseStep => {
      const selectedOption =
        selectBackendDefaultFallbackOption(exerciseOptions) ??
        selectMostRecentFallbackOption(exerciseOptions);
      if (!selectedOption) {
        throw new Error("Selected training plan has no available exercises for this gym");
      }
      const suggestedSet = suggestStartSetForOption(selectedOption);
      const selectedStationId = isStationlessOption(selectedOption)
        ? null
        : selectedOption.station_id;
      const selectedStationProfileLoadsKg = isStationlessOption(selectedOption)
        ? []
        : [...(selectedOption.station_profile_loads_kg ?? [])];
      const setTrackingMode = normalizeSetTrackingMode(selectedOption.set_tracking_mode);

      return {
        trainingPlanExerciseId: selectedOption.training_plan_exercise_id,
        name: selectedOption.exercise_name,
        fallbackOptions: exerciseOptions.map((option) => ({ ...option })),
        selectedTrainingPlanExerciseVariantId: selectedOption.id,
        selectedVariantId: selectedOption.variant_id,
        selectedStationId,
        selectedStationProfileLoadsKg,
        loadInputMode: normalizeLoadInputMode(selectedOption.load_input_mode),
        repetitionKind: normalizeRepetitionKind(selectedOption.repetition_kind),
        setTrackingMode,
        isFallbackOptionConfirmed: exerciseOptions.length === 1,
        skippedAt: null,
        suggestedSet,
        activeSet: { ...suggestedSet },
        activeSetInput: toDraftSetInput(suggestedSet),
        completedSets: [],
        currentSetIndex: 1,
        currentSetSide: setTrackingMode === "UNILATERAL" ? "LEFT" : "BILATERAL",
        isReadOnly: false,
        isSecsTimerRunning: false,
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
      selectedTrainingPlanExerciseVariantId: null,
      selectedVariantId: null,
      selectedStationId: null,
      selectedStationProfileLoadsKg: [],
      loadInputMode: "TOTAL",
      repetitionKind: "REPS",
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
      isSecsTimerRunning: false,
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
    selected_training_plan_exercise_variant_id:
      exercise.selectedTrainingPlanExerciseVariantId,
    selected_variant_id: exercise.selectedVariantId,
    selected_station_id: exercise.selectedStationId,
    set: {
      load_value: normalizeLoadForSelectionAndProfile(
        toCanonicalTotalLoadValue(exercise.activeSet.loadValue, exercise.loadInputMode),
        exercise.selectedTrainingPlanExerciseVariantId,
        exercise.selectedStationId,
        exercise.selectedStationProfileLoadsKg,
      ),
      repetition_kind: exercise.repetitionKind,
      repetition_value: exercise.activeSet.reps,
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
            selected_training_plan_exercise_variant_id:
              exercise.selectedTrainingPlanExerciseVariantId,
            selected_variant_id: exercise.selectedVariantId,
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
                exercise.selectedTrainingPlanExerciseVariantId,
                exercise.selectedStationId,
                exercise.selectedStationProfileLoadsKg,
              ),
              load_value_per_side:
                normalizeLoadInputMode(exercise.loadInputMode) === "PER_SIDE"
                  ? toInputLoadValue(set.loadValue, "PER_SIDE")
                  : null,
              repetition_kind: exercise.repetitionKind,
              repetition_value: set.reps,
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
      const selectedFallbackOption = exercise.fallbackOptions.find(
        (option) => option.id === selection.selectedTrainingPlanExerciseVariantId,
      );
      const repetitionKind = resolvePersistedRepetitionKind(
        persistedExercise,
        normalizeRepetitionKind(selectedFallbackOption?.repetition_kind),
      );
      const suggestedSet = toDraftSet(persistedExercise.suggested_set, repetitionKind);
      const trackingMode = resolveSetTrackingMode(persistedExercise);
      const currentSetProgress = resolveCurrentSetProgress(
        trackingMode,
        persistedExercise,
      );
      const shouldResetInitialSecsActiveSet =
        repetitionKind === "SECS" &&
        persistedExercise.completed_sets.length === 0 &&
        currentSetProgress.currentSetIndex === 1;
      const activeSet = shouldResetInitialSecsActiveSet
        ? {
            ...suggestedSet,
            reps: DEFAULT_SUGGESTED_SECS,
          }
        : { ...suggestedSet };

      return {
        trainingPlanExerciseId: persistedExercise.training_plan_exercise_id,
        name: persistedExercise.exercise_name,
        fallbackOptions: exercise.fallbackOptions,
        selectedTrainingPlanExerciseVariantId:
          selection.selectedTrainingPlanExerciseVariantId,
        selectedVariantId: selection.selectedVariantId,
        selectedStationId: selection.selectedStationId,
        selectedStationProfileLoadsKg: selection.selectedStationProfileLoadsKg,
        loadInputMode: selection.loadInputMode,
        repetitionKind,
        setTrackingMode: trackingMode,
        isFallbackOptionConfirmed: selection.isFallbackOptionConfirmed,
        skippedAt: persistedExercise.skipped_at ?? null,
        suggestedSet,
        completedSets: persistedExercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          setSide:
            normalizeSetSide(set.set_side) ??
            (trackingMode === "UNILATERAL" ? "LEFT" : "BILATERAL"),
          loadValue: normalizeLoadForSelectionAndProfile(
            set.load_value,
            selection.selectedTrainingPlanExerciseVariantId,
            selection.selectedStationId,
            selection.selectedStationProfileLoadsKg,
          ),
          reps: resolvePersistedSetReps(set, repetitionKind),
        })),
        activeSet,
        activeSetInput: toDraftSetInput(activeSet),
        currentSetIndex: currentSetProgress.currentSetIndex,
        currentSetSide: currentSetProgress.currentSetSide,
        isReadOnly: exercise.isReadOnly,
        isSecsTimerRunning: false,
      };
    }),
  };
};

export const buildWorkoutPlanFromActiveWorkout = (
  response: ActiveWorkoutResponse,
  optionsResponse: TrainingPlanExerciseVariantsResponse,
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
      const repetitionKind = resolvePersistedRepetitionKind(exercise, "REPS");
      const trackingMode = resolveSetTrackingMode(exercise);
      const suggestedSet = toDraftSet(exercise.suggested_set, repetitionKind);
      const activeSet = { ...suggestedSet };

      return {
        trainingPlanExerciseId: exercise.training_plan_exercise_id,
        name: exercise.exercise_name,
        fallbackOptions: [],
        selectedTrainingPlanExerciseVariantId: null,
        selectedVariantId: null,
        selectedStationId: null,
        selectedStationProfileLoadsKg: [],
        loadInputMode: normalizeLoadInputMode(exercise.load_input_mode),
        repetitionKind,
        setTrackingMode: trackingMode,
        isFallbackOptionConfirmed: true,
        skippedAt: exercise.skipped_at ?? null,
        suggestedSet,
        completedSets: exercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          setSide:
            normalizeSetSide(set.set_side) ??
            (trackingMode === "UNILATERAL" ? "LEFT" : "BILATERAL"),
          loadValue: set.load_value,
          reps: resolvePersistedSetReps(set, repetitionKind),
        })),
        activeSet,
        activeSetInput: toDraftSetInput(activeSet),
        ...resolveCurrentSetProgress(trackingMode, exercise),
        isReadOnly: false,
        isSecsTimerRunning: false,
      };
    });

  return {
    id: response.workout.training_plan_id,
    name: response.workout.training_plan_name,
    exercises,
  };
};

export const countPersistedExercises = (response: ActiveWorkoutResponse): number =>
  response.workout.exercises.filter(
    (exercise) => exercise.completed_sets.length > 0 || exercise.skipped_at !== null,
  ).length;
