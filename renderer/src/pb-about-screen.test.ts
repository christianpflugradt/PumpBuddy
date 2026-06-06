import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbAboutScreenTag, registerPbAboutScreen } from "./pb-about-screen";

describe("pb-about-screen", () => {
  beforeEach(() => {
    registerPbAboutScreen();
  });

  it("renders about shell content", () => {
    const el = document.createElement(pbAboutScreenTag) as HTMLElement & {
      state: {
        metadata: {
          app_version: string;
          commit_hash_short: string;
          build_timestamp_utc: string;
          channel: string;
        } | null;
        errorMessage: string | null;
      };
    };
    el.state = {
      metadata: {
        app_version: "0.1.0",
        commit_hash_short: "abc1234",
        build_timestamp_utc: "2026-04-13 08:30 UTC",
        channel: "stable",
      },
      errorMessage: null,
    };
    document.body.append(el);

    const text = el.textContent ?? "";
    expect(text).toContain("About");
    expect(text).toContain("0.1.0");
    expect(text).toContain("abc1234");
    expect(text).toContain("2026-04-13 08:30 UTC");
    expect(text).toContain("stable");
    expect(text).toContain("Copyright (c) 2026 Christian Pflugradt");
    expect(text).toContain("PolyForm Noncommercial License 1.0.0");
    expect(text).toContain("Contact: dev@pflugradts.de");

    const legalCopy = el.querySelector(".about-legal-copy");
    expect(legalCopy?.innerHTML).toContain("<br>");
    const breakCount = legalCopy?.querySelectorAll("br").length ?? 0;
    expect(breakCount).toBe(5);

    const legacyLabels = [...el.querySelectorAll(".about-meta-row dt")].map(
      (label) => label.textContent?.trim() ?? "",
    );
    expect(legacyLabels).not.toContain("Copyright");
    expect(legacyLabels).not.toContain("License");
    expect(legacyLabels).not.toContain("Contact");

    const mailtoLink = el.querySelector('a[href="mailto:dev@pflugradts.de"]');
    expect(mailtoLink).toBeTruthy();
    expect(mailtoLink?.textContent).toBe("dev@pflugradts.de");
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
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    const gymsEntry = el.querySelector('[data-ui-action="navigate-gyms"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    const settingsEntry = el.querySelector('[data-ui-action="navigate-settings"]') as HTMLButtonElement;
    const logoutEntry = el.querySelector('[data-ui-action="logout"]') as HTMLButtonElement;
    expect(
      workoutEntry.compareDocumentPosition(progressEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      progressEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      historyEntry.compareDocumentPosition(exercisesEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(gymsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gymsEntry.compareDocumentPosition(settingsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    workoutEntry.click();
    progressEntry.click();
    exercisesEntry.click();
    gymsEntry.click();
    historyEntry.click();
    settingsEntry.click();
    logoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(7);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-progress");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-exercises");
    expect(handler.mock.calls[3][0].detail.action).toBe("navigate-gyms");
    expect(handler.mock.calls[4][0].detail.action).toBe("navigate-history");
    expect(handler.mock.calls[5][0].detail.action).toBe("navigate-settings");
    expect(handler.mock.calls[6][0].detail.action).toBe("logout");
  });
});
