import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerPbExerciseScreen, pbExerciseScreenTag } from "./pb-exercise-screen";
import type { ExerciseScreenState } from "./pb-exercise-screen";
import type { WorkoutPlan } from "./workout-types";

describe("pb-exercise-screen", () => {
  beforeEach(() => {
    registerPbExerciseScreen();
  });

  const createMockPlan = (): WorkoutPlan => ({
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
        loadInputMode: "TOTAL",
        isFallbackOptionConfirmed: true,
        skippedAt: null,
        suggestedSet: { loadValue: 50, reps: 10 },
        activeSet: { loadValue: 50, reps: 10 },
        activeSetInput: { loadValue: "50", reps: "10" },
        completedSets: [],
        isReadOnly: false,
      },
    ],
  });

  const createState = (): ExerciseScreenState => ({
    plan: createMockPlan(),
    exerciseIndex: 0,
    startScreen: {
      selectedWorkoutMode: "free-mode",
      selectedGymId: "",
      gyms: [],
    },
    confirmDialog: {
      message: null,
      confirmActionLabel: null,
      onConfirm: null,
    },
    activeWorkout: {
      id: null,
      startedAt: null,
      persistedExerciseCount: 0,
    },
    workoutSave: {
      isSaving: false,
      errorMessage: null,
    },
    uiFeedback: {
      completedSetPulseToken: 0,
      loadTickToken: 0,
      repsTickToken: 0,
    },
  });

  it("renders exercise name", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Bench Press");
  });

  it("emits next-set action on button click", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.querySelector(
      '[data-ui-action="next-set"]',
    ) as HTMLButtonElement;

    button?.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.action).toBe("next-set");
  });

  it("disables controls when saving", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.workoutSave.isSaving = true;

    el.state = state;

    const button = el.querySelector(
      '[data-ui-action="next-set"]',
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it("renders per-side load label while keeping history header canonical", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.loadInputMode = "PER_SIDE";
    state.plan.exercises[0]!.completedSets = [{ setIndex: 1, loadValue: 100, reps: 8 }];

    el.state = state;

    const loadLabel = el.querySelector('label[for="exercise-load"]')?.textContent ?? "";
    const historyHeader = el.querySelector(".completed-set-header-cell:nth-child(2)")?.textContent ?? "";
    expect(loadLabel).toContain("Load per Side");
    expect(historyHeader).toContain("Kg");
  });

  it("renders unilateral left-side current-set heading and action label", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.currentSetIndex = 2;
    state.plan.exercises[0]!.currentSetSide = "LEFT";
    state.plan.exercises[0]!.completedSets = [{ setIndex: 1, setSide: "LEFT", loadValue: 40, reps: 10 }];

    el.state = state;

    const heading = el.querySelector(".set-list-title")?.textContent ?? "";
    const buttonText = el.querySelector('[data-ui-action="next-set"]')?.textContent ?? "";
    const setCounter = el.querySelector(".set-counter")?.textContent ?? "";
    expect(heading).toContain("Current Set (Left Side)");
    expect(buttonText).toContain("Complete Left Side");
    expect(setCounter).toContain("Set 2");
  });

  it("renders unilateral right-side current-set heading with complete set action", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.currentSetIndex = 2;
    state.plan.exercises[0]!.currentSetSide = "RIGHT";
    state.plan.exercises[0]!.completedSets = [{ setIndex: 2, setSide: "LEFT", loadValue: 40, reps: 10 }];

    el.state = state;

    const heading = el.querySelector(".set-list-title")?.textContent ?? "";
    const buttonText = el.querySelector('[data-ui-action="next-set"]')?.textContent ?? "";
    expect(heading).toContain("Current Set (Right Side)");
    expect(buttonText).toContain("Complete Set");
  });
});
