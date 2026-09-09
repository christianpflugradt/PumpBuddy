import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbConfiguratorGymEditorScreenTag, registerPbConfiguratorGymEditorScreen, type ConfiguratorGymEditorScreenState } from "./pb-configurator-gym-editor-screen";

const createState = (status: "new" | "active" | "inactive" = "new"): ConfiguratorGymEditorScreenState => ({
  mode: "edit", gyms: [{ id: "gym-1", name: "Alpha", status }, { id: "gym-2", name: "Bravo", status: "new" }],
  detail: { id: "gym-1", name: "Alpha", status, station_count: 0, last_visited_at: null, stations: [], exercise_groups: [] },
  stations: [{ id: "station-1", gym_id: "gym-1", name: "Cable Tower", load_profile: { id: "profile-1", name: "Cable Stack", status: "active" }, status: "new" }],
  isLoading: false, errorMessage: null,
});

describe("pb-configurator-gym-editor-screen", () => {
  beforeEach(() => registerPbConfiguratorGymEditorScreen());

  it("creates a trimmed Draft Gym with its single name field", () => {
    const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
    document.body.append(el); el.state = { ...createState(), mode: "create", detail: null };
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "  New Gym  "; input.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement).click();
    expect(el.querySelector("h1")?.textContent).toBe("Gym");
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({ mode: "create", gymId: null, request: { name: "New Gym" } });
  });

  it("shows client name feedback and keeps Draft-only deletion", () => {
    const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
    document.body.append(el); el.state = createState();
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = " bravo "; input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).toContain("Name must be unique.");
    expect(el.querySelector('[data-ui-action="delete-gym"]')).toBeTruthy();
    el.state = createState("active");
    expect(el.querySelector('[data-ui-action="delete-gym"]')).toBeNull();
  });

  it("keeps the editor open and presents request failures", () => {
    const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
    document.body.append(el); el.state = createState();
    el.addEventListener("pb-ui-action", (event) => {
      const detail = (event as CustomEvent<{ action: string; respond?: (result: { ok: boolean; errorMessage?: string }) => void }>).detail;
      if (detail.action === "save-configurator-gym") detail.respond?.({ ok: false, errorMessage: "Name must be unique." });
    });
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "Changed"; input.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("Name must be unique.");
    expect(el.querySelector('[data-field="name"]')).toBeTruthy();
  });

  it("requires confirmation before renaming active and inactive Gyms", () => {
    for (const status of ["active", "inactive"] as const) {
      const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
      document.body.append(el); el.state = createState(status);
      const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
      const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
      input.value = "Renamed"; input.dispatchEvent(new Event("input", { bubbles: true }));
      (el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement).click();
      expect(el.textContent).toContain("historical workouts");
      expect(handler).not.toHaveBeenCalled();
      (el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement).click();
      expect(handler.mock.calls[0]?.[0].detail.payload.request).toEqual({ name: "Renamed" });
    }
  });

  it("does not warn or save for a case-only historical name edit", () => {
    const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
    document.body.append(el); el.state = createState("active");
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "ALPHA"; input.dispatchEvent(new Event("input", { bubbles: true }));
    const saveButton = el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(el.textContent).not.toContain("historical workouts");
  });

  it("renders compact Stations and emits contextual create and detail actions", () => {
    const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
    document.body.append(el); el.state = createState();
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    expect(el.textContent).toContain("Cable Tower");
    expect(el.textContent).toContain("Cable Stack");
    expect(el.textContent).toContain("Draft");
    (el.querySelector('[data-ui-action="start-configurator-station-create"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="open-configurator-station-detail"]') as HTMLButtonElement).click();
    expect(handler.mock.calls.map((call) => call[0].detail)).toEqual([
      { action: "start-configurator-station-create", payload: { gymId: "gym-1" } },
      { action: "open-configurator-station-detail", payload: { gymId: "gym-1", stationId: "station-1" } },
    ]);
  });
});
