import { formatLoadWithUnitDisplay } from "./workout-load-display";
import type {
  GymStationDetailResponse,
  GymStationExerciseGroup,
  GymStationExerciseVariantSummary,
} from "./workout-contract";

export const pbStationDetailScreenTag = "pb-station-detail-screen";

export type StationDetailScreenState = {
  gymId: string;
  stationId: string;
  stationName: string | null;
  detail: GymStationDetailResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  loadProfilePopupOpen: boolean;
  backLabel?: string;
};

type UiAction =
  | "navigate-back-from-station-detail"
  | "open-station-load-profile"
  | "dismiss-station-load-profile"
  | "open-station-variant-detail";

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

const formatRepetitionKind = (variant: GymStationExerciseVariantSummary): string =>
  variant.repetition_kind === "SECS" ? "Timed" : "Reps";

const formatLoadMode = (variant: GymStationExerciseVariantSummary): string =>
  variant.load_input_mode === "PER_SIDE" ? "Per-side load" : "Total load";

const formatTrackingMode = (variant: GymStationExerciseVariantSummary): string =>
  variant.set_tracking_mode === "UNILATERAL" ? "Unilateral" : "Bilateral";

const renderVariantLinkIcon = (): string => `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2.75 3.5h6.5v1.5h-5v7h7v-5h1.5v6.5h-10z" fill="currentColor"></path>
    <path d="M8 2.25h5.75V8h-1.5V4.81L7.78 9.28l-1.06-1.06 4.47-4.47H8z" fill="currentColor"></path>
  </svg>
`;

const renderInspectLoadsIcon = (): string => `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M7.1 2.25a4.85 4.85 0 1 0 3.03 8.63l2.74 2.75 1.06-1.06-2.75-2.74A4.85 4.85 0 0 0 7.1 2.25Zm0 1.5a3.35 3.35 0 1 1 0 6.7 3.35 3.35 0 0 1 0-6.7Z"
      fill="currentColor"
    ></path>
  </svg>
`;

const compareByNameThenId = (
  leftName: string,
  leftId: string,
  rightName: string,
  rightId: string,
): number => {
  const nameComparison = leftName.localeCompare(rightName);
  return nameComparison === 0 ? leftId.localeCompare(rightId) : nameComparison;
};

const sortedVariantGroups = (groups: GymStationExerciseGroup[]): GymStationExerciseGroup[] =>
  [...groups]
    .map((group) => ({
      ...group,
      variants: [...group.variants].sort((left, right) =>
        compareByNameThenId(left.variant_name, left.variant_id, right.variant_name, right.variant_id),
      ),
    }))
    .sort((left, right) =>
      compareByNameThenId(left.exercise_name, left.exercise_id, right.exercise_name, right.exercise_id),
    );

const formatLoadRange = (loads: number[]): string => {
  if (loads.length === 0) {
    return "No loads provided";
  }

  const sortedLoads = [...loads].sort((left, right) => left - right);
  const first = sortedLoads[0]!;
  const last = sortedLoads[sortedLoads.length - 1]!;
  if (first === last) {
    return formatLoadWithUnitDisplay(first);
  }

  return `${formatLoadWithUnitDisplay(first)} - ${formatLoadWithUnitDisplay(last)}`;
};

class PbStationDetailScreenElement extends HTMLElement {
  #state: StationDetailScreenState = {
    gymId: "",
    stationId: "",
    stationName: null,
    detail: null,
    isLoading: false,
    errorMessage: null,
    loadProfilePopupOpen: false,
    backLabel: undefined,
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

    if (action === "open-station-variant-detail") {
      const variantId = actionElement.dataset.variantId?.trim() ?? "";
      if (variantId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { variantId });
      return;
    }

