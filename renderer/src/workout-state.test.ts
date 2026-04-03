import { describe, it, expect } from "vitest";
import {
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
});
