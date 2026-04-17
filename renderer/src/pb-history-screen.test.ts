import { beforeEach, describe, expect, it, vi } from "vitest";
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
    ],
    isLoading: false,
    errorMessage: null,
  });

  it("renders history rows from provided workouts", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("History");
    expect(text).toContain("Leg Day");
    expect(text).toContain("Downtown");
    expect(text).toContain("45 min");
  });

  it("renders loading status when history is loading", () => {
    const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
    document.body.append(el);
    el.state = {
      workouts: [],
      isLoading: true,
      errorMessage: null,
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
});
