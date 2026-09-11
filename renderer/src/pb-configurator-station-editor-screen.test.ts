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
    (el.querySelector('[data-ui-action="open-load-profile-picker"]') as HTMLButtonElement).click();
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    expect(el.textContent).not.toContain("Retired Stack");
    (el.querySelector('[data-profile-id="profile-2"]') as HTMLButtonElement).click();
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

  it("searches a scrollable picker and never offers inactive profiles for a draft reassignment", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = createState();
    (el.querySelector('[data-ui-action="open-load-profile-picker"]') as HTMLButtonElement).click();
    const search = el.querySelector('[data-field="load-profile-search"]') as HTMLInputElement;
    search.value = "draft"; search.dispatchEvent(new Event("input", { bubbles: true }));
    const options = el.querySelector('.configurator-load-profile-picker-options') as HTMLElement;
    expect(options).toBeTruthy();
    expect(options.textContent).toContain("Draft Stack");
    expect(options.textContent).not.toContain("Cable Stack");
    expect(el.textContent).not.toContain("Retired Stack");
  });

  it("requires a replacement when a draft Station retains an inactive Load Profile", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = { ...createState(), station: { ...createState().station!, load_profile: { id: "profile-3", name: "Retired Stack", status: "inactive" } } };
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "Updated Tower"; input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).toContain("Load Profile is required.");
    expect((el.querySelector('[data-ui-action="save-configurator-station"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders every backend-enabled compatible Exercise Variant with its Exercise context", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el);
    el.state = { ...createState(), compatibility: { gym_id: "gym-1", station_id: "station-1", eligible_variants: [], enabled_variants: [
      { exercise_id: "exercise-1", exercise_name: "Chest Press", variant_id: "variant-1", variant_name: "Machine", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" },
      { exercise_id: "exercise-2", exercise_name: "Row", variant_id: "variant-2", variant_name: "Cable", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" },
    ] } };
    expect(el.textContent).toContain("2 enabled");
    expect(el.textContent).toContain("Chest Press");
    expect(el.textContent).toContain("Machine");
    expect(el.textContent).toContain("Row");
    expect(el.textContent).toContain("Cable");
  });

  it("renders an explicit empty compatibility state and opens the picker", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = { ...createState(), compatibility: { gym_id: "gym-1", station_id: "station-1", eligible_variants: [], enabled_variants: [] } };
    expect(el.textContent).toContain("No compatible Exercise Variants are enabled.");
    const editButton = el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]') as HTMLButtonElement;
    expect(editButton.classList).toContain("nav-button-secondary");
    expect(editButton.classList).toContain("configurator-station-compatibility-edit");
    editButton.click();
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    expect(el.textContent).toContain("0 selected");
  });

  it("filters eligible variants and stages multi-selection without persisting toggles", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el);
    el.state = { ...createState(), compatibility: { gym_id: "gym-1", station_id: "station-1", enabled_variants: [{ exercise_id: "exercise-1", exercise_name: "Chest Press", variant_id: "variant-1", variant_name: "Machine", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }], eligible_variants: [{ exercise_id: "exercise-1", exercise_name: "Chest Press", variant_id: "variant-1", variant_name: "Machine", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }, { exercise_id: "exercise-2", exercise_name: "Seated Row", variant_id: "variant-2", variant_name: "Cable", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }] } };
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]') as HTMLButtonElement).click();
    const initialOptions = el.querySelector('.configurator-station-compatibility-picker-options') as HTMLElement;
    expect(initialOptions.textContent).toContain("Chest Press");
    expect(initialOptions.textContent).toContain("Machine");
    expect(initialOptions.textContent).not.toContain("REPS");
    expect(initialOptions.textContent).not.toContain("TOTAL");
    const search = el.querySelector<HTMLInputElement>('[data-field="compatibility-search"]')!;
    search.value = "row"; search.dispatchEvent(new Event("input", { bubbles: true }));
    const options = el.querySelector('.configurator-station-compatibility-picker-options') as HTMLElement;
    expect(options.textContent).toContain("Seated Row");
    expect(options.textContent).not.toContain("Chest Press");
    (el.querySelector('[data-variant-id="variant-2"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("2 selected");
    expect(handler).not.toHaveBeenCalled();
    expect(el.querySelector('.configurator-station-compatibility-picker')).toBeTruthy();
  });

  it("saves one completed selection and discards staged changes on Cancel or Escape", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el);
    el.state = { ...createState(), compatibility: { gym_id: "gym-1", station_id: "station-1", enabled_variants: [{ exercise_id: "exercise-1", exercise_name: "Chest Press", variant_id: "variant-1", variant_name: "Machine", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }], eligible_variants: [{ exercise_id: "exercise-1", exercise_name: "Chest Press", variant_id: "variant-1", variant_name: "Machine", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }, { exercise_id: "exercise-2", exercise_name: "Seated Row", variant_id: "variant-2", variant_name: "Cable", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }] } };
    const handler = vi.fn((event: Event) => { const detail = (event as CustomEvent<any>).detail; if (detail.action === "save-configurator-station-compatibilities") detail.respond({ ok: true }); });
    el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-variant-id="variant-2"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="dismiss-configurator-station-compatibility-picker"]') as HTMLButtonElement).click();
    expect(handler).not.toHaveBeenCalled();
    (el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("1 selected");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    (el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-variant-id="variant-2"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-station-compatibilities"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({ gymId: "gym-1", stationId: "station-1", exerciseVariantIds: ["variant-1", "variant-2"] });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it("retains staged selection after a compatibility save failure", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el);
    el.state = { ...createState(), compatibility: { gym_id: "gym-1", station_id: "station-1", enabled_variants: [], eligible_variants: [{ exercise_id: "exercise-2", exercise_name: "Seated Row", variant_id: "variant-2", variant_name: "Cable", repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL" }] } };
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent<any>).detail; if (detail.action === "save-configurator-station-compatibilities") detail.respond({ ok: false, errorMessage: "Selection is no longer eligible." }); });
    (el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-variant-id="variant-2"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-station-compatibilities"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("Selection is no longer eligible.");
    expect(el.textContent).toContain("1 selected");
    expect((el.querySelector('[data-variant-id="variant-2"]') as HTMLButtonElement).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps the summary failure-safe while compatibility data is loading or unavailable", () => {
    const el = document.createElement(pbConfiguratorStationEditorScreenTag) as HTMLElement & { state: ConfiguratorStationEditorScreenState };
    document.body.append(el); el.state = { ...createState(), isCompatibilityLoading: true };
    expect(el.textContent).toContain("Loading compatible Exercise Variants");
    el.state = { ...createState(), compatibilityError: "Unable to load compatible Exercise Variants right now." };
    expect(el.textContent).toContain("Unable to load compatible Exercise Variants right now.");
    expect(el.querySelector('[data-ui-action="open-configurator-station-compatibility-picker"]')).toBeNull();
  });
});
