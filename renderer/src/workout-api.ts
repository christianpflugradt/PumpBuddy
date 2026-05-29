import type {
  ActiveWorkoutResponse,
  AboutMetadata,
  CompleteActiveWorkoutRequest,
  CreateActiveWorkoutRequest,
  ErrorResponse,
  CreateWorkoutRequest,
  GymDetailResponse,
  GymStationDetailResponse,
  GymSummary,
  TrainingPlanDetailResponse,
  TrainingPlanExerciseVariantsResponse,
  TrainingPlanSummary,
  WorkoutDetailResponse,
  WorkoutExercisesPerformanceResponse,
  UpdateActiveWorkoutRequest,
  WorkoutHistoryListResponse,
  WorkoutProgressResponse,
  WorkoutSummary,
} from "./workout-contract";
import {
  parseAboutMetadata,
  parseActiveWorkoutResponse,
  parseErrorResponsePayload,
  parseGymDetailResponse,
  parseGymStationDetailResponse,
  parseGymSummaries,
  parseTrainingPlanDetailResponse,
  parseTrainingPlanOptionsResponse,
  parseTrainingPlanSummaries,
  parseWorkoutDetailResponse,
  parseWorkoutExercisesPerformanceResponse,
  parseWorkoutHistoryListResponse,
  parseWorkoutProgressResponse,
  parseWorkoutSummary,
  serializeCompleteActiveWorkoutRequest,
  serializeCreateActiveWorkoutRequest,
  serializeCreateWorkoutRequest,
  serializeUpdateActiveWorkoutRequest,
} from "./openapi-contract";

export type FetchJson = <T>(input: string) => Promise<T>;

export type ActiveWorkoutApi = {
  createWorkout?: (payload: CreateWorkoutRequest) => Promise<WorkoutSummary>;
  createActiveWorkout: (payload: CreateActiveWorkoutRequest) => Promise<ActiveWorkoutResponse>;
  updateActiveWorkout: (
    workoutId: string,
    payload: UpdateActiveWorkoutRequest,
  ) => Promise<ActiveWorkoutResponse>;
  cancelActiveWorkout: (workoutId: string) => Promise<void>;
  completeActiveWorkout: (
    workoutId: string,
    payload: CompleteActiveWorkoutRequest,
  ) => Promise<WorkoutSummary>;
};

export class RequestError extends Error {
  readonly status: number;
  readonly body: ErrorResponse | null;

  constructor(status: number, body: ErrorResponse | null) {
    super(
      typeof body?.message === "string" && body.message.length > 0
        ? body.message
        : `Request failed with status ${status}`,
    );
    this.status = status;
    this.body = body;
  }
}

const parseErrorResponse = async (response: Response): Promise<ErrorResponse | null> => {
  if (response.status === 204) {
    return null;
  }

  const getHeader = response.headers?.get?.bind(response.headers);
  const contentLength = getHeader ? getHeader("content-length") : null;
  if (contentLength === "0") {
    return null;
  }

  try {
    return parseErrorResponsePayload(await response.json());
  } catch {
    return null;
  }
};

const dispatchUnauthorized = (): void => {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("pb-unauthorized"));
    }
  } catch (err) {
    // best-effort: ignore errors when dispatching in non-browser environments
  }
};

export const createFetchJson = (fetchImpl: typeof fetch = fetch): FetchJson => {
  return async <T>(input: string): Promise<T> => {
    const response = await fetchImpl(input, { credentials: "same-origin" });

    if (!response.ok) {
      if (response.status === 401) {
        dispatchUnauthorized();
      }
      throw new RequestError(response.status, await parseErrorResponse(response));
    }

    return (await response.json()) as T;
  };
};

export const loadGymSummaries = async (fetchJson: FetchJson): Promise<GymSummary[]> =>
  parseGymSummaries(await fetchJson<unknown>("/api/gyms"));

export const loadGymDetail = async (
  fetchJson: FetchJson,
  gymId: string,
): Promise<GymDetailResponse> =>
  parseGymDetailResponse(await fetchJson<unknown>(`/api/gyms/${encodeURIComponent(gymId)}`));

export const loadStationDetail = async (
  fetchJson: FetchJson,
  gymId: string,
  stationId: string,
): Promise<GymStationDetailResponse> =>
  parseGymStationDetailResponse(
    await fetchJson<unknown>(
      `/api/gyms/${encodeURIComponent(gymId)}/stations/${encodeURIComponent(stationId)}`,
    ),
  );

