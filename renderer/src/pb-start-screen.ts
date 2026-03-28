import type { StartScreenState } from "./workout-types";

export const pbStartScreenTag = "pb-start-screen";

type UiAction =
  | "start-workout"
  | "dismiss-start-blocked-modal";

type InputAction =
  | "select-training-plan"
  | "select-gym"
  | "select-workout-mode";

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

class PbStartScreenElement extends HTMLElement {
  #state: StartScreenState | null = null;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
  }

  set state(value: StartScreenState | null) {
    this.#state = value;
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

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.uiAction as UiAction | undefined;
    if (action) this.#emitUiAction(action);
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

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    this.innerHTML = `
      <section class="screen-panel start-screen">
        ${
          state.errorMessage
            ? `<p class="start-error">${escapeHtml(state.errorMessage)}</p>`
            : ""
        }

        <select
          data-input-action="select-training-plan"
        >
          ${renderOptions(state.trainingPlans, state.selectedTrainingPlanId, "Choose a plan")}
        </select>

        <label>
          <input type="radio" value="configured-gym" data-input-action="select-workout-mode"
            ${state.selectedWorkoutMode === "configured-gym" ? "checked" : ""}>
          Gym
        </label>

        <label>
          <input type="radio" value="free-mode" data-input-action="select-workout-mode"
            ${state.selectedWorkoutMode === "free-mode" ? "checked" : ""}>
          Free
        </label>

        ${
          state.selectedWorkoutMode === "configured-gym"
            ? `
          <select data-input-action="select-gym">
            ${renderOptions(state.gyms, state.selectedGymId, "Choose a gym")}
          </select>`
            : ""
        }

        <button data-ui-action="start-workout" ${state.isStarting || state.isLoading ? "disabled" : ""}>
          ${state.isStarting ? "Starting..." : "Start Workout"}
        </button>

        ${
          state.blockedStartModal
            ? `<div>
                <p>${escapeHtml(state.blockedStartModal.message)}</p>
                <button data-ui-action="dismiss-start-blocked-modal">OK</button>
              </div>`
            : ""
        }
      </section>
    `;
  }
}

export const registerPbStartScreen = (): void => {
  if (!customElements.get(pbStartScreenTag)) {
    customElements.define(pbStartScreenTag, PbStartScreenElement);
  }
};
