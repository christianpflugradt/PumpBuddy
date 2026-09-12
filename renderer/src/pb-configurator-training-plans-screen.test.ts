import { describe, expect, it } from "vitest";
import {
  pbConfiguratorTrainingPlansScreenTag,
  registerPbConfiguratorTrainingPlansScreen,
  type ConfiguratorTrainingPlansScreenState,
} from "./pb-configurator-training-plans-screen";

const createState = (): ConfiguratorTrainingPlansScreenState => ({
  mode: "list",
  trainingPlans: [{ id: "plan-1", name: "Upper", exercise_count: 1 }],
  exercises: [{ id: "exercise-1", name: "Bench press", status: "active", variant_count: 1, variants: [{ id: "variant-1", exercise_id: "exercise-1", name: "Barbell", status: "active", requires_station: true, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }] }],
  isLoading: false,
  errorMessage: null,
});

describe("pb-configurator-training-plans-screen", () => {
  registerPbConfiguratorTrainingPlansScreen();
  it("lists current plans and opens one", () => {
    const el = document.createElement(pbConfiguratorTrainingPlansScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlansScreenState };
    el.state = createState(); document.body.append(el);
    const actions: unknown[] = []; el.addEventListener("pb-ui-action", (event) => actions.push((event as CustomEvent).detail));
    expect(el.textContent).toContain("Upper");
    (el.querySelector('[data-training-plan-id="plan-1"]') as HTMLButtonElement).click();
    expect(actions).toEqual([{ action: "open-configurator-training-plan-detail", payload: { trainingPlanId: "plan-1" } }]);
    el.remove();
  });
  it("submits an initial Exercise and Variant, and displays rejected-save errors", () => {
    const el = document.createElement(pbConfiguratorTrainingPlansScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlansScreenState };
    el.state = createState(); document.body.append(el);
    let response: ((result: { ok: boolean; errorMessage?: string }) => void) | undefined;
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") response = detail.respond; });
    (el.querySelector('[data-ui-action="start-configurator-training-plan-create"]') as HTMLButtonElement).click();
    expect(el.querySelector(".configurator-training-plan-editor-card")).toBeTruthy();
    expect(el.querySelector(".configurator-gym-input[data-role=\"plan-name\"]")).toBeTruthy();
    expect(el.querySelector(".configurator-gym-input[data-role=\"plan-exercise\"]")).toBeTruthy();
    const name = el.querySelector('[data-role="plan-name"]') as HTMLInputElement; name.value = "Upper"; name.dispatchEvent(new Event("input", { bubbles: true }));
    const exercise = el.querySelector('[data-role="plan-exercise"]') as HTMLSelectElement; exercise.value = "exercise-1"; exercise.dispatchEvent(new Event("change", { bubbles: true }));
    const variant = el.querySelector('[data-role="plan-variant"]') as HTMLInputElement; variant.checked = true; variant.dispatchEvent(new Event("change", { bubbles: true }));
    expect(el.querySelector(".configurator-training-plan-create-variants")).toBeTruthy();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(response).toBeTypeOf("function"); response?.({ ok: false, errorMessage: "Variant is not valid." });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Variant is not valid.");
    el.remove();
  });
});
