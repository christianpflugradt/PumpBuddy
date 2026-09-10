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
  it("renders structural fields read-only while retaining name saves for historical variants", () => {
    const el = document.createElement(pbConfiguratorExerciseVariantEditorScreenTag) as HTMLElement & { state: ConfiguratorExerciseVariantEditorScreenState };
    document.body.append(el); el.state = state("active"); const handler = vi.fn(); el.addEventListener("pb-ui-action", handler);
    expect(el.querySelector('[data-ui-action="delete-configurator-exercise-variant"]')).toBeNull();
    expect(el.querySelector('[data-field="load-input-mode"]')).toBeNull();
    const name = el.querySelector<HTMLInputElement>('[data-field="name"]')!; name.value = "Neutral"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-exercise-variant"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0][0].detail.payload.request).toEqual({ name: "Neutral" });
  });
});
