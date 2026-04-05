import type { BlockedStartModalState, StartScreenState } from "./workout-types";
import { canStartWorkout } from "./workout-state";

export const pbStartScreenTag = "pb-start-screen";

type UiAction = "start-workout" | "dismiss-start-blocked-modal" | "toggle-side-menu";

type InputAction = "select-training-plan" | "select-gym" | "select-workout-mode";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderOptions = (
  items: Array<{ id: string; name: string }>,
  selectedId: string,
  placeholder: string,
): string => `
  <option value="">${escapeHtml(placeholder)}</option>
  ${items
    .map(
      (item) => `
        <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>
          ${escapeHtml(item.name)}
        </option>
      `,
    )
    .join("")}
`;

const findSelectedItem = <T extends { id: string }>(items: T[], selectedId: string): T | null =>
  items.find((item) => item.id === selectedId) ?? null;

const formatMissingExerciseReason = (reason: string): string => {
  if (reason === "no_realizable_option_in_selected_gym") {
    return "No realizable option in selected gym";
  }

  return reason.replaceAll("_", " ");
};

const renderBlockedStartModal = (blockedStartModal: BlockedStartModalState | null): string => {
  if (!blockedStartModal) {
    return "";
  }

  return `
    <div class="confirm-dialog-layer" role="presentation">
      <div class="confirm-dialog-backdrop" role="presentation"></div>
      <section
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Workout start blocked"
      >
        <p class="confirm-dialog-message">${escapeHtml(blockedStartModal.message)}</p>
        <p class="confirm-dialog-context">
          ${escapeHtml(blockedStartModal.trainingPlanName)} at ${escapeHtml(blockedStartModal.gymName)}
        </p>
        <ul class="confirm-dialog-list" aria-label="Missing realizable exercises">
          ${blockedStartModal.missingExercises
            .map(
              (exercise) => `
                <li>
                  Exercise ${exercise.exercise_position}: ${escapeHtml(exercise.exercise_name)} (${escapeHtml(
                    formatMissingExerciseReason(exercise.reason),
                  )})
                </li>
              `,
            )
            .join("")}
        </ul>
        <div class="confirm-dialog-actions">
          <button
            type="button"
            class="nav-button nav-button-primary"
            data-ui-action="dismiss-start-blocked-modal"
          >
            OK
          </button>
        </div>
      </section>
    </div>
  `;
};

const renderStartPreview = (startScreen: StartScreenState): string => {
  const selectedPlan = findSelectedItem(startScreen.trainingPlans, startScreen.selectedTrainingPlanId);
  const selectedGym = findSelectedItem(startScreen.gyms, startScreen.selectedGymId);
  const freeModeSelected = startScreen.selectedWorkoutMode === "free-mode";
  const previewLine = selectedPlan
    ? `${selectedPlan.exercise_count} exercises lined up for ${escapeHtml(selectedPlan.name)}.`
    : "Choose a plan to preview your workout structure.";

  return `
    <section class="start-preview" aria-label="Upcoming workout preview">
      <div class="start-preview-header">
        <h2 class="start-preview-title">Workout Preview</h2>
        <p class="start-preview-copy">${previewLine}</p>
      </div>
      <ul class="start-preview-cues" aria-label="Workout context cues">
        <li class="start-preview-cue">
          <span class="start-preview-cue-label">Training Plan</span>
          <span class="start-preview-cue-value">${
            selectedPlan ? escapeHtml(selectedPlan.name) : "Not selected"
          }</span>
        </li>
        <li class="start-preview-cue">
          <span class="start-preview-cue-label">Location</span>
          <span class="start-preview-cue-value">${
            freeModeSelected
              ? "Free Mode (No Gym)"
              : selectedGym
                ? escapeHtml(selectedGym.name)
                : "Not selected"
          }</span>
        </li>
      </ul>
    </section>
  `;
};

class PbStartScreenElement extends HTMLElement {
  #state: StartScreenState | null = null;

