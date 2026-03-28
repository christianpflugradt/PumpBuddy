import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildActiveWorkoutProgressPayload,
  buildWorkoutPlan,
  formatLoadInputValue,
  normalizeExerciseActiveSet,
  stepWithinProfileLoads,
  withFallbackOptionSelected,
} from "./workout-state";
import type { PlanExerciseOptionSummary } from "./workout-types";

const stationlessOption = (): PlanExerciseOptionSummary => ({
  id: "option-stationless",
  training_plan_exercise_id: "tpe-1",
  exercise_name: "Push Up",
  exercise_position: 1,
  variant_id: "variant-bodyweight",
  variant_name: "Bodyweight",
  variant_type: "bodyweight",
  station_id: null,
  station_name: null,
  station_profile_loads_kg: [],
});

test("buildWorkoutPlan keeps stationless options as realizable and drafts reps-only sets", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Bodyweight Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [stationlessOption()],
    },
  );

  assert.equal(plan.exercises[0]?.selectedStationId, null);
  assert.equal(plan.exercises[0]?.suggestedSet.loadValue, null);
  assert.equal(plan.exercises[0]?.activeSet.loadValue, null);
  assert.equal(plan.exercises[0]?.activeSetInput.loadValue, "");
});

test("withFallbackOptionSelected resets stationless selections to reps-only drafts", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Mixed Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          ...stationlessOption(),
          id: "option-machine",
          variant_id: "variant-machine",
          variant_name: "Machine",
          station_id: "station-1",
          station_name: "Rack A",
          station_profile_loads_kg: [10, 15, 20],
        },
        stationlessOption(),
      ],
    },
  );

  const nextPlan = withFallbackOptionSelected(plan, 0, "option-stationless");

  assert.equal(nextPlan.exercises[0]?.selectedStationId, null);
  assert.deepEqual(nextPlan.exercises[0]?.selectedStationProfileLoadsKg, []);
  assert.equal(nextPlan.exercises[0]?.activeSet.loadValue, null);
  assert.equal(nextPlan.exercises[0]?.activeSetInput.loadValue, "");
});

test("buildActiveWorkoutProgressPayload emits null load values for stationless completed sets", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Bodyweight Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [stationlessOption()],
    },
  );
  plan.exercises[0]?.completedSets.push({
    setIndex: 1,
    loadValue: null,
    reps: 12,
  });

  const payload = buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-03-01T10:00:00.000Z", 1);

  assert.equal(payload.exercises[0]?.completed_sets[0]?.load_value, null);
});

test("buildActiveWorkoutProgressPayload snaps configured-gym loads to canonical station profile values", () => {
  const canonicalLoads = [27.2155422, 31.7514659];
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Cable Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "option-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Cable Torso Rotation",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Cable Torso Rotation",
          variant_type: "cable",
          station_id: "station-1",
          station_name: "Cable 1",
          station_profile_loads_kg: canonicalLoads,
        },
      ],
    },
  );

  plan.exercises[0]?.completedSets.push({
    setIndex: 1,
    loadValue: 27.22,
    reps: 10,
  });

  const payload = buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-03-01T10:00:00.000Z", 1);

  assert.equal(payload.exercises[0]?.completed_sets[0]?.load_value, canonicalLoads[0]);
});

test("normalizeExerciseActiveSet keeps stationless selections on null load while normalizing reps", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Bodyweight Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [stationlessOption()],
    },
  );
  const exercise = plan.exercises[0]!;

  exercise.activeSetInput.loadValue = "27";
  exercise.activeSetInput.reps = "0";

  normalizeExerciseActiveSet(exercise, "configured-gym");

  assert.equal(exercise.activeSet.loadValue, null);
  assert.equal(exercise.activeSetInput.loadValue, "");
  assert.equal(exercise.activeSet.reps, 1);
  assert.equal(exercise.activeSetInput.reps, "1");
});

test("stepWithinProfileLoads traverses backend-provided canonical profile loads", () => {
  const loads = [5, 12.5, 20, 27.5, 40];

  assert.equal(stepWithinProfileLoads(loads, 20, "increase"), 27.5);
  assert.equal(stepWithinProfileLoads(loads, 20, "decrease"), 12.5);
  assert.equal(stepWithinProfileLoads(loads, 5, "decrease"), 5);
  assert.equal(stepWithinProfileLoads(loads, 40, "increase"), 40);
  assert.equal(stepWithinProfileLoads(loads, 21.2, "increase"), 27.5);
});

test("formatLoadInputValue rounds to two decimals and trims trailing zeros", () => {
  assert.equal(formatLoadInputValue(27.2155422), "27.22");
  assert.equal(formatLoadInputValue(20.5), "20.5");
  assert.equal(formatLoadInputValue(20), "20");
  assert.equal(formatLoadInputValue(null), "");
});
