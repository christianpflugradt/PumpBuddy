import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorGymsScreenTag,
  registerPbConfiguratorGymsScreen,
  type ConfiguratorGymsScreenState,
} from "./pb-configurator-gyms-screen";

describe("pb-configurator-gyms-screen", () => {
  beforeEach(() => registerPbConfiguratorGymsScreen());

  const createState = (): ConfiguratorGymsScreenState => ({
    mode: "list",
    gyms: [
      { id: "gym-new", name: "Alpha Draft", status: "new" },
      { id: "gym-active", name: "Bravo Active", status: "active" },
      { id: "gym-inactive", name: "Charlie Inactive", status: "inactive" },
    ],
    selectedGym: null,
    isLoading: false,
    errorMessage: null,
  });

  it("renders only name and mapped lifecycle status, with inactive rows subdued", () => {
    const el = document.createElement(pbConfiguratorGymsScreenTag) as HTMLElement & { state: ConfiguratorGymsScreenState };
    document.body.append(el);
    el.state = createState();

    expect(el.textContent).toContain("Alpha Draft");
    expect(el.textContent).toContain("Draft");
    expect(el.textContent).toContain("Bravo Active");
    expect(el.textContent).toContain("Active");
    expect(el.textContent).toContain("Charlie Inactive");
    expect(el.textContent).toContain("Inactive");
    expect(el.textContent).not.toContain("station");
    expect(el.querySelector(".configurator-gym-card--inactive")).toBeTruthy();
  });

  it("renders loading, error, and empty states", () => {
    const el = document.createElement(pbConfiguratorGymsScreenTag) as HTMLElement & { state: ConfiguratorGymsScreenState };
    document.body.append(el);
    el.state = { ...createState(), gyms: [], isLoading: true };
    expect(el.textContent).toContain("Loading gyms...");
    el.state = { ...createState(), gyms: [], errorMessage: "Unable to load gyms right now." };
    expect(el.textContent).toContain("Unable to load gyms right now.");
    el.state = { ...createState(), gyms: [] };
    expect(el.textContent).toContain("No gyms available yet.");
  });

  it("emits create, existing-detail, and back actions", () => {
    const el = document.createElement(pbConfiguratorGymsScreenTag) as HTMLElement & { state: ConfiguratorGymsScreenState };
    document.body.append(el);
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);
    el.state = createState();
    (el.querySelector('[data-ui-action="start-configurator-gym-create"]') as HTMLButtonElement).click();
    (el.querySelector('[data-gym-id="gym-active"]') as HTMLButtonElement).click();
    el.state = { ...createState(), mode: "create" };
    (el.querySelector('[data-ui-action="navigate-back-from-configurator-gym-detail"]') as HTMLButtonElement).click();
    expect(handler.mock.calls.map((call) => call[0].detail)).toEqual([
      { action: "start-configurator-gym-create" },
      { action: "open-configurator-gym-detail", payload: { gymId: "gym-active" } },
      { action: "navigate-back-from-configurator-gym-detail" },
    ]);
  });
});
