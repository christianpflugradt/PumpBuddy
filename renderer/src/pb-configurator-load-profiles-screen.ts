import "./pb-side-menu";

export const pbConfiguratorLoadProfilesScreenTag =
  "pb-configurator-load-profiles-screen";

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "navigate-workout"
  | "navigate-configurator-load-profiles"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

class PbConfiguratorLoadProfilesScreenElement extends HTMLElement {
  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
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
      <div class="app-screen-shell">
        <pb-side-menu
          mode="configurator"
          active-screen="configurator-load-profiles"
          menu-id="configurator-load-profiles-side-menu"
        ></pb-side-menu>
        <section
          class="screen-panel configurator-load-profiles-screen"
          aria-label="Configurator load profiles screen"
        >
          <header class="app-header app-header-compact">
            <p class="app-kicker">Configurator</p>
            <h1 class="app-title">Load Profiles</h1>
            <p class="start-copy">
              Manage workout load presets here. This first slice wires the configurator shell and
              keeps the destination ready for the upcoming list view.
            </p>
          </header>
          <section class="configurator-placeholder-card" aria-label="Load profiles placeholder">
            <p class="configurator-placeholder-eyebrow">Next Up</p>
            <p class="configurator-placeholder-title">Load profile list will render in this panel.</p>
            <p class="configurator-placeholder-copy">
              Upcoming items will populate cards, filters, and detail entry from this starting
              point.
            </p>
          </section>
        </section>
      </div>
    `;
  }
}

export const registerPbConfiguratorLoadProfilesScreen = (): void => {
  if (
    typeof customElements !== "undefined" &&
    !customElements.get(pbConfiguratorLoadProfilesScreenTag)
  ) {
    customElements.define(
      pbConfiguratorLoadProfilesScreenTag,
      PbConfiguratorLoadProfilesScreenElement,
    );
  }
};

registerPbConfiguratorLoadProfilesScreen();
