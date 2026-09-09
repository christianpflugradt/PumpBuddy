import type { ConfiguratorStation, LoadProfileSummary } from "./workout-contract";

export const pbConfiguratorStationEditorScreenTag = "pb-configurator-station-editor-screen";
export type ConfiguratorStationEditorScreenState = { gymId: string; station: ConfiguratorStation | null; loadProfiles: LoadProfileSummary[] };

const escapeHtml = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

class PbConfiguratorStationEditorScreenElement extends HTMLElement {
  #state: ConfiguratorStationEditorScreenState = { gymId: "", station: null, loadProfiles: [] };
  connectedCallback(): void { this.#render(); this.addEventListener("click", this.#onClick); }
  disconnectedCallback(): void { this.removeEventListener("click", this.#onClick); }
  set state(value: ConfiguratorStationEditorScreenState) { this.#state = value; this.#render(); }
  get state(): ConfiguratorStationEditorScreenState { return this.#state; }
  #emit(action: string): void { this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action } })); }
  #onClick = (event: Event): void => {
    const target = event.target; if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>("[data-ui-action]")?.dataset.uiAction;
    if (action === "navigate-back-from-configurator-station-detail") { this.#emit(action); return; }
    if (action === "save-configurator-station") {
      const name = this.querySelector<HTMLInputElement>("[data-field=name]")?.value.trim() ?? "";
      const loadProfileId = this.querySelector<HTMLSelectElement>("[data-field=load-profile]")?.value ?? "";
      if (!name || (!this.#state.station && !loadProfileId)) return;
      const request = this.#state.station?.status === "new" ? { name, load_profile_id: loadProfileId } : { name };
      this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { gymId: this.#state.gymId, stationId: this.#state.station?.id ?? null, request } } }));
      return;
    }
    if (action === "delete-configurator-station" && this.#state.station) this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { gymId: this.#state.gymId, stationId: this.#state.station.id } } }));
  };
  #render(): void {
    const station = this.#state.station;
    const historical = station?.status === "active" || station?.status === "inactive";
    const profiles = this.#state.loadProfiles.filter((profile) => profile.status !== "inactive" || profile.id === station?.load_profile.id);
    this.innerHTML = `<div class="app-screen-shell"><button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-station-detail" aria-label="Back"><span aria-hidden="true">←</span></button><section class="screen-panel configurator-gym-editor-screen" aria-label="Station editor"><header class="exercise-variant-detail-header"><h1 class="exercise-variant-detail-header-title">Station</h1></header><div class="configurator-gym-editor-card"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Name</span><input class="configurator-gym-input" data-field="name" value="${escapeHtml(station?.name ?? "")}" /></label><label class="configurator-gym-field"><span class="configurator-gym-field-label">Load Profile</span><select class="configurator-gym-input" data-field="load-profile" ${historical ? "disabled" : ""}>${profiles.map((profile) => `<option value="${escapeHtml(profile.id)}" ${profile.id === station?.load_profile.id ? "selected" : ""}>${escapeHtml(profile.name)}</option>`).join("")}</select></label>${station ? `<p class="start-copy">${station.status === "new" ? "Draft" : station.status === "active" ? "Active" : "Inactive"}</p>` : ""}<div class="configurator-gym-editor-actions"><button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-station">${station ? "Save Station" : "Create Station"}</button>${station?.status === "new" ? '<button type="button" class="configurator-gym-delete-button" data-ui-action="delete-configurator-station">Delete Draft</button>' : ""}</div></div></section></div>`;
  }
}
export const registerPbConfiguratorStationEditorScreen = (): void => { if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorStationEditorScreenTag)) customElements.define(pbConfiguratorStationEditorScreenTag, PbConfiguratorStationEditorScreenElement); };
registerPbConfiguratorStationEditorScreen();
