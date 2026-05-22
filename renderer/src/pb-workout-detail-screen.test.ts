import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbWorkoutDetailScreenTag,
  registerPbWorkoutDetailScreen,
  type WorkoutDetailScreenState,
} from "./pb-workout-detail-screen";

describe("pb-workout-detail-screen", () => {
  beforeEach(() => {
    registerPbWorkoutDetailScreen();
  });

  const createState = (): WorkoutDetailScreenState => ({
    workoutId: "workout-1",
    isLoading: false,
    errorMessage: null,
    enableVariantRowNavigation: true,
    detail: {
      id: "workout-1",
      hero: {
        training_plan_name: "Push Day",
        started_at: "2026-04-14T16:32:00.000Z",
        completed_at: "2026-04-14T17:14:00.000Z",
        duration_minutes: 42,
        gym_name: "Alpha Gym",
      },
      completion_stats: {
        exercise_count: 8,
        completed_set_count: 20,
        average_duration_minutes: 40,
        workout_progress: 0.12,
        workout_progress_status: "AVAILABLE",
      },
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          variant_id: "variant-barbell",
          exercise_position: 1,
          exercise_name: "Bench Press",
          variant_name: "Barbell",
          station_name: "Rack 1",
          set_tracking_mode: "BILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: 80,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
            {
              set_index: 2,
              set_side: "BILATERAL",
              load_value: 80,
              repetition_kind: "REPS",
              repetition_value: 7,
            },
          ],
        },
        {
          training_plan_exercise_id: "tpe-2",
          variant_id: "variant-bodyweight",
          exercise_position: 2,
          exercise_name: "Plank",
          variant_name: "Bodyweight",
          station_name: "Mat",
          set_tracking_mode: "BILATERAL",
          repetition_kind: "SECS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: null,
              repetition_kind: "SECS",
              repetition_value: 45,
            },
          ],
        },
      ],
    },
  });

  it("renders hero metadata and stat tiles", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);
    el.state = createState();

    expect(el.textContent ?? "").toContain("Push Day");
    expect(el.textContent ?? "").toContain("Tue, Apr 14, 2026");
    const heroMetaText = el.querySelector(".workout-detail-meta")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    expect(heroMetaText).toContain(" - ");
    expect(heroMetaText).toContain("Alpha Gym");
    expect(heroMetaText).not.toContain("min");

    const statValues = Array.from(el.querySelectorAll(".workout-detail-stat-value")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(statValues).toEqual(["8", "3", "15", "1,200 kg"]);
  });

  it("uses a progress-specific back label when the detail screen returns to progress", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      returnScreen: "progress",
    };

    expect(el.querySelector('[data-ui-action="navigate-history"]')?.getAttribute("aria-label")).toBe(
      "Back to progress",
    );
  });

  it("renders exercise sections in payload order with deterministic mixed-format set lines", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);

    const state = createState();
    state.detail = {
      ...state.detail,
      exercises: [
        {
          training_plan_exercise_id: "tpe-unilateral",
          variant_id: "variant-dumbbell",
          exercise_position: 9,
          exercise_name: "Split Squat",
          variant_name: "Dumbbell",
          station_name: "Rack 2",
          set_tracking_mode: "UNILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 2,
              set_side: "RIGHT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
            {
              set_index: 1,
              set_side: "RIGHT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 9,
            },
            {
              set_index: 1,
              set_side: "LEFT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 10,
            },
            {
              set_index: 2,
              set_side: "LEFT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
          ],
        },
        {
          training_plan_exercise_id: "tpe-timed",
          variant_id: "variant-bodyweight",
          exercise_position: 1,
          exercise_name: "Plank",
          variant_name: "Bodyweight",
          station_name: "Mat",
          set_tracking_mode: "BILATERAL",
          repetition_kind: "SECS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: null,
              repetition_kind: "SECS",
              repetition_value: 45,
            },
          ],
        },
        {
          training_plan_exercise_id: "tpe-reps-only",
          exercise_position: 5,
          exercise_name: "Push-up",
          variant_name: null,
          station_name: null,
          set_tracking_mode: "BILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: null,
              repetition_kind: "REPS",
              repetition_value: 12,
            },
          ],
        },
      ],
    };
    el.state = state;

    const exerciseNames = Array.from(el.querySelectorAll(".workout-detail-exercise-name")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(exerciseNames).toEqual(["Split Squat", "Plank", "Push-up"]);

    const exerciseIndexes = Array.from(el.querySelectorAll(".workout-detail-exercise-position")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(exerciseIndexes).toEqual(["1 of 3", "2 of 3", "3 of 3"]);

    const subtitles = Array.from(el.querySelectorAll(".workout-detail-exercise-subtitle")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(subtitles).toEqual(["Dumbbell", "Bodyweight", "Variant context unavailable"]);
    expect(el.querySelectorAll(".workout-detail-exercise-subtitle-link-target")).toHaveLength(2);
    expect(el.querySelectorAll(".workout-detail-exercise-subtitle-link-icon")).toHaveLength(2);

    const setLines = Array.from(el.querySelectorAll(".workout-detail-set-line")).map(
      (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "",
    );
    expect(setLines).toEqual([
      "Set 1 L: 18 kg x 10 R: 18 kg x 9",
      "Set 2 L: 18 kg x 8 R: 18 kg x 8",
      "Set 1 00:45",
      "Set 1 12 reps",
    ]);
  });

  it("renders stable fallbacks when metadata values are nullable or missing", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);

    const state = createState();
    state.detail = {
      ...state.detail,
      hero: {
        training_plan_name: "Recovery",
        started_at: null,
        completed_at: null,
        duration_minutes: null,
        gym_name: null,
      },
      completion_stats: {
        ...state.detail.completion_stats,
        exercise_count: 0,
        completed_set_count: 0,
      },
      exercises: [],
    };
    el.state = state;

    expect(el.textContent ?? "").toContain("Unknown date");
    expect(el.textContent ?? "").toContain("Time unavailable");
    expect(el.textContent ?? "").toContain("Unknown gym");
  });

  it("counts only complete unilateral pairs for sets stat", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);

    const state = createState();
    state.detail = {
      ...state.detail,
      completion_stats: {
        ...state.detail.completion_stats,
        completed_set_count: 99,
      },
      exercises: [
        {
          training_plan_exercise_id: "tpe-unilateral",
          exercise_position: 1,
          exercise_name: "Lunge",
          variant_name: "Dumbbell",
          station_name: "Rack",
          set_tracking_mode: "UNILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 1,
              set_side: "LEFT",
              load_value: 16,
              repetition_kind: "REPS",
              repetition_value: 10,
            },
            {
              set_index: 1,
              set_side: "RIGHT",
              load_value: 16,
              repetition_kind: "REPS",
              repetition_value: 10,
            },
            {
              set_index: 2,
              set_side: "LEFT",
              load_value: 16,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
          ],
        },
      ],
    };
    el.state = state;

    const statValues = Array.from(el.querySelectorAll(".workout-detail-stat-value")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(statValues[1]).toBe("1");
  });

  it("computes volume with reps, unilateral averaging, and secs-as-one-rep", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);

    const state = createState();
    state.detail = {
      ...state.detail,
      exercises: [
        {
          training_plan_exercise_id: "tpe-unilateral",
          exercise_position: 1,
          exercise_name: "Split Squat",
          variant_name: "Dumbbell",
          station_name: "Rack",
          set_tracking_mode: "UNILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 1,
              set_side: "LEFT",
              load_value: 20,
              repetition_kind: "REPS",
              repetition_value: 10,
            },
            {
              set_index: 1,
              set_side: "RIGHT",
              load_value: 24,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
            {
              set_index: 2,
              set_side: "LEFT",
              load_value: 18,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
          ],
        },
        {
          training_plan_exercise_id: "tpe-reps",
          exercise_position: 2,
          exercise_name: "Bench Press",
          variant_name: "Barbell",
          station_name: "Rack",
          set_tracking_mode: "BILATERAL",
          repetition_kind: "REPS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: 50,
              repetition_kind: "REPS",
              repetition_value: 5,
            },
          ],
        },
        {
          training_plan_exercise_id: "tpe-secs",
          exercise_position: 3,
          exercise_name: "Weighted Plank",
          variant_name: "Bodyweight",
          station_name: "Mat",
          set_tracking_mode: "BILATERAL",
          repetition_kind: "SECS",
          sets: [
            {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: 40,
              repetition_kind: "SECS",
              repetition_value: 90,
            },
          ],
        },
      ],
    };
    el.state = state;

    const statValues = Array.from(el.querySelectorAll(".workout-detail-stat-value")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(statValues[3]).toBe("486 kg");
  });

  it("emits back navigation action from top-left button", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const backButton = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    expect(backButton.getAttribute("aria-label")).toBe("Back to history");
    backButton.click();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          action: "navigate-history",
        },
      }),
    );
  });

  it("emits exercise-detail action when clicking an interactive variant row in workout detail context", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const variantButton = el.querySelector(
      '[data-ui-action="open-exercise-variant-detail"]',
    ) as HTMLButtonElement | null;
    expect(variantButton).not.toBeNull();
    variantButton?.click();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          action: "open-exercise-variant-detail",
          payload: { variantId: "variant-barbell" },
        },
      }),
    );
  });

  it("renders non-interactive subtitles when workout-detail navigation guard is disabled", () => {
    const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
      state: WorkoutDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      enableVariantRowNavigation: false,
    };

    expect(el.querySelectorAll(".workout-detail-exercise-subtitle-link-target")).toHaveLength(0);
    expect(el.querySelectorAll(".workout-detail-exercise-subtitle-link-icon")).toHaveLength(0);
  });
});
