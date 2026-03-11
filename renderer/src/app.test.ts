import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreateWorkoutRequest,
  buildWorkoutPlan,
  canStartWorkout,
  createApp,
  createInitialStartScreenState,
  getNextViewState,
  isDigitsOnly,
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
});

const flushAsyncWork = async (): Promise<void> => {
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

test("createApp submits the completed workout before rendering success", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const submitPayloads = [];
  let resolveSubmission: ((value: {
    id: string;
    training_plan_id: string;
    training_plan_name: string;
    gym_id: string;
    gym_name: string;
    started_at: string | null;
    completed_at: string | null;
    exercise_count: number;
    completed_set_count: number;
  }) => void) | null = null;

  const fetchJson = async <T>(input: string): Promise<T> => {
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
            exercise_name: "Cable Chest Fly",
            exercise_position: 2,
            variant_id: "variant-2",
            variant_name: "Dual Cable Fly",
            variant_type: "cable",
            station_id: "station-2",
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
    async (payload) =>
      await new Promise((resolve) => {
        submitPayloads.push(payload);
        resolveSubmission = resolve;
      }),
    () => "2026-02-01T10:30:00Z",
  );

  await flushAsyncWork();
  assert.match((app as unknown as FakeAppElement).innerHTML, /Start Workout/);

  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 1 of 2/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("weight-input", "25"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("weight-input", "32"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next"));

  assert.equal(submitPayloads.length, 1);
  assert.deepEqual(submitPayloads[0], {
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
  assert.match((app as unknown as FakeAppElement).innerHTML, /Saving completed workout/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);

  resolveSubmission?.({
    id: "workout-1",
    training_plan_id: "plan-1",
    training_plan_name: "Push Day",
    gym_id: "gym-1",
    gym_name: "Forge Downtown",
    started_at: null,
    completed_at: "2026-02-01T10:30:00Z",
    exercise_count: 2,
    completed_set_count: 2,
  });
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp shows a save error instead of rendering success when submission fails", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

  const fetchJson = async <T>(input: string): Promise<T> => {
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
    async () => {
      throw new Error("save failed");
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
