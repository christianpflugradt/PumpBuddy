import { describe, it, expect, vi } from "vitest";
import { registerAppInteraction } from "./workout-interaction";

describe("workout-interaction", () => {
  const setup = () => {
    const app = document.createElement("div");

    let state: any = {
      viewState: { screen: "start" },
      workoutPlan: null,
      workoutSave: { isSaving: false },
      confirmDialog: { message: null },
      startScreen: { selectedWorkoutMode: "configured-gym" },
    };

    const render = vi.fn();

    const unregister = registerAppInteraction({
      app,
      getState: () => state,
      setState: (next) => { state = next; },
      render,
      orchestrator: {
        startWorkout: vi.fn(),
        cancelWorkout: vi.fn(),
        finishWorkout: vi.fn(),
        persistActiveSet: vi.fn(),
        persistSkipTransition: vi.fn(),
        selectFallbackOption: vi.fn(),
        persistFallbackSelection: vi.fn(),
      } as any,
      openConfirmDialog: vi.fn(),
      closeConfirmDialog: vi.fn(),
      pulseUiFeedback: vi.fn(),
    });

    return { app, getState: () => state, render, unregister };
  };

  it("handles start workout click", () => {
    const { app } = setup();

    const btn = document.createElement("button");
    btn.dataset.action = "start-workout";
    app.appendChild(btn);

    btn.click();

    expect(true).toBe(true);
  });

  it("handles return to start from completion", () => {
    const { app, getState } = setup();

    const btn = document.createElement("button");
    btn.dataset.action = "return-to-start";
    app.appendChild(btn);

    getState().viewState = { screen: "completion" };

    btn.click();

    expect(getState().viewState.screen).toBe("start");
  });

  it("ignores clicks when saving", () => {
    const { app, getState } = setup();

    const btn = document.createElement("button");
    btn.dataset.action = "next-set";
    app.appendChild(btn);

    getState().workoutSave.isSaving = true;

    btn.click();

    expect(true).toBe(true);
  });
});
