import assert from "node:assert/strict";
import { test } from "vitest";

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
  hasCompletedSets,
  isDraftModified,
  isDigitsOnly,
  isNotFoundRequestError,
  loadActiveWorkout,
  loadStartScreenData,
  shouldConfirmForwardNavigation,
  type PlanExerciseOptionSummary,
  type TrainingPlanSummary,
  type WorkoutPlan,
} from "./app.ts";

// auth-gate tests are in their own file (vitest will discover them)

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
  window: { setTimeout },
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
    station_profile_loads_kg: [10, 15, 22, 25, 30],
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

const clickAction = async (app: FakeAppElement, action: string): Promise<void> => {
  app.emit("click", new FakeHTMLElement(action));
  await flushAsyncWork();
};

const expectDialogMessage = (
  app: FakeAppElement,
  message: string,
  confirmActionLabel: string,
): void => {
  assert.match(app.innerHTML, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(app.innerHTML, /class="confirm-dialog-layer"/);
  assert.match(app.innerHTML, /class="confirm-dialog-backdrop"/);
  assert.match(app.innerHTML, /data-action="confirm-dialog-confirm"/);
  assert.match(app.innerHTML, /data-action="confirm-dialog-dismiss"/);
  assert.match(app.innerHTML, new RegExp(confirmActionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
};

const expectCompletionMetricRow = (
  app: FakeAppElement,
  label: string,
  valuePattern: string | RegExp,
): void => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const valueRegex =
    valuePattern instanceof RegExp
      ? valuePattern.source
      : valuePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    app.innerHTML,
    new RegExp(
      `<div class="completion-metric-row">[\\s\\S]*?<dt class="completion-metric-key">${escapedLabel}<\\/dt>[\\s\\S]*?<dd class="completion-metric-value">${valueRegex}<\\/dd>[\\s\\S]*?<\\/div>`,
    ),
  );
};

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
  await assert.rejects(async () => await fetchJson("/fail"), /nope/);
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
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.suggestedSet),
    [
      { loadValue: 10, reps: 10 },
      { loadValue: 10, reps: 10 },
      { loadValue: 10, reps: 10 },
    ],
  );
  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.isReadOnly),
    [false, false, false],
  );
});

test("buildWorkoutPlan derives configured-gym suggestions from station profile rules", () => {
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
          variant_name: "Bench Press",
          variant_type: "machine",
          station_id: "station-1",
          station_name: "Rack A",
          station_profile_loads_kg: [5, 12.5, 20, 27.5, 40],
        },
        {
          id: "option-2",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Cable Row",
          exercise_position: 2,
          variant_id: "variant-2",
          variant_name: "Cable Row",
          variant_type: "machine",
          station_id: "station-2",
          station_name: "Cable Station",
          station_profile_loads_kg: [7.5, 12.5, 17.5, 22.5, 27.5],
        },
      ],
    },
  );

  assert.deepEqual(
    plan.exercises.map((exercise) => exercise.suggestedSet.loadValue),
    [12.5, 22.5],
  );
});

test("buildWorkoutPlan only keeps realizable options with variant and station identifiers", () => {
  const selectedPlan: TrainingPlanSummary = {
    id: "plan-1",
    name: "Push Day",
    exercise_count: 1,
  };

  const options = planOptions(["Bench Press"]);
  options.push({
    ...options[0]!,
    id: "option-invalid",
    variant_id: "",
    station_id: "",
    variant_name: "Invalid Option",
    station_name: "Invalid Station",
  });

  const plan = buildWorkoutPlan(selectedPlan, {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options,
  });

  assert.equal(plan.exercises.length, 1);
  assert.equal(plan.exercises[0]?.fallbackOptions.length, 1);
  assert.equal(plan.exercises[0]?.selectedPlanExerciseOptionId, "option-1");
});

test("buildWorkoutPlan blocks configured-gym start when an exercise has no realizable options", () => {
  const selectedPlan: TrainingPlanSummary = {
    id: "plan-1",
    name: "Push Day",
    exercise_count: 2,
  };

  assert.throws(
    () =>
      buildWorkoutPlan(selectedPlan, {
        training_plan_id: "plan-1",
        gym_id: "gym-1",
        options: [
          {
            id: "option-1",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Bench Press Variant",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Bench Press Station",
            station_profile_loads_kg: [10, 15, 22.5, 30],
          },
        ],
      }),
    /blocked/,
  );
});

