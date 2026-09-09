import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbConfiguratorGymEditorScreenTag, registerPbConfiguratorGymEditorScreen, type ConfiguratorGymEditorScreenState } from "./pb-configurator-gym-editor-screen";

const createState = (status: "new" | "active" | "inactive" = "new"): ConfiguratorGymEditorScreenState => ({
  mode: "edit", gyms: [{ id: "gym-1", name: "Alpha", status }, { id: "gym-2", name: "Bravo", status: "new" }],
  detail: { id: "gym-1", name: "Alpha", status, station_count: 0, last_visited_at: null, stations: [], exercise_groups: [] }, isLoading: false, errorMessage: null,
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

  it("requires confirmation before renaming a historical Gym", () => {
    const el = document.createElement(pbConfiguratorGymEditorScreenTag) as HTMLElement & { state: ConfiguratorGymEditorScreenState };
    document.body.append(el); el.state = createState("inactive");
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "Renamed"; input.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("historical workouts");
    expect(handler).not.toHaveBeenCalled();
    (el.querySelector('[data-ui-action="save-gym"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload.request).toEqual({ name: "Renamed" });
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
});
