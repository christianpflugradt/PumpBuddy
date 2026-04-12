import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerPbFallbackSelector, pbFallbackSelectorTag } from "./pb-fallback-selector";
import type { FallbackSelectorState } from "./pb-fallback-selector";

describe("pb-fallback-selector", () => {
  beforeEach(() => {
    registerPbFallbackSelector();
  });

  const createState = (): FallbackSelectorState => ({
    options: [
      {
        id: "opt-1",
        training_plan_exercise_id: "ex-1",
        variant_id: "v1",
        variant_name: "Variant A",
        station_id: "s1",
        station_name: "Station 1",
        exercise_name: "Bench",
        exercise_position: 1,
        station_profile_loads_kg: [],
      },
      {
        id: "opt-2",
        training_plan_exercise_id: "ex-1",
        variant_id: "v2",
        variant_name: "Variant B",
        station_id: "s2",
        station_name: "Station 2",
        exercise_name: "Bench",
        exercise_position: 1,
        station_profile_loads_kg: [],
      },
    ],
    selectedTrainingPlanExerciseVariantId: "opt-1",
    selectedStationId: "s1",
    isSelectionConfirmed: false,
    isSaving: false,
    isLockedAfterSetCompletion: false,
  });

  it("renders option", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    document.body.append(el);
    el.state = createState();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Variant A");
  });

  it("emits confirm action", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const btn = el.shadowRoot?.querySelector('[data-ui-action="confirm-fallback-option"]') as HTMLButtonElement;
    btn?.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.action).toBe("confirm-fallback-option");
  });

  it("emits input action when option selection changes", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const select = el.shadowRoot?.querySelector("#fallback-option-select") as HTMLSelectElement;
    select.value = "opt-2::s2";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "switch-fallback-option",
      value: "opt-2::s2",
    });
  });

  it("does not render when selection is already confirmed", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    const state = createState();
    state.isSelectionConfirmed = true;

    document.body.append(el);
    el.state = state;

    expect(el.shadowRoot?.innerHTML.trim()).toBe("");
  });

  it("disables controls and renders lock copy after set completion", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    const state = createState();
    state.isLockedAfterSetCompletion = true;

    document.body.append(el);
    el.state = state;

    const select = el.shadowRoot?.querySelector("#fallback-option-select") as HTMLSelectElement;
    const button = el.shadowRoot?.querySelector('[data-ui-action="confirm-fallback-option"]') as HTMLButtonElement;
    const text = el.shadowRoot?.textContent ?? "";

    expect(select.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(text).toContain("Locked after the first completed set.");
  });

  it("disables confirm button when selected option does not exist in options", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    const state = createState();
    state.selectedTrainingPlanExerciseVariantId = "does-not-exist";

    document.body.append(el);
    el.state = state;

    const button = el.shadowRoot?.querySelector('[data-ui-action="confirm-fallback-option"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("emits confirm action when clicking nested element inside button", () => {
    const el = document.createElement(pbFallbackSelectorTag) as HTMLElement & {
      state: FallbackSelectorState;
    };

    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.shadowRoot?.querySelector('[data-ui-action="confirm-fallback-option"]') as HTMLButtonElement;
    const child = document.createElement("span");
    child.textContent = "Select";
    button.append(child);

    child.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("confirm-fallback-option");
  });
});
