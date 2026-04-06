import { describe, it, expect } from "vitest";
import {
  applyActiveWorkoutResponse,
  buildActiveWorkoutProgressPayload,
  buildCreateWorkoutRequest,
  buildWorkoutPlan,
  buildWorkoutPlanFromFreeModeActiveWorkout,
  canStartWorkout,
  countPersistedExercises,
  createInitialStartScreenState,
  getNextViewState,
  hasCompletedSets,
  isDigitsOnly,
  isDraftModified,
  normalizeExerciseActiveSet,
  optionSelectionKey,
  selectDefaultTrainingPlanId,
  setExerciseReadOnly,
  stepWithinProfileLoads,
  stepWithinProfileLoadsForInputMode,
  withCurrentSetCompleted,
  withFallbackOptionSelected,
  withFallbackOptionSelectionConfirmed,
  withLatestCompletedSetRemoved,
} from "./workout-state";
import type { ActiveWorkoutResponse, TrainingPlanOptionsResponse, WorkoutPlan } from "./workout-types";

const basePlanSummary = { id: "plan-1", name: "Plan", exercise_count: 1 };

const baseOptions = (): TrainingPlanOptionsResponse => ({
  training_plan_id: "plan-1",
  gym_id: "gym-1",
  options: [
    {
      id: "opt-1",
      training_plan_exercise_id: "tpe-1",
      exercise_name: "Row",
      exercise_position: 1,
      variant_id: "variant-1",
      variant_name: "Cable",
      station_id: "station-1",
      station_name: "Cable 1",
      station_profile_loads_kg: [20, 25, 30],
      suggested_start_load_kg: 25,
      load_input_mode: "TOTAL",
    },
  ],
});

const baseWorkoutPlan = (): WorkoutPlan => buildWorkoutPlan(basePlanSummary, baseOptions());