    this.#emitUiAction(action);
  };

  #renderStatus(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading station detail...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (!this.#state.detail) {
      return `<p class="start-status" role="status">Station detail unavailable.</p>`;
    }

    return "";
  }

  #renderLoadProfile(detail: GymStationDetailResponse): string {
    const profile = detail.load_profile;
    const possibleLoads = profile.possible_loads_kg;
    const hasPossibleLoads = possibleLoads.length > 0;

    return `
      <section class="station-detail-section station-load-profile-card" aria-label="Load profile">
        <dl class="station-load-profile-summary">
          <div>
            <dt>Name</dt>
            <dd>${escapeHtml(profile.name)}</dd>
          </div>
          <div>
            <dt>Number of loads</dt>
            <dd>${escapeHtml(String(possibleLoads.length))}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd class="station-load-profile-range">
              <span class="station-load-profile-range-text">${escapeHtml(formatLoadRange(possibleLoads))}</span>
              <button
                type="button"
                class="station-load-profile-inspect-button"
                data-ui-action="open-station-load-profile"
                aria-label="Inspect station loads"
                ${hasPossibleLoads ? "" : "disabled"}
              >
                <span class="station-load-profile-inspect-icon">${renderInspectLoadsIcon()}</span>
              </button>
            </dd>
          </div>
        </dl>
      </section>
    `;
  }

  #renderVariantGroups(detail: GymStationDetailResponse): string {
    const groups = sortedVariantGroups(detail.suitable_variant_groups);
    if (groups.length === 0) {
      return `
        <section class="station-detail-section station-detail-variants" aria-labelledby="station-detail-variants-title">
          <h3 id="station-detail-variants-title" class="station-detail-section-title">Suitable variants</h3>
          <p class="start-status" role="status">No suitable variants are linked to this station.</p>
        </section>
      `;
    }

    return `
      <section class="station-detail-section station-detail-variants" aria-labelledby="station-detail-variants-title">
        <div class="station-detail-section-header">
          <div>
            <h3 id="station-detail-variants-title" class="station-detail-section-title">Suitable variants</h3>
            <p class="station-detail-section-subtitle">${escapeHtml(pluralize(groups.length, "exercise group"))}</p>
          </div>
        </div>
        <div class="station-detail-variant-groups">
          ${groups
            .map(
              (group, groupIndex) => `
                <section class="workout-detail-exercise-section station-detail-variant-group">
                  <div class="workout-detail-exercise-header">
                    <p class="workout-detail-exercise-position">${escapeHtml(String(groupIndex + 1))} of ${escapeHtml(String(groups.length))}</p>
                    <h4 class="workout-detail-exercise-name">${escapeHtml(group.exercise_name)}</h4>
                  </div>
                  <ol class="station-detail-variant-list">
                    ${group.variants
                      .map((variant) => {
                        const meta = `${formatRepetitionKind(variant)} / ${formatLoadMode(variant)} / ${formatTrackingMode(variant)}`;
                        return `
                          <li class="station-detail-variant-item">
                            <button
                              type="button"
                              class="workout-detail-exercise-subtitle workout-detail-exercise-subtitle-link-target station-detail-variant-link"
                              data-ui-action="open-station-variant-detail"
                              data-variant-id="${escapeAttribute(variant.variant_id)}"
                              aria-label="Open ${escapeAttribute(variant.variant_name)} details"
                            >
                              <span class="workout-detail-exercise-subtitle-text station-detail-variant-name">${escapeHtml(variant.variant_name)}</span>
                              <span class="workout-detail-exercise-subtitle-link-icon">${renderVariantLinkIcon()}</span>
                            </button>
                            <p class="station-detail-variant-meta">${escapeHtml(meta)}</p>
                          </li>
                        `;
                      })
                      .join("")}
                  </ol>
                </section>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  #renderLoadProfilePopup(detail: GymStationDetailResponse): string {
    if (!this.#state.loadProfilePopupOpen) {
      return "";
    }

    const profile = detail.load_profile;
    const loads = profile.possible_loads_kg;

    return `
      <div class="station-load-profile-dialog-layer">
        <div class="station-load-profile-dialog-backdrop" aria-hidden="true"></div>
        <section
          class="station-load-profile-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="station-load-profile-dialog-title"
        >
          <header class="station-load-profile-dialog-header">
            <div>
              <h3 id="station-load-profile-dialog-title" class="station-load-profile-dialog-title">${escapeHtml(profile.name)}</h3>
              <p class="station-load-profile-dialog-subtitle">${escapeHtml(pluralize(loads.length, "possible load"))}</p>
            </div>
            <button
              type="button"
              class="station-load-profile-dialog-close"
              data-ui-action="dismiss-station-load-profile"
              aria-label="Close load profile"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <ol class="station-load-profile-value-list" aria-label="Possible loads">
            ${loads
              .map(
                (loadValue) => `
                  <li class="station-load-profile-value">
                    <span>${escapeHtml(formatLoadWithUnitDisplay(loadValue))}</span>
                  </li>
                `,
              )
              .join("")}
          </ol>
        </section>
      </div>
    `;
  }

  #render(): void {
    const detail = this.#state.detail;
    const stationTitle = detail?.station_name?.trim() || this.#state.stationName?.trim() || "Station";
    const subtitle = detail?.gym_name?.trim() || "Station detail";
    const backLabel = this.#state.backLabel?.trim() || "Back to gym detail";

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-back-from-station-detail"
          aria-label="${escapeAttribute(backLabel)}"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section
          class="screen-panel start-screen workout-detail-screen station-detail-screen"
          aria-label="Station detail screen"
          data-gym-id="${escapeAttribute(this.#state.gymId)}"
          data-station-id="${escapeAttribute(this.#state.stationId)}"
        >
          <header class="exercise-variant-detail-header station-detail-header">
            <h2 class="exercise-variant-detail-header-title">${escapeHtml(stationTitle)}</h2>
            <p class="exercise-variant-detail-header-subtitle">${escapeHtml(subtitle)}</p>
          </header>
          ${this.#renderStatus()}
          ${detail ? this.#renderLoadProfile(detail) : ""}
          ${detail ? this.#renderVariantGroups(detail) : ""}
        </section>
        ${detail ? this.#renderLoadProfilePopup(detail) : ""}
      </div>
    `;
  }
}

export const registerPbStationDetailScreen = (): void => {
  if (!customElements.get(pbStationDetailScreenTag)) {
    customElements.define(pbStationDetailScreenTag, PbStationDetailScreenElement);
  }
};
