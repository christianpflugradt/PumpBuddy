import assert from "node:assert/strict";
import test from "node:test";

import {
  applyActiveWorkoutResponse,
  buildActiveWorkoutProgressPayload,
  buildWorkoutPlan,
  buildWorkoutPlanFromActiveWorkout,
  canStartWorkout,
  createActiveWorkoutApi,
  createApp,
  createFetchJson,
  createInitialStartScreenState,
  getNextViewState,
  isDigitsOnly,
  isNotFoundRequestError,
  loadActiveWorkout,
  loadStartScreenData,
  type PlanExerciseOptionSummary,
  type TrainingPlanSummary,
  type WorkoutPlan,
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

const planOptions = (names: string[]): PlanExerciseOptionSummary[] =>
  names.map((name, index) => ({
    id: `option-${index + 1}`,
    training_plan_exercise_id: `tpe-${index + 1}`,
    exercise_name: name,
    exercise_position: index + 1,
    variant_id: `variant-${index + 1}`,
    variant_name: `${name} Variant`,
    variant_type: "machine",
    station_id: `station-${index + 1}`,
    station_name: `${name} Station`,
  }));

const basePlan = (): WorkoutPlan =>
  buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 3 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: planOptions(["Bench Press", "Incline Press", "Cable Fly"]),
    },
  );

test("loadStartScreenData loads seeded training plans and gyms", async () => {
  const requestedPaths: string[] = [];
  const fetchJson = async <T>(input: string): Promise<T> => {
    requestedPaths.push(input);

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Push Day", exercise_count: 3 }] as T;
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

test("loadActiveWorkout returns null on 404 and rethrows other failures", async () => {
  assert.equal(
    await loadActiveWorkout(async () => {
      throw new Error("Request failed with status 404");
    }),
    null,
  );

  await assert.rejects(
    async () =>
      await loadActiveWorkout(async () => {
        throw new Error("Request failed with status 500");
      }),
    /status 500/,
  );
});

test("createFetchJson returns parsed JSON and throws on failed responses", async () => {
  const fetchJson = createFetchJson(async (input) => {
    if (input === "/ok") {
      return {
        ok: true,
        json: async () => ({ plan: "Push Day" }),
      } as Response;
    }

    return {
      ok: false,
      status: 503,
      json: async () => ({ message: "nope" }),
    } as Response;
  });

  assert.deepEqual(await fetchJson<{ plan: string }>("/ok"), { plan: "Push Day" });
  await assert.rejects(async () => await fetchJson("/fail"), /status 503/);
});

test("start screen helpers enforce loading and selection rules", () => {
  const initialState = createInitialStartScreenState();
  assert.equal(canStartWorkout(initialState), false);
  assert.equal(isNotFoundRequestError(new Error("Request failed with status 404")), true);
  assert.equal(isNotFoundRequestError(new Error("Request failed with status 500")), false);
  assert.equal(isDigitsOnly("42"), true);
  assert.equal(isDigitsOnly("42kg"), false);
});

test("buildWorkoutPlan starts each exercise with fallback suggestions", () => {
  const selectedPlan: TrainingPlanSummary = {
    id: "plan-1",
    name: "Push Day",
    exercise_count: 3,
  };

  const plan = buildWorkoutPlan(selectedPlan, {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: planOptions(["Bench Press", "Incline Press", "Cable Fly"]),
  });

  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.name),
    ["Bench Press", "Incline Press", "Cable Fly"],
  );
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.activeSet),
    [
      { loadValue: 10, reps: 10 },
      { loadValue: 10, reps: 10 },
      { loadValue: 10, reps: 10 },
    ],
  );
});

test("buildActiveWorkoutProgressPayload includes completed sets for persisted exercises", () => {
  const plan = basePlan();
  plan.exercises[0]!.completedSets = [
    { setIndex: 1, loadValue: 25, reps: 10 },
    { setIndex: 2, loadValue: 27.5, reps: 8 },
  ];
  plan.exercises[1]!.completedSets = [{ setIndex: 1, loadValue: 32, reps: 12 }];

  assert.deepEqual(
    buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-02-01T09:00:00Z", 2),
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      started_at: "2026-02-01T09:00:00Z",
      current_exercise_position: 2,
      total_exercise_count: 3,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          selected_plan_exercise_option_id: "option-1",
          selected_variant_id: "variant-1",
          selected_station_id: "station-1",
          completed_sets: [
            { load_value: 25, reps: 10 },
            { load_value: 27.5, reps: 8 },
          ],
        },
        {
          training_plan_exercise_id: "tpe-2",
          position: 2,
          selected_plan_exercise_option_id: "option-2",
          selected_variant_id: "variant-2",
          selected_station_id: "station-2",
          completed_sets: [{ load_value: 32, reps: 12 }],
        },
      ],
    },
  );
});