test("forward navigation confirmation depends on completed work and draft changes", () => {
  const plan = basePlan();
  const firstExercise = plan.exercises[0]!;

  assert.equal(hasCompletedSets(firstExercise), false);
  assert.equal(isDraftModified(firstExercise), false);
  assert.equal(shouldConfirmForwardNavigation(firstExercise), true);

  firstExercise.completedSets.push({ setIndex: 1, loadValue: 10, reps: 10 });
  assert.equal(hasCompletedSets(firstExercise), true);
  assert.equal(shouldConfirmForwardNavigation(firstExercise), false);

  firstExercise.activeSet.loadValue = 12;
  assert.equal(isDraftModified(firstExercise), true);
  assert.equal(shouldConfirmForwardNavigation(firstExercise), true);
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

test("buildActiveWorkoutProgressPayload preserves original exercise positions", () => {
  const plan = basePlan();
  plan.exercises[1]!.completedSets = [{ setIndex: 1, loadValue: 32, reps: 12 }];

  assert.deepEqual(
    buildActiveWorkoutProgressPayload(plan, "gym-1", "2026-02-01T09:00:00Z", 2).exercises,
    [
      {
        training_plan_exercise_id: "tpe-2",
        position: 2,
        selected_plan_exercise_option_id: "option-2",
        selected_variant_id: "variant-2",
        selected_station_id: "station-2",
        completed_sets: [{ load_value: 32, reps: 12 }],
      },
    ],
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
  assert.deepEqual(nextPlan.exercises[1]?.suggestedSet, { loadValue: 30, reps: 12 });
  assert.deepEqual(nextPlan.exercises[1]?.activeSet, { loadValue: 30, reps: 12 });
  assert.equal(nextPlan.exercises[0]?.isReadOnly, false);

  const rebuiltPlan = buildWorkoutPlanFromActiveWorkout(response, {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: planOptions(["Bench Press", "Incline Press", "Cable Fly"]),
  });
  assert.equal(rebuiltPlan.exercises[0]?.completedSets.length, 2);
  assert.deepEqual(rebuiltPlan.exercises[2]?.activeSet, { loadValue: 10, reps: 10 });
});

test("applyActiveWorkoutResponse preserves configured-gym option IDs when persisted data omits them", () => {
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
          variant_name: "Bench Variant",
          variant_type: "machine",
          station_id: "station-1",
          station_name: "Bench Station",
          station_profile_loads_kg: [10, 15, 22.5, 30],
        },
        {
          id: "option-2",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Incline Press",
          exercise_position: 2,
          variant_id: "variant-2",
          variant_name: "Incline Variant",
          variant_type: "machine",
          station_id: "station-2",
          station_name: "Incline Station",
          station_profile_loads_kg: [10, 17.5, 22.5, 30],
        },
        {
          id: "option-2b",
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Incline Press",
          exercise_position: 2,
          variant_id: "variant-2b",
          variant_name: "Incline Variant Alt",
          variant_type: "machine",
          station_id: "station-2b",
          station_name: "Incline Station Alt",
          station_profile_loads_kg: [10, 20, 25, 30],
        },
      ],
    },
  );
  plan.exercises[1]!.isFallbackOptionConfirmed = true;

  const nextPlan = applyActiveWorkoutResponse(plan, {
    workout: {
      id: "active-1",
      training_plan_id: "plan-1",
      training_plan_name: "Push Day",
      gym_id: "gym-1",
      gym_name: "Forge Downtown",
      started_at: "2026-02-01T09:00:00Z",
      updated_at: "2026-02-01T09:10:00Z",
      current_exercise_position: 2,
      total_exercise_count: 2,
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
        {
          training_plan_exercise_id: "tpe-2",
          position: 2,
          exercise_name: "Incline Press",
          selected_plan_exercise_option_id: null,
          selected_variant_id: null,
          selected_variant_name: null,
          selected_station_id: null,
          selected_station_name: null,
          completed_sets: [],
          suggested_set: { load_value: 30, reps: 8 },
        },
      ],
    },
  });

  assert.equal(nextPlan.exercises[1]?.selectedPlanExerciseOptionId, "option-2");
  assert.equal(nextPlan.exercises[1]?.selectedVariantId, "variant-2");
  assert.equal(nextPlan.exercises[1]?.selectedStationId, "station-2");
  assert.equal(nextPlan.exercises[1]?.isFallbackOptionConfirmed, true);
});

