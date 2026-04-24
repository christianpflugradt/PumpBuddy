import type {
  WorkoutExercisesPerformanceRow,
  WorkoutExercisesPerformanceStatus,
  WorkoutExercisesPerformanceTone,
} from "./workout-types";

type DerivedComparableSessions = {
  count: number;
  label: string;
  scoredLabel: string;
};

export type DerivedExercisePerformance = {
  score: number | null;
  scoreLabel: string;
  trendStatus: WorkoutExercisesPerformanceStatus;
  trendTone: WorkoutExercisesPerformanceTone;
  comparableScoredSessions: DerivedComparableSessions;
};

const normalizeComparableSessionCount = (sessionCount: number): number =>
  Number.isFinite(sessionCount) ? Math.max(0, Math.floor(sessionCount)) : 0;

const formatComparableSessions = (sessionCount: number): DerivedComparableSessions => {
  const count = normalizeComparableSessionCount(sessionCount);
  if (count === 1) {
    return {
      count,
      label: "1 session",
      scoredLabel: "1 scored session",
    };
  }

  return {
    count,
    label: `${count} sessions`,
    scoredLabel: `${count} scored sessions`,
  };
};

const normalizeScore = (score: number | null): number | null =>
  score !== null && Number.isFinite(score) ? score : null;

export const deriveExercisePerformance = (
  row: WorkoutExercisesPerformanceRow | null,
): DerivedExercisePerformance => {
  if (!row) {
    return {
      score: null,
      scoreLabel: "--",
      trendStatus: "NOT_ENOUGH_DATA",
      trendTone: "GRAY",
      comparableScoredSessions: formatComparableSessions(0),
    };
  }

  const score = normalizeScore(row.selected_station_average_score_30d);
  const comparableScoredSessions = formatComparableSessions(row.variant_session_count_30d);

  return {
    score,
    scoreLabel: score === null ? "--" : score.toFixed(2),
    trendStatus: row.performance_status,
    trendTone: row.performance_tone,
    comparableScoredSessions,
  };
};
