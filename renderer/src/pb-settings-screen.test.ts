import { beforeEach, describe, expect, it } from "vitest";
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
});