test("applyActiveWorkoutResponse normalizes stationless persisted loads when station id is empty", () => {
  const plan = buildWorkoutPlan(
    { id: "plan-1", name: "Lower Day", exercise_count: 1 },
    {
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "option-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Nordic Curls",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Nordic Curls",
          variant_type: "bodyweight",
          station_id: "",
          station_name: "",
          station_profile_loads_kg: [],
        },
      ],
    },
  );

  const nextPlan = applyActiveWorkoutResponse(plan, {
    workout: {
      id: "active-1",
      training_plan_id: "plan-1",
      training_plan_name: "Lower Day",
      gym_id: "gym-1",
      gym_name: "Forge Downtown",
      started_at: "2026-02-01T09:00:00Z",
      updated_at: "2026-02-01T09:10:00Z",
      current_exercise_position: 1,
      total_exercise_count: 1,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          exercise_name: "Nordic Curls",
          selected_plan_exercise_option_id: "option-1",
          selected_variant_id: "variant-1",
          selected_variant_name: "Nordic Curls",
          selected_station_id: "",
          selected_station_name: "",
          completed_sets: [{ set_index: 1, load_value: 10, reps: 8 }],
          suggested_set: { load_value: 10, reps: 10 },
        },
      ],
    },
  });

  assert.equal(nextPlan.exercises[0]?.selectedStationId, null);
  assert.equal(nextPlan.exercises[0]?.suggestedSet.loadValue, null);
  assert.equal(nextPlan.exercises[0]?.activeSet.loadValue, null);
  assert.equal(nextPlan.exercises[0]?.completedSets[0]?.loadValue, null);
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
  await api.createWorkout({
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    started_at: "2026-02-01T10:00:00.000Z",
    completed_at: "2026-02-01T10:05:00.000Z",
    exercises: [],
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
  assert.equal(requests[1]?.input, "/api/workouts");
  assert.equal(requests[2]?.input, "/api/active-workout/active-1");
  assert.equal(requests[3]?.input, "/api/active-workout/active-1");
  assert.equal(requests[4]?.input, "/api/active-workout/active-1/complete");

  const failingApi = createActiveWorkoutApi(async () => {
    return {
      ok: false,
      status: 500,
      json: async () => ({ message: "failed" }),
    } as Response;
  });

  await assert.rejects(async () => await failingApi.cancelActiveWorkout("fail-workout"), /failed/);
});

test("createApp workout screens do not render PumpBuddy headline text", async () => {
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
      createWorkout: async () => ({
        id: "workout-1",
        training_plan_id: "plan-1",
        training_plan_name: "Push Day",
        gym_id: "gym-1",
        gym_name: "Forge Downtown",
        started_at: "2026-02-01T10:00:00Z",
        completed_at: "2026-02-01T10:10:00Z",
        exercise_count: 0,
        completed_set_count: 0,
      }),
      createActiveWorkout: async () => {
        throw new Error("create active workout should not run");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
    () => "2026-02-01T10:10:00Z",
  );

  await flushAsyncWork();
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /PumpBuddy/);

  await clickAction(app as unknown as FakeAppElement, "start-workout");
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /PumpBuddy/);

  await clickAction(app as unknown as FakeAppElement, "finish-workout");
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /PumpBuddy/);
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Exercises Completed", "1");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Total Sets Completed", "0");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Total Reps", "0");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Total Weight Moved", "0 kg");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Workout Duration", "0m");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Volume per Minute", "0.0 kg/min");
  assert.match((app as unknown as FakeAppElement).innerHTML, /data-action="return-to-start"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /PumpBuddy/);

  await clickAction(app as unknown as FakeAppElement, "return-to-start");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Workout start screen/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Start Workout/);
});

