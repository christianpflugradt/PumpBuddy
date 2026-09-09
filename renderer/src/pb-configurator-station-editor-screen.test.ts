import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbConfiguratorStationEditorScreenTag, registerPbConfiguratorStationEditorScreen, type ConfiguratorStationEditorScreenState } from "./pb-configurator-station-editor-screen";

const createState = (status: "new" | "active" | "inactive" = "new"): ConfiguratorStationEditorScreenState => ({
  gymId: "gym-1", gymName: "North Gym",
  station: { id: "station-1", gym_id: "gym-1", name: "Cable Tower", status, load_profile: { id: "profile-1", name: "Cable Stack", status: "active" } },
  loadProfiles: [
    { id: "profile-1", name: "Cable Stack", status: "active", definition_kind: "fixed_list", weight_unit: "KG", station_count: 1 },
    { id: "profile-2", name: "Draft Stack", status: "new", definition_kind: "fixed_list", weight_unit: "KG", station_count: 0 },
    { id: "profile-3", name: "Retired Stack", status: "inactive", definition_kind: "fixed_list", weight_unit: "KG", station_count: 0 },
  ],
});

describe("pb-configurator-station-editor-screen", () => {
  beforeEach(() => registerPbConfiguratorStationEditorScreen());

  it("creates a trimmed Draft Station with an assignable active or new Load Profile", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = { ...createState(), station: null };
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "  Row 1  "; input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).not.toContain("Retired Stack");
    (el.querySelector('[data-field="load-profile"]') as HTMLSelectElement).value = "profile-2";
    (el.querySelector('[data-field="load-profile"]') as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-station"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({ gymId: "gym-1", stationId: null, request: { name: "Row 1", load_profile_id: "profile-2" } });
  });

  it("shows client validation and server failures without leaving the editor", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = createState();
    (el.querySelector('[data-field="name"]') as HTMLInputElement).value = " ";
    (el.querySelector('[data-field="name"]') as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).toContain("Name is required.");
    el.state = createState();
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent<{ action: string; respond?: (result: { ok: boolean; errorMessage?: string }) => void }>).detail; if (detail.action === "save-configurator-station") detail.respond?.({ ok: false, errorMessage: "Name must be unique." }); });
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "Updated Tower"; input.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-station"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("Name must be unique.");
    expect(el.querySelector('[data-field="name"]')).toBeTruthy();
  });

  it("limits active and inactive Stations to rename after a historical warning", () => {
    for (const status of ["active", "inactive"] as const) {
      const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
      document.body.append(el); el.state = createState(status);
      const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
      expect(el.querySelector('[data-field="load-profile"]')).toBeNull();
      expect(el.querySelector('[data-ui-action="delete-configurator-station"]')).toBeNull();
      expect(el.textContent).toContain("North Gym"); expect(el.textContent).toContain("Cable Stack"); expect(el.textContent).toContain(status === "active" ? "Active" : "Inactive");
      const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
      input.value = "Renamed Tower"; input.dispatchEvent(new Event("input", { bubbles: true }));
      (el.querySelector('[data-ui-action="save-configurator-station"]') as HTMLButtonElement).click();
      expect(el.textContent).toContain("historical workouts"); expect(handler).not.toHaveBeenCalled();
      (el.querySelector('[data-ui-action="save-configurator-station"]') as HTMLButtonElement).click();
      expect(handler.mock.calls[0]?.[0].detail.payload.request).toEqual({ name: "Renamed Tower" });
    }
  });

  it("offers hard deletion only for a Draft Station", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = createState();
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-ui-action="delete-configurator-station"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({ gymId: "gym-1", stationId: "station-1" });
  });
});
