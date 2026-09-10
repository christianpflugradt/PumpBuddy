import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorExercisesScreenTag,
  registerPbConfiguratorExercisesScreen,
  type ConfiguratorExercisesScreenState,
} from "./pb-configurator-exercises-screen";

const createState = (): ConfiguratorExercisesScreenState => ({
  mode: "list",
  exercises: [
    { id: "exercise-new", name: "Alpha Draft", status: "new", variant_count: 0 },
    { id: "exercise-active", name: "Bravo Active", status: "active", variant_count: 1 },
    { id: "exercise-inactive", name: "Charlie Inactive", status: "inactive", variant_count: 2 },
  ],
  selectedExercise: null,
  isLoading: false,
  errorMessage: null,
});

describe("pb-configurator-exercises-screen", () => {
  beforeEach(() => registerPbConfiguratorExercisesScreen());

  it("renders searchable lifecycle-aware exercise cards", () => {
    const el = document.createElement(pbConfiguratorExercisesScreenTag) as HTMLElement & { state: ConfiguratorExercisesScreenState };
    document.body.append(el);
    el.state = createState();

    expect(el.textContent).toContain("Alpha Draft");
    expect(el.textContent).toContain("Draft");
    expect(el.textContent).toContain("1 variant");
    expect(el.textContent).toContain("2 variants");
    expect(el.querySelector(".configurator-exercise-card--inactive")).toBeTruthy();

    const search = el.querySelector<HTMLInputElement>('[data-role="exercise-search"]')!;
    search.value = "bravo";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent).toContain("Bravo Active");
    expect(el.textContent).not.toContain("Alpha Draft");
  });

  it("renders loading, error, empty, and no-search-result states", () => {
    const el = document.createElement(pbConfiguratorExercisesScreenTag) as HTMLElement & { state: ConfiguratorExercisesScreenState };
    document.body.append(el);
    el.state = { ...createState(), exercises: [], isLoading: true };
    expect(el.textContent).toContain("Loading exercises...");
    el.state = { ...createState(), exercises: [], errorMessage: "Unable to load exercises right now." };
    expect(el.textContent).toContain("Unable to load exercises right now.");
    el.state = { ...createState(), exercises: [] };
    expect(el.textContent).toContain("No exercises available yet.");
  });

  it("emits create, detail, and back actions without a Variant destination", () => {
    const el = document.createElement(pbConfiguratorExercisesScreenTag) as HTMLElement & { state: ConfiguratorExercisesScreenState };
    document.body.append(el);
    el.state = createState();
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);
    (el.querySelector('[data-ui-action="start-configurator-exercise-create"]') as HTMLButtonElement).click();
    (el.querySelector('[data-exercise-id="exercise-active"]') as HTMLButtonElement).click();
    el.state = { ...createState(), mode: "detail", selectedExercise: createState().exercises[1] };
    (el.querySelector('[data-ui-action="navigate-back-from-configurator-exercise-detail"]') as HTMLButtonElement).click();
    expect(handler.mock.calls.map((call) => call[0].detail)).toEqual([
      { action: "start-configurator-exercise-create" },
      { action: "open-configurator-exercise-detail", payload: { exerciseId: "exercise-active" } },
      { action: "navigate-back-from-configurator-exercise-detail" },
    ]);
  });
});
