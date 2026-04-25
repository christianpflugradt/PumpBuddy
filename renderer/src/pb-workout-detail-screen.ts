import { formatLoadWithUnitDisplay } from "./workout-load-display";
import type { SetTrackingMode, WorkoutDetailExercise, WorkoutDetailResponse, WorkoutDetailSetLine } from "./workout-types";
import { countWorkoutDetailLogicalSets } from "./logical-set-count";
import { sumWorkoutDetailVolumeKg } from "./workout-volume";

export const pbWorkoutDetailScreenTag = "pb-workout-detail-screen";

export type WorkoutDetailScreenState = {
  workoutId: string;
  detail: WorkoutDetailResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  enableVariantRowNavigation?: boolean;
};

type UiAction = "navigate-history" | "open-exercise-variant-detail";

type DetailStat = {
  value: string;
  label: string;
};

type UnilateralSetRow = {
  setIndex: number;
  left: WorkoutDetailSetLine | null;
  right: WorkoutDetailSetLine | null;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const parseDate = (value: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const formatWorkoutDate = (value: string | null): string => {
  const parsed = parseDate(value);
  if (!parsed) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const formatTime = (value: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

const formatTimeRange = (startedAt: string | null, completedAt: string | null): string => {
  const started = parseDate(startedAt);
  const completed = parseDate(completedAt);
  if (!started || !completed) {
    return "Time unavailable";
  }

  return `${formatTime(started)} - ${formatTime(completed)}`;
};

const sumTotalReps = (detail: WorkoutDetailResponse): number => {
  return detail.exercises.reduce((exerciseTotal, exercise) => {
    return (
      exerciseTotal +
      exercise.sets.reduce((setTotal, setLine) => {
        if (
          setLine.repetition_kind === "SECS" ||
          !Number.isFinite(setLine.repetition_value) ||
          setLine.repetition_value === null
        ) {
          return setTotal;
        }

        return setTotal + Math.max(0, Math.floor(setLine.repetition_value));
      }, 0)
    );
  }, 0);
};

const formatInteger = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(value)));

const formatKilograms = (value: number): string => `${formatInteger(value)} kg`;

const formatSecondsToMinutesSeconds = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const resolveSubtitle = (exercise: WorkoutDetailExercise): string => {
  const variantName = exercise.variant_name?.trim() ?? "";
  if (variantName.length > 0) {
    return variantName;
  }

  return "Variant context unavailable";
};

const renderVariantLinkIcon = (): string => `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2.75 3.5h6.5v1.5h-5v7h7v-5h1.5v6.5h-10z" fill="currentColor"></path>
    <path d="M8 2.25h5.75V8h-1.5V4.81L7.78 9.28l-1.06-1.06 4.47-4.47H8z" fill="currentColor"></path>
  </svg>
`;

const resolveVariantId = (exercise: WorkoutDetailExercise): string => {
  const rawValue = typeof exercise.variant_id === "string" ? exercise.variant_id : "";
  return rawValue.trim();
};

const renderExerciseSubtitle = (
  exercise: WorkoutDetailExercise,
  options: { enableVariantRowNavigation: boolean },
): string => {
  const variantName = exercise.variant_name?.trim() ?? "";
  if (variantName.length === 0) {
    return `<p class="workout-detail-exercise-subtitle">${escapeHtml(resolveSubtitle(exercise))}</p>`;
  }

  const variantId = resolveVariantId(exercise);
  if (!options.enableVariantRowNavigation || variantId.length === 0) {
    return `<p class="workout-detail-exercise-subtitle">${escapeHtml(variantName)}</p>`;
  }

  return `
    <button
      type="button"
      class="workout-detail-exercise-subtitle workout-detail-exercise-subtitle-link-target"
      data-ui-action="open-exercise-variant-detail"
      data-variant-id="${escapeHtml(variantId)}"
      aria-label="Open ${escapeHtml(variantName)} details"
    >
      <span class="workout-detail-exercise-subtitle-text">${escapeHtml(variantName)}</span>
      <span class="workout-detail-exercise-subtitle-link-icon">${renderVariantLinkIcon()}</span>
    </button>
  `;
};

const resolveRepetitionText = (
  setLine: WorkoutDetailSetLine,
  exercise: WorkoutDetailExercise,
  includeRepsUnit: boolean,
): string | null => {
  if (!Number.isFinite(setLine.repetition_value) || setLine.repetition_value === null || setLine.repetition_value <= 0) {
    return null;
  }

  const repetitionKind = setLine.repetition_kind ?? exercise.repetition_kind ?? "REPS";
  const repetitionValue = Math.max(0, Math.floor(setLine.repetition_value));
  if (repetitionKind === "SECS") {
    return formatSecondsToMinutesSeconds(repetitionValue);
  }

  if (!includeRepsUnit) {
    return `${repetitionValue}`;
  }

  return `${repetitionValue} reps`;
};

const formatSetValue = (setLine: WorkoutDetailSetLine | null, exercise: WorkoutDetailExercise): string => {
  if (!setLine) {
    return "—";
  }

  const loadText = formatLoadWithUnitDisplay(setLine.load_value);
  const loadAwareRepetitionText = resolveRepetitionText(setLine, exercise, false);
  const repetitionOnlyText = resolveRepetitionText(setLine, exercise, true);
  if (loadAwareRepetitionText && loadText !== "—") {
    return `${loadText} x ${loadAwareRepetitionText}`;
  }

  if (repetitionOnlyText) {
    return repetitionOnlyText;
  }

  if (loadText !== "—") {
    return loadText;
  }

  return "—";
};

const resolveTrackingMode = (exercise: WorkoutDetailExercise): SetTrackingMode => {
  if (exercise.set_tracking_mode === "UNILATERAL") {
    return "UNILATERAL";
  }

  if (exercise.set_tracking_mode === "BILATERAL") {
    return "BILATERAL";
  }

  return exercise.sets.some((setLine) => setLine.set_side === "LEFT" || setLine.set_side === "RIGHT")
    ? "UNILATERAL"
    : "BILATERAL";
};

const buildUnilateralRows = (sets: WorkoutDetailSetLine[]): UnilateralSetRow[] => {
  const grouped = new Map<number, UnilateralSetRow>();
  for (const setLine of sets) {
    const current = grouped.get(setLine.set_index) ?? {
      setIndex: setLine.set_index,
      left: null,
      right: null,
    };

    if (setLine.set_side === "RIGHT") {
      current.right = setLine;
    } else {
      current.left = setLine;
    }

    grouped.set(setLine.set_index, current);
  }

  return Array.from(grouped.values()).sort((left, right) => left.setIndex - right.setIndex);
};

const renderSetLines = (exercise: WorkoutDetailExercise): string => {
  if (exercise.sets.length === 0) {
    return '<p class="workout-detail-set-empty" role="status">No completed sets recorded.</p>';
  }

  const trackingMode = resolveTrackingMode(exercise);
  if (trackingMode === "UNILATERAL") {
    const unilateralRows = buildUnilateralRows(exercise.sets);
    return `
      <ol class="workout-detail-set-list workout-detail-set-list-unilateral">
        ${unilateralRows
          .map((row) => {
            const leftText = formatSetValue(row.left, exercise);
            const rightText = formatSetValue(row.right, exercise);
            return `
              <li class="workout-detail-set-line">
                <span class="workout-detail-set-label">Set ${escapeHtml(String(row.setIndex))}</span>
                <span class="workout-detail-set-value workout-detail-set-value-unilateral">
                  <span class="workout-detail-set-side">L: ${escapeHtml(leftText)}</span>
                  <span class="workout-detail-set-side">R: ${escapeHtml(rightText)}</span>
                </span>
              </li>
            `;
          })
          .join("")}
      </ol>
    `;
  }

  return `
    <ol class="workout-detail-set-list">
      ${exercise.sets
        .map((setLine) => {
          const lineText = formatSetValue(setLine, exercise);
          return `
            <li class="workout-detail-set-line">
              <span class="workout-detail-set-label">Set ${escapeHtml(String(setLine.set_index))}</span>
              <span class="workout-detail-set-value">${escapeHtml(lineText)}</span>
            </li>
          `;
        })
        .join("")}
    </ol>
  `;
};

const renderExerciseSections = (
  detail: WorkoutDetailResponse | null,
  options: { enableVariantRowNavigation: boolean },
): string => {
  if (!detail) {
    return "";
  }

  if (detail.exercises.length === 0) {
    return `
      <section class="workout-detail-exercises" aria-label="Workout exercises">
        <h3 class="workout-detail-exercises-title">Exercises</h3>
        <p class="workout-detail-set-empty" role="status">No exercise details available.</p>
      </section>
    `;
  }

  return `
    <section class="workout-detail-exercises" aria-label="Workout exercises">
      <h3 class="workout-detail-exercises-title">Exercises</h3>
      <div class="workout-detail-exercise-list">
        ${detail.exercises
          .map((exercise, index) => {
            return `
              <section class="workout-detail-exercise-section">
                <div class="workout-detail-exercise-header">
                  <h4 class="workout-detail-exercise-name">${escapeHtml(exercise.exercise_name)}</h4>
                  <p class="workout-detail-exercise-position">${escapeHtml(String(index + 1))} of ${escapeHtml(String(detail.exercises.length))}</p>
                </div>
                ${renderExerciseSubtitle(exercise, options)}
                ${renderSetLines(exercise)}
              </section>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
};

const resolveStats = (detail: WorkoutDetailResponse | null): DetailStat[] => {
  if (!detail) {
    return [
      { value: "--", label: "Exercises" },
      { value: "--", label: "Sets" },
      { value: "--", label: "Reps" },
      { value: "--", label: "Volume" },
    ];
  }

  const completedSetCount = detail.exercises.reduce(
    (sum, exercise) => sum + countWorkoutDetailLogicalSets(exercise.sets, resolveTrackingMode(exercise)),
    0,
  );
  const totalVolumeKg = Math.round(sumWorkoutDetailVolumeKg(detail.exercises));

  return [
    { value: formatInteger(detail.completion_stats.exercise_count), label: "Exercises" },
    { value: formatInteger(completedSetCount), label: "Sets" },
    { value: formatInteger(sumTotalReps(detail)), label: "Reps" },
    { value: formatKilograms(totalVolumeKg), label: "Volume" },
  ];
};

class PbWorkoutDetailScreenElement extends HTMLElement {
  #state: WorkoutDetailScreenState = {
    workoutId: "",
    detail: null,
    isLoading: false,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: WorkoutDetailScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): WorkoutDetailScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction, payload?: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: payload ? { action, payload } : { action },
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

    if (action === "open-exercise-variant-detail") {
      const variantId = actionElement.dataset.variantId?.trim() ?? "";
      if (variantId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { variantId });
      return;
    }

    this.#emitUiAction(action);
  };

  #renderStatus(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading workout detail...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    return "";
  }

  #render(): void {
    const detail = this.#state.detail;
    const enableVariantRowNavigation = this.#state.enableVariantRowNavigation === true;
    const stats = resolveStats(detail);
    const trainingPlanName = detail?.hero.training_plan_name?.trim() || "Workout Detail";
    const workoutDate = formatWorkoutDate(detail?.hero.completed_at ?? detail?.hero.started_at ?? null);
    const timeRangeText = formatTimeRange(detail?.hero.started_at ?? null, detail?.hero.completed_at ?? null);
    const gymName = detail?.hero.gym_name?.trim() || "Unknown gym";

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-history"
          aria-label="Back to history"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section class="screen-panel start-screen workout-detail-screen" aria-label="Workout detail screen">
          <header class="workout-detail-hero">
            <h2 class="workout-detail-plan-name">${escapeHtml(trainingPlanName)}</h2>
            <p class="workout-detail-date">${escapeHtml(workoutDate)}</p>
            <p class="workout-detail-meta">
              <span>${escapeHtml(timeRangeText)}</span>
              <span aria-hidden="true">·</span>
              <span>${escapeHtml(gymName)}</span>
            </p>
            <ul class="workout-detail-stat-grid" aria-label="Workout completion stats">
              ${stats
                .map(
                  (stat) => `
                    <li class="workout-detail-stat-tile">
                      <p class="workout-detail-stat-value">${escapeHtml(stat.value)}</p>
                      <p class="workout-detail-stat-label">${escapeHtml(stat.label)}</p>
                    </li>
                  `,
                )
                .join("")}
            </ul>
          </header>
          ${renderExerciseSections(detail, { enableVariantRowNavigation })}
          ${this.#renderStatus()}
        </section>
      </div>
    `;
  }
}

export const registerPbWorkoutDetailScreen = (): void => {
  if (!customElements.get(pbWorkoutDetailScreenTag)) {
    customElements.define(pbWorkoutDetailScreenTag, PbWorkoutDetailScreenElement);
  }
};
