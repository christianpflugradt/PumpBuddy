import "./pb-side-menu";
import "./pb-create-button";
import type { GymSummary } from "./workout-contract";

export const pbConfiguratorGymsScreenTag = "pb-configurator-gyms-screen";

export type ConfiguratorGymsScreenState = {
  mode: "list" | "detail" | "create";
  gyms: GymSummary[];
  selectedGym: GymSummary | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "start-configurator-gym-create"
  | "open-configurator-gym-detail"
  | "navigate-back-from-configurator-gym-detail";

const statusLabelByValue: Record<NonNullable<GymSummary["status"]>, string> = {
  new: "Draft",
  active: "Active",
  inactive: "Inactive",
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

class PbConfiguratorGymsScreenElement extends HTMLElement {
  #state: ConfiguratorGymsScreenState = {
    mode: "list",
    gyms: [],
    selectedGym: null,
    isLoading: false,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: ConfiguratorGymsScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): ConfiguratorGymsScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction, payload?: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent("pb-ui-action", {
      bubbles: true,
      composed: true,
      detail: payload ? { action, payload } : { action },
    }));
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) return;
    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) return;
    if (action === "open-configurator-gym-detail") {
      const gymId = actionElement.dataset.gymId?.trim() ?? "";
      if (gymId) this.#emitUiAction(action, { gymId });
      return;
    }
    this.#emitUiAction(action);
  };

  #renderListBody(): string {
    if (this.#state.isLoading) return '<p class="start-status" role="status">Loading gyms...</p>';
    if (this.#state.errorMessage) return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    if (this.#state.gyms.length === 0) return '<p class="start-copy">No gyms available yet.</p>';

    return `<div class="configurator-gym-list" aria-label="Gyms">
      ${this.#state.gyms.map((gym) => {
        const status = gym.status ?? "active";
        return `<button type="button" class="configurator-gym-card configurator-gym-card--${escapeAttribute(status)}" data-ui-action="open-configurator-gym-detail" data-gym-id="${escapeAttribute(gym.id)}" aria-label="Open ${escapeAttribute(gym.name)} gym">
          <span class="configurator-gym-card-topline">
            <span class="configurator-gym-name">${escapeHtml(gym.name)}</span>
            <span class="configurator-gym-status configurator-gym-status--${escapeAttribute(status)}">${statusLabelByValue[status]}</span>
          </span>
        </button>`;
      }).join("")}
    </div>`;
  }

  #renderDestination(): string {
    const isCreate = this.#state.mode === "create";
    const gym = this.#state.selectedGym;
    return `<section class="configurator-placeholder-card" aria-label="${escapeAttribute(isCreate ? "New gym" : gym?.name ?? "Gym detail")}">
      <p class="configurator-placeholder-eyebrow">${isCreate ? "Draft Flow" : escapeHtml(statusLabelByValue[gym?.status ?? "active"])}</p>
      <p class="configurator-placeholder-title">${escapeHtml(isCreate ? "New Gym" : gym?.name ?? "Gym")}</p>
      <p class="configurator-placeholder-copy">This route is ready for the dedicated Gym editor. It keeps users inside configurator mode while write controls are built.</p>
    </section>`;
  }

  #render(): void {
    const isList = this.#state.mode === "list";
    const title = isList ? "Gyms" : this.#state.mode === "create" ? "New Gym" : this.#state.selectedGym?.name ?? "Gym";
    this.innerHTML = `<div class="app-screen-shell">
      <pb-side-menu mode="configurator" active-screen="configurator-gyms" menu-id="configurator-gyms-side-menu"></pb-side-menu>
      <section class="screen-panel configurator-gyms-screen" aria-label="Configurator gyms screen">
        <header class="app-header configurator-app-header"><img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" /><h1 class="app-title">${escapeHtml(title)}</h1><p class="start-copy">${isList ? "Manage your available training locations." : "Stay in configurator mode while opening Gym destinations."}</p></header>
        ${isList ? '<pb-create-button action="start-configurator-gym-create" label="New Gym"></pb-create-button>' : '<button type="button" class="configurator-gym-back-button" data-ui-action="navigate-back-from-configurator-gym-detail">‹ Back to Gyms</button>'}
        ${isList ? this.#renderListBody() : this.#renderDestination()}
      </section>
    </div>`;
  }
}

export const registerPbConfiguratorGymsScreen = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorGymsScreenTag)) {
    customElements.define(pbConfiguratorGymsScreenTag, PbConfiguratorGymsScreenElement);
  }
};

registerPbConfiguratorGymsScreen();
