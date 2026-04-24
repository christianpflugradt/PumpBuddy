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

  it("renders detail header and trend hero from shared derivation", () => {
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
    expect(el.textContent ?? "").toContain("Trend Hero");
    expect(el.textContent ?? "").toContain("Improving");
    expect(el.textContent ?? "").toContain("30d score: 1.07");
    expect(el.textContent ?? "").toContain("Based on 6 scored sessions");
    expect(el.querySelector(".exercise-variant-trend-hero--green")).not.toBeNull();
    expect(el.querySelector(".progress-hero-icon svg")).not.toBeNull();
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
    expect(el.textContent ?? "").toContain("Not enough data");
    expect(el.textContent ?? "").toContain("30d score: --");
    expect(el.textContent ?? "").toContain("Based on 0 scored sessions");
    expect(el.querySelector(".exercise-variant-trend-hero--gray")).not.toBeNull();
  });

  it("splits exercise title and variant subtitle when variant name is segmented", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-1",
      row: {
        variant_id: "variant-1",
        variant_name: "Cable Row - Pronated Grip",
        last_performed_at: "2026-04-17T10:45:00.000Z",
        last_performed_days_ago: 2,
        last_performed_first_set_display: "100 kg x 5 reps",
        selected_station_average_score_30d: 1.02,
        variant_session_count_30d: 5,
        performance_status: "AVAILABLE",
        performance_tone: "YELLOW",
      },
    };

    const title = el.querySelector(".exercise-variant-detail-header-title");
    const subtitle = el.querySelector(".exercise-variant-detail-header-subtitle");
    expect(title?.textContent).toBe("Cable Row");
    expect(subtitle?.textContent).toBe("Pronated Grip");
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
