import "./pb-side-menu";
import "./pb-create-button";
import type { ConfiguratorExerciseVariant, ExerciseSummary, TrainingPlanDefinitionRequest, TrainingPlanSummary } from "./workout-contract";

export const pbConfiguratorTrainingPlansScreenTag = "pb-configurator-training-plans-screen";

export type ConfiguratorTrainingPlansScreenState = {
  trainingPlans: TrainingPlanSummary[];
  exercises: Array<ExerciseSummary & { variants: ConfiguratorExerciseVariant[] }>;
  mode: "list" | "create";
  isLoading: boolean;
  errorMessage: string | null;
};

type SaveResult = { ok: boolean; errorMessage?: string };
const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

class PbConfiguratorTrainingPlansScreenElement extends HTMLElement {
  #state: ConfiguratorTrainingPlansScreenState = { trainingPlans: [], exercises: [], mode: "list", isLoading: false, errorMessage: null };
  #name = "";
  #exerciseId = "";
  #variantIds = new Set<string>();
  #exercisePickerOpen = false;
  #exerciseQuery = "";
  #variantPickerOpen = false;
  #variantQuery = "";
  #submitError: string | null = null;
  #isSaving = false;

  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); this.addEventListener("input", this.#onInput); this.addEventListener("keydown", this.#onKeyDown); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); this.removeEventListener("input", this.#onInput); this.removeEventListener("keydown", this.#onKeyDown); }
  set state(value: ConfiguratorTrainingPlansScreenState) { this.#state = value; this.#render(); }
  get state(): ConfiguratorTrainingPlansScreenState { return this.#state; }

  #emit(action: string, payload?: Record<string, unknown>, respond?: (result: SaveResult) => void): void {
    this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action, ...(payload ? { payload } : {}), ...(respond ? { respond } : {}) } }));
  }
  #selectedExercise() { return this.#state.exercises.find((exercise) => exercise.id === this.#exerciseId) ?? null; }
  #onInput = (event: Event): void => {
    const target = event.target; if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.role === "plan-name") this.#name = target.value;
    else if (target.dataset.role === "exercise-search") this.#exerciseQuery = target.value;
    else if (target.dataset.role === "variant-search") this.#variantQuery = target.value;
    else return;
    this.#submitError = null; this.#render();
  };
  #onKeyDown = (event: KeyboardEvent): void => { if (event.key !== "Escape") return; if (this.#variantPickerOpen) { event.preventDefault(); this.#variantPickerOpen = false; this.#variantQuery = ""; this.#render(); return; } if (this.#exercisePickerOpen) { event.preventDefault(); this.#exercisePickerOpen = false; this.#exerciseQuery = ""; this.#render(); } };
  #onClick = (event: Event): void => {
    const target = event.target; if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>("[data-ui-action]"); if (!button || !this.contains(button)) return;
    const action = button.dataset.uiAction;
    if (action === "start-configurator-training-plan-create") { this.#state = { ...this.#state, mode: "create" }; this.#name = ""; this.#exerciseId = ""; this.#variantIds.clear(); this.#exercisePickerOpen = false; this.#exerciseQuery = ""; this.#variantPickerOpen = false; this.#variantQuery = ""; this.#submitError = null; this.#render(); return; }
    if (action === "navigate-back-from-configurator-training-plan-create") { this.#emit(action); return; }
    if (action === "open-configurator-training-plan-detail") { const trainingPlanId = button.dataset.trainingPlanId?.trim(); if (trainingPlanId) this.#emit(action, { trainingPlanId }); return; }
    if (action === "open-create-plan-exercise-picker") { this.#exercisePickerOpen = true; this.#exerciseQuery = ""; this.#render(); return; }
    if (action === "dismiss-create-plan-exercise-picker") { this.#exercisePickerOpen = false; this.#exerciseQuery = ""; this.#render(); return; }
    if (action === "select-create-plan-exercise") { const exerciseId = button.dataset.exerciseId ?? ""; if (this.#state.exercises.some((exercise) => exercise.id === exerciseId)) { this.#exerciseId = exerciseId; this.#variantIds.clear(); this.#exercisePickerOpen = false; this.#exerciseQuery = ""; this.#submitError = null; this.#render(); } return; }
    if (action === "open-create-plan-variant-picker") { if (this.#selectedExercise()) { this.#variantPickerOpen = true; this.#variantQuery = ""; this.#render(); } return; }
    if (action === "dismiss-create-plan-variant-picker") { this.#variantPickerOpen = false; this.#variantQuery = ""; this.#render(); return; }
    if (action === "select-create-plan-variant") { const variantId = button.dataset.variantId ?? ""; const exercise = this.#selectedExercise(); if (exercise?.variants.some((variant) => variant.id === variantId) && !this.#variantIds.has(variantId)) { this.#variantIds.add(variantId); this.#variantPickerOpen = false; this.#variantQuery = ""; this.#submitError = null; this.#render(); } return; }
    if (action === "remove-create-plan-variant") { const variantId = button.dataset.variantId ?? ""; if (this.#variantIds.delete(variantId)) { this.#submitError = null; this.#render(); } return; }
    if (action !== "save-configurator-training-plan" || this.#isSaving) return;
    const name = this.#name.trim();
    if (!name || !this.#exerciseId || this.#variantIds.size === 0) { this.#submitError = !name ? "Plan name is required." : !this.#exerciseId ? "Choose an initial exercise." : "Choose at least one allowed variant."; this.#render(); return; }
    const request: TrainingPlanDefinitionRequest = { name, exercises: [{ exercise_id: this.#exerciseId, allowed_variant_ids: [...this.#variantIds] }] };
    this.#isSaving = true; this.#submitError = null; this.#render();
    this.#emit("save-configurator-training-plan", { request }, (result) => { this.#isSaving = false; if (!result.ok) { this.#submitError = result.errorMessage ?? "Unable to create training plan right now."; this.#render(); } });
  };
  #renderList(): string {
    if (this.#state.isLoading) return '<p class="start-status" role="status">Loading training plans...</p>';
    if (this.#state.errorMessage) return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    if (this.#state.trainingPlans.length === 0) return '<p class="start-copy">No training plans available yet. Create one with an Exercise and allowed Variant.</p>';
    return `<div class="configurator-gym-list" aria-label="Training plans">${this.#state.trainingPlans.map((plan) => `<button type="button" class="configurator-gym-card configurator-training-plan-card" data-ui-action="open-configurator-training-plan-detail" data-training-plan-id="${escapeHtml(plan.id)}" aria-label="Open ${escapeHtml(plan.name)} training plan"><span class="configurator-training-plan-card-name">${escapeHtml(plan.name)}</span><span class="configurator-training-plan-card-exercise-count">${plan.exercise_count === 1 ? "1 exercise" : `${plan.exercise_count} exercises`}</span></button>`).join("")}</div>`;
  }
  #renderCreate(): string {
    const exercise = this.#selectedExercise();
    const availableExercises = this.#state.exercises.filter((item) => !this.#exerciseQuery || item.name.trim().toLocaleLowerCase("en-US").includes(this.#exerciseQuery.trim().toLocaleLowerCase("en-US")));
    const availableVariants = exercise?.variants.filter((variant) => !this.#variantIds.has(variant.id) && (!this.#variantQuery || variant.name.trim().toLocaleLowerCase("en-US").includes(this.#variantQuery.trim().toLocaleLowerCase("en-US")))) ?? [];
    const selectedVariants = exercise?.variants.filter((variant) => this.#variantIds.has(variant.id)) ?? [];
    const exercisePicker = this.#exercisePickerOpen ? `<div class="secs-picker-layer" role="presentation"><button type="button" class="secs-picker-backdrop" data-ui-action="dismiss-create-plan-exercise-picker" aria-label="Close Exercise picker"></button><section class="secs-picker-sheet configurator-load-profile-picker" role="dialog" aria-modal="true" aria-labelledby="create-plan-exercise-picker-title"><header class="configurator-load-profile-picker-header"><h2 id="create-plan-exercise-picker-title" class="secs-picker-title">Choose Exercise</h2><input class="configurator-gym-input" type="search" data-role="exercise-search" value="${escapeHtml(this.#exerciseQuery)}" placeholder="Search Exercises" aria-label="Search Exercises" autocomplete="off" /></header><div class="configurator-load-profile-picker-options" role="listbox" aria-label="Available Exercises">${availableExercises.length === 0 ? '<p class="start-copy">No Exercises available.</p>' : availableExercises.map((item) => `<button type="button" class="configurator-load-profile-picker-option" data-ui-action="select-create-plan-exercise" data-exercise-id="${escapeHtml(item.id)}" role="option"><span>${escapeHtml(item.name)}</span></button>`).join("")}</div></section></div>` : "";
    const variantPicker = this.#variantPickerOpen ? `<div class="secs-picker-layer" role="presentation"><button type="button" class="secs-picker-backdrop" data-ui-action="dismiss-create-plan-variant-picker" aria-label="Close Variant picker"></button><section class="secs-picker-sheet configurator-load-profile-picker" role="dialog" aria-modal="true" aria-labelledby="create-plan-variant-picker-title"><header class="configurator-load-profile-picker-header"><h2 id="create-plan-variant-picker-title" class="secs-picker-title">Choose Variant</h2><input class="configurator-gym-input" type="search" data-role="variant-search" value="${escapeHtml(this.#variantQuery)}" placeholder="Search Variants" aria-label="Search Variants" autocomplete="off" /></header><div class="configurator-load-profile-picker-options" role="listbox" aria-label="Available Variants">${availableVariants.length === 0 ? '<p class="start-copy">No Variants available to add.</p>' : availableVariants.map((variant) => `<button type="button" class="configurator-load-profile-picker-option" data-ui-action="select-create-plan-variant" data-variant-id="${escapeHtml(variant.id)}" role="option"><span>${escapeHtml(variant.name)}</span></button>`).join("")}</div></section></div>` : "";
    return `<button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-training-plan-create" aria-label="Back to Training Plans"><span aria-hidden="true">←</span></button><form class="configurator-training-plan-editor-card" aria-label="New training plan" onsubmit="return false"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Plan name</span><input class="configurator-gym-input" data-role="plan-name" value="${escapeHtml(this.#name)}" autocomplete="off" /></label><section class="configurator-training-plan-exercise-card" aria-label="Initial exercise"><p class="configurator-training-plan-variants-heading">Initial Exercise</p>${exercise ? `<p class="start-copy">${escapeHtml(exercise.name)}</p>` : '<p class="start-copy">Choose the first Exercise for this Training Plan.</p>'}<button type="button" class="configurator-training-plan-add-action" data-ui-action="open-create-plan-exercise-picker" aria-haspopup="dialog" aria-expanded="${this.#exercisePickerOpen}">${exercise ? "Change Exercise" : "Choose Exercise"}</button></section>${exercise ? `<section class="configurator-training-plan-exercise-card" aria-label="Allowed variants"><p class="configurator-training-plan-variants-heading">Allowed Variants</p>${selectedVariants.length ? `<ul class="configurator-training-plan-variant-list">${selectedVariants.map((variant) => `<li class="configurator-training-plan-variant"><strong>${escapeHtml(variant.name)}</strong><button type="button" class="configurator-training-plan-remove" data-ui-action="remove-create-plan-variant" data-variant-id="${escapeHtml(variant.id)}" aria-label="Remove ${escapeHtml(variant.name)}"><span aria-hidden="true">×</span></button></li>`).join("")}</ul>` : '<p class="start-copy">Choose at least one allowed Variant.</p>'}${exercise.variants.length > selectedVariants.length ? `<button type="button" class="configurator-training-plan-add-action" data-ui-action="open-create-plan-variant-picker" aria-haspopup="dialog" aria-expanded="${this.#variantPickerOpen}">+ Add Variant</button>` : ""}${exercise.variants.length === 0 ? '<p class="start-copy">This Exercise has no available Variants yet.</p>' : ""}</section>` : ""}${this.#submitError ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>` : ""}<button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-training-plan"${this.#isSaving ? " disabled" : ""}>${this.#isSaving ? "Creating..." : "Create Training Plan"}</button></form>${exercisePicker}${variantPicker}`;
  }
  #render(): void { const isList = this.#state.mode === "list"; this.innerHTML = `<div class="app-screen-shell"><pb-side-menu mode="configurator" active-screen="configurator-training-plans" menu-id="configurator-training-plans-side-menu"></pb-side-menu><section class="screen-panel configurator-training-plans-screen" aria-label="Configurator training plans screen"><header class="app-header configurator-app-header"><img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" /><h1 class="app-title">${isList ? "Training Plans" : "New Training Plan"}</h1><p class="start-copy">${isList ? "Manage the current definitions for your workouts." : "Choose an initial Exercise and one or more allowed Variants."}</p></header>${isList ? '<pb-create-button action="start-configurator-training-plan-create" label="New Training Plan"></pb-create-button>' + this.#renderList() : this.#renderCreate()}</section></div>`; }
}
export const registerPbConfiguratorTrainingPlansScreen = (): void => { if (!customElements.get(pbConfiguratorTrainingPlansScreenTag)) customElements.define(pbConfiguratorTrainingPlansScreenTag, PbConfiguratorTrainingPlansScreenElement); };
registerPbConfiguratorTrainingPlansScreen();
