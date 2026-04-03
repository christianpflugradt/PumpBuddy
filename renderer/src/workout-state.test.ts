import { describe, it, expect } from "vitest";
import {
  buildWorkoutPlan,
  createInitialStartScreenState,
  canStartWorkout,
  getNextViewState,
  isDigitsOnly,
  hasCompletedSets,
  isDraftModified,
  selectDefaultTrainingPlanId,
} from "./workout-state";

describe("workout-state (core utils)", () => {
  it("creates initial start screen state", () => {
    const state = createInitialStartScreenState();
    expect(state.isLoading).toBe(true);
    expect(state.trainingPlans).toEqual([]);
  });

  it("canStartWorkout returns false when loading", () => {
    const state = createInitialStartScreenState();
    expect(canStartWorkout(state)).toBe(false);
  });

  it("canStartWorkout returns true when valid", () => {
    const state = {
      ...createInitialStartScreenState(),
      isLoading: false,
      selectedTrainingPlanId: "plan-1",
      selectedGymId: "gym-1",
    };
    expect(canStartWorkout(state)).toBe(true);
  });

  it("getNextViewState advances exercise", () => {
    const next = getNextViewState(
      { screen: "exercise", exerciseIndex: 0 },
      "next",
      3,
    );
    expect(next).toEqual({ screen: "exercise", exerciseIndex: 1 });
  });

  it("getNextViewState goes to completion at end", () => {
    const next = getNextViewState(
      { screen: "exercise", exerciseIndex: 2 },
      "next",
      3,
    );
    expect(next).toEqual({ screen: "completion" });
  });

  it("isDigitsOnly works correctly", () => {
    expect(isDigitsOnly("123")).toBe(true);
    expect(isDigitsOnly("12a")).toBe(false);
  });

  it("hasCompletedSets detects sets", () => {
    const step = { completedSets: [{ setIndex: 1, loadValue: 10, reps: 10 }] } as any;
    expect(hasCompletedSets(step)).toBe(true);
  });

  it("isDraftModified detects changes", () => {
    const step = {
      activeSet: { loadValue: 20, reps: 10 },
      suggestedSet: { loadValue: 10, reps: 10 },
    } as any;
    expect(isDraftModified(step)).toBe(true);
  });

  it("selects the training plan completed longest ago by default", () => {
    const selectedId = selectDefaultTrainingPlanId([
      {
        id: "plan-recent",
        name: "Recent",
        exercise_count: 5,
        last_completed_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "plan-oldest",
        name: "Oldest",
        exercise_count: 5,
        last_completed_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "plan-middle",
        name: "Middle",
        exercise_count: 5,
        last_completed_at: "2026-02-15T10:00:00.000Z",
      },
    ]);

    expect(selectedId).toBe("plan-oldest");
  });

  it("keeps first option order when oldest completion timestamps tie", () => {
    const selectedId = selectDefaultTrainingPlanId([
      {
        id: "plan-first",
        name: "First",
        exercise_count: 5,
        last_completed_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "plan-second",
        name: "Second",
        exercise_count: 5,
        last_completed_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "plan-newer",
        name: "Newer",
        exercise_count: 5,
        last_completed_at: "2026-03-20T10:00:00.000Z",
      },
    ]);

    expect(selectedId).toBe("plan-first");
  });

  it("buildWorkoutPlan keeps first fallback option when no completion history exists", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-first",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Cable",
            station_id: "station-a",
            station_name: "Cable 1",
            suggested_start_load_kg: 20,
          },
          {
            id: "opt-second",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-b",
            variant_name: "Machine",
            station_id: "station-b",
            station_name: "Machine 1",
            suggested_start_load_kg: 25,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-first");
    expect(plan.exercises[0]?.selectedStationId).toBe("station-a");
  });

  it("buildWorkoutPlan selects the most recent fallback option by variant+station", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-cable-old",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Chest Press",
            exercise_position: 1,
            variant_id: "variant-cable",
            variant_name: "Cable",
            station_id: "station-cable",
            station_name: "Cable Station",
            last_completed_at: "2026-03-01T08:00:00.000Z",
            suggested_start_load_kg: 15,
          },
          {
            id: "opt-cable-new-station",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Chest Press",
            exercise_position: 1,
            variant_id: "variant-cable",
            variant_name: "Cable",
            station_id: "station-cable-2",
            station_name: "Cable Station 2",
            last_completed_at: "2026-03-21T08:00:00.000Z",
            suggested_start_load_kg: 17.5,
          },
          {
            id: "opt-machine-middle",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Chest Press",
            exercise_position: 1,
            variant_id: "variant-machine",
            variant_name: "Machine",
            station_id: "station-machine",
            station_name: "Machine Station",
            last_completed_at: "2026-03-12T08:00:00.000Z",
            suggested_start_load_kg: 20,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-cable-new-station");
    expect(plan.exercises[0]?.selectedVariantId).toBe("variant-cable");
    expect(plan.exercises[0]?.selectedStationId).toBe("station-cable-2");
  });

  it("buildWorkoutPlan keeps first-order tie break when fallback recency is equal", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-first",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Lat Pull",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Wide Grip",
            station_id: "station-a",
            station_name: "Pulldown A",
            last_completed_at: "2026-03-20T10:00:00.000Z",
            suggested_start_load_kg: 40,
          },
          {
            id: "opt-second",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Lat Pull",
            exercise_position: 1,
            variant_id: "variant-b",
            variant_name: "Neutral Grip",
            station_id: "station-b",
            station_name: "Pulldown B",
            last_completed_at: "2026-03-20T10:00:00.000Z",
            suggested_start_load_kg: 42.5,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-first");
    expect(plan.exercises[0]?.selectedStationId).toBe("station-a");
  });
});
