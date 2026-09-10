import type { ConfiguratorStation, GymCreateRequest, GymDetailResponse, GymSummary, GymUpdateRequest } from "./workout-contract";
import { TextInputBinding } from "./text-input-binding";

export const pbConfiguratorGymEditorScreenTag = "pb-configurator-gym-editor-screen";

export type ConfiguratorGymEditorScreenState = {
  mode: "create" | "edit";
  gyms: GymSummary[];
  detail: GymDetailResponse | null;
  stations?: ConfiguratorStation[];
  isLoading: boolean;
  errorMessage: string | null;
};

type SaveResult = { ok: boolean; errorMessage?: string };
type SaveDetail = {
  action: "save-configurator-gym";
  payload: { mode: "create" | "edit"; gymId: string | null; request: GymCreateRequest | GymUpdateRequest };
  respond: (result: SaveResult) => void;
};
type DeleteDetail = {
  action: "delete-configurator-gym";
  payload: { gymId: string };
  respond: (result: SaveResult) => void;
};

const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const normalizeName = (value: string): string => value.trim().toLocaleLowerCase("en-US");

class PbConfiguratorGymEditorScreenElement extends HTMLElement {
  #state: ConfiguratorGymEditorScreenState = { mode: "create", gyms: [], detail: null, stations: [], isLoading: false, errorMessage: null };
  #loadedKey: string | null = null;
  #nameDraft = "";
  #submitError: string | null = null;
  #isSaving = false;
  #isDeleting = false;
  #renameWarningOpen = false;
  #deleteWarningOpen = false;
  #touched = false;
  #textInput = new TextInputBinding(this, ({ field, value }) => this.#onTextInput(field, value));

  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); this.#textInput.connect(); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); this.#textInput.disconnect(); }
  set state(value: ConfiguratorGymEditorScreenState) {
    this.#state = value;
    const key = value.mode === "create" ? "create" : value.detail ? `edit:${value.detail.id}` : "edit:loading";
    if (key !== this.#loadedKey && (value.mode === "create" || value.detail)) {
      this.#loadedKey = key; this.#nameDraft = value.detail?.name ?? ""; this.#submitError = null; this.#isSaving = false; this.#isDeleting = false; this.#renameWarningOpen = false; this.#deleteWarningOpen = false; this.#touched = false;
    }
    this.#render();
  }
  get state(): ConfiguratorGymEditorScreenState { return this.#state; }

  #nameError(): string | null {
    const name = this.#nameDraft.trim();
    if (!name) return "Name is required.";
    const currentId = this.#state.detail?.id;
    return this.#state.gyms.some((gym) => gym.id !== currentId && normalizeName(gym.name) === normalizeName(name)) ? "Name must be unique." : null;
  }
  #isHistorical(): boolean { return this.#state.detail?.status === "active" || this.#state.detail?.status === "inactive"; }
  #hasChanges(): boolean { return this.#state.mode === "create" || normalizeName(this.#nameDraft) !== normalizeName(this.#state.detail?.name ?? ""); }
  #emit(action: string, payload?: Record<string, string>): void { this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: payload ? { action, payload } : { action } })); }
  #onTextInput = (field: string, value: string): void => {
    if (field !== "name") return;
    this.#nameDraft = value; this.#touched = true; this.#submitError = null; const error = this.#nameError();
    const fieldElement = this.querySelector('[data-field="name"]')?.closest(".configurator-gym-field"); fieldElement?.querySelector(".configurator-gym-field-error")?.remove();
    if (error && fieldElement) { const message = document.createElement("span"); message.className = "configurator-gym-field-error"; message.textContent = error; fieldElement.append(message); }
    const saveButton = this.querySelector<HTMLButtonElement>('[data-ui-action="save-gym"]');
    if (saveButton) saveButton.disabled = this.#isSaving || this.#isDeleting || !!error || (!this.#state.mode.includes("create") && !this.#hasChanges());
  };
  #onClick = (event: Event): void => {
    const target = event.target; if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>("[data-ui-action]")?.dataset.uiAction;
    if (!action) return;
    if (action === "navigate-back-from-configurator-gym-detail") { this.#emit(action); return; }
    if (action === "start-configurator-station-create") { const gymId = this.#state.detail?.id; if (gymId) this.#emit(action, { gymId }); return; }
    if (action === "open-configurator-station-detail") { const gymId = this.#state.detail?.id; const stationId = target.closest<HTMLElement>("[data-station-id]")?.dataset.stationId?.trim(); if (gymId && stationId) this.#emit(action, { gymId, stationId }); return; }
    if (action === "dismiss-historical-rename-warning") { this.#renameWarningOpen = false; this.#render(); return; }
    if (action === "dismiss-delete-gym-warning") { this.#deleteWarningOpen = false; this.#render(); return; }
    if (action === "save-gym") {
      const error = this.#nameError();
      if (error) { this.#touched = true; this.#submitError = error; this.#render(); return; }
      if (this.#isHistorical() && this.#hasChanges() && !this.#renameWarningOpen) { this.#renameWarningOpen = true; this.#render(); return; }
      if (this.#isSaving || this.#isDeleting) return;
      this.#isSaving = true; this.#renameWarningOpen = false; this.#submitError = null; this.#render();
      this.dispatchEvent(new CustomEvent<SaveDetail>("pb-ui-action", { bubbles: true, composed: true, detail: { action: "save-configurator-gym", payload: { mode: this.#state.mode, gymId: this.#state.detail?.id ?? null, request: { name: this.#nameDraft.trim() } }, respond: (result) => { this.#isSaving = false; this.#submitError = result.ok ? null : result.errorMessage ?? null; this.#render(); } } })); return;
    }
    if (action === "delete-gym") {
      const gymId = this.#state.detail?.id; if (!gymId || this.#isSaving || this.#isDeleting) return;
      if ((this.#state.stations ?? []).length > 0 && !this.#deleteWarningOpen) { this.#deleteWarningOpen = true; this.#render(); return; }
      this.#isDeleting = true; this.#submitError = null; this.#render();
      this.dispatchEvent(new CustomEvent<DeleteDetail>("pb-ui-action", { bubbles: true, composed: true, detail: { action: "delete-configurator-gym", payload: { gymId }, respond: (result) => { this.#isDeleting = false; this.#submitError = result.ok ? null : result.errorMessage ?? null; this.#render(); } } }));
    }
  };
  #render(): void {
    const detail = this.#state.detail; const error = this.#nameError(); const isCreate = this.#state.mode === "create"; const canDelete = !isCreate && detail?.status === "new";
    const disabled = this.#isSaving || this.#isDeleting || !!error || (!isCreate && !this.#hasChanges());
    const form = this.#state.isLoading ? '<p class="start-status" role="status">Loading gym detail...</p>' : this.#state.errorMessage ? `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>` : !isCreate && !detail ? '<p class="start-error" role="alert">Unable to find that Gym right now.</p>' : `
      <div class="configurator-gym-editor-card"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Name</span><input class="configurator-gym-input" data-field="name" value="${escapeHtml(this.#nameDraft)}" ${this.#isSaving || this.#isDeleting ? "disabled" : ""} />${error && this.#touched ? `<span class="configurator-gym-field-error">${escapeHtml(error)}</span>` : ""}</label>
      ${detail ? `<dl class="configurator-load-profile-metadata"><div><dt>Status</dt><dd>${detail.status === "new" ? "Draft" : detail.status === "active" ? "Active" : "Inactive"}</dd></div><div><dt>Stations</dt><dd>${(this.#state.stations ?? []).length === 1 ? "1 station" : `${(this.#state.stations ?? []).length} stations`}</dd></div></dl>` : ""}
      ${this.#submitError ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>` : ""}
      <div class="configurator-gym-editor-actions"><button type="button" class="configurator-gym-save-button" data-ui-action="save-gym" ${disabled ? "disabled" : ""}>${this.#isSaving ? "Saving..." : isCreate ? "Create Gym" : "Save Name"}</button>${canDelete ? `<button type="button" class="configurator-gym-delete-button" data-ui-action="delete-gym" ${this.#isDeleting ? "disabled" : ""}>${this.#isDeleting ? "Deleting..." : "Delete Draft"}</button>` : ""}</div></div>`;
    const stations = this.#state.stations ?? [];
    const stationSection = !isCreate && detail ? `<section class="configurator-gym-stations" aria-label="Stations"><div class="configurator-gym-stations-header"><h2>Stations</h2><button type="button" class="nav-button nav-button-primary action-button action-button-primary" data-ui-action="start-configurator-station-create">+ New Station</button></div>${stations.length === 0 ? '<p class="start-copy">No stations yet.</p>' : `<ul class="configurator-gym-station-list">${stations.map((station) => `<li><button type="button" class="configurator-gym-station-row" data-ui-action="open-configurator-station-detail" data-station-id="${escapeHtml(station.id)}" aria-label="Open ${escapeHtml(station.name)} station"><span><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.load_profile.name)}</small></span><span class="configurator-gym-status configurator-gym-status--${escapeHtml(station.status)}">${station.status === "new" ? "Draft" : station.status === "active" ? "Active" : "Inactive"}</span></button></li>`).join("")}</ul>`}</section>` : "";
    const warning = this.#renameWarningOpen ? `<div class="confirm-dialog-layer" role="presentation"><div class="confirm-dialog-backdrop" role="presentation"></div><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Historical rename warning"><p class="confirm-dialog-message">Renaming an active or inactive Gym can affect how historical workouts are understood. Save this name change?</p><div class="confirm-dialog-actions"><button type="button" class="nav-button" data-ui-action="dismiss-historical-rename-warning">Keep Editing</button><button type="button" class="nav-button" data-ui-action="save-gym">Save Name</button></div></section></div>` : this.#deleteWarningOpen ? `<div class="confirm-dialog-layer" role="presentation"><div class="confirm-dialog-backdrop" role="presentation"></div><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-gym-warning-title"><h2 class="confirm-dialog-title" id="delete-gym-warning-title">Delete draft gym?</h2><p class="confirm-dialog-message">This will also delete ${stations.length} ${stations.length === 1 ? "station" : "stations"}.</p><div class="confirm-dialog-actions"><button type="button" class="nav-button" data-ui-action="dismiss-delete-gym-warning">Cancel</button><button type="button" class="nav-button" data-ui-action="delete-gym">Delete</button></div></section></div>` : "";
    this.innerHTML = `<div class="app-screen-shell"><button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-gym-detail" aria-label="Back"><span aria-hidden="true">←</span></button><section class="screen-panel configurator-gym-editor-screen" aria-label="Gym editor"><header class="exercise-variant-detail-header"><h1 class="exercise-variant-detail-header-title">Gym</h1></header>${form}${stationSection}</section>${warning}</div>`;
  }
}

export const registerPbConfiguratorGymEditorScreen = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorGymEditorScreenTag)) customElements.define(pbConfiguratorGymEditorScreenTag, PbConfiguratorGymEditorScreenElement);
};
registerPbConfiguratorGymEditorScreen();