export const loadStartScreenData = async (fetchJson: FetchJson): Promise<{
  trainingPlans: TrainingPlanSummary[];
  gyms: GymSummary[];
}> => {
  const [trainingPlansPayload, gyms] = await Promise.all([
    fetchJson<unknown>("/api/training-plans"),
    loadGymSummaries(fetchJson),
  ]);

  return {
    trainingPlans: parseTrainingPlanSummaries(trainingPlansPayload),
    gyms,
  };
};

export const loadTrainingPlanDetail = async (
  fetchJson: FetchJson,
  trainingPlanId: string,
): Promise<TrainingPlanDetailResponse> =>
  parseTrainingPlanDetailResponse(
    await fetchJson<unknown>(`/api/training-plans/${encodeURIComponent(trainingPlanId)}`),
  );

export const loadTrainingPlanOptions = async (
  fetchJson: FetchJson,
  trainingPlanId: string,
  gymId: string,
): Promise<TrainingPlanExerciseVariantsResponse> =>
  parseTrainingPlanOptionsResponse(
    await fetchJson<unknown>(
      `/api/training-plans/${encodeURIComponent(trainingPlanId)}/options?gymId=${encodeURIComponent(gymId)}`,
    ),
  );

export const isNotFoundRequestError = (error: unknown): boolean =>
  (error instanceof RequestError && error.status === 404) ||
  (error instanceof Error && error.message.includes("status 404"));

export const loadActiveWorkout = async (
  fetchJson: FetchJson,
): Promise<ActiveWorkoutResponse | null> => {
  try {
    return parseActiveWorkoutResponse(await fetchJson<unknown>("/api/active-workout"));
  } catch (error) {
    if (isNotFoundRequestError(error)) {
      return null;
    }

    throw error;
  }
};

export const loadAboutMetadata = async (fetchJson: FetchJson): Promise<AboutMetadata> =>
  parseAboutMetadata(await fetchJson<unknown>("/api/about"));

export const loadWorkoutHistory = async (
  fetchJson: FetchJson,
): Promise<WorkoutHistoryListResponse> =>
  parseWorkoutHistoryListResponse(await fetchJson<unknown>("/api/workouts"));

export const loadWorkoutProgress = async (
  fetchJson: FetchJson,
): Promise<WorkoutProgressResponse> =>
  parseWorkoutProgressResponse(await fetchJson<unknown>("/api/workouts/progress"));

export const loadWorkoutExercisesPerformance = async (
  fetchJson: FetchJson,
): Promise<WorkoutExercisesPerformanceResponse> =>
  parseWorkoutExercisesPerformanceResponse(
    await fetchJson<unknown>("/api/workouts/exercises-performance"),
  );

export const loadWorkoutDetail = async (
  fetchJson: FetchJson,
  workoutId: string,
): Promise<WorkoutDetailResponse> =>
  parseWorkoutDetailResponse(
    await fetchJson<unknown>(`/api/workouts/${encodeURIComponent(workoutId)}`),
  );

export const createActiveWorkoutApi = (fetchImpl: typeof fetch = fetch): ActiveWorkoutApi => {
  const submitJson = async (input: string, method: string, payload: unknown): Promise<unknown> => {
    const response = await fetchImpl(input, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });

    if (!response.ok) {
      if (response.status === 401) dispatchUnauthorized();
      throw new RequestError(response.status, await parseErrorResponse(response));
    }

    return await response.json();
  };

  const submitWithoutBody = async (input: string, method: string): Promise<void> => {
    const response = await fetchImpl(input, { method, credentials: "same-origin" });

    if (!response.ok) {
      if (response.status === 401) dispatchUnauthorized();
      throw new RequestError(response.status, await parseErrorResponse(response));
    }
  };

  return {
    createWorkout: async (payload) =>
      parseWorkoutSummary(
        await submitJson("/api/workouts", "POST", serializeCreateWorkoutRequest(payload)),
      ),
    createActiveWorkout: async (payload) =>
      parseActiveWorkoutResponse(
        await submitJson(
          "/api/active-workout",
          "POST",
          serializeCreateActiveWorkoutRequest(payload),
        ),
      ),
    updateActiveWorkout: async (workoutId, payload) =>
      parseActiveWorkoutResponse(
        await submitJson(
          `/api/active-workout/${workoutId}`,
          "PUT",
          serializeUpdateActiveWorkoutRequest(payload),
        ),
      ),
    cancelActiveWorkout: async (workoutId) =>
      await submitWithoutBody(`/api/active-workout/${workoutId}`, "DELETE"),
    completeActiveWorkout: async (workoutId, payload) =>
      parseWorkoutSummary(
        await submitJson(
          `/api/active-workout/${workoutId}/complete`,
          "POST",
          serializeCompleteActiveWorkoutRequest(payload),
        ),
      ),
  };
};
