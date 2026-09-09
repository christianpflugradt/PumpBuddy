import type { ConfiguratorStation, ConfiguratorStationCreateRequest, ConfiguratorStationUpdateRequest, LoadProfileSummary } from "./workout-contract";

export const pbConfiguratorStationEditorScreenTag = "pb-configurator-station-editor-screen";
export type ConfiguratorStationEditorScreenState = { gymId: string; gymName: string | null; station: ConfiguratorStation | null; loadProfiles: LoadProfileSummary[] };
type SaveResult = { ok: boolean; errorMessage?: string };
type SaveDetail = { action: "save-configurator-station"; payload: { gymId: string; stationId: string | null; request: ConfiguratorStationCreateRequest | ConfiguratorStationUpdateRequest }; respond: (result: SaveResult) => void };
type DeleteDetail = { action: "delete-configurator-station"; payload: { gymId: string; stationId: string }; respond: (result: SaveResult) => void };
const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const normalizeName = (value: string): string => value.trim().toLocaleLowerCase("en-US");

class PbConfiguratorStationEditorScreenElement extends HTMLElement {
  #state: ConfiguratorStationEditorScreenState = { gymId: "", gymName: null, station: null, loadProfiles: [] };
  #loadedKey: string | null = null;
  #nameDraft = "";
  #loadProfileIdDraft = "";
  #submitError: string | null = null;
  #isSaving = false;
  #isDeleting = false;
  #renameWarningOpen = false;
  #touched = false;

  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); this.addEventListener("input", this.#onInput); this.addEventListener("change", this.#onChange); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); this.removeEventListener("input", this.#onInput); this.removeEventListener("change", this.#onChange); }
  set state(value: ConfiguratorStationEditorScreenState) {
    this.#state = value;
    const key = value.station ? `edit:${value.station.id}` : `create:${value.gymId}`;
    if (key !== this.#loadedKey) {
      this.#loadedKey = key; this.#nameDraft = value.station?.name ?? ""; this.#loadProfileIdDraft = value.station?.load_profile.id ?? this.#availableProfiles()[0]?.id ?? "";
      this.#submitError = null; this.#isSaving = false; this.#isDeleting = false; this.#renameWarningOpen = false; this.#touched = false;
    }
    this.#render();
  }
  get state(): ConfiguratorStationEditorScreenState { return this.#state; }
  #isHistorical(): boolean { return this.#state.station?.status === "active" || this.#state.station?.status === "inactive"; }
  #availableProfiles(): LoadProfileSummary[] { const selectedId = this.#state.station?.load_profile.id; return this.#state.loadProfiles.filter((profile) => profile.status !== "inactive" || profile.id === selectedId); }
  #nameError(): string | null { return this.#nameDraft.trim() ? null : "Name is required."; }
  #loadProfileError(): string | null { return this.#loadProfileIdDraft ? null : "Load Profile is required."; }
  #hasChanges(): boolean { const station = this.#state.station; return !station || normalizeName(this.#nameDraft) !== normalizeName(station.name) || (!this.#isHistorical() && this.#loadProfileIdDraft !== station.load_profile.id); }
  #emit(action: string): void { this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action } })); }
  #onInput = (event: Event): void => {
    const input = event.target; if (!(input instanceof HTMLInputElement) || input.dataset.field !== "name") return;
    this.#nameDraft = input.value; this.#touched = true; this.#submitError = null; const start = input.selectionStart; const end = input.selectionEnd; this.#render();
    const next = this.querySelector<HTMLInputElement>('[data-field="name"]'); next?.focus(); if (start !== null && end !== null) next?.setSelectionRange(start, end);
  };
  #onChange = (event: Event): void => { const select = event.target; if (!(select instanceof HTMLSelectElement) || select.dataset.field !== "load-profile") return; this.#loadProfileIdDraft = select.value; this.#touched = true; this.#submitError = null; this.#render(); };
  #onClick = (event: Event): void => {
    const target = event.target; if (!(target instanceof Element)) return; const action = target.closest<HTMLElement>("[data-ui-action]")?.dataset.uiAction; if (!action) return;
    if (action === "navigate-back-from-configurator-station-detail") { this.#emit(action); return; }
    if (action === "dismiss-historical-rename-warning") { this.#renameWarningOpen = false; this.#render(); return; }
    if (action === "save-configurator-station") {
      const nameError = this.#nameError(); const loadProfileError = !this.#state.station ? this.#loadProfileError() : null;
      if (nameError || loadProfileError) { this.#touched = true; this.#submitError = nameError ?? loadProfileError; this.#render(); return; }
      if (this.#isHistorical() && this.#hasChanges() && !this.#renameWarningOpen) { this.#renameWarningOpen = true; this.#render(); return; }
      if (this.#isSaving || this.#isDeleting) return;
      const request = this.#state.station ? this.#isHistorical() ? { name: this.#nameDraft.trim() } : { name: this.#nameDraft.trim(), load_profile_id: this.#loadProfileIdDraft } : { name: this.#nameDraft.trim(), load_profile_id: this.#loadProfileIdDraft };
      this.#isSaving = true; this.#renameWarningOpen = false; this.#submitError = null; this.#render();
      this.dispatchEvent(new CustomEvent<SaveDetail>("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { gymId: this.#state.gymId, stationId: this.#state.station?.id ?? null, request }, respond: (result) => { this.#isSaving = false; this.#submitError = result.ok ? null : result.errorMessage ?? null; this.#render(); } } })); return;
    }
    if (action === "delete-configurator-station") {
      const station = this.#state.station; if (!station || station.status !== "new" || this.#isSaving || this.#isDeleting) return;
      this.#isDeleting = true; this.#submitError = null; this.#render();
      this.dispatchEvent(new CustomEvent<DeleteDetail>("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { gymId: this.#state.gymId, stationId: station.id }, respond: (result) => { this.#isDeleting = false; this.#submitError = result.ok ? null : result.errorMessage ?? null; this.#render(); } } }));
    }
  };
  #render(): void {
    const station = this.#state.station; const historical = this.#isHistorical(); const profiles = this.#availableProfiles(); const nameError = this.#nameError(); const loadProfileError = !station ? this.#loadProfileError() : null;
    const disabled = this.#isSaving || this.#isDeleting || !!nameError || !!loadProfileError || (!!station && !this.#hasChanges());
    const metadata = station && historical ? `<dl class="configurator-load-profile-metadata"><div><dt>Gym</dt><dd>${escapeHtml(this.#state.gymName ?? this.#state.gymId)}</dd></div><div><dt>Load Profile</dt><dd>${escapeHtml(station.load_profile.name)}</dd></div><div><dt>Status</dt><dd>${station.status === "active" ? "Active" : "Inactive"}</dd></div></dl>` : "";
    const profileField = historical ? "" : `<label class="configurator-gym-field"><span class="configurator-gym-field-label">Load Profile</span><select class="configurator-gym-input" data-field="load-profile" ${this.#isSaving || this.#isDeleting ? "disabled" : ""}>${profiles.map((profile) => `<option value="${escapeHtml(profile.id)}" ${profile.id === this.#loadProfileIdDraft ? "selected" : ""}>${escapeHtml(profile.name)}</option>`).join("")}</select>${loadProfileError && this.#touched ? `<span class="configurator-gym-field-error">${escapeHtml(loadProfileError)}</span>` : ""}</label>`;
    const warning = this.#renameWarningOpen ? `<div class="confirm-dialog-layer" role="presentation"><div class="confirm-dialog-backdrop" role="presentation"></div><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Historical rename warning"><p class="confirm-dialog-message">Renaming an active or inactive Station can affect how historical workouts are understood. Save this name change?</p><div class="confirm-dialog-actions"><button type="button" class="nav-button" data-ui-action="dismiss-historical-rename-warning">Keep Editing</button><button type="button" class="nav-button" data-ui-action="save-configurator-station">Save Name</button></div></section></div>` : "";
    this.innerHTML = `<div class="app-screen-shell"><button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-station-detail" aria-label="Back"><span aria-hidden="true">←</span></button><section class="screen-panel configurator-gym-editor-screen" aria-label="Station editor"><header class="exercise-variant-detail-header"><h1 class="exercise-variant-detail-header-title">${station ? "Station" : "New Station"}</h1></header><div class="configurator-gym-editor-card"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Name</span><input class="configurator-gym-input" data-field="name" value="${escapeHtml(this.#nameDraft)}" ${this.#isSaving || this.#isDeleting ? "disabled" : ""} />${nameError && this.#touched ? `<span class="configurator-gym-field-error">${escapeHtml(nameError)}</span>` : ""}</label>${profileField}${metadata}${this.#submitError ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>` : ""}<div class="configurator-gym-editor-actions"><button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-station" ${disabled ? "disabled" : ""}>${this.#isSaving ? "Saving..." : station ? historical ? "Save Name" : "Save Changes" : "Create Station"}</button>${station?.status === "new" ? `<button type="button" class="configurator-gym-delete-button" data-ui-action="delete-configurator-station" ${this.#isDeleting ? "disabled" : ""}>${this.#isDeleting ? "Deleting..." : "Delete Draft"}</button>` : ""}</div></div></section>${warning}</div>`;
  }
}

export const registerPbConfiguratorStationEditorScreen = (): void => { if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorStationEditorScreenTag)) customElements.define(pbConfiguratorStationEditorScreenTag, PbConfiguratorStationEditorScreenElement); };
registerPbConfiguratorStationEditorScreen();
