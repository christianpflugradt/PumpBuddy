import {
  AboutMetadataResponseFromJSON,
} from "../generated/openapi/typescript/models/AboutMetadataResponse";
import { ActiveWorkoutResponseFromJSON } from "../generated/openapi/typescript/models/ActiveWorkoutResponse";
import type { ActiveWorkoutExerciseInput as OpenApiActiveWorkoutExerciseInput } from "../generated/openapi/typescript/models/ActiveWorkoutExerciseInput";
import { AuthLoginRequestToJSON } from "../generated/openapi/typescript/models/AuthLoginRequest";
import { AuthSessionResponseFromJSON } from "../generated/openapi/typescript/models/AuthSessionResponse";
import { AuthUpdateDisplayNameRequestToJSON } from "../generated/openapi/typescript/models/AuthUpdateDisplayNameRequest";
import { AuthUpdatePasswordRequestToJSON } from "../generated/openapi/typescript/models/AuthUpdatePasswordRequest";
import { CompleteActiveWorkoutRequestToJSON } from "../generated/openapi/typescript/models/CompleteActiveWorkoutRequest";
import type { CreateWorkoutExerciseInput as OpenApiCreateWorkoutExerciseInput } from "../generated/openapi/typescript/models/CreateWorkoutExerciseInput";
import { CreateActiveWorkoutRequestToJSON } from "../generated/openapi/typescript/models/CreateActiveWorkoutRequest";
import { CreateWorkoutRequestToJSON } from "../generated/openapi/typescript/models/CreateWorkoutRequest";
import { ErrorResponseFromJSON } from "../generated/openapi/typescript/models/ErrorResponse";
import { GymDetailResponseFromJSON } from "../generated/openapi/typescript/models/GymDetailResponse";
import { GymStationDetailResponseFromJSON } from "../generated/openapi/typescript/models/GymStationDetailResponse";
import { GymSummaryFromJSON } from "../generated/openapi/typescript/models/GymSummary";
import { TrainingPlanDetailResponseFromJSON } from "../generated/openapi/typescript/models/TrainingPlanDetailResponse";
import type { TrainingPlanExerciseVariantSummary as OpenApiTrainingPlanExerciseVariantSummary } from "../generated/openapi/typescript/models/TrainingPlanExerciseVariantSummary";
import { TrainingPlanExerciseVariantsResponseFromJSON } from "../generated/openapi/typescript/models/TrainingPlanExerciseVariantsResponse";
import { TrainingPlanSummaryFromJSON } from "../generated/openapi/typescript/models/TrainingPlanSummary";
import { UpdateActiveWorkoutRequestToJSON } from "../generated/openapi/typescript/models/UpdateActiveWorkoutRequest";
import { WorkoutDetailResponseFromJSON } from "../generated/openapi/typescript/models/WorkoutDetailResponse";
import { WorkoutExercisesPerformanceResponseFromJSON } from "../generated/openapi/typescript/models/WorkoutExercisesPerformanceResponse";
import { WorkoutHistorySummaryFromJSON } from "../generated/openapi/typescript/models/WorkoutHistorySummary";
import { WorkoutProgressResponseFromJSON } from "../generated/openapi/typescript/models/WorkoutProgressResponse";
import { WorkoutSummaryFromJSON } from "../generated/openapi/typescript/models/WorkoutSummary";
import type {
  AboutMetadata,
  ActiveWorkoutExerciseInput,
  ActiveWorkoutResponse,
  CompleteActiveWorkoutRequest,
  CreateActiveWorkoutRequest,
  CreateWorkoutExerciseInput,
  CreateWorkoutRequest,
  ErrorResponse,
  GymDetailResponse,
  GymStationDetailResponse,
  GymSummary,
  PlanExerciseOptionSummary,
  TrainingPlanDetailResponse,
  TrainingPlanExerciseVariantsResponse,
  TrainingPlanSummary,
  UpdateActiveWorkoutRequest,
  WorkoutDetailResponse,
  WorkoutExercisesPerformanceResponse,
  WorkoutHistoryListResponse,
  WorkoutProgressResponse,
  WorkoutSummary,
} from "./workout-contract";
import type { SessionUser } from "./workout-types";

const requireJsonArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected an array JSON payload.");
  }

  return value;
};

const normalizeGeneratedValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeGeneratedValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeGeneratedValue(entry)]),
    );
  }

  return value;
};

const toRendererModel = <T>(value: unknown): T => normalizeGeneratedValue(value) as T;

const toRendererTrainingPlanOption = (
  option: OpenApiTrainingPlanExerciseVariantSummary,
): PlanExerciseOptionSummary => ({
  ...toRendererModel<PlanExerciseOptionSummary>(option),
  station_id: option.station_id ?? null,
  station_name: option.station_name ?? null,
  station_profile_loads_kg: option.station_profile_loads_kg ?? [],
  last_completed_at: option.last_completed_at?.toISOString() ?? null,
});

