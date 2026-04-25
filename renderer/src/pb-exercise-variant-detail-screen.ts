import type { WorkoutExercisesPerformanceRow } from "./workout-types";
import {
  deriveExercisePerformance,
  derivePersonalRecords,
  type DerivedPersonalRecords,
  type PersonalRecordMetricFamily,
} from "./exercise-performance-derivation";
import { formatLoadDisplayNumber } from "./workout-load-display";

export const pbExerciseVariantDetailScreenTag = "pb-exercise-variant-detail-screen";

export type ExerciseVariantDetailScreenState = {
  variantId: string;
  row: WorkoutExercisesPerformanceRow | null;
};

type UiAction = "navigate-exercises";
type TrendHeroToneClass = "green" | "yellow" | "red" | "gray";
type ScoreTrendRenderable = {
  scoreToneClass: TrendHeroToneClass;
  yTicks: number[];
  points: Array<{ x: number; y: number; tone: TrendHeroToneClass }>;
  path: string;
};
type StrengthMetricFamily = "kg" | "reps" | "time";
type StrengthStationMode = "primary" | "all";
type StrengthPoint = {
  timestampMs: number;
  value: number;
  stationId: string | null;
  stationLabel: string;
  isPrimaryStation: boolean;
};
type StrengthMetricMode = {
  id: string;
  label: string;
  family: StrengthMetricFamily;
  stationModes: StrengthStationMode[];
  points: StrengthPoint[];
};
type StrengthProgressionData = {
  metricModes: StrengthMetricMode[];
};
type StrengthProgressionRenderable = {
  metricModes: StrengthMetricMode[];
  selectedMetricModeId: string;
  selectedStationMode: StrengthStationMode;
  basisSessionCount: number;
  yTicks: number[];
  yAxisLabel: string;
  segments: Array<{ stationLabel: string; points: Array<{ x: number; y: number }> }>;
  xLabels: Array<{ text: string; x: number }>;
  hasData: boolean;
};
type PersonalRecordsRenderable = {
  columns: string[];
  rows: Array<{ key: string; values: string[] }>;
};
type RecentSessionStationMode = "primary" | "all";
type RecentSessionRenderableRow = {
  occurredAtLabel: string;
  primaryValue: string;
  stationNote: string | null;
};
type RecentSessionsRenderable = {
  stationMode: RecentSessionStationMode;
  rows: RecentSessionRenderableRow[];
};

const formatSessionCountLabel = (count: number): string => (count === 1 ? "1 session" : `${count} sessions`);

const trendHeroCopy: Record<TrendHeroToneClass, { title: string; subtitle: string }> = {
  green: {
    title: "Improving",
    subtitle: "Recent comparable sessions are trending above your baseline.",
  },
  yellow: {
    title: "Stable",
    subtitle: "Recent comparable sessions are holding near your baseline.",
  },
  red: {
    title: "Lighter Phase",
    subtitle: "Recent comparable sessions are trending below your baseline.",
  },
  gray: {
    title: "Not enough data",
    subtitle: "We need at least 3 scored sessions in the last 30 days.",
  },
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const resolveTrendHeroToneClass = (tone: WorkoutExercisesPerformanceRow["performance_tone"]): TrendHeroToneClass => {
  if (tone === "GREEN") {
    return "green";
  }

  if (tone === "YELLOW") {
    return "yellow";
  }

  if (tone === "RED") {
    return "red";
  }

  return "gray";
};

const SCORE_TREND_AXIS_MIN = 0.7;
const SCORE_TREND_AXIS_MAX = 1.2;
const SCORE_TREND_MIN_COMPARABLE_SESSIONS = 3;
const SCORE_TREND_Y_TICKS = [SCORE_TREND_AXIS_MAX, 0.95, SCORE_TREND_AXIS_MIN];
const STRENGTH_PRIMARY_STATION_ID = "__primary__";
const STRENGTH_PRIMARY_STATION_LABEL = "Primary station";
const RECENT_SESSIONS_MAX_ENTRIES = 6;

const renderScoreTrend = (
  row: WorkoutExercisesPerformanceRow | null,
  trendToneClass: TrendHeroToneClass,
): ScoreTrendRenderable | null => {
  if (!row || row.performance_status !== "AVAILABLE") {
    return null;
  }

  const comparableSessionCount = Number.isFinite(row.variant_session_count_30d)
    ? Math.max(0, Math.floor(row.variant_session_count_30d))
    : 0;
  const sourceEntries = row.score_trend_30d?.entries ?? [];
  const entries = sourceEntries
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      if (typeof entry.occurred_at !== "string") {
        return null;
      }
      const timestampMs = Number(new Date(entry.occurred_at).getTime());
      if (!Number.isFinite(timestampMs)) {
        return null;
      }
      if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
        return null;
      }
      return {
        timestampMs,
        score: Math.min(SCORE_TREND_AXIS_MAX, Math.max(SCORE_TREND_AXIS_MIN, entry.score)),
      };
    })
    .filter((entry): entry is { timestampMs: number; score: number } => entry !== null)
    .sort((left, right) => left.timestampMs - right.timestampMs);
  if (comparableSessionCount < SCORE_TREND_MIN_COMPARABLE_SESSIONS || entries.length < SCORE_TREND_MIN_COMPARABLE_SESSIONS) {
    return null;
  }

  const width = 640;
  const height = 220;
  const padTop = 14;
  const padRight = 12;
  const padBottom = 18;
  const padLeft = 34;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const points = entries.map((entry, index) => {
    const y =
      padTop +
      innerHeight -
      ((entry.score - SCORE_TREND_AXIS_MIN) / (SCORE_TREND_AXIS_MAX - SCORE_TREND_AXIS_MIN)) * innerHeight;
    const tone: TrendHeroToneClass =
      entry.score < 0.95 ? "red" : entry.score <= 1.03 ? "yellow" : "green";
    return {
      x:
        entries.length === 1
          ? padLeft + innerWidth / 2
          : padLeft + (innerWidth * index) / (entries.length - 1),
      y,
      tone,
    };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return {
    scoreToneClass: trendToneClass,
    yTicks: SCORE_TREND_Y_TICKS,
    points,
    path,
  };
};

const countValidScoreTrendEntries = (row: WorkoutExercisesPerformanceRow | null): number => {
  if (!row) {
    return 0;
  }

  return (row.score_trend_30d?.entries ?? [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      if (typeof entry.occurred_at !== "string") {
        return null;
      }
      const timestampMs = Number(new Date(entry.occurred_at).getTime());
      if (!Number.isFinite(timestampMs)) {
        return null;
      }
      if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
        return null;
      }
      return entry;
    })
    .filter((entry) => entry !== null).length;
};

