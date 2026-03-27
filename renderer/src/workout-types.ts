import type { ActiveWorkout as ContractActiveWorkout } from "../dist/generated/openapi/typescript/models/ActiveWorkout";
import type { ActiveWorkoutExercise as ContractActiveWorkoutExercise } from "../dist/generated/openapi/typescript/models/ActiveWorkoutExercise";
import type { ActiveWorkoutExerciseInput as ContractActiveWorkoutExerciseInput } from "../dist/generated/openapi/typescript/models/ActiveWorkoutExerciseInput";
import type { ActiveWorkoutProgressPayload as ContractActiveWorkoutProgressPayload } from "../dist/generated/openapi/typescript/models/ActiveWorkoutProgressPayload";
import type { ActiveWorkoutResponse as ContractActiveWorkoutResponse } from "../dist/generated/openapi/typescript/models/ActiveWorkoutResponse";
import type { ActiveWorkoutSet as ContractActiveWorkoutSet } from "../dist/generated/openapi/typescript/models/ActiveWorkoutSet";
import type { CompleteActiveWorkoutRequest as ContractCompleteActiveWorkoutRequest } from "../dist/generated/openapi/typescript/models/CompleteActiveWorkoutRequest";
import type { CompletedActiveWorkoutSet as ContractCompletedActiveWorkoutSet } from "../dist/generated/openapi/typescript/models/CompletedActiveWorkoutSet";
import type { CreateActiveWorkoutRequest as ContractCreateActiveWorkoutRequest } from "../dist/generated/openapi/typescript/models/CreateActiveWorkoutRequest";
import type { CreateWorkoutExerciseInput as ContractCreateWorkoutExerciseInput } from "../dist/generated/openapi/typescript/models/CreateWorkoutExerciseInput";
import type { CreateWorkoutRequest as ContractCreateWorkoutRequest } from "../dist/generated/openapi/typescript/models/CreateWorkoutRequest";
import type { ErrorDetails as ContractErrorDetails } from "../dist/generated/openapi/typescript/models/ErrorDetails";
import type { ErrorResponse as ContractErrorResponse } from "../dist/generated/openapi/typescript/models/ErrorResponse";
import type { GymSummary as ContractGymSummary } from "../dist/generated/openapi/typescript/models/GymSummary";
import type { MissingExerciseDetail as ContractMissingExerciseDetail } from "../dist/generated/openapi/typescript/models/MissingExerciseDetail";
import type { PlanExerciseOptionSummary as ContractPlanExerciseOptionSummary } from "../dist/generated/openapi/typescript/models/PlanExerciseOptionSummary";
import type { TrainingPlanDetailResponse as ContractTrainingPlanDetailResponse } from "../dist/generated/openapi/typescript/models/TrainingPlanDetailResponse";
import type { TrainingPlanExerciseDetail as ContractTrainingPlanExerciseDetail } from "../dist/generated/openapi/typescript/models/TrainingPlanExerciseDetail";
import type { TrainingPlanOptionsResponse as ContractTrainingPlanOptionsResponse } from "../dist/generated/openapi/typescript/models/TrainingPlanOptionsResponse";
import type { TrainingPlanSummary as ContractTrainingPlanSummary } from "../dist/generated/openapi/typescript/models/TrainingPlanSummary";
import type { UpdateActiveWorkoutRequest as ContractUpdateActiveWorkoutRequest } from "../dist/generated/openapi/typescript/models/UpdateActiveWorkoutRequest";
import type { WorkoutSummary as ContractWorkoutSummary } from "../dist/generated/openapi/typescript/models/WorkoutSummary";

type DeepContractType<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? DeepContractType<U>[]
    : T extends object
      ? { [K in keyof T]-?: DeepContractType<Exclude<T[K], undefined>> }
      : T;

type Override<T, R> = Omit<T, keyof R> & R;

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

export type WorkoutSetDraftInput = {
  loadValue: string;
  reps: string;
};

export type CompletedExerciseSet = WorkoutSetDraft & {
  setIndex: number;
};

export type ExerciseStep = {
  trainingPlanExerciseId: string;
  name: string;
  fallbackOptions: PlanExerciseOptionSummary[];
  selectedPlanExerciseOptionId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  selectedStationProfileLoadsKg: number[];
  isFallbackOptionConfirmed: boolean;
  suggestedSet: WorkoutSetDraft;
  activeSet: WorkoutSetDraft;
  activeSetInput: WorkoutSetDraftInput;
  completedSets: CompletedExerciseSet[];
  isReadOnly: boolean;
};

export type TrainingPlanSummary = DeepContractType<ContractTrainingPlanSummary>;

export type GymSummary = DeepContractType<ContractGymSummary>;

export type PlanExerciseOptionSummary = DeepContractType<ContractPlanExerciseOptionSummary>;

export type ViewState =
  | { screen: "start" }
  | { screen: "exercise"; exerciseIndex: number }
  | { screen: "completion" };

export type WorkoutSummary = DeepContractType<ContractWorkoutSummary>;

export type ActiveWorkoutSet = DeepContractType<ContractActiveWorkoutSet>;

export type CompletedActiveWorkoutSet = DeepContractType<ContractCompletedActiveWorkoutSet>;

export type ActiveWorkoutExercise = DeepContractType<ContractActiveWorkoutExercise>;

export type ActiveWorkout = DeepContractType<ContractActiveWorkout>;

export type ActiveWorkoutResponse = DeepContractType<ContractActiveWorkoutResponse>;

export type CreateWorkoutRequest = Override<
  DeepContractType<ContractCreateWorkoutRequest>,
  {
    gym_id: string | null;
    started_at: string | null;
    completed_at: string | null;
  }
>;

export type CreateWorkoutExerciseInput = DeepContractType<ContractCreateWorkoutExerciseInput>;

export type ActiveWorkoutExerciseInput = DeepContractType<ContractActiveWorkoutExerciseInput>;

export type ActiveWorkoutProgressPayload = Override<
  DeepContractType<ContractActiveWorkoutProgressPayload>,
  {
    gym_id: string | null;
  }
>;

export type CreateActiveWorkoutRequest = Override<
  DeepContractType<ContractCreateActiveWorkoutRequest>,
  {
    gym_id: string | null;
  }
>;

export type UpdateActiveWorkoutRequest = Override<
  DeepContractType<ContractUpdateActiveWorkoutRequest>,
  {
    gym_id: string | null;
  }
>;

export type CompleteActiveWorkoutRequest = Override<
  DeepContractType<ContractCompleteActiveWorkoutRequest>,
  {
    gym_id: string | null;
  }
>;

export type TrainingPlanOptionsResponse = DeepContractType<ContractTrainingPlanOptionsResponse>;

export type TrainingPlanExerciseDetail = DeepContractType<ContractTrainingPlanExerciseDetail>;

export type TrainingPlanDetailResponse = DeepContractType<ContractTrainingPlanDetailResponse>;

export type MissingExerciseDetail = DeepContractType<ContractMissingExerciseDetail>;

export type ErrorDetails = DeepContractType<ContractErrorDetails>;

export type ErrorResponse = DeepContractType<ContractErrorResponse>;

export type BlockedStartModalState = {
  message: string;
  trainingPlanName: string;
  gymName: string;
  missingExercises: MissingExerciseDetail[];
};

export type StartScreenState = {
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
