import { describe, expect, it } from "vitest";
import {
  pbConfiguratorTrainingPlansScreenTag,
  registerPbConfiguratorTrainingPlansScreen,
  type ConfiguratorTrainingPlansScreenState,
} from "./pb-configurator-training-plans-screen";

const createState = (): ConfiguratorTrainingPlansScreenState => ({
  mode: "list",
  trainingPlans: [{ id: "plan-1", name: "Upper", exercise_count: 1 }],
  exercises: [
    { id: "exercise-1", name: "Bench press", status: "active", variant_count: 2, variants: [{ id: "variant-1", exercise_id: "exercise-1", name: "Barbell", status: "active", requires_station: true, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }, { id: "variant-2", exercise_id: "exercise-1", name: "Dumbbell", status: "active", requires_station: true, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }] },
    { id: "exercise-2", name: "Squat", status: "active", variant_count: 1, variants: [{ id: "variant-3", exercise_id: "exercise-2", name: "Back squat", status: "active", requires_station: true, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }] },
  ],
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
    const card = el.querySelector('[data-training-plan-id="plan-1"]') as HTMLButtonElement;
    expect(card.querySelector(":scope > .configurator-training-plan-card-name")?.textContent).toBe("Upper");
    expect(card.querySelector(":scope > .configurator-training-plan-card-exercise-count")?.textContent).toBe("1 exercise");
    card.click();
    expect(actions).toEqual([{ action: "open-configurator-training-plan-detail", payload: { trainingPlanId: "plan-1" } }]);
    el.remove();
  });
  it("uses searchable, Exercise-scoped pickers for initial structure and prevents duplicate Variants", () => {
    const el = document.createElement(pbConfiguratorTrainingPlansScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlansScreenState };
    el.state = createState(); document.body.append(el);
    let response: ((result: { ok: boolean; errorMessage?: string }) => void) | undefined;
    el.addEventListener("pb-ui-action", (event) => { const detail = (event as CustomEvent).detail; if (detail.action === "save-configurator-training-plan") response = detail.respond; });
    (el.querySelector('[data-ui-action="start-configurator-training-plan-create"]') as HTMLButtonElement).click();
    expect(el.querySelector(".configurator-training-plan-editor-card")).toBeTruthy();
    expect(el.querySelector(".configurator-gym-input[data-role=\"plan-name\"]")).toBeTruthy();
    const name = el.querySelector('[data-role="plan-name"]') as HTMLInputElement; name.value = "Upper"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="open-create-plan-exercise-picker"]') as HTMLButtonElement).click();
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    const exerciseSearch = el.querySelector('[data-role="exercise-search"]') as HTMLInputElement;
    exerciseSearch.value = "bench"; exerciseSearch.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.querySelector('[role="listbox"]')?.textContent).toContain("Bench press");
    expect(el.querySelector('[role="listbox"]')?.textContent).not.toContain("Squat");
    (el.querySelector('[data-ui-action="select-create-plan-exercise"][data-exercise-id="exercise-1"]') as HTMLButtonElement).click();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    (el.querySelector('[data-ui-action="open-create-plan-variant-picker"]') as HTMLButtonElement).click();
    const variantSearch = el.querySelector('[data-role="variant-search"]') as HTMLInputElement;
    variantSearch.value = "barbell"; variantSearch.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.querySelector('[role="listbox"]')?.textContent).toContain("Barbell");
    expect(el.querySelector('[role="listbox"]')?.textContent).not.toContain("Dumbbell");
    (el.querySelector('[data-ui-action="select-create-plan-variant"][data-variant-id="variant-1"]') as HTMLButtonElement).click();
    expect(el.querySelector('[data-ui-action="select-create-plan-variant"][data-variant-id="variant-1"]')).toBeNull();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(response).toBeTypeOf("function"); response?.({ ok: false, errorMessage: "Variant is not valid." });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Variant is not valid.");
    el.remove();
  });
  it("rejects creation without an allowed Variant", () => {
    const el = document.createElement(pbConfiguratorTrainingPlansScreenTag) as HTMLElement & { state: ConfiguratorTrainingPlansScreenState };
    el.state = createState(); document.body.append(el);
    (el.querySelector('[data-ui-action="start-configurator-training-plan-create"]') as HTMLButtonElement).click();
    const name = el.querySelector('[data-role="plan-name"]') as HTMLInputElement; name.value = "Upper"; name.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="open-create-plan-exercise-picker"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="select-create-plan-exercise"][data-exercise-id="exercise-1"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-training-plan"]') as HTMLButtonElement).click();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Choose at least one allowed variant.");
    el.remove();
  });
});
