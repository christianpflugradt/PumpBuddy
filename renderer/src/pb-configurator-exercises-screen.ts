import "./pb-side-menu";
import "./pb-create-button";
import "./pb-configurator-header";
import { formatConfiguratorLifecycleStatus } from "./pb-configurator-status";
import type { ExerciseSummary } from "./workout-contract";

export const pbConfiguratorExercisesScreenTag = "pb-configurator-exercises-screen";

export type ConfiguratorExercisesScreenState = {
  mode: "list" | "detail" | "create";
  exercises: ExerciseSummary[];
  selectedExercise: ExerciseSummary | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "start-configurator-exercise-create"
  | "open-configurator-exercise-detail"
  | "navigate-back-from-configurator-exercise-detail";

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

class PbConfiguratorExercisesScreenElement extends HTMLElement {
  #state: ConfiguratorExercisesScreenState = { mode: "list", exercises: [], selectedExercise: null, isLoading: false, errorMessage: null };
  #searchQuery = "";

  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); this.addEventListener("input", this.#onInput); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); this.removeEventListener("input", this.#onInput); }
  set state(value: ConfiguratorExercisesScreenState) { this.#state = value; this.#render(); }
  get state(): ConfiguratorExercisesScreenState { return this.#state; }

  #emit(action: UiAction, payload?: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: payload ? { action, payload } : { action } }));
  }
  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) return;
    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) return;
    if (action === "open-configurator-exercise-detail") {
      const exerciseId = actionElement.dataset.exerciseId?.trim() ?? "";
      if (exerciseId) this.#emit(action, { exerciseId });
      return;
    }
    this.#emit(action);
  };
  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.role !== "exercise-search") return;
    this.#searchQuery = target.value;
    this.#render();
    const input = this.querySelector<HTMLInputElement>('[data-role="exercise-search"]');
    input?.focus();
    input?.setSelectionRange(this.#searchQuery.length, this.#searchQuery.length);
  };

  #renderListBody(): string {
    if (this.#state.isLoading) return '<p class="start-status" role="status">Loading exercises...</p>';
    if (this.#state.errorMessage) return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    if (this.#state.exercises.length === 0) return '<p class="start-copy">No exercises available yet.</p>';
    const query = this.#searchQuery.trim().toLocaleLowerCase();
    const exercises = this.#state.exercises.filter((exercise) => exercise.name.toLocaleLowerCase().includes(query));
    if (exercises.length === 0) return '<p class="start-copy" role="status">No exercises match your search.</p>';
    return `<div class="configurator-entity-list" aria-label="Exercises">${exercises.map((exercise) => `<button type="button" class="configurator-entity-row${exercise.status === "inactive" ? " configurator-entity-row--inactive" : ""}" data-ui-action="open-configurator-exercise-detail" data-exercise-id="${escapeHtml(exercise.id)}" aria-label="Open ${escapeHtml(exercise.name)} exercise"><span class="configurator-entity-row-topline"><span class="configurator-entity-row-name">${escapeHtml(exercise.name)}</span><pb-configurator-status value="${exercise.status}"></pb-configurator-status></span><span class="configurator-entity-row-metadata">${exercise.variant_count === 1 ? "1 variant" : `${exercise.variant_count} variants`}</span></button>`).join("")}</div>`;
  }
  #renderDestination(): string {
    const isCreate = this.#state.mode === "create";
    const exercise = this.#state.selectedExercise;
    return `<section class="configurator-placeholder-card" aria-label="${escapeHtml(isCreate ? "New exercise" : exercise?.name ?? "Exercise detail")}"><p class="configurator-placeholder-eyebrow">${isCreate ? "Draft Flow" : formatConfiguratorLifecycleStatus(exercise?.status ?? "new")}</p><p class="configurator-placeholder-title">${escapeHtml(isCreate ? "New Exercise" : exercise?.name ?? "Exercise")}</p><p class="configurator-placeholder-copy">This route is ready for the Exercise editor and its nested Variants. Variant management remains inside this Exercise flow.</p></section>`;
  }
  #render(): void {
    const isList = this.#state.mode === "list";
    const title = isList ? "Exercises" : this.#state.mode === "create" ? "New Exercise" : this.#state.selectedExercise?.name ?? "Exercise";
    this.innerHTML = `<div class="app-screen-shell"><pb-side-menu mode="configurator" active-screen="configurator-exercises" menu-id="configurator-exercises-side-menu"></pb-side-menu><section class="screen-panel configurator-exercises-screen" aria-label="Configurator exercises screen"><pb-configurator-header title="${escapeHtml(title)}" context="${isList ? "Manage the canonical movements and their variants." : "Stay in configurator mode while opening Exercise destinations."}" banner></pb-configurator-header>${isList ? '<pb-create-button action="start-configurator-exercise-create" label="New Exercise"></pb-create-button><label class="configurator-list-search" aria-label="Search exercises"><input class="configurator-list-search-input" type="search" data-role="exercise-search" value="' + escapeHtml(this.#searchQuery) + '" placeholder="Search exercises..." autocomplete="off" /></label>' : '<button type="button" class="configurator-exercise-back-button" data-ui-action="navigate-back-from-configurator-exercise-detail">‹ Back to Exercises</button>'}${isList ? this.#renderListBody() : this.#renderDestination()}</section></div>`;
  }
}

export const registerPbConfiguratorExercisesScreen = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorExercisesScreenTag)) customElements.define(pbConfiguratorExercisesScreenTag, PbConfiguratorExercisesScreenElement);
};

registerPbConfiguratorExercisesScreen();
