import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbSideMenuTag, registerPbSideMenu } from "./pb-side-menu";
import { resolveSideMenuStorageKey } from "./side-menu-preferences";

const activeScreens = [
  { screen: "workout", label: "Workout" },
  { screen: "progress", label: "Progress" },
  { screen: "exercises", label: "Exercises" },
  { screen: "training-plans", label: "Training Plans" },
  { screen: "gyms", label: "Gyms" },
  { screen: "history", label: "History" },
  { screen: "settings", label: "Settings" },
  { screen: "about", label: "About" },
] as const;

const buttonByText = (el: Element, label: string): HTMLButtonElement | null =>
  Array.from(el.querySelectorAll("button")).find((button) => button.textContent?.trim() === label) ?? null;

const middleEntryLabels = (el: Element): string[] =>
  Array.from(el.querySelectorAll('[data-menu-group="middle"] button')).map(
    (button) => button.textContent?.trim() ?? "",
  );

describe("pb-side-menu", () => {
  beforeEach(() => {
    registerPbSideMenu();
    window.localStorage.clear();
  });

  it("renders Workout first with primary styling and separates utility actions", () => {
    const el = document.createElement(pbSideMenuTag);
    el.setAttribute("active-screen", "progress");
    document.body.append(el);

    const entries = Array.from(el.querySelectorAll(".side-menu-entry"));
    const utilityItems = Array.from(el.querySelectorAll('[data-menu-group="utility"]'));
    const logoutEntry = buttonByText(el, "Log out");

    expect(entries[0]?.textContent?.trim()).toBe("Workout");
    expect(entries[0]?.classList.contains("side-menu-entry--primary")).toBe(true);
    expect(entries[0]?.closest('[data-menu-group="primary"]')).toBeTruthy();
    expect(middleEntryLabels(el)).toEqual([
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
    ]);
    expect(utilityItems.map((item) => item.textContent?.trim())).toEqual([
      "Settings",
      "About",
      "Log out",
    ]);
    expect(utilityItems[0]?.classList.contains("side-menu-item--utility-start")).toBe(true);
    expect(logoutEntry?.classList.contains("side-menu-entry--logout")).toBe(true);
    expect(logoutEntry?.classList.contains("side-menu-entry--primary")).toBe(false);
  });

  it("maps every active screen entry to close-side-menu", () => {
    for (const { screen, label } of activeScreens) {
      const el = document.createElement(pbSideMenuTag);
      el.setAttribute("active-screen", screen);
      document.body.append(el);

      expect(buttonByText(el, label)?.dataset.uiAction).toBe("close-side-menu");
      el.remove();
    }
  });

  it("owns open state and emits navigation and logout actions", () => {
    const el = document.createElement(pbSideMenuTag);
    el.setAttribute("active-screen", "settings");
    document.body.append(el);

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement | null;
    toggle?.click();
    expect(el.querySelector(".side-menu-shell")?.classList.contains("is-open")).toBe(true);

    buttonByText(el, "Settings")?.click();
    expect(handler).not.toHaveBeenCalled();
    expect(el.querySelector(".side-menu-shell")?.classList.contains("is-open")).toBe(false);

    buttonByText(el, "Workout")?.click();
    buttonByText(el, "Log out")?.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]?.[0].detail).toEqual({ action: "navigate-workout" });
    expect(handler.mock.calls[1]?.[0].detail).toEqual({ action: "logout" });
  });

  it("closes when pressing the backdrop outside the menu panel", () => {
    const el = document.createElement(pbSideMenuTag);
    document.body.append(el);

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement | null;
    toggle?.click();

    expect(el.querySelector(".side-menu-shell")?.classList.contains("is-open")).toBe(true);

    const backdrop = el.querySelector(".side-menu-backdrop") as HTMLElement | null;
    backdrop?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(el.querySelector(".side-menu-shell")?.classList.contains("is-open")).toBe(false);
  });

  it("orders middle entries by stored user counts with default tie breaks", () => {
    window.localStorage.setItem(
      resolveSideMenuStorageKey("user-a"),
      JSON.stringify({
        history: 2,
        gyms: 2,
        exercises: 1,
      }),
    );

    const el = document.createElement(pbSideMenuTag);
    el.setAttribute("user-id", "user-a");
    document.body.append(el);

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement | null;
    toggle?.click();

    expect(middleEntryLabels(el)).toEqual([
      "History",
      "Gyms",
      "Exercises",
      "Progress",
      "Training Plans",
    ]);
  });

  it("isolates ordering by user and falls back for corrupt stored counts", () => {
    window.localStorage.setItem(resolveSideMenuStorageKey("user-a"), JSON.stringify({ gyms: 3 }));
    window.localStorage.setItem(resolveSideMenuStorageKey("user-b"), "not-json");

    const userA = document.createElement(pbSideMenuTag);
    userA.setAttribute("user-id", "user-a");
    document.body.append(userA);

    const userB = document.createElement(pbSideMenuTag);
    userB.setAttribute("user-id", "user-b");
    document.body.append(userB);

    expect(middleEntryLabels(userA)[0]).toBe("Gyms");
    expect(middleEntryLabels(userB)).toEqual([
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
    ]);
  });

  it("keeps the open menu order stable until the next open", () => {
    const el = document.createElement(pbSideMenuTag);
    el.setAttribute("user-id", "user-a");
    document.body.append(el);

    let toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement | null;
    toggle?.click();
    expect(middleEntryLabels(el)).toEqual([
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
    ]);

    window.localStorage.setItem(resolveSideMenuStorageKey("user-a"), JSON.stringify({ history: 5 }));
    el.setAttribute("menu-id", "changed-while-open");
    expect(middleEntryLabels(el)).toEqual([
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
    ]);

    toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement | null;
    toggle?.click();
    toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement | null;
    toggle?.click();

    expect(middleEntryLabels(el)[0]).toBe("History");
  });
});
