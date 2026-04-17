import type {
  ActiveWorkoutResponse,
  AboutMetadata,
  CompleteActiveWorkoutRequest,
  CreateActiveWorkoutRequest,
  ErrorResponse,
  CreateWorkoutRequest,
  GymSummary,
  TrainingPlanDetailResponse,
  TrainingPlanSummary,
  UpdateActiveWorkoutRequest,
  WorkoutHistoryListResponse,
  WorkoutSummary,
} from "./workout-types";

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
    return (await response.json()) as ErrorResponse;
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

export const loadStartScreenData = async (fetchJson: FetchJson): Promise<{
  trainingPlans: TrainingPlanSummary[];
  gyms: GymSummary[];
}> => {
  const [trainingPlans, gyms] = await Promise.all([
    fetchJson<TrainingPlanSummary[]>("/api/training-plans"),
    fetchJson<GymSummary[]>("/api/gyms"),
  ]);

  return { trainingPlans, gyms };
};

export const loadTrainingPlanDetail = async (
  fetchJson: FetchJson,
  trainingPlanId: string,
): Promise<TrainingPlanDetailResponse> =>
  await fetchJson<TrainingPlanDetailResponse>(`/api/training-plans/${encodeURIComponent(trainingPlanId)}`);

export const isNotFoundRequestError = (error: unknown): boolean =>
  (error instanceof RequestError && error.status === 404) ||
  (error instanceof Error && error.message.includes("status 404"));

export const loadActiveWorkout = async (
  fetchJson: FetchJson,
): Promise<ActiveWorkoutResponse | null> => {
  try {
    return await fetchJson<ActiveWorkoutResponse>("/api/active-workout");
  } catch (error) {
    if (isNotFoundRequestError(error)) {
      return null;
    }

    throw error;
  }
};

export const loadAboutMetadata = async (fetchJson: FetchJson): Promise<AboutMetadata> =>
  await fetchJson<AboutMetadata>("/api/about");

export const loadWorkoutHistory = async (
  fetchJson: FetchJson,
): Promise<WorkoutHistoryListResponse> =>
  await fetchJson<WorkoutHistoryListResponse>("/api/workouts");

export const createActiveWorkoutApi = (fetchImpl: typeof fetch = fetch): ActiveWorkoutApi => {
  const submitJson = async <T>(input: string, method: string, payload: unknown): Promise<T> => {
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

    return (await response.json()) as T;
  };

  const submitWithoutBody = async (input: string, method: string): Promise<void> => {
    const response = await fetchImpl(input, { method, credentials: "same-origin" });

    if (!response.ok) {
      if (response.status === 401) dispatchUnauthorized();
      throw new RequestError(response.status, await parseErrorResponse(response));
    }
  };

  return {
    createWorkout: async (payload) => await submitJson<WorkoutSummary>("/api/workouts", "POST", payload),
    createActiveWorkout: async (payload) =>
      await submitJson<ActiveWorkoutResponse>("/api/active-workout", "POST", payload),
    updateActiveWorkout: async (workoutId, payload) =>
      await submitJson<ActiveWorkoutResponse>(`/api/active-workout/${workoutId}`, "PUT", payload),
    cancelActiveWorkout: async (workoutId) =>
      await submitWithoutBody(`/api/active-workout/${workoutId}`, "DELETE"),
    completeActiveWorkout: async (workoutId, payload) =>
      await submitJson<WorkoutSummary>(`/api/active-workout/${workoutId}/complete`, "POST", payload),
  };
};
