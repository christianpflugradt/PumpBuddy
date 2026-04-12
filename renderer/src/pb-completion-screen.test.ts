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

  const createState = (): CompletionScreenState => ({
    plan: createPlan(),
    completion: {
      startedAt: new Date(Date.now() - 600000).toISOString(),
      completedAt: new Date().toISOString(),
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

  it("renders completion title", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Plan Completed");
  });

  it("renders metrics", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Total Sets Completed");
    expect(text).toContain("Total Reps");
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

    const completionHeaderCopy = completionEl.querySelector("p.start-copy");
    const startHeaderCopy = startEl.querySelector("p.start-copy");
    expect(completionHeaderCopy).not.toBeNull();
    expect(startHeaderCopy).not.toBeNull();
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
