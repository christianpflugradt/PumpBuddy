import { describe, it, expect } from "vitest";
import {
  renderCompletionScreen,
  renderConfirmDialog,
  renderExerciseScreen,
  renderStartScreen,
} from "./workout-render";
import type { ExerciseStep, WorkoutPlan } from "./workout-types";

const createExercise = (overrides: Partial<ExerciseStep> = {}): ExerciseStep => ({
  trainingPlanExerciseId: "tpe-1",
  name: "Deadlift",
  fallbackOptions: [
    {
      id: "opt-1",
      training_plan_exercise_id: "tpe-1",
      exercise_name: "Deadlift",
      exercise_position: 1,
      variant_id: "variant-1",
      variant_name: "Conventional",
      station_id: "station-1",
      station_name: "Rack",
      station_profile_loads_kg: [20, 25],
      suggested_start_load_kg: 20,
    },
  ],
  selectedPlanExerciseOptionId: "opt-1",
  selectedVariantId: "variant-1",
  selectedStationId: "station-1",
  selectedStationProfileLoadsKg: [20, 25],
  loadInputMode: "TOTAL",
  repetitionKind: "REPS",
  isFallbackOptionConfirmed: true,
  skippedAt: null,
  suggestedSet: { loadValue: 20, reps: 10 },
  activeSet: { loadValue: 20, reps: 10 },
  activeSetInput: { loadValue: "20", reps: "10" },
  completedSets: [],
  currentSetIndex: 1,
  currentSetSide: "BILATERAL",
  isReadOnly: false,
  isSecsTimerRunning: false,
  ...overrides,
});

const createPlan = (exerciseOverrides: Partial<ExerciseStep> = {}): WorkoutPlan => ({
  id: "plan-1",
  name: "Plan",
  exercises: [createExercise(exerciseOverrides)],
});

describe("workout-render", () => {
  it("renders start screen", () => {
    const html = renderStartScreen({
      isLoading: false,
      isStarting: false,
      errorMessage: null,
      blockedStartModal: null,
      trainingPlans: [],
      gyms: [],
      selectedTrainingPlanId: "",
      selectedGymId: "",
      selectedWorkoutMode: "configured-gym",
    });

    expect(html).toContain("Workout start screen");
  });

  it("renders completion screen", () => {
    const html = renderCompletionScreen(
      { id: "1", name: "Plan", exercises: [] },
      { startedAt: "2020-01-01", completedAt: "2020-01-01" },
    );

    expect(html).toContain("Plan Completed");
  });

  it("does not render confirm dialog when message is missing", () => {
    const html = renderConfirmDialog(
      { message: null, confirmActionLabel: null, onConfirm: null },
      { isSaving: false, errorMessage: null },
    );

    expect(html).toBe("");
  });

  it("hides set controls until fallback selection is confirmed", () => {
    const html = renderExerciseScreen(
      createPlan({
        fallbackOptions: [
          {
            id: "opt-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Deadlift",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Conventional",
            station_id: "station-1",
            station_name: "Rack",
            station_profile_loads_kg: [20, 25],
            suggested_start_load_kg: 20,
          },
          {
            id: "opt-2",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Deadlift",
            exercise_position: 1,
            variant_id: "variant-2",
            variant_name: "Trap Bar",
            station_id: "station-2",
            station_name: "Platform",
            station_profile_loads_kg: [20, 30],
            suggested_start_load_kg: 20,
          },
        ],
        isFallbackOptionConfirmed: false,
      }),
      0,
      {
        selectedWorkoutMode: "configured-gym",
        selectedGymId: "gym-1",
        gyms: [{ id: "gym-1", name: "Downtown" }],
      },
      { message: null, confirmActionLabel: null, onConfirm: null },
      { id: "aw-1", startedAt: "now", persistedExerciseCount: 0 },
      { isSaving: false, errorMessage: null },
      { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
    );

    expect(html).toContain('data-action="confirm-fallback-option"');
    expect(html).not.toContain('data-action="next-set"');
    expect(html).not.toContain('data-action="next-exercise"');
  });

  it("renders read-only exercise mode with jump action", () => {
    const html = renderExerciseScreen(
      createPlan({
        isReadOnly: true,
        completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 10 }],
      }),
      0,
      {
        selectedWorkoutMode: "configured-gym",
        selectedGymId: "gym-1",
        gyms: [{ id: "gym-1", name: "Downtown" }],
      },
      { message: null, confirmActionLabel: null, onConfirm: null },
      { id: "aw-1", startedAt: "now", persistedExerciseCount: 1 },
      { isSaving: false, errorMessage: null },
      { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
    );

    expect(html).toContain("Viewing previous exercise");
    expect(html).toContain('data-action="jump-to-current-exercise"');
    expect(html).not.toContain('data-action="next-set"');
  });

  it("renders delete affordance only for the latest completed set row", () => {
    const html = renderExerciseScreen(
      createPlan({
        completedSets: [
          { setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 10 },
          { setIndex: 2, setSide: "BILATERAL", loadValue: 25, reps: 8 },
        ],
      }),
      0,
      {
        selectedWorkoutMode: "configured-gym",
        selectedGymId: "gym-1",
        gyms: [{ id: "gym-1", name: "Downtown" }],
      },
      { message: null, confirmActionLabel: null, onConfirm: null },
      { id: "aw-1", startedAt: "now", persistedExerciseCount: 1 },
      { isSaving: false, errorMessage: null },
      { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
    );

    const deleteButtonMatches = html.match(/class="completed-set-delete"/g) ?? [];
    expect(deleteButtonMatches).toHaveLength(1);
    expect(html).toContain('data-ui-action="delete-latest-set"');
    expect(html).toContain('aria-label="Delete set 2"');
    expect(html).not.toContain('aria-label="Delete set 2" disabled');
    expect(html).not.toContain('aria-label="Delete set 1"');
  });

  it("renders timed controls and m:ss formatting for SECS variants", () => {
    const html = renderExerciseScreen(
      createPlan({
        repetitionKind: "SECS",
        activeSet: { loadValue: 20, reps: 75 },
        activeSetInput: { loadValue: "20", reps: "75" },
        isSecsTimerRunning: true,
      }),
      0,
      {
        selectedWorkoutMode: "configured-gym",
        selectedGymId: "gym-1",
        gyms: [{ id: "gym-1", name: "Downtown" }],
      },
      { message: null, confirmActionLabel: null, onConfirm: null },
      { id: "aw-1", startedAt: "now", persistedExerciseCount: 0 },
      { isSaving: false, errorMessage: null },
      { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
    );

    expect(html).toContain('value="1:15"');
    expect(html).toContain('data-action="secs-input"');
    expect(html).not.toContain('type="time"');
    expect(html).toContain('aria-label="Reset timer"');
    expect(html).toContain('aria-label="Pause timer"');
  });
});
