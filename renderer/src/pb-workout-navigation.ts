export const pbWorkoutNavigationTag = "pb-workout-navigation";

export type WorkoutNavigationState = {
  isFirstStep: boolean;
  isLastStep: boolean;
  isReadMode: boolean;
  isSaving: boolean;
  canCancelWorkout: boolean;
  canJumpToCurrentExercise: boolean;
  requiresFallbackConfirmation: boolean;
};

type UiAction =
  | "previous-exercise"
  | "next-exercise"
  | "finish-workout"
  | "cancel-workout"
  | "jump-to-current-exercise";

class PbWorkoutNavigationElement extends HTMLElement {
  #state: WorkoutNavigationState | null = null;
  #shadow = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.#render();
    this.#shadow.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.#shadow.removeEventListener("click", this.#onClick);
  }

  set state(value: WorkoutNavigationState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): WorkoutNavigationState | null {
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
    if (!actionElement || !this.#shadow.contains(actionElement)) {
      return;
    }

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    this.#emitUiAction(action);
  };

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.#shadow.innerHTML = "";
      return;
    }

    const controlsDisabled = state.isSaving ? "disabled" : "";
    const previousExerciseDisabled = state.isFirstStep || state.isSaving ? "disabled" : "";
    const jumpToCurrentExerciseDisabled =
      state.isSaving || !state.canJumpToCurrentExercise ? "disabled" : "";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      ${
        state.isReadMode
          ? `
            <div class="step-actions-read-primary">
              <button
                type="button"
                class="nav-button nav-button-primary action-button action-button-primary"
                data-ui-action="jump-to-current-exercise"
                ${jumpToCurrentExerciseDisabled}
              >
                Jump to Current Exercise
              </button>
            </div>
          `
          : ""
      }

      <div class="step-actions">
        <div class="step-actions-secondary">
          <button
            type="button"
            class="nav-button nav-button-secondary action-button action-button-secondary"
            data-ui-action="previous-exercise"
            ${previousExerciseDisabled}
          >
            Previous
          </button>

          ${
            state.isLastStep
              ? `
                <button
                  type="button"
                  class="nav-button nav-button-secondary action-button action-button-secondary"
                  data-ui-action="finish-workout"
                  ${controlsDisabled}
                >
                  ${state.isSaving ? "Saving..." : "Finish Workout"}
                </button>
              `
              : !state.requiresFallbackConfirmation
                ? `
                  <button
                    type="button"
                    class="nav-button nav-button-secondary action-button action-button-secondary"
                    data-ui-action="next-exercise"
                    ${controlsDisabled}
                  >
                    ${state.isSaving ? "Saving..." : "Next"}
                  </button>
                `
                : ""
          }
        </div>
      </div>

      ${
        state.canCancelWorkout && !state.isReadMode
          ? `
            <div class="step-actions-tertiary">
              <button
                type="button"
                class="nav-button nav-button-tertiary action-button action-button-tertiary cancel-button"
                data-ui-action="cancel-workout"
              >
                Cancel Workout
              </button>
            </div>
          `
          : ""
      }
    `;
  }
}

export const registerPbWorkoutNavigation = (): void => {
  if (!customElements.get(pbWorkoutNavigationTag)) {
    customElements.define(pbWorkoutNavigationTag, PbWorkoutNavigationElement);
  }
};
