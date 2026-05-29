export const pbGymDetailScreenTag = "pb-gym-detail-screen";

export type GymDetailScreenState = {
  gymId: string;
  gymName: string | null;
};

type UiAction = "navigate-gyms";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

class PbGymDetailScreenElement extends HTMLElement {
  #state: GymDetailScreenState = {
    gymId: "",
    gymName: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: GymDetailScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): GymDetailScreenState {
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
    const gymTitle = this.#state.gymName?.trim() || "Gym";
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <section
          class="screen-panel start-screen"
          aria-label="Gym detail screen"
          data-gym-id="${escapeAttribute(this.#state.gymId)}"
        >
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <button
            type="button"
            class="workout-detail-back-button"
            data-ui-action="navigate-gyms"
            aria-label="Back to gyms"
          >
            Back
          </button>
          <h2 class="settings-title">${escapeHtml(gymTitle)}</h2>
        </section>
      </div>
    `;
  }
}

export const registerPbGymDetailScreen = (): void => {
  if (!customElements.get(pbGymDetailScreenTag)) {
    customElements.define(pbGymDetailScreenTag, PbGymDetailScreenElement);
  }
};