test("createApp keeps finish separate from set completion on the last exercise", async () => {
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
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="exercise-step-header"[\s\S]*class="exercise-step-copy"[\s\S]*class="set-list-heading"[\s\S]*class="set-list-title"[\s\S]*class="set-counter"/,
  );
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="set-list"[\s\S]*class="nav-button nav-button-primary"[\s\S]*data-action="next-set"[\s\S]*class="step-actions"[\s\S]*class="step-actions-secondary"[\s\S]*data-action="previous-exercise"[\s\S]*data-action="next-exercise"/,
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /Set 1/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="set-row set-row-editable"[\s\S]*<div class="set-row-fields">[\s\S]*Load[\s\S]*Reps/s,
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="10"/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "25"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "10"));
  await clickAction(app as unknown as FakeAppElement, "next-set");

  assert.equal(createPayloads.length, 1);
  assert.equal(createPayloads[0]?.current_exercise_position, 1);
  assert.deepEqual(createPayloads[0]?.exercises[0]?.completed_sets, [{ load_value: 25, reps: 10 }]);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 1 of 2/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Set 2/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Complete Set/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Previous Exercise/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /data-action="previous-exercise"[\s\S]*disabled/,
  );
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="completed-set-row"[\s\S]*25 kg[\s\S]*>10<\/span>[\s\S]*completed-set-cell-status" aria-hidden="true">✓<\/span>/s,
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /25 kg/);
  assert.match((app as unknown as FakeAppElement).innerHTML, />10<\/span>/);
  const readOnlyRow = (app as unknown as FakeAppElement).innerHTML.match(
    /<li class="completed-set-row"[\s\S]*?<\/li>/,
  )?.[0];
  assert.ok(readOnlyRow);
  assert.doesNotMatch(readOnlyRow, /weight-button/);

  await clickAction(app as unknown as FakeAppElement, "next-exercise");

  assert.equal(updatePayloads.length, 0);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="32"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="8"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /data-action="finish-workout"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /data-action="next-exercise"/);
  assert.doesNotMatch(
    (app as unknown as FakeAppElement).innerHTML,
    /data-action="previous-exercise"[\s\S]*disabled/,
  );
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /25 kg.*Exercise 1/s);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "35"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "9"));

  await clickAction(app as unknown as FakeAppElement, "previous-exercise");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 1 of 2/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="exercise-reps"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /35 kg|25 kg/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /data-action="next-set"[^>]*disabled/,
  );

  await clickAction(app as unknown as FakeAppElement, "next-exercise");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="35"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="9"/);
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "32"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "8"));

  await clickAction(app as unknown as FakeAppElement, "finish-workout");
  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Finish this workout? This draft set will not be saved.",
    "Finish Workout",
  );
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");

  assert.equal(completePayloads.length, 1);
  assert.equal(completePayloads[0]?.last_confirmed_exercise_position, 2);
  assert.equal(completePayloads[0]?.exercises.length, 1);
  assert.equal(completePayloads[0]?.exercises[0]?.position, 1);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Exercises Completed", "2");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Total Sets Completed", "1");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Total Reps", "10");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Total Weight Moved", "250 kg");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Workout Duration", "30m");
  expectCompletionMetricRow(app as unknown as FakeAppElement, "Volume per Minute", /8\.3 kg\/min/);
});

test("createApp keeps configured-gym option IDs when progressing to the next exercise", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const updatePayloads = [];

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
      createActiveWorkout: async () => ({
        workout: {
          id: "active-1",
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
              selected_variant_name: "Bench Variant",
              selected_station_id: "station-1",
              selected_station_name: "Bench Station",
              completed_sets: [{ set_index: 1, load_value: 10, reps: 10 }],
              suggested_set: { load_value: 10, reps: 10 },
            },
            {
              training_plan_exercise_id: "tpe-2",
              position: 2,
              exercise_name: "Incline Press",
              selected_plan_exercise_option_id: null,
              selected_variant_id: null,
              selected_variant_name: null,
              selected_station_id: null,
              selected_station_name: null,
              completed_sets: [],
              suggested_set: { load_value: 10, reps: 10 },
            },
          ],
        },
      }),
      updateActiveWorkout: async (_workoutId, payload) => {
        updatePayloads.push(payload);

        return {
          workout: {
            id: "active-1",
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
                selected_variant_name: "Bench Variant",
                selected_station_id: "station-1",
                selected_station_name: "Bench Station",
                completed_sets: [{ set_index: 1, load_value: 10, reps: 10 }],
                suggested_set: { load_value: 10, reps: 10 },
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
                completed_sets: [{ set_index: 1, load_value: 10, reps: 10 }],
                suggested_set: { load_value: 10, reps: 10 },
              },
            ],
          },
        };
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  await clickAction(app as unknown as FakeAppElement, "next-set");
  await clickAction(app as unknown as FakeAppElement, "next-exercise");
  await clickAction(app as unknown as FakeAppElement, "next-set");

  assert.equal(updatePayloads.length, 1);
  const secondExercisePayload = updatePayloads[0]?.exercises.find(
    (exercise) => exercise.position === 2,
  );
  assert.equal(secondExercisePayload?.selected_plan_exercise_option_id, "option-2");
  assert.equal(secondExercisePayload?.selected_variant_id, "variant-2");
  assert.equal(secondExercisePayload?.selected_station_id, "station-2");
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

  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("previous-exercise"));
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 1 of 3/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="exercise-reps"/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /data-action="next-set"[^>]*disabled/,
  );
});

