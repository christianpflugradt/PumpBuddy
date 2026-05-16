import type { TrainingPlanExerciseVariantSummary } from "./workout-types";

export const pbFallbackSelectorTag = "pb-fallback-selector";

export type FallbackSelectorState = {
  exercise_variants?: TrainingPlanExerciseVariantSummary[];
  options?: TrainingPlanExerciseVariantSummary[];
  selectedTrainingPlanExerciseVariantId: string | null;
  selectedStationId: string | null;
  isSelectionConfirmed: boolean;
  isSaving: boolean;
  isLockedAfterSetCompletion: boolean;
};

type UiAction = "confirm-fallback-option";
type InputAction = "switch-fallback-option";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const fallbackOptionKey = (optionId: string, stationId: string | null): string =>
  `${optionId}::${stationId ?? ""}`;

const fallbackOptionLabel = (option: TrainingPlanExerciseVariantSummary): string => {
  const stationLabel =
    option.station_name && option.station_name.trim().length > 0
      ? ` at ${option.station_name}`
      : "";
  return `${option.variant_name}${stationLabel}`;
};

class PbFallbackSelectorElement extends HTMLElement {
  #state: FallbackSelectorState | null = null;
  #shadow = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.#render();
    this.#shadow.addEventListener("click", this.#onClick);
    this.#shadow.addEventListener("change", this.#onChange);
  }

  disconnectedCallback(): void {
    this.#shadow.removeEventListener("click", this.#onClick);
    this.#shadow.removeEventListener("change", this.#onChange);
  }

  set state(value: FallbackSelectorState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): FallbackSelectorState | null {
    return this.#state;
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

  #emitInputAction(action: InputAction, value: string): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-input", {
        bubbles: true,
        composed: true,
        detail: { action, value },
      }),
    );
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.#shadow.contains(actionElement)) {
      return;
    }

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    this.#emitUiAction(action);
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const action = target.dataset.inputAction as InputAction | undefined;
    if (!action) {
      return;
    }

    this.#emitInputAction(action, target.value);
  };

  #render(): void {
    const state = this.#state;
    const options = state?.exercise_variants ?? state?.options ?? [];
    if (!state || options.length === 0 || state.isSelectionConfirmed) {
      this.#shadow.innerHTML = "";
      return;
    }

    const hasSelectedOption = options.some(
      (option) =>
        option.id === state.selectedTrainingPlanExerciseVariantId &&
        option.station_id === state.selectedStationId,
    );

    const selectorDisabled = state.isSaving || state.isLockedAfterSetCompletion ? "disabled" : "";
    const confirmDisabled =
      state.isSaving || state.isLockedAfterSetCompletion || !hasSelectedOption ? "disabled" : "";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      <section class="fallback-option-panel" aria-label="Fallback exercise option">
        <div class="fallback-option-controls">
          <select
            id="fallback-option-select"
            class="start-select"
            data-input-action="switch-fallback-option"
            ${selectorDisabled}
          >
            ${options
              .map(
                (option) =>
                  `<option value="${escapeHtml(fallbackOptionKey(option.id, option.station_id))}" ${
                    option.id === state.selectedTrainingPlanExerciseVariantId &&
                    option.station_id === state.selectedStationId
                      ? "selected"
                      : ""
                  }>${escapeHtml(fallbackOptionLabel(option))}</option>`,
              )
              .join("")}
          </select>

          <button
            type="button"
            class="nav-button nav-button-primary fallback-option-select-button"
            data-ui-action="confirm-fallback-option"
            ${confirmDisabled}
          >
            Select
          </button>
        </div>

        ${
          state.isLockedAfterSetCompletion
            ? '<p class="fallback-option-copy">Locked after the first completed set.</p>'
            : ""
        }
      </section>
    `;
  }
}

export const registerPbFallbackSelector = (): void => {
  if (!customElements.get(pbFallbackSelectorTag)) {
    customElements.define(pbFallbackSelectorTag, PbFallbackSelectorElement);
  }
};
