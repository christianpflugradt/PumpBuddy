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

describe("pb-configurator-training-plan-editor-screen", () => {
  beforeEach(() => registerPbConfiguratorTrainingPlanEditorScreen());
  it("scopes variant choices, prevents duplicates, and protects the final variant", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    expect(el.textContent).toContain("3 sets · 8–10 reps");
    expect(el.querySelector(".configurator-training-plan-editor-card")).toBeTruthy();
    expect(el.querySelector(".configurator-gym-input[data-field=\"plan-name\"]")).toBeTruthy();
    expect(el.querySelector(".configurator-training-plan-exercise-card")).toBeTruthy();
    expect(el.querySelector('[data-variant-id="variant-1"][data-ui-action="add-plan-variant"]')).toBeNull();
    expect(el.querySelector('[data-variant-id="variant-3"][data-ui-action="add-plan-variant"]')).toBeNull();
    const remove = el.querySelector('[data-variant-id="variant-1"][data-ui-action="remove-plan-variant"]') as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    const add = el.querySelector('[data-variant-id="variant-2"][data-ui-action="add-plan-variant"]') as HTMLButtonElement;
    add.click();
    expect(el.querySelector('[data-variant-id="variant-2"][data-ui-action="add-plan-variant"]')).toBeNull();
    expect((el.querySelector('[data-variant-id="variant-1"][data-ui-action="remove-plan-variant"]') as HTMLButtonElement).disabled).toBe(false);
    el.remove();
  });

  it("saves an additive Variant change directly with the complete definition", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    const actions: Array<{ action: string; payload?: { request?: unknown } }> = [];
    el.addEventListener("pb-ui-action", (event) => actions.push((event as CustomEvent).detail));

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

  it("requires confirmation before saving a structural edit", () => {
    const el = document.createElement(pbConfiguratorTrainingPlanEditorScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlanEditorScreenState };
    document.body.append(el); el.state = state();
    let confirm: (() => void) | undefined;
    const saved: unknown[] = [];
    el.addEventListener("pb-ui-action", (event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.action === "confirm-configurator-training-plan-save") confirm = detail.respond;
      if (detail.action === "save-configurator-training-plan") saved.push(detail.payload.request);
    });

    (el.querySelector('[data-ui-action="remove-plan-exercise"]') as HTMLButtonElement).click();
    (el.querySelector('[data-exercise-id="exercise-2"][data-ui-action="add-plan-exercise"]') as HTMLButtonElement).click();
    (el.querySelector('[data-variant-id="variant-3"][data-ui-action="add-plan-variant"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();

    expect(confirm).toBeTypeOf("function");
    expect(saved).toEqual([]);
    confirm?.();
    expect(saved).toEqual([{
      name: "Upper",
      exercises: [{ exercise_id: "exercise-2", allowed_variant_ids: ["variant-3"] }],
    }]);
    el.remove();
  });
});
