import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerPbCompletionScreen, pbCompletionScreenTag } from "./pb-completion-screen";
import { registerPbStartScreen, pbStartScreenTag } from "./pb-start-screen";
import type { CompletionScreenState } from "./pb-completion-screen";
import type { WorkoutPlan } from "./workout-types";
import type { StartScreenState } from "./workout-types";

describe("pb-completion-screen", () => {
  beforeEach(() => {
    registerPbCompletionScreen();
    registerPbStartScreen();
  });

  const createPlan = (): WorkoutPlan => ({
    id: "plan-1",
    name: "Test Plan",
    exercises: [
      {
        trainingPlanExerciseId: "ex-1",
        name: "Bench Press",
        fallbackOptions: [],
        selectedTrainingPlanExerciseVariantId: null,
        selectedVariantId: null,
        selectedStationId: null,
        selectedStationProfileLoadsKg: [],
        repetitionKind: "REPS",
        isFallbackOptionConfirmed: true,
        skippedAt: null,
        suggestedSet: { loadValue: 50, reps: 10 },
        activeSet: { loadValue: 50, reps: 10 },
        activeSetInput: { loadValue: "50", reps: "10" },
        completedSets: [
          { setIndex: 1, loadValue: 50, reps: 10 },
        ],
        isReadOnly: false,
        isSecsTimerRunning: false,
      },
    ],
  });

  const createState = (
    completion: Partial<CompletionScreenState["completion"]> = {},
  ): CompletionScreenState => ({
    plan: createPlan(),
    completion: {
      startedAt: new Date(Date.now() - 600000).toISOString(),
      completedAt: new Date().toISOString(),
      workoutProgress: null,
      workoutProgressStatus: "NOT_ENOUGH_DATA",
      ...completion,
    },
  });

  const createStartState = (): StartScreenState => ({
    isLoading: false,
    isStarting: false,
    errorMessage: null,
    blockedStartModal: null,
    trainingPlans: [{ id: "p1", name: "Plan A", exercise_count: 3 }],
    gyms: [{ id: "g1", name: "Gym A" }],
    selectedTrainingPlanId: "p1",
    selectedGymId: "g1",
    selectedWorkoutMode: "configured-gym",
  });

  it("renders completion title and plan name", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Test Plan");
    expect(text).toContain("Completed");
  });

  it("does not render legacy completion stats", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).not.toContain("Workout Progress");
    expect(text).not.toContain("Total Sets Completed");
    expect(text).not.toContain("Total Reps");
    expect(text).not.toContain("Total Weight Moved");
    expect(el.querySelector('[aria-label="Workout completion metrics"]')).toBeNull();
  });

  it("renders gray no-data progress indicator by default", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const indicator = el.querySelector('[aria-label="Workout progress indicator"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute("data-progress-tone")).toBe("gray");
    expect(el.textContent ?? "").toContain("Not enough similar data yet for a comparison.");
  });

  it("renders red progress indicator when workout progress is below 0.95", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState({
      workoutProgress: 0.94,
      workoutProgressStatus: "AVAILABLE",
    });

    const indicator = el.querySelector('[aria-label="Workout progress indicator"]');
    expect(indicator?.getAttribute("data-progress-tone")).toBe("red");
    expect(el.textContent ?? "").toContain("You went a bit lighter today - that's part of the process.");
  });

  it("renders yellow progress indicator when workout progress is between 0.95 and 1.03", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState({
      workoutProgress: 1.03,
      workoutProgressStatus: "AVAILABLE",
    });

    const indicator = el.querySelector('[aria-label="Workout progress indicator"]');
    expect(indicator?.getAttribute("data-progress-tone")).toBe("yellow");
    expect(el.textContent ?? "").toContain("You've maintained your recent level. Solid work.");
  });

  it("renders green progress indicator when workout progress is above 1.03", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState({
      workoutProgress: 1.04,
      workoutProgressStatus: "AVAILABLE",
    });

    const indicator = el.querySelector('[aria-label="Workout progress indicator"]');
    expect(indicator?.getAttribute("data-progress-tone")).toBe("green");
    expect(el.textContent ?? "").toContain("You've improved on your recent level. Great work.");
  });

  it("renders actual workout duration in minutes", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState({
      startedAt: "2026-04-17T10:00:00.000Z",
      completedAt: "2026-04-17T10:42:00.000Z",
      averageDurationMinutes: null,
    });

    const text = el.textContent ?? "";
    expect(text).toContain("42 min");
  });

  it("renders shorter-than-usual duration line when deviation is at least 5 minutes", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState({
      startedAt: "2026-04-17T10:00:00.000Z",
      completedAt: "2026-04-17T10:42:00.000Z",
      averageDurationMinutes: 50,
    });

    const text = el.textContent ?? "";
    expect(text).toContain("8 min shorter than usual");
  });

  it("hides duration delta line when deviation is less than 5 minutes", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState({
      startedAt: "2026-04-17T10:00:00.000Z",
      completedAt: "2026-04-17T10:42:00.000Z",
      averageDurationMinutes: 45,
    });

    const text = el.textContent ?? "";
    expect(text).not.toContain("shorter than usual");
    expect(text).not.toContain("longer than usual");
  });

  it("matches start-screen header banner contract", () => {
    const completionEl = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };
    const startEl = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };

    document.body.append(completionEl, startEl);
    completionEl.state = createState();
    startEl.state = createStartState();

    const completionHeader = completionEl.querySelector("header.app-header");
    const startHeader = startEl.querySelector("header.app-header");
    expect(completionHeader).not.toBeNull();
    expect(startHeader).not.toBeNull();

    const completionBanner = completionEl.querySelector("img.start-banner");
    const startBanner = startEl.querySelector("img.start-banner");
    expect(completionBanner).not.toBeNull();
    expect(startBanner).not.toBeNull();
    expect(completionBanner?.getAttribute("src")).toBe(startBanner?.getAttribute("src"));
    expect(completionBanner?.getAttribute("alt")).toBe(startBanner?.getAttribute("alt"));

  });

  it("preserves return-to-start action control", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const button = el.querySelector('[data-ui-action="return-to-start"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Return to Start");
  });

  it("excludes SECS exercise sets from total reps stat", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    const state = createState();
    state.plan.exercises.push({
      trainingPlanExerciseId: "ex-2",
      name: "Plank",
      fallbackOptions: [],
      selectedTrainingPlanExerciseVariantId: null,
      selectedVariantId: null,
      selectedStationId: null,
      selectedStationProfileLoadsKg: [],
      repetitionKind: "SECS",
      isFallbackOptionConfirmed: true,
      skippedAt: null,
      suggestedSet: { loadValue: 0, reps: 60 },
      activeSet: { loadValue: 0, reps: 60 },
      activeSetInput: { loadValue: "0", reps: "60" },
      completedSets: [{ setIndex: 1, loadValue: 0, reps: 60 }],
      isReadOnly: false,
      isSecsTimerRunning: false,
    });
    el.state = state;

    const repsStat = el.querySelector(".completion-stat-tile--reps .completion-stat-number")?.textContent ?? "";
    expect(repsStat).toBe("10");
  });

  it("counts only complete unilateral left+right pairs in sets stat", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 8 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 20, reps: 8 },
      { setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 8 },
    ];
    el.state = state;

    const setsStat = el.querySelector(".completion-stat-tile--sets .completion-stat-number")?.textContent ?? "";
    expect(setsStat).toBe("1");
  });

  it("computes kg moved with reps, unilateral averaging, and secs-as-one-rep", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    const state = createState();
    state.plan.exercises = [
      {
        ...state.plan.exercises[0]!,
        setTrackingMode: "UNILATERAL",
        repetitionKind: "REPS",
        completedSets: [
          { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
          { setIndex: 1, setSide: "RIGHT", loadValue: 24, reps: 10 },
          { setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 8 },
        ],
      },
      {
        ...state.plan.exercises[0]!,
        trainingPlanExerciseId: "ex-secs",
        name: "Weighted Plank",
        setTrackingMode: "BILATERAL",
        repetitionKind: "SECS",
        completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 30, reps: 60 }],
      },
    ];
    el.state = state;

    const kgMovedStat = el.querySelector(".completion-stat-tile--kg-moved .completion-stat-number")?.textContent ?? "";
    expect(kgMovedStat).toBe("250");
  });

  it("emits return action when clicking nested element inside button", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.querySelector('[data-ui-action="return-to-start"]') as HTMLButtonElement;
    const child = document.createElement("span");
    child.textContent = "Return";
    button.append(child);

    child.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("return-to-start");
  });
});
