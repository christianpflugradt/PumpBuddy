import type {
  WorkoutExercisesPerformanceGroup,
  WorkoutExercisesPerformanceRow,
  WorkoutExercisesPerformanceTone,
} from "./workout-contract";
import { deriveExercisePerformance } from "./exercise-performance-derivation";
import "./pb-side-menu";

export const pbExercisesScreenTag = "pb-exercises-screen";

export type ExercisesScreenState = {
  groups: WorkoutExercisesPerformanceGroup[];
  isLoading: boolean;
  errorMessage: string | null;
  restoreScrollY?: number | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "clear-filter"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-training-plans"
  | "navigate-gyms"
  | "navigate-history"
  | "navigate-settings"
  | "navigate-about"
  | "open-exercise-variant-detail"
  | "exercises-restore-complete"
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

const toneClass = (tone: WorkoutExercisesPerformanceTone): string => tone.toLowerCase();

const DAY_MS = 24 * 60 * 60 * 1000;

const toLocalDayTimestamp = (value: Date): number =>
  Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());

const formatDaysAgo = (completedAt: string, fallbackDays: number): string => {
  const parsed = new Date(completedAt);
  if (Number.isNaN(parsed.getTime())) {
    if (!Number.isFinite(fallbackDays) || fallbackDays < 0) {
      return "Unknown";
    }

    const normalizedFallbackDays = Math.floor(fallbackDays);
    if (normalizedFallbackDays === 0) {
      return "Today";
    }

    if (normalizedFallbackDays === 1) {
      return "1 day ago";
    }

    return `${normalizedFallbackDays} days ago`;
  }

  const wholeDays = Math.max(0, Math.round((toLocalDayTimestamp(new Date()) - toLocalDayTimestamp(parsed)) / DAY_MS));
  if (wholeDays === 0) {
    return "Today";
  }

  if (wholeDays === 1) {
    return "1 day ago";
  }

  return `${wholeDays} days ago`;
};

const roundDisplayDecimals = (value: string): string =>
  value.replace(/-?\d+\.\d+/g, (numericPart) => {
    const parsed = Number(numericPart);
    if (!Number.isFinite(parsed)) {
      return numericPart;
    }

    return parsed.toFixed(2);
  });

const stripRepsLabelWhenLoadShown = (value: string): string =>
  value.replace(
    /(-?\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs)\s*x\s*(-?\d+(?:\.\d+)?)\s*reps?\b/gi,
    (_match, load, unit, reps) => `${load} ${unit} x ${reps}`,
  );

const formatSecondsLabel = (value: string): string =>
  value.replace(/(\d+)\s*secs?\b/gi, (_match, secondsText) => {
    const seconds = Number.parseInt(secondsText, 10);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return _match;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  });

const formatSetSummary = (value: string): string =>
  formatSecondsLabel(stripRepsLabelWhenLoadShown(roundDisplayDecimals(value)));

