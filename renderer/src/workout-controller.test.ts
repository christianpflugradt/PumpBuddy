import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./workout-controller";
import {
  loadActiveWorkout,
  loadGymDetail,
  loadGymSummaries,
  loadStationDetail,
  loadStartScreenData,
  loadTrainingPlanDetail,
  loadTrainingPlanSummaries,
  loadWorkoutDetail,
  loadWorkoutExercisesPerformance,
  loadWorkoutHistory,
  loadWorkoutProgress,
} from "./workout-api";
import type {
  ActiveWorkoutResponse,
  GymDetailResponse,
  GymStationDetailResponse,
  TrainingPlanDetailResponse,
  TrainingPlanExerciseVariantDetail,
  TrainingPlanExerciseVariantsResponse,
} from "./workout-contract";
import type { FetchJson } from "./workout-api";
import { resolveSideMenuStorageKey } from "./side-menu-preferences";

const createOrchestratorSpies = () => ({
  bootstrapStartScreen: vi.fn(async () => {}),
  startWorkout: vi.fn(async () => {}),
  cancelWorkout: vi.fn(async () => {}),
  completeWorkout: vi.fn(async () => {}),
  finishWorkout: vi.fn(async () => {}),
  persistActiveSet: vi.fn(async () => {}),
  persistDeleteLatestSet: vi.fn(async () => {}),
  persistNextExerciseTransition: vi.fn(async () => true),
  persistPreviousExerciseTransition: vi.fn(async () => true),
  persistSkipTransition: vi.fn(async () => false),
  selectFallbackOption: vi.fn(() => {}),
  persistFallbackSelection: vi.fn(async () => {}),
});

let orchestratorSpies = createOrchestratorSpies();

vi.mock("./workflow-orchestrator", async () => {
  const actual = await vi.importActual<typeof import("./workflow-orchestrator")>("./workflow-orchestrator");
  return {
    createWorkflowOrchestrator: vi.fn((deps) => {
      const actualOrchestrator = actual.createWorkflowOrchestrator(deps);
      orchestratorSpies = {
        ...createOrchestratorSpies(),
        bootstrapStartScreen: vi.fn(actualOrchestrator.bootstrapStartScreen),
      };
      return orchestratorSpies;
    }),
  };
});

vi.mock("./workout-api", async () => {
  const actual = await vi.importActual<typeof import("./workout-api")>("./workout-api");
  return {
    ...actual,
    loadActiveWorkout: vi.fn(),
    loadGymDetail: vi.fn(),
    loadGymSummaries: vi.fn(),
    loadStationDetail: vi.fn(),
    loadStartScreenData: vi.fn(),
    loadTrainingPlanDetail: vi.fn(),
    loadTrainingPlanSummaries: vi.fn(),
    loadWorkoutDetail: vi.fn(),
    loadWorkoutExercisesPerformance: vi.fn(),
    loadWorkoutHistory: vi.fn(),
    loadWorkoutProgress: vi.fn(),
  };
});

const loadActiveWorkoutMock = vi.mocked(loadActiveWorkout);
const loadGymDetailMock = vi.mocked(loadGymDetail);
const loadGymSummariesMock = vi.mocked(loadGymSummaries);
const loadStationDetailMock = vi.mocked(loadStationDetail);
const loadStartScreenDataMock = vi.mocked(loadStartScreenData);
const loadTrainingPlanDetailMock = vi.mocked(loadTrainingPlanDetail);
const loadTrainingPlanSummariesMock = vi.mocked(loadTrainingPlanSummaries);
const loadWorkoutDetailMock = vi.mocked(loadWorkoutDetail);
const loadWorkoutExercisesPerformanceMock = vi.mocked(loadWorkoutExercisesPerformance);
const loadWorkoutHistoryMock = vi.mocked(loadWorkoutHistory);
const loadWorkoutProgressMock = vi.mocked(loadWorkoutProgress);
let fetchMock: ReturnType<typeof vi.fn>;

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const dispatchInput = (app: HTMLElement, action: string, value: string): void => {
  app.dispatchEvent(new CustomEvent("pb-ui-input", { detail: { action, value } }));
};

const dispatchAction = (app: HTMLElement, action: string): void => {
  app.dispatchEvent(new CustomEvent("pb-ui-action", { detail: { action } }));
};

const dispatchActionWithDetail = (app: HTMLElement, detail: Record<string, unknown>): void => {
  app.dispatchEvent(
    new CustomEvent("pb-ui-action", {
      detail,
      cancelable: true,
    }),
  );
};

const dispatchSideMenuAction = (app: HTMLElement, action: string): void => {
  const menu = document.createElement("pb-side-menu");
  app.append(menu);
  menu.dispatchEvent(
    new CustomEvent("pb-ui-action", {
      bubbles: true,
      composed: true,
      detail: { action },
    }),
  );
  menu.remove();
};

const createGymDetail = (): GymDetailResponse => ({
  id: "gym-1",
  name: "Downtown",
  station_count: 2,
  last_visited_at: null,
  stations: [
    {
      id: "station-1",
      name: "Rack",
      load_profile_name: "Barbell",
      suitable_variant_count: 4,
    },
    {
      id: "station-2",
      name: "Platform",
      load_profile_name: "Olympic",
      suitable_variant_count: 2,
    },
  ],
  exercise_groups: [
    {
      exercise_id: "exercise-1",
      exercise_name: "Pushup",
      variants: [
        {
          variant_id: "variant-stationless",
          variant_name: "Pushup",
          requires_station: false,
          station_availability: "STATIONLESS",
          repetition_kind: "REPS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          station_options: [],
        },
      ],
    },
    {
      exercise_id: "exercise-2",
      exercise_name: "Squat",
      variants: [
        {
          variant_id: "variant-one",
          variant_name: "Box Squat",
          requires_station: true,
          station_availability: "SINGLE_STATION",
          repetition_kind: "REPS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          station_options: [{ station_id: "station-1", station_name: "Rack" }],
        },
        {
          variant_id: "variant-multi",
          variant_name: "Back Squat",
          requires_station: true,
          station_availability: "MULTI_STATION",
          repetition_kind: "REPS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          station_options: [
            { station_id: "station-1", station_name: "Rack" },
            { station_id: "station-2", station_name: "Platform" },
          ],
        },
      ],
    },
  ],
});

const createStationDetail = (stationId = "station-1"): GymStationDetailResponse => ({
  gym_id: "gym-1",
  gym_name: "Downtown",
  station_id: stationId,
  station_name: stationId === "station-2" ? "Platform" : "Rack",
  load_profile: {
    id: "profile-1",
    name: stationId === "station-2" ? "Olympic" : "Barbell",
    weight_unit: "KG",
    definition_kind: "fixed_list",
    possible_loads_kg: [20, 22.5, 25],
  },
  suitable_variant_groups: [
    {
      exercise_id: "exercise-2",
      exercise_name: "Squat",
      variants: [
        {
          variant_id: "variant-one",
          variant_name: "Box Squat",
          repetition_kind: "REPS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
        },
        {
          variant_id: "variant-multi",
          variant_name: "Back Squat",
          repetition_kind: "REPS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
        },
      ],
    },
  ],
});

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
      variants: [],
    },
  ],
  ...overrides,
});

const createTrainingPlanExerciseVariant = (
  overrides: Partial<TrainingPlanExerciseVariantDetail> = {},
): TrainingPlanExerciseVariantDetail => ({
  id: "tpv-1",
  training_plan_exercise_id: "exercise-1",
  variant_id: "variant-1",
  variant_name: "Back Squat",
  requires_station: true,
  rep_min: 8,
  rep_max: 12,
  target_sets: 3,
  repetition_kind: "REPS",
  load_input_mode: "TOTAL",
  set_tracking_mode: "BILATERAL",
  availability: null,
  compatible_stations: [],
  ...overrides,
});

