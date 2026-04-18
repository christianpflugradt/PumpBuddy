import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  pbHistoryScreenTag,
  registerPbHistoryScreen,
  type HistoryScreenState,
} from "./pb-history-screen";

describe("pb-history-screen", () => {
  beforeEach(() => {
    registerPbHistoryScreen();
  });

  const createState = (): HistoryScreenState => ({
    workouts: [
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
      {
        id: "workout-2",
        training_plan_name: "Push Day",
        started_at: "2026-03-15T08:00:00.000Z",
        completed_at: "2026-03-15T08:40:00.000Z",
        gym_name: "Northside",
        duration_minutes: 40,
      },
      {
        id: "workout-3",
        training_plan_name: "Mobility",
        started_at: "2026-04-10T07:00:00.000Z",
        completed_at: "2026-04-10T07:35:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 35,
      },
    ],
    isLoading: false,
    errorMessage: null,
    restoreWorkoutId: null,
  });

  it("renders grouped history rows with required metadata and chevrons", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = createState();

    const monthLabels = Array.from(el.querySelectorAll(".history-month-label")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(monthLabels).toEqual(["April 2026", "March 2026"]);

    const aprilRows = Array.from(
      el.querySelectorAll(".history-month-section:first-of-type .history-workout-row-title"),
    ).map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    expect(aprilRows).toEqual(["Leg Day · 45 min", "Mobility · 35 min"]);

    const firstTitle = el.querySelector(".history-workout-row-title")?.textContent?.replace(/\s+/g, " ").trim();
    expect(firstTitle).toBe("Leg Day · 45 min");

    const firstMetadata = el.querySelector(".history-workout-row-meta")?.textContent?.replace(/\s+/g, " ").trim();
    expect(firstMetadata).toBe("Fri, Apr 17 · Downtown");

    const chevrons = el.querySelectorAll(".history-workout-chevron");
    expect(chevrons).toHaveLength(3);
    expect(Array.from(chevrons).every((node) => (node.textContent ?? "").includes("›"))).toBe(true);
  });

  it("renders loading status when history is loading", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = {
      workouts: [],
      isLoading: true,
      errorMessage: null,
      restoreWorkoutId: null,
    };

    expect(el.textContent ?? "").toContain("Loading workout history...");
  });

  it("renders error message when loading history fails", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = {
      workouts: [],
      isLoading: false,
      errorMessage: "Unable to load workout history right now.",
      restoreWorkoutId: null,
    };

    expect(el.textContent ?? "").toContain("Unable to load workout history right now.");
  });

  it("emits side menu actions including navigate-history placement", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    const settingsEntry = el.querySelector('[data-ui-action="navigate-settings"]') as HTMLButtonElement;
    const aboutEntry = el.querySelector('[data-ui-action="navigate-about"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(settingsEntry).toBeTruthy();
    expect(aboutEntry).toBeTruthy();
    expect(
      workoutEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      historyEntry.compareDocumentPosition(settingsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    workoutEntry.click();
    settingsEntry.click();
    aboutEntry.click();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-settings");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-about");
  });

  it("emits row-open action with selected workout id when a history row is clicked", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const historyRow = el.querySelector(".history-workout-row") as HTMLButtonElement;
    expect(historyRow).toBeTruthy();

    historyRow.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-workout-detail",
      payload: { workoutId: "workout-1" },
    });
  });

  it("restores focus to anchored workout row and emits completion action", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = createState();

    const scrollIntoViewSpy = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    try {
      el.state = {
        ...createState(),
        restoreWorkoutId: "workout-2",
      };

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            action: "history-restore-complete",
            payload: {
              workoutId: "workout-2",
              restored: true,
            },
          },
        }),
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("defines metadata typography as white, non-bold, and smaller than the row title", () => {
    const stylesPathCandidates = [
      resolve(process.cwd(), "src/styles.scss"),
      resolve(process.cwd(), "renderer/src/styles.scss"),
    ];
    const stylesPath = stylesPathCandidates.find((candidate) => {
      try {
        readFileSync(candidate, "utf8");
        return true;
      } catch {
        return false;
      }
    });
    expect(stylesPath).toBeTruthy();

    const styles = readFileSync(stylesPath as string, "utf8");

    expect(styles).toMatch(/\.history-workout-row-title\s*\{[\s\S]*?font-size:\s*calc\(var\(--font-size-body\) \+ 0\.02rem\);/);
    expect(styles).toMatch(/\.history-workout-row-meta\s*\{[\s\S]*?color:\s*#ffffff;/);
    expect(styles).toMatch(/\.history-workout-row-meta\s*\{[\s\S]*?font-size:\s*calc\(var\(--font-size-body\) - 0\.08rem\);/);
    expect(styles).toMatch(/\.history-workout-row-meta\s*\{[\s\S]*?font-weight:\s*400;/);
  });
});
