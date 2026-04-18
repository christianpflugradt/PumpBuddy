import type { WorkoutDetailResponse } from "./workout-types";

export const pbWorkoutDetailScreenTag = "pb-workout-detail-screen";

export type WorkoutDetailScreenState = {
  workoutId: string;
  detail: WorkoutDetailResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction = "navigate-history";

type DetailStat = {
  value: string;
  label: string;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDuration = (value: number | null): string => {
  if (!Number.isFinite(value) || value === null || value <= 0) {
    return "Unknown duration";
  }

  return `${Math.max(1, Math.floor(value))} min`;
};

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

const sumTotalLoadKg = (detail: WorkoutDetailResponse): number => {
  return detail.exercises.reduce((exerciseTotal, exercise) => {
    return (
      exerciseTotal +
      exercise.sets.reduce((setTotal, setLine) => {
        if (!Number.isFinite(setLine.load_value) || setLine.load_value === null || setLine.load_value <= 0) {
          return setTotal;
        }

        return setTotal + setLine.load_value;
      }, 0)
    );
  }, 0);
};

const formatInteger = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(value)));

const formatKilograms = (value: number): string => `${formatInteger(value)} kg`;

const resolveStats = (detail: WorkoutDetailResponse | null): DetailStat[] => {
  if (!detail) {
    return [
      { value: "--", label: "Exercises" },
      { value: "--", label: "Sets" },
      { value: "--", label: "Reps" },
      { value: "--", label: "Volume" },
    ];
  }

  return [
    { value: formatInteger(detail.completion_stats.exercise_count), label: "Exercises" },
    { value: formatInteger(detail.completion_stats.completed_set_count), label: "Sets" },
    { value: formatInteger(sumTotalReps(detail)), label: "Reps" },
    { value: formatKilograms(sumTotalLoadKg(detail)), label: "Volume" },
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
    const stats = resolveStats(detail);
    const trainingPlanName = detail?.hero.training_plan_name?.trim() || "Workout Detail";
    const workoutDate = formatWorkoutDate(detail?.hero.completed_at ?? detail?.hero.started_at ?? null);
    const durationText = formatDuration(detail?.hero.duration_minutes ?? null);
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
              <span>${escapeHtml(durationText)}</span>
              <span aria-hidden="true">·</span>
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
          ${this.#renderStatus()}
          <p class="start-copy" data-workout-detail-id="${escapeHtml(this.#state.workoutId)}">
            Workout detail preview for ID: ${escapeHtml(this.#state.workoutId)}
          </p>
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