test("createApp does not render numeric completed-set load for stationless persisted exercises", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      return {
        workout: {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Lower Day",
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
              exercise_name: "Nordic Curls",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "variant-1",
              selected_variant_name: "Nordic Curls",
              selected_station_id: "",
              selected_station_name: "",
              completed_sets: [{ set_index: 1, load_value: 10, reps: 8 }],
              suggested_set: { load_value: 10, reps: 10 },
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
            exercise_name: "Nordic Curls",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Nordic Curls",
            variant_type: "bodyweight",
            station_id: "",
            station_name: "",
            station_profile_loads_kg: [],
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /class="completed-set-row"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /10 kg/);
});

test("createApp renders the start screen inside the mobile shell panel", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

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

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="screen-panel start-screen"[\s\S]*class="app-header"[\s\S]*class="start-fields"[\s\S]*class="start-field"[\s\S]*data-action="select-training-plan"[\s\S]*data-action="select-gym"[\s\S]*data-action="start-workout"/,
  );
});

test("createApp shows an error when start screen selections fail to load", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      throw new Error("Request failed with status 500");
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /Unable to load start selections\. Refresh and try again\./,
  );
});

test("createApp updates start screen selections on change events", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      return [
        { id: "plan-1", name: "Push Day", exercise_count: 2 },
        { id: "plan-2", name: "Leg Day", exercise_count: 2 },
      ] as T;
    }

    if (input === "/api/gyms") {
      return [
        { id: "gym-1", name: "Forge Downtown" },
        { id: "gym-2", name: "Forge Uptown" },
      ] as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLSelectElement("select-training-plan", "plan-2"),
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="plan-2" selected/);

  (app as unknown as FakeAppElement).emit("change", new FakeHTMLSelectElement("select-gym", "gym-2"));
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="gym-2" selected/);
});

test("createApp hides start-screen gym selection while free mode is selected", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

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

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();

  assert.match((app as unknown as FakeAppElement).innerHTML, /id="gym-select"/);

  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLInputElement("select-workout-mode", "free-mode"),
  );

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /<label[^>]*class="start-label"[^>]*>Gym<\/label>/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="gym-select"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /data-action="select-gym"/);

  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLInputElement("select-workout-mode", "configured-gym"),
  );

  assert.match((app as unknown as FakeAppElement).innerHTML, /id="gym-select"/);
});

test("createApp renders and dismisses a contextual blocked-start modal from backend validation details", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

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
      throw {
        message:
          "Configured-gym workout start requires realizable options for every plan exercise",
        status: 400,
        body: {
          message: "Configured-gym workout start requires realizable options for every plan exercise",
          details: {
            missing_exercises: [
              {
                training_plan_exercise_id: "tpe-3",
                exercise_name: "Cable Fly",
                exercise_position: 3,
                reason: "no_realizable_option_in_selected_gym",
              },
              {
                training_plan_exercise_id: "tpe-2",
                exercise_name: "Incline Press",
                exercise_position: 2,
                reason: "no_realizable_option_in_selected_gym",
              },
            ],
          },
        },
      };
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  assert.match((app as unknown as FakeAppElement).innerHTML, /aria-label="Workout start blocked"/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /Configured-gym workout start requires realizable options for every plan exercise/,
  );
  assert.match((app as unknown as FakeAppElement).innerHTML, /Push Day at Forge Downtown/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /Exercise 2: Incline Press \(No realizable option in selected gym\)/,
  );
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /Exercise 3: Cable Fly \(No realizable option in selected gym\)/,
  );
  await clickAction(app as unknown as FakeAppElement, "dismiss-start-blocked-modal");
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /aria-label="Workout start blocked"/);
});

test("createApp shows a combined plan-and-gym header line for configured-gym workouts", async () => {
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

  createApp(app, fetchJson);
  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  assert.match((app as unknown as FakeAppElement).innerHTML, /<p class="plan-label">Push Day at Forge Downtown<\/p>/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /class="tracker-gym-context"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /aria-label="Workout gym context"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /<label[^>]*class="start-label"[^>]*>Gym<\/label>/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="gym-select"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /data-action="select-gym"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="tracker-gym-select"/);
});

test("createApp keeps a compact plan-only header line for free-mode workouts", async () => {
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

    if (input === "/api/training-plans/plan-1") {
      return {
        id: "plan-1",
        name: "Push Day",
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
          },
        ],
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(app, fetchJson);
  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLInputElement("select-workout-mode", "free-mode"),
  );
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  assert.match((app as unknown as FakeAppElement).innerHTML, /<p class="plan-label">Push Day<\/p>/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Push Day at/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Configured Gym/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /class="tracker-gym-context"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /aria-label="Workout gym context"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /<label[^>]*class="start-label"[^>]*>Gym<\/label>/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="gym-select"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /data-action="select-gym"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="tracker-gym-select"/);
});

