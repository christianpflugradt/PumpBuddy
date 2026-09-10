import "./pb-side-menu";
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

const statusLabelByValue: Record<ExerciseSummary["status"], string> = {
  new: "Draft",
  active: "Active",
  inactive: "Inactive",
};

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
    return `<div class="configurator-exercise-list" aria-label="Exercises">${exercises.map((exercise) => `<button type="button" class="configurator-exercise-card configurator-exercise-card--${exercise.status}" data-ui-action="open-configurator-exercise-detail" data-exercise-id="${escapeHtml(exercise.id)}" aria-label="Open ${escapeHtml(exercise.name)} exercise"><span class="configurator-exercise-card-topline"><span class="configurator-exercise-name">${escapeHtml(exercise.name)}</span><span class="configurator-exercise-status configurator-exercise-status--${exercise.status}">${statusLabelByValue[exercise.status]}</span></span><span class="configurator-exercise-card-metadata">${exercise.variant_count === 1 ? "1 variant" : `${exercise.variant_count} variants`}</span></button>`).join("")}</div>`;
  }
  #renderDestination(): string {
    const isCreate = this.#state.mode === "create";
    const exercise = this.#state.selectedExercise;
    return `<section class="configurator-placeholder-card" aria-label="${escapeHtml(isCreate ? "New exercise" : exercise?.name ?? "Exercise detail")}"><p class="configurator-placeholder-eyebrow">${isCreate ? "Draft Flow" : statusLabelByValue[exercise?.status ?? "new"]}</p><p class="configurator-placeholder-title">${escapeHtml(isCreate ? "New Exercise" : exercise?.name ?? "Exercise")}</p><p class="configurator-placeholder-copy">This route is ready for the Exercise editor and its nested Variants. Variant management remains inside this Exercise flow.</p></section>`;
  }
  #render(): void {
    const isList = this.#state.mode === "list";
    const title = isList ? "Exercises" : this.#state.mode === "create" ? "New Exercise" : this.#state.selectedExercise?.name ?? "Exercise";
    this.innerHTML = `<div class="app-screen-shell"><pb-side-menu mode="configurator" active-screen="configurator-exercises" menu-id="configurator-exercises-side-menu"></pb-side-menu><section class="screen-panel configurator-exercises-screen" aria-label="Configurator exercises screen"><header class="app-header configurator-app-header"><img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" /><h1 class="app-title">${escapeHtml(title)}</h1><p class="start-copy">${isList ? "Manage the canonical movements and their variants." : "Stay in configurator mode while opening Exercise destinations."}</p></header>${isList ? '<button type="button" class="configurator-exercise-create-button nav-button nav-button-primary action-button action-button-primary" data-ui-action="start-configurator-exercise-create">+ New Exercise</button><label class="configurator-exercise-search" aria-label="Search exercises"><input type="search" data-role="exercise-search" value="' + escapeHtml(this.#searchQuery) + '" placeholder="Search exercises..." autocomplete="off" /></label>' : '<button type="button" class="configurator-exercise-back-button" data-ui-action="navigate-back-from-configurator-exercise-detail">‹ Back to Exercises</button>'}${isList ? this.#renderListBody() : this.#renderDestination()}</section></div>`;
  }
}

export const registerPbConfiguratorExercisesScreen = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorExercisesScreenTag)) customElements.define(pbConfiguratorExercisesScreenTag, PbConfiguratorExercisesScreenElement);
};

registerPbConfiguratorExercisesScreen();
