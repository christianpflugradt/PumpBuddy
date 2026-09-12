import "./pb-side-menu";

export const pbConfiguratorOverviewScreenTag = "pb-configurator-overview-screen";

export type ConfiguratorOverviewScreenState = {
  counts: {
    loadProfiles: number;
    gyms: number;
    stations: number;
    exercises: number;
    exerciseVariants: number;
  };
  isLoading: boolean;
  errorMessage: string | null;
};

type ConfiguratorNavigationAction =
  | "navigate-configurator-load-profiles"
  | "navigate-configurator-gyms"
  | "navigate-configurator-exercises";

const inventoryRows = (
  counts: ConfiguratorOverviewScreenState["counts"],
): Array<{ label: string; count: number; action: ConfiguratorNavigationAction }> => [
  { label: "Load Profiles", count: counts.loadProfiles, action: "navigate-configurator-load-profiles" },
  { label: "Gyms", count: counts.gyms, action: "navigate-configurator-gyms" },
  { label: "Stations", count: counts.stations, action: "navigate-configurator-gyms" },
  { label: "Exercises", count: counts.exercises, action: "navigate-configurator-exercises" },
  { label: "Exercise Variants", count: counts.exerciseVariants, action: "navigate-configurator-exercises" },
];

class PbConfiguratorOverviewScreenElement extends HTMLElement {
  #state: ConfiguratorOverviewScreenState = {
    counts: { loadProfiles: 0, gyms: 0, stations: 0, exercises: 0, exerciseVariants: 0 },
    isLoading: false,
    errorMessage: null,
  };

  set state(value: ConfiguratorOverviewScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): ConfiguratorOverviewScreenState {
    return this.#state;
  }

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-configurator-navigation-toggle]")) {
      this.querySelector<HTMLButtonElement>('pb-side-menu [data-ui-action="toggle-side-menu"]')?.click();
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) return;
    const action = actionElement.dataset.uiAction as ConfiguratorNavigationAction | undefined;
    if (!action) return;
    this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action } }));
  }

  #render(): void {
    const { counts, isLoading, errorMessage } = this.#state;
    const status = errorMessage
      ? `<p class="start-error" role="alert">${errorMessage}</p>`
      : isLoading
        ? '<p class="start-status" role="status">Loading configurator overview...</p>'
        : "";
    const rows = inventoryRows(counts)
      .map(({ label, count, action }) => `<button type="button" class="configurator-overview-row" data-ui-action="${action}" aria-label="Open ${label}"><span class="configurator-overview-row-label">${label}</span><span class="configurator-overview-row-meta"><span class="configurator-overview-row-count">${count}</span><span class="configurator-overview-row-chevron" aria-hidden="true">›</span></span></button>`)
      .join("");

    this.innerHTML = `<div class="app-screen-shell">
      <pb-side-menu mode="configurator" active-screen="configurator-overview" menu-id="configurator-overview-side-menu"></pb-side-menu>
      <section class="screen-panel configurator-overview-screen" aria-label="Configurator overview">
        <header class="app-header configurator-app-header">
          <img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" />
          <h1 class="app-title">Configurator</h1>
          <p class="start-copy">Manage the building blocks of your workout setup.</p>
        </header>
        ${status}
        <div class="configurator-overview-list" aria-label="Configurator inventory">${rows}</div>
        <button type="button" class="configurator-overview-configure-button nav-button nav-button-primary action-button action-button-primary" data-configurator-navigation-toggle>Configure</button>
      </section>
    </div>`;
  }
}

export const registerPbConfiguratorOverviewScreen = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorOverviewScreenTag)) {
    customElements.define(pbConfiguratorOverviewScreenTag, PbConfiguratorOverviewScreenElement);
  }
};

registerPbConfiguratorOverviewScreen();
