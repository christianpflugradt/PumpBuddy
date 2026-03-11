import assert from "node:assert/strict";
import test from "node:test";

import {
  applyActiveWorkoutResponse,
  buildActiveWorkoutProgressPayload,
  buildWorkoutPlanFromActiveWorkout,
  buildCreateWorkoutRequest,
  buildWorkoutPlan,
  canStartWorkout,
  createApp,
  createInitialStartScreenState,
  getNextViewState,
  isDigitsOnly,
  isNotFoundRequestError,
  loadActiveWorkout,
  loadStartScreenData,
  type PlanExerciseOptionSummary,
  type TrainingPlanSummary,
} from "./app.ts";

class FakeHTMLElement {
  dataset: Record<string, string>;

  constructor(action?: string) {
    this.dataset = action ? { action } : {};
  }
}

class FakeHTMLSelectElement extends FakeHTMLElement {
  value: string;

  constructor(action: string, value: string) {
    super(action);
    this.value = value;
  }
}

class FakeHTMLInputElement extends FakeHTMLElement {
  value: string;

  constructor(action: string, value: string) {
    super(action);
    this.value = value;
  }
}

class FakeAppElement {
  innerHTML = "";
  private listeners = new Map<string, Array<(event: { target: unknown }) => void>>();

  addEventListener(type: string, listener: (event: { target: unknown }) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  emit(type: string, target: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target });
    }
  }
}

Object.assign(globalThis, {
  HTMLElement: FakeHTMLElement,
  HTMLSelectElement: FakeHTMLSelectElement,
  HTMLInputElement: FakeHTMLInputElement,
  window: {
    confirm: () => true,
  },
});

const flushAsyncWork = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

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

test("loadActiveWorkout returns null when no active workout exists", async () => {
  const fetchJson = async <T>(_input: string): Promise<T> => {
    throw new Error("Request failed with status 404");
  };

  const result = await loadActiveWorkout(fetchJson);

  assert.equal(result, null);
});

test("isNotFoundRequestError matches request failures with status 404", () => {
  assert.equal(isNotFoundRequestError(new Error("Request failed with status 404")), true);
  assert.equal(isNotFoundRequestError(new Error("Request failed with status 500")), false);
  assert.equal(isNotFoundRequestError("Request failed with status 404"), false);
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

test("buildCreateWorkoutRequest maps the selected plan, gym, and edited weights", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 2 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "option-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Bench Press",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Machine Press",
          variant_type: "machine",
          station_id: "station-1",
          station_name: "Chest Press",
        },
        {
          id: "option-2",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Cable Chest Fly",
          exercise_position: 2,
          variant_id: "variant-2",
          variant_name: "Dual Cable Fly",
          variant_type: "cable",
          station_id: "station-2",
          station_name: "Cable Tower",
        },
      ],
    },
  );

  plan.exercises[0]!.weight = 25;
  plan.exercises[1]!.weight = 32;

  assert.deepEqual(buildCreateWorkoutRequest(plan, "gym-1", "2026-02-01T10:30:00Z"), {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    completed_at: "2026-02-01T10:30:00Z",
    exercises: [
      {
        training_plan_exercise_id: "tpe-1",
        position: 1,
        selected_plan_exercise_option_id: "option-1",
        selected_variant_id: "variant-1",
        selected_station_id: "station-1",
        set: {
          load_value: 25,
          reps: 10,
        },
      },
      {
        training_plan_exercise_id: "tpe-2",
        position: 2,
        selected_plan_exercise_option_id: "option-2",
        selected_variant_id: "variant-2",
        selected_station_id: "station-2",
        set: {
          load_value: 32,
          reps: 10,
        },
      },
    ],
  });
});

