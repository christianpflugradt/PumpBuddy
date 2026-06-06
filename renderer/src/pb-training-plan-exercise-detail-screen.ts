import type {
  GymStationOption,
  TrainingPlanExerciseDetail,
  TrainingPlanExerciseVariantDetail,
  TrainingPlanVariantAvailability,
} from "./workout-contract";
import { formatLoadWithUnitDisplay } from "./workout-load-display";

export const pbTrainingPlanExerciseDetailScreenTag = "pb-training-plan-exercise-detail-screen";

export type TrainingPlanExerciseDetailScreenState = {
  trainingPlanId: string;
  trainingPlanExerciseId: string;
  selectedGymId: string | null;
  selectedGymName: string | null;
  planName: string | null;
  exercise: TrainingPlanExerciseDetail | null;
  totalExercises: number;
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "navigate-back-from-training-plan-exercise-detail"
  | "open-training-plan-exercise-variant-detail"
  | "open-training-plan-exercise-station-detail";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const formatWholeNumber = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.floor(value)),
  );

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${formatWholeNumber(count)} ${Math.floor(count) === 1 ? singular : plural}`;

const formatOrdinal = (value: number): string => {
  const position = Math.max(1, Math.floor(value));
  const teenRemainder = position % 100;
  if (teenRemainder >= 11 && teenRemainder <= 13) {
    return `${formatWholeNumber(position)}th`;
  }

  const suffix = position % 10 === 1 ? "st" : position % 10 === 2 ? "nd" : position % 10 === 3 ? "rd" : "th";
  return `${formatWholeNumber(position)}${suffix}`;
};

const formatRepetitionKind = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.repetition_kind === "SECS" ? "Timed" : "Reps";

const formatLoadMode = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.load_input_mode === "PER_SIDE" ? "Per-side load" : "Total load";

const formatTrackingMode = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.set_tracking_mode === "UNILATERAL" ? "Unilateral" : "Bilateral";

const formatAvailability = (
  availability: TrainingPlanVariantAvailability | null,
): string => {
  if (availability === "AVAILABLE") {
    return "Available";
  }

  if (availability === "NOT_AVAILABLE") {
    return "Not available";
  }

  return "Availability unavailable";
};

const availabilityTone = (availability: TrainingPlanVariantAvailability | null): string => {
  if (availability === "AVAILABLE") {
    return "available";
  }

  if (availability === "NOT_AVAILABLE") {
    return "not-available";
  }

  return "unknown";
};

const repetitionUnit = (
  variant: TrainingPlanExerciseVariantDetail,
  count: number | null = null,
): string => {
  if (variant.repetition_kind === "SECS") {
    return "sec";
  }

  return count === 1 ? "rep" : "reps";
};

const formatTarget = (variant: TrainingPlanExerciseVariantDetail): string | null => {
  const targetParts: string[] = [];

  if (variant.target_sets !== null) {
    targetParts.push(pluralize(variant.target_sets, "set"));
  }

  const repMin = variant.rep_min;
  const repMax = variant.rep_max;
  if (repMin !== null && repMax !== null) {
    const unit = repetitionUnit(variant, repMax);
    targetParts.push(
      repMin === repMax
        ? `${formatWholeNumber(repMin)} ${unit}`
        : `${formatWholeNumber(repMin)}-${formatWholeNumber(repMax)} ${unit}`,
    );
  } else if (repMin !== null) {
    targetParts.push(`at least ${formatWholeNumber(repMin)} ${repetitionUnit(variant, repMin)}`);
  } else if (repMax !== null) {
    targetParts.push(`at most ${formatWholeNumber(repMax)} ${repetitionUnit(variant, repMax)}`);
  }

  return targetParts.length > 0 ? targetParts.join(" · ") : null;
};

const sortedStations = (stations: GymStationOption[]): GymStationOption[] =>
  [...stations].sort((left, right) => left.station_name.localeCompare(right.station_name));

const formatLoadRange = (loads: number[] | null | undefined): string | null => {
  const numericLoads = (loads ?? []).filter((load) => Number.isFinite(load));
  if (numericLoads.length === 0) {
    return null;
  }

  const sortedLoads = [...numericLoads].sort((left, right) => left - right);
  const first = sortedLoads[0]!;
  const last = sortedLoads[sortedLoads.length - 1]!;
  if (first === last) {
    return formatLoadWithUnitDisplay(first);
  }

  return `${formatLoadWithUnitDisplay(first)} - ${formatLoadWithUnitDisplay(last)}`;
};

class PbTrainingPlanExerciseDetailScreenElement extends HTMLElement {
  #state: TrainingPlanExerciseDetailScreenState = {
    trainingPlanId: "",
    trainingPlanExerciseId: "",
    selectedGymId: null,
    selectedGymName: null,
    planName: null,
    exercise: null,
    totalExercises: 0,
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

  set state(value: TrainingPlanExerciseDetailScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): TrainingPlanExerciseDetailScreenState {
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

    if (action === "open-training-plan-exercise-variant-detail") {
      const variantId = actionElement.dataset.variantId?.trim() ?? "";
      if (variantId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { variantId });
      return;
    }

    if (action === "open-training-plan-exercise-station-detail") {
      const stationId = actionElement.dataset.stationId?.trim() ?? "";
      if (stationId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { stationId });
      return;
    }

    this.#emitUiAction(action);
  };

  #renderStatus(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading exercise detail...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (!this.#state.exercise) {
      return `<p class="start-status" role="status">Training plan exercise detail unavailable.</p>`;
    }

    return "";
  }

  #renderTarget(variant: TrainingPlanExerciseVariantDetail): string {
    const target = formatTarget(variant);
    if (!target) {
      return "";
    }

    return `<p class="training-plan-exercise-detail-target">${escapeHtml(target)}</p>`;
  }

  #renderAvailability(variant: TrainingPlanExerciseVariantDetail): string {
    if (!this.#state.selectedGymId) {
      return "";
    }

    const tone = availabilityTone(variant.availability);
    return `
      <span class="training-plan-exercise-detail-availability training-plan-exercise-detail-availability--${tone}">
        ${escapeHtml(formatAvailability(variant.availability))}
      </span>
    `;
  }

  #renderStationRows(variant: TrainingPlanExerciseVariantDetail): string {
    if (!this.#state.selectedGymId || !variant.requires_station) {
      return "";
    }

    if (variant.availability === "AVAILABLE" && variant.compatible_stations.length > 0) {
      return `
        <section class="training-plan-exercise-detail-stations" aria-label="Stations">
          <p class="training-plan-exercise-detail-station-heading">Available at</p>
          <ul class="training-plan-exercise-detail-station-list" aria-label="Compatible stations">
            ${sortedStations(variant.compatible_stations)
              .map((station) => {
                const loadRange = formatLoadRange(station.station_profile_loads_kg);
                return `
                  <li>
                    <button
                      type="button"
                      class="training-plan-exercise-detail-station-row"
                      data-ui-action="open-training-plan-exercise-station-detail"
                      data-station-id="${escapeAttribute(station.station_id)}"
                    >
                      <span class="training-plan-exercise-detail-station-line">
                        <span class="training-plan-exercise-detail-station-name">${escapeHtml(station.station_name)}</span>
                        ${loadRange ? `<span class="training-plan-exercise-detail-station-separator" aria-hidden="true">·</span><span class="training-plan-exercise-detail-station-loads">${escapeHtml(loadRange)}</span>` : ""}
                      </span>
                      <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
                    </button>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </section>
      `;
    }

    if (variant.availability === "NOT_AVAILABLE" && variant.compatible_stations.length === 0) {
      return `
        <section class="training-plan-exercise-detail-stations" aria-label="Stations">
          <p class="training-plan-exercise-detail-station-status">Not available in this gym</p>
        </section>
      `;
    }

    return "";
  }

  #renderVariant(variant: TrainingPlanExerciseVariantDetail, index: number): string {
    const metadata = [
      formatRepetitionKind(variant),
      formatLoadMode(variant),
      formatTrackingMode(variant),
    ].join(" · ");

    return `
      <li>
        <article class="training-plan-exercise-detail-variant-card" data-variant-id="${escapeAttribute(variant.variant_id)}">
          <button
            type="button"
            class="training-plan-exercise-detail-variant-open"
            data-ui-action="open-training-plan-exercise-variant-detail"
            data-variant-id="${escapeAttribute(variant.variant_id)}"
            aria-label="Open ${escapeAttribute(variant.variant_name)} variant detail"
          >
            <span class="training-plan-exercise-detail-variant-copy">
              <span class="training-plan-exercise-detail-variant-kicker">
                <span class="workout-detail-exercise-position">${escapeHtml(String(index + 1))}</span>
                ${this.#renderAvailability(variant)}
              </span>
              <span class="training-plan-exercise-detail-variant-name">${escapeHtml(variant.variant_name)}</span>
            </span>
            <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
          </button>
          <p class="training-plan-exercise-detail-variant-meta">${escapeHtml(metadata)}</p>
          ${this.#renderTarget(variant)}
          ${this.#renderStationRows(variant)}
        </article>
      </li>
    `;
  }

  #renderVariants(exercise: TrainingPlanExerciseDetail): string {
    if (exercise.variants.length === 0) {
      return `<p class="start-status" role="status">No variants configured for this exercise.</p>`;
    }

    return `
      <section class="training-plan-exercise-detail-variants" aria-label="Allowed variants">
        <h3 class="training-plan-section-title">Variants in this plan</h3>
        <ol class="training-plan-exercise-detail-variant-list">
          ${exercise.variants.map((variant, index) => this.#renderVariant(variant, index)).join("")}
        </ol>
      </section>
    `;
  }

  #render(): void {
    const exercise = this.#state.exercise;
    const context = [
      this.#state.planName?.trim() || "Training Plan",
      this.#state.selectedGymId ? this.#state.selectedGymName?.trim() || "Selected gym" : null,
    ].filter((entry): entry is string => Boolean(entry && entry.length > 0));
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-back-from-training-plan-exercise-detail"
          aria-label="Back to training plan"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section class="screen-panel start-screen workout-detail-screen training-plan-exercise-detail-screen" aria-label="Exercise in plan detail screen">
          <header class="exercise-variant-detail-header training-plan-exercise-detail-header">
            <h2 class="exercise-variant-detail-header-title">${escapeHtml(exercise?.exercise_name ?? "Exercise in Plan")}</h2>
            <p class="exercise-variant-detail-header-subtitle">
              ${escapeHtml(exercise ? `${formatOrdinal(exercise.exercise_position)} Exercise in Plan` : "Exercise in Plan")}
            </p>
            ${context.length > 0 ? `<p class="training-plan-exercise-detail-context">${escapeHtml(context.join(" · "))}</p>` : ""}
          </header>
          ${this.#renderStatus()}
          ${exercise ? this.#renderVariants(exercise) : ""}
        </section>
      </div>
    `;
  }
}

export const registerPbTrainingPlanExerciseDetailScreen = (): void => {
  if (!customElements.get(pbTrainingPlanExerciseDetailScreenTag)) {
    customElements.define(
      pbTrainingPlanExerciseDetailScreenTag,
      PbTrainingPlanExerciseDetailScreenElement,
    );
  }
};
