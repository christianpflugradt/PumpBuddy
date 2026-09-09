import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbSideMenuTag, registerPbSideMenu } from "./pb-side-menu";

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
  Array.from(el.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  ) ?? null;

const middleEntryLabels = (el: Element): string[] =>
  Array.from(el.querySelectorAll('[data-menu-group="middle"] button')).map(
    (button) => button.textContent?.trim() ?? "",
  );

describe("pb-side-menu", () => {
  beforeEach(() => {
    registerPbSideMenu();
  });

  it("renders the prescribed main navigation order with Workout as the only orange entry", () => {
    const el = document.createElement(pbSideMenuTag);
    el.setAttribute("active-screen", "progress");
    document.body.append(el);

    const entries = Array.from(el.querySelectorAll(".side-menu-entry"));
    const labels = entries.map((entry) => entry.textContent?.trim());
    const logoutEntry = buttonByText(el, "Log out");

    expect(labels).toEqual([
      "Workout",
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
      "Configurator",
      "Settings",
      "About",
      "Log out",
    ]);
    expect(entries[0]?.classList.contains("side-menu-entry--main-workout")).toBe(
      true,
    );
    expect(
      buttonByText(el, "Configurator")?.classList.contains(
        "side-menu-entry--main-workout",
      ),
    ).toBe(false);
    expect(entries[0]?.closest('[data-menu-group="primary"]')).toBeTruthy();
    expect(el.querySelectorAll(".side-menu-divider")).toHaveLength(2);
    expect(logoutEntry?.classList.contains("side-menu-entry--logout")).toBe(
      true,
    );
    expect(logoutEntry?.classList.contains("side-menu-entry--main-workout")).toBe(
      false,
    );
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

    const toggle = el.querySelector(
      '[data-ui-action="toggle-side-menu"]',
    ) as HTMLButtonElement | null;
    toggle?.click();
    expect(
      el.querySelector(".side-menu-shell")?.classList.contains("is-open"),
    ).toBe(true);

    buttonByText(el, "Settings")?.click();
    expect(handler).not.toHaveBeenCalled();
    expect(
      el.querySelector(".side-menu-shell")?.classList.contains("is-open"),
    ).toBe(false);

    buttonByText(el, "Workout")?.click();
    buttonByText(el, "Configurator")?.click();
    buttonByText(el, "Log out")?.click();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0]?.[0].detail).toEqual({
      action: "navigate-workout",
    });
    expect(handler.mock.calls[1]?.[0].detail).toEqual({
      action: "navigate-configurator-load-profiles",
    });
    expect(handler.mock.calls[2]?.[0].detail).toEqual({ action: "logout" });
  });

  it("closes when pressing the backdrop outside the menu panel", () => {
    const el = document.createElement(pbSideMenuTag);
    document.body.append(el);

    const toggle = el.querySelector(
      '[data-ui-action="toggle-side-menu"]',
    ) as HTMLButtonElement | null;
    toggle?.click();

    expect(
      el.querySelector(".side-menu-shell")?.classList.contains("is-open"),
    ).toBe(true);

    const backdrop = el.querySelector(
      ".side-menu-backdrop",
    ) as HTMLElement | null;
    backdrop?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(
      el.querySelector(".side-menu-shell")?.classList.contains("is-open"),
    ).toBe(false);
  });

  it("keeps the prescribed main navigation order", () => {
    const el = document.createElement(pbSideMenuTag);
    document.body.append(el);

    expect(middleEntryLabels(el)).toEqual([
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
      "Configurator",
    ]);
  });

  it("keeps the prescribed main navigation order while the menu is open", () => {
    const el = document.createElement(pbSideMenuTag);
    document.body.append(el);

    let toggle = el.querySelector(
      '[data-ui-action="toggle-side-menu"]',
    ) as HTMLButtonElement | null;
    toggle?.click();
    expect(middleEntryLabels(el)).toEqual([
      "Progress",
      "History",
      "Exercises",
      "Training Plans",
      "Gyms",
      "Configurator",
    ]);
  });

  it("renders configurator mode with a neutral return action, separators, and Gym navigation", () => {
    const el = document.createElement(pbSideMenuTag);
    el.setAttribute("mode", "configurator");
    el.setAttribute("active-screen", "configurator-load-profiles");
    document.body.append(el);

    const entries = Array.from(el.querySelectorAll(".side-menu-entry"));
    const workoutEntry = buttonByText(el, "Back to Workout");
    const loadProfilesEntry = buttonByText(el, "Load Profiles");
    const exercisePlaceholder = buttonByText(el, "Exercises (Soon)");
    const gymsEntry = buttonByText(el, "Gyms");

    expect(entries[0]?.textContent?.trim()).toBe("Back to Workout");
    expect(entries[1]?.textContent?.trim()).toBe("Load Profiles");
    expect(workoutEntry?.dataset.uiAction).toBe("navigate-workout");
    expect(loadProfilesEntry?.dataset.uiAction).toBe("close-side-menu");
    expect(
      workoutEntry?.classList.contains("side-menu-entry--main-workout"),
    ).toBe(false);
    expect(
      loadProfilesEntry?.classList.contains("side-menu-entry--main-workout"),
    ).toBe(false);
    expect(el.querySelectorAll(".side-menu-divider")).toHaveLength(2);
    expect(exercisePlaceholder?.disabled).toBe(true);
    expect(gymsEntry?.dataset.uiAction).toBe("navigate-configurator-gyms");
    expect(middleEntryLabels(el)).toEqual([
      "Load Profiles",
      "Exercises (Soon)",
      "Gyms",
    ]);
  });
});
