import { describe, expect, it, vi } from "vitest";
import type { TrainingPlanDetailResponse } from "./workout-contract";
import { createScreenDataController } from "./workout-controller-screen-data";
import type { FetchJson } from "./workout-api";
import type { AppState } from "./workout-types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

const createTrainingPlanDetail = (
  overrides: Partial<TrainingPlanDetailResponse> = {},
): TrainingPlanDetailResponse => ({
  id: "plan-1",
  name: "Leg Day",
  selected_gym_id: null,
  is_executable: null,
  execution_status: null,
  execution_summary: null,
  exercises: [
    {
      training_plan_exercise_id: "exercise-1",
      exercise_name: "Squat",
      exercise_position: 1,
      configured_variant_count: 2,
      executable_variant_count: null,
      execution_status: null,
      variants: [
        {
          id: "option-1",
          training_plan_exercise_id: "exercise-1",
          variant_id: "variant-1",
          variant_name: "Back Squat",
          requires_station: true,
          rep_min: 5,
          rep_max: 8,
          target_sets: 3,
          repetition_kind: "REPS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          availability: null,
          compatible_stations: [],
        },
      ],
    },
  ],
  ...overrides,
});

const createState = (): AppState => ({
  historyScreen: {
    workouts: [],
    isLoading: false,
    errorMessage: null,
    hasLoaded: false,
    restoreWorkoutId: null,
  },
  progressScreen: {
    workouts: [],
    isLoading: false,
    errorMessage: null,
    hasLoaded: false,
    selectedWorkoutId: null,
  },
  exercisesScreen: {
    groups: [],
    isLoading: false,
    errorMessage: null,
    hasLoaded: false,
    restoreScrollY: null,
  },
  gymsScreen: {
    gyms: [],
    isLoading: false,
    errorMessage: null,
    hasLoaded: false,
  },
  trainingPlansScreen: {
    trainingPlans: [],
    isLoading: false,
    errorMessage: null,
    hasLoaded: false,
    selectedTrainingPlanId: null,
    selectedGymId: null,
  },
  trainingPlanDetailScreen: {
    trainingPlanId: null,
    selectedGymId: null,
    detail: null,
    isLoading: false,
    errorMessage: null,
  },
  gymDetailScreen: {
    gymId: null,
    detail: null,
    activeSheet: "stations",
    isLoading: false,
    errorMessage: null,
    stationChooser: null,
  },
  stationDetailScreen: {
    gymId: null,
    stationId: null,
    detail: null,
    isLoading: false,
    errorMessage: null,
    loadProfilePopupOpen: false,
  },
  workoutDetailScreen: {
    workoutId: null,
    detail: null,
    isLoading: false,
    errorMessage: null,
  },
  startScreen: {
    isLoading: false,
    isStarting: false,
    errorMessage: null,
    blockedStartModal: null,
    trainingPlans: [],
    gyms: [],
    selectedTrainingPlanId: "start-plan",
    selectedGymId: "start-gym",
    selectedWorkoutMode: "configured-gym",
  },
  workoutPlan: null,
  viewState: { screen: "start" },
  completion: { startedAt: null, completedAt: null },
  confirmDialog: { message: null, confirmActionLabel: null, onConfirm: null },
  activeWorkout: { id: null, startedAt: null, persistedExerciseCount: 0 },
  workoutSave: { isSaving: false, errorMessage: null },
  uiFeedback: { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
});

const setup = () => {
  let state = createState();
  const fetchJson = vi.fn();
  const render = vi.fn();
  const controller = createScreenDataController({
    getState: () => state,
    setState: (next) => {
      state = next;
    },
    render,
    fetchJson: fetchJson as FetchJson,
  });

  return { controller, fetchJson, render, getState: () => state };
};

describe("workout-controller-screen-data plan browsing", () => {
  it("loads training plan summaries into browsing state without changing start state", async () => {
    const { controller, fetchJson, getState } = setup();
    fetchJson.mockResolvedValue([
      {
        id: "plan-1",
        name: "Leg Day",
        exercise_count: 3,
        last_completed_at: null,
        start_selection_rank: 1,
      },
    ]);

    await controller.loadTrainingPlansScreenData();

    expect(fetchJson).toHaveBeenCalledWith("/api/training-plans");
    expect(getState().trainingPlansScreen).toEqual({
      trainingPlans: [
        {
          id: "plan-1",
          name: "Leg Day",
          exercise_count: 3,
          last_completed_at: null,
          start_selection_rank: 1,
        },
      ],
      isLoading: false,
      errorMessage: null,
      hasLoaded: true,
      selectedTrainingPlanId: null,
      selectedGymId: null,
    });
    expect(getState().startScreen.selectedTrainingPlanId).toBe("start-plan");
    expect(getState().startScreen.selectedGymId).toBe("start-gym");
  });

  it("loads selected-gym detail into browsing state without changing start state", async () => {
    const { controller, fetchJson, getState } = setup();
    fetchJson.mockResolvedValue(
      createTrainingPlanDetail({
        id: "plan/with/slash",
        selected_gym_id: "gym with/slash",
        is_executable: true,
        execution_status: "GREEN",
        execution_summary: "Ready.",
      }),
    );

    await controller.loadTrainingPlanDetailScreenData("plan/with/slash", "gym with/slash");

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/training-plans/plan%2Fwith%2Fslash?gymId=gym%20with%2Fslash",
    );
    expect(getState().trainingPlansScreen.selectedTrainingPlanId).toBe("plan/with/slash");
    expect(getState().trainingPlansScreen.selectedGymId).toBe("gym with/slash");
    expect(getState().trainingPlanDetailScreen).toMatchObject({
      trainingPlanId: "plan/with/slash",
      selectedGymId: "gym with/slash",
      isLoading: false,
      errorMessage: null,
    });
    expect(getState().trainingPlanDetailScreen.detail?.selected_gym_id).toBe("gym with/slash");
    expect(getState().trainingPlanDetailScreen.detail?.exercises[0]?.variants[0]).toEqual({
      id: "option-1",
      training_plan_exercise_id: "exercise-1",
      variant_id: "variant-1",
      variant_name: "Back Squat",
      requires_station: true,
      rep_min: 5,
      rep_max: 8,
      target_sets: 3,
      repetition_kind: "REPS",
      load_input_mode: "TOTAL",
      set_tracking_mode: "BILATERAL",
      availability: null,
      compatible_stations: [],
    });
    expect(getState().startScreen.selectedTrainingPlanId).toBe("start-plan");
    expect(getState().startScreen.selectedGymId).toBe("start-gym");
  });

  it("keeps later selected-gym detail when an earlier no-gym response resolves last", async () => {
    const { controller, fetchJson, getState } = setup();
    const firstDetail = createDeferred<unknown>();
    const secondDetail = createDeferred<unknown>();
    fetchJson.mockReturnValueOnce(firstDetail.promise).mockReturnValueOnce(secondDetail.promise);

    const firstLoad = controller.loadTrainingPlanDetailScreenData("plan-1", null);
    const secondLoad = controller.loadTrainingPlanDetailScreenData("plan-1", "gym-2");

    secondDetail.resolve(
      createTrainingPlanDetail({
        selected_gym_id: "gym-2",
        is_executable: true,
        execution_status: "GREEN",
      }),
    );
    await secondLoad;

    firstDetail.resolve(
      createTrainingPlanDetail({
        selected_gym_id: null,
        is_executable: null,
        execution_status: null,
      }),
    );
    await firstLoad;

    expect(fetchJson).toHaveBeenNthCalledWith(1, "/api/training-plans/plan-1");
    expect(fetchJson).toHaveBeenNthCalledWith(2, "/api/training-plans/plan-1?gymId=gym-2");
    expect(getState().trainingPlanDetailScreen.selectedGymId).toBe("gym-2");
    expect(getState().trainingPlanDetailScreen.detail?.selected_gym_id).toBe("gym-2");
    expect(getState().trainingPlanDetailScreen.detail?.execution_status).toBe("GREEN");
  });
});