test("buildActiveWorkoutProgressPayload includes only confirmed exercises", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 3 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "option-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Bench Press",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Machine Press",
          variant_type: "machine",
          station_id: "station-1",
          station_name: "Chest Press",
        },
        {
          id: "option-2",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Incline Press",
          exercise_position: 2,
          variant_id: "variant-2",
          variant_name: "Incline Machine",
          variant_type: "machine",
          station_id: "station-2",
          station_name: "Incline Press",
        },
        {
          id: "option-3",
          training_plan_exercise_id: "tpe-3",
          exercise_name: "Cable Fly",
          exercise_position: 3,
          variant_id: "variant-3",
          variant_name: "Cable Fly",
          variant_type: "cable",
          station_id: "station-3",
          station_name: "Cable Tower",
        },
      ],
    },
  );

  plan.exercises[0]!.weight = 25;
  plan.exercises[1]!.weight = 30;

  assert.deepEqual(
    buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-02-01T09:00:00Z", 2, 3),
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      started_at: "2026-02-01T09:00:00Z",
      current_exercise_position: 3,
      total_exercise_count: 3,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          selected_plan_exercise_option_id: "option-1",
          selected_variant_id: "variant-1",
          selected_station_id: "station-1",
          set: {
            load_value: 25,
            reps: 10,
          },
        },
        {
          training_plan_exercise_id: "tpe-2",
          position: 2,
          selected_plan_exercise_option_id: "option-2",
          selected_variant_id: "variant-2",
          selected_station_id: "station-2",
          set: {
            load_value: 30,
            reps: 10,
          },
        },
      ],
    },
  );
});

test("applyActiveWorkoutResponse merges persisted workout progress into the local plan", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 2 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "option-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Bench Press",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Machine Press",
          variant_type: "machine",
          station_id: "station-1",
          station_name: "Chest Press",
        },
        {
          id: "option-2",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Cable Fly",
          exercise_position: 2,
          variant_id: "variant-2",
          variant_name: "Cable Fly",
          variant_type: "cable",
          station_id: "station-2",
          station_name: "Cable Tower",
        },
      ],
    },
  );

  const nextPlan = applyActiveWorkoutResponse(plan, {
    workout: {
      id: "workout-1",
      training_plan_id: "plan-1",
      training_plan_name: "Push Day Reloaded",
      gym_id: "gym-1",
      gym_name: "Forge Downtown",
      started_at: "2026-02-01T09:00:00Z",
      updated_at: "2026-02-01T09:05:00Z",
      current_exercise_position: 2,
      total_exercise_count: 2,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          exercise_name: "Bench Press",
          selected_plan_exercise_option_id: "option-1b",
          selected_variant_id: "variant-1b",
          selected_variant_name: "Barbell Bench",
          selected_station_id: "station-1b",
          selected_station_name: "Bench Rack",
          set: {
            load_value: 27.5,
            reps: 10,
          },
        },
      ],
    },
  });

  assert.equal(nextPlan.name, "Push Day Reloaded");
  assert.equal(nextPlan.exercises[0]?.weight, 27.5);
  assert.equal(nextPlan.exercises[0]?.selectedPlanExerciseOptionId, "option-1b");
  assert.equal(nextPlan.exercises[1]?.name, "Cable Fly");
});

test("buildWorkoutPlanFromActiveWorkout rebuilds the full plan and restores persisted values", () => {
  const plan = buildWorkoutPlanFromActiveWorkout(
    {
      workout: {
        id: "workout-1",
        training_plan_id: "plan-1",
        training_plan_name: "Push Day",
        gym_id: "gym-1",
        gym_name: "Forge Downtown",
        started_at: "2026-02-01T09:00:00Z",
        updated_at: "2026-02-01T09:05:00Z",
        current_exercise_position: 2,
        total_exercise_count: 3,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Bench Press",
            selected_plan_exercise_option_id: "option-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Machine Press",
            selected_station_id: "station-1",
            selected_station_name: "Chest Press",
            set: {
              load_value: 25,
              reps: 10,
            },
          },
        ],
      },
    },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "option-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Bench Press",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Machine Press",
          variant_type: "machine",
          station_id: "station-1",
          station_name: "Chest Press",
        },
        {
          id: "option-2",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Incline Press",
          exercise_position: 2,
          variant_id: "variant-2",
          variant_name: "Incline Machine",
          variant_type: "machine",
          station_id: "station-2",
          station_name: "Incline Press",
        },
        {
          id: "option-3",
          training_plan_exercise_id: "tpe-3",
          exercise_name: "Cable Fly",
          exercise_position: 3,
          variant_id: "variant-3",
          variant_name: "Cable Fly",
          variant_type: "cable",
          station_id: "station-3",
          station_name: "Cable Tower",
        },
      ],
    },
  );

  assert.equal(plan.exercises.length, 3);
  assert.equal(plan.exercises[0]?.weight, 25);
  assert.equal(plan.exercises[1]?.name, "Incline Press");
  assert.equal(plan.exercises[2]?.name, "Cable Fly");
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

