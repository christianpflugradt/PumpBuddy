import type {
  GymDetailResponse,
  GymExerciseGroup,
  GymExerciseVariantSummary,
  GymStationOption,
  GymStationSummary,
} from "./workout-contract";
import type { GymDetailActiveSheet, GymStationChooserState } from "./workout-types";

export const pbGymDetailScreenTag = "pb-gym-detail-screen";

export type GymDetailScreenState = {
  gymId: string;
  detail: GymDetailResponse | null;
  activeSheet: GymDetailActiveSheet;
  isLoading: boolean;
  errorMessage: string | null;
  stationChooser: GymStationChooserState;
};

type UiAction =
  | "navigate-gyms"
  | "switch-gym-detail-sheet"
  | "open-station-detail"
  | "open-gym-variant"
  | "choose-gym-variant-station"
  | "dismiss-gym-station-chooser";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(count)))} ${
    Math.floor(count) === 1 ? singular : plural
  }`;

const renderVariantLinkIcon = (): string => `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2.75 3.5h6.5v1.5h-5v7h7v-5h1.5v6.5h-10z" fill="currentColor"></path>
    <path d="M8 2.25h5.75V8h-1.5V4.81L7.78 9.28l-1.06-1.06 4.47-4.47H8z" fill="currentColor"></path>
  </svg>
`;

const sortedStations = (stations: GymStationSummary[]): GymStationSummary[] =>
  [...stations].sort((left, right) => left.name.localeCompare(right.name));

const sortedGroups = (groups: GymExerciseGroup[]): GymExerciseGroup[] =>
  [...groups]
    .map((group) => ({
      ...group,
      variants: [...group.variants].sort((left, right) => left.variant_name.localeCompare(right.variant_name)),
    }))
    .sort((left, right) => left.exercise_name.localeCompare(right.exercise_name));

const sortedStationOptions = (stationOptions: GymStationOption[]): GymStationOption[] =>
  [...stationOptions].sort((left, right) => left.station_name.localeCompare(right.station_name));

const formatVariantStationMeta = (variant: GymExerciseVariantSummary): string => {
  const stationCount = variant.station_options?.length ?? 0;
  if (stationCount === 0 || variant.station_availability === "STATIONLESS") {
    return "Stationless";
  }

  return pluralize(stationCount, "station");
};

const renderSheetButton = (
  sheet: GymDetailActiveSheet,
  activeSheet: GymDetailActiveSheet,
  label: string,
): string => `
  <button
    type="button"
    class="gym-detail-sheet-tab${activeSheet === sheet ? " gym-detail-sheet-tab--active" : ""}"
    data-ui-action="switch-gym-detail-sheet"
    data-sheet="${sheet}"
    aria-pressed="${activeSheet === sheet ? "true" : "false"}"
  >
    ${escapeHtml(label)}
  </button>