const renderScoreTrendSection = (
  trend: ScoreTrendRenderable | null,
): string => {
  if (!trend) {
    return `
      <section class="progress-card progress-card--trend exercise-variant-score-trend-card exercise-variant-score-trend-card--gray" aria-label="Score trend for last 30 days">
        <h3 class="exercise-variant-score-trend-title">Performance Trend</h3>
        <p class="exercise-variant-score-trend-subtitle">Last 30 days</p>
        <p class="progress-empty-copy exercise-variant-score-trend-empty">Not enough sessions for a trend.</p>
      </section>
    `;
  }

  const width = 640;
  const height = 220;
  const padTop = 14;
  const padRight = 12;
  const padBottom = 18;
  const padLeft = 34;
  const innerHeight = height - padTop - padBottom;
  const tickTextOffset = 8;

  return `
    <section class="progress-card progress-card--trend exercise-variant-score-trend-card exercise-variant-score-trend-card--${trend.scoreToneClass}" aria-label="Score trend for last 30 days">
      <h3 class="exercise-variant-score-trend-title">Performance Trend</h3>
      <p class="exercise-variant-score-trend-subtitle">Last 30 days</p>
      <svg class="progress-trend-svg progress-trend-svg--${trend.scoreToneClass} exercise-variant-score-trend-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
        ${trend.yTicks
          .map((value) => {
            const y =
              padTop +
              innerHeight -
              ((value - SCORE_TREND_AXIS_MIN) / (SCORE_TREND_AXIS_MAX - SCORE_TREND_AXIS_MIN)) * innerHeight;
            return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="progress-trend-grid"></line><text x="${tickTextOffset}" y="${y}" class="progress-trend-axis-label" dominant-baseline="central">${value.toFixed(2)}</text>`;
          })
          .join("")}
        <path d="${trend.path}" class="progress-trend-line"></path>
        ${trend.points
          .map((point) => {
            return `<circle cx="${point.x}" cy="${point.y}" r="5.5" class="progress-trend-dot progress-trend-dot--${point.tone}"></circle>`;
          })
          .join("")}
      </svg>
    </section>
  `;
};

const clampToLast12Months = (timestampMs: number, nowMs: number): boolean =>
  timestampMs >= nowMs - 365 * 24 * 60 * 60 * 1000 && timestampMs <= nowMs + 24 * 60 * 60 * 1000;

const normalizeStrengthProgressionData = (
  row: WorkoutExercisesPerformanceRow | null,
): StrengthProgressionData => {
  const raw = (row ?? {}) as unknown as {
    strength_progression_12m?: {
      metric_modes?: Array<{
        id?: string;
        label?: string;
        family?: string;
        station_modes?: string[];
        points?: Array<{
          occurred_at?: string;
          value?: number;
          station_id?: string | null;
          station_label?: string | null;
          is_primary_station?: boolean;
        }>;
      }>;
    };
  };
  const nowMs = Date.now();
  const sourceModes = raw.strength_progression_12m?.metric_modes ?? [];
  const metricModes: StrengthMetricMode[] = sourceModes
    .map((mode, modeIndex): StrengthMetricMode | null => {
      const family =
        mode.family === "kg" || mode.family === "reps" || mode.family === "time" ? mode.family : null;
      if (!family) {
        return null;
      }

      const stationModes = Array.from(
        new Set(
          (mode.station_modes ?? [])
            .map((value) => (value === "all" ? "all" : value === "primary" ? "primary" : null))
            .filter((value): value is StrengthStationMode => value !== null),
        ),
      );
      const normalizedStationModes: StrengthStationMode[] =
        stationModes.length === 0 ? ["primary", "all"] : stationModes;

      const points: StrengthPoint[] = (mode.points ?? [])
        .map((point): StrengthPoint | null => {
          const timestampMs =
            typeof point.occurred_at === "string" ? Number(new Date(point.occurred_at).getTime()) : Number.NaN;
          if (!Number.isFinite(timestampMs) || !clampToLast12Months(timestampMs, nowMs)) {
            return null;
          }

          if (typeof point.value !== "number" || !Number.isFinite(point.value)) {
            return null;
          }

          const stationId = point.station_id && point.station_id.trim().length > 0 ? point.station_id : null;
          const stationLabel =
            point.station_label && point.station_label.trim().length > 0
              ? point.station_label
              : stationId === null
                ? STRENGTH_PRIMARY_STATION_LABEL
                : "Station";

          return {
            timestampMs,
            value: point.value,
            stationId,
            stationLabel,
            isPrimaryStation: point.is_primary_station === true,
          };
        })
        .filter((point): point is StrengthPoint => point !== null)
        .sort((left, right) => left.timestampMs - right.timestampMs);

      return {
        id: mode.id && mode.id.length > 0 ? mode.id : `${family}-${modeIndex + 1}`,
        label: mode.label && mode.label.length > 0 ? mode.label : family === "kg" ? "Load" : family === "reps" ? "Reps" : "Time",
        family,
        stationModes: normalizedStationModes,
        points,
      };
    })
    .filter((mode): mode is StrengthMetricMode => mode !== null);

  if (metricModes.length > 0) {
    return { metricModes };
  }

  return { metricModes: [] };
};

const formatStrengthValue = (value: number, family: StrengthMetricFamily): string => {
  if (family === "kg") {
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} kg`;
  }

  if (family === "reps") {
    return `${Math.round(value)} reps`;
  }

  const wholeSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatStrengthDateLabel = (timestampMs: number): string =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(timestampMs);