test("createApp creates on first confirmation, updates later, and completes at the end", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads = [];
  const updatePayloads = [];
  const completePayloads = [];

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Push Day", exercise_count: 3 }] as T;
    }

    if (input === "/api/gyms") {
      return [{ id: "gym-1", name: "Forge Downtown" }] as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "option-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Machine Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Chest Press",
          },
          {
            id: "option-2",
            training_plan_exercise_id: "tpe-2",
            exercise_name: "Incline Press",
            exercise_position: 2,
            variant_id: "variant-2",
            variant_name: "Incline Machine",
            variant_type: "machine",
            station_id: "station-2",
            station_name: "Incline Press",
          },
          {
            id: "option-3",
            training_plan_exercise_id: "tpe-3",
            exercise_name: "Cable Chest Fly",
            exercise_position: 3,
            variant_id: "variant-3",
            variant_name: "Dual Cable Fly",
            variant_type: "cable",
            station_id: "station-3",
            station_name: "Cable Tower",
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(
    app,
    fetchJson,
    {
      createActiveWorkout: async (payload) => {
        createPayloads.push(payload);
        return {
          workout: {
            id: "workout-1",
            training_plan_id: "plan-1",
            training_plan_name: "Push Day",
            gym_id: "gym-1",
            gym_name: "Forge Downtown",
            started_at: "2026-02-01T10:00:00Z",
            updated_at: "2026-02-01T10:05:00Z",
            current_exercise_position: 2,
            total_exercise_count: 3,
            exercises: [
              {
                training_plan_exercise_id: "tpe-1",
                position: 1,
                exercise_name: "Bench Press",
                selected_plan_exercise_option_id: "option-1",
                selected_variant_id: "variant-1",
                selected_variant_name: "Machine Press",
                selected_station_id: "station-1",
                selected_station_name: "Chest Press",
                set: {
                  load_value: 25,
                  reps: 10,
                },
              },
            ],
          },
        };
      },
      updateActiveWorkout: async (_workoutId, payload) => {
        updatePayloads.push(payload);
        return {
          workout: {
            id: "workout-1",
            training_plan_id: "plan-1",
            training_plan_name: "Push Day",
            gym_id: "gym-1",
            gym_name: "Forge Downtown",
            started_at: "2026-02-01T10:00:00Z",
            updated_at: "2026-02-01T10:10:00Z",
            current_exercise_position: 3,
            total_exercise_count: 3,
            exercises: [
              {
                training_plan_exercise_id: "tpe-1",
                position: 1,
                exercise_name: "Bench Press",
                selected_plan_exercise_option_id: "option-1",
                selected_variant_id: "variant-1",
                selected_variant_name: "Machine Press",
                selected_station_id: "station-1",
                selected_station_name: "Chest Press",
                set: {
                  load_value: 25,
                  reps: 10,
                },
              },
              {
                training_plan_exercise_id: "tpe-2",
                position: 2,
                exercise_name: "Incline Press",
                selected_plan_exercise_option_id: "option-2",
                selected_variant_id: "variant-2",
                selected_variant_name: "Incline Machine",
                selected_station_id: "station-2",
                selected_station_name: "Incline Press",
                set: {
                  load_value: 32,
                  reps: 10,
                },
              },
            ],
          },
        };
      },
      completeActiveWorkout: async (_workoutId, payload) => {
        completePayloads.push(payload);
        return {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00Z",
          completed_at: "2026-02-01T10:30:00Z",
          exercise_count: 3,
          completed_set_count: 3,
        };
      },
    },
    () => "2026-02-01T10:30:00Z",
  );

  await flushAsyncWork();
  assert.match((app as unknown as FakeAppElement).innerHTML, /Start Workout/);

  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 1 of 3/);
  assert.equal(createPayloads.length, 0);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("weight-input", "25"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));
  await flushAsyncWork();

  assert.equal(createPayloads.length, 1);
  assert.equal(updatePayloads.length, 0);
  assert.equal(completePayloads.length, 0);
  assert.equal(createPayloads[0]?.first_confirmed_exercise_position, 1);
  assert.equal(createPayloads[0]?.current_exercise_position, 2);
  assert.equal(createPayloads[0]?.exercises.length, 1);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 3/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("weight-input", "32"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));
  await flushAsyncWork();

  assert.equal(updatePayloads.length, 1);
  assert.equal(updatePayloads[0]?.last_confirmed_exercise_position, 2);
  assert.equal(updatePayloads[0]?.current_exercise_position, 3);
  assert.equal(updatePayloads[0]?.exercises.length, 2);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 3 of 3/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("weight-input", "40"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));
  await flushAsyncWork();

  assert.equal(completePayloads.length, 1);
  assert.equal(completePayloads[0]?.last_confirmed_exercise_position, 3);
  assert.equal(completePayloads[0]?.exercises.length, 3);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp only shows cancellation for persisted workouts and resets to the start screen after confirmation", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const cancelCalls: string[] = [];
  const confirmMessages: string[] = [];

  globalThis.window.confirm = (message?: string) => {
    confirmMessages.push(message ?? "");
    return true;
  };

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Push Day", exercise_count: 2 }] as T;
    }

    if (input === "/api/gyms") {
      return [{ id: "gym-1", name: "Forge Downtown" }] as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "option-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Machine Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Chest Press",
          },
          {
            id: "option-2",
            training_plan_exercise_id: "tpe-2",
            exercise_name: "Incline Press",
            exercise_position: 2,
            variant_id: "variant-2",
            variant_name: "Incline Machine",
            variant_type: "machine",
            station_id: "station-2",
            station_name: "Incline Press",
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(
    app,
    fetchJson,
    {
      createActiveWorkout: async () => ({
        workout: {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00Z",
          updated_at: "2026-02-01T10:05:00Z",
          current_exercise_position: 2,
          total_exercise_count: 2,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "variant-1",
              selected_variant_name: "Machine Press",
              selected_station_id: "station-1",
              selected_station_name: "Chest Press",
              set: {
                load_value: 25,
                reps: 10,
              },
            },
          ],
        },
      }),
      updateActiveWorkout: async () => {
        throw new Error("update should not be called");
      },
      cancelActiveWorkout: async (workoutId) => {
        cancelCalls.push(workoutId);
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not be called");
      },
    },
    () => "2026-02-01T10:00:00Z",
  );

  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Cancel Workout/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("weight-input", "25"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Cancel Workout/);

  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("cancel-workout"));
  await flushAsyncWork();

  assert.deepEqual(cancelCalls, ["workout-1"]);
  assert.deepEqual(confirmMessages, [
    "Cancel this workout? Your unfinished workout data will be deleted.",
  ]);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Start Workout/);
});