const createSecsModeActiveWorkout = (currentExercisePosition: number): ActiveWorkoutResponse => ({
  workout: {
    id: "active-1",
    training_plan_id: "plan-1",
    training_plan_name: "Leg Day",
    gym_id: "gym-1",
    gym_name: "Downtown",
    started_at: "2026-04-03T10:00:00.000Z",
    updated_at: "2026-04-03T10:00:00.000Z",
    current_exercise_position: currentExercisePosition,
    total_exercise_count: 2,
    exercises: [
      {
        training_plan_exercise_id: "tpe-1",
        position: 1,
        exercise_name: "Split Squat",
        selected_training_plan_exercise_variant_id: "opt-secs-unilateral",
        selected_variant_id: "variant-secs-unilateral",
        selected_variant_name: "Timed Split Squat",
        load_input_mode: "PER_SIDE",
        set_tracking_mode: "UNILATERAL",
        selected_station_id: "station-1",
        selected_station_name: "Rack 1",
        skipped_at: null,
        completed_sets: [
          {
            set_index: 1,
            set_side: "LEFT",
            load_value: 30,
            load_value_per_side: 15,
            repetition_value: 20,
          },
        ],
        suggested_set: {
          set_index: 1,
          set_side: "RIGHT",
          load_value: 30,
          suggested_load_input_kg: 15,
          suggested_load_total_kg: 30,
          repetition_value: 25,
        },
      },
      {
        training_plan_exercise_id: "tpe-2",
        position: 2,
        exercise_name: "Hollow Hold",
        selected_training_plan_exercise_variant_id: "opt-secs-stationless",
        selected_variant_id: "variant-secs-stationless",
        selected_variant_name: "Timed Hold",
        load_input_mode: "TOTAL",
        set_tracking_mode: "BILATERAL",
        selected_station_id: null,
        selected_station_name: null,
        skipped_at: null,
        completed_sets: [],
        suggested_set: {
          set_index: 1,
          set_side: "BILATERAL",
          load_value: null,
          suggested_load_input_kg: null,
          suggested_load_total_kg: null,
          repetition_value: 45,
        },
      },
    ],
  },
});

const secsTrainingPlanOptions: TrainingPlanExerciseVariantsResponse = {
  training_plan_id: "plan-1",
  gym_id: "gym-1",
  exercise_variants: [
    {
      id: "opt-secs-unilateral",
      training_plan_exercise_id: "tpe-1",
      exercise_name: "Split Squat",
      exercise_position: 1,
      variant_id: "variant-secs-unilateral",
      variant_name: "Timed Split Squat",
      repetition_kind: "SECS",
      station_id: "station-1",
      station_name: "Rack 1",
      station_profile_loads_kg: [10, 15, 20],
      suggested_start_load_kg: 15,
      load_input_mode: "PER_SIDE",
    },
    {
      id: "opt-secs-stationless",
      training_plan_exercise_id: "tpe-2",
      exercise_name: "Hollow Hold",
      exercise_position: 2,
      variant_id: "variant-secs-stationless",
      variant_name: "Timed Hold",
      repetition_kind: "SECS",
      station_id: null,
      station_name: "Bodyweight",
      station_profile_loads_kg: [],
      suggested_start_load_kg: null,
      load_input_mode: "TOTAL",
    },
  ],
};

