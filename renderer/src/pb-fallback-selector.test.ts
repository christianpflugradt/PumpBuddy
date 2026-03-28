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
    ],
    selectedPlanExerciseOptionId: "opt-1",
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
});
