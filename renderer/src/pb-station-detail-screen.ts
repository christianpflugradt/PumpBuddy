export const pbStationDetailScreenTag = "pb-station-detail-screen";

export type StationDetailScreenState = {
  gymId: string;
  stationId: string;
  stationName: string | null;
};

type UiAction = "navigate-back-from-station-detail";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

class PbStationDetailScreenElement extends HTMLElement {
  #state: StationDetailScreenState = {
    gymId: "",
    stationId: "",
    stationName: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: StationDetailScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): StationDetailScreenState {
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
    const stationTitle = this.#state.stationName?.trim() || "Station";
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-back-from-station-detail"
          aria-label="Back to gym detail"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section
          class="screen-panel start-screen workout-detail-screen"
          aria-label="Station detail screen"
          data-gym-id="${escapeAttribute(this.#state.gymId)}"
          data-station-id="${escapeAttribute(this.#state.stationId)}"
        >
          <header class="exercise-variant-detail-header">
            <h2 class="exercise-variant-detail-header-title">${escapeHtml(stationTitle)}</h2>
          </header>
        </section>
      </div>
    `;
  }
}

export const registerPbStationDetailScreen = (): void => {
  if (!customElements.get(pbStationDetailScreenTag)) {
    customElements.define(pbStationDetailScreenTag, PbStationDetailScreenElement);
  }
};