test("createApp confirms forward navigation when no set has been completed yet", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads = [];

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
        throw new Error("create should not run during navigation");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run during navigation");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  await clickAction(app as unknown as FakeAppElement, "next-exercise");

  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Move to the next exercise? This draft set will not be saved.",
    "Skip Exercise",
  );
  assert.equal(createPayloads.length, 0);
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);
});

test("createApp ignores finish requests before the last exercise", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
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
      createActiveWorkout: async () => {
        throw new Error("create should not run");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async (_workoutId, payload) => {
        completePayloads.push(payload);
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  (app as unknown as FakeAppElement).emit("click", new FakeHTMLElement("finish-workout"));
  await flushAsyncWork();

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /confirm-dialog-message/);
  assert.equal(completePayloads.length, 0);
});

test("createApp blocks background exercise actions while a confirmation dialog is open", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

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
      createActiveWorkout: async () => {
        throw new Error("create should not run during navigation");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run during navigation");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  await clickAction(app as unknown as FakeAppElement, "next-exercise");

  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Move to the next exercise? This draft set will not be saved.",
    "Skip Exercise",
  );

  await clickAction(app as unknown as FakeAppElement, "next-set");

  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 1 of 2/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Set 1/);
  assert.equal(
    ((app as unknown as FakeAppElement).innerHTML.match(/class="set-row /g) ?? []).length,
    1,
  );
});

test("createApp confirms forward navigation when the draft differs from the suggestion", async () => {
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
          current_exercise_position: 1,
          total_exercise_count: 2,
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
              suggested_set: { load_value: 32, reps: 8 },
            },
          ],
        },
      } as T;
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
      createActiveWorkout: async () => {
        throw new Error("create should not run during navigation");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run during navigation");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "26"));
  await clickAction(app as unknown as FakeAppElement, "next-exercise");

  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Move to the next exercise? This draft set will not be saved.",
    "Skip Exercise",
  );
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Exercise 2 of 2/);
});

test("createApp finishes the workout without confirmation when the last exercise already has a completed set", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const completePayloads = [];

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
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
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
          completed_at: "2026-02-01T10:10:00Z",
          exercise_count: 1,
          completed_set_count: 1,
        };
      },
    },
    () => "2026-02-01T10:10:00Z",
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  assert.match((app as unknown as FakeAppElement).innerHTML, /data-action="finish-workout"/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "25"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "10"));
  await clickAction(app as unknown as FakeAppElement, "next-set");
  await clickAction(app as unknown as FakeAppElement, "finish-workout");

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /confirm-dialog-message/);
  assert.equal(completePayloads.length, 1);
  assert.equal(completePayloads[0]?.exercises[0]?.completed_sets[0]?.load_value, 25);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp confirms finish and discards an uncompleted draft on a single-exercise workout", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createWorkoutPayloads = [];

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
      createWorkout: async (payload) => {
        createWorkoutPayloads.push(payload);
        return {
          id: "workout-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-02-01T10:00:00Z",
          completed_at: "2026-02-01T10:10:00Z",
          exercise_count: 0,
          completed_set_count: 0,
        };
      },
      createActiveWorkout: async () => {
        throw new Error("create active workout should not run");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
    () => "2026-02-01T10:10:00Z",
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "12"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", "8"));
  await clickAction(app as unknown as FakeAppElement, "finish-workout");

  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Finish this workout? This draft set will not be saved.",
    "Finish Workout",
  );
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");
  assert.equal(createWorkoutPayloads.length, 1);
  assert.deepEqual(createWorkoutPayloads[0]?.exercises, []);
  assert.equal(createWorkoutPayloads[0]?.started_at, "2026-02-01T10:10:00Z");
  assert.match((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp only shows cancellation after persistence and resets to the start screen after confirmation", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const cancelCalls: string[] = [];

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
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Cancel Workout/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "25"));
  await clickAction(app as unknown as FakeAppElement, "next-set");

  assert.match((app as unknown as FakeAppElement).innerHTML, /Cancel Workout/);
  await clickAction(app as unknown as FakeAppElement, "cancel-workout");
  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Cancel this workout? Your unfinished workout data will be deleted.",
    "Cancel Workout",
  );
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");

  assert.deepEqual(cancelCalls, ["workout-1"]);
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
  await clickAction(app as unknown as FakeAppElement, "finish-workout");
  expectDialogMessage(
    app as unknown as FakeAppElement,
    "Finish this workout? This draft set will not be saved.",
    "Finish Workout",
  );
  await clickAction(app as unknown as FakeAppElement, "confirm-dialog-confirm");

  assert.match((app as unknown as FakeAppElement).innerHTML, /Your workout progress is still saved in this session/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /retry when your network returns/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /Plan Completed/);
});

