import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./workout-controller";
import { loadActiveWorkout, loadStartScreenData } from "./workout-api";
import type { ActiveWorkoutResponse, TrainingPlanOptionsResponse } from "./workout-types";
import type { FetchJson } from "./workout-api";

const orchestratorSpies = {
  bootstrapStartScreen: vi.fn(async () => {}),
  startWorkout: vi.fn(async () => {}),
  cancelWorkout: vi.fn(async () => {}),
  completeWorkout: vi.fn(async () => {}),
  finishWorkout: vi.fn(async () => {}),
  persistActiveSet: vi.fn(async () => {}),
  persistSkipTransition: vi.fn(async () => false),
  selectFallbackOption: vi.fn(() => {}),
  persistFallbackSelection: vi.fn(async () => {}),
};

vi.mock("./workflow-orchestrator", () => ({
  createWorkflowOrchestrator: vi.fn(() => orchestratorSpies),
}));

vi.mock("./workout-api", async () => {
  const actual = await vi.importActual<typeof import("./workout-api")>("./workout-api");
  return {
    ...actual,
    loadActiveWorkout: vi.fn(),
    loadStartScreenData: vi.fn(),
  };
});

const loadActiveWorkoutMock = vi.mocked(loadActiveWorkout);
const loadStartScreenDataMock = vi.mocked(loadStartScreenData);

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
        selected_plan_exercise_option_id: "opt-secs-unilateral",
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
            reps: 20,
          },
        ],
        suggested_set: {
          set_index: 1,
          set_side: "RIGHT",
          load_value: 30,
          suggested_load_input_kg: 15,
          suggested_load_total_kg: 30,
          reps: 25,
        },
      },
      {
        training_plan_exercise_id: "tpe-2",
        position: 2,
        exercise_name: "Hollow Hold",
        selected_plan_exercise_option_id: "opt-secs-stationless",
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
          reps: 45,
        },
      },
    ],
  },
});

const secsTrainingPlanOptions: TrainingPlanOptionsResponse = {
  training_plan_id: "plan-1",
  gym_id: "gym-1",
  options: [
    {
      id: "opt-secs-unilateral",
      training_plan_exercise_id: "tpe-1",
      exercise_name: "Split Squat",
      exercise_position: 1,
      variant_id: "variant-secs-unilateral",
      variant_name: "Timed Split Squat",
      variant_type: "dumbbell",
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
      variant_type: "bodyweight",
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
    expect(app.state?.viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });

    dispatchAction(app, "increment-reps");
    expect(app.state?.workoutPlan.exercises[0]?.isSecsTimerRunning).toBe(false);

    dispatchAction(app, "next-set");
    dispatchAction(app, "next-exercise");

    expect(orchestratorSpies.persistActiveSet).toHaveBeenCalledTimes(1);
    expect(app.state?.viewState).toEqual({ screen: "exercise", exerciseIndex: 1 });
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
    expect(app.state?.viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });
  });

  it("parses HH:MM:SS input from single SECS field", async () => {
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

    dispatchInput(app, "secs-input", "00:00:01");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(1);

    dispatchInput(app, "secs-input", "00:02:05");
    expect(app.state?.workoutPlan.exercises[0]?.activeSet.reps).toBe(125);
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
