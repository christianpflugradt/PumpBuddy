import assert from "node:assert/strict";
import { test } from "vitest";

import { renderExerciseScreen } from "./workout-render";
import { buildWorkoutPlan } from "./workout-state";
import type { PlanExerciseOptionSummary, WorkoutPlan } from "./workout-types";

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

const makeExerciseHtml = (plan: WorkoutPlan): string =>
  renderExerciseScreen(
    plan,
    0,
    {
      selectedWorkoutMode: "configured-gym",
      selectedGymId: "gym-1",
      gyms: [{ id: "gym-1", name: "Forge Downtown" }],
    },
    { message: null, confirmActionLabel: null, onConfirm: null },
    { id: null, startedAt: null, persistedExerciseCount: 0 },
    { isSaving: false, errorMessage: null },
    { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
  );

test("renderExerciseScreen hides load controls for stationless configured-gym selections", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Bodyweight Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [stationlessOption()],
    },
  );

  const html = makeExerciseHtml(plan);

  assert.doesNotMatch(html, /id="exercise-load"/);
  assert.doesNotMatch(html, /data-action="increment-load"/);
  assert.doesNotMatch(html, /data-action="decrement-load"/);
  assert.match(html, /id="exercise-reps"/);
  assert.match(html, /data-action="increment-reps"/);
});

test("renderExerciseScreen keeps load controls for station-based configured-gym selections", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          ...stationlessOption(),
          id: "option-station",
          variant_id: "variant-machine",
          variant_name: "Machine",
          station_id: "station-1",
          station_name: "Rack A",
          station_profile_loads_kg: [10, 15, 20],
        },
      ],
    },
  );

  const html = makeExerciseHtml(plan);

  assert.match(html, /id="exercise-load"/);
  assert.match(html, /data-action="increment-load"/);
  assert.match(html, /data-action="decrement-load"/);
});

test("renderExerciseScreen rounds completed set loads with shared display semantics", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          ...stationlessOption(),
          id: "option-station",
          variant_id: "variant-machine",
          variant_name: "Machine",
          station_id: "station-1",
          station_name: "Rack A",
          station_profile_loads_kg: [10, 15, 20],
        },
      ],
    },
  );
  plan.exercises[0]?.completedSets.push({ setIndex: 1, loadValue: 27.2155422, reps: 8 });

  const html = makeExerciseHtml(plan);

  assert.match(html, /Completed set 1: 27\.22 kg for 8 reps/);
  assert.match(html, />27\.22 kg</);
});

test("renderExerciseScreen uses the same canonical formatting for input and completed load values", () => {
  const preciseLoadKg = 27.2155422;
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          ...stationlessOption(),
          id: "option-station",
          variant_id: "variant-machine",
          variant_name: "Machine",
          station_id: "station-1",
          station_name: "Rack A",
          station_profile_loads_kg: [10, preciseLoadKg],
        },
      ],
    },
  );
  plan.exercises[0]?.completedSets.push({ setIndex: 1, loadValue: preciseLoadKg, reps: 8 });

  const html = makeExerciseHtml(plan);

  assert.match(
    html,
    /id="exercise-load"[\s\S]*value="27\.22"[\s\S]*class="completed-set-row"[\s\S]*27\.22 kg/s,
  );
});
