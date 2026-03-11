import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkoutPlan,
  canStartWorkout,
  createInitialStartScreenState,
  getNextViewState,
  isDigitsOnly,
  loadStartScreenData,
  type PlanExerciseOptionSummary,
  type TrainingPlanSummary,
} from "./app.ts";

test("loadStartScreenData loads seeded training plans and gyms", async () => {
  const requestedPaths: string[] = [];
  const fetchJson = async <T>(input: string): Promise<T> => {
    requestedPaths.push(input);

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Push Day", exercise_count: 5 }] as T;
    }

    if (input === "/api/gyms") {
      return [{ id: "gym-1", name: "Forge Downtown" }] as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  const result = await loadStartScreenData(fetchJson);

  assert.deepEqual(requestedPaths, ["/api/training-plans", "/api/gyms"]);
  assert.equal(result.trainingPlans[0]?.name, "Push Day");
  assert.equal(result.gyms[0]?.name, "Forge Downtown");
});

test("canStartWorkout requires finished loading and both selections", () => {
  const initialState = createInitialStartScreenState();
  assert.equal(canStartWorkout(initialState), false);

  const readyState = {
    ...initialState,
    isLoading: false,
    trainingPlans: [{ id: "plan-1", name: "Push Day", exercise_count: 5 }],
    gyms: [{ id: "gym-1", name: "Forge Downtown" }],
    selectedTrainingPlanId: "plan-1",
    selectedGymId: "gym-1",
  };
  assert.equal(canStartWorkout(readyState), true);
});

test("buildWorkoutPlan derives one ordered exercise step per training-plan exercise", () => {
  const selectedPlan: TrainingPlanSummary = {
    id: "plan-1",
    name: "Push Day",
    exercise_count: 3,
  };
  const options: PlanExerciseOptionSummary[] = [
    {
      id: "option-3a",
      training_plan_exercise_id: "exercise-3",
      exercise_name: "Cable Chest Fly",
      exercise_position: 3,
      variant_id: "variant-3a",
      variant_name: "Dual Cable Fly",
      variant_type: "cable",
      station_id: "station-3a",
      station_name: "Cable Tower",
    },
    {
      id: "option-1a",
      training_plan_exercise_id: "exercise-1",
      exercise_name: "Bench Press",
      exercise_position: 1,
      variant_id: "variant-1a",
      variant_name: "Machine Press",
      variant_type: "machine",
      station_id: "station-1a",
      station_name: "Chest Press Machine",
    },
    {
      id: "option-3b",
      training_plan_exercise_id: "exercise-3",
      exercise_name: "Cable Chest Fly",
      exercise_position: 3,
      variant_id: "variant-3b",
      variant_name: "Pec Deck Fly",
      variant_type: "machine",
      station_id: "station-3b",
      station_name: "Pec Deck",
    },
    {
      id: "option-2a",
      training_plan_exercise_id: "exercise-2",
      exercise_name: "Incline Dumbbell Press",
      exercise_position: 2,
      variant_id: "variant-2a",
      variant_name: "Incline Dumbbell Press",
      variant_type: "dumbbell",
      station_id: "station-2a",
      station_name: "Dumbbell Rack",
    },
  ];

  const plan = buildWorkoutPlan(selectedPlan, {
    training_plan_id: selectedPlan.id,
    gym_id: "gym-1",
    options,
  });

  assert.equal(plan.name, "Push Day");
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.name),
    ["Bench Press", "Incline Dumbbell Press", "Cable Chest Fly"],
  );
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.weight),
    [0, 0, 0],
  );
});

test("getNextViewState starts the workout at the first exercise", () => {
  assert.deepEqual(
    getNextViewState({ screen: "start" }, "start-workout", 5),
    { screen: "exercise", exerciseIndex: 0 },
  );
});

test("getNextViewState advances through exercises and finishes on the last step", () => {
  assert.deepEqual(
    getNextViewState({ screen: "exercise", exerciseIndex: 1 }, "next", 5),
    { screen: "exercise", exerciseIndex: 2 },
  );

  assert.deepEqual(
    getNextViewState({ screen: "exercise", exerciseIndex: 4 }, "next", 5),
    { screen: "completion" },
  );
});

test("isDigitsOnly accepts digits and rejects mixed input", () => {
  assert.equal(isDigitsOnly("42"), true);
  assert.equal(isDigitsOnly("42kg"), false);
});