const resolveTickStepCandidates = (family: StrengthMetricFamily): number[] => {
  if (family === "kg") {
    return [2.5, 5, 10, 20, 25, 50];
  }
  if (family === "reps") {
    return [1, 2, 3, 5, 10, 15];
  }
  return [15, 30, 60, 120, 300, 600];
};

const resolveYAxisTicks = (
  values: number[],
  family: StrengthMetricFamily,
): { ticks: number[]; axisMin: number; axisMax: number } => {
  const candidates = resolveTickStepCandidates(family);
  if (values.length === 0) {
    const step = candidates[0]!;
    return {
      ticks: [0, step, step * 2],
      axisMin: 0,
      axisMax: step * 2,
    };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (Math.abs(max - min) < Number.EPSILON) {
    const step = candidates[0]!;
    min = min - step;
    max = max + step;
  }

  for (const step of candidates) {
    const axisMin = Math.floor(min / step) * step;
    const axisMax = Math.ceil(max / step) * step;
    const count = Math.round((axisMax - axisMin) / step) + 1;
    if (count >= 2 && count <= 5) {
      return {
        ticks: Array.from({ length: count }, (_, index) => axisMin + index * step),
        axisMin,
        axisMax,
      };
    }
  }

  const first = min;
  const middle = min + (max - min) / 2;
  const last = max;
  return { ticks: [first, middle, last], axisMin: first, axisMax: last };
};

const renderStrengthProgression = (
  data: StrengthProgressionData,
  selectedMetricModeId: string | null,
  selectedStationMode: StrengthStationMode,
): StrengthProgressionRenderable => {
  const metricModes = data.metricModes;
  const fallbackMode = metricModes[0] ?? null;
  const selectedMode =
    metricModes.find((mode) => mode.id === selectedMetricModeId) ??
    fallbackMode;
  if (!selectedMode) {
    return {
      metricModes: [],
      selectedMetricModeId: "",
      selectedStationMode: "primary",
      basisSessionCount: 0,
      yTicks: [],
      yAxisLabel: "",
      segments: [],
      xLabels: [],
      hasData: false,
    };
  }

  const resolvedStationMode = selectedMode.stationModes.includes(selectedStationMode)
    ? selectedStationMode
    : selectedMode.stationModes[0]!;
  const width = 640;
  const height = 244;
  const padTop = 14;
  const padRight = 12;
  const padBottom = 42;
  const padLeft = 76;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const points =
    resolvedStationMode === "primary"
      ? selectedMode.points.filter((point) => point.isPrimaryStation)
      : selectedMode.points;
  const pointsForStation = points;
  const basisSessionCount = pointsForStation.length;
  const hasData = pointsForStation.length > 0;
  const allTimestamps = pointsForStation.map((point) => point.timestampMs);
  const minTimestamp = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now() - 365 * 24 * 60 * 60 * 1000;
  const maxTimestamp = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now();
  const [domainStart, domainEnd] =
    Math.abs(maxTimestamp - minTimestamp) < 1000
      ? [minTimestamp - 24 * 60 * 60 * 1000, maxTimestamp + 24 * 60 * 60 * 1000]
      : [minTimestamp, maxTimestamp];
  const yValues = pointsForStation.map((point) => point.value);
  const yAxis = resolveYAxisTicks(yValues, selectedMode.family);
  const yRange = Math.max(1e-9, yAxis.axisMax - yAxis.axisMin);
  const xRange = Math.max(1, domainEnd - domainStart);

  const pointToSvg = (point: StrengthPoint): { x: number; y: number } => ({
    x: padLeft + ((point.timestampMs - domainStart) / xRange) * innerWidth,
    y: padTop + innerHeight - ((point.value - yAxis.axisMin) / yRange) * innerHeight,
  });

  const byStation = new Map<string, { stationLabel: string; points: StrengthPoint[] }>();
  for (const point of pointsForStation) {
    const stationKey = point.stationId ?? STRENGTH_PRIMARY_STATION_ID;
    if (!byStation.has(stationKey)) {
      byStation.set(stationKey, { stationLabel: point.stationLabel, points: [] });
    }
    byStation.get(stationKey)!.points.push(point);
  }

  const segments = Array.from(byStation.values())
    .map((station) => ({
      stationLabel: station.stationLabel,
      points: station.points.sort((left, right) => left.timestampMs - right.timestampMs).map(pointToSvg),
    }))
    .filter((segment) => segment.points.length > 0);

  const sortedUniqueTimestamps = Array.from(new Set(allTimestamps)).sort((left, right) => left - right);
  const desiredXLabelCount = Math.min(4, Math.max(2, sortedUniqueTimestamps.length));
  const xLabelIndexes = Array.from({ length: desiredXLabelCount }, (_, index) =>
    desiredXLabelCount === 1
      ? 0
      : Math.round((index * (sortedUniqueTimestamps.length - 1)) / (desiredXLabelCount - 1)),
  );
  const xLabels = Array.from(new Set(xLabelIndexes))
    .map((index) => sortedUniqueTimestamps[index] ?? sortedUniqueTimestamps[0] ?? Date.now())
    .map((timestampMs) => ({
      text: formatStrengthDateLabel(timestampMs),
      x: padLeft + ((timestampMs - domainStart) / xRange) * innerWidth,
    }));

  return {
    metricModes,
    selectedMetricModeId: selectedMode.id,
    selectedStationMode: resolvedStationMode,
    basisSessionCount,
    yTicks: yAxis.ticks,
    yAxisLabel: selectedMode.family === "kg" ? "Load (kg)" : selectedMode.family === "reps" ? "Reps" : "Time",
    segments,
    xLabels,
    hasData,
  };
};

const renderDataBasisSection = (
  derived: ReturnType<typeof deriveExercisePerformance>,
  strengthProgression: StrengthProgressionRenderable,
): string => {
  const stationScopeLabel =
    strengthProgression.selectedStationMode === "all" ? "All stations" : "Primary station";

  return `
    <section class="exercise-variant-data-basis" aria-label="Data basis and comparison context">
      <h3 class="exercise-variant-data-basis-title">Session Basis</h3>
      <ul class="exercise-variant-data-basis-list">
        <li class="exercise-variant-data-basis-item">
          <span class="exercise-variant-data-basis-label">Performance trend basis</span>
          <span class="exercise-variant-data-basis-value">Selected station, ${escapeHtml(derived.comparableScoredSessions.scoredLabel)} (30d).</span>
        </li>
        <li class="exercise-variant-data-basis-item">
          <span class="exercise-variant-data-basis-label">Strength progression basis</span>
          <span class="exercise-variant-data-basis-value">${escapeHtml(stationScopeLabel)}, ${escapeHtml(formatSessionCountLabel(strengthProgression.basisSessionCount))} (12m).</span>
        </li>
      </ul>
      <p class="exercise-variant-data-basis-context">Performance trend and strength progression use different session bases.</p>
    </section>
  `;
};

const renderStrengthProgressionSection = (chart: StrengthProgressionRenderable): string => {
  if (chart.metricModes.length === 0) {
    return `
      <section class="progress-card progress-card--trend exercise-variant-strength-card exercise-variant-strength-card--gray" aria-label="Strength progression for last 12 months">
        <h3 class="exercise-variant-strength-title">Strength Progression</h3>
        <p class="exercise-variant-strength-subtitle">Last 12 months</p>
        <p class="progress-empty-copy exercise-variant-strength-empty">Not enough strength data yet.</p>
      </section>
    `;
  }

  const width = 640;
  const height = 244;
  const padTop = 14;
  const padRight = 12;
  const padBottom = 42;
  const padLeft = 76;
  const innerHeight = height - padTop - padBottom;
  const yAxisMin = chart.yTicks[0] ?? 0;
  const yAxisMax = chart.yTicks[chart.yTicks.length - 1] ?? 1;
  const yAxisRange = Math.max(1e-9, yAxisMax - yAxisMin);
  const stationModeOptions: StrengthStationMode[] = ["primary", "all"];
  const selectedMode = chart.metricModes.find((mode) => mode.id === chart.selectedMetricModeId) ?? chart.metricModes[0]!;

  return `
    <section class="progress-card progress-card--trend exercise-variant-strength-card" aria-label="Strength progression for last 12 months">
      <h3 class="exercise-variant-strength-title">Strength Progression</h3>
      <p class="exercise-variant-strength-subtitle">Last 12 months</p>
      <div class="exercise-variant-strength-controls">
        <label class="exercise-variant-strength-control">
          <span class="exercise-variant-strength-control-label">Metric</span>
          <select data-strength-control="metric-mode" class="exercise-variant-strength-select" aria-label="Strength metric mode">
            ${chart.metricModes
              .map((mode) => `<option value="${escapeHtml(mode.id)}"${mode.id === chart.selectedMetricModeId ? " selected" : ""}>${escapeHtml(mode.label)}</option>`)
              .join("")}
          </select>
        </label>
        <div class="exercise-variant-strength-station-toggle" role="group" aria-label="Strength station mode">
          ${stationModeOptions
            .map((mode) => {
              const selected = chart.selectedStationMode === mode;
              const allowed = selectedMode.stationModes.includes(mode);
              const label = mode === "primary" ? "Primary station" : "All stations";
              return `<button type="button" class="exercise-variant-strength-station-button${selected ? " is-selected" : ""}" data-strength-control="station-mode" data-strength-station-mode="${mode}"${allowed ? "" : " disabled"}>${label}</button>`;
            })
            .join("")}
        </div>
      </div>
      ${
        !chart.hasData
          ? '<p class="progress-empty-copy exercise-variant-strength-empty">Not enough strength data for this mode.</p>'
          : `
            <svg class="progress-trend-svg exercise-variant-strength-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
              ${chart.yTicks
                .map((value) => {
                  const y = padTop + innerHeight - ((value - yAxisMin) / yAxisRange) * innerHeight;
                  return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="progress-trend-grid"></line><text x="8" y="${y}" class="progress-trend-axis-label exercise-variant-strength-axis-label" dominant-baseline="central">${escapeHtml(formatStrengthValue(value, selectedMode.family))}</text>`;
                })
                .join("")}
              <text x="8" y="${padTop - 2}" class="progress-trend-axis-label exercise-variant-strength-y-axis-title">${escapeHtml(chart.yAxisLabel)}</text>
              ${chart.segments
                .map((segment, segmentIndex) => {
                  const path = segment.points
                    .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
                    .join(" ");
                  const dots = segment.points
                    .map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4.5" class="progress-trend-dot exercise-variant-strength-dot exercise-variant-strength-dot--${segmentIndex % 4}"></circle>`)
                    .join("");
                  return `<path d="${path}" class="progress-trend-line exercise-variant-strength-line exercise-variant-strength-line--${segmentIndex % 4}"></path>${dots}`;
                })
                .join("")}
              ${chart.xLabels
                .map((label) => `<text x="${label.x.toFixed(1)}" y="${height - 10}" text-anchor="middle" class="progress-trend-axis-label exercise-variant-strength-x-axis-label">${escapeHtml(label.text)}</text>`)
                .join("")}
            </svg>
            ${
              chart.selectedStationMode === "all" && chart.segments.length > 1
                ? `<ul class="exercise-variant-strength-legend">${chart.segments
                    .map((segment, segmentIndex) => `<li class="exercise-variant-strength-legend-item"><span class="exercise-variant-strength-legend-swatch exercise-variant-strength-legend-swatch--${segmentIndex % 4}" aria-hidden="true"></span>${escapeHtml(segment.stationLabel)}</li>`)
                    .join("")}</ul>`
                : ""
            }
          `
      }
    </section>
  `;
};

