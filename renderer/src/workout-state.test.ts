import { describe, it, expect } from "vitest";
import {
  createInitialStartScreenState,
  canStartWorkout,
  getNextViewState,
  isDigitsOnly,
  hasCompletedSets,
  isDraftModified,
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
});
