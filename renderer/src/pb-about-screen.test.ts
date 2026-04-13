import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbAboutScreenTag, registerPbAboutScreen } from "./pb-about-screen";

describe("pb-about-screen", () => {
  beforeEach(() => {
    registerPbAboutScreen();
  });

  it("renders about shell content", () => {
    const el = document.createElement(pbAboutScreenTag);
    document.body.append(el);

    const text = el.textContent ?? "";
    expect(text).toContain("About");
    expect(text).toContain("PumpBuddy app information and build details.");
  });

  it("toggles side menu from burger button", () => {
    const el = document.createElement(pbAboutScreenTag);
    document.body.append(el);

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);
  });

  it("emits navigation and logout actions from side menu", () => {
    const el = document.createElement(pbAboutScreenTag);
    document.body.append(el);

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const settingsEntry = el.querySelector('[data-ui-action="navigate-settings"]') as HTMLButtonElement;
    const logoutEntry = el.querySelector('[data-ui-action="logout"]') as HTMLButtonElement;
    workoutEntry.click();
    settingsEntry.click();
    logoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-settings");
    expect(handler.mock.calls[2][0].detail.action).toBe("logout");
  });
});
