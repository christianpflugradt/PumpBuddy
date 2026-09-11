import type { ConfiguratorStation, ConfiguratorStationCompatibilityResponse, ConfiguratorStationCreateRequest, ConfiguratorStationUpdateRequest, LoadProfileSummary } from "./workout-contract";
import { TextInputBinding } from "./text-input-binding";

export const pbConfiguratorStationEditorScreenTag = "pb-configurator-station-editor-screen";
export type ConfiguratorStationEditorScreenState = {
  gymId: string;
  gymName: string | null;
  station: ConfiguratorStation | null;
  loadProfiles: LoadProfileSummary[];
  compatibility?: ConfiguratorStationCompatibilityResponse | null;
  isCompatibilityLoading?: boolean;
  compatibilityError?: string | null;
};
type SaveResult = { ok: boolean; errorMessage?: string };
type SaveDetail = { action: "save-configurator-station"; payload: { gymId: string; stationId: string | null; request: ConfiguratorStationCreateRequest | ConfiguratorStationUpdateRequest }; respond: (result: SaveResult) => void };
type DeleteDetail = { action: "delete-configurator-station"; payload: { gymId: string; stationId: string }; respond: (result: SaveResult) => void };
type SaveCompatibilityDetail = { action: "save-configurator-station-compatibilities"; payload: { gymId: string; stationId: string; exerciseVariantIds: string[] }; respond: (result: SaveResult) => void };
const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const normalizeName = (value: string): string => value.trim().toLocaleLowerCase("en-US");