const resolvePersonalRecordColumns = (metricFamily: PersonalRecordMetricFamily | null): string[] => {
  if (metricFamily === "LOAD_X_REPS") {
    return ["Load", "Reps"];
  }

  if (metricFamily === "LOAD_X_SECONDS") {
    return ["Load", "Duration"];
  }

  if (metricFamily === "REPS_ONLY") {
    return ["Reps"];
  }

  if (metricFamily === "SECONDS_ONLY") {
    return ["Duration"];
  }

  return ["Value"];
};

const toPersonalRecordsRenderable = (records: DerivedPersonalRecords): PersonalRecordsRenderable => {
  const columns = resolvePersonalRecordColumns(records.metricFamily);
  const rows = records.rows.map((row) => {
    if (records.metricFamily === "LOAD_X_REPS") {
      return {
        key: row.groupKey,
        values: [row.loadLabel ?? "--", row.repsLabel ?? "--"],
      };
    }

    if (records.metricFamily === "LOAD_X_SECONDS") {
      return {
        key: row.groupKey,
        values: [row.loadLabel ?? "--", row.secondsLabel ?? "--"],
      };
    }

    if (records.metricFamily === "REPS_ONLY") {
      return {
        key: row.groupKey,
        values: [row.repsLabel ?? "--"],
      };
    }

    return {
      key: row.groupKey,
      values: [row.secondsLabel ?? "--"],
    };
  });

  return {
    columns,
    rows,
  };
};

