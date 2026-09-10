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

const inventoryRows = (
  counts: ConfiguratorOverviewScreenState["counts"],
): Array<[string, number]> => [
  ["Load Profiles", counts.loadProfiles],
  ["Gyms", counts.gyms],
  ["Stations", counts.stations],
  ["Exercises", counts.exercises],
  ["Exercise Variants", counts.exerciseVariants],
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
  }

  #render(): void {
    const { counts, isLoading, errorMessage } = this.#state;
    const status = errorMessage
      ? `<p class="start-error" role="alert">${errorMessage}</p>`
      : isLoading
        ? '<p class="start-status" role="status">Loading configurator overview...</p>'
        : "";
    const rows = inventoryRows(counts)
      .map(([label, count]) => `<div class="configurator-overview-row"><dt>${label}</dt><dd>${count}</dd></div>`)
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
        <dl class="configurator-overview-list" aria-label="Configurator inventory">${rows}</dl>
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
