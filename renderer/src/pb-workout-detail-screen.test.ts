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
    expect(el.textContent ?? "").toContain("42 min");
    expect(el.textContent ?? "").toContain("Alpha Gym");

    const statValues = Array.from(el.querySelectorAll(".workout-detail-stat-value")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(statValues).toEqual(["8", "20", "15", "160 kg"]);
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
    expect(el.textContent ?? "").toContain("Unknown duration");
    expect(el.textContent ?? "").toContain("Time unavailable");
    expect(el.textContent ?? "").toContain("Unknown gym");
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
    backButton.click();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          action: "navigate-history",
        },
      }),
    );
  });
});
