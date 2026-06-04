import type { TrainingPlanSummary } from "./workout-contract";

export const pbTrainingPlansScreenTag = "pb-training-plans-screen";

export type TrainingPlansScreenState = {
  trainingPlans: TrainingPlanSummary[];
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "open-training-plan-detail"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-gyms"
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

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const formatExerciseCount = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) {
    return "Exercises unavailable";
  }

  const exerciseCount = Math.floor(value);
  return exerciseCount === 1 ? "1 exercise" : `${exerciseCount} exercises`;
};

const formatLastCompleted = (value: string | null | undefined): string => {
  if (!value) {
    return "Never completed";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never completed";
  }

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);

  return `Last completed ${formattedDate}`;
};

class PbTrainingPlansScreenElement extends HTMLElement {
  #isSideMenuOpen = false;
  #state: TrainingPlansScreenState = {
    trainingPlans: [],
    isLoading: false,
    errorMessage: null,
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

  set state(value: TrainingPlansScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): TrainingPlansScreenState {
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

    if (action === "open-training-plan-detail") {
      const trainingPlanId = actionElement.dataset.trainingPlanId?.trim() ?? "";
      if (trainingPlanId.length === 0) {
        return;
      }

      this.#emitUiAction(action, { trainingPlanId });
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
      return `<p class="start-status" role="status">Loading training plans...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (this.#state.trainingPlans.length === 0) {
      return `<p class="start-copy">No training plans available yet.</p>`;
    }

    return `
      <div class="history-sections" aria-label="Training plans list">
        <section class="history-month-section" aria-label="Training Plans">
          <ul class="history-workout-list" aria-label="Training Plans">
            ${this.#state.trainingPlans
              .map((trainingPlan) => {
                const exerciseCountText = formatExerciseCount(trainingPlan.exercise_count);
                const lastCompletedText = formatLastCompleted(trainingPlan.last_completed_at);
                return `
                  <li>
                    <button
                      type="button"
                      class="history-workout-row"
                      data-ui-action="open-training-plan-detail"
                      data-training-plan-id="${escapeAttribute(trainingPlan.id)}"
                      aria-label="Open ${escapeAttribute(trainingPlan.name)} training plan details"
                    >
                      <span class="history-workout-row-body">
                        <span class="history-workout-row-title">${escapeHtml(trainingPlan.name)}</span>
                        <span class="history-workout-row-meta">
                          ${escapeHtml(exerciseCountText)} &middot; ${escapeHtml(lastCompletedText)}
                        </span>
                      </span>
                      <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
                    </button>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </section>
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
          aria-controls="training-plans-screen-side-menu"
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
          <nav class="side-menu-panel" id="training-plans-screen-side-menu" aria-label="Main navigation">
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
                <button type="button" class="side-menu-entry" data-ui-action="navigate-exercises">
                  Exercises
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  Training Plans
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-gyms">
                  Gyms
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
        <section class="screen-panel start-screen" aria-label="Training Plans screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <h2 class="settings-title">Training Plans</h2>
          ${this.#renderRows()}
        </section>
      </div>
    `;
  }
}

export const registerPbTrainingPlansScreen = (): void => {
  if (!customElements.get(pbTrainingPlansScreenTag)) {
    customElements.define(pbTrainingPlansScreenTag, PbTrainingPlansScreenElement);
  }
};