test("active workout responses restore completed history and the next suggested set", () => {
  const plan = basePlan();
  const response = {
    workout: {
      id: "workout-1",
      training_plan_id: "plan-1",
      training_plan_name: "Push Day Reloaded",
      gym_id: "gym-1",
      gym_name: "Forge Downtown",
      started_at: "2026-02-01T09:00:00Z",
      updated_at: "2026-02-01T09:10:00Z",
      current_exercise_position: 2,
      total_exercise_count: 3,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          exercise_name: "Bench Press",
          selected_plan_exercise_option_id: "option-1b",
          selected_variant_id: "variant-1b",
          selected_variant_name: "Bench Variant",
          selected_station_id: "station-1b",
          selected_station_name: "Bench Station",
          completed_sets: [
            { set_index: 1, load_value: 25, reps: 10 },
            { set_index: 2, load_value: 27.5, reps: 8 },
          ],
          suggested_set: { load_value: 27.5, reps: 8 },
        },
        {
          training_plan_exercise_id: "tpe-2",
          position: 2,
          exercise_name: "Incline Press",
          selected_plan_exercise_option_id: "option-2",
          selected_variant_id: "variant-2",
          selected_variant_name: "Incline Variant",
          selected_station_id: "station-2",
          selected_station_name: "Incline Station",
          completed_sets: [],
          suggested_set: { load_value: 30, reps: 12 },
        },
      ],
    },
  };

  const nextPlan = applyActiveWorkoutResponse(plan, response);
  assert.equal(nextPlan.name, "Push Day Reloaded");
  assert.deepEqual(nextPlan.exercises[0]?.completedSets, [
    { setIndex: 1, loadValue: 25, reps: 10 },
    { setIndex: 2, loadValue: 27.5, reps: 8 },
  ]);
  assert.deepEqual(nextPlan.exercises[1]?.activeSet, { loadValue: 30, reps: 12 });

  const rebuiltPlan = buildWorkoutPlanFromActiveWorkout(response, {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: planOptions(["Bench Press", "Incline Press", "Cable Fly"]),
  });
  assert.equal(rebuiltPlan.exercises[0]?.completedSets.length, 2);
  assert.deepEqual(rebuiltPlan.exercises[2]?.activeSet, { loadValue: 10, reps: 10 });
});

test("getNextViewState starts the workout and advances to completion", () => {
  assert.deepEqual(getNextViewState({ screen: "start" }, "start-workout", 3), {
    screen: "exercise",
    exerciseIndex: 0,
  });
  assert.deepEqual(getNextViewState({ screen: "exercise", exerciseIndex: 1 }, "next", 3), {
    screen: "exercise",
    exerciseIndex: 2,
  });
  assert.deepEqual(getNextViewState({ screen: "exercise", exerciseIndex: 2 }, "next", 3), {
    screen: "completion",
  });
});

test("createActiveWorkoutApi posts JSON payloads and propagates request failures", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const api = createActiveWorkoutApi(async (input, init) => {
    requests.push({ input: String(input), init });

    return {
      ok: true,
      json: async () => ({
        workout: {
          id: "active-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00.000Z",
          updated_at: "2026-02-01T10:00:00.000Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [],
        },
      }),
    } as Response;
  });

  const payload = {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    started_at: "2026-02-01T10:00:00.000Z",
    current_exercise_position: 1,
    total_exercise_count: 1,
    exercises: [
      {
        training_plan_exercise_id: "tpe-1",
        position: 1,
        selected_plan_exercise_option_id: "option-1",
        selected_variant_id: "variant-1",
        selected_station_id: "station-1",
        completed_sets: [{ load_value: 20, reps: 10 }],
      },
    ],
  };

  await api.createActiveWorkout({
    ...payload,
    first_confirmed_exercise_position: 1,
  });
  await api.updateActiveWorkout("active-1", {
    ...payload,
    last_confirmed_exercise_position: 1,
  });
  await api.cancelActiveWorkout("active-1");
  await api.completeActiveWorkout("active-1", {
    ...payload,
    completed_at: "2026-02-01T10:05:00.000Z",
    last_confirmed_exercise_position: 1,
  });

  assert.equal(requests[0]?.input, "/api/active-workout");
  assert.equal(requests[1]?.input, "/api/active-workout/active-1");
  assert.equal(requests[2]?.input, "/api/active-workout/active-1");
  assert.equal(requests[3]?.input, "/api/active-workout/active-1/complete");

  const failingApi = createActiveWorkoutApi(async () => {
    return {
      ok: false,
      status: 500,
      json: async () => ({ message: "failed" }),
    } as Response;
  });

  await assert.rejects(async () => await failingApi.cancelActiveWorkout("fail-workout"), /status 500/);
});

