import { describe, expect, it } from "vitest";
import { deriveExercisePerformance } from "./exercise-performance-derivation";

describe("exercise-performance-derivation", () => {
  it("normalizes score and comparable scored sessions from a performance row", () => {
    const derived = deriveExercisePerformance({
      variant_id: "variant-1",
      variant_name: "Barbell Squat",
      last_performed_at: "2026-04-17T10:45:00.000Z",
      last_performed_days_ago: 2,
      last_performed_first_set_display: "100 kg x 5 reps",
      selected_station_average_score_30d: 1.067,
      variant_session_count_30d: 6.9,
      performance_status: "AVAILABLE",
      performance_tone: "GREEN",
    });

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
});