describe("workout-state (core utils)", () => {
  it("creates initial start screen state", () => {
    const state = createInitialStartScreenState();
    expect(state.isLoading).toBe(true);
    expect(state.trainingPlans).toEqual([]);
  });

  it("canStartWorkout returns false when loading", () => {
    const state = createInitialStartScreenState();
    expect(canStartWorkout(state)).toBe(false);
  });

  it("canStartWorkout returns true when valid", () => {
    const state = {
      ...createInitialStartScreenState(),
      isLoading: false,
      selectedTrainingPlanId: "plan-1",
      selectedGymId: "gym-1",
    };
    expect(canStartWorkout(state)).toBe(true);
  });

  it("canStartWorkout allows free mode without selected gym", () => {
    const state = {
      ...createInitialStartScreenState(),
      isLoading: false,
      selectedTrainingPlanId: "plan-1",
      selectedGymId: "",
      selectedWorkoutMode: "free-mode" as const,
      errorMessage: null,
    };

    expect(canStartWorkout(state)).toBe(true);
  });

  it("getNextViewState advances exercise", () => {
    const next = getNextViewState(
      { screen: "exercise", exerciseIndex: 0 },
      "next",
      3,
    );
    expect(next).toEqual({ screen: "exercise", exerciseIndex: 1 });
  });

  it("getNextViewState goes to completion at end", () => {
    const next = getNextViewState(
      { screen: "exercise", exerciseIndex: 2 },
      "next",
      3,
    );
    expect(next).toEqual({ screen: "completion" });
  });

  it("isDigitsOnly works correctly", () => {
    expect(isDigitsOnly("123")).toBe(true);
    expect(isDigitsOnly("12a")).toBe(false);
  });

  it("hasCompletedSets detects sets", () => {
    const step = { completedSets: [{ setIndex: 1, loadValue: 10, reps: 10 }] } as any;
    expect(hasCompletedSets(step)).toBe(true);
  });

  it("isDraftModified detects changes", () => {
    const step = {
      activeSet: { loadValue: 20, reps: 10 },
      suggestedSet: { loadValue: 10, reps: 10 },
    } as any;
    expect(isDraftModified(step)).toBe(true);
  });

  it("selects the training plan completed longest ago by default", () => {
    const selectedId = selectDefaultTrainingPlanId([
      {
        id: "plan-recent",
        name: "Recent",
        exercise_count: 5,
        last_completed_at: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "plan-oldest",
        name: "Oldest",
        exercise_count: 5,
        last_completed_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "plan-middle",
        name: "Middle",
        exercise_count: 5,
        last_completed_at: "2026-02-15T10:00:00.000Z",
      },
    ]);

    expect(selectedId).toBe("plan-oldest");
  });

  it("keeps first option order when oldest completion timestamps tie", () => {
    const selectedId = selectDefaultTrainingPlanId([
      {
        id: "plan-first",
        name: "First",
        exercise_count: 5,
        last_completed_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "plan-second",
        name: "Second",
        exercise_count: 5,
        last_completed_at: "2026-01-04T10:00:00.000Z",
      },
      {
        id: "plan-newer",
        name: "Newer",
        exercise_count: 5,
        last_completed_at: "2026-03-20T10:00:00.000Z",
      },
    ]);

    expect(selectedId).toBe("plan-first");
  });

  it("buildWorkoutPlan keeps first fallback option when no completion history exists", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-first",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Cable",
            station_id: "station-a",
            station_name: "Cable 1",
            suggested_start_load_kg: 20,
          },
          {
            id: "opt-second",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-b",
            variant_name: "Machine",
            station_id: "station-b",
            station_name: "Machine 1",
            suggested_start_load_kg: 25,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-first");
    expect(plan.exercises[0]?.selectedStationId).toBe("station-a");
  });

  it("buildWorkoutPlan initializes SECS variants at zero seconds", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-secs",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Plank",
            exercise_position: 1,
            variant_id: "variant-secs",
            variant_name: "Timed Hold",
            variant_type: "bodyweight",
            repetition_kind: "SECS",
            station_id: "station-1",
            station_name: "Mat",
            suggested_start_load_kg: 0,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.repetitionKind).toBe("SECS");
    expect(plan.exercises[0]?.suggestedSet.reps).toBe(0);
    expect(plan.exercises[0]?.activeSet.reps).toBe(0);
    expect(plan.exercises[0]?.activeSetInput.reps).toBe("0");
  });

  it("buildWorkoutPlan selects the most recent fallback option by variant+station", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-cable-old",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Chest Press",
            exercise_position: 1,
            variant_id: "variant-cable",
            variant_name: "Cable",
            station_id: "station-cable",
            station_name: "Cable Station",
            last_completed_at: "2026-03-01T08:00:00.000Z",
            suggested_start_load_kg: 15,
          },
          {
            id: "opt-cable-new-station",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Chest Press",
            exercise_position: 1,
            variant_id: "variant-cable",
            variant_name: "Cable",
            station_id: "station-cable-2",
            station_name: "Cable Station 2",
            last_completed_at: "2026-03-21T08:00:00.000Z",
            suggested_start_load_kg: 17.5,
          },
          {
            id: "opt-machine-middle",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Chest Press",
            exercise_position: 1,
            variant_id: "variant-machine",
            variant_name: "Machine",
            station_id: "station-machine",
            station_name: "Machine Station",
            last_completed_at: "2026-03-12T08:00:00.000Z",
            suggested_start_load_kg: 20,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-cable-new-station");
    expect(plan.exercises[0]?.selectedVariantId).toBe("variant-cable");
    expect(plan.exercises[0]?.selectedStationId).toBe("station-cable-2");
  });

  it("buildWorkoutPlan keeps first-order tie break when fallback recency is equal", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-first",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Lat Pull",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Wide Grip",
            station_id: "station-a",
            station_name: "Pulldown A",
            last_completed_at: "2026-03-20T10:00:00.000Z",
            suggested_start_load_kg: 40,
          },
          {
            id: "opt-second",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Lat Pull",
            exercise_position: 1,
            variant_id: "variant-b",
            variant_name: "Neutral Grip",
            station_id: "station-b",
            station_name: "Pulldown B",
            last_completed_at: "2026-03-20T10:00:00.000Z",
            suggested_start_load_kg: 42.5,
          },
        ],
      },
    );

    expect(plan.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-first");
    expect(plan.exercises[0]?.selectedStationId).toBe("station-a");
  });

  it("rejects configured-gym plans when exercises are missing realizable options", () => {
    expect(() =>
      buildWorkoutPlan(
        { id: "plan-1", name: "Plan", exercise_count: 2 },
        {
          training_plan_id: "plan-1",
          gym_id: "gym-1",
          options: [
            {
              id: "opt-a",
              training_plan_exercise_id: "tpe-1",
              exercise_name: "Row",
              exercise_position: 1,
              variant_id: "variant-a",
              variant_name: "Cable",
              station_id: "station-a",
              station_name: "Cable 1",
            },
          ],
        },
      ),
    ).toThrow(/workout start is blocked/i);
  });

  it("builds option selection keys with empty station fallback", () => {
    expect(optionSelectionKey({ id: "opt-a", station_id: null })).toBe("opt-a::");
  });

  it("steps profile loads for exact and in-between values", () => {
    expect(stepWithinProfileLoads([20, 25, 30], 25, "decrease")).toBe(20);
    expect(stepWithinProfileLoads([20, 25, 30], 25, "increase")).toBe(30);
    expect(stepWithinProfileLoads([20, 25, 30], 26, "decrease")).toBe(25);
    expect(stepWithinProfileLoads([20, 25, 30], 26, "increase")).toBe(30);
  });

  it("returns null for invalid profile stepping inputs", () => {
    expect(stepWithinProfileLoads([], 20, "increase")).toBeNull();
    expect(stepWithinProfileLoads([20, 30], Number.NaN, "increase")).toBeNull();
    expect(stepWithinProfileLoadsForInputMode([20, 30], 20, "PER_SIDE", "decrease")).toBe(20);
  });

  it("does not switch fallback option after set completion", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.completedSets = [{ setIndex: 1, reps: 8, loadValue: 25 }];

    const next = withFallbackOptionSelected(plan, 0, "opt-1::station-1");

    expect(next.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-1");
    expect(next.exercises[0]?.completedSets).toHaveLength(1);
  });

  it("keeps fallback confirmation unchanged when no selected option exists", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.fallbackOptions = [
      {
        ...plan.exercises[0]!.fallbackOptions[0]!,
        id: "opt-a",
      },
      {
        ...plan.exercises[0]!.fallbackOptions[0]!,
        id: "opt-b",
      },
    ];
    plan.exercises[0]!.selectedPlanExerciseOptionId = null;
    plan.exercises[0]!.isFallbackOptionConfirmed = false;

    const next = withFallbackOptionSelectionConfirmed(plan, 0);

    expect(next.exercises[0]?.isFallbackOptionConfirmed).toBe(false);
  });

  it("tracks unilateral set completion side progression", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    plan.exercises[0]!.currentSetIndex = 2;
    plan.exercises[0]!.currentSetSide = "LEFT";

    const afterLeft = withCurrentSetCompleted(plan, 0);
    expect(afterLeft.exercises[0]?.completedSets[afterLeft.exercises[0]!.completedSets.length - 1]).toMatchObject({
      setIndex: 2,
      setSide: "LEFT",
    });
    expect(afterLeft.exercises[0]?.currentSetIndex).toBe(2);
    expect(afterLeft.exercises[0]?.currentSetSide).toBe("RIGHT");

    const afterRight = withCurrentSetCompleted(afterLeft, 0);
    expect(
      afterRight.exercises[0]?.completedSets[afterRight.exercises[0]!.completedSets.length - 1],
    ).toMatchObject({
      setIndex: 2,
      setSide: "RIGHT",
    });
    expect(afterRight.exercises[0]?.currentSetIndex).toBe(3);
    expect(afterRight.exercises[0]?.currentSetSide).toBe("LEFT");
  });

  it("withLatestCompletedSetRemoved removes only latest bilateral set", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.setTrackingMode = "BILATERAL";
    plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 10 },
      { setIndex: 2, setSide: "BILATERAL", loadValue: 25, reps: 8 },
    ];

    const next = withLatestCompletedSetRemoved(plan, 0);

    expect(next.exercises[0]?.completedSets).toEqual([
      { setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 10 },
    ]);
  });

  it("withLatestCompletedSetRemoved removes latest unilateral row by set index", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.setTrackingMode = "UNILATERAL";
    plan.exercises[0]!.completedSets = [
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 22, reps: 9 },
      { setIndex: 2, setSide: "LEFT", loadValue: 24, reps: 8 },
    ];

    const next = withLatestCompletedSetRemoved(plan, 0);

    expect(next.exercises[0]?.completedSets).toEqual([
      { setIndex: 1, setSide: "LEFT", loadValue: 20, reps: 10 },
      { setIndex: 1, setSide: "RIGHT", loadValue: 22, reps: 9 },
    ]);
  });

  it("resets active SECS value to zero after completing a set", () => {
    const plan = baseWorkoutPlan();
    const exercise = plan.exercises[0]!;
    exercise.repetitionKind = "SECS";
    exercise.activeSet.reps = 42;
    exercise.activeSetInput.reps = "42";

    const next = withCurrentSetCompleted(plan, 0);

    expect(next.exercises[0]?.completedSets[0]?.reps).toBe(42);
    expect(next.exercises[0]?.activeSet.reps).toBe(0);
    expect(next.exercises[0]?.activeSetInput.reps).toBe("0");
  });

  it("buildCreateWorkoutRequest omits load for stationless selected option", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.selectedPlanExerciseOptionId = "opt-stationless";
    plan.exercises[0]!.selectedStationId = null;
    plan.exercises[0]!.activeSet.loadValue = 50;

    const payload = buildCreateWorkoutRequest(plan, "gym-1", "2026-04-03T10:00:00.000Z");

    expect(payload.exercises[0]?.set.load_value).toBeNull();
  });

  it("buildActiveWorkoutProgressPayload includes explicit positions without completed sets", () => {
    const plan = baseWorkoutPlan();

    const payload = buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-04-03T10:00:00.000Z", 1, {
      includeExercisePositions: [1],
    });

    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]?.position).toBe(1);
    expect(payload.exercises[0]?.completed_sets).toEqual([]);
  });

  it("serializes repetition_kind and repetition_value in active workout payload", () => {
    const plan = baseWorkoutPlan();
    plan.exercises[0]!.repetitionKind = "SECS";
    plan.exercises[0]!.completedSets = [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 125 }];

    const payload = buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-04-03T10:00:00.000Z", 1);
    const set = payload.exercises[0]?.completed_sets[0];

    expect(set?.repetition_kind).toBe("SECS");
    expect(set?.repetition_value).toBe(125);
  });

  it("hydrates SECS completed set history from repetition_value", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-secs",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Plank",
            exercise_position: 1,
            variant_id: "variant-secs",
            variant_name: "Timed Hold",
            repetition_kind: "SECS",
            station_id: "station-1",
            station_name: "Mat",
          },
        ],
      },
    );

    const response: ActiveWorkoutResponse = {
      workout: {
        id: "active-1",
        training_plan_id: "plan-1",
        training_plan_name: "Plan",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-04-03T09:00:00.000Z",
        updated_at: "2026-04-03T09:05:00.000Z",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Plank",
            selected_plan_exercise_option_id: "opt-secs",
            selected_variant_id: "variant-secs",
            selected_variant_name: "Timed Hold",
            selected_station_id: "station-1",
            selected_station_name: "Mat",
            completed_sets: [
              {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 0,
                repetition_kind: "SECS",
                repetition_value: 125,
              },
            ],
            suggested_set: {
              set_index: 2,
              set_side: "BILATERAL",
              load_value: 0,
              repetition_kind: "SECS",
              repetition_value: 0,
            },
          },
        ],
      },
    };

    const applied = applyActiveWorkoutResponse(plan, response);
    expect(applied.exercises[0]?.completedSets[0]?.reps).toBe(125);
  });

  it("initializes first-set SECS active input at zero while retaining prior suggestion", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-secs",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Plank",
            exercise_position: 1,
            variant_id: "variant-secs",
            variant_name: "Timed Hold",
            repetition_kind: "SECS",
            station_id: null,
            station_name: "Bodyweight",
          },
        ],
      },
    );

    const response: ActiveWorkoutResponse = {
      workout: {
        id: "active-1",
        training_plan_id: "plan-1",
        training_plan_name: "Plan",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-04-03T09:00:00.000Z",
        updated_at: "2026-04-03T09:05:00.000Z",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Plank",
            selected_plan_exercise_option_id: "opt-secs",
            selected_variant_id: "variant-secs",
            selected_variant_name: "Timed Hold",
            selected_station_id: null,
            selected_station_name: "Bodyweight",
            completed_sets: [],
            suggested_set: {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: null,
              repetition_kind: "SECS",
              repetition_value: 75,
            },
          },
        ],
      },
    };

    const applied = applyActiveWorkoutResponse(plan, response);
    expect(applied.exercises[0]?.suggestedSet.reps).toBe(75);
    expect(applied.exercises[0]?.activeSet.reps).toBe(0);
    expect(applied.exercises[0]?.activeSetInput.reps).toBe("0");
  });

  it("keeps non-first-set SECS active input aligned with hydrated suggestion", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-secs",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Plank",
            exercise_position: 1,
            variant_id: "variant-secs",
            variant_name: "Timed Hold",
            repetition_kind: "SECS",
            station_id: "station-1",
            station_name: "Mat",
          },
        ],
      },
    );

    const response: ActiveWorkoutResponse = {
      workout: {
        id: "active-1",
        training_plan_id: "plan-1",
        training_plan_name: "Plan",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-04-03T09:00:00.000Z",
        updated_at: "2026-04-03T09:05:00.000Z",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Plank",
            selected_plan_exercise_option_id: "opt-secs",
            selected_variant_id: "variant-secs",
            selected_variant_name: "Timed Hold",
            selected_station_id: "station-1",
            selected_station_name: "Mat",
            completed_sets: [
              {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 0,
                repetition_kind: "SECS",
                repetition_value: 30,
              },
            ],
            suggested_set: {
              set_index: 2,
              set_side: "BILATERAL",
              load_value: 0,
              repetition_kind: "SECS",
              repetition_value: 90,
            },
          },
        ],
      },
    };

    const applied = applyActiveWorkoutResponse(plan, response);
    expect(applied.exercises[0]?.activeSet.reps).toBe(90);
    expect(applied.exercises[0]?.activeSetInput.reps).toBe("90");
  });

  it("applies persisted exercise fallback when exact station match is missing", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 1 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-a",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Cable",
            station_id: "station-a",
            station_name: "Cable A",
            station_profile_loads_kg: [20, 25],
          },
          {
            id: "opt-a",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Cable",
            station_id: "station-b",
            station_name: "Cable B",
            station_profile_loads_kg: [30, 35],
          },
        ],
      },
    );

    const response: ActiveWorkoutResponse = {
      workout: {
        id: "active-1",
        training_plan_id: "plan-1",
        training_plan_name: "Plan",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-04-03T09:00:00.000Z",
        updated_at: "2026-04-03T09:05:00.000Z",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Row",
            selected_plan_exercise_option_id: "opt-a",
            selected_variant_id: "variant-a",
            selected_variant_name: "Cable",
            selected_station_id: "unknown-station",
            selected_station_name: "Unknown",
            completed_sets: [],
            suggested_set: { reps: 10, load_value: 25 },
          },
        ],
      },
    };

    const applied = applyActiveWorkoutResponse(plan, response);
    expect(applied.exercises[0]?.selectedPlanExerciseOptionId).toBe("opt-a");
    expect(applied.exercises[0]?.selectedStationId).toBe("unknown-station");
    expect(applied.exercises[0]?.selectedStationProfileLoadsKg).toEqual([20, 25]);
  });

  it("normalizes active set inputs with stationless and rep bounds", () => {
    const plan = baseWorkoutPlan();
    const exercise = plan.exercises[0]!;
    exercise.selectedPlanExerciseOptionId = "opt-1";
    exercise.selectedStationId = null;
    exercise.activeSet.loadValue = 20;
    exercise.activeSet.reps = 8;
    exercise.activeSetInput = { loadValue: "40", reps: "0" };

    normalizeExerciseActiveSet(exercise, "configured-gym");

    expect(exercise.activeSet.loadValue).toBeNull();
    expect(exercise.activeSet.reps).toBe(1);
    expect(exercise.activeSetInput.reps).toBe("1");
  });

  it("buildWorkoutPlanFromFreeModeActiveWorkout infers unilateral side and counts persisted", () => {
    const response: ActiveWorkoutResponse = {
      workout: {
        id: "active-1",
        training_plan_id: "plan-1",
        training_plan_name: "Plan",
        gym_id: null,
        gym_name: null,
        started_at: "2026-04-03T09:00:00.000Z",
        updated_at: "2026-04-03T09:05:00.000Z",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Lunge",
            selected_plan_exercise_option_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            set_tracking_mode: "UNILATERAL",
            skipped_at: null,
            completed_sets: [{ set_index: 1, set_side: "LEFT", load_value: 20, reps: 8 }],
            suggested_set: { set_index: 1, set_side: "RIGHT", load_value: 20, reps: 8 },
          },
        ],
      },
    };

    const plan = buildWorkoutPlanFromFreeModeActiveWorkout(response);

    expect(plan.exercises[0]?.setTrackingMode).toBe("UNILATERAL");
    expect(plan.exercises[0]?.currentSetSide).toBe("RIGHT");
    expect(countPersistedExercises(response)).toBe(1);
  });

  it("sets exercise read-only without mutating other exercises", () => {
    const plan = buildWorkoutPlan(
      { id: "plan-1", name: "Plan", exercise_count: 2 },
      {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "opt-a",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Row",
            exercise_position: 1,
            variant_id: "variant-a",
            variant_name: "Cable",
            station_id: "station-a",
            station_name: "Cable A",
          },
          {
            id: "opt-b",
            training_plan_exercise_id: "tpe-2",
            exercise_name: "Press",
            exercise_position: 2,
            variant_id: "variant-b",
            variant_name: "Machine",
            station_id: "station-b",
            station_name: "Machine B",
          },
        ],
      },
    );

    const next = setExerciseReadOnly(plan, 1, true);
    expect(next.exercises[1]?.isReadOnly).toBe(true);
    expect(next.exercises[0]?.isReadOnly).toBe(false);
  });
});