const renderRowTrendIcon = (tone: WorkoutExercisesPerformanceTone): string => {
  if (tone === "GRAY") {
    return `
      <svg viewBox="0 0 88 88" width="32" height="32" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M22 49 C30 40, 38 40, 46 49 S62 58, 69 49" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
      </svg>
    `;
  }

  if (tone === "RED") {
    return `
      <svg viewBox="0 0 88 88" width="32" height="32" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M26 32 C40 32, 50 40, 60 52" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
        <path d="M48 53 L61 53 L61 40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  if (tone === "YELLOW") {
    return `
      <svg viewBox="0 0 88 88" width="32" height="32" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M26 44 L60 44" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
        <path d="M49 34 L61 44 L49 54" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 88 88" width="32" height="32" aria-hidden="true" focusable="false">
      <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
      <path d="M26 58 C40 58, 50 48, 60 37" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
      <path d="M48 34 L61 34 L61 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
};

const renderRow = (row: WorkoutExercisesPerformanceRow): string => {
  const derived = deriveExercisePerformance(row);
  return `
    <li class="exercises-row">
      <button
        type="button"
        class="exercises-row-button"
        data-ui-action="open-exercise-variant-detail"
        data-variant-id="${escapeHtml(row.variant_id)}"
        aria-label="Open ${escapeHtml(row.variant_name)} details"
      >
        <div class="exercises-row-tone exercises-row-tone--${toneClass(derived.trendTone)}" aria-hidden="true">
          ${renderRowTrendIcon(derived.trendTone)}
        </div>
        <div class="exercises-row-main">
          <p class="exercises-row-title">${escapeHtml(row.variant_name)}</p>
          <p class="exercises-row-meta">${escapeHtml(formatSetSummary(row.last_performed_first_set_display))}</p>
        </div>
        <div class="exercises-row-side">
          <p class="exercises-row-side-line">${escapeHtml(derived.comparableScoredSessions.scoredLabel)}</p>
          <p class="exercises-row-side-line">${escapeHtml(formatDaysAgo(row.last_performed_at, row.last_performed_days_ago))}</p>
        </div>
        <span class="exercises-row-chevron" aria-hidden="true">&#8250;</span>
      </button>
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
  #filterValue = "";
  #state: ExercisesScreenState = {
    groups: [],
    isLoading: false,
    errorMessage: null,
    restoreScrollY: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("input", this.#onInput);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("input", this.#onInput);
  }

  set state(value: ExercisesScreenState) {
    this.#state = value;
    this.#render();
    this.#restoreScrollPosition();
  }

  get state(): ExercisesScreenState {
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

  #restoreScrollPosition(): void {
    const scrollY = this.#state.restoreScrollY;
    if (scrollY === null || scrollY === undefined || !Number.isFinite(scrollY)) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Math.max(0, scrollY), left: 0, behavior: "auto" });
      this.#emitUiAction("exercises-restore-complete", { scrollY });
    });
  }

  #refreshFilterResults(): void {
    const groupsHost = this.querySelector<HTMLElement>('[data-ui-slot="filtered-groups"]');
    if (groupsHost) {
      groupsHost.innerHTML = this.#renderGroups();
    }

    const clearButton = this.querySelector<HTMLButtonElement>('[data-ui-action="clear-filter"]');
    if (clearButton) {
      clearButton.disabled = this.#filterValue.trim().length === 0;
    }
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


    if (action === "clear-filter") {
      this.#filterValue = "";
      const filterInput = this.querySelector<HTMLInputElement>('[data-ui-input="variant-filter"]');
      if (filterInput) {
        filterInput.value = "";
      }
      this.#refreshFilterResults();
      filterInput?.focus();
      this.#emitUiAction(action);
      return;
    }

    if (action === "open-exercise-variant-detail") {
      const variantId = actionElement.dataset.variantId?.trim() ?? "";
      if (variantId.length === 0) {
        return;
      }

      this.#emitUiAction(action, { variantId, scrollY: window.scrollY });
      return;
    }

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
    this.#refreshFilterResults();
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
                  <span class="exercises-group-count" aria-label="${escapeHtml(String(group.rows.length))} variants">
                    ${escapeHtml(String(group.rows.length))}
                  </span>
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
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <pb-side-menu active-screen="exercises" menu-id="exercises-screen-side-menu"></pb-side-menu>
        <section class="screen-panel exercises-screen" aria-label="Exercises screen">
          <header class="app-header">
            <img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" />
          </header>
          <h2 class="settings-title">Exercises</h2>
          <p class="exercises-subtitle">Last 30 days</p>
          <div class="exercises-filter-row">
            <div class="exercises-filter-input-shell">
              <input
                id="exercises-variant-filter"
                class="exercises-filter-input"
                type="text"
                data-ui-input="variant-filter"
                value="${escapeHtml(this.#filterValue)}"
                placeholder="Filter by name"
                autocomplete="off"
              />
              <button
                type="button"
                class="exercises-filter-clear"
                data-ui-action="clear-filter"
                ${this.#filterValue.trim().length > 0 ? "" : "disabled"}
                aria-label="Clear exercises filter"
              >
                <svg
                  class="exercises-filter-clear-icon"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M4.25 4.25L11.75 11.75M11.75 4.25L4.25 11.75"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div data-ui-slot="filtered-groups">${this.#renderGroups()}</div>
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

  }
}

export const registerPbExercisesScreen = (): void => {
  if (!customElements.get(pbExercisesScreenTag)) {
    customElements.define(pbExercisesScreenTag, PbExercisesScreenElement);
  }
};
