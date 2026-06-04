import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbTrainingPlanDetailScreenTag,
  registerPbTrainingPlanDetailScreen,
  type TrainingPlanDetailScreenState,
} from "./pb-training-plan-detail-screen";
import type { TrainingPlanDetailResponse } from "./workout-contract";

const createDetail = (overrides: Partial<TrainingPlanDetailResponse> = {}): TrainingPlanDetailResponse => ({
  id: "plan-1",
  name: "Leg Day",
  selected_gym_id: null,
  is_executable: null,
  execution_status: null,
  execution_summary: null,
  exercises: [
    {
      training_plan_exercise_id: "exercise-2",
      exercise_name: "Lunge",
      exercise_position: 2,
      configured_variant_count: 1,
      executable_variant_count: null,
      execution_status: null,
      variants: [],
    },
    {
      training_plan_exercise_id: "exercise-1",
      exercise_name: "Squat",
      exercise_position: 1,
      configured_variant_count: 2,
      executable_variant_count: null,
      execution_status: null,
      variants: [],
    },
  ],
  ...overrides,
});

describe("pb-training-plan-detail-screen", () => {
  beforeEach(() => {
    registerPbTrainingPlanDetailScreen();
  });

  const createState = (
    overrides: Partial<TrainingPlanDetailScreenState> = {},
  ): TrainingPlanDetailScreenState => ({
    trainingPlanId: "plan-1",
    selectedGymId: null,
    detail: createDetail(),
    gyms: [
      { id: "gym-1", name: "Downtown" },
      { id: "gym-2", name: "North" },
    ],
    isLoading: false,
    errorMessage: null,
    ...overrides,
  });

  it("renders no-gym ordered exercise cards with configured counts and no availability UI", () => {
    const el = document.createElement(pbTrainingPlanDetailScreenTag) as HTMLElement & {
      state: TrainingPlanDetailScreenState;
    };
    document.body.append(el);

    el.state = createState({
      detail: createDetail({
        is_executable: true,
        execution_status: "GREEN",
        execution_summary: "Ready in selected gym.",
        exercises: [
          {
            training_plan_exercise_id: "exercise-2",
            exercise_name: "Lunge",
            exercise_position: 2,
            configured_variant_count: 1,
            executable_variant_count: 1,
            execution_status: "GREEN",
            variants: [],
          },
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Squat",
            exercise_position: 1,
            configured_variant_count: 2,
            executable_variant_count: 0,
            execution_status: "RED",
            variants: [],
          },
        ],
      }),
    });

    const cards = Array.from(el.querySelectorAll(".training-plan-detail-exercise-card"));
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent ?? "").toContain("Squat");
    expect(cards[0]?.textContent ?? "").toContain("2 configured variants");
    expect(cards[1]?.textContent ?? "").toContain("Lunge");
    expect(cards[1]?.textContent ?? "").toContain("1 configured variant");
    expect(el.querySelector(".training-plan-detail-plan-status")).toBeNull();
    expect(el.querySelector(".training-plan-detail-exercise-status")).toBeNull();
    expect(el.querySelector(".training-plan-detail-status-dot")).toBeNull();
    expect(el.textContent ?? "").not.toContain("Executable in");
    expect(el.textContent ?? "").not.toContain("executable variants");
    expect(el.textContent ?? "").not.toContain("Ready in selected gym.");
  });

  it("renders selected-gym plan status, summary, executable counts, and status tones", () => {
    const el = document.createElement(pbTrainingPlanDetailScreenTag) as HTMLElement & {
      state: TrainingPlanDetailScreenState;
    };
    document.body.append(el);

    el.state = createState({
      selectedGymId: "gym-1",
      detail: createDetail({
        selected_gym_id: "gym-1",
        is_executable: false,
        execution_status: "YELLOW",
        execution_summary: "One exercise needs attention.",
        exercises: [
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Squat",
            exercise_position: 1,
            configured_variant_count: 2,
            executable_variant_count: 2,
            execution_status: "GREEN",
            variants: [],
          },
          {
            training_plan_exercise_id: "exercise-2",
            exercise_name: "Lunge",
            exercise_position: 2,
            configured_variant_count: 2,
            executable_variant_count: 1,
            execution_status: "YELLOW",
            variants: [],
          },
          {
            training_plan_exercise_id: "exercise-3",
            exercise_name: "Calf Raise",
            exercise_position: 3,
            configured_variant_count: 1,
            executable_variant_count: 0,
            execution_status: "RED",
            variants: [],
          },
        ],
      }),
    });

    expect(el.textContent ?? "").toContain("Not executable in Downtown");
    expect(el.textContent ?? "").toContain("One exercise needs attention.");
    expect(el.querySelector(".training-plan-detail-plan-status.training-plan-detail-status--yellow")).toBeTruthy();
    expect(el.querySelector(".training-plan-detail-exercise-card--green")?.textContent ?? "").toContain(
      "2 of 2 configured variants executable",
    );
    expect(el.querySelector(".training-plan-detail-exercise-card--yellow")?.textContent ?? "").toContain(
      "1 of 2 configured variants executable",
    );
    expect(el.querySelector(".training-plan-detail-exercise-card--red")?.textContent ?? "").toContain(
      "0 of 1 configured variant executable",
    );
    expect(el.textContent ?? "").toContain("Green");
    expect(el.textContent ?? "").toContain("Yellow");
    expect(el.textContent ?? "").toContain("Red");
  });

  it("emits selected gym changes from the controlled dropdown", () => {
    const el = document.createElement(pbTrainingPlanDetailScreenTag) as HTMLElement & {
      state: TrainingPlanDetailScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const select = el.querySelector(".training-plan-detail-gym-select") as HTMLSelectElement;
    select.value = "gym-2";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "select-training-plan-detail-gym",
      payload: { selectedGymId: "gym-2" },
    });

    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(handler.mock.calls[1][0].detail).toEqual({
      action: "select-training-plan-detail-gym",
      payload: { selectedGymId: null },
    });
  });

  it("emits exercise detail and back navigation actions", () => {
    const el = document.createElement(pbTrainingPlanDetailScreenTag) as HTMLElement & {
      state: TrainingPlanDetailScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const exercise = el.querySelector('[data-training-plan-exercise-id="exercise-1"]') as HTMLButtonElement;
    exercise.click();

    const back = el.querySelector('[data-ui-action="navigate-back-from-training-plan-detail"]') as HTMLButtonElement;
    back.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-training-plan-exercise-detail",
      payload: { trainingPlanExerciseId: "exercise-1" },
    });
    expect(handler.mock.calls[1][0].detail).toEqual({
      action: "navigate-back-from-training-plan-detail",
    });
  });

  it("renders loading, error, and unavailable states", () => {
    const el = document.createElement(pbTrainingPlanDetailScreenTag) as HTMLElement & {
      state: TrainingPlanDetailScreenState;
    };
    document.body.append(el);

    el.state = createState({ detail: null, isLoading: true });
    expect(el.textContent ?? "").toContain("Loading training plan detail...");

    el.state = createState({ detail: null, errorMessage: "Unable to load detail." });
    expect(el.textContent ?? "").toContain("Unable to load detail.");

    el.state = createState({ detail: null });
    expect(el.textContent ?? "").toContain("Training plan detail unavailable.");
  });
});
