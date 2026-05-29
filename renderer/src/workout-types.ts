import type {
  AboutMetadata,
  BlockedStartModalState,
  GymDetailResponse,
  GymStationOption,
  GymSummary,
  PlanExerciseOptionSummary,
  TrainingPlanSummary,
  WorkoutDetailResponse,
  WorkoutExercisesPerformanceGroup,
  WorkoutHistorySummary,
  WorkoutProgressEntry,
  WorkoutProgressStatus,
} from "./workout-contract";

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
  | { screen: "history" }
  | { screen: "progress" }
  | { screen: "exercises" }
  | { screen: "gyms" }
  | {
      screen: "exercise-variant-detail";
      variantId: string;
      returnScreen?: "exercises" | "workout-detail" | "gym-detail";
      returnWorkoutId?: string;
      returnWorkoutSourceScreen?: "progress";
      returnGymId?: string;
      fallbackExerciseName?: string;
      fallbackVariantName?: string;
    }
  | { screen: "gym-detail"; gymId: string }
  | { screen: "station-detail"; gymId: string; stationId: string }
  | { screen: "workout-detail"; workoutId: string; returnScreen?: "progress" }
  | { screen: "settings" }
  | { screen: "about" }
  | { screen: "exercise"; exerciseIndex: number }
  | { screen: "completion" };

export type SessionUser = {
  id: string;
  displayName: string;
  maxLoadKg?: number;
  login?: string;
  registrationDate?: string;
  favoriteGymId?: string | null;
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

export type GymDetailActiveSheet = "stations" | "exercises";

export type GymStationChooserState = {
  variantId: string;
  exerciseName: string;
  variantName: string;
  stationOptions: GymStationOption[];
} | null;

export type AppState = {
  sessionUser?: SessionUser | null;
  aboutScreen?: {
    metadata: AboutMetadata | null;
    errorMessage: string | null;
  };
  historyScreen: {
    workouts: WorkoutHistorySummary[];
    isLoading: boolean;
    errorMessage: string | null;
    hasLoaded: boolean;
    restoreWorkoutId: string | null;
  };
  progressScreen: {
    workouts: WorkoutProgressEntry[];
    isLoading: boolean;
    errorMessage: string | null;
    hasLoaded: boolean;
    selectedWorkoutId?: string | null;
  };
  exercisesScreen: {
    groups: WorkoutExercisesPerformanceGroup[];
    isLoading: boolean;
    errorMessage: string | null;
    hasLoaded: boolean;
    restoreScrollY: number | null;
  };
  gymsScreen: {
    gyms: GymSummary[];
    isLoading: boolean;
    errorMessage: string | null;
    hasLoaded: boolean;
  };
  gymDetailScreen: {
    gymId: string | null;
    detail: GymDetailResponse | null;
    activeSheet: GymDetailActiveSheet;
    isLoading: boolean;
    errorMessage: string | null;
    stationChooser: GymStationChooserState;
  };
  workoutDetailScreen?: {
    workoutId: string | null;
    detail: WorkoutDetailResponse | null;
    isLoading: boolean;
    errorMessage: string | null;
  };
  startScreen: StartScreenState;
  workoutPlan: WorkoutPlan | null;
  viewState: ViewState;
  completion: {
    startedAt: string | null;
    completedAt: string | null;
    averageDurationMinutes?: number | null;
    workoutProgress?: number | null;
    workoutProgressStatus?: WorkoutProgressStatus;
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
