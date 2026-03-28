import assert from "node:assert/strict";
import { test } from "vitest";

import { renderCompletionScreen, renderExerciseScreen, renderStartScreen } from "./workout-render";
import { buildWorkoutPlan } from "./workout-state";
import type { PlanExerciseOptionSummary, StartScreenState, WorkoutPlan } from "./workout-types";

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

const makeStartScreenState = (overrides: Partial<StartScreenState> = {}): StartScreenState => ({
  isLoading: false,
  isStarting: false,
  errorMessage: null,
  blockedStartModal: null,
  trainingPlans: [{ id: "plan-1", name: "Push Day", exercise_count: 2 }],
  gyms: [{ id: "gym-1", name: "Forge Downtown" }],
  selectedTrainingPlanId: "plan-1",
  selectedGymId: "gym-1",
  selectedWorkoutMode: "configured-gym",
  ...overrides,
});

test("renderStartScreen preserves workout context cues and primary start action placement", () => {
  const html = renderStartScreen(makeStartScreenState());

  assert.match(html, /class="start-preview-cue-label">Training Plan<\/span>/);
  assert.match(html, /class="start-preview-cue-value">Push Day<\/span>/);
  assert.match(html, /class="start-preview-cue-label">Location<\/span>/);
  assert.match(html, /class="start-preview-cue-value">Forge Downtown<\/span>/);
  assert.match(
    html,
    /<section class="start-preview"[\s\S]*<\/section>\s*<button[\s\S]*class="start-button nav-button nav-button-primary action-button action-button-primary"[\s\S]*data-action="start-workout"/s,
  );
});

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
          suggested_start_load_kg: 10,
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
          suggested_start_load_kg: 10,
        },
      ],
    },
  );
  plan.exercises[0]?.completedSets.push({ setIndex: 1, loadValue: 27.2155422, reps: 8 });

  const html = makeExerciseHtml(plan);

  assert.match(html, /Completed set 1: 27\.22 kg for 8 reps/);
  assert.match(html, />27\.22 kg</);
});

test("renderExerciseScreen always renders completed-set history shell with empty-state when no sets exist", () => {
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
          suggested_start_load_kg: 10,
        },
      ],
    },
  );

  const html = makeExerciseHtml(plan);

  assert.match(html, /class="completed-set-list"[\s\S]*aria-label="Completed set history"/s);
  assert.match(html, /data-history-state="empty"/);
  assert.match(html, /class="completed-set-empty"[^>]*>No completed sets yet\.<\/p>/);
  assert.doesNotMatch(html, /class="completed-set-row"/);
});

test("renderExerciseScreen renders completed-set rows when history is populated", () => {
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
          suggested_start_load_kg: 10,
        },
      ],
    },
  );
  plan.exercises[0]?.completedSets.push({ setIndex: 1, loadValue: 10, reps: 12 });

  const html = makeExerciseHtml(plan);

  assert.match(html, /class="completed-set-list"[\s\S]*aria-label="Completed set history"/s);
  assert.match(html, /data-history-state="populated"/);
  assert.match(html, /class="completed-set-row"/);
  assert.doesNotMatch(html, /class="completed-set-empty"/);
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
          suggested_start_load_kg: preciseLoadKg,
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

test("renderExerciseScreen keeps required workout context visible in the header", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Leg Day", exercise_count: 2 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          ...stationlessOption(),
          id: "option-deadlift",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Deadlift",
          exercise_position: 1,
          variant_id: "variant-conventional",
          variant_name: "Conventional Barbell Deadlift",
          station_id: "station-rack-1",
          station_name: "Rack 1",
          station_profile_loads_kg: [20, 40, 60],
          suggested_start_load_kg: 20,
        },
        {
          ...stationlessOption(),
          id: "option-row",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Row",
          exercise_position: 2,
          variant_id: "variant-row",
          variant_name: "Barbell Row",
          station_id: "station-rack-2",
          station_name: "Rack 2",
          station_profile_loads_kg: [20, 30, 40],
          suggested_start_load_kg: 20,
        },
      ],
    },
  );

  const html = makeExerciseHtml(plan);

  assert.match(html, /<p class="plan-label">Leg Day at Forge Downtown<\/p>/);
  assert.match(html, /<p class="step-counter">Exercise 1 of 2<\/p>/);
  assert.match(html, /<h2 class="exercise-name">Deadlift<\/h2>/);
  assert.match(html, /<p class="exercise-variant-label">Conventional Barbell Deadlift<\/p>/);
  assert.doesNotMatch(html, /Workout in progress/);
});

test("renderExerciseScreen renders the current set number exactly once in the active controls", () => {
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
          suggested_start_load_kg: 10,
        },
      ],
    },
  );

  const html = makeExerciseHtml(plan);
  const setCounterMatches = html.match(/>Set 1</g) ?? [];

  assert.equal(setCounterMatches.length, 1);
  assert.doesNotMatch(html, /<span class="set-row-index">Set 1<\/span>/);
});

test("renderExerciseScreen keeps primary and secondary actions in redesign hierarchy", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 2 },
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
          suggested_start_load_kg: 10,
        },
        {
          ...stationlessOption(),
          id: "option-row",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Row",
          exercise_position: 2,
          variant_id: "variant-row",
          variant_name: "Barbell Row",
          station_id: "station-rack-2",
          station_name: "Rack 2",
          station_profile_loads_kg: [20, 30, 40],
          suggested_start_load_kg: 20,
        },
      ],
    },
  );

  const html = makeExerciseHtml(plan);

  assert.match(html, /<button[\s\S]*class="nav-button nav-button-primary action-button action-button-primary"[\s\S]*data-action="next-set"/s);
  assert.match(
    html,
    /<button[\s\S]*class="nav-button nav-button-secondary action-button action-button-secondary"[\s\S]*data-action="previous-exercise"[\s\S]*>\s*Previous\s*<\/button>/s,
  );
  assert.match(
    html,
    /<button[\s\S]*class="nav-button nav-button-secondary action-button action-button-secondary"[\s\S]*data-action="next-exercise"[\s\S]*>\s*Next\s*<\/button>/s,
  );
  assert.match(
    html,
    /<button[\s\S]*data-action="next-set"[\s\S]*<\/button>\s*<section[\s\S]*<\/section>\s*<\/section>\s*<div class="step-actions">/s,
  );
});

test("renderCompletionScreen keeps completion metrics shell and primary return action placement", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [stationlessOption()],
    },
  );

  const html = renderCompletionScreen(plan, {
    startedAt: "2026-03-28T09:00:00.000Z",
    completedAt: "2026-03-28T09:27:00.000Z",
  });

  assert.match(html, /class="completion-metrics" aria-label="Workout completion metrics"/);
  assert.match(html, /<dt class="completion-metric-key">Workout Duration<\/dt>[\s\S]*<dd class="completion-metric-value">27m<\/dd>/s);
  assert.doesNotMatch(html, /Workout complete/);
  assert.match(
    html,
    /<div class="step-actions">\s*<button type="button" class="nav-button nav-button-primary action-button action-button-primary" data-action="return-to-start">[\s\S]*Return to Start[\s\S]*<\/button>\s*<\/div>/s,
  );
});
