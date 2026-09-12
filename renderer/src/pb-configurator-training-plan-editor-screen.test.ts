import { beforeEach, describe, expect, it } from "vitest";
import { pbConfiguratorTrainingPlanEditorScreenTag, registerPbConfiguratorTrainingPlanEditorScreen, type ConfiguratorTrainingPlanEditorScreenState } from "./pb-configurator-training-plan-editor-screen";

const state = (): ConfiguratorTrainingPlanEditorScreenState => ({
  trainingPlanId: "plan-1", isLoading: false, errorMessage: null,
  exercises: [
    { id: "exercise-1", name: "Squat", status: "active", variant_count: 2, variants: [{ id: "variant-1", exercise_id: "exercise-1", name: "Back squat", status: "active", requires_station: false, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }, { id: "variant-2", exercise_id: "exercise-1", name: "Front squat", status: "active", requires_station: false, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }] },
    { id: "exercise-2", name: "Bench", status: "active", variant_count: 1, variants: [{ id: "variant-3", exercise_id: "exercise-2", name: "Barbell bench", status: "active", requires_station: false, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }] },
  ],
  detail: { id: "plan-1", name: "Upper", selected_version_number: 1, versions: [{ version_number: 1, is_current: true }], selected_gym_id: null, is_executable: null, execution_status: null, execution_summary: null, exercises: [{ training_plan_exercise_id: "plan-exercise-1", exercise_name: "Squat", exercise_position: 1, configured_variant_count: 1, executable_variant_count: null, execution_status: null, variants: [{ id: "configured-1", training_plan_exercise_id: "plan-exercise-1", variant_id: "variant-1", variant_name: "Back squat", requires_station: false, target_sets: 3, rep_min: 8, rep_max: 10, repetition_kind: "REPS", load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", availability: null, compatible_stations: [] }] }] },
});

const respondToSaveImpact = (el: HTMLElement, createsNewVersion: boolean): void => {
  el.addEventListener("pb-ui-action", (event) => {
    const detail = (event as CustomEvent).detail;
    if (detail.action === "assess-configurator-training-plan-save") {
      detail.respond({ ok: true, createsNewVersion });
    }
  });
};

describe("pb-configurator-training-plan-editor-screen", () => {
  beforeEach(() => registerPbConfiguratorTrainingPlanEditorScreen());
  it("uses compact Variant rows, counts variants in the Exercise heading, and hides a spent add action", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    respondToSaveImpact(el, false);
    expect(el.textContent).toContain("3 sets · 8–10 reps");
    expect(el.querySelector(".configurator-training-plan-editor-card")).toBeTruthy();
    expect(el.querySelector(".configurator-gym-input[data-field=\"plan-name\"]")).toBeTruthy();
    expect(el.querySelector(".configurator-training-plan-exercise-card")).toBeTruthy();
    expect(el.textContent).toContain("1. Squat 1/2 variants");
    expect(el.textContent).not.toContain("Allowed Variants");
    expect(el.textContent).not.toContain("Find Variant");
    expect(el.textContent).not.toContain("Remove Exercise");
    expect(el.querySelector('[data-variant-id="variant-1"][data-ui-action="add-plan-variant"]')).toBeNull();
    const remove = el.querySelector('[data-variant-id="variant-1"][data-ui-action="remove-plan-variant"]') as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    expect(el.querySelectorAll(".configurator-training-plan-remove")).toHaveLength(2);
    (el.querySelector('[data-ui-action="open-plan-variant-picker"]') as HTMLButtonElement).click();
    const options = el.querySelector('[role="listbox"]');
    expect(options?.textContent).toContain("Front squat");
    expect(options?.textContent).not.toContain("Back squat");
    const add = el.querySelector('[data-variant-id="variant-2"][data-ui-action="add-plan-variant"]') as HTMLButtonElement;
    add.click();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(el.querySelector('[data-variant-id="variant-2"][data-ui-action="add-plan-variant"]')).toBeNull();
    expect(el.textContent).toContain("1. Squat 2/2 variants");
    expect(el.querySelector('[data-exercise-id="exercise-1"][data-ui-action="open-plan-variant-picker"]')).toBeNull();
    expect((el.querySelector('[data-variant-id="variant-1"][data-ui-action="remove-plan-variant"]') as HTMLButtonElement).disabled).toBe(false);
    el.remove();
  });

  it("switches between normal editing and a compact reorder view without saving or losing the local draft", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    const editorState = state();
    const originalExercise = editorState.detail!.exercises[0];
    editorState.detail!.exercises.push({ ...originalExercise, id: "plan-exercise-2", exercise_name: "Bench", exercise_position: 2, variants: [{ ...originalExercise.variants[0], id: "configured-3", training_plan_exercise_id: "plan-exercise-2", variant_id: "variant-3", variant_name: "Barbell bench" }] });
    document.body.append(el); el.state = editorState;
    const actions: string[] = [];
    el.addEventListener("pb-ui-action", (event) => actions.push((event as CustomEvent).detail.action));

    expect(el.textContent).toContain("Exercises · 2");
    expect(el.querySelector('[data-ui-action="start-plan-exercise-reorder"]')).toBeTruthy();
    (el.querySelector('[data-ui-action="start-plan-exercise-reorder"]') as HTMLButtonElement).click();

    expect(el.textContent).toContain("Reorder Exercises · 2");
    expect(el.querySelectorAll(".configurator-training-plan-reorder-row")).toHaveLength(2);
    expect(el.textContent).toContain("Squat");
    expect(el.textContent).toContain("Bench");
    expect(el.querySelector(".configurator-training-plan-variant-list")).toBeNull();
    expect(el.querySelector('[data-ui-action="open-plan-exercise-picker"]')).toBeNull();
    expect(el.querySelector('[data-ui-action="remove-plan-exercise"]')).toBeNull();
    expect(el.querySelector('[data-ui-action="save-configurator-training-plan"]')).toBeNull();
    expect(actions).toEqual([]);

    (el.querySelector('[data-ui-action="finish-plan-exercise-reorder"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("Exercises · 2");
    expect(el.textContent).toContain("2. Bench");
    expect(actions).toEqual([]);
    el.remove();
  });

  it("saves an additive Variant change directly with the complete definition", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    respondToSaveImpact(el, false);
    const actions: Array<{ action: string; payload?: { request?: unknown } }> = [];
    el.addEventListener("pb-ui-action", (event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.action === "save-configurator-training-plan") actions.push(detail);
    });

    (el.querySelector('[data-ui-action="open-plan-variant-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-variant-id="variant-2"][data-ui-action="add-plan-variant"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action: "save-configurator-training-plan",
      payload: {
        trainingPlanId: "plan-1",
        request: {
          name: "Upper",
          exercises: [{ exercise_id: "exercise-1", allowed_variant_ids: ["variant-1", "variant-2"] }],
        },
      },
    });
    el.remove();
  });

  it("confirms a case-only rename without a version warning, then saves it", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    respondToSaveImpact(el, false);
    const saved: unknown[] = [];
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") saved.push(detail.payload.request); });
    const name = el.querySelector('[data-field="plan-name"]') as HTMLInputElement;
    name.value = "upper"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("historical workouts");
    expect(el.textContent).not.toContain("new Training Plan Version");
    (el.querySelector('[data-ui-action="confirm-training-plan-save"]') as HTMLButtonElement).click();
    expect(saved).toEqual([{ name: "upper", exercises: [{ exercise_id: "exercise-1", allowed_variant_ids: ["variant-1"] }] }]);
    el.remove();
  });

  it("confirms and saves a whitespace-only rename without normalizing it", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    respondToSaveImpact(el, false);
    const saved: unknown[] = [];
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") saved.push(detail.payload.request); });
    const name = el.querySelector('[data-field="plan-name"]') as HTMLInputElement;
    name.value = " Upper "; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("historical workouts");
    expect(saved).toEqual([]);
    (el.querySelector('[data-ui-action="confirm-training-plan-save"]') as HTMLButtonElement).click();
    expect(saved).toEqual([{ name: " Upper ", exercises: [{ exercise_id: "exercise-1", allowed_variant_ids: ["variant-1"] }] }]);
    el.remove();
  });

  it("adds one searchable Exercise through a picker and closes it immediately", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    respondToSaveImpact(el, true);

    expect(el.textContent).toContain("+ Add Exercise");
    expect(el.querySelector('[data-ui-action="add-plan-exercise"]')).toBeNull();
    (el.querySelector('[data-ui-action="open-plan-exercise-picker"]') as HTMLButtonElement).click();
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    const options = el.querySelector('[role="listbox"]');
    expect(options?.textContent).toContain("Bench");
    expect(options?.textContent).not.toContain("Squat");

    const search = el.querySelector('[data-field="exercise-search"]') as HTMLInputElement;
    search.value = "bench";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).toContain("Bench");

    (el.querySelector('[data-exercise-id="exercise-2"][data-ui-action="add-plan-exercise"]') as HTMLButtonElement).click();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(el.textContent).toContain("2. Bench");
    expect(el.querySelector('[data-ui-action="add-plan-exercise"]')).toBeNull();
    el.remove();
  });

  it("requires confirmation before saving an added Exercise", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    respondToSaveImpact(el, true);
    const saved: unknown[] = [];
    el.addEventListener("pb-ui-action", (event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.action === "save-configurator-training-plan") saved.push(detail.payload.request);
    });

    (el.querySelector('[data-ui-action="open-plan-exercise-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-exercise-id="exercise-2"][data-ui-action="add-plan-exercise"]') as HTMLButtonElement).click();
    (el.querySelector('[data-exercise-id="exercise-2"][data-ui-action="open-plan-variant-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-variant-id="variant-3"][data-ui-action="add-plan-variant"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();

    expect(el.textContent).toContain("new Training Plan Version");
    expect(saved).toEqual([]);
    (el.querySelector('[data-ui-action="confirm-training-plan-save"]') as HTMLButtonElement).click();
    expect(saved).toEqual([{
      name: "Upper",
      exercises: [{ exercise_id: "exercise-1", allowed_variant_ids: ["variant-1"] }, { exercise_id: "exercise-2", allowed_variant_ids: ["variant-3"] }],
    }]);
    el.remove();
  });

  it("requires confirmation before saving a removed Exercise", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    const editorState = state();
    const originalExercise = editorState.detail!.exercises[0];
    editorState.detail!.exercises.push({ ...originalExercise, id: "plan-exercise-2", exercise_name: "Bench", exercise_position: 2, variants: [{ ...originalExercise.variants[0], id: "configured-3", training_plan_exercise_id: "plan-exercise-2", variant_id: "variant-3", variant_name: "Barbell bench" }] });
    document.body.append(el); el.state = editorState;
    respondToSaveImpact(el, true);
    const saved: unknown[] = [];
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") saved.push(detail.payload.request); });
    (el.querySelector('[data-exercise-id="exercise-2"][data-ui-action="remove-plan-exercise"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("new Training Plan Version");
    (el.querySelector('[data-ui-action="confirm-training-plan-save"]') as HTMLButtonElement).click();
    expect(saved).toEqual([{ name: "Upper", exercises: [{ exercise_id: "exercise-1", allowed_variant_ids: ["variant-1"] }] }]);
    el.remove();
  });

  it("confirms a removed Variant, retains the draft on cancel, and emits the complete changed definition after confirmation", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    const editorState = state();
    editorState.detail!.exercises[0].variants.push({ ...editorState.detail!.exercises[0].variants[0], id: "configured-2", variant_id: "variant-2", variant_name: "Front squat" });
    document.body.append(el); el.state = editorState;
    respondToSaveImpact(el, true);
    const saved: unknown[] = [];
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") saved.push(detail.payload.request); });

    (el.querySelector('[data-variant-id="variant-2"][data-ui-action="remove-plan-variant"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("new Training Plan Version");
    (el.querySelector('[data-ui-action="dismiss-training-plan-save-confirmation"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("1/2 variants");
    expect(saved).toEqual([]);

    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="confirm-training-plan-save"]') as HTMLButtonElement).click();
    expect(saved).toEqual([{ name: "Upper", exercises: [{ exercise_id: "exercise-1", allowed_variant_ids: ["variant-1"] }] }]);
    el.remove();
  });

  it("combines rename and structural warnings, then keeps a failed save visible", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    const editorState = state();
    editorState.detail!.exercises[0].variants.push({ ...editorState.detail!.exercises[0].variants[0], id: "configured-2", variant_id: "variant-2", variant_name: "Front squat" });
    document.body.append(el); el.state = editorState;
    respondToSaveImpact(el, true);
    let response: ((result: { ok: boolean; errorMessage?: string }) => void) | undefined;
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") response = detail.respond; });
    const name = el.querySelector('[data-field="plan-name"]') as HTMLInputElement;
    name.value = "Renamed Upper"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-variant-id="variant-2"][data-ui-action="remove-plan-variant"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("historical workouts");
    expect(el.textContent).toContain("new Training Plan Version");
    (el.querySelector('[data-ui-action="confirm-training-plan-save"]') as HTMLButtonElement).click();
    expect(response).toBeTypeOf("function");
    response?.({ ok: false, errorMessage: "Save failed." });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Save failed.");
    expect((el.querySelector('[data-field="plan-name"]') as HTMLInputElement).value).toBe("Renamed Upper");
    el.remove();
  });
});