const renderPersonalRecordsSection = (records: DerivedPersonalRecords): string => {
  const view = toPersonalRecordsRenderable(records);
  if (view.rows.length === 0) {
    return `
      <section class="progress-card progress-card--trend exercise-variant-records-card exercise-variant-records-card--empty" aria-label="Personal records for last 12 months">
        <h3 class="exercise-variant-records-title">Personal Records</h3>
        <p class="exercise-variant-records-subtitle">Last 12 months</p>
        <p class="progress-empty-copy exercise-variant-records-empty">No personal records yet.</p>
      </section>
    `;
  }

  return `
    <section class="progress-card progress-card--trend exercise-variant-records-card" aria-label="Personal records for last 12 months">
      <h3 class="exercise-variant-records-title">Personal Records</h3>
      <p class="exercise-variant-records-subtitle">Last 12 months</p>
      <div class="exercise-variant-records-table" role="table" aria-label="Personal records table" style="--exercise-variant-record-columns:${view.columns.length};">
        <div class="exercise-variant-records-row exercise-variant-records-row--head" role="row">
          ${view.columns
            .map((column) => `<span class="exercise-variant-records-cell exercise-variant-records-cell--head" role="columnheader">${escapeHtml(column)}</span>`)
            .join("")}
        </div>
        <div class="exercise-variant-records-body" role="rowgroup">
          ${view.rows
            .map(
              (row) => `
                <div class="exercise-variant-records-row" role="row" data-record-key="${escapeHtml(row.key)}">
                  ${row.values
                    .map((value) => `<span class="exercise-variant-records-cell" role="cell">${escapeHtml(value)}</span>`)
                    .join("")}
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
};