test("createApp persists sets within the same exercise, advances exercises, and completes", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads = [];
  const updatePayloads = [];
  const completePayloads = [];

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
        options: planOptions(["Bench Press", "Incline Press"]),
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
            current_exercise_position: 1,
            total_exercise_count: 2,
            exercises: [
              {
                training_plan_exercise_id: "tpe-1",
                position: 1,
                exercise_name: "Bench Press",
                selected_plan_exercise_option_id: "option-1",
                selected_variant_id: "variant-1",
                selected_variant_name: "Bench Press Variant",
                selected_station_id: "station-1",
                selected_station_name: "Bench Press Station",
                completed_sets: [{ set_index: 1, load_value: 25, reps: 10 }],
                suggested_set: { load_value: 25, reps: 10 },
              },
              {
                training_plan_exercise_id: "tpe-2",
                position: 2,
                exercise_name: "Incline Press",
                selected_plan_exercise_option_id: "option-2",
                selected_variant_id: "variant-2",
                selected_variant_name: "Incline Press Variant",
                selected_station_id: "station-2",
                selected_station_name: "Incline Press Station",
                completed_sets: [],
                suggested_set: { load_value: 32, reps: 8 },
              },
            ],
          },
        };
      },
      updateActiveWorkout: async (_workoutId, payload) => {
        updatePayloads.push(payload);
        const currentExercisePosition = payload.current_exercise_position;

        if (currentExercisePosition === 2) {
          return {
            workout: {
              id: "workout-1",
              training_plan_id: "plan-1",
              training_plan_name: "Push Day",
              gym_id: "gym-1",
              gym_name: "Forge Downtown",
              started_at: "2026-02-01T10:00:00Z",
              updated_at: "2026-02-01T10:10:00Z",
              current_exercise_position: 2,
              total_exercise_count: 2,
              exercises: [
                {
                  training_plan_exercise_id: "tpe-1",
                  position: 1,
                  exercise_name: "Bench Press",
                  selected_plan_exercise_option_id: "option-1",
                  selected_variant_id: "variant-1",
                  selected_variant_name: "Bench Press Variant",
                  selected_station_id: "station-1",
                  selected_station_name: "Bench Press Station",
                  completed_sets: [
                    { set_index: 1, load_value: 25, reps: 10 },
                    { set_index: 2, load_value: 27.5, reps: 8 },
                  ],
                  suggested_set: { load_value: 32, reps: 8 },
                },
                {
                  training_plan_exercise_id: "tpe-2",
                  position: 2,
                  exercise_name: "Incline Press",
                  selected_plan_exercise_option_id: "option-2",
                  selected_variant_id: "variant-2",
                  selected_variant_name: "Incline Press Variant",
                  selected_station_id: "station-2",
                  selected_station_name: "Incline Press Station",
                  completed_sets: [],
                  suggested_set: { load_value: 32, reps: 8 },
                },
              ],
            },
          };
        }

        return {
          workout: {
            id: "workout-1",
            training_plan_id: "plan-1",
            training_plan_name: "Push Day",
            gym_id: "gym-1",
            gym_name: "Forge Downtown",
            started_at: "2026-02-01T10:00:00Z",
            updated_at: "2026-02-01T10:15:00Z",
            current_exercise_position: 2,
            total_exercise_count: 2,
            exercises: [
              {
                training_plan_exercise_id: "tpe-1",
                position: 1,
                exercise_name: "Bench Press",
                selected_plan_exercise_option_id: "option-1",
                selected_variant_id: "variant-1",
                selected_variant_name: "Bench Press Variant",
                selected_station_id: "station-1",
                selected_station_name: "Bench Press Station",
                completed_sets: [
                  { set_index: 1, load_value: 25, reps: 10 },
                  { set_index: 2, load_value: 27.5, reps: 8 },
                ],
                suggested_set: { load_value: 32, reps: 8 },
              },
              {
                training_plan_exercise_id: "tpe-2",
                position: 2,
                exercise_name: "Incline Press",
                selected_plan_exercise_option_id: "option-2",
                selected_variant_id: "variant-2",
                selected_variant_name: "Incline Press Variant",
                selected_station_id: "station-2",
                selected_station_name: "Incline Press Station",
                completed_sets: [{ set_index: 1, load_value: 32, reps: 8 }],
                suggested_set: { load_value: 32, reps: 8 },
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
          exercise_count: 2,
          completed_set_count: 3,
        };
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
    },
    () => "2026-02-01T10:30:00Z",
  );

  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Set 1/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="set-row set-row-editable"[\s\S]*<div class="set-row-fields">[\s\S]*Load[\s\S]*Reps/s,
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="10"/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "25"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "10"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next-set"));
  await flushAsyncWork();

  assert.equal(createPayloads.length, 1);
  assert.equal(createPayloads[0]?.current_exercise_position, 1);
  assert.deepEqual(createPayloads[0]?.exercises[0]?.completed_sets, [{ load_value: 25, reps: 10 }]);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Set 2/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="set-row set-row-readonly"[\s\S]*<div class="set-row-fields">[\s\S]*25 kg[\s\S]*>10<\/span>/s,
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /25 kg/);
  assert.match((app as unknown as FakeAppElement).innerHTML, />10<\/span>/);
  const readOnlyRow = (app as unknown as FakeAppElement).innerHTML.match(
    /<li[\s\S]*?class="set-row set-row-readonly"[\s\S]*?<\/li>/,
  )?.[0];
  assert.ok(readOnlyRow);
  assert.doesNotMatch(readOnlyRow, /weight-button/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "27.5"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "27"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "8"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next-exercise"));
  await flushAsyncWork();

  assert.equal(updatePayloads.length, 1);
  assert.equal(updatePayloads[0]?.current_exercise_position, 2);
  assert.equal(updatePayloads[0]?.last_confirmed_exercise_position, 1);
  assert.equal(updatePayloads[0]?.exercises[0]?.completed_sets.length, 2);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="32"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="8"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /25 kg.*Exercise 1/s);

  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next-exercise"));
  await flushAsyncWork();

  assert.equal(completePayloads.length, 1);
  assert.equal(completePayloads[0]?.last_confirmed_exercise_position, 2);
  assert.equal(completePayloads[0]?.exercises.length, 2);
  assert.equal(completePayloads[0]?.exercises[1]?.completed_sets[0]?.load_value, 32);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp resumes a persisted workout with read-only history and a suggested next set", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

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
          total_exercise_count: 3,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "variant-1",
              selected_variant_name: "Bench Press Variant",
              selected_station_id: "station-1",
              selected_station_name: "Bench Press Station",
              completed_sets: [
                { set_index: 1, load_value: 25, reps: 10 },
                { set_index: 2, load_value: 27.5, reps: 8 },
              ],
              suggested_set: { load_value: 27.5, reps: 8 },
            },
            {
              training_plan_exercise_id: "tpe-2",
              position: 2,
              exercise_name: "Incline Press",
              selected_plan_exercise_option_id: "option-2",
              selected_variant_id: "variant-2",
              selected_variant_name: "Incline Press Variant",
              selected_station_id: "station-2",
              selected_station_name: "Incline Press Station",
              completed_sets: [],
              suggested_set: { load_value: 32, reps: 12 },
            },
          ],
        },
      } as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: planOptions(["Bench Press", "Incline Press", "Cable Fly"]),
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 3/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Incline Press/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="32"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="12"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Start Workout/);
});

