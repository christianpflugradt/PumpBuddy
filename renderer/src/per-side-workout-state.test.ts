import { describe, expect, it } from "vitest";
import {
  normalizeExerciseActiveSet,
  stepWithinProfileLoadsForInputMode,
  withCurrentSetCompleted,
} from "./workout-state";
import {
  applyActiveWorkoutResponse,
  buildActiveWorkoutProgressPayload,
} from "./workout-contract-state";
import type { ActiveWorkoutResponse } from "./workout-contract";
import type { WorkoutPlan } from "./workout-types";

const buildPerSidePlan = (): WorkoutPlan => ({
  id: "plan-1",
  name: "Per-Side Plan",
  exercises: [
    {
      trainingPlanExerciseId: "tpe-1",
      name: "Dumbbell Press",
      fallbackOptions: [],
      selectedTrainingPlanExerciseVariantId: "opt-1",
      selectedVariantId: "variant-1",
      selectedStationId: "station-1",
      selectedStationProfileLoadsKg: [10, 12.5, 15],
      loadInputMode: "PER_SIDE",
      isFallbackOptionConfirmed: true,
      skippedAt: null,
      suggestedSet: { loadValue: 10, reps: 10 },
      activeSet: { loadValue: 10, reps: 10 },
      activeSetInput: { loadValue: "10", reps: "10" },
      completedSets: [],
      isReadOnly: false,
    },
  ],
});

describe("per-side workout state", () => {
  it("converts per-side input to canonical total payload values", () => {
    const draftPlan = buildPerSidePlan();
    const currentExercise = draftPlan.exercises[0];
    if (!currentExercise) {
      throw new Error("test plan requires one exercise");
    }

    currentExercise.activeSetInput.loadValue = "12";
    normalizeExerciseActiveSet(currentExercise, "configured-gym");
    const completedPlan = withCurrentSetCompleted(draftPlan, 0);
    const payload = buildActiveWorkoutProgressPayload(completedPlan, "gym-1", "now", 1, {
      includeExercisePositions: [1],
    });

    expect(payload.exercises[0]?.load_input_mode).toBe("PER_SIDE");
    expect(payload.exercises[0]?.set_tracking_mode).toBe("BILATERAL");
    expect(payload.exercises[0]?.completed_sets[0]).toMatchObject({
      set_index: 1,
      set_side: "BILATERAL",
      load_value: 24,
      load_value_per_side: 12,
      repetition_value: 10,
    });
    expect(completedPlan.exercises[0]?.completedSets[0]?.loadValue).toBe(24);
  });

  it("hydrates per-side active suggestions as per-side input while keeping completed totals canonical", () => {
    const plan = buildPerSidePlan();
    const response: ActiveWorkoutResponse = {
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Per-Side Plan",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "now",
        updated_at: "now",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Dumbbell Press",
            selected_training_plan_exercise_variant_id: "opt-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Dumbbell Press",
            load_input_mode: "PER_SIDE",
            set_tracking_mode: "BILATERAL",
            selected_station_id: "station-1",
            selected_station_name: "Rack",
            skipped_at: null,
            completed_sets: [
              {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 24,
                load_value_per_side: 12,
                repetition_value: 9,
              },
            ],
            suggested_set: {
              set_index: 2,
              set_side: "BILATERAL",
              suggested_load_input_kg: 11,
              suggested_load_total_kg: 22,
              repetition_value: 8,
            },
          },
        ],
      },
    };

    const hydrated = applyActiveWorkoutResponse(plan, response);
    const hydratedExercise = hydrated.exercises[0];
    expect(hydratedExercise?.loadInputMode).toBe("PER_SIDE");
    expect(hydratedExercise?.suggestedSet).toEqual({ loadValue: 11, reps: 8 });
    expect(hydratedExercise?.activeSet).toEqual({ loadValue: 11, reps: 8 });
    expect(hydratedExercise?.setTrackingMode).toBe("BILATERAL");
    expect(hydratedExercise?.currentSetIndex).toBe(2);
    expect(hydratedExercise?.currentSetSide).toBe("BILATERAL");
    expect(hydratedExercise?.completedSets[0]).toMatchObject({ loadValue: 24, reps: 9 });
  });

  it("progresses unilateral sets left then right before advancing set index", () => {
    const plan = buildPerSidePlan();
    const exercise = plan.exercises[0];
    if (!exercise) {
      throw new Error("test plan requires one exercise");
    }
    exercise.setTrackingMode = "UNILATERAL";
    exercise.currentSetIndex = 1;
    exercise.currentSetSide = "LEFT";

    const leftCompleted = withCurrentSetCompleted(plan, 0);
    expect(leftCompleted.exercises[0]?.completedSets[0]).toMatchObject({
      setIndex: 1,
      setSide: "LEFT",
    });
    expect(leftCompleted.exercises[0]?.currentSetIndex).toBe(1);
    expect(leftCompleted.exercises[0]?.currentSetSide).toBe("RIGHT");

    const bothSidesCompleted = withCurrentSetCompleted(leftCompleted, 0);
    expect(bothSidesCompleted.exercises[0]?.completedSets[1]).toMatchObject({
      setIndex: 1,
      setSide: "RIGHT",
    });
    expect(bothSidesCompleted.exercises[0]?.currentSetIndex).toBe(2);
    expect(bothSidesCompleted.exercises[0]?.currentSetSide).toBe("LEFT");
  });

  it("steps configured-gym loads on per-side profile values", () => {
    expect(
      stepWithinProfileLoadsForInputMode([10, 12.5, 15], 12.5, "PER_SIDE", "increase"),
    ).toBe(15);
    expect(
      stepWithinProfileLoadsForInputMode([10, 12.5, 15], 12.5, "PER_SIDE", "decrease"),
    ).toBe(10);
  });
});
