import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pbGymsScreenTag, registerPbGymsScreen, type GymsScreenState } from "./pb-gyms-screen";

describe("pb-gyms-screen", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = originalTimeZone;
    registerPbGymsScreen();
  });

  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  const createState = (): GymsScreenState => ({
    gyms: [
      {
        id: "gym-1",
        name: "Downtown",
        station_count: 8,
        last_visited_at: "2026-04-17T10:45:00.000Z",
      },
      {
        id: "gym-2",
        name: "North <Gym>",
        station_count: 1,
        last_visited_at: null,
      },
    ],
    isLoading: false,
    errorMessage: null,
  });

  it("renders gym rows with name, last visit, station count, and chevron", () => {
    const el = document.createElement(pbGymsScreenTag) as HTMLElement & { state: GymsScreenState };
    document.body.append(el);

    el.state = createState();

    const firstRow = el.querySelector('[data-gym-id="gym-1"]');
    const secondRow = el.querySelector('[data-gym-id="gym-2"]');
    expect(firstRow?.textContent ?? "").toContain("Downtown");
    expect(firstRow?.textContent ?? "").toContain("Last visited Fri, Apr 17 · 8 stations");
    expect(firstRow?.textContent ?? "").toContain("›");
    expect(secondRow?.textContent ?? "").toContain("North <Gym>");
    expect(secondRow?.textContent ?? "").toContain("Never visited · 1 station");
  });

  it("renders loading, error, and empty states", () => {
    const el = document.createElement(pbGymsScreenTag) as HTMLElement & { state: GymsScreenState };
    document.body.append(el);

    el.state = { ...createState(), gyms: [], isLoading: true };
    expect(el.textContent ?? "").toContain("Loading gyms...");

    el.state = { ...createState(), gyms: [], errorMessage: "Unable to load gyms right now." };
    expect(el.textContent ?? "").toContain("Unable to load gyms right now.");

    el.state = { ...createState(), gyms: [] };
    expect(el.textContent ?? "").toContain("No gyms available yet.");
  });

  it("emits open-gym-detail with selected gym id when a row is clicked", () => {
    const el = document.createElement(pbGymsScreenTag) as HTMLElement & { state: GymsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const row = el.querySelector('[data-gym-id="gym-1"]') as HTMLButtonElement;
    row.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-gym-detail",
      payload: { gymId: "gym-1" },
    });
  });

  it("emits side-menu navigation actions with Training Plans between Exercises and Gyms", () => {
    const el = document.createElement(pbGymsScreenTag) as HTMLElement & { state: GymsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    const trainingPlansEntry = el.querySelector('[data-ui-action="navigate-training-plans"]') as HTMLButtonElement;
    const gymsEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
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
      exercisesEntry.compareDocumentPosition(trainingPlansEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      trainingPlansEntry.compareDocumentPosition(gymsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gymsEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    workoutEntry.click();
    progressEntry.click();
    trainingPlansEntry.click();
    historyEntry.click();
    settingsEntry.click();
    aboutEntry.click();

    expect(handler).toHaveBeenCalledTimes(6);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-progress");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-training-plans");
    expect(handler.mock.calls[3][0].detail.action).toBe("navigate-history");
    expect(handler.mock.calls[4][0].detail.action).toBe("navigate-settings");
    expect(handler.mock.calls[5][0].detail.action).toBe("navigate-about");
  });
});
