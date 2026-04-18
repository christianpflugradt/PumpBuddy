import type { WorkoutHistorySummary } from "./workout-types";

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
    timeZone: "UTC",
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
    timeZone: "UTC",
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
      ? `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}`
      : "unknown-month";

    const existingSection = sectionsByKey.get(key);
    if (existingSection) {
      existingSection.workouts.push(workout);
      continue;
    }

    const orderTimestamp = parsedDate
      ? Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1)
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
  #isSideMenuOpen = false;
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
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
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

  #syncSideMenuUi(): void {
    const toggleButton = this.querySelector('[data-ui-action="toggle-side-menu"]');
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.setAttribute("aria-expanded", this.#isSideMenuOpen ? "true" : "false");
      toggleButton.setAttribute(
        "aria-label",
        this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu",
      );
    }

    const sideMenuShell = this.querySelector(".side-menu-shell");
    if (sideMenuShell instanceof HTMLElement) {
      sideMenuShell.classList.toggle("is-open", this.#isSideMenuOpen);
      sideMenuShell.setAttribute("aria-hidden", this.#isSideMenuOpen ? "false" : "true");
    }
  }

  #setSideMenuOpen(nextOpen: boolean): void {
    if (this.#isSideMenuOpen === nextOpen) {
      return;
    }

    this.#isSideMenuOpen = nextOpen;
    this.#syncSideMenuUi();
    this.#syncOutsideClickListener();
  }

  #closeSideMenu = (): void => {
    this.#setSideMenuOpen(false);
  };

  #toggleSideMenu = (): void => {
    this.#setSideMenuOpen(!this.#isSideMenuOpen);
  };

  #onGlobalPointerDown = (event: Event): void => {
    if (!this.#isSideMenuOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-ui-action="toggle-side-menu"]')) {
      return;
    }

    if (target.closest(".side-menu-panel")) {
      return;
    }

    this.#closeSideMenu();
  };

  #syncOutsideClickListener(): void {
    if (this.#isSideMenuOpen && this.isConnected) {
      window.addEventListener("pointerdown", this.#onGlobalPointerDown, true);
      return;
    }

    window.removeEventListener("pointerdown", this.#onGlobalPointerDown, true);
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

    if (action === "toggle-side-menu") {
      this.#toggleSideMenu();
      return;
    }

    if (action === "close-side-menu") {
      this.#closeSideMenu();
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

    this.#setSideMenuOpen(false);
    this.#emitUiAction(action);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (!this.#isSideMenuOpen) {
      return;
    }

    event.preventDefault();
    this.#closeSideMenu();
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
    const sideMenuOpenClass = this.#isSideMenuOpen ? " is-open" : "";
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle"
          data-ui-action="toggle-side-menu"
          aria-label="${this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu"}"
          aria-expanded="${this.#isSideMenuOpen ? "true" : "false"}"
          aria-controls="history-screen-side-menu"
        >
          <span class="side-menu-toggle-lines" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <div
          class="side-menu-shell${sideMenuOpenClass}"
          aria-hidden="${this.#isSideMenuOpen ? "false" : "true"}"
        >
          <div class="side-menu-backdrop" role="presentation"></div>
          <nav class="side-menu-panel" id="history-screen-side-menu" aria-label="Main navigation">
            <p class="side-menu-title">Navigation</p>
            <ul class="side-menu-list">
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-workout">
                  Workout
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  History
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-settings">
                  Settings
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-about">
                  About
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="logout">
                  Log out
                </button>
              </li>
            </ul>
          </nav>
        </div>
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
