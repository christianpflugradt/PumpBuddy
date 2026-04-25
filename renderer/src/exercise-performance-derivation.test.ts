import { describe, expect, it } from "vitest";
import {
  deriveExercisePerformance,
  derivePersonalRecords,
  PERSONAL_RECORDS_COMPACT_ROW_LIMIT,
} from "./exercise-performance-derivation";
import type { WorkoutExercisesPerformanceRow } from "./workout-types";

const baseRow = (): WorkoutExercisesPerformanceRow => ({
  variant_id: "variant-1",
  exercise_name: "Barbell Squat",
  variant_name: "Barbell Squat",
  last_performed_at: "2026-04-17T10:45:00.000Z",
  last_performed_days_ago: 2,
  last_performed_first_set_display: "100 kg x 5 reps",
  selected_station_average_score_30d: 1.067,
  variant_session_count_30d: 6.9,
  performance_status: "AVAILABLE",
  performance_tone: "GREEN",
});

describe("exercise-performance-derivation", () => {
  it("normalizes score and comparable scored sessions from a performance row", () => {
    const derived = deriveExercisePerformance(baseRow());

    expect(derived.score).toBe(1.067);
    expect(derived.scoreLabel).toBe("1.07");
    expect(derived.trendStatus).toBe("AVAILABLE");
    expect(derived.trendTone).toBe("GREEN");
    expect(derived.comparableScoredSessions).toEqual({
      count: 6,
      label: "6 sessions",
      scoredLabel: "6 scored sessions",
    });
  });

  it("returns not-enough-data defaults when row is unavailable", () => {
    const derived = deriveExercisePerformance(null);

    expect(derived.score).toBeNull();
    expect(derived.scoreLabel).toBe("--");
    expect(derived.trendStatus).toBe("NOT_ENOUGH_DATA");
    expect(derived.trendTone).toBe("GRAY");
    expect(derived.comparableScoredSessions).toEqual({
      count: 0,
      label: "0 sessions",
      scoredLabel: "0 scored sessions",
    });
  });

  it("derives grouped and load-sorted rows for load x reps records", () => {
    const row = {
      ...baseRow(),
      personal_records_12m: {
        metric_family: "load_x_reps",
        entries: [
          { load_kg: 100, reps: 8, occurred_at: "2026-01-01T00:00:00.000Z" },
          { load_kg: 100, reps: 10, occurred_at: "2026-02-01T00:00:00.000Z" },
          { load_kg: 90, reps: 12, occurred_at: "2026-03-01T00:00:00.000Z" },
          { load_kg: 90, reps: 12, occurred_at: "2026-02-01T00:00:00.000Z" },
          { load_kg: 110, reps: 6, occurred_at: "2026-04-01T00:00:00.000Z" },
        ],
      },
    } as WorkoutExercisesPerformanceRow & {
      personal_records_12m: {
        metric_family: string;
        entries: Array<{ load_kg: number; reps: number; occurred_at: string }>;
      };
    };

    const derived = derivePersonalRecords(row);

    expect(derived.metricFamily).toBe("LOAD_X_REPS");
    expect(derived.rows).toHaveLength(4);
    expect(derived.rows.map((record) => record.groupKey)).toEqual([
      "reps:6",
      "reps:10",
      "reps:8",
      "reps:12",
    ]);
    expect(derived.rows.map((record) => record.reps)).toEqual([6, 10, 8, 12]);
    expect(derived.rows.map((record) => record.loadLabel)).toEqual(["110 kg", "100 kg", "100 kg", "90 kg"]);
  });

  it("derives grouped and load-sorted rows for load x seconds records", () => {
    const row = {
      ...baseRow(),
      personal_records_12m: {
        metric_family: "load_x_seconds",
        entries: [
          { load_kg: 40, seconds: 80, occurred_at: "2026-01-01T00:00:00.000Z" },
          { load_kg: 40, seconds: 95, occurred_at: "2026-02-01T00:00:00.000Z" },
          { load_kg: 55, seconds: 60, occurred_at: "2026-04-01T00:00:00.000Z" },
        ],
      },
    } as WorkoutExercisesPerformanceRow & {
      personal_records_12m: {
        metric_family: string;
        entries: Array<{ load_kg: number; seconds: number; occurred_at: string }>;
      };
    };

    const derived = derivePersonalRecords(row);

    expect(derived.metricFamily).toBe("LOAD_X_SECONDS");
    expect(derived.rows).toHaveLength(3);
    expect(derived.rows.map((record) => record.groupKey)).toEqual(["seconds:60", "seconds:95", "seconds:80"]);
    expect(derived.rows.map((record) => record.seconds)).toEqual([60, 95, 80]);
    expect(derived.rows.map((record) => record.secondsLabel)).toEqual(["1:00", "1:35", "1:20"]);
  });

  it("derives reps-only rows with deterministic tie breaking and limit", () => {
    const row = {
      ...baseRow(),
      personal_records_12m: {
        metric_family: "reps_only",
        entries: [
          { reps: 6, occurred_at: "2026-02-01T00:00:00.000Z" },
          { reps: 7, occurred_at: "2026-02-02T00:00:00.000Z" },
          { reps: 8, occurred_at: "2026-02-03T00:00:00.000Z" },
          { reps: 9, occurred_at: "2026-02-04T00:00:00.000Z" },
          { reps: 10, occurred_at: "2026-02-05T00:00:00.000Z" },
          { reps: 11, occurred_at: "2026-02-06T00:00:00.000Z" },
          { reps: 12, occurred_at: "2026-02-07T00:00:00.000Z" },
          { reps: 12, occurred_at: "2026-01-01T00:00:00.000Z" },
        ],
      },
    } as WorkoutExercisesPerformanceRow & {
      personal_records_12m: {
        metric_family: string;
        entries: Array<{ reps: number; occurred_at: string }>;
      };
    };

    const derived = derivePersonalRecords(row);

    expect(derived.metricFamily).toBe("REPS_ONLY");
    expect(derived.rowLimit).toBe(PERSONAL_RECORDS_COMPACT_ROW_LIMIT);
    expect(derived.rows).toHaveLength(7);
    expect(derived.rows.map((record) => record.groupKey)).toEqual([
      "reps:12",
      "reps:11",
      "reps:10",
      "reps:9",
      "reps:8",
      "reps:7",
      "reps:6",
    ]);
  });

  it("derives seconds-only rows sorted by duration descending", () => {
    const row = {
      ...baseRow(),
      personal_records_12m: {
        metric_family: "seconds_only",
        entries: [
          { seconds: 30, occurred_at: "2026-03-01T00:00:00.000Z" },
          { seconds: 45, occurred_at: "2026-01-01T00:00:00.000Z" },
          { seconds: 60, occurred_at: "2026-02-01T00:00:00.000Z" },
        ],
      },
    } as WorkoutExercisesPerformanceRow & {
      personal_records_12m: {
        metric_family: string;
        entries: Array<{ seconds: number; occurred_at: string }>;
      };
    };

    const derived = derivePersonalRecords(row);

    expect(derived.metricFamily).toBe("SECONDS_ONLY");
    expect(derived.rows.map((record) => record.groupKey)).toEqual(["seconds:60", "seconds:45", "seconds:30"]);
    expect(derived.rows.map((record) => record.secondsLabel)).toEqual(["1:00", "0:45", "0:30"]);
  });

  it("returns empty rows for missing or unsupported record payloads", () => {
    const unsupported = {
      ...baseRow(),
      personal_records_12m: {
        metric_family: "unknown",
        entries: [{ load_kg: 100, reps: 5 }],
      },
    } as WorkoutExercisesPerformanceRow & {
      personal_records_12m: {
        metric_family: string;
        entries: Array<{ load_kg: number; reps: number }>;
      };
    };

    const derivedUnsupported = derivePersonalRecords(unsupported);
    const derivedMissing = derivePersonalRecords(null);

    expect(derivedUnsupported.metricFamily).toBeNull();
    expect(derivedUnsupported.rows).toEqual([]);
    expect(derivedMissing.metricFamily).toBeNull();
    expect(derivedMissing.rows).toEqual([]);
  });
});