test("createApp does not cancel when the user rejects the confirmation", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const cancelCalls: string[] = [];

  globalThis.window.confirm = () => false;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      return {
        workout: {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00Z",
          updated_at: "2026-02-01T10:05:00Z",
          current_exercise_position: 2,
          total_exercise_count: 2,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "variant-1",
              selected_variant_name: "Machine Press",
              selected_station_id: "station-1",
              selected_station_name: "Chest Press",
              set: {
                load_value: 25,
                reps: 10,
              },
            },
          ],
        },
      } as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "option-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Machine Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Chest Press",
          },
          {
            id: "option-2",
            training_plan_exercise_id: "tpe-2",
            exercise_name: "Incline Press",
            exercise_position: 2,
            variant_id: "variant-2",
            variant_name: "Incline Machine",
            variant_type: "machine",
            station_id: "station-2",
            station_name: "Incline Press",
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(
    app,
    fetchJson,
    {
      createActiveWorkout: async () => {
        throw new Error("create should not be called");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not be called");
      },
      cancelActiveWorkout: async (workoutId) => {
        cancelCalls.push(workoutId);
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not be called");
      },
    },
    () => "2026-02-01T10:00:00Z",
  );

  await flushAsyncWork();
  assert.match((app as unknown as FakeAppElement).innerHTML, /Cancel Workout/);

  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("cancel-workout"));
  await flushAsyncWork();

  assert.deepEqual(cancelCalls, []);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);
});