const resolveRecentSessionStationMode = (value: unknown): RecentSessionStationMode =>
  value === "all" ? "all" : "primary";

const formatRecentSessionDateLabel = (timestampMs: number): string =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(timestampMs);

const normalizePositiveInteger = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);
  return normalized > 0 ? normalized : null;
};

const formatRecentSessionPrimaryValue = (entry: {
  primary_value_display?: unknown;
  load_kg?: unknown;
  reps?: unknown;
  seconds?: unknown;
}): string | null => {
  if (typeof entry.primary_value_display === "string" && entry.primary_value_display.trim().length > 0) {
    return entry.primary_value_display.trim();
  }

  const loadKg = typeof entry.load_kg === "number" && Number.isFinite(entry.load_kg) && entry.load_kg >= 0
    ? entry.load_kg
    : null;
  const reps = normalizePositiveInteger(entry.reps);
  const seconds = normalizePositiveInteger(entry.seconds);
  const loadLabel = loadKg === null ? null : formatLoadDisplayNumber(loadKg);

  if (loadLabel !== null && reps !== null) {
    return `${loadLabel} kg x ${reps} reps`;
  }

  if (loadLabel !== null && seconds !== null) {
    return `${loadLabel} kg x ${formatStrengthValue(seconds, "time")}`;
  }

  if (reps !== null) {
    return `${reps} reps`;
  }

  if (seconds !== null) {
    return formatStrengthValue(seconds, "time");
  }

  return null;
};

const normalizeRecentSessions = (
  row: WorkoutExercisesPerformanceRow | null,
): RecentSessionsRenderable => {
  const raw = (row ?? {}) as unknown as {
    recent_sessions?: {
      station_mode?: unknown;
      entries?: unknown[];
      sessions?: unknown[];
      rows?: unknown[];
    };
    recent_sessions_30d?: {
      station_mode?: unknown;
      entries?: unknown[];
      sessions?: unknown[];
      rows?: unknown[];
    };
  };

  const source = raw.recent_sessions ?? raw.recent_sessions_30d ?? null;
  const stationMode = resolveRecentSessionStationMode(source?.station_mode);
  const sourceEntries = source?.entries ?? source?.sessions ?? source?.rows ?? [];
  const entries = Array.isArray(sourceEntries) ? sourceEntries : [];
  const rows = entries
    .map((entry, sourceIndex): (RecentSessionRenderableRow & { timestampMs: number; sourceIndex: number }) | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const sourceEntry = entry as {
        occurred_at?: unknown;
        performed_at?: unknown;
        completed_at?: unknown;
        station_note?: unknown;
        note?: unknown;
        station_label?: unknown;
        is_primary_station?: unknown;
        primary_value_display?: unknown;
        load_kg?: unknown;
        reps?: unknown;
        seconds?: unknown;
      };
      const rawTimestamp = sourceEntry.occurred_at ?? sourceEntry.performed_at ?? sourceEntry.completed_at ?? null;
      const timestampMs = typeof rawTimestamp === "string" ? Number(new Date(rawTimestamp).getTime()) : Number.NaN;
      if (!Number.isFinite(timestampMs)) {
        return null;
      }

      const primaryValue = formatRecentSessionPrimaryValue(sourceEntry);
      if (!primaryValue) {
        return null;
      }

      const stationNoteText =
        typeof sourceEntry.station_note === "string" && sourceEntry.station_note.trim().length > 0
          ? sourceEntry.station_note.trim()
          : typeof sourceEntry.note === "string" && sourceEntry.note.trim().length > 0
            ? sourceEntry.note.trim()
            : null;
      const stationLabel =
        typeof sourceEntry.station_label === "string" && sourceEntry.station_label.trim().length > 0
          ? sourceEntry.station_label.trim()
          : null;
      const includeStationNote =
        stationMode === "all" &&
        (stationNoteText !== null || (stationLabel !== null && sourceEntry.is_primary_station === false));
      const stationNote =
        includeStationNote && stationNoteText !== null
          ? stationNoteText
          : includeStationNote && stationLabel !== null
            ? `Station: ${stationLabel}`
            : null;

      return {
        timestampMs,
        sourceIndex,
        occurredAtLabel: formatRecentSessionDateLabel(timestampMs),
        primaryValue,
        stationNote,
      };
    })
    .filter((entry): entry is RecentSessionRenderableRow & { timestampMs: number; sourceIndex: number } => entry !== null)
    .sort((left, right) => {
      if (left.timestampMs !== right.timestampMs) {
        return right.timestampMs - left.timestampMs;
      }

      return left.sourceIndex - right.sourceIndex;
    })
    .slice(0, RECENT_SESSIONS_MAX_ENTRIES)
    .map((entry) => ({
      occurredAtLabel: entry.occurredAtLabel,
      primaryValue: entry.primaryValue,
      stationNote: entry.stationNote,
    }));

  return {
    stationMode,
    rows,
  };
};

