export const pbCurrentSetPanelTag = "pb-current-set-panel";

export type CurrentSetState = {
  setIndex: number;
  loadValue: string;
  repsValue: string;
  showLoadField: boolean;
  isReadOnly: boolean;
  isSaving: boolean;
  loadTickActive?: boolean;
  repsTickActive?: boolean;
};

type UiAction = "next-set";
type InputAction = "load-input" | "reps-input";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderEditableSetField = (
  fieldKey: "load" | "reps",
  label: string,
  inputId: string,
  inputAction: InputAction,
  value: string,
  ariaLabel: string,
  controlsDisabled: string,
  inputFeedbackClass: string,
): string => `
  <div class="set-row-field set-row-field-editable set-row-field-${fieldKey}">
    <label class="set-row-field-label" for="${inputId}">${label}</label>
    <div class="weight-controls weight-controls-${fieldKey}" aria-label="${label} controls">
      <input
        id="${inputId}"
        class="weight-input weight-input-${fieldKey}${inputFeedbackClass}"
        data-input-action="${inputAction}"
        inputmode="numeric"
        pattern="[0-9]*"
        value="${escapeHtml(value)}"
        aria-label="${escapeHtml(ariaLabel)}"
        ${controlsDisabled}
      />
    </div>
  </div>
`;

class PbCurrentSetPanelElement extends HTMLElement {
  #state: CurrentSetState | null = null;
  #shadow = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.#render();
    this.#shadow.addEventListener("click", this.#onClick);
    this.#shadow.addEventListener("input", this.#onInput);
  }

  disconnectedCallback(): void {
    this.#shadow.removeEventListener("click", this.#onClick);
    this.#shadow.removeEventListener("input", this.#onInput);
  }

  set state(value: CurrentSetState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): CurrentSetState | null {
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
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    this.#emitUiAction(action);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const action = target.dataset.inputAction as InputAction | undefined;
    if (!action) {
      return;
    }

    this.#emitInputAction(action, target.value);
  };

  #render(): void {
    const state = this.#state;
    if (!state || state.isReadOnly) {
      this.#shadow.innerHTML = "";
      return;
    }

    const controlsDisabled = state.isSaving ? "disabled" : "";
    const completeSetDisabled = state.isSaving ? "disabled" : "";
    const loadInputFeedbackClass = state.loadTickActive ? " input-feedback-tick" : "";
    const repsInputFeedbackClass = state.repsTickActive ? " input-feedback-tick" : "";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      <section class="set-list" aria-label="Current set">
        <div class="set-list-heading">
          <h3 class="set-list-title">Current Set</h3>
          <p class="set-counter">Set ${state.setIndex}</p>
        </div>

        <ol class="set-rows">
          <li class="set-row set-row-editable">
            <div class="set-row-fields">
              ${
                state.showLoadField
                  ? renderEditableSetField(
                      "load",
                      "Load",
                      "exercise-load",
                      "load-input",
                      state.loadValue,
                      "Exercise load in kilograms",
                      controlsDisabled,
                      loadInputFeedbackClass,
                    )
                  : ""
              }
              ${renderEditableSetField(
                "reps",
                "Reps",
                "exercise-reps",
                "reps-input",
                state.repsValue,
                "Exercise reps",
                controlsDisabled,
                repsInputFeedbackClass,
              )}
            </div>
          </li>
        </ol>

        <button
          type="button"
          class="nav-button nav-button-primary action-button action-button-primary"
          data-ui-action="next-set"
          ${completeSetDisabled}
        >
          ${state.isSaving ? "Saving..." : "Complete Set"}
        </button>
      </section>
    `;
  }
}

export const registerPbCurrentSetPanel = (): void => {
  if (!customElements.get(pbCurrentSetPanelTag)) {
    customElements.define(pbCurrentSetPanelTag, PbCurrentSetPanelElement);
  }
};
