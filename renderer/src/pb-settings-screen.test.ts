import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbSettingsScreenTag,
  registerPbSettingsScreen,
  type SettingsScreenState,
} from "./pb-settings-screen";

describe("pb-settings-screen", () => {
  beforeEach(() => {
    registerPbSettingsScreen();
  });

  const createState = (): SettingsScreenState => ({
    sessionUser: {
      id: "f8e58e03-f5f2-4923-bec6-4d2c0ecdb126",
      displayName: "Jordan",
    },
  });

  it("renders session user fields using user.id and user.display_name mapping", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);

    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("User name");
    expect(text).toContain("Display name");
    expect(text).toContain("f8e58e03-f5f2-4923-bec6-4d2c0ecdb126");
    expect(text).toContain("Jordan");
  });

  it("uses unavailable fallback values when session user is missing", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);

    el.state = { sessionUser: null };

    const text = el.textContent ?? "";
    expect(text).toContain("Unavailable");
  });

  it("toggles side menu from burger button", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);
  });

  it("closes side menu when clicking outside menu panel", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);
  });

  it("emits navigate-workout action from side menu entry", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    workoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
  });

  it("emits logout action from side menu entry", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const logoutEntry = el.querySelector('[data-ui-action="logout"]') as HTMLButtonElement;
    logoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("logout");
  });

  it("closes side menu when clicking settings entry while already on settings screen", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);

    const settingsEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    settingsEntry.click();

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);
  });
});
