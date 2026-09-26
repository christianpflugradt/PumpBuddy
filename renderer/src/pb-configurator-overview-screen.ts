import {
  configuratorNavigationEntries,
  type ConfiguratorNavigationAction,
} from "./pb-side-menu";
import "./pb-configurator-header";

export const pbConfiguratorOverviewScreenTag = "pb-configurator-overview-screen";

export type ConfiguratorOverviewScreenState = {
  counts: {
    loadProfiles: number;
    gyms: number;
    stations: number;
    exercises: number;
    exerciseVariants: number;
    trainingPlans: number;
  };
  isLoading: boolean;
  errorMessage: string | null;
};

const inventoryRows = (
  counts: ConfiguratorOverviewScreenState["counts"],
): Array<{ label: string; count: number; action: ConfiguratorNavigationAction }> =>
  configuratorNavigationEntries.flatMap(({ screen, label, action }) => {
    switch (screen) {
      case "configurator-load-profiles":
        return [{ label, count: counts.loadProfiles, action }];
      case "configurator-exercises":
        return [
          { label, count: counts.exercises, action },
          { label: "Exercise Variants", count: counts.exerciseVariants, action },
        ];
      case "configurator-training-plans":
        return [{ label, count: counts.trainingPlans, action }];
      case "configurator-gyms":
        return [
          { label, count: counts.gyms, action },
          { label: "Stations", count: counts.stations, action },
        ];
    }
  });

class PbConfiguratorOverviewScreenElement extends HTMLElement {
  #state: ConfiguratorOverviewScreenState = {
    counts: { loadProfiles: 0, gyms: 0, stations: 0, exercises: 0, exerciseVariants: 0, trainingPlans: 0 },
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
        <pb-configurator-header title="Configurator" context="Manage the building blocks of your workout setup." banner></pb-configurator-header>
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
