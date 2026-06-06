import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbTrainingPlansScreenTag,
  registerPbTrainingPlansScreen,
  type TrainingPlansScreenState,
} from "./pb-training-plans-screen";

describe("pb-training-plans-screen", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = originalTimeZone;
    registerPbTrainingPlansScreen();
  });

  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  const createState = (): TrainingPlansScreenState => ({
    trainingPlans: [
      {
        id: "plan-1",
        name: "Leg Day",
        exercise_count: 3,
        last_completed_at: "2026-04-17T10:45:00.000Z",
      },
      {
        id: "plan-2",
        name: "Upper <Body>",
        exercise_count: 1,
        last_completed_at: null,
      },
    ],
    isLoading: false,
    errorMessage: null,
  });

  it("renders training plan rows with name, exercise count, history metadata, and chevron", () => {
    const el = document.createElement(pbTrainingPlansScreenTag) as HTMLElement & {
      state: TrainingPlansScreenState;
    };
    document.body.append(el);

    el.state = createState();

    const firstRow = el.querySelector('[data-training-plan-id="plan-1"]');
    const secondRow = el.querySelector('[data-training-plan-id="plan-2"]');
    expect(firstRow?.textContent ?? "").toContain("Leg Day");
    expect(firstRow?.textContent ?? "").toContain("3 exercises");
    expect(firstRow?.textContent ?? "").toContain("Last completed Fri, Apr 17");
    expect(firstRow?.querySelector(".history-workout-chevron")?.textContent ?? "").toContain("\u203a");
    expect(secondRow?.textContent ?? "").toContain("Upper <Body>");
    expect(secondRow?.textContent ?? "").toContain("1 exercise");
    expect(secondRow?.textContent ?? "").toContain("Never completed");
  });

  it("renders loading, error, and empty states", () => {
    const el = document.createElement(pbTrainingPlansScreenTag) as HTMLElement & {
      state: TrainingPlansScreenState;
    };
    document.body.append(el);

    el.state = { ...createState(), trainingPlans: [], isLoading: true };
    expect(el.textContent ?? "").toContain("Loading training plans...");

    el.state = {
      ...createState(),
      trainingPlans: [],
      errorMessage: "Unable to load training plans right now.",
    };
    expect(el.textContent ?? "").toContain("Unable to load training plans right now.");

    el.state = { ...createState(), trainingPlans: [] };
    expect(el.textContent ?? "").toContain("No training plans available yet.");
  });

  it("emits open-training-plan-detail with selected plan id when a row is clicked", () => {
    const el = document.createElement(pbTrainingPlansScreenTag) as HTMLElement & {
      state: TrainingPlansScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const row = el.querySelector('[data-training-plan-id="plan-1"]') as HTMLButtonElement;
    row.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-training-plan-detail",
      payload: { trainingPlanId: "plan-1" },
    });
  });

  it("emits side-menu navigation actions with Training Plans between Exercises and Gyms", () => {
    const el = document.createElement(pbTrainingPlansScreenTag) as HTMLElement & {
      state: TrainingPlansScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    const trainingPlansEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    const gymsEntry = el.querySelector('[data-ui-action="navigate-gyms"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    const settingsEntry = el.querySelector('[data-ui-action="navigate-settings"]') as HTMLButtonElement;
    const aboutEntry = el.querySelector('[data-ui-action="navigate-about"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(progressEntry).toBeTruthy();
    expect(exercisesEntry).toBeTruthy();
    expect(trainingPlansEntry).toBeTruthy();
    expect(gymsEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(settingsEntry).toBeTruthy();
    expect(aboutEntry).toBeTruthy();
    expect(
      progressEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      historyEntry.compareDocumentPosition(exercisesEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(trainingPlansEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      trainingPlansEntry.compareDocumentPosition(gymsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    workoutEntry.click();
    progressEntry.click();
    gymsEntry.click();
    historyEntry.click();
    settingsEntry.click();
    aboutEntry.click();

    expect(handler).toHaveBeenCalledTimes(6);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-progress");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-gyms");
    expect(handler.mock.calls[3][0].detail.action).toBe("navigate-history");
    expect(handler.mock.calls[4][0].detail.action).toBe("navigate-settings");
    expect(handler.mock.calls[5][0].detail.action).toBe("navigate-about");
  });
});
