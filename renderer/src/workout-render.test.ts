import { describe, it, expect } from "vitest";
import { renderStartScreen, renderCompletionScreen } from "./workout-render";

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
});
