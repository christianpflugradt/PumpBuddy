export const pbWorkoutDetailScreenTag = "pb-workout-detail-screen";

export type WorkoutDetailScreenState = {
  workoutId: string;
};

type UiAction = "navigate-history";

class PbWorkoutDetailScreenElement extends HTMLElement {
  #state: WorkoutDetailScreenState = {
    workoutId: "",
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

  #render(): void {
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle"
          data-ui-action="navigate-history"
          aria-label="Back to history"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section class="screen-panel start-screen" aria-label="Workout detail screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <h2 class="settings-title">Workout Detail</h2>
          <p class="start-copy" data-workout-detail-id="${this.#state.workoutId}">
            Workout ID: ${this.#state.workoutId}
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