const toOptionalDate = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined || value === null) {
    return value;
  }

  return new Date(value);
};

const toActiveWorkoutExerciseInput = (
  exercise: ActiveWorkoutExerciseInput,
): OpenApiActiveWorkoutExerciseInput => ({
  training_plan_exercise_id: exercise.training_plan_exercise_id,
  position: exercise.position,
  selected_training_plan_exercise_variant_id: exercise.selected_training_plan_exercise_variant_id,
  selected_variant_id: exercise.selected_variant_id,
  load_input_mode: exercise.load_input_mode ?? "TOTAL",
  set_tracking_mode: exercise.set_tracking_mode ?? "BILATERAL",
  selected_station_id: exercise.selected_station_id,
  skipped_at: toOptionalDate(exercise.skipped_at),
  completed_sets: exercise.completed_sets.map((set) => ({
    set_index: set.set_index,
    set_side: set.set_side,
    load_value: set.load_value,
    load_value_per_side: set.load_value_per_side,
    repetition_kind: set.repetition_kind,
    repetition_value: set.repetition_value,
  })),
});

const toCreateWorkoutExerciseInput = (
  exercise: CreateWorkoutExerciseInput,
): OpenApiCreateWorkoutExerciseInput => ({
  training_plan_exercise_id: exercise.training_plan_exercise_id,
  position: exercise.position,
  selected_training_plan_exercise_variant_id: exercise.selected_training_plan_exercise_variant_id,
  selected_variant_id: exercise.selected_variant_id,
  selected_station_id: exercise.selected_station_id,
  set: {
    load_value: exercise.set.load_value,
    repetition_kind: exercise.set.repetition_kind,
    repetition_value: exercise.set.repetition_value,
  },
});

const toActiveWorkoutProgressPayload = (
  payload: CreateActiveWorkoutRequest | UpdateActiveWorkoutRequest | CompleteActiveWorkoutRequest,
) => ({
  training_plan_id: payload.training_plan_id,
  gym_id: payload.gym_id,
  started_at: new Date(payload.started_at),
  current_exercise_position: payload.current_exercise_position,
  total_exercise_count: payload.total_exercise_count,
  exercises: payload.exercises.map(toActiveWorkoutExerciseInput),
});

export const parseAboutMetadata = (json: unknown): AboutMetadata =>
  toRendererModel<AboutMetadata>(AboutMetadataResponseFromJSON(json));

export const parseActiveWorkoutResponse = (json: unknown): ActiveWorkoutResponse =>
  toRendererModel<ActiveWorkoutResponse>(ActiveWorkoutResponseFromJSON(json));

export const parseErrorResponsePayload = (json: unknown): ErrorResponse =>
  toRendererModel<ErrorResponse>(ErrorResponseFromJSON(json));

export const parseGymSummaries = (json: unknown): GymSummary[] =>
  requireJsonArray(json).map((entry) => toRendererModel<GymSummary>(GymSummaryFromJSON(entry)));

export const parseGymDetailResponse = (json: unknown): GymDetailResponse =>
  toRendererModel<GymDetailResponse>(GymDetailResponseFromJSON(json));

export const parseGymStationDetailResponse = (json: unknown): GymStationDetailResponse =>
  toRendererModel<GymStationDetailResponse>(GymStationDetailResponseFromJSON(json));

export const parseTrainingPlanDetailResponse = (json: unknown): TrainingPlanDetailResponse => {
  const response = TrainingPlanDetailResponseFromJSON(json);
  return {
    training_plan_id: response.id,
    exercises: response.exercises.map((exercise) => ({
      training_plan_exercise_id: exercise.training_plan_exercise_id,
      exercise_name: exercise.exercise_name,
      exercise_position: exercise.exercise_position,
    })),
  };
};

export const parseTrainingPlanOptionsResponse = (
  json: unknown,
): TrainingPlanExerciseVariantsResponse => {
  const response = TrainingPlanExerciseVariantsResponseFromJSON(json);
  return {
    training_plan_id: response.training_plan_id,
    gym_id: response.gym_id,
    exercise_variants: response.exercise_variants.map(toRendererTrainingPlanOption),
  };
};

export const parseTrainingPlanSummaries = (json: unknown): TrainingPlanSummary[] =>
  requireJsonArray(json).map((entry) =>
    toRendererModel<TrainingPlanSummary>(TrainingPlanSummaryFromJSON(entry)),
  );

export const parseWorkoutDetailResponse = (json: unknown): WorkoutDetailResponse =>
  toRendererModel<WorkoutDetailResponse>(WorkoutDetailResponseFromJSON(json));

export const parseWorkoutExercisesPerformanceResponse = (
  json: unknown,
): WorkoutExercisesPerformanceResponse =>
  toRendererModel<WorkoutExercisesPerformanceResponse>(
    WorkoutExercisesPerformanceResponseFromJSON(json),
  );

