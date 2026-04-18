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
        selectedTrainingPlanExerciseVariantId: null,
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

  it("renders prefixed rep-range guidance with one-row heading for load-based current set", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        rep_min: 6,
        rep_max: 10,
        variant_id: "variant-1",
        variant_name: "Barbell",
        station_id: "station-1",
        station_name: "Rack",
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";

    el.state = state;

    const repsLabel = el.querySelector('label[for="exercise-reps"]')?.textContent ?? "";
    const repsGuidance = el.querySelector(".set-row-field-reps .set-row-field-guidance")?.textContent ?? "";
    const repsField = el.querySelector(".set-row-field-reps");
    const repsFieldChildren = repsField ? Array.from(repsField.children).map((node) => node.tagName) : [];
    expect(repsLabel).toBe("REPS");
    expect(repsGuidance).toBe("try 6-10");
    expect(repsFieldChildren).toEqual(["DIV", "DIV"]);
  });

  it("does not render rep-range guidance when rep_min is missing", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        rep_max: 10,
        variant_id: "variant-1",
        variant_name: "Barbell",
        station_id: "station-1",
        station_name: "Rack",
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";

    el.state = state;

    const repsLabel = el.querySelector('label[for="exercise-reps"]')?.textContent ?? "";
    const repsGuidance = el.querySelector(".set-row-field-reps .set-row-field-guidance");
    expect(repsLabel).toBe("REPS");
    expect(repsGuidance).toBeNull();
  });

  it("does not render rep-range guidance when current set has no load", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        rep_min: 6,
        rep_max: 10,
        variant_id: "variant-1",
        variant_name: "Barbell",
        station_id: "station-1",
        station_name: "Rack",
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.activeSet.loadValue = null;
    state.plan.exercises[0]!.activeSetInput.loadValue = "";

    el.state = state;

    const repsLabel = el.querySelector('label[for="exercise-reps"]')?.textContent ?? "";
    const repsGuidance = el.querySelector(".set-row-field-reps .set-row-field-guidance");
    expect(repsLabel).toBe("REPS");
    expect(repsGuidance).toBeNull();
  });

  it("renders no-load reps prior-set guidance as try >=reps", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Nordic Curl",
        station_id: null,
        station_name: "Bodyweight",
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = null;
    state.plan.exercises[0]!.suggestedSet.reps = 12;

    el.state = state;

    const repsLabel = el.querySelector('label[for="exercise-reps"]')?.textContent ?? "";
    const repsGuidance = el.querySelector(".set-row-field-reps .set-row-field-guidance")?.textContent ?? "";
    expect(repsLabel).toBe("REPS");
    expect(repsGuidance).toBe("try >=12");
  });

  it("renders no-load secs prior-set guidance as try >=m:ss", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Plank",
        station_id: null,
        station_name: "Bodyweight",
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = null;
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.suggestedSet.reps = 75;
    state.plan.exercises[0]!.activeSet.reps = 75;
    state.plan.exercises[0]!.activeSetInput.reps = "75";

    el.state = state;

    const secsLabel = el.querySelector(".set-row-field-secs .set-row-field-label")?.textContent ?? "";
    expect(secsLabel).toBe("try >=1:15");
  });

  it("hides no-load prior-set guidance when no suggested prior value exists", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Nordic Curl",
        station_id: null,
        station_name: "Bodyweight",
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = null;
    state.plan.exercises[0]!.suggestedSet.reps = 0;

    el.state = state;

    const repsLabel = el.querySelector('label[for="exercise-reps"]')?.textContent ?? "";
    const repsGuidance = el.querySelector(".set-row-field-reps .set-row-field-guidance");
    expect(repsLabel).toBe("REPS");
    expect(repsGuidance).toBeNull();
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

  it("keeps Complete Set filled when logical sets are below target_sets", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Barbell",
        station_id: "station-1",
        station_name: "Rack",
        target_sets: 3,
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.setTrackingMode = "BILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 40, reps: 10 },
      { setIndex: 2, setSide: "BILATERAL", loadValue: 42.5, reps: 9 },
    ];

    el.state = state;

    const button = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(button.classList.contains("action-button-primary-outlined")).toBe(false);
  });

  it("switches Complete Set to outlined once bilateral logical sets reach target_sets", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Barbell",
        station_id: "station-1",
        station_name: "Rack",
        target_sets: 2,
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.setTrackingMode = "BILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 40, reps: 10 },
      { setIndex: 2, setSide: "BILATERAL", loadValue: 42.5, reps: 9 },
    ];

    el.state = state;

    const button = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(button.classList.contains("action-button-primary-outlined")).toBe(true);
  });

  it("counts completed unilateral logical sets as left+right pairs for target_sets threshold", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Dumbbell",
        station_id: "station-1",
        station_name: "Bench",
        target_sets: 2,
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.currentSetSide = "RIGHT";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 20, reps: 10 },
      { setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 9 },
    ];

    el.state = state;

    const button = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(button.classList.contains("action-button-primary-outlined")).toBe(false);

    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 20, reps: 10 },
      { setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 9 },
      { setIndex: 2, setSide: "RIGHT", loadValue: 22, reps: 9 },
    ];
    el.state = state;

    const updatedButton = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(updatedButton.classList.contains("action-button-primary-outlined")).toBe(true);
  });

  it("outlines unilateral complete-left action immediately after target logical sets are reached", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Dumbbell",
        station_id: "station-1",
        station_name: "Bench",
        target_sets: 2,
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.currentSetIndex = 3;
    state.plan.exercises[0]!.currentSetSide = "LEFT";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 20, reps: 10 },
      { setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 9 },
      { setIndex: 2, setSide: "RIGHT", loadValue: 22, reps: 9 },
    ];

    el.state = state;

    const button = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(button.textContent).toContain("Complete Left Side");
    expect(button.classList.contains("action-button-primary-outlined")).toBe(true);
  });

  it("keeps Complete Set filled when target_sets is null", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.plan.exercises[0]!.fallbackOptions = [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        exercise_name: "Bench Press",
        exercise_position: 1,
        variant_id: "variant-1",
        variant_name: "Barbell",
        station_id: "station-1",
        station_name: "Rack",
        target_sets: null,
      },
    ];
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.setTrackingMode = "BILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 40, reps: 10 },
      { setIndex: 2, setSide: "BILATERAL", loadValue: 42.5, reps: 9 },
      { setIndex: 3, setSide: "BILATERAL", loadValue: 45, reps: 8 },
    ];

    el.state = state;

    const button = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(button.classList.contains("action-button-primary-outlined")).toBe(false);
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

    const headerCells = Array.from(el.querySelectorAll(".completed-set-header-cell"))
      .map((node) => (node.textContent ?? "").trim())
      .filter((value) => value.length > 0);
    const rowCells = Array.from(el.querySelectorAll(".completed-set-row .completed-set-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );

    expect(headerCells).toEqual(["Set", "kg", "reps"]);
    expect(rowCells).toEqual(["1", "80 kg", "6"]);
  });

  it("renders delete affordance only for the latest completed bilateral row", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "BILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 80, reps: 6 },
      { setIndex: 2, setSide: "BILATERAL", loadValue: 85, reps: 5 },
    ];

    el.state = state;

    const deleteButtons = el.querySelectorAll(".completed-set-delete");
    const latestDelete = el.querySelector('.completed-set-delete[aria-label="Delete set 2"]');
    const olderDelete = el.querySelector('.completed-set-delete[aria-label="Delete set 1"]');

    expect(deleteButtons).toHaveLength(1);
    expect(latestDelete).toBeTruthy();
    expect(latestDelete?.hasAttribute("disabled")).toBe(false);
    expect(latestDelete?.getAttribute("data-ui-action")).toBe("delete-latest-set");
    expect(olderDelete).toBeNull();
  });

  it("emits delete-latest-set action when clicking latest delete control", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "BILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 80, reps: 6 },
      { setIndex: 2, setSide: "BILATERAL", loadValue: 85, reps: 5 },
    ];

    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const latestDelete = el.querySelector('.completed-set-delete[aria-label="Delete set 2"]') as HTMLButtonElement;
    latestDelete.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "delete-latest-set" });
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

    const headerCells = Array.from(el.querySelectorAll(".completed-set-header-cell"))
      .map((node) => (node.textContent ?? "").trim())
      .filter((value) => value.length > 0);
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

    const headerCells = Array.from(el.querySelectorAll(".completed-set-header-cell"))
      .map((node) => (node.textContent ?? "").trim())
      .filter((value) => value.length > 0);
    const rowCells = Array.from(el.querySelectorAll(".completed-set-row .completed-set-cell")).map((node) =>
      (node.textContent ?? "").trim(),
    );

    expect(headerCells).toEqual(["Set", "kg (L)", "reps (L)", "kg (R)", "reps (R)"]);
    expect(rowCells).toEqual(["2", "22 kg", "10", "", ""]);
  });

  it("renders delete affordance only for the latest completed unilateral row", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    state.plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 22, reps: 9 },
      { setIndex: 2, setSide: "LEFT", loadValue: 24, reps: 8 },
    ];

    el.state = state;

    const deleteButtons = el.querySelectorAll(".completed-set-delete");
    const latestDelete = el.querySelector('.completed-set-delete[aria-label="Delete set 2"]');
    const olderDelete = el.querySelector('.completed-set-delete[aria-label="Delete set 1"]');

    expect(deleteButtons).toHaveLength(1);
    expect(latestDelete).toBeTruthy();
    expect(latestDelete?.hasAttribute("disabled")).toBe(false);
    expect(olderDelete).toBeNull();
  });

  it("emits load picker apply events while reps uses picker apply", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);
    const state = createState();
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.selectedStationProfileLoadsKg = [45, 50, 55, 60];
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const loadTrigger = el.querySelector('[data-ui-action="open-load-picker"]') as HTMLButtonElement;
    loadTrigger.click();
    const loadRow = el.querySelector('[data-ui-action="load-picker-row"][data-load-value="55"]') as HTMLButtonElement;
    loadRow.click();
    const loadApply = el.querySelector('[data-ui-action="load-picker-apply"]') as HTMLButtonElement;
    loadApply.click();

    expect(el.querySelector('[data-input-action="reps-input"]')).toBeNull();

    const repsTrigger = el.querySelector('[data-ui-action="open-reps-picker"]') as HTMLButtonElement;
    repsTrigger.click();
    const repsRow = el.querySelector('[data-ui-action="reps-picker-row"][data-reps-value="12"]') as HTMLButtonElement;
    repsRow.click();
    const apply = el.querySelector('[data-ui-action="reps-picker-apply"]') as HTMLButtonElement;
    apply.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "load-input", value: "55" });
    expect(handler.mock.calls[1][0].detail).toEqual({ action: "reps-input", value: "12" });
  });

  it("renders load picker options from selected station profile loads in order", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);
    const state = createState();
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.selectedStationProfileLoadsKg = [20, 22.5, 25, 27.5];
    el.state = state;

    const loadTrigger = el.querySelector('[data-ui-action="open-load-picker"]') as HTMLButtonElement;
    loadTrigger.click();

    const loadRows = Array.from(el.querySelectorAll('[data-ui-action="load-picker-row"]')).map(
      (node) => (node.textContent ?? "").trim(),
    );
    expect(loadRows).toEqual(["20 kg", "22.5 kg", "25 kg", "27.5 kg"]);
  });

  it("keeps load and reps spinner-first while preserving over-max history display", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);
    const state = createState();
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
    state.plan.exercises[0]!.selectedStationId = "station-1";
    state.plan.exercises[0]!.selectedStationProfileLoadsKg = [180, 195, 200];
    state.plan.exercises[0]!.completedSets = [{ setIndex: 1, setSide: "BILATERAL", loadValue: 230, reps: 8 }];
    el.state = state;

    expect(el.querySelector('[data-input-action="load-input"]')).toBeNull();
    expect(el.querySelector('[data-input-action="reps-input"]')).toBeNull();
    expect(el.querySelector('[data-ui-action="open-load-picker"]')).toBeTruthy();
    expect(el.querySelector('[data-ui-action="open-reps-picker"]')).toBeTruthy();

    const loadTrigger = el.querySelector('[data-ui-action="open-load-picker"]') as HTMLButtonElement;
    loadTrigger.click();
    const loadRows = Array.from(el.querySelectorAll('[data-ui-action="load-picker-row"]')).map(
      (node) => (node.textContent ?? "").trim(),
    );
    expect(loadRows).toEqual(["180 kg", "195 kg", "200 kg"]);
    expect(loadRows).not.toContain("230 kg");

    const historyLabels = Array.from(el.querySelectorAll(".completed-set-row")).map(
      (node) => node.getAttribute("aria-label") ?? "",
    );
    expect(historyLabels.some((label) => label.includes("230 kg"))).toBe(true);
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
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-1";
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
    state.plan.exercises[0]!.selectedTrainingPlanExerciseVariantId = "opt-stationless";
    state.plan.exercises[0]!.selectedStationId = null;

    el.state = state;

    expect(el.querySelector('[data-ui-action="open-load-picker"]')).toBeNull();
    expect(el.textContent ?? "").toContain("REPS");
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

    const secsTrigger = el.querySelector('[data-ui-action="open-secs-picker"]') as HTMLButtonElement | null;

    expect(secsTrigger).toBeTruthy();
    expect(secsTrigger?.textContent?.trim()).toBe("2:05");
    expect(el.querySelector('[data-ui-action="decrement-reps"]')?.getAttribute("aria-label")).toBe("Reset timer");
    expect(el.querySelector('[data-ui-action="increment-reps"]')?.getAttribute("aria-label")).toBe("Pause timer");
  });

  it("opens secs picker and applies m:ss selection", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.activeSet.reps = 65;
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const trigger = el.querySelector('[data-ui-action="open-secs-picker"]') as HTMLButtonElement;
    trigger.click();

    const minuteRow = el.querySelector('[data-ui-action="secs-picker-minute-row"][data-secs-value="2"]') as HTMLButtonElement;
    const secondRow = el.querySelector('[data-ui-action="secs-picker-second-row"][data-secs-value="30"]') as HTMLButtonElement;
    minuteRow.click();
    secondRow.click();

    const apply = el.querySelector('[data-ui-action="secs-picker-apply"]') as HTMLButtonElement;
    apply.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "secs-input", value: "2:30" });
  });

  it("does not open secs picker while timer is running", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.activeSet.reps = 65;
    state.plan.exercises[0]!.isSecsTimerRunning = true;
    el.state = state;

    const trigger = el.querySelector('[data-ui-action="open-secs-picker"]') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);

    trigger.click();
    expect(el.querySelector(".secs-picker-layer")).toBeNull();
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

  it("keeps complete-set disabled at 0 secs and enables above zero", () => {
    const el = document.createElement(pbExerciseScreenTag) as HTMLElement & {
      state: ExerciseScreenState;
    };

    document.body.append(el);

    const state = createState();
    state.plan.exercises[0]!.repetitionKind = "SECS";
    state.plan.exercises[0]!.activeSet.reps = 0;
    state.plan.exercises[0]!.activeSetInput.reps = "0";
    state.plan.exercises[0]!.isSecsTimerRunning = false;

    el.state = state;

    const completeSetButton = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(completeSetButton.disabled).toBe(true);

    state.plan.exercises[0]!.activeSet.reps = 1;
    state.plan.exercises[0]!.activeSetInput.reps = "1";
    el.state = state;

    const enabledCompleteSetButton = el.querySelector('[data-ui-action="next-set"]') as HTMLButtonElement;
    expect(enabledCompleteSetButton.disabled).toBe(false);
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
      selectedTrainingPlanExerciseVariantId: null,
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
