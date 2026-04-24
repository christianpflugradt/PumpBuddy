import type { WorkoutExercisesPerformanceRow } from "./workout-types";
import { deriveExercisePerformance } from "./exercise-performance-derivation";

export const pbExerciseVariantDetailScreenTag = "pb-exercise-variant-detail-screen";

export type ExerciseVariantDetailScreenState = {
  variantId: string;
  row: WorkoutExercisesPerformanceRow | null;
};

type UiAction = "navigate-exercises";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

class PbExerciseVariantDetailScreenElement extends HTMLElement {
  #state: ExerciseVariantDetailScreenState = {
    variantId: "",
    row: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: ExerciseVariantDetailScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): ExerciseVariantDetailScreenState {
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

    this.#emitUiAction(action);
  };

  #render(): void {
    const row = this.#state.row;
    const derived = deriveExercisePerformance(row);
    const title = row?.variant_name?.trim() || "Exercise Variant";
    const statusText = row ? derived.comparableScoredSessions.scoredLabel : "Variant context unavailable";
    const scoreText = derived.scoreLabel;

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-exercises"
          aria-label="Back to exercises"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section class="screen-panel start-screen workout-detail-screen exercise-variant-detail-screen" aria-label="Exercise variant detail screen">
          <header class="workout-detail-hero">
            <h2 class="workout-detail-plan-name">${escapeHtml(title)}</h2>
            <p class="workout-detail-date">${escapeHtml(statusText)}</p>
            <ul class="workout-detail-stat-grid" aria-label="Exercise variant summary">
              <li class="workout-detail-stat-tile">
                <p class="workout-detail-stat-value">${escapeHtml(scoreText)}</p>
                <p class="workout-detail-stat-label">30d Score</p>
              </li>
              <li class="workout-detail-stat-tile">
                <p class="workout-detail-stat-value">${escapeHtml(
                  row ? String(derived.comparableScoredSessions.count) : "--",
                )}</p>
                <p class="workout-detail-stat-label">Sessions</p>
              </li>
            </ul>
          </header>
        </section>
      </div>
    `;
  }
}

export const registerPbExerciseVariantDetailScreen = (): void => {
  if (!customElements.get(pbExerciseVariantDetailScreenTag)) {
    customElements.define(pbExerciseVariantDetailScreenTag, PbExerciseVariantDetailScreenElement);
  }
};
