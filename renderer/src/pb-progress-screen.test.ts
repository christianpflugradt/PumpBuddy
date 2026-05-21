import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbProgressScreenTag,
  registerPbProgressScreen,
  type ProgressScreenState,
} from "./pb-progress-screen";

describe("pb-progress-screen", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = originalTimeZone;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    registerPbProgressScreen();
  });

  afterEach(() => {
    process.env.TZ = originalTimeZone;
    vi.useRealTimers();
  });

  const createState = (): ProgressScreenState => ({
    workouts: [
      {
        id: "workout-1",
        training_plan_name: "Leg Day",
        completed_at: "2026-04-18T10:45:00.000Z",
        workout_progress: 1.08,
        workout_progress_status: "AVAILABLE",
        progress_tone: "GREEN",
      },
      {
        id: "workout-2",
        training_plan_name: "Push Day",
        completed_at: "2026-04-15T10:45:00.000Z",
        workout_progress: 1.0,
        workout_progress_status: "AVAILABLE",
        progress_tone: "YELLOW",
      },
      {
        id: "workout-3",
        training_plan_name: "Pull Day",
        completed_at: "2026-04-12T10:45:00.000Z",
        workout_progress: 0.9,
        workout_progress_status: "AVAILABLE",
        progress_tone: "RED",
      },
    ],
    isLoading: false,
    errorMessage: null,
  });

  it("renders progress sections and trend subtitle", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = createState();

    expect(el.textContent ?? "").toContain("Progress");
    expect(el.textContent ?? "").toContain("Performance Trend");
    expect(el.textContent ?? "").toContain("Based on 3 workouts with data");
    expect(el.textContent ?? "").toContain("Recent Activity");
    expect(el.querySelectorAll(".progress-heatmap-cell")).toHaveLength(30);
    expect(el.textContent ?? "").toContain("Irregular");
  });

  it("shows gray message when fewer than three scored workouts exist", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "workout-1",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-18T10:45:00.000Z",
          workout_progress: null,
          workout_progress_status: "NOT_ENOUGH_DATA",
          progress_tone: "GRAY",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    expect(el.textContent ?? "").toContain("Not enough data");
  });

  it("shows unrated sessions as gray heatmap cells and keeps them drillable", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "workout-unrated",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-18T10:45:00.000Z",
          workout_progress: null,
          workout_progress_status: "NOT_ENOUGH_DATA",
          progress_tone: "GRAY",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const cell = el.querySelector(
      '.progress-heatmap-cell-button.progress-heatmap-cell--gray[data-workout-id="workout-unrated"]',
    ) as HTMLButtonElement | null;
    expect(cell).toBeTruthy();

    cell?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail).toEqual({
      action: "open-workout-detail",
      payload: { workoutId: "workout-unrated" },
    });
  });

  it("uses local calendar days for heatmap buckets and recent activity near midnight", () => {
    process.env.TZ = "Asia/Dubai";
    vi.setSystemTime(new Date(2026, 2, 2, 2, 0, 0));

    const workoutLocalDate = new Date(2026, 2, 1, 23, 0, 0);
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "workout-midnight",
          training_plan_name: "Late Session",
          completed_at: workoutLocalDate.toISOString(),
          workout_progress: 1.0,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    const activityValues = Array.from(el.querySelectorAll(".progress-activity-value")).map((node) =>
      node.textContent?.trim(),
    );
    expect(activityValues[0]).toBe("1 day ago");

    const heatmapCells = Array.from(el.querySelectorAll(".progress-heatmap > *"));
    expect((heatmapCells.at(-1) as HTMLElement | undefined)?.getAttribute("data-workout-id")).toBeNull();
    expect((heatmapCells.at(-2) as HTMLElement | undefined)?.getAttribute("data-workout-id")).toBe(
      "workout-midnight",
    );
  });

  it("emits side-menu navigation actions", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(exercisesEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    workoutEntry.click();
    exercisesEntry.click();
    historyEntry.click();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-exercises");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-history");
  });

  it("emits open-workout-detail when clicking a heatmap day with a completed workout", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const cell = el.querySelector('[data-ui-action="open-workout-detail"]') as HTMLButtonElement;
    expect(cell).toBeTruthy();

    cell.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail).toEqual({
      action: "open-workout-detail",
      payload: { workoutId: "workout-3" },
    });
  });

  it("shows very consistent rating for evenly spaced rhythm with no long gaps", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "w1",
          training_plan_name: "Leg Day",
          completed_at: "2026-03-22T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w2",
          training_plan_name: "Push Day",
          completed_at: "2026-03-27T10:45:00.000Z",
          workout_progress: 1.04,
          workout_progress_status: "AVAILABLE",
          progress_tone: "GREEN",
        },
        {
          id: "w3",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-01T10:45:00.000Z",
          workout_progress: 0.98,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w4",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-06T10:45:00.000Z",
          workout_progress: 1.01,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w5",
          training_plan_name: "Push Day",
          completed_at: "2026-04-11T10:45:00.000Z",
          workout_progress: 1.05,
          workout_progress_status: "AVAILABLE",
          progress_tone: "GREEN",
        },
        {
          id: "w6",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-16T10:45:00.000Z",
          workout_progress: 1.0,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    expect(el.textContent ?? "").toContain("Very consistent");
  });

  it("does not show very consistent when there are 4 consecutive training days", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        { id: "w1", training_plan_name: "Leg Day", completed_at: "2026-03-22T10:00:00.000Z", workout_progress: 1.02, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w2", training_plan_name: "Push Day", completed_at: "2026-03-24T10:00:00.000Z", workout_progress: 1.01, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w3", training_plan_name: "Pull Day", completed_at: "2026-03-26T10:00:00.000Z", workout_progress: 1.03, workout_progress_status: "AVAILABLE", progress_tone: "GREEN" },
        { id: "w4", training_plan_name: "Leg Day", completed_at: "2026-03-28T10:00:00.000Z", workout_progress: 1.0, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w5", training_plan_name: "Push Day", completed_at: "2026-03-30T10:00:00.000Z", workout_progress: 1.01, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w6", training_plan_name: "Pull Day", completed_at: "2026-04-01T10:00:00.000Z", workout_progress: 1.02, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w7", training_plan_name: "Leg Day", completed_at: "2026-04-03T10:00:00.000Z", workout_progress: 1.01, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w8", training_plan_name: "Push Day", completed_at: "2026-04-05T10:00:00.000Z", workout_progress: 1.03, workout_progress_status: "AVAILABLE", progress_tone: "GREEN" },
        { id: "w9", training_plan_name: "Pull Day", completed_at: "2026-04-06T10:00:00.000Z", workout_progress: 1.02, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w10", training_plan_name: "Leg Day", completed_at: "2026-04-07T10:00:00.000Z", workout_progress: 1.01, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w11", training_plan_name: "Push Day", completed_at: "2026-04-08T10:00:00.000Z", workout_progress: 1.0, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w12", training_plan_name: "Pull Day", completed_at: "2026-04-10T10:00:00.000Z", workout_progress: 1.02, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w13", training_plan_name: "Leg Day", completed_at: "2026-04-12T10:00:00.000Z", workout_progress: 1.01, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w14", training_plan_name: "Push Day", completed_at: "2026-04-14T10:00:00.000Z", workout_progress: 1.02, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
        { id: "w15", training_plan_name: "Pull Day", completed_at: "2026-04-16T10:00:00.000Z", workout_progress: 1.03, workout_progress_status: "AVAILABLE", progress_tone: "GREEN" },
        { id: "w16", training_plan_name: "Leg Day", completed_at: "2026-04-18T10:00:00.000Z", workout_progress: 1.01, workout_progress_status: "AVAILABLE", progress_tone: "YELLOW" },
      ],
      isLoading: false,
      errorMessage: null,
    };

    const text = el.textContent ?? "";
    expect(text).not.toContain("Very consistent");
    expect(text).toContain("Irregular");
  });

  it("shows mostly consistent rating for some unevenness with one larger gap", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "w1",
          training_plan_name: "Leg Day",
          completed_at: "2026-03-28T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w2",
          training_plan_name: "Push Day",
          completed_at: "2026-04-02T10:45:00.000Z",
          workout_progress: 1.04,
          workout_progress_status: "AVAILABLE",
          progress_tone: "GREEN",
        },
        {
          id: "w3",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-09T10:45:00.000Z",
          workout_progress: 0.98,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w4",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-15T10:45:00.000Z",
          workout_progress: 1.01,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    expect(el.textContent ?? "").toContain("Mostly consistent");
  });

  it("shows irregular rating when many workouts are clustered on one day", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "w1",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-19T08:00:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w2",
          training_plan_name: "Push Day",
          completed_at: "2026-04-19T09:00:00.000Z",
          workout_progress: 1.01,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w3",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-19T10:00:00.000Z",
          workout_progress: 0.99,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w4",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-19T11:00:00.000Z",
          workout_progress: 1.03,
          workout_progress_status: "AVAILABLE",
          progress_tone: "GREEN",
        },
        {
          id: "w5",
          training_plan_name: "Push Day",
          completed_at: "2026-04-19T12:00:00.000Z",
          workout_progress: 1.04,
          workout_progress_status: "AVAILABLE",
          progress_tone: "GREEN",
        },
        {
          id: "w6",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-19T13:00:00.000Z",
          workout_progress: 0.95,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w7",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-19T14:00:00.000Z",
          workout_progress: 0.94,
          workout_progress_status: "AVAILABLE",
          progress_tone: "RED",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    expect(el.textContent ?? "").toContain("Irregular");
  });

  it("shows irregular rating when any day has multiple workouts", () => {
    const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
    document.body.append(el);
    el.state = {
      workouts: [
        {
          id: "w1",
          training_plan_name: "Leg Day",
          completed_at: "2026-03-22T10:45:00.000Z",
          workout_progress: 1.01,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w2",
          training_plan_name: "Push Day",
          completed_at: "2026-03-27T10:45:00.000Z",
          workout_progress: 1.03,
          workout_progress_status: "AVAILABLE",
          progress_tone: "GREEN",
        },
        {
          id: "w3",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-01T10:45:00.000Z",
          workout_progress: 0.99,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w4",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-06T10:45:00.000Z",
          workout_progress: 1.0,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w5",
          training_plan_name: "Push Day",
          completed_at: "2026-04-06T18:15:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
        {
          id: "w6",
          training_plan_name: "Pull Day",
          completed_at: "2026-04-16T10:45:00.000Z",
          workout_progress: 1.0,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
      isLoading: false,
      errorMessage: null,
    };

    expect(el.textContent ?? "").toContain("Irregular");
  });
});
