import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./workout-controller";
import { loadActiveWorkout, loadStartScreenData } from "./workout-api";

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
});
