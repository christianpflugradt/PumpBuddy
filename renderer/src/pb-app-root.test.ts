import { describe, it, expect, beforeEach } from "vitest";
import { registerPbAppRoot, pbAppRootTag } from "./pb-app-root";
import type { AppState } from "./workout-types";

describe("pb-app-root", () => {
  beforeEach(() => {
    registerPbAppRoot();
  });

  const createState = (): AppState => ({
    startScreen: {
      isLoading: false,
      isStarting: false,
      errorMessage: null,
      blockedStartModal: null,
      trainingPlans: [],
      gyms: [],
      selectedTrainingPlanId: "",
      selectedGymId: "",
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

  it("renders start screen", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    el.state = createState();

    expect(el.innerHTML).toContain("pb-app-root");
  });

  it("renders completion screen when state changes", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "completion" };
    state.workoutPlan = {
      id: "p1",
      name: "Plan",
      exercises: [],
    };

    el.state = state;

    const completionEl = el.querySelector("pb-completion-screen");
    expect(completionEl).toBeTruthy();
  });
});
