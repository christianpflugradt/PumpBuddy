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

  it("passes session user to start screen for personalized greeting", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.sessionUser = {
      id: "2f6f7ad5-488f-46cd-b763-f5ef9f878f3f",
      displayName: "Casey",
    };
    el.state = state;

    const startEl = el.querySelector("pb-start-screen");
    expect(startEl).toBeTruthy();
    expect(startEl?.textContent ?? "").toContain("Welcome back, Casey!");
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

  it("falls back to start screen with error when plan is missing outside start view", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };

    el.state = state;

    const startEl = el.querySelector("pb-start-screen") as HTMLElement;
    expect(startEl).toBeTruthy();
    expect(startEl.textContent ?? "").toContain("Unable to render the workout plan.");
  });

  it("renders exercise screen when plan and exercise view are available", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Plan",
      exercises: [
        {
          trainingPlanExerciseId: "ex-1",
          name: "Bench",
          fallbackOptions: [],
          selectedPlanExerciseOptionId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          loadInputMode: "TOTAL",
          setTrackingMode: "BILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 40, reps: 8 },
          activeSet: { loadValue: 40, reps: 8 },
          activeSetInput: { loadValue: "40", reps: "8" },
          completedSets: [],
          currentSetIndex: 1,
          currentSetSide: "BILATERAL",
          isReadOnly: false,
        },
      ],
    };

    el.state = state;

    const exerciseEl = el.querySelector("pb-exercise-screen");
    expect(exerciseEl).toBeTruthy();
  });

  it("renders settings screen when settings view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "settings" };
    state.sessionUser = {
      id: "2f6f7ad5-488f-46cd-b763-f5ef9f878f3f",
      displayName: "Casey",
    };

    el.state = state;

    const settingsEl = el.querySelector("pb-settings-screen");
    expect(settingsEl).toBeTruthy();
    expect(settingsEl?.textContent ?? "").toContain("2f6f7ad5-488f-46cd-b763-f5ef9f878f3f");
    expect(settingsEl?.textContent ?? "").toContain("Casey");
  });
});
