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
  #submitError: string | null = null;
  #isSaving = false;

  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); this.addEventListener("input", this.#onInput); this.addEventListener("change", this.#onChange); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); this.removeEventListener("input", this.#onInput); this.removeEventListener("change", this.#onChange); }
  set state(value: ConfiguratorTrainingPlansScreenState) { this.#state = value; this.#render(); }
  get state(): ConfiguratorTrainingPlansScreenState { return this.#state; }

  #emit(action: string, payload?: Record<string, unknown>, respond?: (result: SaveResult) => void): void {
    this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action, ...(payload ? { payload } : {}), ...(respond ? { respond } : {}) } }));
  }
  #selectedExercise() { return this.#state.exercises.find((exercise) => exercise.id === this.#exerciseId) ?? null; }
  #onInput = (event: Event): void => { const target = event.target; if (target instanceof HTMLInputElement && target.dataset.role === "plan-name") { this.#name = target.value; this.#submitError = null; } };
  #onChange = (event: Event): void => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.dataset.role === "plan-exercise") { this.#exerciseId = target.value; this.#variantIds.clear(); this.#submitError = null; this.#render(); return; }
    if (target instanceof HTMLInputElement && target.dataset.role === "plan-variant") { if (target.checked) this.#variantIds.add(target.value); else this.#variantIds.delete(target.value); this.#submitError = null; }
  };
  #onClick = (event: Event): void => {
    const target = event.target; if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>("[data-ui-action]"); if (!button || !this.contains(button)) return;
    const action = button.dataset.uiAction;
    if (action === "start-configurator-training-plan-create") { this.#state = { ...this.#state, mode: "create" }; this.#name = ""; this.#exerciseId = ""; this.#variantIds.clear(); this.#submitError = null; this.#render(); return; }
    if (action === "navigate-back-from-configurator-training-plan-create") { this.#emit(action); return; }
    if (action === "open-configurator-training-plan-detail") { const trainingPlanId = button.dataset.trainingPlanId?.trim(); if (trainingPlanId) this.#emit(action, { trainingPlanId }); return; }
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
    return `<div class="configurator-gym-list" aria-label="Training plans">${this.#state.trainingPlans.map((plan) => `<button type="button" class="configurator-gym-card" data-ui-action="open-configurator-training-plan-detail" data-training-plan-id="${escapeHtml(plan.id)}" aria-label="Open ${escapeHtml(plan.name)} training plan"><span class="configurator-gym-name">${escapeHtml(plan.name)}</span><span class="configurator-exercise-card-metadata">${plan.exercise_count === 1 ? "1 exercise" : `${plan.exercise_count} exercises`}</span></button>`).join("")}</div>`;
  }
  #renderCreate(): string {
    const exercise = this.#selectedExercise();
    const variants = exercise?.variants ?? [];
    return `<button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-training-plan-create" aria-label="Back to Training Plans"><span aria-hidden="true">←</span></button><form class="configurator-training-plan-editor-card" aria-label="New training plan" onsubmit="return false"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Plan name</span><input class="configurator-gym-input" data-role="plan-name" value="${escapeHtml(this.#name)}" autocomplete="off" /></label><label class="configurator-gym-field"><span class="configurator-gym-field-label">Initial exercise</span><select class="configurator-gym-input" data-role="plan-exercise"><option value="">Choose an exercise</option>${this.#state.exercises.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === this.#exerciseId ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>${exercise ? `<section class="configurator-training-plan-exercise-card" aria-label="Allowed variants"><p class="configurator-training-plan-variants-heading">Allowed Variants</p>${variants.length ? `<div class="configurator-training-plan-create-variants">${variants.map((variant) => `<label class="configurator-gym-field"><input type="checkbox" data-role="plan-variant" value="${escapeHtml(variant.id)}"${this.#variantIds.has(variant.id) ? " checked" : ""} /><span>${escapeHtml(variant.name)}</span></label>`).join("")}</div>` : '<p class="start-copy">This Exercise has no available Variants yet.</p>'}</section>` : ""}${this.#submitError ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>` : ""}<button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-training-plan"${this.#isSaving ? " disabled" : ""}>${this.#isSaving ? "Creating..." : "Create Training Plan"}</button></form>`;
  }
  #render(): void { const isList = this.#state.mode === "list"; this.innerHTML = `<div class="app-screen-shell"><pb-side-menu mode="configurator" active-screen="configurator-training-plans" menu-id="configurator-training-plans-side-menu"></pb-side-menu><section class="screen-panel configurator-training-plans-screen" aria-label="Configurator training plans screen"><header class="app-header configurator-app-header"><img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" /><h1 class="app-title">${isList ? "Training Plans" : "New Training Plan"}</h1><p class="start-copy">${isList ? "Manage the current definitions for your workouts." : "Choose an initial Exercise and one or more allowed Variants."}</p></header>${isList ? '<pb-create-button action="start-configurator-training-plan-create" label="New Training Plan"></pb-create-button>' + this.#renderList() : this.#renderCreate()}</section></div>`; }
}
export const registerPbConfiguratorTrainingPlansScreen = (): void => { if (!customElements.get(pbConfiguratorTrainingPlansScreenTag)) customElements.define(pbConfiguratorTrainingPlansScreenTag, PbConfiguratorTrainingPlansScreenElement); };
registerPbConfiguratorTrainingPlansScreen();