const renderRecentSessionsSection = (recent: RecentSessionsRenderable): string => {
  if (recent.rows.length === 0) {
    return `
      <section class="progress-card progress-card--trend exercise-variant-recent-card exercise-variant-recent-card--empty" aria-label="Recent sessions for this variant">
        <h3 class="exercise-variant-recent-title">Recent Sessions</h3>
        <p class="exercise-variant-recent-subtitle">Latest ${RECENT_SESSIONS_MAX_ENTRIES} sessions</p>
        <p class="progress-empty-copy exercise-variant-recent-empty">No recent sessions yet.</p>
      </section>
    `;
  }

  return `
    <section class="progress-card progress-card--trend exercise-variant-recent-card" aria-label="Recent sessions for this variant">
      <h3 class="exercise-variant-recent-title">Recent Sessions</h3>
      <p class="exercise-variant-recent-subtitle">Latest ${RECENT_SESSIONS_MAX_ENTRIES} sessions</p>
      <ul class="exercise-variant-recent-list">
        ${recent.rows
          .map(
            (session) => `
              <li class="exercise-variant-recent-item">
                <div class="exercise-variant-recent-row">
                  <span class="exercise-variant-recent-date">${escapeHtml(session.occurredAtLabel)}</span>
                  <span class="exercise-variant-recent-value">${escapeHtml(session.primaryValue)}</span>
                </div>
                ${session.stationNote ? `<p class="exercise-variant-recent-note">${escapeHtml(session.stationNote)}</p>` : ""}
              </li>
            `,
          )
          .join("")}
      </ul>
    </section>
  `;
};

const resolveExerciseAndVariantTitle = (
  exerciseName: string | null | undefined,
  variantName: string,
): { exerciseTitle: string; variantSubtitle: string } => {
  const normalizedExerciseName = (exerciseName ?? "").trim();
  if (normalizedExerciseName.length > 0) {
    return {
      exerciseTitle: normalizedExerciseName,
      variantSubtitle: variantName.trim().length > 0 ? variantName.trim() : normalizedExerciseName,
    };
  }

  const normalized = variantName.trim();
  if (normalized.length === 0) {
    return {
      exerciseTitle: "Exercise Variant",
      variantSubtitle: "Variant context unavailable",
    };
  }

  const segmentedMatch = normalized.match(/^(.+?)\s+(?:-|–|—)\s+(.+)$/);
  if (segmentedMatch) {
    return {
      exerciseTitle: segmentedMatch[1]!.trim(),
      variantSubtitle: segmentedMatch[2]!.trim(),
    };
  }

  const parentheticalMatch = normalized.match(/^(.+?)\s+\((.+)\)$/);
  if (parentheticalMatch) {
    return {
      exerciseTitle: parentheticalMatch[1]!.trim(),
      variantSubtitle: parentheticalMatch[2]!.trim(),
    };
  }

  return {
    exerciseTitle: normalized,
    variantSubtitle: normalized,
  };
};