test("createApp only shows cancellation after persistence and resets to the start screen after confirmation", async () => {
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
      return [{ id: "plan-1", name: "Push Day", exercise_count: 1 }] as T;
    }

    if (input === "/api/gyms") {
      return [{ id: "gym-1", name: "Forge Downtown" }] as T;
    }

    if (input === "/api/training-plans/plan-1/options?gymId=gym-1") {
      return {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: planOptions(["Bench Press"]),
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
              selected_variant_name: "Bench Variant",
              selected_station_id: "station-1",
              selected_station_name: "Bench Station",
              completed_sets: [{ set_index: 1, load_value: 25, reps: 10 }],
              suggested_set: { load_value: 25, reps: 10 },
            },
          ],
        },
      }),
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async (workoutId) => {
        cancelCalls.push(workoutId);
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
    () => "2026-02-01T10:00:00Z",
  );

  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Cancel Workout/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "25"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next-set"));
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
        options: planOptions(["Bench Press"]),
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
              selected_variant_name: "Bench Variant",
              selected_station_id: "station-1",
              selected_station_name: "Bench Station",
              completed_sets: [{ set_index: 1, load_value: 25, reps: 10 }],
              suggested_set: { load_value: 25, reps: 10 },
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
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
    },
    () => "2026-02-01T10:30:00Z",
  );

  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("start-workout"));
  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "25"));
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("next-exercise"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Unable to save this workout/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});