class PbConfiguratorStationEditorScreenElement extends HTMLElement {
  #state: ConfiguratorStationEditorScreenState = { gymId: "", gymName: null, station: null, loadProfiles: [], compatibility: null, isCompatibilityLoading: false, compatibilityError: null };
  #loadedKey: string | null = null;
  #nameDraft = "";
  #loadProfileIdDraft = "";
  #submitError: string | null = null;
  #isSaving = false;
  #isDeleting = false;
  #renameWarningOpen = false;
  #touched = false;
  #loadProfilePickerOpen = false;
  #loadProfileSearch = "";
  #compatibilityPickerOpen = false;
  #compatibilitySearch = "";
  #compatibilitySelectionDraft = new Set<string>();
  #isCompatibilitySaving = false;
  #compatibilitySubmitError: string | null = null;
  #textInput = new TextInputBinding(this, ({ field, value }) => this.#onTextInput(field, value));

  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); this.#textInput.connect(); this.addEventListener("keydown", this.#onKeyDown); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); this.#textInput.disconnect(); this.removeEventListener("keydown", this.#onKeyDown); }
  set state(value: ConfiguratorStationEditorScreenState) {
    this.#state = value;
    const key = value.station ? `edit:${value.station.id}` : `create:${value.gymId}`;
    if (key !== this.#loadedKey) {
      this.#loadedKey = key; this.#nameDraft = value.station?.name ?? ""; const currentProfileId = value.station?.load_profile.id; this.#loadProfileIdDraft = currentProfileId && this.#availableProfiles().some((profile) => profile.id === currentProfileId) ? currentProfileId : value.station ? "" : this.#availableProfiles()[0]?.id ?? "";
      this.#submitError = null; this.#isSaving = false; this.#isDeleting = false; this.#renameWarningOpen = false; this.#touched = false; this.#loadProfilePickerOpen = false; this.#loadProfileSearch = "";
      this.#compatibilityPickerOpen = false; this.#compatibilitySearch = ""; this.#compatibilitySelectionDraft = new Set(); this.#isCompatibilitySaving = false; this.#compatibilitySubmitError = null;
    }
    this.#render();
  }
  get state(): ConfiguratorStationEditorScreenState { return this.#state; }
  #isHistorical(): boolean { return this.#state.station?.status === "active" || this.#state.station?.status === "inactive"; }
  #availableProfiles(): LoadProfileSummary[] { return this.#state.loadProfiles.filter((profile) => profile.status === "new" || profile.status === "active"); }
  #nameError(): string | null { return this.#nameDraft.trim() ? null : "Name is required."; }
  #loadProfileError(): string | null { return this.#loadProfileIdDraft && this.#availableProfiles().some((profile) => profile.id === this.#loadProfileIdDraft) ? null : "Load Profile is required."; }
  #hasChanges(): boolean { const station = this.#state.station; return !station || normalizeName(this.#nameDraft) !== normalizeName(station.name) || (!this.#isHistorical() && this.#loadProfileIdDraft !== station.load_profile.id); }
  #emit(action: string): void { this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action } })); }
  #onTextInput = (field: string, value: string): void => {
    if (field === "load-profile-search") { this.#loadProfileSearch = value; this.#render(); return; }
    if (field === "compatibility-search") { this.#compatibilitySearch = value; this.#render(); return; }
    if (field !== "name") return;
    this.#nameDraft = value; this.#touched = true; this.#submitError = null; this.#render();
  };
  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (this.#compatibilityPickerOpen) { event.preventDefault(); this.#dismissCompatibilityPicker(); return; }
    if (this.#loadProfilePickerOpen) { event.preventDefault(); this.#loadProfilePickerOpen = false; this.#render(); }
  };
  #openCompatibilityPicker(): void {
    const enabled = this.#state.compatibility?.enabled_variants ?? [];
    this.#compatibilitySelectionDraft = new Set(enabled.map((variant) => variant.variant_id));
    this.#compatibilitySearch = "";
    this.#compatibilitySubmitError = null;
    this.#compatibilityPickerOpen = true;
    this.#render();
  }
  #dismissCompatibilityPicker(): void {
    this.#compatibilityPickerOpen = false;
    this.#compatibilitySearch = "";
    this.#compatibilitySubmitError = null;
    this.#isCompatibilitySaving = false;
    this.#render();
  }
  #onClick = (event: Event): void => {
    const target = event.target; if (!(target instanceof Element)) return; const action = target.closest<HTMLElement>("[data-ui-action]")?.dataset.uiAction; if (!action) return;
    if (action === "navigate-back-from-configurator-station-detail") { this.#emit(action); return; }
    if (action === "open-configurator-station-compatibility-picker") { this.#openCompatibilityPicker(); return; }
    if (action === "dismiss-configurator-station-compatibility-picker") { this.#dismissCompatibilityPicker(); return; }
    if (action === "toggle-configurator-station-compatibility") {
      if (this.#isCompatibilitySaving) return;
      const variantId = target.closest<HTMLElement>("[data-variant-id]")?.dataset.variantId;
      if (!variantId || !(this.#state.compatibility?.eligible_variants ?? []).some((variant) => variant.variant_id === variantId)) return;
      if (this.#compatibilitySelectionDraft.has(variantId)) this.#compatibilitySelectionDraft.delete(variantId); else this.#compatibilitySelectionDraft.add(variantId);
      this.#compatibilitySubmitError = null; this.#render(); return;
    }
    if (action === "save-configurator-station-compatibilities") {
      const stationId = this.#state.station?.id;
      if (!stationId || this.#isCompatibilitySaving) return;
      this.#isCompatibilitySaving = true; this.#compatibilitySubmitError = null; this.#render();
      this.dispatchEvent(new CustomEvent<SaveCompatibilityDetail>("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { gymId: this.#state.gymId, stationId, exerciseVariantIds: [...this.#compatibilitySelectionDraft] }, respond: (result) => { this.#isCompatibilitySaving = false; if (result.ok) this.#dismissCompatibilityPicker(); else { this.#compatibilitySubmitError = result.errorMessage ?? "Unable to save compatible Exercise Variants right now."; this.#render(); } } } })); return;
    }
    if (action === "dismiss-historical-rename-warning") { this.#renameWarningOpen = false; this.#render(); return; }
    if (action === "open-load-profile-picker") { this.#loadProfilePickerOpen = true; this.#loadProfileSearch = ""; this.#render(); return; }
    if (action === "dismiss-load-profile-picker") { this.#loadProfilePickerOpen = false; this.#render(); return; }
    if (action === "choose-load-profile") { const profileId = target.closest<HTMLElement>("[data-profile-id]")?.dataset.profileId; if (!profileId || !this.#availableProfiles().some((profile) => profile.id === profileId)) return; this.#loadProfileIdDraft = profileId; this.#touched = true; this.#submitError = null; this.#loadProfilePickerOpen = false; this.#render(); return; }
    if (action === "save-configurator-station") {
      const nameError = this.#nameError(); const loadProfileError = !this.#isHistorical() ? this.#loadProfileError() : null;
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
  #renderLoadProfilePicker(profiles: LoadProfileSummary[]): string {
    if (!this.#loadProfilePickerOpen) return "";
    const query = this.#loadProfileSearch.trim().toLocaleLowerCase("en-US");
    const matches = profiles.filter((profile) => profile.name.toLocaleLowerCase("en-US").includes(query));
    return `<div class="secs-picker-layer" role="presentation"><button type="button" class="secs-picker-backdrop" data-ui-action="dismiss-load-profile-picker" aria-label="Close Load Profile picker"></button><section class="secs-picker-sheet configurator-load-profile-picker" role="dialog" aria-modal="true" aria-labelledby="configurator-load-profile-picker-title"><header class="configurator-load-profile-picker-header"><h2 id="configurator-load-profile-picker-title" class="secs-picker-title">Choose Load Profile</h2><input class="configurator-gym-input" data-field="load-profile-search" type="search" value="${escapeHtml(this.#loadProfileSearch)}" placeholder="Search Load Profiles" aria-label="Search Load Profiles" autocomplete="off" /></header><div class="configurator-load-profile-picker-options" role="listbox" aria-label="Available Load Profiles">${matches.length === 0 ? '<p class="start-copy">No matching Load Profiles.</p>' : matches.map((profile) => `<button type="button" class="configurator-load-profile-picker-option${profile.id === this.#loadProfileIdDraft ? " configurator-load-profile-picker-option--selected" : ""}" data-ui-action="choose-load-profile" data-profile-id="${escapeHtml(profile.id)}" role="option" aria-selected="${profile.id === this.#loadProfileIdDraft ? "true" : "false"}"><span>${escapeHtml(profile.name)}</span><small>${profile.status === "new" ? "Draft" : "Active"}</small></button>`).join("")}</div></section></div>`;
  }
  #renderCompatibilitySummary(): string {
    const station = this.#state.station;
    if (!station) return "";
    if (this.#state.isCompatibilityLoading) return `<section class="configurator-station-compatibility" aria-labelledby="compatible-exercise-variants-title"><div class="configurator-station-compatibility-header"><h2 id="compatible-exercise-variants-title">Compatible Exercise Variants</h2></div><p class="start-copy" role="status">Loading compatible Exercise Variants…</p></section>`;
    if (this.#state.compatibilityError) return `<section class="configurator-station-compatibility" aria-labelledby="compatible-exercise-variants-title"><div class="configurator-station-compatibility-header"><h2 id="compatible-exercise-variants-title">Compatible Exercise Variants</h2></div><p class="start-error" role="alert">${escapeHtml(this.#state.compatibilityError)}</p></section>`;
    const variants = this.#state.compatibility?.enabled_variants ?? [];
    const edit = `<button type="button" class="nav-button nav-button-secondary configurator-station-compatibility-edit" data-ui-action="open-configurator-station-compatibility-picker">Edit</button>`;
    const content = variants.length === 0
      ? `<p class="start-copy">No compatible Exercise Variants are enabled.</p>`
      : `<ul class="configurator-station-compatibility-list">${variants.map((variant) => `<li><span>${escapeHtml(variant.exercise_name)}</span><small>${escapeHtml(variant.variant_name)}</small></li>`).join("")}</ul>`;
    return `<section class="configurator-station-compatibility" aria-labelledby="compatible-exercise-variants-title"><div class="configurator-station-compatibility-header"><div><h2 id="compatible-exercise-variants-title">Compatible Exercise Variants</h2><p>${variants.length} enabled</p></div>${edit}</div>${content}</section>`;
  }
  #renderCompatibilityPicker(): string {
    if (!this.#compatibilityPickerOpen) return "";
    const variants = this.#state.compatibility?.eligible_variants ?? [];
    const query = this.#compatibilitySearch.trim().toLocaleLowerCase("en-US");
    const matches = variants.filter((variant) => `${variant.exercise_name} ${variant.variant_name}`.toLocaleLowerCase("en-US").includes(query));
    return `<div class="secs-picker-layer" role="presentation"><button type="button" class="secs-picker-backdrop" data-ui-action="dismiss-configurator-station-compatibility-picker" aria-label="Cancel compatible Exercise Variant selection"></button><section class="secs-picker-sheet configurator-station-compatibility-picker" role="dialog" aria-modal="true" aria-labelledby="configurator-station-compatibility-picker-title"><header class="configurator-load-profile-picker-header"><div><h2 id="configurator-station-compatibility-picker-title" class="secs-picker-title">Compatible Exercise Variants</h2><p class="configurator-station-compatibility-picker-count">${this.#compatibilitySelectionDraft.size} selected</p></div><input class="configurator-gym-input" data-field="compatibility-search" type="search" value="${escapeHtml(this.#compatibilitySearch)}" placeholder="Search Exercise Variants" aria-label="Search Exercise Variants" autocomplete="off" /></header><div class="configurator-station-compatibility-picker-options" role="group" aria-label="Eligible Exercise Variants">${matches.length === 0 ? '<p class="start-copy">No matching Exercise Variants.</p>' : matches.map((variant) => { const selected = this.#compatibilitySelectionDraft.has(variant.variant_id); return `<button type="button" class="configurator-station-compatibility-picker-option${selected ? " configurator-station-compatibility-picker-option--selected" : ""}" data-ui-action="toggle-configurator-station-compatibility" data-variant-id="${escapeHtml(variant.variant_id)}" role="checkbox" aria-checked="${selected}"><span><strong>${escapeHtml(variant.exercise_name)}</strong><small>${escapeHtml(variant.variant_name)} · ${escapeHtml(variant.repetition_kind)} · ${escapeHtml(variant.load_input_mode)}</small></span><span aria-hidden="true">${selected ? "✓" : ""}</span></button>`; }).join("")}</div>${this.#compatibilitySubmitError ? `<p class="start-error" role="alert">${escapeHtml(this.#compatibilitySubmitError)}</p>` : ""}<div class="configurator-station-compatibility-picker-actions"><button type="button" class="nav-button" data-ui-action="dismiss-configurator-station-compatibility-picker" ${this.#isCompatibilitySaving ? "disabled" : ""}>Cancel</button><button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-station-compatibilities" ${this.#isCompatibilitySaving ? "disabled" : ""}>${this.#isCompatibilitySaving ? "Saving..." : "Save"}</button></div></section></div>`;
  }
  #render(): void {
    const station = this.#state.station; const historical = this.#isHistorical(); const profiles = this.#availableProfiles(); const nameError = this.#nameError(); const loadProfileError = !historical ? this.#loadProfileError() : null;
    const disabled = this.#isSaving || this.#isDeleting || !!nameError || !!loadProfileError || (!!station && !this.#hasChanges());
    const metadata = station && historical ? `<dl class="configurator-load-profile-metadata"><div><dt>Gym</dt><dd>${escapeHtml(this.#state.gymName ?? this.#state.gymId)}</dd></div><div><dt>Load Profile</dt><dd>${escapeHtml(station.load_profile.name)}</dd></div><div><dt>Status</dt><dd>${station.status === "active" ? "Active" : "Inactive"}</dd></div></dl>` : "";
    const selectedProfile = profiles.find((profile) => profile.id === this.#loadProfileIdDraft);
    const profileField = historical ? "" : `<div class="configurator-gym-field"><span class="configurator-gym-field-label">Load Profile</span><button type="button" class="configurator-gym-input configurator-load-profile-picker-trigger" data-ui-action="open-load-profile-picker" aria-haspopup="dialog" aria-expanded="${this.#loadProfilePickerOpen ? "true" : "false"}" ${this.#isSaving || this.#isDeleting ? "disabled" : ""}>${escapeHtml(selectedProfile?.name ?? "Choose a Load Profile")}</button>${loadProfileError && this.#touched ? `<span class="configurator-gym-field-error">${escapeHtml(loadProfileError)}</span>` : ""}</div>`;
    const warning = this.#renameWarningOpen ? `<div class="confirm-dialog-layer" role="presentation"><div class="confirm-dialog-backdrop" role="presentation"></div><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Historical rename warning"><p class="confirm-dialog-message">Renaming an active or inactive Station can affect how historical workouts are understood. Save this name change?</p><div class="confirm-dialog-actions"><button type="button" class="nav-button" data-ui-action="dismiss-historical-rename-warning">Keep Editing</button><button type="button" class="nav-button" data-ui-action="save-configurator-station">Save Name</button></div></section></div>` : "";
    this.innerHTML = `<div class="app-screen-shell"><button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-station-detail" aria-label="Back"><span aria-hidden="true">←</span></button><section class="screen-panel configurator-gym-editor-screen" aria-label="Station editor"><header class="exercise-variant-detail-header configurator-app-header"><img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" /><h1 class="exercise-variant-detail-header-title">${station ? "Station" : "New Station"}</h1></header><div class="configurator-gym-editor-card"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Name</span><input class="configurator-gym-input" data-field="name" value="${escapeHtml(this.#nameDraft)}" ${this.#isSaving || this.#isDeleting ? "disabled" : ""} />${nameError && this.#touched ? `<span class="configurator-gym-field-error">${escapeHtml(nameError)}</span>` : ""}</label>${profileField}${metadata}${this.#renderCompatibilitySummary()}${this.#submitError ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>` : ""}<div class="configurator-gym-editor-actions"><button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-station" ${disabled ? "disabled" : ""}>${this.#isSaving ? "Saving..." : station ? historical ? "Save Name" : "Save Changes" : "Create Station"}</button>${station?.status === "new" ? `<button type="button" class="configurator-gym-delete-button" data-ui-action="delete-configurator-station" ${this.#isDeleting ? "disabled" : ""}>${this.#isDeleting ? "Deleting..." : "Delete Draft"}</button>` : ""}</div></div></section>${warning}${this.#renderLoadProfilePicker(profiles)}${this.#renderCompatibilityPicker()}</div>`;
  }
}

export const registerPbConfiguratorStationEditorScreen = (): void => { if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorStationEditorScreenTag)) customElements.define(pbConfiguratorStationEditorScreenTag, PbConfiguratorStationEditorScreenElement); };
registerPbConfiguratorStationEditorScreen();