test("createApp allows intermediate numeric typing and normalizes on blur/save boundaries", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads = [];

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
                completed_sets: [{ set_index: 1, load_value: 22, reps: 1 }],
                suggested_set: { load_value: 22, reps: 1 },
              },
            ],
          },
        };
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  const intermediateLoad = new FakeHTMLInputElement("load-input", "abc");
  (app as unknown as FakeAppElement).emit("input", intermediateLoad);
  assert.equal(intermediateLoad.value, "abc");

  (app as unknown as FakeAppElement).emit("focusout", intermediateLoad);
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="10"/);

  const intermediateReps = new FakeHTMLInputElement("reps-input", "0");
  (app as unknown as FakeAppElement).emit("input", intermediateReps);
  assert.equal(intermediateReps.value, "0");

  (app as unknown as FakeAppElement).emit("focusout", intermediateReps);
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-reps"[\s\S]*value="1"/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "22"));
  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("reps-input", ""));
  await clickAction(app as unknown as FakeAppElement, "next-set");

  assert.equal(createPayloads.length, 1);
  assert.deepEqual(createPayloads[0]?.exercises[0]?.completed_sets, [{ load_value: 22, reps: 1 }]);
});

test("createApp steps configured-gym load controls across valid profile loads only", async () => {
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
            variant_name: "Bench Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Rack A",
            station_profile_loads_kg: [5, 12.5, 20, 27.5, 40],
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
        throw new Error("create should not run");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="12.5"/);

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "21"));
  await clickAction(app as unknown as FakeAppElement, "increment-load");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="27.5"/);

  await clickAction(app as unknown as FakeAppElement, "decrement-load");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="20"/);
});

test("createApp clamps out-of-range configured-gym increments before persisting sets", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads: Array<Record<string, unknown>> = [];

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }
    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Leg Day", exercise_count: 1 }] as T;
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
            exercise_name: "Leg Press",
            exercise_position: 1,
            variant_id: "variant-1",
            variant_name: "Leg Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Leg Station",
            station_profile_loads_kg: [5, 12.5, 20, 27.5, 40],
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
        createPayloads.push(payload as unknown as Record<string, unknown>);

        return {
          workout: {
            id: "active-1",
            training_plan_id: "plan-1",
            training_plan_name: "Leg Day",
            gym_id: "gym-1",
            gym_name: "Forge Downtown",
            started_at: "2026-02-01T09:00:00.000Z",
            updated_at: "2026-02-01T09:01:00.000Z",
            current_exercise_position: 1,
            total_exercise_count: 1,
            exercises: [
              {
                training_plan_exercise_id: "tpe-1",
                position: 1,
                exercise_name: "Leg Press",
                selected_plan_exercise_option_id: "option-1",
                selected_variant_id: "variant-1",
                selected_variant_name: "Leg Press",
                selected_station_id: "station-1",
                selected_station_name: "Leg Station",
                completed_sets: [{ set_index: 1, load_value: 5, reps: 10 }],
                suggested_set: { load_value: 5, reps: 10 },
              },
            ],
          },
        };
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "0"));
  await clickAction(app as unknown as FakeAppElement, "increment-load");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="5"/);

  await clickAction(app as unknown as FakeAppElement, "next-set");
  assert.equal(createPayloads.length, 1);
  assert.deepEqual((createPayloads[0]?.exercises as Array<Record<string, unknown>>)[0]?.completed_sets, [
    { load_value: 5, reps: 10 },
  ]);
});

test("createApp keeps configured-gym load controls responsive after decrementing to profile minimum", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }
    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Leg Day", exercise_count: 1 }] as T;
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
            training_plan_exercise_id: "tpe-4",
            exercise_name: "Crunches",
            exercise_position: 4,
            variant_id: "variant-4",
            variant_name: "Crunches",
            variant_type: "machine",
            station_id: "station-4",
            station_name: "Ab Station",
            station_profile_loads_kg: [5, 10, 15, 20],
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
        throw new Error("create should not run");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  (app as unknown as FakeAppElement).emit("input", new FakeHTMLInputElement("load-input", "10"));
  await clickAction(app as unknown as FakeAppElement, "decrement-load");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="5"/);

  await clickAction(app as unknown as FakeAppElement, "increment-load");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="10"/);

  await clickAction(app as unknown as FakeAppElement, "decrement-load");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="5"/);
});

