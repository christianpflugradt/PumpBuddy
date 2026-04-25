import type {
  WorkoutExercisesPerformanceRow,
  WorkoutExercisesPerformanceStatus,
  WorkoutExercisesPerformanceTone,
} from "./workout-types";
import { formatLoadDisplayNumber } from "./workout-load-display";

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

export const PERSONAL_RECORDS_COMPACT_ROW_LIMIT = 10;

export type PersonalRecordMetricFamily =
  | "LOAD_X_REPS"
  | "LOAD_X_SECONDS"
  | "REPS_ONLY"
  | "SECONDS_ONLY";

export type DerivedPersonalRecordRow = {
  groupKey: string;
  loadKg: number | null;
  loadLabel: string | null;
  reps: number | null;
  repsLabel: string | null;
  seconds: number | null;
  secondsLabel: string | null;
};

export type DerivedPersonalRecords = {
  metricFamily: PersonalRecordMetricFamily | null;
  rowLimit: number;
  rows: DerivedPersonalRecordRow[];
};

type RawPersonalRecordEntry = {
  loadKg: number | null;
  reps: number | null;
  seconds: number | null;
  occurredAtMs: number;
  sourceIndex: number;
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

const normalizePositiveInteger = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
};

const normalizeNonNegativeNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
};

const normalizeTimestamp = (value: unknown): number => {
  if (typeof value !== "string") {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Number(new Date(value).getTime());
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const resolveMetricFamily = (value: unknown): PersonalRecordMetricFamily | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "load_x_reps" ||
    normalized === "load-x-reps" ||
    normalized === "load_reps" ||
    normalized === "kg_x_reps"
  ) {
    return "LOAD_X_REPS";
  }

  if (
    normalized === "load_x_seconds" ||
    normalized === "load-x-seconds" ||
    normalized === "load_seconds" ||
    normalized === "kg_x_seconds"
  ) {
    return "LOAD_X_SECONDS";
  }

  if (normalized === "reps_only" || normalized === "reps-only" || normalized === "reps") {
    return "REPS_ONLY";
  }

  if (normalized === "seconds_only" || normalized === "seconds-only" || normalized === "seconds") {
    return "SECONDS_ONLY";
  }

  return null;
};

const formatSecondsLabel = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const compareStringAsc = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const tieBreakRecords = (left: RawPersonalRecordEntry, right: RawPersonalRecordEntry): number => {
  if (left.occurredAtMs !== right.occurredAtMs) {
    return right.occurredAtMs - left.occurredAtMs;
  }

  const leftLoadLabel = formatLoadDisplayNumber(left.loadKg) ?? "";
  const rightLoadLabel = formatLoadDisplayNumber(right.loadKg) ?? "";
  const loadLabelCompare = compareStringAsc(leftLoadLabel, rightLoadLabel);
  if (loadLabelCompare !== 0) {
    return loadLabelCompare;
  }

  return left.sourceIndex - right.sourceIndex;
};

const isEntryValidForFamily = (
  entry: RawPersonalRecordEntry,
  metricFamily: PersonalRecordMetricFamily,
): boolean => {
  if (metricFamily === "LOAD_X_REPS") {
    return entry.loadKg !== null && entry.reps !== null;
  }

  if (metricFamily === "LOAD_X_SECONDS") {
    return entry.loadKg !== null && entry.seconds !== null;
  }

  if (metricFamily === "REPS_ONLY") {
    return entry.reps !== null;
  }

  return entry.seconds !== null;
};

const resolveGroupKey = (
  entry: RawPersonalRecordEntry,
  metricFamily: PersonalRecordMetricFamily,
): string | null => {
  if (metricFamily === "LOAD_X_REPS") {
    return entry.reps === null ? null : `reps:${entry.reps}`;
  }

  if (metricFamily === "LOAD_X_SECONDS") {
    return entry.seconds === null ? null : `seconds:${entry.seconds}`;
  }

  if (metricFamily === "REPS_ONLY") {
    return entry.reps === null ? null : `reps:${entry.reps}`;
  }

  return entry.seconds === null ? null : `seconds:${entry.seconds}`;
};

const compareWithinGroup = (
  left: RawPersonalRecordEntry,
  right: RawPersonalRecordEntry,
  metricFamily: PersonalRecordMetricFamily,
): number => {
  if (metricFamily === "LOAD_X_REPS") {
    const leftLoad = left.loadKg ?? 0;
    const rightLoad = right.loadKg ?? 0;
    if (leftLoad !== rightLoad) {
      return rightLoad - leftLoad;
    }
  }

  if (metricFamily === "LOAD_X_SECONDS") {
    const leftLoad = left.loadKg ?? 0;
    const rightLoad = right.loadKg ?? 0;
    if (leftLoad !== rightLoad) {
      return rightLoad - leftLoad;
    }
  }

  if (metricFamily === "REPS_ONLY") {
    const leftReps = left.reps ?? 0;
    const rightReps = right.reps ?? 0;
    if (leftReps !== rightReps) {
      return rightReps - leftReps;
    }
  }

  if (metricFamily === "SECONDS_ONLY") {
    const leftSeconds = left.seconds ?? 0;
    const rightSeconds = right.seconds ?? 0;
    if (leftSeconds !== rightSeconds) {
      return rightSeconds - leftSeconds;
    }
  }

  return tieBreakRecords(left, right);
};

