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
        repetitionKind: "REPS",
        isFallbackOptionConfirmed: true,
        skippedAt: null,
        suggestedSet: { loadValue: 50, reps: 10 },
        activeSet: { loadValue: 50, reps: 10 },
        activeSetInput: { loadValue: "50", reps: "10" },
        completedSets: [],
        isReadOnly: false,
        isSecsTimerRunning: false,
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
    expect(historyHeader).toContain("kg");
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

  it("renders bilateral history as Set|kg|reps without status column", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "BILATERAL";
    state.plan.exercises[0]!.completedSets = [{ setIndex: 1, setSide: "BILATERAL", loadValue: 80, reps: 6 }];

    el.state = state;

    const headerCells = Array.from(el.querySelectorAll(".completed-set-header-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );
    const rowCells = Array.from(el.querySelectorAll(".completed-set-row .completed-set-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );

    expect(headerCells).toEqual(["Set", "kg", "reps"]);
    expect(rowCells).toEqual(["1", "80 kg", "6"]);
  });

  it("renders bilateral timed history with secs header", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.completedSets = [{ setIndex: 1, setSide: "BILATERAL", loadValue: 0, reps: 125 }];

    el.state = state;

    const headerCells = Array.from(el.querySelectorAll(".completed-set-header-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );
    const rowCells = Array.from(el.querySelectorAll(".completed-set-row .completed-set-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );

    expect(headerCells).toEqual(["Set", "kg", "secs"]);
    expect(rowCells).toEqual(["1", "0 kg", "125"]);
  });

  it("renders unilateral history with blank right-side cells while right is pending", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.completedSets = [{ setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 10 }];

    el.state = state;

    const headerCells = Array.from(el.querySelectorAll(".completed-set-header-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );
    const rowCells = Array.from(el.querySelectorAll(".completed-set-row .completed-set-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );

    expect(headerCells).toEqual(["Set", "kg (L)", "reps (L)", "kg (R)", "reps (R)"]);
    expect(rowCells).toEqual(["2", "22 kg", "10", "", ""]);
  });

  it("emits input events for editable load and reps inputs", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const loadInput = el.querySelector('[data-input-action="load-input"]') as HTMLInputElement;
    loadInput.value = "55";
    loadInput.dispatchEvent(new Event("input", { bubbles: true }));

    const repsInput = el.querySelector('[data-input-action="reps-input"]') as HTMLInputElement;
    repsInput.value = "12";
    repsInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "load-input", value: "55" });
    expect(handler.mock.calls[1][0].detail).toEqual({ action: "reps-input", value: "12" });
  });

  it("hides set controls and next button until fallback option is confirmed", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.startScreen.gyms = [{ id: "gym-1", name: "Gym One" }];
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        variant_id: "v1",
        variant_name: "Variant A",
        station_id: "s1",
        station_name: "Station 1",
        exercise_name: "Bench Press",
        exercise_position: 1,
      },
      {
        id: "opt-2",
        training_plan_exercise_id: "ex-1",
        variant_id: "v2",
        variant_name: "Variant B",
        station_id: "s2",
        station_name: "Station 2",
        exercise_name: "Bench Press",
        exercise_position: 1,
      },
    ];
    state.plan.exercises[0]!.selectedPlanExerciseOptionId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "s1";
    state.plan.exercises[0]!.isFallbackOptionConfirmed = false;

    el.state = state;

    expect(el.querySelector('[data-ui-action="next-set"]')).toBeNull();
    expect(el.querySelector('[data-ui-action="next-exercise"]')).toBeNull();
    expect(el.querySelector('[data-input-action="switch-fallback-option"]')).toBeTruthy();
  });

  it("hides load field when selected fallback option is stationless", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.selectedPlanExerciseOptionId = "opt-stationless";
    state.plan.exercises[0]!.selectedStationId = null;

    el.state = state;

    expect(el.querySelector('input[data-input-action="load-input"]')).toBeNull();
    expect(el.textContent ?? "").toContain("Reps");
  });

  it("renders cancel workout action only when workout has persisted progress", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.activeWorkout.id = "active-1";
    state.activeWorkout.persistedExerciseCount = 1;
    state.workoutSave.isSaving = false;

    el.state = state;

    const cancelButton = el.querySelector('[data-ui-action="cancel-workout"]') as HTMLButtonElement;
    expect(cancelButton).toBeTruthy();
  });

  it("renders timed set controls for SECS variants", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.activeSet.reps = 125;
    state.plan.exercises[0]!.activeSetInput.reps = "125";
    state.plan.exercises[0]!.isSecsTimerRunning = true;

    el.state = state;

    const secsInput = el.querySelector('[data-input-action="secs-input"]') as HTMLInputElement | null;

    expect(secsInput).toBeTruthy();
    expect(secsInput?.value).toBe("00:02:05");
    expect(secsInput?.type).toBe("time");
    expect(el.querySelector('[data-ui-action="decrement-reps"]')?.getAttribute("aria-label")).toBe("Reset timer");
    expect(el.querySelector('[data-ui-action="increment-reps"]')?.getAttribute("aria-label")).toBe("Pause timer");
  });

  it("disables complete-set and navigation actions while SECS timer is running", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.isSecsTimerRunning = true;
    state.plan.exercises.push({
      ...state.plan.exercises[0]!,
      trainingPlanExerciseId: "ex-2",
      name: "Step Ups",
      repetitionKind: "REPS",
      isSecsTimerRunning: false,
    });

    el.state = state;

    const completeSetButton = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    const previousButton = el.querySelector('[data-ui-action="previous-exercise"]') as HTMLButtonElement;
    const nextButton = el.querySelector('[data-ui-action="next-exercise"]') as HTMLButtonElement;

    expect(completeSetButton.disabled).toBe(true);
    expect(previousButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(true);
  });

  it("renders read-only jump button and enables it when another editable exercise exists", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.isReadOnly = true;
    state.plan.exercises.push({
      ...state.plan.exercises[0]!,
      trainingPlanExerciseId: "ex-2",
      name: "Squat",
      isReadOnly: false,
      fallbackOptions: [],
      selectedPlanExerciseOptionId: null,
      selectedVariantId: null,
      selectedStationId: null,
      selectedStationProfileLoadsKg: [],
      repetitionKind: "REPS",
      isFallbackOptionConfirmed: true,
      completedSets: [],
      activeSetInput: { loadValue: "40", reps: "8" },
      activeSet: { loadValue: 40, reps: 8 },
      suggestedSet: { loadValue: 40, reps: 8 },
      isSecsTimerRunning: false,
    });

    el.state = state;

    const jump = el.querySelector('[data-ui-action="jump-to-current-exercise"]') as HTMLButtonElement;
    expect(jump).toBeTruthy();
    expect(jump.disabled).toBe(false);
  });

  it("renders confirmation dialog with custom confirm label", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.confirmDialog.message = "Discard changes?";
    state.confirmDialog.confirmActionLabel = "Discard";

    el.state = state;

    expect(el.textContent ?? "").toContain("Discard changes?");
    expect(el.textContent ?? "").toContain("Discard");
    expect(el.querySelector('[data-ui-action="confirm-dialog-confirm"]')).toBeTruthy();
  });

  it("dispatches timer action when clicking icon SVG inside button", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.isSecsTimerRunning = true;
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const pauseIcon = el.querySelector('[data-ui-action="increment-reps"] svg') as SVGElement;
    pauseIcon.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.action).toBe("increment-reps");
  });
});