test("createApp hides set controls for multi-option configured-gym exercises until fallback confirmation", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads = [];

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
            variant_name: "Bench Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Rack A",
            station_profile_loads_kg: [10, 15, 22.5, 30],
          },
          {
            id: "option-2",
            training_plan_exercise_id: "tpe-1",
            exercise_name: "Bench Press",
            exercise_position: 1,
            variant_id: "variant-2",
            variant_name: "Incline Press",
            variant_type: "machine",
            station_id: "station-2",
            station_name: "Rack B",
            station_profile_loads_kg: [10, 17.5, 22.5, 30],
          },
          {
            id: "option-3",
            training_plan_exercise_id: "tpe-2",
            exercise_name: "Incline Press",
            exercise_position: 2,
            variant_id: "variant-3",
            variant_name: "Incline Press",
            variant_type: "machine",
            station_id: "station-3",
            station_name: "Rack C",
            station_profile_loads_kg: [10, 20, 25, 30],
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
            current_exercise_position: 1,
            total_exercise_count: 2,
            exercises: [
              {
                training_plan_exercise_id: "tpe-1",
                position: 1,
                exercise_name: "Bench Press",
                selected_plan_exercise_option_id: "option-2",
                selected_variant_id: "variant-2",
                selected_variant_name: "Incline Press",
                selected_station_id: "station-2",
                selected_station_name: "Rack B",
                completed_sets: [],
                suggested_set: { load_value: 10, reps: 10 },
              },
              {
                training_plan_exercise_id: "tpe-2",
                position: 2,
                exercise_name: "Incline Press",
                selected_plan_exercise_option_id: "option-3",
                selected_variant_id: "variant-3",
                selected_variant_name: "Incline Press",
                selected_station_id: "station-3",
                selected_station_name: "Rack C",
                completed_sets: [],
                suggested_set: { load_value: 10, reps: 10 },
              },
            ],
          },
        };
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  assert.match((app as unknown as FakeAppElement).innerHTML, /id="fallback-option-select"/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="fallback-option-controls"[\s\S]*id="fallback-option-select"[\s\S]*data-action="confirm-fallback-option"/,
  );
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"/);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /data-action="next-exercise"/);

  await clickAction(app as unknown as FakeAppElement, "next-set");
  assert.equal(createPayloads.length, 0);

  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLSelectElement("switch-fallback-option", "option-2"),
  );
  await clickAction(app as unknown as FakeAppElement, "confirm-fallback-option");

  assert.equal(createPayloads.length, 1);
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="fallback-option-select"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /class="exercise-variant-label">Incline Press</);
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /data-action="next-exercise"/);
});

test("createApp auto-confirms single fallback option and shows set controls immediately", async () => {
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
            variant_name: "Bench Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Rack A",
            station_profile_loads_kg: [10, 15, 22.5, 30],
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
        throw new Error("create should not run");
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="fallback-option-select"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /class="exercise-variant-label">Bench Press</);
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"/);
});

test("createApp rounds long configured-gym load display values without changing payload precision", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const createPayloads: Array<{ exercises?: Array<{ completed_sets?: Array<{ load_value: number | null }> }> }> = [];
  const preciseLoadKg = 27.333333333333332;

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      throw new Error("Request failed with status 404");
    }

    if (input === "/api/training-plans") {
      return [{ id: "plan-1", name: "Precision Day", exercise_count: 1 }] as T;
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
            variant_name: "Bench Press",
            variant_type: "machine",
            station_id: "station-1",
            station_name: "Rack A",
            station_profile_loads_kg: [10, preciseLoadKg],
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
            training_plan_name: "Precision Day",
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
                selected_variant_name: "Bench Press",
                selected_station_id: "station-1",
                selected_station_name: "Rack A",
                completed_sets: [{ set_index: 1, load_value: preciseLoadKg, reps: 10 }],
                suggested_set: { load_value: preciseLoadKg, reps: 10 },
              },
            ],
          },
        };
      },
      updateActiveWorkout: async () => {
        throw new Error("update should not run");
      },
      cancelActiveWorkout: async () => {
        throw new Error("cancel should not run");
      },
      completeActiveWorkout: async () => {
        throw new Error("complete should not run");
      },
    },
  );

  await flushAsyncWork();
  await clickAction(app as unknown as FakeAppElement, "start-workout");
  assert.match((app as unknown as FakeAppElement).innerHTML, /id="exercise-load"[\s\S]*value="27\.33"/);

  await clickAction(app as unknown as FakeAppElement, "next-set");

  assert.equal(createPayloads.length, 1);
  assert.equal(createPayloads[0]?.exercises?.[0]?.completed_sets?.[0]?.load_value, preciseLoadKg);
});
