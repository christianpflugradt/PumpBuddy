import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pbExercisesScreenTag,
  registerPbExercisesScreen,
  type ExercisesScreenState,
} from "./pb-exercises-screen";

describe("pb-exercises-screen", () => {
  beforeEach(() => {
    registerPbExercisesScreen();
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
            last_performed_first_set_display: "60 kg x 8 reps",
            selected_station_average_score_30d: null,
            variant_session_count_30d: 2,
            performance_status: "NOT_ENOUGH_DATA",
            performance_tone: "GRAY",
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
    expect(el.textContent ?? "").toContain("Barbell Squat");
    expect(el.textContent ?? "").toContain("27.22 kg x 5 reps");
    expect(el.textContent ?? "").toContain("6 sessions");
    expect(el.textContent ?? "").toContain("2 days ago");
    expect(el.textContent ?? "").toContain("Not enough data");
    expect(el.querySelectorAll(".exercises-row-tone")).toHaveLength(2);
    expect(el.querySelectorAll(".exercises-row-chevron")).toHaveLength(2);
    expect(el.querySelector(".exercises-group-subtitle")).toBeNull();
    expect(el.textContent ?? "").not.toContain("1.07");
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

  it("emits side-menu actions with Exercises between Progress and History", () => {
    const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(progressEntry).toBeTruthy();
    expect(exercisesEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(
      progressEntry.compareDocumentPosition(exercisesEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    workoutEntry.click();
    progressEntry.click();
    historyEntry.click();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-progress");
    expect(handler.mock.calls[2][0].detail.action).toBe("navigate-history");
  });
});
