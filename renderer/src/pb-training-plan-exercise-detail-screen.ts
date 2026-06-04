import type {
  GymStationOption,
  TrainingPlanExerciseDetail,
  TrainingPlanExerciseVariantDetail,
  TrainingPlanVariantAvailability,
} from "./workout-contract";

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

const formatRepetitionKind = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.repetition_kind === "SECS" ? "Timed" : "Reps";

const formatLoadMode = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.load_input_mode === "PER_SIDE" ? "Per-side load" : "Total load";

const formatTrackingMode = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.set_tracking_mode === "UNILATERAL" ? "Unilateral" : "Bilateral";

const formatStationRequirement = (variant: TrainingPlanExerciseVariantDetail): string =>
  variant.requires_station ? "Requires station" : "Stationless";

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
    targetParts.push(`At least ${formatWholeNumber(repMin)} ${repetitionUnit(variant, repMin)}`);
  } else if (repMax !== null) {
    targetParts.push(`Up to ${formatWholeNumber(repMax)} ${repetitionUnit(variant, repMax)}`);
  }

  return targetParts.length > 0 ? targetParts.join(" / ") : null;
};

const sortedStations = (stations: GymStationOption[]): GymStationOption[] =>
  [...stations].sort((left, right) => left.station_name.localeCompare(right.station_name));

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

  #renderOverview(exercise: TrainingPlanExerciseDetail): string {
    const totalExercises = Math.max(this.#state.totalExercises, exercise.exercise_position);
    const planName = this.#state.planName?.trim() || "Training Plan";
    const gymName = this.#state.selectedGymId ? this.#state.selectedGymName ?? "Selected gym" : "No gym selected";

    return `
      <dl class="training-plan-exercise-detail-overview" aria-label="Exercise overview">
        <div>
          <dt>Plan</dt>
          <dd>${escapeHtml(planName)}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>${escapeHtml(String(exercise.exercise_position))} of ${escapeHtml(String(totalExercises))}</dd>
        </div>
        <div>
          <dt>Variants</dt>
          <dd>${escapeHtml(pluralize(exercise.configured_variant_count, "configured variant"))}</dd>
        </div>
        <div>
          <dt>Gym</dt>
          <dd>${escapeHtml(gymName)}</dd>
        </div>
      </dl>
    `;
  }

  #renderTarget(variant: TrainingPlanExerciseVariantDetail): string {
    const target = formatTarget(variant);
    if (!target) {
      return "";
    }

    return `
      <p class="training-plan-exercise-detail-target">
        <span>TARGET</span>
        ${escapeHtml(target)}
      </p>
    `;
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
        <ul class="training-plan-exercise-detail-station-list" aria-label="Compatible stations">
          ${sortedStations(variant.compatible_stations)
            .map(
              (station) => `
                <li>
                  <button
                    type="button"
                    class="training-plan-exercise-detail-station-row"
                    data-ui-action="open-training-plan-exercise-station-detail"
                    data-station-id="${escapeAttribute(station.station_id)}"
                  >
                    <span>${escapeHtml(station.station_name)}</span>
                    <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
                  </button>
                </li>
              `,
            )
            .join("")}
        </ul>
      `;
    }

    if (variant.availability === "NOT_AVAILABLE" && variant.compatible_stations.length === 0) {
      return `<p class="training-plan-exercise-detail-station-status">No compatible station in this gym</p>`;
    }

    return "";
  }

  #renderVariant(variant: TrainingPlanExerciseVariantDetail): string {
    const metadata = [
      formatRepetitionKind(variant),
      formatLoadMode(variant),
      formatTrackingMode(variant),
      formatStationRequirement(variant),
    ].join(" / ");

    return `
      <li>
        <article class="training-plan-exercise-detail-variant-card" data-variant-id="${escapeAttribute(variant.variant_id)}">
          <div class="training-plan-exercise-detail-variant-top">
            <button
              type="button"
              class="training-plan-exercise-detail-variant-open"
              data-ui-action="open-training-plan-exercise-variant-detail"
              data-variant-id="${escapeAttribute(variant.variant_id)}"
              aria-label="Open ${escapeAttribute(variant.variant_name)} variant detail"
            >
              <span class="training-plan-exercise-detail-variant-name">${escapeHtml(variant.variant_name)}</span>
              <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
            </button>
            ${this.#renderAvailability(variant)}
          </div>
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
        <ol class="training-plan-exercise-detail-variant-list">
          ${exercise.variants.map((variant) => this.#renderVariant(variant)).join("")}
        </ol>
      </section>
    `;
  }

  #render(): void {
    const exercise = this.#state.exercise;
    this.innerHTML = `
      <section class="screen-panel start-screen training-plan-exercise-detail-screen" aria-label="Exercise in plan detail screen">
        <button
          type="button"
          class="nav-button nav-button-secondary training-plan-exercise-detail-back"
          data-ui-action="navigate-back-from-training-plan-exercise-detail"
        >
          Back to Training Plan
        </button>
        <header class="gym-detail-header training-plan-exercise-detail-header">
          <div>
            <h2 class="settings-title">${escapeHtml(exercise?.exercise_name ?? "Exercise in Plan")}</h2>
            <p class="training-plan-detail-subtitle">
              ${escapeHtml(this.#state.planName?.trim() || "Training Plan")}
            </p>
          </div>
        </header>
        ${this.#renderStatus()}
        ${exercise ? this.#renderOverview(exercise) : ""}
        ${exercise ? this.#renderVariants(exercise) : ""}
      </section>
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
