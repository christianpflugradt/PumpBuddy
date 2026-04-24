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

  const strengthRow = (): ExerciseVariantDetailScreenState["row"] =>
    ({
      variant_id: "variant-strength",
      variant_name: "Cable Row - Pronated Grip",
      last_performed_at: "2026-04-17T10:45:00.000Z",
      last_performed_days_ago: 2,
      last_performed_first_set_display: "100 kg x 5 reps",
      selected_station_average_score_30d: 1.04,
      variant_session_count_30d: 7,
      performance_status: "AVAILABLE",
      performance_tone: "GREEN",
      strength_progression_12m: {
        metric_modes: [
          {
            id: "load-top",
            label: "Top Set Load",
            family: "kg",
            station_modes: ["primary", "all"],
            points: [
              {
                occurred_at: "2025-07-03T10:00:00.000Z",
                value: 80,
                station_id: "station-a",
                station_label: "Station A",
                is_primary_station: true,
              },
              {
                occurred_at: "2025-11-12T10:00:00.000Z",
                value: 84,
                station_id: "station-b",
                station_label: "Station B",
                is_primary_station: false,
              },
              {
                occurred_at: "2026-03-19T10:00:00.000Z",
                value: 88,
                station_id: "station-a",
                station_label: "Station A",
                is_primary_station: true,
              },
            ],
          },
          {
            id: "rep-peak",
            label: "Peak Reps",
            family: "reps",
            station_modes: ["primary"],
            points: [
              {
                occurred_at: "2025-08-02T10:00:00.000Z",
                value: 8,
                station_id: "station-a",
                station_label: "Station A",
                is_primary_station: true,
              },
              {
                occurred_at: "2026-02-22T10:00:00.000Z",
                value: 12,
                station_id: "station-a",
                station_label: "Station A",
                is_primary_station: true,
              },
            ],
          },
          {
            id: "time-best",
            label: "Best Hold Time",
            family: "time",
            station_modes: ["primary"],
            points: [
              {
                occurred_at: "2025-09-10T10:00:00.000Z",
                value: 45,
                station_id: "station-a",
                station_label: "Station A",
                is_primary_station: true,
              },
              {
                occurred_at: "2026-04-02T10:00:00.000Z",
                value: 70,
                station_id: "station-a",
                station_label: "Station A",
                is_primary_station: true,
              },
            ],
          },
        ],
      },
    }) as ExerciseVariantDetailScreenState["row"];

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
    expect(el.textContent ?? "").toContain("Score Trend");
    expect(el.textContent ?? "").toContain("Last 30 days");
    expect(el.textContent ?? "").toContain("1.20");
    expect(el.textContent ?? "").toContain("0.95");
    expect(el.textContent ?? "").toContain("0.70");
    expect(el.querySelector(".exercise-variant-trend-hero--green")).not.toBeNull();
    expect(el.querySelector(".exercise-variant-score-trend-svg .progress-trend-line")).not.toBeNull();
    expect(el.querySelectorAll(".exercise-variant-score-trend-svg .progress-trend-dot")).toHaveLength(6);
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
    expect(el.textContent ?? "").toContain("Not enough sessions for a trend.");
    expect(el.querySelector(".exercise-variant-trend-hero--gray")).not.toBeNull();
    expect(el.querySelector(".exercise-variant-score-trend-svg")).toBeNull();
  });

  it("renders gray score trend fallback when comparable scored sessions are fewer than three", () => {
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
        selected_station_average_score_30d: 1.01,
        variant_session_count_30d: 2,
        performance_status: "AVAILABLE",
        performance_tone: "GREEN",
      },
    };

    expect(el.textContent ?? "").toContain("Not enough sessions for a trend.");
    expect(el.querySelector(".exercise-variant-score-trend-svg")).toBeNull();
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

  it("renders strength progression controls with readable y-axis labels", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength",
      row: strengthRow(),
    };

    expect(el.textContent ?? "").toContain("Strength Progression");
    expect(el.textContent ?? "").toContain("Last 12 months");
    expect(el.querySelector('[data-strength-control="metric-mode"]')).not.toBeNull();
    expect(el.querySelector('[data-strength-control="station-mode"][data-strength-station-mode="primary"]')).not.toBeNull();
    expect(el.querySelector('[data-strength-control="station-mode"][data-strength-station-mode="all"]')).not.toBeNull();
    const yAxisLabels = el.querySelectorAll(".exercise-variant-strength-axis-label");
    expect(yAxisLabels.length).toBeGreaterThanOrEqual(2);
    expect(yAxisLabels.length).toBeLessThanOrEqual(5);
    expect(Array.from(yAxisLabels).some((node) => (node.textContent ?? "").includes("kg"))).toBe(true);
  });

  it("does not connect different stations in all-stations mode", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength",
      row: strengthRow(),
    };

    const allStationsButton = el.querySelector(
      '[data-strength-control="station-mode"][data-strength-station-mode="all"]',
    ) as HTMLButtonElement;
    allStationsButton.click();

    const lines = el.querySelectorAll(".exercise-variant-strength-line");
    expect(lines).toHaveLength(2);
    expect(el.querySelectorAll(".exercise-variant-strength-legend-item")).toHaveLength(2);
  });

  it("updates axis formatting when switching metric family", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength",
      row: strengthRow(),
    };

    const metricSelect = el.querySelector('[data-strength-control="metric-mode"]') as HTMLSelectElement;
    metricSelect.value = "rep-peak";
    metricSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      Array.from(el.querySelectorAll(".exercise-variant-strength-axis-label")).some((node) =>
        (node.textContent ?? "").includes("reps"),
      ),
    ).toBe(true);

    const metricSelectAfterReRender = el.querySelector('[data-strength-control="metric-mode"]') as HTMLSelectElement;
    metricSelectAfterReRender.value = "time-best";
    metricSelectAfterReRender.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      Array.from(el.querySelectorAll(".exercise-variant-strength-axis-label")).some((node) =>
        (node.textContent ?? "").includes(":"),
      ),
    ).toBe(true);
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
