import "./pb-side-menu";
import "./pb-create-button";
import type { LoadProfileSummary } from "./workout-contract";

export const pbConfiguratorLoadProfilesScreenTag =
  "pb-configurator-load-profiles-screen";

export type ConfiguratorLoadProfilesScreenState = {
  mode: "list" | "detail" | "create";
  loadProfiles: LoadProfileSummary[];
  selectedLoadProfile: LoadProfileSummary | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "navigate-workout"
  | "navigate-configurator-load-profiles"
  | "start-configurator-load-profile-create"
  | "open-configurator-load-profile-detail"
  | "navigate-back-from-configurator-load-profile-detail"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

const statusLabelByValue: Record<LoadProfileSummary["status"], string> = {
  new: "Draft",
  active: "Active",
  inactive: "Inactive",
};

const definitionLabelByValue: Record<
  LoadProfileSummary["definition_kind"],
  string
> = {
  fixed_list: "Fixed list",
  formula: "Formula",
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string =>
  escapeHtml(value).replaceAll("`", "&#96;");

const pluralize = (
  count: number,
  singular: string,
  plural = `${singular}s`,
): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.floor(count)),
  )} ${Math.floor(count) === 1 ? singular : plural}`;

class PbConfiguratorLoadProfilesScreenElement extends HTMLElement {
  #state: ConfiguratorLoadProfilesScreenState = {
    mode: "list",
    loadProfiles: [],
    selectedLoadProfile: null,
    isLoading: false,
    errorMessage: null,
  };
  #searchQuery = "";

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("input", this.#onInput);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("input", this.#onInput);
  }

  set state(value: ConfiguratorLoadProfilesScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): ConfiguratorLoadProfilesScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction, payload?: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: payload ? { action, payload } : { action },
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

    if (action === "open-configurator-load-profile-detail") {
      const loadProfileId = actionElement.dataset.loadProfileId?.trim() ?? "";
      if (loadProfileId.length === 0) {
        return;
      }

      this.#emitUiAction(action, { loadProfileId });
      return;
    }

    this.#emitUiAction(action);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      target.dataset.role !== "load-profile-search"
    ) {
      return;
    }

    this.#searchQuery = target.value;
    this.#render();

    const searchInput = this.querySelector<HTMLInputElement>(
      '[data-role="load-profile-search"]',
    );
    searchInput?.focus();
    searchInput?.setSelectionRange(this.#searchQuery.length, this.#searchQuery.length);
  };

  #renderListBody(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading load profiles...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (this.#state.loadProfiles.length === 0) {
      return `<p class="start-copy">No load profiles available yet.</p>`;
    }

    const normalizedSearchQuery = this.#searchQuery.trim().toLocaleLowerCase();
    const visibleLoadProfiles = this.#state.loadProfiles.filter((loadProfile) =>
      loadProfile.name.toLocaleLowerCase().includes(normalizedSearchQuery),
    );

    if (visibleLoadProfiles.length === 0) {
      return `<p class="start-copy" role="status">No load profiles match your search.</p>`;
    }

    return `
      <div class="configurator-load-profile-list" aria-label="Load profiles">
        ${visibleLoadProfiles
          .map((loadProfile) => {
            const usageSummary =
              loadProfile.station_count > 0
                ? pluralize(loadProfile.station_count, "station")
                : "Not used";
            const metadataSummary = `${definitionLabelByValue[loadProfile.definition_kind]} · ${loadProfile.weight_unit} · ${usageSummary}`;

            return `
              <button
                type="button"
                class="configurator-load-profile-card"
                data-ui-action="open-configurator-load-profile-detail"
                data-load-profile-id="${escapeAttribute(loadProfile.id)}"
                aria-label="Open ${escapeAttribute(loadProfile.name)} load profile"
              >
                <span class="configurator-load-profile-card-topline">
                  <span class="configurator-load-profile-name">${escapeHtml(loadProfile.name)}</span>
                  <span class="configurator-load-profile-status configurator-load-profile-status--${escapeAttribute(loadProfile.status)}">${escapeHtml(statusLabelByValue[loadProfile.status])}</span>
                </span>
                <span class="configurator-load-profile-card-metadata">
                  ${escapeHtml(metadataSummary)}
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  #renderDetailBody(): string {
    if (this.#state.mode === "create") {
      return `
        <section class="configurator-placeholder-card" aria-label="New load profile">
          <p class="configurator-placeholder-eyebrow">Draft Flow</p>
          <p class="configurator-placeholder-title">New load profile</p>
          <p class="configurator-placeholder-copy">
            This route is ready for the dedicated draft editor. It keeps users inside configurator
            mode while the upcoming detail form is built.
          </p>
        </section>
      `;
    }

    const loadProfile = this.#state.selectedLoadProfile;
    if (!loadProfile) {
      return `
        <p class="start-error" role="alert">
          Unable to find that load profile right now.
        </p>
      `;
    }

    return `
      <section class="configurator-placeholder-card" aria-label="${escapeAttribute(loadProfile.name)} load profile detail">
        <p class="configurator-placeholder-eyebrow">${escapeHtml(statusLabelByValue[loadProfile.status])}</p>
        <p class="configurator-placeholder-title">${escapeHtml(loadProfile.name)}</p>
        <p class="configurator-placeholder-copy">
          ${escapeHtml(definitionLabelByValue[loadProfile.definition_kind])} in ${escapeHtml(loadProfile.weight_unit)} · Used by ${escapeHtml(pluralize(loadProfile.station_count, "station"))}
        </p>
        <p class="configurator-placeholder-copy">
          This route is the dedicated detail destination for existing profiles. Editing behavior
          will land in a follow-up item.
        </p>
      </section>
    `;
  }

  #render(): void {
    const isList = this.#state.mode === "list";
    const title =
      this.#state.mode === "create"
        ? "New Load Profile"
        : this.#state.mode === "detail"
          ? this.#state.selectedLoadProfile?.name ?? "Load Profile"
          : "Load Profiles";

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
          <header class="app-header configurator-app-header">
            <img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" />
            <h1 class="app-title">${escapeHtml(title)}</h1>
            <p class="start-copy">
              ${
                isList
                  ? "Define the available weight options for your gym equipment."
                  : "Stay in configurator mode while opening draft creation and existing profile detail destinations."
              }
            </p>
          </header>
          ${
            isList
              ? `
                <pb-create-button action="start-configurator-load-profile-create" label="New Load Profile"></pb-create-button>
                <label class="configurator-load-profile-search" aria-label="Search load profiles">
                  <input
                    type="search"
                    data-role="load-profile-search"
                    value="${escapeAttribute(this.#searchQuery)}"
                    placeholder="Search profiles..."
                    autocomplete="off"
                  />
                </label>
              `
              : `
                <button
                  type="button"
                  class="configurator-load-profile-back-button"
                  data-ui-action="navigate-back-from-configurator-load-profile-detail"
                >
                  ‹ Back to Load Profiles
                </button>
              `
          }
          ${isList ? this.#renderListBody() : this.#renderDetailBody()}
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
