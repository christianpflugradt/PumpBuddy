import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerPbStartScreen, pbStartScreenTag } from "./pb-start-screen";
import type { StartScreenState } from "./workout-types";

describe("pb-start-screen", () => {
  beforeEach(() => {
    registerPbStartScreen();
  });

  const createState = (): StartScreenState => ({
    isLoading: false,
    isStarting: false,
    errorMessage: null,
    blockedStartModal: null,
    trainingPlans: [{ id: "p1", name: "Plan A", exercise_count: 3 }],
    gyms: [{ id: "g1", name: "Gym A" }],
    selectedTrainingPlanId: "p1",
    selectedGymId: "g1",
    selectedWorkoutMode: "configured-gym",
  });

  it("renders training plan name", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Plan A");
  });

  it("emits start-workout action", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.shadowRoot?.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    button?.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.action).toBe("start-workout");
  });

  it("disables start button when loading", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.isLoading = true;

    el.state = state;

    const button = el.shadowRoot?.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