  #isSideMenuOpen = false;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("change", this.#onChange);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
  }

  set state(value: StartScreenState | null) {
    this.#state = value;
    this.#isSideMenuOpen = false;
    this.#render();
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

  #emitInputAction(action: InputAction, value: string): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-input", {
        bubbles: true,
        composed: true,
        detail: { action, value },
      }),
    );
  }

  #closeSideMenu = (): void => {
    if (!this.#isSideMenuOpen) {
      return;
    }

    this.#isSideMenuOpen = false;
    this.#render();
  };

  #toggleSideMenu = (): void => {
    this.#isSideMenuOpen = !this.#isSideMenuOpen;
    this.#render();
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
    if (!(target instanceof Element)) return;

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) return;

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    if (action === "toggle-side-menu") {
      this.#toggleSideMenu();
      return;
    }

    this.#emitUiAction(action);
  };

  #onChange = (event: Event): void => {
    const target = event.target;

    if (target instanceof HTMLSelectElement) {
      const action = target.dataset.inputAction as InputAction | undefined;
      if (action) this.#emitInputAction(action, target.value);
    }

    if (target instanceof HTMLInputElement && target.type === "radio") {
      const action = target.dataset.inputAction as InputAction | undefined;
      if (action) this.#emitInputAction(action, target.value);
    }
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

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    const sideMenuOpenClass = this.#isSideMenuOpen ? " is-open" : "";

    this.innerHTML = `
      <section class="start-screen-shell" aria-label="Workout selection shell">
        <button
          type="button"
          class="side-menu-toggle"
          data-ui-action="toggle-side-menu"
          aria-label="${this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu"}"
          aria-expanded="${this.#isSideMenuOpen ? "true" : "false"}"
          aria-controls="start-screen-side-menu"
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
          <nav class="side-menu-panel" id="start-screen-side-menu" aria-label="Main navigation">
            <p class="side-menu-title">Navigation</p>
            <ul class="side-menu-list">
              <li><button type="button" class="side-menu-entry" disabled>Workout</button></li>
              <li><button type="button" class="side-menu-entry" disabled>Settings</button></li>
              <li><button type="button" class="side-menu-entry" disabled>Log out</button></li>
            </ul>
          </nav>
        </div>
        <section class="screen-panel start-screen" aria-label="Workout start screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
            <p class="start-copy">Choose a training plan, then pick gym mode or free mode to begin.</p>
          </header>
          ${
            state.isLoading
              ? '<p class="start-status" role="status">Loading available plans and gyms...</p>'
              : ""
          }
          ${
            state.errorMessage
              ? `<p class="start-error" role="alert">${escapeHtml(state.errorMessage)}</p>`
              : ""
          }
          <div class="start-fields">
            <div class="start-field">
              <label class="start-label" for="training-plan-select">Training Plan</label>
              <select
                id="training-plan-select"
                class="start-select"
                data-input-action="select-training-plan"
                ${state.isLoading || state.isStarting ? "disabled" : ""}
              >
                ${renderOptions(state.trainingPlans, state.selectedTrainingPlanId, "Choose a plan")}
              </select>
            </div>
            <fieldset class="start-field start-mode-field">
              <legend class="start-label">Workout Mode</legend>
              <label class="start-mode-option">
                <input
                  type="radio"
                  name="workout-mode"
                  value="configured-gym"
                  data-input-action="select-workout-mode"
                  ${state.selectedWorkoutMode === "configured-gym" ? "checked" : ""}
                  ${state.isLoading || state.isStarting ? "disabled" : ""}
                />
                <span>Gym Mode</span>
              </label>
              <label class="start-mode-option">
                <input
                  type="radio"
                  name="workout-mode"
                  value="free-mode"
                  data-input-action="select-workout-mode"
                  ${state.selectedWorkoutMode === "free-mode" ? "checked" : ""}
                  ${state.isLoading || state.isStarting ? "disabled" : ""}
                />
                <span>Free Mode</span>
              </label>
            </fieldset>
            ${
              state.selectedWorkoutMode === "configured-gym"
                ? `
              <div class="start-field">
                <label class="start-label" for="gym-select">Gym</label>
                <select
                  id="gym-select"
                  class="start-select"
                  data-input-action="select-gym"
                  ${state.isLoading || state.isStarting ? "disabled" : ""}
                >
                  ${renderOptions(state.gyms, state.selectedGymId, "Choose a gym")}
                </select>
              </div>
              `
                : ""
            }
          </div>
          ${renderStartPreview(state)}
          <button
            type="button"
            class="start-button nav-button nav-button-primary action-button action-button-primary"
            data-ui-action="start-workout"
            ${canStartWorkout(state) ? "" : "disabled"}
          >
            ${state.isStarting ? "Preparing Workout..." : "Start Workout"}
          </button>
          ${renderBlockedStartModal(state.blockedStartModal)}
        </section>
      </section>
    `;

    this.#syncOutsideClickListener();
  }
}

export const registerPbStartScreen = (): void => {
  if (!customElements.get(pbStartScreenTag)) {
    customElements.define(pbStartScreenTag, PbStartScreenElement);
  }
};
