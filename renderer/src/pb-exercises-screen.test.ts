import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbExercisesScreenTag,
  registerPbExercisesScreen,
  type ExercisesScreenState,
} from "./pb-exercises-screen";

describe("pb-exercises-screen", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = originalTimeZone;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));
    registerPbExercisesScreen();
  });

  afterEach(() => {
    process.env.TZ = originalTimeZone;
    vi.useRealTimers();
  });

  const createState = (): ExercisesScreenState => ({
    groups: [
      {
        tone: "GREEN",
        rows: [
          {
            variant_id: "variant-1",
            variant_name: "Barbell Squat",
            last_performed_at: "2026-04-18T10:45:00.000Z",
            last_performed_days_ago: 2,
            last_performed_first_set_display: "27.216 kg x 5 reps",
            selected_station_average_score_30d: 1.07,
            variant_session_count_30d: 6,
            performance_status: "AVAILABLE",
            performance_tone: "GREEN",
            score_trend_30d: {
              entries: [
                { occurred_at: "2026-03-28T10:45:00.000Z", score: 0.96 },
                { occurred_at: "2026-04-01T10:45:00.000Z", score: 0.98 },
                { occurred_at: "2026-04-05T10:45:00.000Z", score: 1.01 },
                { occurred_at: "2026-04-09T10:45:00.000Z", score: 1.03 },
                { occurred_at: "2026-04-13T10:45:00.000Z", score: 1.05 },
                { occurred_at: "2026-04-18T10:45:00.000Z", score: 1.07 },
              ],
            },
          },
        ],
      },
      {
        tone: "GRAY",
        rows: [
          {
            variant_id: "variant-2",
            variant_name: "Cable Row",
            last_performed_at: "2026-04-17T10:45:00.000Z",
            last_performed_days_ago: 3,
            last_performed_first_set_display: "80 secs",
            selected_station_average_score_30d: null,
            variant_session_count_30d: 2,
            performance_status: "NOT_ENOUGH_DATA",
            performance_tone: "GRAY",
            score_trend_30d: {
              entries: [
                { occurred_at: "2026-04-10T10:45:00.000Z", score: 0.98 },
                { occurred_at: "2026-04-17T10:45:00.000Z", score: 1.01 },
              ],
            },
          },
        ],
      },
    ],
    isLoading: false,
    errorMessage: null,
  });

  it("renders grouped rows with compact detail copy, trend icon and chevron affordance", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    el.state = createState();

    expect(el.textContent ?? "").toContain("Exercises");
    expect(el.textContent ?? "").toContain("Last 30 days");
    expect(el.textContent ?? "").toContain("Barbell Squat");
    expect(el.textContent ?? "").toContain("27.22 kg x 5");
    expect(el.textContent ?? "").toContain("6 scored sessions");
    expect(el.textContent ?? "").toContain("2 days ago");
    expect(el.textContent ?? "").toContain("Not enough data");
    expect(el.textContent ?? "").toContain("1:20");
    expect(el.querySelectorAll(".exercises-row-tone")).toHaveLength(2);
    expect(el.querySelectorAll(".exercises-row-chevron")).toHaveLength(2);
    expect(el.querySelectorAll('[data-ui-action="open-exercise-variant-detail"]')).toHaveLength(2);
    expect(el.querySelector(".exercises-group-subtitle")).toBeNull();
    expect(el.textContent ?? "").not.toContain("1.07");
  });

  it("uses local calendar days for last performed labels near midnight", () => {
    process.env.TZ = "Asia/Dubai";
    vi.setSystemTime(new Date(2026, 2, 2, 2, 0, 0));

    const lateWorkout = new Date(2026, 2, 1, 23, 0, 0);
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    const state = createState();
    state.groups[0]!.rows[0]!.last_performed_at = lateWorkout.toISOString();
    state.groups[0]!.rows[0]!.last_performed_days_ago = 0;
    state.groups = [state.groups[0]!];
    el.state = state;

    expect(el.textContent ?? "").toContain("1 day ago");
    expect(el.textContent ?? "").not.toContain("Today");
  });

  it("emits open detail action with variant ID and current scroll position", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    el.state = createState();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 128 });

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const rowButton = el.querySelector('[data-variant-id="variant-1"]') as HTMLButtonElement;
    rowButton.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-exercise-variant-detail",
      payload: { variantId: "variant-1", scrollY: 128 },
    });
  });

  it("restores saved scroll position and emits completion", () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalScrollTo = window.scrollTo;
    window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
    window.scrollTo = vi.fn();

    try {
      const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
      document.body.append(el);
      const handler = vi.fn();
      el.addEventListener("pb-ui-action", handler);

      el.state = {
        ...createState(),
        restoreScrollY: 240,
      };

      expect(window.scrollTo).toHaveBeenCalledWith({ top: 240, left: 0, behavior: "auto" });
      expect(handler.mock.calls.at(-1)?.[0].detail).toEqual({
        action: "exercises-restore-complete",
        payload: { scrollY: 240 },
      });
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.scrollTo = originalScrollTo;
    }
  });

  it("formats single-second timed sets as m:ss", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    const state = createState();
    state.groups[0]!.rows[0]!.last_performed_first_set_display = "1 secs";
    el.state = state;

    expect(el.textContent ?? "").toContain("0:01");
    expect(el.textContent ?? "").not.toContain("1 secs");
  });

  it("filters by case-insensitive variant name only and clear restores all rows", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    el.state = createState();

    let input = el.querySelector('[data-ui-input="variant-filter"]') as HTMLInputElement;
    input.value = "SQUAT";
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const updatedInput = el.querySelector('[data-ui-input="variant-filter"]') as HTMLInputElement;
    expect(document.activeElement).toBe(updatedInput);
    expect(el.textContent ?? "").toContain("Barbell Squat");
    expect(el.textContent ?? "").not.toContain("Cable Row");

    input = el.querySelector('[data-ui-input="variant-filter"]') as HTMLInputElement;
    input.value = "100 kg";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(el.textContent ?? "").toContain("No variants match this filter.");

    input = el.querySelector('[data-ui-input="variant-filter"]') as HTMLInputElement;
    input.value = "cable";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const groupTitles = Array.from(el.querySelectorAll(".exercises-group-title")).map((node) => node.textContent?.trim());
    expect(groupTitles).toEqual(["Not enough data"]);
    expect(el.textContent ?? "").toContain("Cable Row");
    expect(el.textContent ?? "").not.toContain("Barbell Squat");

    const clearButton = el.querySelector('[data-ui-action="clear-filter"]') as HTMLButtonElement;
    clearButton.click();

    expect(el.textContent ?? "").toContain("Barbell Squat");
    expect(el.textContent ?? "").toContain("Cable Row");
  });

  it("uses a placeholder-only filter prompt with text filter by name", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    el.state = createState();

    const input = el.querySelector('[data-ui-input="variant-filter"]') as HTMLInputElement;
    expect(input.placeholder).toBe("Filter by name");
    expect(el.textContent ?? "").not.toContain("Filter variants");
  });

  it("emits side-menu actions with History between Progress and Exercises", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    const gymsEntry = el.querySelector('[data-ui-action="navigate-gyms"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(progressEntry).toBeTruthy();
    expect(exercisesEntry).toBeTruthy();
    expect(gymsEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(
      progressEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      historyEntry.compareDocumentPosition(exercisesEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(gymsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    workoutEntry.click();
    progressEntry.click();
    historyEntry.click();
    gymsEntry.click();

    expect(handler).toHaveBeenCalledTimes(4);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-progress");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-history");
    expect(handler.mock.calls[3][0].detail.action).toBe("navigate-gyms");
  });
});
