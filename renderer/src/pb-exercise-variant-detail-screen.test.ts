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
      exercise_name: "Cable Row",
      variant_name: "Cable Row - Pronated Grip",
      last_performed_at: "2026-04-17T10:45:00.000Z",
      last_performed_days_ago: 2,
      last_performed_first_set_display: "100 kg x 5 reps",
      selected_station_average_score_30d: 1.04,
      variant_session_count_30d: 7,
      performance_status: "AVAILABLE",
      performance_tone: "GREEN",
      personal_records_12m: {
        metric_family: "load_x_reps",
        entries: [
          { load_kg: 105, reps: 7, occurred_at: "1999-01-02T00:00:00.000Z" },
          { load_kg: 100, reps: 9, occurred_at: "2001-02-03T00:00:00.000Z" },
        ],
      },
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
        exercise_name: "Barbell Squat",
        variant_name: "Barbell Squat",
        last_performed_at: "2026-04-17T10:45:00.000Z",
        last_performed_days_ago: 2,
        last_performed_first_set_display: "100 kg x 5 reps",
        selected_station_average_score_30d: 1.067,
        variant_session_count_30d: 6.8,
        performance_status: "AVAILABLE",
        performance_tone: "GREEN",
        score_trend_30d: {
          entries: [
            { occurred_at: "2026-04-01T10:45:00.000Z", score: 0.93 },
            { occurred_at: "2026-04-05T10:45:00.000Z", score: 0.98 },
            { occurred_at: "2026-04-09T10:45:00.000Z", score: 1.01 },
            { occurred_at: "2026-04-13T10:45:00.000Z", score: 1.04 },
            { occurred_at: "2026-04-17T10:45:00.000Z", score: 1.07 },
            { occurred_at: "2026-04-20T10:45:00.000Z", score: 1.10 },
          ],
        },
      },
    };

    expect(el.textContent ?? "").toContain("Barbell Squat");
    expect(el.textContent ?? "").toContain("Improving");
    expect(el.textContent ?? "").not.toContain("30d score:");
    expect(el.textContent ?? "").not.toContain("Based on 6 scored sessions");
    expect(el.textContent ?? "").toContain("Last 30 days");
    expect(el.textContent ?? "").toContain("1.20");
    expect(el.textContent ?? "").toContain("0.95");
    expect(el.textContent ?? "").toContain("0.70");
    expect(el.querySelector(".exercise-variant-trend-hero--green")).not.toBeNull();
    expect(el.querySelector(".exercise-variant-score-trend-svg .progress-trend-line")).not.toBeNull();
    expect(el.querySelectorAll(".exercise-variant-score-trend-svg .progress-trend-dot")).toHaveLength(6);
    expect(el.querySelector(".exercise-variant-strength-svg")).toBeNull();
    expect(el.textContent ?? "").toContain("Not enough strength data yet.");
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
    expect(el.textContent ?? "").not.toContain("30d score:");
    expect(el.textContent ?? "").not.toContain("Based on 0 scored sessions");
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
        exercise_name: "Barbell Squat",
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

  it("uses explicit exercise and variant names when both are available", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-1",
      row: {
        variant_id: "variant-1",
        exercise_name: "Cable Row",
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
    expect(subtitle?.textContent).toBe("Cable Row - Pronated Grip");
  });

  it("renders metric-specific trend headlines without metric selector", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength",
      row: strengthRow(),
    };

    expect(el.textContent ?? "").toContain("Load Trend (kg)");
    expect(el.textContent ?? "").toContain("Rep Trend");
    expect(el.textContent ?? "").toContain("Time Trend");
    expect(el.textContent ?? "").toContain("Last 12 months");
    expect(el.querySelector('[data-strength-control="metric-mode"]')).toBeNull();
    expect(el.querySelector('[data-strength-control="station-mode"][data-strength-station-mode="primary"]')).not.toBeNull();
    expect(el.querySelector('[data-strength-control="station-mode"][data-strength-station-mode="all"]')).not.toBeNull();
    expect(el.querySelectorAll(".exercise-variant-strength-svg")).toHaveLength(3);
  });

  it("renders both load and estimated 1RM trend headlines for load x reps variants", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength-1rm",
      row: {
        variant_id: "variant-strength-1rm",
        exercise_name: "Barbell Deadlift",
        variant_name: "Conventional Barbell Deadlift",
        last_performed_at: "2026-04-20T10:45:00.000Z",
        last_performed_days_ago: 3,
        last_performed_first_set_display: "140 kg x 5 reps",
        selected_station_average_score_30d: 1.05,
        variant_session_count_30d: 6,
        performance_status: "AVAILABLE",
        performance_tone: "GREEN",
        strength_progression_12m: {
          metric_modes: [
            {
              id: "weight",
              label: "Weight",
              family: "kg",
              station_modes: ["primary", "all"],
              points: [
                { occurred_at: "2026-01-20T10:00:00.000Z", value: 130, station_id: "station-a", station_label: "Station A", is_primary_station: true },
                { occurred_at: "2026-04-20T10:00:00.000Z", value: 140, station_id: "station-a", station_label: "Station A", is_primary_station: true },
              ],
            },
            {
              id: "estimated-1rm",
              label: "1RM",
              family: "kg",
              station_modes: ["primary", "all"],
              points: [
                { occurred_at: "2026-01-20T10:00:00.000Z", value: 151.7, station_id: "station-a", station_label: "Station A", is_primary_station: true },
                { occurred_at: "2026-04-20T10:00:00.000Z", value: 163.3, station_id: "station-a", station_label: "Station A", is_primary_station: true },
              ],
            },
          ],
        },
      },
    };

    expect(el.textContent ?? "").toContain("Load Trend (kg)");
    expect(el.textContent ?? "").toContain("Estimated 1RM Trend (kg)");
    expect(el.querySelectorAll(".exercise-variant-strength-svg")).toHaveLength(2);
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
    expect(lines).toHaveLength(4);
    expect(el.querySelectorAll(".exercise-variant-strength-legend-item")).toHaveLength(2);
  });

  it("renders family-specific axis formatting across multiple metric charts", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength",
      row: strengthRow(),
    };

    expect(
      Array.from(el.querySelectorAll(".exercise-variant-strength-axis-label")).some((node) =>
        (node.textContent ?? "").includes("kg"),
      ),
    ).toBe(true);
    expect(
      Array.from(el.querySelectorAll(".exercise-variant-strength-axis-label")).some((node) =>
        (node.textContent ?? "").includes("reps"),
      ),
    ).toBe(true);
    expect(
      Array.from(el.querySelectorAll(".exercise-variant-strength-axis-label")).some((node) =>
        (node.textContent ?? "").includes(":"),
      ),
    ).toBe(true);
  });

  it("renders empty and low-data fallback copy across detail sections", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-sparse",
      row: {
        variant_id: "variant-sparse",
        exercise_name: "Leg Press",
        variant_name: "Leg Press - Neutral Stance",
        last_performed_at: "2026-04-17T10:45:00.000Z",
        last_performed_days_ago: 2,
        last_performed_first_set_display: "No data",
        selected_station_average_score_30d: null,
        variant_session_count_30d: 2,
        performance_status: "AVAILABLE",
        performance_tone: "GREEN",
        personal_records_12m: {
          metric_family: "load_x_reps",
          entries: [],
        },
        recent_sessions: {
          station_mode: "primary",
          entries: [],
        },
      },
    };

    expect(el.textContent ?? "").toContain("Not enough sessions for a trend.");
    expect(el.querySelector(".exercise-variant-score-trend-svg")).toBeNull();
    expect(el.textContent ?? "").toContain("Strength Progression");
    expect(el.textContent ?? "").toContain("Not enough strength data yet.");
    expect(el.querySelector(".exercise-variant-strength-svg")).toBeNull();
    expect(el.textContent ?? "").toContain("Personal Records");
    expect(el.textContent ?? "").toContain("No personal records yet.");
    expect(el.querySelector(".exercise-variant-records-table")).toBeNull();
  });

  it("shows per-mode strength fallback when primary mode has no primary-station points", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength-partial",
      row: {
        variant_id: "variant-strength-partial",
        exercise_name: "Cable Row",
        variant_name: "Cable Row - Pronated Grip",
        last_performed_at: "2026-04-24T10:45:00.000Z",
        last_performed_days_ago: 1,
        last_performed_first_set_display: "100 kg x 5 reps",
        selected_station_average_score_30d: 1.03,
        variant_session_count_30d: 4,
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
                  occurred_at: "2026-01-24T10:00:00.000Z",
                  value: 80,
                  station_id: "station-a",
                  station_label: "Station A",
                  is_primary_station: false,
                },
                {
                  occurred_at: "2026-03-24T10:00:00.000Z",
                  value: 84,
                  station_id: "station-b",
                  station_label: "Station B",
                  is_primary_station: false,
                },
              ],
            },
          ],
        },
      },
    };

    expect(el.textContent ?? "").toContain("Not enough strength data for this mode.");
    expect(el.querySelector(".exercise-variant-strength-svg")).toBeNull();

    const allStationsButton = el.querySelector(
      '[data-strength-control="station-mode"][data-strength-station-mode="all"]',
    ) as HTMLButtonElement;
    allStationsButton.click();

    expect(el.querySelector(".exercise-variant-strength-svg")).not.toBeNull();
  });

  it("renders personal records rows with metric formatting and no dates", () => {
    const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
      state: ExerciseVariantDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      variantId: "variant-strength",
      row: strengthRow(),
    };

    expect(el.textContent ?? "").toContain("Personal Records");
    expect(el.querySelectorAll(".exercise-variant-records-body .exercise-variant-records-cell")).toHaveLength(4);
    expect(el.querySelector(".exercise-variant-records-cell--head")?.textContent).toBe("Load");
    expect(el.textContent ?? "").toContain("105 kg");
    expect(el.textContent ?? "").toContain("7 reps");
    expect(el.textContent ?? "").not.toContain("1999");
    expect(el.textContent ?? "").not.toContain("2001");
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
