import type { WorkoutExercisesPerformanceRow } from "./workout-types";
import { deriveExercisePerformance } from "./exercise-performance-derivation";

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
  points: Array<{ x: number; y: number }>;
  path: string;
};

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
    subtitle: "Need at least 3 scored sessions in the last 30 days.",
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
  const score = row.selected_station_average_score_30d;
  if (
    comparableSessionCount < SCORE_TREND_MIN_COMPARABLE_SESSIONS ||
    score === null ||
    !Number.isFinite(score)
  ) {
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
  const pointCount = Math.min(30, comparableSessionCount);
  const boundedScore = Math.min(SCORE_TREND_AXIS_MAX, Math.max(SCORE_TREND_AXIS_MIN, score));
  const y =
    padTop +
    innerHeight -
    ((boundedScore - SCORE_TREND_AXIS_MIN) / (SCORE_TREND_AXIS_MAX - SCORE_TREND_AXIS_MIN)) * innerHeight;

  const points = Array.from({ length: pointCount }, (_, index) => ({
    x:
      pointCount === 1
        ? padLeft + innerWidth / 2
        : padLeft + (innerWidth * index) / (pointCount - 1),
    y,
  }));
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

const renderScoreTrendSection = (
  trend: ScoreTrendRenderable | null,
): string => {
  if (!trend) {
    return `
      <section class="progress-card progress-card--trend exercise-variant-score-trend-card exercise-variant-score-trend-card--gray" aria-label="Score trend for last 30 days">
        <h3 class="exercise-variant-score-trend-title">Score Trend</h3>
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
      <h3 class="exercise-variant-score-trend-title">Score Trend</h3>
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
            return `<circle cx="${point.x}" cy="${point.y}" r="5.5" class="progress-trend-dot progress-trend-dot--${trend.scoreToneClass}"></circle>`;
          })
          .join("")}
      </svg>
    </section>
  `;
};

const resolveExerciseAndVariantTitle = (variantName: string): { exerciseTitle: string; variantSubtitle: string } => {
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

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: ExerciseVariantDetailScreenState) {
    this.#state = value;
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

  #render(): void {
    const row = this.#state.row;
    const derived = deriveExercisePerformance(row);
    const header = resolveExerciseAndVariantTitle(row?.variant_name ?? "");
    const toneClass = row && derived.trendStatus === "AVAILABLE" ? resolveTrendHeroToneClass(derived.trendTone) : "gray";
    const heroCopy = trendHeroCopy[toneClass];
    const scoreTrend = renderScoreTrend(row, toneClass);

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
              <p class="exercise-variant-trend-hero-kicker">Trend Hero</p>
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
