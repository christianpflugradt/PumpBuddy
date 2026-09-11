import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbConfiguratorExerciseVariantEditorScreenTag, registerPbConfiguratorExerciseVariantEditorScreen, type ConfiguratorExerciseVariantEditorScreenState } from "./pb-configurator-exercise-variant-editor-screen";

const state = (status: "new" | "active" | "inactive" = "new"): ConfiguratorExerciseVariantEditorScreenState => ({
  exerciseId: "exercise-1", exerciseName: "Cable Row", isLoading: false, errorMessage: null,
  variant: { id: "variant-1", exercise_id: "exercise-1", name: "Pronated", status, requires_station: true, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" },
});

describe("pb-configurator-exercise-variant-editor-screen", () => {
  beforeEach(() => registerPbConfiguratorExerciseVariantEditorScreen());
  it("emits parent-scoped draft save and delete actions", () => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el); el.state = state(); const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    const name = el.querySelector<HTMLInputElement>('[data-field="name"]')!; name.value = "Pronated grip"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-exercise-variant"]') as HTMLButtonElement).click();
    const save = handler.mock.calls[0][0].detail;
    expect(save.payload.exerciseId).toBe("exercise-1"); expect(save.payload.request).toEqual({ name: "Pronated grip", requires_station: true, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" });
    save.respond({ ok: true });
    (el.querySelector('[data-ui-action="delete-configurator-exercise-variant"]') as HTMLButtonElement).click();
    const deletion = handler.mock.calls[1][0].detail;
    expect(deletion.payload).toEqual({ exerciseId: "exercise-1", variantId: "variant-1" });
  });
  it("retains focus while typing a variant name", () => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el); el.state = { ...state(), variant: null };
    let input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.focus(); input.value = "C"; input.setSelectionRange(1, 1); input.dispatchEvent(new Event("input", { bubbles: true }));
    input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    expect(document.activeElement).toBe(input);
    input.value = "Ca"; input.setSelectionRange(2, 2); input.dispatchEvent(new Event("input", { bubbles: true }));
    input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    expect(document.activeElement).toBe(input); expect(input.value).toBe("Ca");
  });
  it.each(["active", "inactive"] as const)("requires confirmation before saving a renamed %s variant", (status) => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el); el.state = state(status); const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    expect(el.querySelector('[data-ui-action="delete-configurator-exercise-variant"]')).toBeNull();
    expect(el.querySelector('[data-field="load-input-mode"]')).toBeNull();
    const name = el.querySelector<HTMLInputElement>('[data-field="name"]')!; name.value = "Neutral"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-exercise-variant"]') as HTMLButtonElement).click();
    expect(handler).not.toHaveBeenCalled();
    expect(el.querySelector('[aria-label="Historical variant rename warning"]')).not.toBeNull();
    (el.querySelector('[data-ui-action="dismiss-historical-variant-rename-warning"]') as HTMLButtonElement).click();
    expect(el.querySelector<HTMLInputElement>('[data-field="name"]')!.value).toBe("Neutral");
    (el.querySelector('[data-ui-action="save-configurator-exercise-variant"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-exercise-variant"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0][0].detail.payload.request).toEqual({ name: "Neutral" });
  });
  it("renders compact gym-grouped Station rows only for station-required variants", () => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el);
    el.state = { ...state(), compatibility: { exercise_id: "exercise-1", variant_id: "variant-1", eligible_stations: [], enabled_stations: [
      { gym_id: "gym-1", gym_name: "North Gym", station_id: "station-1", station_name: "Cable Tower" },
      { gym_id: "gym-1", gym_name: "North Gym", station_id: "station-2", station_name: "Row Station" },
    ] } };
    expect(el.textContent).toContain("2 enabled");
    expect(el.querySelectorAll(".configurator-exercise-variant-station-groups > li")).toHaveLength(1);
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-station-id="station-1"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "open-configurator-exercise-variant-compatible-station", payload: { gymId: "gym-1", stationId: "station-1" } });
    el.state = { ...state(), variant: { ...state().variant!, requires_station: false }, compatibility: el.state.compatibility };
    expect(el.textContent).not.toContain("Compatible Stations");
  });
  it("filters by Station or Gym and persists only the saved staged selection", () => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el);
    const compatibility = { exercise_id: "exercise-1", variant_id: "variant-1", enabled_stations: [{ gym_id: "gym-1", gym_name: "North Gym", station_id: "station-1", station_name: "Cable Tower" }], eligible_stations: [{ gym_id: "gym-1", gym_name: "North Gym", station_id: "station-1", station_name: "Cable Tower" }, { gym_id: "gym-2", gym_name: "South Gym", station_id: "station-2", station_name: "Leg Press" }] };
    el.state = { ...state(), compatibility };
    const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-ui-action="open-configurator-exercise-variant-compatibility-picker"]') as HTMLButtonElement).click();
    const search = el.querySelector<HTMLInputElement>('[data-field="compatibility-search"]')!;
    search.value = "south"; search.dispatchEvent(new Event("input", { bubbles: true }));
    const options = el.querySelector(".configurator-exercise-variant-compatibility-picker-options")!;
    expect(options.textContent).toContain("Leg Press"); expect(options.textContent).not.toContain("Cable Tower");
    options.scrollTop = 96;
    (el.querySelector('[data-station-id="station-2"]') as HTMLButtonElement).click();
    expect((el.querySelector(".configurator-exercise-variant-compatibility-picker-options") as HTMLElement).scrollTop).toBe(96);
    (el.querySelector('[data-ui-action="dismiss-configurator-exercise-variant-compatibility-picker"]') as HTMLButtonElement).click();
    expect(handler).not.toHaveBeenCalled();
    (el.querySelector('[data-ui-action="open-configurator-exercise-variant-compatibility-picker"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("1 selected");
    (el.querySelector('[data-station-id="station-2"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-exercise-variant-compatibilities"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0][0].detail.payload).toEqual({ exerciseId: "exercise-1", variantId: "variant-1", stationIds: ["station-1", "station-2"] });
  });
  it("renders a dedicated Gym heading for each picker group", () => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el);
    el.state = { ...state(), compatibility: { exercise_id: "exercise-1", variant_id: "variant-1", enabled_stations: [], eligible_stations: [
      { gym_id: "gym-1", gym_name: "North Gym", station_id: "station-1", station_name: "Cable Tower" },
      { gym_id: "gym-2", gym_name: "South Gym with a deliberately long name", station_id: "station-2", station_name: "Leg Press" },
    ] } };
    (el.querySelector('[data-ui-action="open-configurator-exercise-variant-compatibility-picker"]') as HTMLButtonElement).click();
    const headings = el.querySelectorAll(".configurator-exercise-variant-compatibility-picker-gym-heading");
    expect(headings).toHaveLength(2);
    expect(headings[1].textContent).toBe("South Gym with a deliberately long name");
    expect(headings[1].nextElementSibling?.getAttribute("data-station-id")).toBe("station-2");
  });
});
