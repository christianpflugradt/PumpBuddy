import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbExerciseVariantDetailScreenTag,
  registerPbExerciseVariantDetailScreen,
  type ExerciseVariantDetailScreenState,
} from "./pb-exercise-variant-detail-screen";

describe("pb-exercise-variant-detail-screen", () => {
  beforeEach(() => {
    registerPbExerciseVariantDetailScreen();
  });

  it("renders score and comparable scored sessions via shared derivation", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-1",
      row: {
        variant_id: "variant-1",
        variant_name: "Barbell Squat",
        last_performed_at: "2026-04-17T10:45:00.000Z",
        last_performed_days_ago: 2,
        last_performed_first_set_display: "100 kg x 5 reps",
        selected_station_average_score_30d: 1.067,
        variant_session_count_30d: 6.8,
        performance_status: "AVAILABLE",
        performance_tone: "GREEN",
      },
    };

    expect(el.textContent ?? "").toContain("Barbell Squat");
    expect(el.textContent ?? "").toContain("6 scored sessions");
    expect(el.textContent ?? "").toContain("1.07");
    expect(el.textContent ?? "").toContain("30d Score");
    expect(el.textContent ?? "").toContain("Sessions");
  });

  it("renders fallback copy when variant context is unavailable", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "missing-variant",
      row: null,
    };

    expect(el.textContent ?? "").toContain("Exercise Variant");
    expect(el.textContent ?? "").toContain("Variant context unavailable");
    expect(el.textContent ?? "").toContain("--");
  });

  it("emits navigate-exercises action when back button is clicked", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = { variantId: "variant-1", row: null };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const backButton = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    backButton.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail).toEqual({ action: "navigate-exercises" });
  });
});
