import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorOverviewScreenTag,
  registerPbConfiguratorOverviewScreen,
  type ConfiguratorOverviewScreenState,
} from "./pb-configurator-overview-screen";

describe("pb-configurator-overview-screen", () => {
  beforeEach(() => registerPbConfiguratorOverviewScreen());

  it("renders the compact inventory as navigable rows", () => {
    const el = document.createElement(pbConfiguratorOverviewScreenTag) as HTMLElement & {
      state: ConfiguratorOverviewScreenState;
    };
    document.body.append(el);
    el.state = {
      counts: { loadProfiles: 8, gyms: 4, stations: 23, exercises: 37, exerciseVariants: 45 },
      isLoading: false,
      errorMessage: null,
    };

    expect(el.querySelector("h1")?.textContent).toBe("Configurator");
    expect(el.textContent).toContain("Manage the building blocks of your workout setup.");
    const rows = Array.from(el.querySelectorAll<HTMLButtonElement>(".configurator-overview-row"));
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      "Load Profiles8›", "Gyms4›", "Stations23›", "Exercises37›", "Exercise Variants45›",
    ]);
    expect(rows.map((row) => row.dataset.uiAction)).toEqual([
      "navigate-configurator-load-profiles",
      "navigate-configurator-gyms",
      "navigate-configurator-gyms",
      "navigate-configurator-exercises",
      "navigate-configurator-exercises",
    ]);
    expect(el.querySelector(".configurator-overview-configure-button")?.textContent).toBe("Configure");
  });

  it("emits the selected row navigation action", () => {
    const el = document.createElement(pbConfiguratorOverviewScreenTag) as HTMLElement & { state: ConfiguratorOverviewScreenState };
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);
    document.body.append(el);

    (el.querySelectorAll<HTMLButtonElement>(".configurator-overview-row")[3]).click();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ detail: { action: "navigate-configurator-exercises" } }));
  });

  it("opens the existing Configurator side menu from Configure", () => {
    const el = document.createElement(pbConfiguratorOverviewScreenTag) as HTMLElement & { state: ConfiguratorOverviewScreenState };
    document.body.append(el);

    (el.querySelector(".configurator-overview-configure-button") as HTMLButtonElement).click();

    expect(el.querySelector('pb-side-menu [data-ui-action="toggle-side-menu"]')?.getAttribute("aria-expanded")).toBe("true");
  });
});