describe("workout-controller (createApp)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    orchestratorSpies = createOrchestratorSpies();
    fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          authenticated: true,
          user: {
            id: "test-user",
            display_name: "Patched Name",
            max_load_kg: 200,
            favorite_gym_id: "gym-1",
          },
        }),
      }));
    vi.stubGlobal("fetch", fetchMock);
    loadActiveWorkoutMock.mockResolvedValue(null);
    loadStartScreenDataMock.mockResolvedValue({
      trainingPlans: [
        { id: "plan-1", name: "Leg Day", exercise_count: 3 },
        { id: "plan-2", name: "Upper Body", exercise_count: 4 },
      ],
      gyms: [
        { id: "gym-1", name: "Downtown" },
        { id: "gym-2", name: "North" },
      ],
    });
    loadWorkoutHistoryMock.mockResolvedValue([]);
    loadWorkoutProgressMock.mockResolvedValue({ workouts: [] });
    loadWorkoutExercisesPerformanceMock.mockResolvedValue({ groups: [] });
    loadGymSummariesMock.mockResolvedValue([]);
    loadGymDetailMock.mockResolvedValue(createGymDetail());
    loadTrainingPlanSummariesMock.mockResolvedValue([]);
    loadTrainingPlanDetailMock.mockResolvedValue(createTrainingPlanDetail());
    loadStationDetailMock.mockImplementation(async (_fetchJson, _gymId, stationId) => createStationDetail(stationId));
    loadWorkoutDetailMock.mockResolvedValue({
      id: "workout-1",
      hero: {
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        duration_minutes: 45,
        gym_name: "Downtown",
      },
      completion_stats: {
        exercise_count: 4,
        completed_set_count: 12,
        average_duration_minutes: 44,
        workout_progress: 0.1,
        workout_progress_status: "AVAILABLE",
      },
      exercises: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates start screen selections through input events", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchInput(app, "select-training-plan", "plan-2");
    expect(app.state?.startScreen.selectedTrainingPlanId).toBe("plan-2");

    dispatchInput(app, "select-gym", "gym-2");
    expect(app.state?.startScreen.selectedGymId).toBe("gym-2");

    dispatchInput(app, "select-workout-mode", "free-mode");
    expect(app.state?.startScreen.selectedWorkoutMode).toBe("free-mode");
  });

  it("preselects favorite gym on start screen when favorite is available", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        favoriteGymId: "gym-2",
      },
    );

    await flush();

    expect(app.state?.startScreen.selectedGymId).toBe("gym-2");
  });

  it("falls back to first gym when favorite gym is unavailable", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        favoriteGymId: "gym-9",
      },
    );

    await flush();

    expect(app.state?.startScreen.selectedGymId).toBe("gym-1");
  });

  it("dispatches start-workout to orchestrator", async () => {
    const app = document.createElement("pb-app-root");

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchAction(app, "start-workout");

    expect(orchestratorSpies.startWorkout).toHaveBeenCalledTimes(1);
  });

  it("switches between workout, progress, exercises, training plans, gyms, history, settings, and about views from side-menu navigation actions", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    expect(app.state?.viewState).toEqual({ screen: "start" });

    dispatchAction(app, "navigate-settings");
    expect(app.state?.viewState).toEqual({ screen: "settings" });

    dispatchAction(app, "navigate-progress");
    await flush();
    expect(app.state?.viewState).toEqual({ screen: "progress" });
    expect(loadWorkoutProgressMock).toHaveBeenCalledTimes(1);

    dispatchAction(app, "navigate-exercises");
    await flush();
    expect(app.state?.viewState).toEqual({ screen: "exercises" });
    expect(loadWorkoutExercisesPerformanceMock).toHaveBeenCalledTimes(1);

    dispatchAction(app, "navigate-training-plans");
    await flush();
    expect(app.state?.viewState).toEqual({ screen: "training-plans" });
    expect(loadTrainingPlanSummariesMock).toHaveBeenCalledTimes(1);

    dispatchAction(app, "navigate-gyms");
    await flush();
    expect(app.state?.viewState).toEqual({ screen: "gyms" });
    expect(loadGymSummariesMock).toHaveBeenCalledTimes(1);

    dispatchAction(app, "navigate-history");
    await flush();
    expect(app.state?.viewState).toEqual({ screen: "history" });
    expect(loadWorkoutHistoryMock).toHaveBeenCalledTimes(1);

    dispatchAction(app, "navigate-about");
    expect(app.state?.viewState).toEqual({ screen: "about" });

    dispatchAction(app, "navigate-workout");
    expect(app.state?.viewState).toEqual({ screen: "start" });

    dispatchAction(app, "navigate-about");
    expect(app.state?.viewState).toEqual({ screen: "about" });

    dispatchAction(app, "navigate-settings");
    expect(app.state?.viewState).toEqual({ screen: "settings" });
  });

  it("persists successful side-menu middle navigation counts for the authenticated user", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      { id: "user-a", displayName: "Casey" },
    );

    await flush();

    dispatchSideMenuAction(app, "navigate-history");
    dispatchSideMenuAction(app, "navigate-gyms");

    const counts = JSON.parse(window.localStorage.getItem(resolveSideMenuStorageKey("user-a")) ?? "{}");
    expect(counts.history).toBe(1);
    expect(counts.gyms).toBe(1);
    expect(counts.progress).toBe(0);
  });

  it("does not count non-menu, current-screen, or cross-user middle navigation", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      { id: "user-a", displayName: "Casey" },
    );

    await flush();

    dispatchAction(app, "navigate-history");
    expect(window.localStorage.getItem(resolveSideMenuStorageKey("user-a"))).toBeNull();

    dispatchSideMenuAction(app, "navigate-gyms");
    dispatchSideMenuAction(app, "navigate-gyms");

    const userACounts = JSON.parse(window.localStorage.getItem(resolveSideMenuStorageKey("user-a")) ?? "{}");
    expect(userACounts.history).toBe(0);
    expect(userACounts.gyms).toBe(1);

    const secondApp = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    createApp(
      secondApp,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      { id: "user-b", displayName: "Morgan" },
    );

    await flush();
    dispatchSideMenuAction(secondApp, "navigate-gyms");

    const userBCounts = JSON.parse(window.localStorage.getItem(resolveSideMenuStorageKey("user-b")) ?? "{}");
    expect(userACounts.gyms).toBe(1);
    expect(userBCounts.gyms).toBe(1);
  });

  it("loads exercises performance data when entering exercises screen and stores results", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutExercisesPerformanceMock.mockResolvedValueOnce({
      groups: [
        {
          tone: "GREEN",
          rows: [
            {
              variant_id: "variant-1",
              variant_name: "Barbell Squat",
              last_performed_at: "2026-04-18T10:45:00.000Z",
              last_performed_days_ago: 3,
              last_performed_first_set_display: "100 kg x 5 reps",
              selected_station_average_score_30d: 1.06,
              variant_session_count_30d: 5,
              performance_status: "AVAILABLE",
              performance_tone: "GREEN",
            },
          ],
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-exercises");
    await flush();

    expect(app.state?.exercisesScreen.isLoading).toBe(false);
    expect(app.state?.exercisesScreen.errorMessage).toBeNull();
    expect(app.state?.exercisesScreen.hasLoaded).toBe(true);
    expect(app.state?.exercisesScreen.groups).toHaveLength(1);
    expect(app.state?.exercisesScreen.groups[0]?.rows[0]?.variant_id).toBe("variant-1");
  });

  it("loads gyms data when entering gyms screen and stores results", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadGymSummariesMock.mockResolvedValueOnce([
      {
        id: "gym-1",
        name: "Downtown",
        station_count: 8,
        last_visited_at: "2026-04-17T10:45:00.000Z",
      },
    ]);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();

    expect(app.state?.gymsScreen.isLoading).toBe(false);
    expect(app.state?.gymsScreen.errorMessage).toBeNull();
    expect(app.state?.gymsScreen.hasLoaded).toBe(true);
    expect(app.state?.gymsScreen.gyms).toHaveLength(1);
    expect(app.state?.gymsScreen.gyms[0]?.id).toBe("gym-1");
  });

  it("opens training plan detail browsing without changing workout start selections", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadTrainingPlanSummariesMock.mockResolvedValueOnce([
      {
        id: "plan-2",
        name: "Upper Body",
        exercise_count: 4,
        last_completed_at: null,
      },
    ]);
    loadTrainingPlanDetailMock.mockResolvedValueOnce(
      createTrainingPlanDetail({
        id: "plan-2",
        name: "Upper Body",
        exercises: [
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            configured_variant_count: 1,
            executable_variant_count: null,
            execution_status: null,
            variants: [],
          },
        ],
      }),
    );
    loadTrainingPlanDetailMock.mockResolvedValueOnce(
      createTrainingPlanDetail({
        id: "plan-2",
        name: "Upper Body",
        selected_gym_id: "gym-1",
        is_executable: true,
        execution_status: "GREEN",
        execution_summary: "Ready at Downtown.",
      }),
    );

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    const startTrainingPlanId = app.state?.startScreen.selectedTrainingPlanId;
    const startGymId = app.state?.startScreen.selectedGymId;

    dispatchAction(app, "navigate-training-plans");
    await flush();
    expect(app.state?.viewState).toEqual({ screen: "training-plans" });
    expect(app.state?.trainingPlansScreen.trainingPlans[0]?.id).toBe("plan-2");

    dispatchActionWithDetail(app, {
      action: "open-training-plan-detail",
      payload: { trainingPlanId: "plan-2" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({
      screen: "training-plan-detail",
      trainingPlanId: "plan-2",
      selectedGymId: null,
    });
    expect(loadTrainingPlanDetailMock).toHaveBeenCalledWith(expect.any(Function), "plan-2", null);
    expect(app.state?.trainingPlanDetailScreen.detail?.id).toBe("plan-2");
    expect(app.state?.startScreen.selectedTrainingPlanId).toBe(startTrainingPlanId);
    expect(app.state?.startScreen.selectedGymId).toBe(startGymId);
    expect(orchestratorSpies.startWorkout).not.toHaveBeenCalled();

    dispatchActionWithDetail(app, {
      action: "select-training-plan-detail-gym",
      payload: { selectedGymId: "gym-1" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({
      screen: "training-plan-detail",
      trainingPlanId: "plan-2",
      selectedGymId: "gym-1",
    });
    expect(loadTrainingPlanDetailMock).toHaveBeenLastCalledWith(expect.any(Function), "plan-2", "gym-1");
    expect(app.state?.trainingPlanDetailScreen.detail?.selected_gym_id).toBe("gym-1");
    expect(app.state?.startScreen.selectedTrainingPlanId).toBe(startTrainingPlanId);
    expect(app.state?.startScreen.selectedGymId).toBe(startGymId);
    expect(orchestratorSpies.startWorkout).not.toHaveBeenCalled();
  });

  it("browses training plan exercise details without a gym and guards station navigation", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadTrainingPlanDetailMock.mockResolvedValueOnce(
      createTrainingPlanDetail({
        selected_gym_id: null,
        exercises: [
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Squat",
            exercise_position: 1,
            configured_variant_count: 2,
            executable_variant_count: null,
            execution_status: null,
            variants: [
              createTrainingPlanExerciseVariant({
                availability: "NOT_AVAILABLE",
                compatible_stations: [{ station_id: "station-1", station_name: "Rack" }],
              }),
              createTrainingPlanExerciseVariant({
                id: "tpv-2",
                variant_id: "variant-2",
                variant_name: "Goblet Squat",
                requires_station: false,
                availability: "AVAILABLE",
              }),
            ],
          },
        ],
      }),
    );

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-training-plans");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-training-plan-detail",
      payload: { trainingPlanId: "plan-1" },
    });
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-detail",
      payload: { trainingPlanExerciseId: "exercise-1" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: null,
    });
    expect(
      app.state?.trainingPlanDetailScreen.detail?.exercises[0]?.variants.map(
        (variant: TrainingPlanExerciseVariantDetail) => variant.variant_name,
      ),
    ).toEqual(["Back Squat", "Goblet Squat"]);

    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-station-detail",
      payload: { stationId: "station-1" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: null,
    });
    expect(loadStationDetailMock).not.toHaveBeenCalled();

    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-variant-detail",
      payload: { variantId: "variant-1" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "exercise-variant-detail",
      variantId: "variant-1",
      returnScreen: "training-plan-exercise-detail",
      returnTrainingPlanId: "plan-1",
      returnTrainingPlanExerciseId: "exercise-1",
      returnSelectedGymId: null,
      fallbackExerciseName: "Squat",
      fallbackVariantName: "Back Squat",
    });

    dispatchAction(app, "navigate-back-from-variant-detail");

    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: null,
    });
  });

  it("opens training plan exercise child detail routes with return context", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadTrainingPlanDetailMock.mockResolvedValueOnce(
      createTrainingPlanDetail({
        selected_gym_id: "gym-1",
        is_executable: true,
        execution_status: "GREEN",
        execution_summary: null,
        exercises: [
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Squat",
            exercise_position: 1,
            configured_variant_count: 1,
            executable_variant_count: 1,
            execution_status: "GREEN",
            variants: [
              createTrainingPlanExerciseVariant({
                availability: "AVAILABLE",
                compatible_stations: [{ station_id: "station-1", station_name: "Rack" }],
              }),
              createTrainingPlanExerciseVariant({
                id: "tpv-2",
                variant_id: "variant-2",
                variant_name: "Machine Squat",
                availability: "NOT_AVAILABLE",
                compatible_stations: [],
              }),
            ],
          },
        ],
      }),
    );

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-training-plans");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-training-plan-detail",
      payload: { trainingPlanId: "plan-1", selectedGymId: "gym-1" },
    });
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-detail",
      payload: { trainingPlanExerciseId: "exercise-1" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: "gym-1",
    });
    expect(
      app.state?.trainingPlanDetailScreen.detail?.exercises[0]?.variants.find(
        (variant: TrainingPlanExerciseVariantDetail) => variant.variant_id === "variant-2",
      ),
    ).toMatchObject({
      variant_name: "Machine Squat",
      availability: "NOT_AVAILABLE",
      compatible_stations: [],
    });

    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-variant-detail",
      payload: { variantId: "variant-1" },
    });
    expect(app.state?.viewState).toEqual({
      screen: "exercise-variant-detail",
      variantId: "variant-1",
      returnScreen: "training-plan-exercise-detail",
      returnTrainingPlanId: "plan-1",
      returnTrainingPlanExerciseId: "exercise-1",
      returnSelectedGymId: "gym-1",
      fallbackExerciseName: "Squat",
      fallbackVariantName: "Back Squat",
    });

    dispatchAction(app, "navigate-back-from-variant-detail");
    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: "gym-1",
    });

    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-station-detail",
      payload: { stationId: "station-2" },
    });
    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: "gym-1",
    });
    expect(loadStationDetailMock).not.toHaveBeenCalled();

    dispatchActionWithDetail(app, {
      action: "open-training-plan-exercise-station-detail",
      payload: { stationId: "station-1" },
    });
    await flush();
    expect(app.state?.viewState).toEqual({
      screen: "station-detail",
      gymId: "gym-1",
      stationId: "station-1",
      returnScreen: "training-plan-exercise-detail",
      returnTrainingPlanId: "plan-1",
      returnTrainingPlanExerciseId: "exercise-1",
      returnSelectedGymId: "gym-1",
    });
    expect(loadStationDetailMock).toHaveBeenLastCalledWith(expect.any(Function), "gym-1", "station-1");

    dispatchAction(app, "navigate-back-from-station-detail");
    expect(app.state?.viewState).toEqual({
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: "gym-1",
    });
  });

  it("opens gym detail from gyms screen while preserving selected gym id", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadGymSummariesMock.mockResolvedValueOnce([
      { id: "gym-1", name: "Downtown", station_count: 8, last_visited_at: null },
      { id: "gym-2", name: "North", station_count: 4, last_visited_at: null },
    ]);
    loadGymDetailMock.mockResolvedValueOnce({
      ...createGymDetail(),
      id: "gym-2",
      name: "North",
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-2" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({ screen: "gym-detail", gymId: "gym-2" });
    expect(app.state?.gymsScreen.gyms[1]?.id).toBe("gym-2");
    expect(loadGymDetailMock).toHaveBeenCalledWith(expect.any(Function), "gym-2");
    expect(app.state?.gymDetailScreen).toMatchObject({
      gymId: "gym-2",
      activeSheet: "stations",
      isLoading: false,
      errorMessage: null,
      detail: expect.objectContaining({ id: "gym-2", name: "North" }),
      stationChooser: null,
    });
  });

  it("switches gym detail sheets without losing gym context", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "switch-gym-detail-sheet",
      payload: { sheet: "exercises" },
    });

    expect(app.state?.viewState).toEqual({ screen: "gym-detail", gymId: "gym-1" });
    expect(app.state?.gymDetailScreen.activeSheet).toBe("exercises");
  });

  it("opens station detail from gym detail station rows and returns to the gym", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-station-detail",
      payload: { stationId: "station-1" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({
      screen: "station-detail",
      gymId: "gym-1",
      stationId: "station-1",
    });
    expect(loadStationDetailMock).toHaveBeenCalledWith(expect.any(Function), "gym-1", "station-1");
    expect(app.state?.stationDetailScreen).toMatchObject({
      gymId: "gym-1",
      stationId: "station-1",
      isLoading: false,
      errorMessage: null,
      detail: expect.objectContaining({ station_id: "station-1", station_name: "Rack" }),
      loadProfilePopupOpen: false,
    });

    dispatchAction(app, "navigate-back-from-station-detail");

    expect(app.state?.viewState).toEqual({ screen: "gym-detail", gymId: "gym-1" });
  });

  it("opens variant detail from station detail and returns to the same station", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-station-detail",
      payload: { stationId: "station-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-station-variant-detail",
      payload: { variantId: "variant-multi" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "exercise-variant-detail",
      variantId: "variant-multi",
      returnScreen: "station-detail",
      returnGymId: "gym-1",
      returnStationId: "station-1",
      fallbackExerciseName: "Squat",
      fallbackVariantName: "Back Squat",
    });

    dispatchAction(app, "navigate-back-from-variant-detail");

    expect(app.state?.viewState).toEqual({
      screen: "station-detail",
      gymId: "gym-1",
      stationId: "station-1",
    });
  });

  it("toggles the station load profile popup only from station detail actions", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();

    dispatchAction(app, "open-station-load-profile");
    expect(app.state?.stationDetailScreen.loadProfilePopupOpen).toBe(false);

    dispatchActionWithDetail(app, {
      action: "open-station-detail",
      payload: { stationId: "station-1" },
    });
    await flush();

    dispatchAction(app, "open-station-load-profile");
    expect(app.state?.stationDetailScreen.loadProfilePopupOpen).toBe(true);

    dispatchAction(app, "dismiss-station-load-profile");
    expect(app.state?.stationDetailScreen.loadProfilePopupOpen).toBe(false);
  });

  it("routes stationless gym variants to variant detail with gym fallback context", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-gym-variant",
      payload: { variantId: "variant-stationless" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "exercise-variant-detail",
      variantId: "variant-stationless",
      returnScreen: "gym-detail",
      returnGymId: "gym-1",
      fallbackExerciseName: "Pushup",
      fallbackVariantName: "Pushup",
    });

    dispatchAction(app, "navigate-back-from-variant-detail");

    expect(app.state?.viewState).toEqual({ screen: "gym-detail", gymId: "gym-1" });
  });

  it("routes one-station gym variants directly to station detail", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-gym-variant",
      payload: { variantId: "variant-one" },
    });

    expect(app.state?.viewState).toEqual({
      screen: "station-detail",
      gymId: "gym-1",
      stationId: "station-1",
    });
  });

  it("routes multi-station gym variants through a compact station chooser", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-gym-variant",
      payload: { variantId: "variant-multi" },
    });

    expect(app.state?.viewState).toEqual({ screen: "gym-detail", gymId: "gym-1" });
    expect(app.state?.gymDetailScreen.stationChooser).toMatchObject({
      variantId: "variant-multi",
      exerciseName: "Squat",
      variantName: "Back Squat",
      stationOptions: [
        { station_id: "station-2", station_name: "Platform" },
        { station_id: "station-1", station_name: "Rack" },
      ],
    });

    dispatchActionWithDetail(app, {
      action: "choose-gym-variant-station",
      payload: { stationId: "station-2" },
    });

    expect(app.state?.gymDetailScreen.stationChooser).toBeNull();
    expect(app.state?.viewState).toEqual({
      screen: "station-detail",
      gymId: "gym-1",
      stationId: "station-2",
    });
  });

  it("dismisses the gym variant station chooser without leaving gym detail", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-gyms");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-gym-variant",
      payload: { variantId: "variant-multi" },
    });

    dispatchAction(app, "dismiss-gym-station-chooser");

    expect(app.state?.viewState).toEqual({ screen: "gym-detail", gymId: "gym-1" });
    expect(app.state?.gymDetailScreen.stationChooser).toBeNull();
  });

  it("opens exercise variant detail from exercises and restores saved scroll on back", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutExercisesPerformanceMock.mockResolvedValueOnce({
      groups: [
        {
          tone: "GREEN",
          rows: [
            {
              variant_id: "variant-1",
              variant_name: "Barbell Squat",
              last_performed_at: "2026-04-18T10:45:00.000Z",
              last_performed_days_ago: 3,
              last_performed_first_set_display: "100 kg x 5 reps",
              selected_station_average_score_30d: 1.06,
              variant_session_count_30d: 5,
              performance_status: "AVAILABLE",
              performance_tone: "GREEN",
            },
          ],
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-exercises");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-exercise-variant-detail",
      payload: { variantId: "variant-1", scrollY: 420 },
    });

    expect(app.state?.viewState).toEqual({
      screen: "exercise-variant-detail",
      variantId: "variant-1",
      returnScreen: "exercises",
    });
    expect(app.state?.exercisesScreen.restoreScrollY).toBe(420);

    dispatchAction(app, "navigate-exercises");
    expect(app.state?.viewState).toEqual({ screen: "exercises" });
    expect(loadWorkoutExercisesPerformanceMock).toHaveBeenCalledTimes(1);
    expect(app.state?.exercisesScreen.restoreScrollY).toBe(420);

    dispatchActionWithDetail(app, {
      action: "exercises-restore-complete",
      payload: { scrollY: 420 },
    });

    expect(app.state?.exercisesScreen.restoreScrollY).toBeNull();
  });

  it("opens exercise variant detail from workout detail and keeps non-exercises guard behavior", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockResolvedValueOnce([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);
    loadWorkoutDetailMock.mockResolvedValueOnce({
      id: "workout-1",
      hero: {
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        duration_minutes: 45,
        gym_name: "Downtown",
      },
      completion_stats: {
        exercise_count: 1,
        completed_set_count: 2,
        average_duration_minutes: 44,
        workout_progress: 0.1,
        workout_progress_status: "AVAILABLE",
      },
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          variant_id: "variant-1",
          exercise_position: 1,
          exercise_name: "Barbell Squat",
          variant_name: "Barbell",
          station_name: "Rack",
          set_tracking_mode: "BILATERAL",
          repetition_kind: "REPS",
          sets: [],
        },
      ],
    });
    loadWorkoutExercisesPerformanceMock.mockResolvedValueOnce({
      groups: [
        {
          tone: "GREEN",
          rows: [
            {
              variant_id: "variant-1",
              variant_name: "Barbell",
              last_performed_at: "2026-04-18T10:45:00.000Z",
              last_performed_days_ago: 3,
              last_performed_first_set_display: "100 kg x 5 reps",
              selected_station_average_score_30d: 1.06,
              variant_session_count_30d: 5,
              performance_status: "AVAILABLE",
              performance_tone: "GREEN",
            },
          ],
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();
    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-1" },
    });
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-exercise-variant-detail",
      payload: { variantId: "variant-1" },
    });
    expect(app.state?.viewState).toEqual({
      screen: "exercise-variant-detail",
      variantId: "variant-1",
      returnScreen: "workout-detail",
      returnWorkoutId: "workout-1",
    });
    expect(app.state?.exercisesScreen.restoreScrollY).toBeNull();
    expect(loadWorkoutExercisesPerformanceMock).toHaveBeenCalledTimes(1);

    dispatchAction(app, "navigate-back-from-variant-detail");
    expect(app.state?.viewState).toEqual({ screen: "workout-detail", workoutId: "workout-1" });

    dispatchAction(app, "navigate-history");
    dispatchActionWithDetail(app, {
      action: "open-exercise-variant-detail",
      payload: { variantId: "variant-1" },
    });
    expect(app.state?.viewState).toEqual({ screen: "history" });
  });

  it("loads history data when entering history screen and stores results", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockResolvedValueOnce([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    expect(app.state?.historyScreen.isLoading).toBe(false);
    expect(app.state?.historyScreen.errorMessage).toBeNull();
    expect(app.state?.historyScreen.hasLoaded).toBe(true);
    expect(app.state?.historyScreen.workouts).toHaveLength(1);
    expect(app.state?.historyScreen.workouts[0]?.id).toBe("workout-1");
  });

  it("refreshes history data on every sidebar re-entry and shows latest results", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock
      .mockResolvedValueOnce([
        {
          id: "workout-1",
          training_plan_name: "Leg Day",
          started_at: "2026-04-17T10:00:00.000Z",
          completed_at: "2026-04-17T10:45:00.000Z",
          gym_name: "Downtown",
          duration_minutes: 45,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "workout-2",
          training_plan_name: "Upper Body",
          started_at: "2026-04-18T11:00:00.000Z",
          completed_at: "2026-04-18T11:50:00.000Z",
          gym_name: "North",
          duration_minutes: 50,
        },
      ]);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    expect(loadWorkoutHistoryMock).toHaveBeenCalledTimes(1);
    expect(app.state?.historyScreen.workouts[0]?.id).toBe("workout-1");

    dispatchAction(app, "navigate-workout");
    dispatchAction(app, "navigate-history");
    await flush();

    expect(loadWorkoutHistoryMock).toHaveBeenCalledTimes(2);
    expect(app.state?.historyScreen.workouts[0]?.id).toBe("workout-2");
  });

  it("avoids duplicate concurrent history fetches during rapid route switching", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    let resolveHistoryFetch: ((value: any) => void) | null = null;
    const inFlightHistoryFetch = new Promise((resolve) => {
      resolveHistoryFetch = resolve;
    });
    loadWorkoutHistoryMock.mockReturnValueOnce(inFlightHistoryFetch as Promise<any>);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    dispatchAction(app, "navigate-workout");
    dispatchAction(app, "navigate-history");
    await flush();

    expect(loadWorkoutHistoryMock).toHaveBeenCalledTimes(1);

    resolveHistoryFetch?.([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);
    await flush();

    expect(app.state?.historyScreen.isLoading).toBe(false);
  });

  it("captures history load errors and keeps state retriable", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockRejectedValueOnce(new Error("network"));

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    expect(app.state?.historyScreen.isLoading).toBe(false);
    expect(app.state?.historyScreen.hasLoaded).toBe(false);
    expect(app.state?.historyScreen.errorMessage).toBe("Unable to load workout history right now.");
  });

  it("opens workout detail from history row action and stores restore anchor", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockResolvedValueOnce([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-1" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({ screen: "workout-detail", workoutId: "workout-1" });
    expect(app.state?.historyScreen.restoreWorkoutId).toBe("workout-1");
    expect(loadWorkoutDetailMock).toHaveBeenCalledWith(expect.any(Function), "workout-1");
    expect(app.state?.workoutDetailScreen?.detail?.id).toBe("workout-1");
  });

  it("opens workout detail from progress day action without changing history restore anchor", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutProgressMock.mockResolvedValueOnce({
      workouts: [
        {
          id: "workout-9",
          training_plan_name: "Push Day",
          completed_at: "2026-04-19T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-progress");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-9" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({ screen: "workout-detail", workoutId: "workout-9", returnScreen: "progress" });
    expect(app.state?.historyScreen.restoreWorkoutId).toBeNull();
    expect(app.state?.progressScreen.selectedWorkoutId).toBe("workout-9");
    expect(loadWorkoutDetailMock).toHaveBeenCalledWith(expect.any(Function), "workout-9");
    expect(app.state?.workoutDetailScreen?.workoutId).toBe("workout-9");
  });

  it("returns from progress-origin workout detail to progress", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutProgressMock.mockResolvedValueOnce({
      workouts: [
        {
          id: "workout-9",
          training_plan_name: "Push Day",
          completed_at: "2026-04-19T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-progress");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-9" },
    });
    expect(app.state?.viewState).toEqual({ screen: "workout-detail", workoutId: "workout-9", returnScreen: "progress" });

    dispatchAction(app, "navigate-history");

    expect(app.state?.viewState).toEqual({ screen: "progress" });
    expect(app.state?.historyScreen.restoreWorkoutId).toBeNull();
    expect(app.state?.progressScreen.selectedWorkoutId).toBe("workout-9");
    expect(loadWorkoutHistoryMock).not.toHaveBeenCalled();
  });

  it("clears the progress heatmap selection after leaving progress", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutProgressMock.mockResolvedValueOnce({
      workouts: [
        {
          id: "workout-9",
          training_plan_name: "Push Day",
          completed_at: "2026-04-19T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-progress");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-9" },
    });
    expect(app.state?.progressScreen.selectedWorkoutId).toBe("workout-9");

    dispatchAction(app, "navigate-history");
    expect(app.state?.viewState).toEqual({ screen: "progress" });
    expect(app.state?.progressScreen.selectedWorkoutId).toBe("workout-9");

    dispatchAction(app, "navigate-settings");

    expect(app.state?.viewState).toEqual({ screen: "settings" });
    expect(app.state?.progressScreen.selectedWorkoutId).toBeNull();
  });

  it("keeps mixed detail payload and restore anchor stable across detail back-navigation", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockResolvedValueOnce([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);
    loadWorkoutDetailMock.mockResolvedValueOnce({
      id: "workout-1",
      hero: {
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        duration_minutes: 45,
        gym_name: "Downtown",
      },
      completion_stats: {
        exercise_count: 2,
        completed_set_count: 3,
        average_duration_minutes: 44,
        workout_progress: 0.1,
        workout_progress_status: "AVAILABLE",
      },
      exercises: [
        {
          training_plan_exercise_id: "tpe-unilateral",
          exercise_position: 2,
          exercise_name: "Split Squat",
          variant_name: "Dumbbell",
          station_name: "Rack 2",
          set_tracking_mode: "UNILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 1,
              set_side: "LEFT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 10,
            },
            {
              set_index: 1,
              set_side: "RIGHT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 9,
            },
          ],
        },
        {
          training_plan_exercise_id: "tpe-timed",
          exercise_position: 1,
          exercise_name: "Plank",
          variant_name: null,
          station_name: null,
          set_tracking_mode: "BILATERAL",
          repetition_kind: "SECS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: null,
              repetition_kind: "SECS",
              repetition_value: 45,
            },
          ],
        },
      ],
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-1" },
    });
    await flush();

    expect(app.state?.viewState).toEqual({ screen: "workout-detail", workoutId: "workout-1" });
    expect(app.state?.workoutDetailScreen?.detail?.exercises[0]?.sets).toEqual([
      {
        set_index: 1,
        set_side: "LEFT",
        load_value: 18,
        repetition_kind: "REPS",
        repetition_value: 10,
      },
      {
        set_index: 1,
        set_side: "RIGHT",
        load_value: 18,
        repetition_kind: "REPS",
        repetition_value: 9,
      },
    ]);
    expect(app.state?.workoutDetailScreen?.detail?.exercises[1]?.sets[0]).toEqual({
      set_index: 1,
      set_side: "BILATERAL",
      load_value: null,
      repetition_kind: "SECS",
      repetition_value: 45,
    });

    dispatchAction(app, "navigate-history");
    expect(app.state?.viewState).toEqual({ screen: "history" });
    expect(app.state?.historyScreen.restoreWorkoutId).toBe("workout-1");
    expect(loadWorkoutHistoryMock).toHaveBeenCalledTimes(1);

    dispatchActionWithDetail(app, {
      action: "history-restore-complete",
      payload: { workoutId: "workout-1", restored: true },
    });
    expect(app.state?.historyScreen.restoreWorkoutId).toBeNull();
  });

  it("returns from workout detail to history without forcing a history reload", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockResolvedValueOnce([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-1" },
    });
    expect(app.state?.viewState).toEqual({ screen: "workout-detail", workoutId: "workout-1" });

    dispatchAction(app, "navigate-history");

    expect(app.state?.viewState).toEqual({ screen: "history" });
    expect(app.state?.historyScreen.restoreWorkoutId).toBe("workout-1");
    expect(loadWorkoutHistoryMock).toHaveBeenCalledTimes(1);
  });

  it("clears history restore anchor after restoration completion signal", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    loadWorkoutHistoryMock.mockResolvedValueOnce([
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();
    dispatchAction(app, "navigate-history");
    await flush();

    dispatchActionWithDetail(app, {
      action: "open-workout-detail",
      payload: { workoutId: "workout-1" },
    });
    dispatchAction(app, "navigate-history");
    expect(app.state?.historyScreen.restoreWorkoutId).toBe("workout-1");

    dispatchActionWithDetail(app, {
      action: "history-restore-complete",
      payload: { workoutId: "workout-1", restored: true },
    });

    expect(app.state?.historyScreen.restoreWorkoutId).toBeNull();
  });

  it("persists display-name save in app state across settings navigation", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        maxLoadKg: 200,
        favoriteGymId: "gym-1",
      },
    );

    await flush();
    expect(app.state?.sessionUser?.displayName).toBe("Casey");

    dispatchAction(app, "navigate-settings");
    const respond = vi.fn();
    dispatchActionWithDetail(app, {
      action: "save-display-name",
      payload: { displayName: "Casey Updated" },
      respond,
    });
    await flush();

    expect(respond).toHaveBeenCalledWith({ ok: true });
    expect(app.state?.sessionUser?.displayName).toBe("Patched Name");
    expect(app.state?.sessionUser?.favoriteGymId).toBe("gym-1");
    expect(fetchMock).toHaveBeenCalledWith("/auth/session", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ display_name: "Casey Updated" }),
    });

    dispatchAction(app, "navigate-workout");
    dispatchAction(app, "navigate-settings");
    expect(app.state?.sessionUser?.displayName).toBe("Patched Name");
  });

  it("persists favorite-gym save in app state across settings navigation", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: {
          id: "user-1",
          display_name: "Casey",
          favorite_gym_id: "gym-2",
        },
      }),
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        maxLoadKg: 200,
        favoriteGymId: "gym-1",
      },
    );

    await flush();
    expect(app.state?.sessionUser?.favoriteGymId).toBe("gym-1");

    dispatchAction(app, "navigate-settings");
    const respond = vi.fn();
    dispatchActionWithDetail(app, {
      action: "save-favorite-gym",
      payload: { favoriteGymId: "gym-2" },
      respond,
    });
    await flush();

    expect(respond).toHaveBeenCalledWith({ ok: true });
    expect(app.state?.sessionUser?.favoriteGymId).toBe("gym-2");
    expect(app.state?.startScreen.selectedGymId).toBe("gym-2");
    expect(fetchMock).toHaveBeenCalledWith("/auth/session", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        display_name: "Casey",
        favorite_gym_id: "gym-2",
      }),
    });

    dispatchAction(app, "navigate-workout");
    dispatchAction(app, "navigate-settings");
    expect(app.state?.sessionUser?.favoriteGymId).toBe("gym-2");
  });

  it("persists max-load save in app state across settings navigation", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: {
          id: "user-1",
          display_name: "Casey",
          max_load_kg: 260,
          favorite_gym_id: "gym-1",
        },
      }),
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        maxLoadKg: 200,
        favoriteGymId: "gym-1",
      },
    );

    await flush();
    expect(app.state?.sessionUser?.maxLoadKg).toBe(200);

    dispatchAction(app, "navigate-settings");
    const respond = vi.fn();
    dispatchActionWithDetail(app, {
      action: "save-max-load",
      payload: { maxLoadKg: 260 },
      respond,
    });
    await flush();

    expect(respond).toHaveBeenCalledWith({ ok: true });
    expect(app.state?.sessionUser?.maxLoadKg).toBe(260);
    expect(fetchMock).toHaveBeenCalledWith("/auth/session", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        display_name: "Casey",
        max_load_kg: 260,
      }),
    });

    dispatchAction(app, "navigate-workout");
    dispatchAction(app, "navigate-settings");
    expect(app.state?.sessionUser?.maxLoadKg).toBe(260);
  });

  it("rejects out-of-bounds max-load saves without calling auth session patch", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        maxLoadKg: 200,
        favoriteGymId: "gym-1",
      },
    );

    await flush();
    dispatchAction(app, "navigate-settings");

    const respond = vi.fn();
    dispatchActionWithDetail(app, {
      action: "save-max-load",
      payload: { maxLoadKg: 99 },
      respond,
    });

    expect(respond).toHaveBeenCalledWith({
      ok: false,
      errorMessage: "Max load must be between 100 and 999 kg.",
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/auth/session",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });

  it("submits password changes through the auth password endpoint", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const unauthorizedListener = vi.fn();
    window.addEventListener("pb-unauthorized", unauthorizedListener as EventListener);

    try {
      createApp(
        app,
        vi.fn(),
        {
          createActiveWorkout: vi.fn(),
          updateActiveWorkout: vi.fn(),
          cancelActiveWorkout: vi.fn(),
          completeActiveWorkout: vi.fn(),
        } as any,
        () => "now",
        {
          id: "user-1",
          displayName: "Casey",
          maxLoadKg: 200,
          favoriteGymId: "gym-1",
        },
      );

      await flush();
      dispatchAction(app, "navigate-settings");

      const respond = vi.fn();
      dispatchActionWithDetail(app, {
        action: "save-password",
        payload: {
          currentPassword: "old-secret",
          newPassword: "new-secret",
          confirmNewPassword: "new-secret",
        },
        respond,
      });
      await flush();

      expect(respond).toHaveBeenCalledWith({ ok: true });
      expect(app.state?.sessionUser).toBeNull();
      expect(unauthorizedListener).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          current_password: "old-secret",
          new_password: "new-secret",
          confirm_new_password: "new-secret",
        }),
      });
    } finally {
      window.removeEventListener("pb-unauthorized", unauthorizedListener as EventListener);
    }
  });

  it("returns password endpoint errors to the settings save responder", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        message: "Current password is incorrect.",
      }),
    });

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
      {
        id: "user-1",
        displayName: "Casey",
        maxLoadKg: 200,
        favoriteGymId: "gym-1",
      },
    );

    await flush();
    dispatchAction(app, "navigate-settings");

    const respond = vi.fn();
    dispatchActionWithDetail(app, {
      action: "save-password",
      payload: {
        currentPassword: "wrong-secret",
        newPassword: "new-secret",
        confirmNewPassword: "new-secret",
      },
      respond,
    });
    await flush();

    expect(respond).toHaveBeenCalledWith({
      ok: false,
      errorMessage: "Current password is incorrect.",
    });
  });

  it("dispatches global logout event from side-menu logout action", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const logoutListener = vi.fn();
    window.addEventListener("pb-logout", logoutListener as EventListener);

    try {
      createApp(
        app,
        vi.fn(),
        {
          createActiveWorkout: vi.fn(),
          updateActiveWorkout: vi.fn(),
          cancelActiveWorkout: vi.fn(),
          completeActiveWorkout: vi.fn(),
        } as any,
        () => "now",
      );

      await flush();

      dispatchAction(app, "logout");
      expect(logoutListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("pb-logout", logoutListener as EventListener);
    }
  });

  it("opens and confirms cancel-workout dialog", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchAction(app, "cancel-workout");
    expect(app.state?.confirmDialog.message).toContain("Cancel this workout");

    dispatchAction(app, "confirm-dialog-confirm");
    await flush();

    expect(orchestratorSpies.cancelWorkout).toHaveBeenCalledTimes(1);
    expect(app.state?.confirmDialog.message).toBe(null);
  });

  it("opens and confirms delete-latest-set dialog", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchAction(app, "delete-latest-set");
    expect(app.state?.confirmDialog.message).toBe("Delete the latest completed set?");
    expect(app.state?.confirmDialog.confirmActionLabel).toBe("Delete Set");

    dispatchAction(app, "confirm-dialog-confirm");
    await flush();

    expect(orchestratorSpies.persistDeleteLatestSet).toHaveBeenCalledTimes(1);
    expect(app.state?.confirmDialog.message).toBe(null);
  });

  it("returns a confirmed multi-option exercise to selection without persisting immediately", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => ({
      ...secsTrainingPlanOptions,
      exercise_variants: [
        secsTrainingPlanOptions.exercise_variants[0],
        {
          ...secsTrainingPlanOptions.exercise_variants[0],
          id: "opt-secs-unilateral-alt",
          variant_id: "variant-secs-unilateral-alt",
          variant_name: "Timed Split Squat Alt",
          station_id: "station-2",
          station_name: "Rack 2",
        },
        secsTrainingPlanOptions.exercise_variants[1],
      ],
    })) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    app.state.workoutPlan.exercises[0].fallbackOptions = [
      {
        id: "opt-secs-unilateral",
        training_plan_exercise_id: "tpe-1",
        exercise_name: "Split Squat",
        exercise_position: 1,
        variant_id: "variant-secs-unilateral",
        variant_name: "Timed Split Squat",
        repetition_kind: "SECS",
        station_id: "station-1",
        station_name: "Rack 1",
        station_profile_loads_kg: [10, 15, 20],
        suggested_start_load_kg: 15,
        load_input_mode: "PER_SIDE",
      },
      {
        id: "opt-secs-unilateral-alt",
        training_plan_exercise_id: "tpe-1",
        exercise_name: "Split Squat",
        exercise_position: 1,
        variant_id: "variant-secs-unilateral-alt",
        variant_name: "Timed Split Squat Alt",
        repetition_kind: "SECS",
        station_id: "station-2",
        station_name: "Rack 2",
        station_profile_loads_kg: [10, 15, 20],
        suggested_start_load_kg: 15,
        load_input_mode: "PER_SIDE",
      },
    ];
    app.state.workoutPlan.exercises[0].completedSets = [];
    app.state.workoutPlan.exercises[0].isFallbackOptionConfirmed = true;
    app.state.workoutPlan.exercises[0].isSecsTimerRunning = true;

    dispatchAction(app, "return-to-fallback-selection");

    expect(app.state?.workoutPlan.exercises[0]?.isFallbackOptionConfirmed).toBe(false);
    expect(app.state?.workoutPlan.exercises[0]?.isSecsTimerRunning).toBe(false);
    expect(orchestratorSpies.persistFallbackSelection).not.toHaveBeenCalled();
  });

  it("enforces reps spinner bounds between 1 and 99", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => ({
      ...secsTrainingPlanOptions,
      exercise_variants: secsTrainingPlanOptions.exercise_variants.map((variant) => ({
        ...variant,
        repetition_kind: "REPS",
      })),
    })) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    app.state.workoutPlan.exercises[0].activeSet.reps = 99;
    app.state.workoutPlan.exercises[0].activeSetInput.reps = "99";
    dispatchAction(app, "increment-reps");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(99);
    expect(app.state?.workoutPlan.exercises[0]?.activeSetInput.reps).toBe("99");

    app.state.workoutPlan.exercises[0].activeSet.reps = 1;
    app.state.workoutPlan.exercises[0].activeSetInput.reps = "1";
    dispatchAction(app, "decrement-reps");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(1);
    expect(app.state?.workoutPlan.exercises[0]?.activeSetInput.reps).toBe("1");

    dispatchInput(app, "reps-input", "145");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(99);
    expect(app.state?.workoutPlan.exercises[0]?.activeSetInput.reps).toBe("99");

    dispatchInput(app, "reps-input", "0");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(1);
    expect(app.state?.workoutPlan.exercises[0]?.activeSetInput.reps).toBe("1");
  });

  it("applies load picker input to active set state for stable reopen selection", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => ({
      ...secsTrainingPlanOptions,
      exercise_variants: secsTrainingPlanOptions.exercise_variants.map((variant) => ({
        ...variant,
        repetition_kind: "REPS",
      })),
    })) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    app.state.workoutPlan.exercises[0].activeSet.loadValue = 50;
    app.state.workoutPlan.exercises[0].activeSetInput.loadValue = "50";
    dispatchInput(app, "load-input", "55");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.loadValue).toBe(55);
    expect(app.state?.workoutPlan.exercises[0]?.activeSetInput.loadValue).toBe("55");
  });

  it("blocks next-set and next navigation while SECS timer runs, then allows actions after pause", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchAction(app, "increment-reps");
    expect(app.state?.workoutPlan.exercises[0]?.isSecsTimerRunning).toBe(true);

    dispatchAction(app, "next-set");
    dispatchAction(app, "next-exercise");

    expect(orchestratorSpies.persistActiveSet).not.toHaveBeenCalled();
    expect(orchestratorSpies.persistNextExerciseTransition).not.toHaveBeenCalled();
    expect(app.state?.viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });

    dispatchAction(app, "increment-reps");
    expect(app.state?.workoutPlan.exercises[0]?.isSecsTimerRunning).toBe(false);

    dispatchAction(app, "next-set");
    dispatchAction(app, "next-exercise");

    expect(orchestratorSpies.persistActiveSet).toHaveBeenCalledTimes(1);
    expect(orchestratorSpies.persistNextExerciseTransition).toHaveBeenCalledTimes(1);
    expect(app.state?.viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });
  });

  it("blocks previous navigation while SECS timer runs and resumes safely after pause", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(2));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchAction(app, "increment-reps");
    expect(app.state?.workoutPlan.exercises[1]?.isSecsTimerRunning).toBe(true);

    dispatchAction(app, "previous-exercise");
    expect(app.state?.viewState).toEqual({ screen: "exercise", exerciseIndex: 1 });

    dispatchAction(app, "increment-reps");
    expect(app.state?.workoutPlan.exercises[1]?.isSecsTimerRunning).toBe(false);

    dispatchAction(app, "previous-exercise");
    expect(orchestratorSpies.persistPreviousExerciseTransition).toHaveBeenCalledTimes(1);
  });

  it("uses persisted reopen transition when moving back from an untouched exercise", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(2));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchAction(app, "previous-exercise");

    expect(orchestratorSpies.persistPreviousExerciseTransition).toHaveBeenCalledTimes(1);
  });

  it("uses persisted reopen transition when the current untouched exercise has skippedAt omitted", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(2));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    app.state.workoutPlan.exercises[1].skippedAt = undefined;

    dispatchAction(app, "previous-exercise");

    expect(orchestratorSpies.persistPreviousExerciseTransition).toHaveBeenCalledTimes(1);
  });

  it("uses persisted reopen transition when the previous untouched exercise was skipped", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(2));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    app.state.workoutPlan.exercises[0].completedSets = [];
    app.state.workoutPlan.exercises[0].skippedAt = "2026-02-01T09:10:00Z";

    dispatchAction(app, "previous-exercise");

    expect(orchestratorSpies.persistPreviousExerciseTransition).toHaveBeenCalledTimes(1);
  });

  it("parses m:ss input from single SECS field", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchInput(app, "secs-input", "0:01");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(1);

    dispatchInput(app, "secs-input", "2:05");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(125);
  });

  it("increments SECS value from 0:00 to 0:01 after one second while running", async () => {
    vi.useFakeTimers();
    try {
      const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
      const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
      loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

      createApp(
        app,
        fetchJson,
        {
          createActiveWorkout: vi.fn(),
          updateActiveWorkout: vi.fn(),
          cancelActiveWorkout: vi.fn(),
          completeActiveWorkout: vi.fn(),
        } as any,
        () => "now",
      );

      await flush();

      dispatchInput(app, "secs-input", "0:00");
      expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(0);

      dispatchAction(app, "increment-reps");
      expect(app.state?.workoutPlan.exercises[0]?.isSecsTimerRunning).toBe(true);

      vi.advanceTimersByTime(1000);

      expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(1);
      expect(app.state?.workoutPlan.exercises[0]?.activeSetInput.reps).toBe("1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks next-set when SECS value is zero and allows once above zero", async () => {
    const app = document.createElement("pb-app-root") as HTMLElement & { state?: any };
    const fetchJson = (vi.fn(async () => secsTrainingPlanOptions) as unknown) as FetchJson;
    loadActiveWorkoutMock.mockResolvedValue(createSecsModeActiveWorkout(1));

    createApp(
      app,
      fetchJson,
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    await flush();

    dispatchInput(app, "secs-input", "0:00");
    dispatchAction(app, "next-set");
    expect(orchestratorSpies.persistActiveSet).not.toHaveBeenCalled();

    dispatchInput(app, "secs-input", "0:01");
    dispatchAction(app, "next-set");
    expect(orchestratorSpies.persistActiveSet).toHaveBeenCalledTimes(1);
  });

});