const compareGroupedRows = (
  left: RawPersonalRecordEntry,
  right: RawPersonalRecordEntry,
  metricFamily: PersonalRecordMetricFamily,
): number => {
  if (metricFamily === "LOAD_X_REPS" || metricFamily === "LOAD_X_SECONDS") {
    const leftLoad = left.loadKg ?? 0;
    const rightLoad = right.loadKg ?? 0;
    if (leftLoad !== rightLoad) {
      return rightLoad - leftLoad;
    }
  }

  if (metricFamily === "LOAD_X_REPS" || metricFamily === "REPS_ONLY") {
    const leftReps = left.reps ?? 0;
    const rightReps = right.reps ?? 0;
    if (leftReps !== rightReps) {
      return rightReps - leftReps;
    }
  }

  if (metricFamily === "LOAD_X_SECONDS" || metricFamily === "SECONDS_ONLY") {
    const leftSeconds = left.seconds ?? 0;
    const rightSeconds = right.seconds ?? 0;
    if (leftSeconds !== rightSeconds) {
      return rightSeconds - leftSeconds;
    }
  }

  return tieBreakRecords(left, right);
};

const normalizePersonalRecordEntries = (entries: unknown[]): RawPersonalRecordEntry[] =>
  entries
    .map((entry, sourceIndex): RawPersonalRecordEntry | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const source = entry as {
        load_kg?: unknown;
        loadKg?: unknown;
        reps?: unknown;
        seconds?: unknown;
        duration_seconds?: unknown;
        secs?: unknown;
        occurred_at?: unknown;
        performed_at?: unknown;
        completed_at?: unknown;
      };

      return {
        loadKg: normalizeNonNegativeNumber(source.load_kg ?? source.loadKg ?? null),
        reps: normalizePositiveInteger(source.reps ?? null),
        seconds: normalizePositiveInteger(source.seconds ?? source.duration_seconds ?? source.secs ?? null),
        occurredAtMs: normalizeTimestamp(
          source.occurred_at ?? source.performed_at ?? source.completed_at ?? null,
        ),
        sourceIndex,
      };
    })
    .filter((entry): entry is RawPersonalRecordEntry => entry !== null);

export const derivePersonalRecords = (
  row: WorkoutExercisesPerformanceRow | null,
): DerivedPersonalRecords => {
  const raw = (row ?? {}) as unknown as {
    personal_records_12m?: {
      metric_family?: unknown;
      entries?: unknown[];
      rows?: unknown[];
      records?: unknown[];
    };
    personal_records?: {
      metric_family?: unknown;
      entries?: unknown[];
      rows?: unknown[];
      records?: unknown[];
    };
  };

  const source = raw.personal_records_12m ?? raw.personal_records ?? null;
  const metricFamily = resolveMetricFamily(source?.metric_family);
  const rawEntries = source?.entries ?? source?.rows ?? source?.records ?? [];
  const entries = Array.isArray(rawEntries) ? normalizePersonalRecordEntries(rawEntries) : [];

  if (!metricFamily || entries.length === 0) {
    return {
      metricFamily,
      rowLimit: PERSONAL_RECORDS_COMPACT_ROW_LIMIT,
      rows: [],
    };
  }

  const grouped = new Map<string, RawPersonalRecordEntry>();
  for (const entry of entries) {
    if (!isEntryValidForFamily(entry, metricFamily)) {
      continue;
    }

    const groupKey = resolveGroupKey(entry, metricFamily);
    if (!groupKey) {
      continue;
    }

    const current = grouped.get(groupKey);
    if (!current || compareWithinGroup(entry, current, metricFamily) < 0) {
      grouped.set(groupKey, entry);
    }
  }

  const rows = Array.from(grouped.entries())
    .map(([groupKey, entry]) => ({ groupKey, entry }))
    .sort((left, right) => compareGroupedRows(left.entry, right.entry, metricFamily))
    .slice(0, PERSONAL_RECORDS_COMPACT_ROW_LIMIT)
    .map(({ groupKey, entry }): DerivedPersonalRecordRow => {
      const loadLabelRaw = formatLoadDisplayNumber(entry.loadKg);
      return {
        groupKey,
        loadKg: entry.loadKg,
        loadLabel: loadLabelRaw === null ? null : `${loadLabelRaw} kg`,
        reps: entry.reps,
        repsLabel: entry.reps === null ? null : `${entry.reps} reps`,
        seconds: entry.seconds,
        secondsLabel: entry.seconds === null ? null : formatSecondsLabel(entry.seconds),
      };
    });

  return {
    metricFamily,
    rowLimit: PERSONAL_RECORDS_COMPACT_ROW_LIMIT,
    rows,
  };
};

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
