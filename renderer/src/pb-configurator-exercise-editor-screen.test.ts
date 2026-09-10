import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorExerciseEditorScreenTag,
  registerPbConfiguratorExerciseEditorScreen,
  type ConfiguratorExerciseEditorScreenState,
} from "./pb-configurator-exercise-editor-screen";

const createState = (
  status: "new" | "active" | "inactive" = "new",
): ConfiguratorExerciseEditorScreenState => ({
  mode: "edit",
  exercises: [
    { id: "exercise-1", name: "Barbell Squat", status, variant_count: 0 },
    { id: "exercise-2", name: "Bench Press", status: "new", variant_count: 2 },
  ],
  detail: { id: "exercise-1", name: "Barbell Squat", status, variant_count: 0 },
  isLoading: false,
  errorMessage: null,
});

describe("pb-configurator-exercise-editor-screen", () => {
  beforeEach(() => registerPbConfiguratorExerciseEditorScreen());

  it("creates a trimmed Draft Exercise and presents its read-only lifecycle detail", () => {
    const el = document.createElement(pbConfiguratorExerciseEditorScreenTag) as HTMLElement & {
      state: ConfiguratorExerciseEditorScreenState;
    };
    document.body.append(el);
    el.state = { ...createState(), mode: "create", detail: null };
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = "  Deadlift  ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-exercise"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({
      mode: "create",
      exerciseId: null,
      request: { name: "Deadlift" },
    });

    el.state = createState("active");
    expect(el.textContent).toContain("Status");
    expect(el.textContent).toContain("Active");
    expect(el.textContent).toContain("0 variants");
  });

  it("shows validation, draft-only deletion, and request failures in place", () => {
    const el = document.createElement(pbConfiguratorExerciseEditorScreenTag) as HTMLElement & {
      state: ConfiguratorExerciseEditorScreenState;
    };
    document.body.append(el);
    el.state = createState();
    const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    input.value = " bench press ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).toContain("Name must be unique.");
    expect(el.querySelector('[data-ui-action="delete-configurator-exercise"]')).toBeTruthy();

    el.state = createState("inactive");
    expect(el.querySelector('[data-ui-action="delete-configurator-exercise"]')).toBeNull();
    el.addEventListener("pb-ui-action", (event) => {
      const detail = (event as CustomEvent<{
        action: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>).detail;
      if (detail.action === "save-configurator-exercise") {
        detail.respond?.({ ok: false, errorMessage: "Name must be unique." });
      }
    });
    const renamed = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
    renamed.value = "Updated Squat";
    renamed.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-configurator-exercise"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="save-configurator-exercise"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("Name must be unique.");
    expect(el.querySelector('[data-field="name"]')).toBeTruthy();
  });

  it("requires confirmation before renaming active and inactive Exercises", () => {
    for (const status of ["active", "inactive"] as const) {
      const el = document.createElement(pbConfiguratorExerciseEditorScreenTag) as HTMLElement & {
        state: ConfiguratorExerciseEditorScreenState;
      };
      document.body.append(el);
      el.state = createState(status);
      const handler = vi.fn();
      el.addEventListener("pb-ui-action", handler);
      const input = el.querySelector<HTMLInputElement>('[data-field="name"]')!;
      input.value = "Renamed Squat";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      (el.querySelector('[data-ui-action="save-configurator-exercise"]') as HTMLButtonElement).click();
      expect(el.textContent).toContain("historical workouts");
      expect(handler).not.toHaveBeenCalled();
      (el.querySelector('[data-ui-action="save-configurator-exercise"]') as HTMLButtonElement).click();
      expect(handler.mock.calls[0]?.[0].detail.payload.request).toEqual({ name: "Renamed Squat" });
    }
  });

  it("emits a draft deletion request", () => {
    const el = document.createElement(pbConfiguratorExerciseEditorScreenTag) as HTMLElement & {
      state: ConfiguratorExerciseEditorScreenState;
    };
    document.body.append(el);
    el.state = createState();
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-ui-action="delete-configurator-exercise"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({ exerciseId: "exercise-1" });
  });

  it("confirms deletion only when a Draft Exercise has Variants", () => {
    const el = document.createElement(pbConfiguratorExerciseEditorScreenTag) as HTMLElement & {
      state: ConfiguratorExerciseEditorScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      detail: { ...createState().detail!, variant_count: 1 },
      variants: [{ id: "variant-1", exercise_id: "exercise-1", name: "Low Bar", status: "new", requires_station: false, load_input_mode: "TOTAL", set_tracking_mode: "BILATERAL", repetition_kind: "REPS" }],
    };
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    (el.querySelector('[data-ui-action="delete-configurator-exercise"]') as HTMLButtonElement).click();
    expect(el.textContent).toContain("Delete draft exercise?");
    expect(el.textContent).toContain("This will also delete 1 variant.");
    expect(handler).not.toHaveBeenCalled();

    (el.querySelector('[data-ui-action="dismiss-delete-exercise-warning"]') as HTMLButtonElement).click();
    (el.querySelector('[data-ui-action="delete-configurator-exercise"]') as HTMLButtonElement).click();
    (el.querySelector('.confirm-dialog [data-ui-action="delete-configurator-exercise"]') as HTMLButtonElement).click();
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({ exerciseId: "exercise-1" });
  });
});
