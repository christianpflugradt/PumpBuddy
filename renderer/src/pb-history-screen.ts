import type { WorkoutHistorySummary } from "./workout-contract";
import "./pb-side-menu";

export const pbHistoryScreenTag = "pb-history-screen";

export type HistoryScreenState = {
  workouts: WorkoutHistorySummary[];
  isLoading: boolean;
  errorMessage: string | null;
  restoreWorkoutId: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "open-workout-detail"
  | "history-restore-complete"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-training-plans"
  | "navigate-gyms"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const formatHistoryDate = (value: string | null): string => {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const formatHistoryMonth = (value: string | null): string => {
  if (!value) {
    return "Unknown month";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown month";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsed);
};

const resolveWorkoutDate = (workout: WorkoutHistorySummary): Date | null => {
  const rawDate = workout.completed_at ?? workout.started_at;
  if (!rawDate) {
    return null;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const resolveWorkoutTimestamp = (workout: WorkoutHistorySummary): number => {
  const parsed = resolveWorkoutDate(workout);
  if (!parsed) {
    return Number.NEGATIVE_INFINITY;
  }

  return parsed.getTime();
};

const formatDurationMinutes = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(value));
};

type HistorySection = {
  key: string;
  label: string;
  orderTimestamp: number;
  workouts: WorkoutHistorySummary[];
};

const groupHistorySections = (workouts: WorkoutHistorySummary[]): HistorySection[] => {
  const sectionsByKey = new Map<string, HistorySection>();

  for (const workout of workouts) {
    const parsedDate = resolveWorkoutDate(workout);
    const key = parsedDate
      ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}`
      : "unknown-month";

    const existingSection = sectionsByKey.get(key);
    if (existingSection) {
      existingSection.workouts.push(workout);
      continue;
    }

    const orderTimestamp = parsedDate
      ? Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
      : Number.NEGATIVE_INFINITY;

    sectionsByKey.set(key, {
      key,
      label: formatHistoryMonth(parsedDate ? parsedDate.toISOString() : null),
      orderTimestamp,
      workouts: [workout],
    });
  }

  return Array.from(sectionsByKey.values())
    .sort((left, right) => right.orderTimestamp - left.orderTimestamp)
    .map((section) => ({
      ...section,
      workouts: [...section.workouts].sort(
        (left, right) => resolveWorkoutTimestamp(right) - resolveWorkoutTimestamp(left),
      ),
    }));
};

class PbHistoryScreenElement extends HTMLElement {
  #pendingRestoreWorkoutId: string | null = null;
  #state: HistoryScreenState = {
    workouts: [],
    isLoading: false,
    errorMessage: null,
    restoreWorkoutId: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: HistoryScreenState) {
    if (value.restoreWorkoutId !== this.#state.restoreWorkoutId) {
      this.#pendingRestoreWorkoutId = value.restoreWorkoutId;
    }

    this.#state = value;
    this.#render();
    this.#attemptPendingRestore();
  }

  get state(): HistoryScreenState {
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

  #attemptPendingRestore(): void {
    if (!this.#pendingRestoreWorkoutId) {
      return;
    }

    if (this.#state.isLoading || this.#state.errorMessage) {
      return;
    }

    const workoutId = this.#pendingRestoreWorkoutId;
    const target = this.querySelector<HTMLElement>(
      `[data-history-workout-id="${escapeAttribute(workoutId)}"]`,
    );

    this.#pendingRestoreWorkoutId = null;

    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", inline: "nearest" });
      if (typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
      this.#emitUiAction("history-restore-complete", { workoutId, restored: true });
      return;
    }

    this.#emitUiAction("history-restore-complete", { workoutId, restored: false });
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


    if (action === "open-workout-detail") {
      const workoutId = actionElement.dataset.workoutId?.trim() ?? "";
      if (workoutId.length === 0) {
        return;
      }

      this.#emitUiAction(action, { workoutId });
      return;
    }

    this.#emitUiAction(action);
  };

  #renderRows(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading workout history...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (this.#state.workouts.length === 0) {
      return `<p class="start-copy">No completed workouts yet.</p>`;
    }

    const sections = groupHistorySections(this.#state.workouts);

    return `
      <div class="history-sections" aria-label="Workout history list grouped by month">
        ${sections
          .map((section) => {
            const workoutRows = section.workouts
              .map((workout) => {
                const workoutDateText = formatHistoryDate(workout.completed_at ?? workout.started_at);
                const gymName = workout.gym_name ?? "No gym";
                return `
                  <li>
                    <button
                      type="button"
                      class="history-workout-row"
                      data-ui-action="open-workout-detail"
                      data-workout-id="${escapeAttribute(workout.id)}"
                      data-history-workout-id="${escapeAttribute(workout.id)}"
                      aria-label="Open ${escapeAttribute(workout.training_plan_name)} workout details"
                    >
                      <span class="history-workout-row-body">
                        <span class="history-workout-row-title">
                          ${escapeHtml(workout.training_plan_name)}
                          · ${formatDurationMinutes(workout.duration_minutes)} min
                        </span>
                        <span class="history-workout-row-meta">
                          ${escapeHtml(workoutDateText)}
                          · ${escapeHtml(gymName)}
                        </span>
                      </span>
                      <span class="history-workout-chevron" aria-hidden="true">›</span>
                    </button>
                  </li>
                `;
              })
              .join("");

            return `
              <section class="history-month-section" aria-label="${escapeHtml(section.label)}">
                <h3 class="history-month-label">${escapeHtml(section.label)}</h3>
                <ul class="history-workout-list" aria-label="${escapeHtml(section.label)} workouts">
                  ${workoutRows}
                </ul>
              </section>
            `;
          })
          .join("")}
      </div>
    `;
  }

  #render(): void {
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <pb-side-menu active-screen="history" menu-id="history-screen-side-menu"></pb-side-menu>
        <section class="screen-panel start-screen" aria-label="Workout history screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <h2 class="settings-title">History</h2>
          ${this.#renderRows()}
        </section>
      </div>
    `;
  }
}

export const registerPbHistoryScreen = (): void => {
  if (!customElements.get(pbHistoryScreenTag)) {
    customElements.define(pbHistoryScreenTag, PbHistoryScreenElement);
  }
};