const renderTrendHeroIcon = (toneClass: TrendHeroToneClass): string => {
  if (toneClass === "gray") {
    return `
      <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M22 49 C30 40, 38 40, 46 49 S62 58, 69 49" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
      </svg>
    `;
  }

  if (toneClass === "red") {
    return `
      <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M26 32 C40 32, 50 40, 60 52" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
        <path d="M48 53 L61 53 L61 40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  if (toneClass === "yellow") {
    return `
      <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M26 44 L60 44" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
        <path d="M49 34 L61 44 L49 54" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
      <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
      <path d="M26 58 C40 58, 50 48, 60 37" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
      <path d="M48 34 L61 34 L61 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
};

class PbExerciseVariantDetailScreenElement extends HTMLElement {
  #state: ExerciseVariantDetailScreenState = {
    variantId: "",
    row: null,
  };
  #selectedStrengthMetricModeId: string | null = null;
  #selectedStrengthStationMode: StrengthStationMode = "primary";

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
  }

  set state(value: ExerciseVariantDetailScreenState) {
    const variantChanged = this.#state.variantId !== value.variantId;
    this.#state = value;
    if (variantChanged) {
      this.#selectedStrengthMetricModeId = null;
      this.#selectedStrengthStationMode = "primary";
    }
    this.#render();
  }

  get state(): ExerciseVariantDetailScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action },
      }),
    );
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const stationModeElement = target.closest<HTMLElement>('[data-strength-control="station-mode"]');
    if (stationModeElement && this.contains(stationModeElement)) {
      const stationMode = stationModeElement.dataset.strengthStationMode;
      if (stationMode === "primary" || stationMode === "all") {
        this.#selectedStrengthStationMode = stationMode;
        this.#render();
      }
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) {
      return;
    }

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    this.#emitUiAction(action);
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    if (target.dataset.strengthControl !== "metric-mode") {
      return;
    }

    this.#selectedStrengthMetricModeId = target.value;
    this.#selectedStrengthStationMode = "primary";
    this.#render();
  };

  #render(): void {
    const row = this.#state.row;
    const derived = deriveExercisePerformance(row);
    const header = resolveExerciseAndVariantTitle(row?.exercise_name, row?.variant_name ?? "");
    const comparableScoredSessionsCount = derived.comparableScoredSessions.count;
    const validTrendEntriesCount = countValidScoreTrendEntries(row);
    const hasSufficientComparableData =
      comparableScoredSessionsCount >= SCORE_TREND_MIN_COMPARABLE_SESSIONS &&
      validTrendEntriesCount >= SCORE_TREND_MIN_COMPARABLE_SESSIONS;
    const toneClass =
      row && derived.trendStatus === "AVAILABLE" && hasSufficientComparableData
        ? resolveTrendHeroToneClass(derived.trendTone)
        : "gray";
    const heroCopy = trendHeroCopy[toneClass];
    const scoreTrend = renderScoreTrend(row, toneClass);
    const strengthData = normalizeStrengthProgressionData(row);
    const personalRecords = derivePersonalRecords(row);
    const recentSessions = normalizeRecentSessions(row);
    const strengthProgression = renderStrengthProgression(
      strengthData,
      this.#selectedStrengthMetricModeId,
      this.#selectedStrengthStationMode,
    );
    if (
      this.#selectedStrengthMetricModeId !== strengthProgression.selectedMetricModeId ||
      this.#selectedStrengthStationMode !== strengthProgression.selectedStationMode
    ) {
      this.#selectedStrengthMetricModeId = strengthProgression.selectedMetricModeId || null;
      this.#selectedStrengthStationMode = strengthProgression.selectedStationMode;
    }

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-exercises"
          aria-label="Back to exercises"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section class="screen-panel start-screen workout-detail-screen exercise-variant-detail-screen" aria-label="Exercise variant detail screen">
          <header class="exercise-variant-detail-header">
            <h2 class="exercise-variant-detail-header-title">${escapeHtml(header.exerciseTitle)}</h2>
            <p class="exercise-variant-detail-header-subtitle">${escapeHtml(header.variantSubtitle)}</p>
          </header>
          <section class="progress-hero exercise-variant-trend-hero exercise-variant-trend-hero--${toneClass}" aria-label="Trend hero">
            <div class="progress-hero-icon" aria-hidden="true">${renderTrendHeroIcon(toneClass)}</div>
            <div class="progress-hero-copy">
              <p class="exercise-variant-trend-hero-kicker">Performance Trend</p>
              <h3 class="progress-hero-title">${escapeHtml(heroCopy.title)}</h3>
              <p class="progress-hero-subtitle">${escapeHtml(heroCopy.subtitle)}</p>
              <p class="exercise-variant-trend-hero-score">30d score: ${escapeHtml(derived.scoreLabel)}</p>
              <p class="exercise-variant-trend-hero-basis">Based on ${escapeHtml(
                derived.comparableScoredSessions.scoredLabel,
              )}</p>
            </div>
          </section>
          ${
            !row
              ? '<p class="start-copy" role="status" aria-live="polite">Variant context unavailable.</p>'
              : ""
          }
          ${renderScoreTrendSection(scoreTrend)}
          ${renderStrengthProgressionSection(strengthProgression)}
          ${renderPersonalRecordsSection(personalRecords)}
          ${renderRecentSessionsSection(recentSessions)}
          ${renderDataBasisSection(derived, strengthProgression)}
        </section>
      </div>
    `;
  }
}

export const registerPbExerciseVariantDetailScreen = (): void => {
  if (!customElements.get(pbExerciseVariantDetailScreenTag)) {
    customElements.define(pbExerciseVariantDetailScreenTag, PbExerciseVariantDetailScreenElement);
  }
};
