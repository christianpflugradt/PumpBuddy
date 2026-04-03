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

    const text = el.textContent ?? "";
    expect(text).toContain("Plan A");
  });

  it("emits start-workout action", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
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

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("emits select input actions for plan and gym", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const planSelect = el.querySelector('[data-input-action="select-training-plan"]') as HTMLSelectElement;
    planSelect.value = "p1";
    planSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const gymSelect = el.querySelector('[data-input-action="select-gym"]') as HTMLSelectElement;
    gymSelect.value = "g1";
    gymSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "select-training-plan", value: "p1" });
    expect(handler.mock.calls[1][0].detail).toEqual({ action: "select-gym", value: "g1" });
  });

  it("emits workout mode selection from radio input", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.selectedWorkoutMode = "free-mode";
    state.selectedGymId = "";
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const gymModeRadio = el.querySelector('input[value="configured-gym"]') as HTMLInputElement;
    gymModeRadio.checked = true;
    gymModeRadio.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "select-workout-mode",
      value: "configured-gym",
    });
  });

  it("hides gym selector and renders free mode preview context", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.selectedWorkoutMode = "free-mode";
    state.selectedGymId = "";
    el.state = state;

    expect(el.querySelector("#gym-select")).toBeNull();
    expect(el.textContent ?? "").toContain("Free Mode (No Gym)");
  });

  it("renders blocked-start modal and emits dismiss action", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.blockedStartModal = {
      message: "Cannot start",
      trainingPlanName: "Plan A",
      gymName: "Gym A",
      missingExercises: [
        {
          exercise_position: 1,
          exercise_name: "Chest Press",
          reason: "no_realizable_option_in_selected_gym",
        },
      ],
    };
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const dismiss = el.querySelector('[data-ui-action="dismiss-start-blocked-modal"]') as HTMLButtonElement;
    dismiss.click();

    const text = el.textContent ?? "";
    expect(text).toContain("No realizable option in selected gym");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("dismiss-start-blocked-modal");
  });

  it("renders preparing label while starting", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.isStarting = true;
    el.state = state;

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    expect(button.textContent ?? "").toContain("Preparing Workout...");
  });

  it("emits start action when clicking nested element inside button", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    const child = document.createElement("span");
    child.textContent = "Start";
    button.append(child);

    child.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("start-workout");
  });
});
