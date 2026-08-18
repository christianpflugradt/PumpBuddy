import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorLoadProfilesScreenTag,
  registerPbConfiguratorLoadProfilesScreen,
} from "./pb-configurator-load-profiles-screen";

describe("pb-configurator-load-profiles-screen", () => {
  beforeEach(() => {
    registerPbConfiguratorLoadProfilesScreen();
  });

  it("renders configurator copy and load profiles destination", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag);
    document.body.append(el);

    expect(el.textContent ?? "").toContain("Configurator");
    expect(el.textContent ?? "").toContain("Load Profiles");
    expect(
      el.querySelector('[data-ui-action="navigate-workout"]'),
    ).toBeTruthy();
  });

  it("emits workout return action from the configurator side menu", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag);
    document.body.append(el);

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector(
      '[data-ui-action="navigate-workout"]',
    ) as HTMLButtonElement | null;
    workoutEntry?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.action).toBe("navigate-workout");
  });
});
