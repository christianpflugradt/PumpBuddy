import { describe, it, expect, beforeEach } from "vitest";
import { registerPbCompletionScreen, pbCompletionScreenTag } from "./pb-completion-screen";
import type { CompletionScreenState } from "./pb-completion-screen";
import type { WorkoutPlan } from "./workout-types";

describe("pb-completion-screen", () => {
  beforeEach(() => {
    registerPbCompletionScreen();
  });

  const createPlan = (): WorkoutPlan => ({
    id: "plan-1",
    name: "Test Plan",
    exercises: [
      {
        trainingPlanExerciseId: "ex-1",
        name: "Bench Press",
        fallbackOptions: [],
        selectedPlanExerciseOptionId: null,
        selectedVariantId: null,
        selectedStationId: null,
        selectedStationProfileLoadsKg: [],
        isFallbackOptionConfirmed: true,
        skippedAt: null,
        suggestedSet: { loadValue: 50, reps: 10 },
        activeSet: { loadValue: 50, reps: 10 },
        activeSetInput: { loadValue: "50", reps: "10" },
        completedSets: [
          { setIndex: 1, loadValue: 50, reps: 10 },
        ],
        isReadOnly: false,
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

  it("renders completion title", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Plan Completed");
  });

  it("renders metrics", () => {
    const el = document.createElement(pbCompletionScreenTag) as HTMLElement & {
      state: CompletionScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Total Sets Completed");
    expect(text).toContain("Total Reps");
  });
});