export const parseWorkoutHistoryListResponse = (json: unknown): WorkoutHistoryListResponse =>
  requireJsonArray(json).map((entry) =>
    toRendererModel<WorkoutHistoryListResponse[number]>(WorkoutHistorySummaryFromJSON(entry)),
  );

export const parseWorkoutProgressResponse = (json: unknown): WorkoutProgressResponse =>
  toRendererModel<WorkoutProgressResponse>(WorkoutProgressResponseFromJSON(json));

export const parseWorkoutSummary = (json: unknown): WorkoutSummary =>
  toRendererModel<WorkoutSummary>(WorkoutSummaryFromJSON(json));

export const parseSessionUserResponse = (json: unknown): SessionUser | null => {
  const rawPayload = json as {
    user?: {
      favorite_gym_id?: unknown;
    };
  };
  const response = AuthSessionResponseFromJSON(json);
  if (!response.authenticated) {
    return null;
  }

  const userId = response.user?.id;
  const displayName = response.user?.display_name;
  if (typeof userId !== "string" || typeof displayName !== "string") {
    return null;
  }

  const sessionUser: SessionUser = {
    id: userId,
    displayName,
  };

  if (Number.isFinite(response.user.max_load_kg)) {
    sessionUser.maxLoadKg = response.user.max_load_kg;
  }

  if (typeof response.user.login === "string") {
    sessionUser.login = response.user.login;
  }

  const registrationDate = normalizeGeneratedValue(response.user.registration_date);
  if (typeof registrationDate === "string") {
    sessionUser.registrationDate = registrationDate;
  }

  const favoriteGymId = rawPayload.user?.favorite_gym_id;
  if (typeof favoriteGymId === "string" || favoriteGymId === null) {
    sessionUser.favoriteGymId = favoriteGymId;
  }

  return sessionUser;
};

export const mergeSessionUser = (
  currentSessionUser: SessionUser,
  nextSessionUser: SessionUser | null,
): SessionUser => {
  if (nextSessionUser === null) {
    return currentSessionUser;
  }

  return {
    id: nextSessionUser.id.length > 0 ? nextSessionUser.id : currentSessionUser.id,
    displayName:
      nextSessionUser.displayName.trim().length > 0
        ? nextSessionUser.displayName
        : currentSessionUser.displayName,
    maxLoadKg:
      nextSessionUser.maxLoadKg === undefined
        ? currentSessionUser.maxLoadKg
        : nextSessionUser.maxLoadKg,
    login: nextSessionUser.login ?? currentSessionUser.login,
    registrationDate:
      nextSessionUser.registrationDate ?? currentSessionUser.registrationDate,
    favoriteGymId:
      nextSessionUser.favoriteGymId === undefined
        ? currentSessionUser.favoriteGymId
        : nextSessionUser.favoriteGymId,
  };
};

export const serializeAuthLoginRequest = (login: string, password: string): unknown =>
  AuthLoginRequestToJSON({ login, password });

export const serializeAuthSessionUpdateRequest = (payload: {
  display_name: string;
  max_load_kg?: number;
  favorite_gym_id?: string | null;
}): unknown =>
  AuthUpdateDisplayNameRequestToJSON({
    display_name: payload.display_name,
    max_load_kg: payload.max_load_kg,
    favorite_gym_id: payload.favorite_gym_id,
  });

export const serializeAuthUpdatePasswordRequest = (payload: {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}): unknown =>
  AuthUpdatePasswordRequestToJSON({
    current_password: payload.current_password,
    new_password: payload.new_password,
    confirm_new_password: payload.confirm_new_password,
  });

export const serializeCreateActiveWorkoutRequest = (
  payload: CreateActiveWorkoutRequest,
): unknown =>
  CreateActiveWorkoutRequestToJSON({
    ...toActiveWorkoutProgressPayload(payload),
    first_confirmed_exercise_position: payload.first_confirmed_exercise_position,
  });

export const serializeCreateWorkoutRequest = (payload: CreateWorkoutRequest): unknown =>
  CreateWorkoutRequestToJSON({
    training_plan_id: payload.training_plan_id,
    gym_id: payload.gym_id as string | undefined,
    started_at: toOptionalDate(payload.started_at),
    completed_at: toOptionalDate(payload.completed_at),
    exercises: payload.exercises.map(toCreateWorkoutExerciseInput),
  });

export const serializeCompleteActiveWorkoutRequest = (
  payload: CompleteActiveWorkoutRequest,
): unknown =>
  CompleteActiveWorkoutRequestToJSON({
    ...toActiveWorkoutProgressPayload(payload),
    completed_at: new Date(payload.completed_at),
    last_confirmed_exercise_position: payload.last_confirmed_exercise_position,
  });

export const serializeUpdateActiveWorkoutRequest = (
  payload: UpdateActiveWorkoutRequest,
): unknown =>
  UpdateActiveWorkoutRequestToJSON({
    ...toActiveWorkoutProgressPayload(payload),
    last_confirmed_exercise_position: payload.last_confirmed_exercise_position,
  });