`;

class PbGymDetailScreenElement extends HTMLElement {
  #state: GymDetailScreenState = {
    gymId: "",
    detail: null,
    activeSheet: "stations",
    isLoading: false,
    errorMessage: null,
    stationChooser: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
  }

  set state(value: GymDetailScreenState) {
    this.#state = value;
    this.#render();
    this.#syncOutsideClickListener();
  }

  get state(): GymDetailScreenState {
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

  #syncOutsideClickListener(): void {
    if (this.#state.stationChooser && this.isConnected) {
      window.addEventListener("pointerdown", this.#onGlobalPointerDown, true);
      return;
    }

    window.removeEventListener("pointerdown", this.#onGlobalPointerDown, true);
  }

  #onGlobalPointerDown = (event: Event): void => {
    if (!this.#state.stationChooser) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(".gym-station-chooser") || target.closest('[data-ui-action="open-gym-variant"]')) {
      return;
    }

    this.#emitUiAction("dismiss-gym-station-chooser");
  };

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

    if (action === "switch-gym-detail-sheet") {
      const sheet = actionElement.dataset.sheet;
      if (sheet !== "stations" && sheet !== "exercises") {
        return;
      }
      this.#emitUiAction(action, { sheet });
      return;
    }

    if (action === "open-station-detail" || action === "choose-gym-variant-station") {
      const stationId = actionElement.dataset.stationId?.trim() ?? "";
      if (stationId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { stationId });
      return;
    }

    if (action === "open-gym-variant") {
      const variantId = actionElement.dataset.variantId?.trim() ?? "";
      if (variantId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { variantId });
      return;
    }

    this.#emitUiAction(action);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.#state.stationChooser) {
      return;
    }

    event.preventDefault();
    this.#emitUiAction("dismiss-gym-station-chooser");
  };

  #renderStatus(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading gym detail...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    return "";
  }

  #renderStations(detail: GymDetailResponse): string {
    const stations = sortedStations(detail.stations);
    if (stations.length === 0) {
      return `<p class="start-copy">No stations available yet.</p>`;
    }

    return `
      <ul class="history-workout-list gym-detail-station-list" aria-label="Stations">
        ${stations
          .map(
            (station) => `
              <li>
                <button
                  type="button"
                  class="history-workout-row gym-detail-station-row"
                  data-ui-action="open-station-detail"
                  data-station-id="${escapeAttribute(station.id)}"
                  aria-label="Open ${escapeAttribute(station.name)} station detail"
                >
                  <span class="history-workout-row-body">
                    <span class="history-workout-row-title">${escapeHtml(station.name)}</span>
                    <span class="history-workout-row-meta">
                      ${escapeHtml(station.load_profile_name)} · ${escapeHtml(pluralize(station.suitable_variant_count, "variant"))}
                    </span>
                  </span>
                  <span class="history-workout-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            `,
          )
          .join("")}
      </ul>
    `;
  }

  #renderChooser(variant: GymExerciseVariantSummary): string {
    const chooser = this.#state.stationChooser;
    if (!chooser || chooser.variantId !== variant.variant_id) {
      return "";
    }

    return `
      <div class="gym-station-chooser" role="dialog" aria-label="Choose station">
        <p class="gym-station-chooser-title">${escapeHtml(chooser.variantName)}</p>
        <div class="gym-station-chooser-actions">
          ${sortedStationOptions(chooser.stationOptions)
            .map(
              (option) => `
                <button
                  type="button"
                  class="nav-button nav-button-secondary gym-station-chooser-option"
                  data-ui-action="choose-gym-variant-station"
                  data-station-id="${escapeAttribute(option.station_id)}"
                >
                  ${escapeHtml(option.station_name)}
                </button>
              `,
            )
            .join("")}
        </div>
        <button
          type="button"
          class="nav-button gym-station-chooser-dismiss"
          data-ui-action="dismiss-gym-station-chooser"
        >
          Dismiss
        </button>
      </div>
    `;
  }

  #renderExercises(detail: GymDetailResponse): string {
    const groups = sortedGroups(detail.exercise_groups);
    if (groups.length === 0) {
      return `<p class="start-copy">No exercises available yet.</p>`;
    }

    return `
      <div class="gym-detail-exercise-groups" aria-label="Exercises">
        ${groups
          .map(
            (group) => `
              <section class="workout-detail-exercise-section gym-detail-exercise-group" aria-label="${escapeAttribute(group.exercise_name)}">
                <div class="workout-detail-exercise-header">
                  <h4 class="workout-detail-exercise-name">${escapeHtml(group.exercise_name)}</h4>
                  <p class="workout-detail-exercise-position">${escapeHtml(pluralize(group.variants.length, "variant"))}</p>
                </div>
                <ul class="gym-detail-variant-list">
                  ${group.variants
                    .map(
                      (variant) => `
                        <li class="gym-detail-variant-item">
                          <button
                            type="button"
                            class="workout-detail-exercise-subtitle workout-detail-exercise-subtitle-link-target gym-detail-variant-row"
                            data-ui-action="open-gym-variant"
                            data-variant-id="${escapeAttribute(variant.variant_id)}"
                            aria-label="Open ${escapeAttribute(variant.variant_name)}"
                          >
                            <span class="gym-detail-variant-main">
                              <span class="workout-detail-exercise-subtitle-text gym-detail-variant-title">${escapeHtml(variant.variant_name)}</span>
                              <span class="gym-detail-variant-meta">${escapeHtml(formatVariantStationMeta(variant))}</span>
                            </span>
                            <span class="workout-detail-exercise-subtitle-link-icon">${renderVariantLinkIcon()}</span>
                          </button>
                          ${this.#renderChooser(variant)}
                        </li>
                      `,
                    )
                    .join("")}
                </ul>
              </section>
            `,
          )
          .join("")}
      </div>
    `;
  }

  #renderSheet(): string {
    const detail = this.#state.detail;
    if (!detail) {
      return "";
    }

    return `
      <section class="gym-detail-sheet" aria-label="${this.#state.activeSheet === "stations" ? "Stations" : "Exercises"}">
        ${this.#state.activeSheet === "stations" ? this.#renderStations(detail) : this.#renderExercises(detail)}
      </section>
    `;
  }

  #render(): void {
    const detail = this.#state.detail;
    const gymTitle = detail?.name.trim() || "Gym";
    const stationCount = detail ? pluralize(detail.station_count, "station") : "";
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-gyms"
          aria-label="Back to gyms"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section
          class="screen-panel start-screen workout-detail-screen gym-detail-screen"
          aria-label="Gym detail screen"
          data-gym-id="${escapeAttribute(this.#state.gymId)}"
        >
          <header class="exercise-variant-detail-header gym-detail-header">
            <h2 class="exercise-variant-detail-header-title">${escapeHtml(gymTitle)}</h2>
            ${stationCount ? `<p class="exercise-variant-detail-header-subtitle">${escapeHtml(stationCount)}</p>` : ""}
          </header>
          <div class="gym-detail-sheet-tabs" role="group" aria-label="Gym detail sheets">
            ${renderSheetButton("stations", this.#state.activeSheet, "Stations")}
            ${renderSheetButton("exercises", this.#state.activeSheet, "Exercises")}
          </div>
          ${this.#renderSheet()}
          ${this.#renderStatus()}
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