test("createApp shows a save error instead of rendering success when submission fails", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Push Day", exercise_count: 1 }] as T;
    }

    if (input === "/api/gyms") {
      return [{ id: "gym-1", name: "Forge Downtown" }] as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "option-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Machine Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Chest Press",
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(
    app,
    fetchJson,
    {
      createActiveWorkout: async () => ({
        workout: {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00Z",
          updated_at: "2026-02-01T10:05:00Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "variant-1",
              selected_variant_name: "Machine Press",
              selected_station_id: "station-1",
              selected_station_name: "Chest Press",
              set: {
                load_value: 0,
                reps: 10,
              },
            },
          ],
        },
      }),
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("save failed");
      },
    },
    () => "2026-02-01T10:30:00Z",
  );

  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Unable to save this workout/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp keeps the normal start screen when no persisted workout exists", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const requestedPaths: string[] = [];

  const fetchJson = async <T>(input: string): Promise<T> => {
    requestedPaths.push(input);

    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Push Day", exercise_count: 3 }] as T;
    }

    if (input === "/api/gyms") {
      return [{ id: "gym-1", name: "Forge Downtown" }] as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.deepEqual(requestedPaths, ["/api/active-workout", "/api/training-plans", "/api/gyms"]);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Workout start screen/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Start Workout/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /resume/i);
});

test("createApp resumes a persisted workout on startup", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const requestedPaths: string[] = [];

  const fetchJson = async <T>(input: string): Promise<T> => {
    requestedPaths.push(input);

    if (input === "/api/active-workout") {
      return {
        workout: {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00Z",
          updated_at: "2026-02-01T10:05:00Z",
          current_exercise_position: 2,
          total_exercise_count: 3,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "variant-1",
              selected_variant_name: "Machine Press",
              selected_station_id: "station-1",
              selected_station_name: "Chest Press",
              set: {
                load_value: 25,
                reps: 10,
              },
            },
          ],
        },
      } as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "option-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Machine Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Chest Press",
          },
          {
            id: "option-2",
            training_plan_exercise_id: "tpe-2",
            exercise_name: "Incline Press",
            exercise_position: 2,
            variant_id: "variant-2",
            variant_name: "Incline Machine",
            variant_type: "machine",
            station_id: "station-2",
            station_name: "Incline Press",
          },
          {
            id: "option-3",
            training_plan_exercise_id: "tpe-3",
            exercise_name: "Cable Fly",
            exercise_position: 3,
            variant_id: "variant-3",
            variant_name: "Cable Fly",
            variant_type: "cable",
            station_id: "station-3",
            station_name: "Cable Tower",
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.deepEqual(requestedPaths, [
    "/api/active-workout",
    "/api/training-plans/plan-1/options?gymId=gym-1",
  ]);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 3/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Incline Press/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Workout start screen/);
});
