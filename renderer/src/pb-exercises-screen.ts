import type {
  WorkoutExercisesPerformanceGroup,
  WorkoutExercisesPerformanceRow,
  WorkoutExercisesPerformanceTone,
} from "./workout-types";

export const pbExercisesScreenTag = "pb-exercises-screen";

export type ExercisesScreenState = {
  groups: WorkoutExercisesPerformanceGroup[];
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "clear-filter"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-history"
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

const toneLabel: Record<WorkoutExercisesPerformanceTone, string> = {
  GREEN: "Improving",
  YELLOW: "Stable",
  RED: "Lighter Phase",
  GRAY: "Not enough data",
};

const toneSubtitle: Record<WorkoutExercisesPerformanceTone, string> = {
  GREEN: "Variant score trend is above baseline.",
  YELLOW: "Variant score trend is near baseline.",
  RED: "Variant score trend is below baseline.",
  GRAY: "Need at least 3 scored sessions in the selected station stream.",
};

const toneClass = (tone: WorkoutExercisesPerformanceTone): string => tone.toLowerCase();

const formatDaysAgo = (days: number): string => {
  if (!Number.isFinite(days) || days < 0) {
    return "Unknown";
  }

  const wholeDays = Math.floor(days);
  if (wholeDays === 0) {
    return "Today";
  }

  if (wholeDays === 1) {
    return "1 day ago";
  }

  return `${wholeDays} days ago`;
};

const formatAverageScore = (row: WorkoutExercisesPerformanceRow): string => {
  if (row.performance_status !== "AVAILABLE" || row.selected_station_average_score_30d == null) {
    return "Not enough data";
  }

  return row.selected_station_average_score_30d.toFixed(2);
};

const renderRow = (row: WorkoutExercisesPerformanceRow): string => {
  return `
    <li class="exercises-row" aria-label="${escapeHtml(row.variant_name)} performance row">
      <div class="exercises-row-main">
        <p class="exercises-row-title">${escapeHtml(row.variant_name)}</p>
        <p class="exercises-row-meta">Variant label: ${escapeHtml(row.variant_name)}</p>
        <p class="exercises-row-meta">First set: ${escapeHtml(row.last_performed_first_set_display)}</p>
        <p class="exercises-row-meta">Sessions (30d): ${escapeHtml(String(row.variant_session_count_30d))}</p>
        <p class="exercises-row-meta">Last performed: ${escapeHtml(formatDaysAgo(row.last_performed_days_ago))}</p>
      </div>
      <div class="exercises-row-side">
        <p class="exercises-row-score">${escapeHtml(formatAverageScore(row))}</p>
        <span class="exercises-row-chevron" aria-hidden="true">&#8250;</span>
      </div>
    </li>
  `;
};

const applyVariantNameFilter = (
  groups: WorkoutExercisesPerformanceGroup[],
  filterValue: string,
): WorkoutExercisesPerformanceGroup[] => {
  const normalized = filterValue.trim().toLowerCase();
  if (normalized.length === 0) {
    return groups;
  }

  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => row.variant_name.toLowerCase().includes(normalized)),
    }))
    .filter((group) => group.rows.length > 0);
};

class PbExercisesScreenElement extends HTMLElement {
  #isSideMenuOpen = false;
  #filterValue = "";
  #state: ExercisesScreenState = {
    groups: [],
    isLoading: false,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("input", this.#onInput);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
  }

  set state(value: ExercisesScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): ExercisesScreenState {
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
    if (!actionElement) {
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

    if (action === "clear-filter") {
      this.#filterValue = "";
      this.#render();
      this.#emitUiAction(action);
      return;
    }

    this.#setSideMenuOpen(false);
    this.#emitUiAction(action);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.uiInput !== "variant-filter") {
      return;
    }

    this.#filterValue = target.value;
    this.#render();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    const filterInput = this.querySelector<HTMLInputElement>('[data-ui-input="variant-filter"]');
    if (filterInput && document.activeElement === filterInput && this.#filterValue.length > 0) {
      this.#filterValue = "";
      this.#render();
      return;
    }

    if (!this.#isSideMenuOpen) {
      return;
    }

    event.preventDefault();
    this.#closeSideMenu();
  };

  #renderGroups(): string {
    const filteredGroups = applyVariantNameFilter(this.#state.groups, this.#filterValue);

    if (filteredGroups.length === 0) {
      const noResultsCopy =
        this.#filterValue.trim().length > 0 ? "No variants match this filter." : "No performance rows available yet.";
      return `<p class="start-copy">${escapeHtml(noResultsCopy)}</p>`;
    }

    return `
      <div class="exercises-groups" aria-label="Exercises performance groups">
        ${filteredGroups
          .map((group) => {
            return `
              <section class="exercises-group exercises-group--${toneClass(group.tone)}" aria-label="${escapeHtml(toneLabel[group.tone])} group">
                <header class="exercises-group-header">
                  <h3 class="exercises-group-title">${escapeHtml(toneLabel[group.tone])}</h3>
                  <p class="exercises-group-subtitle">${escapeHtml(toneSubtitle[group.tone])}</p>
                </header>
                <ul class="exercises-row-list" aria-label="${escapeHtml(toneLabel[group.tone])} variants">
                  ${group.rows.map(renderRow).join("")}
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
          aria-controls="exercises-screen-side-menu"
        >
          <span class="side-menu-toggle-lines" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <div class="side-menu-shell${sideMenuOpenClass}" aria-hidden="${this.#isSideMenuOpen ? "false" : "true"}">
          <div class="side-menu-backdrop" role="presentation"></div>
          <nav class="side-menu-panel" id="exercises-screen-side-menu" aria-label="Main navigation">
            <p class="side-menu-title">Navigation</p>
            <ul class="side-menu-list">
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-workout">
                  Workout
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-progress">
                  Progress
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  Exercises
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-history">
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
        <section class="screen-panel exercises-screen" aria-label="Exercises screen">
          <header class="app-header">
            <img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" />
          </header>
          <h2 class="settings-title">Exercises</h2>
          <div class="exercises-filter-row">
            <label class="exercises-filter-label" for="exercises-variant-filter">Filter variants</label>
            <div class="exercises-filter-input-shell">
              <input
                id="exercises-variant-filter"
                class="exercises-filter-input"
                type="text"
                data-ui-input="variant-filter"
                value="${escapeHtml(this.#filterValue)}"
                placeholder="Search variant name"
                autocomplete="off"
              />
              <button
                type="button"
                class="exercises-filter-clear"
                data-ui-action="clear-filter"
                ${this.#filterValue.trim().length > 0 ? "" : "disabled"}
                aria-label="Clear exercises filter"
              >
                x
              </button>
            </div>
          </div>
          ${this.#renderGroups()}
          ${
            this.#state.isLoading
              ? '<p class="start-copy" role="status" aria-live="polite">Loading exercises performance...</p>'
              : this.#state.errorMessage
                ? `<p class="start-copy" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`
                : ""
          }
        </section>
      </div>
    `;

    this.#syncSideMenuUi();
  }
}

export const registerPbExercisesScreen = (): void => {
  if (!customElements.get(pbExercisesScreenTag)) {
    customElements.define(pbExercisesScreenTag, PbExercisesScreenElement);
  }
};
