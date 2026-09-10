import { beforeEach, describe, expect, it } from "vitest";
import {
  pbConfiguratorOverviewScreenTag,
  registerPbConfiguratorOverviewScreen,
  type ConfiguratorOverviewScreenState,
} from "./pb-configurator-overview-screen";

describe("pb-configurator-overview-screen", () => {
  beforeEach(() => registerPbConfiguratorOverviewScreen());

  it("renders the compact total inventory without navigation rows", () => {
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
    expect(Array.from(el.querySelectorAll(".configurator-overview-row")).map((row) => row.textContent?.trim())).toEqual([
      "Load Profiles8", "Gyms4", "Stations23", "Exercises37", "Exercise Variants45",
    ]);
    expect(el.querySelector(".configurator-overview-list button")).toBeNull();
  });
});
