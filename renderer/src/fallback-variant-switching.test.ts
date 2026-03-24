import assert from "node:assert/strict";
import { test } from "vitest";

import { createApp } from "./workout-controller";
import { buildWorkoutPlan, withFallbackOptionSelected } from "./workout-state";
import type {
  ActiveWorkoutResponse,
  PlanExerciseOptionSummary,
  TrainingPlanOptionsResponse,
} from "./workout-types";

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

  removeEventListener(type: string, listener: (event: { target: unknown }) => void): void {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      existing.filter((current) => current !== listener),
    );
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
    setTimeout,
  },
});

const flushAsyncWork = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const makeOption = (
  id: string,
  trainingPlanExerciseId: string,
  variantName: string,
  stationName: string,
): PlanExerciseOptionSummary => ({
  id,
  training_plan_exercise_id: trainingPlanExerciseId,
  exercise_name: "Bench Press",
  exercise_position: 1,
  variant_id: `${id}-variant`,
  variant_name: variantName,
  variant_type: "machine",
  station_id: `${id}-station`,
  station_name: stationName,
  station_profile_loads_kg: [10, 15, 22.5, 30],
});

test("fallback-variant-switching: single-option flow auto-selects the only available option", () => {
  const onlyOption = makeOption("option-1", "tpe-1", "Bench Press", "Rack A");
  const optionsResponse: TrainingPlanOptionsResponse = {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: [onlyOption],
  };

  const workoutPlan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    optionsResponse,
  );

  workoutPlan.exercises[0]!.selectedPlanExerciseOptionId = null;
  workoutPlan.exercises[0]!.selectedVariantId = null;
  workoutPlan.exercises[0]!.selectedStationId = null;

  const nextPlan = withFallbackOptionSelected(workoutPlan, 0, null);

  assert.equal(nextPlan.exercises[0]!.selectedPlanExerciseOptionId, onlyOption.id);
  assert.equal(nextPlan.exercises[0]!.selectedVariantId, onlyOption.variant_id);
  assert.equal(nextPlan.exercises[0]!.selectedStationId, onlyOption.station_id);
  assert.equal(nextPlan.exercises[0]!.isFallbackOptionConfirmed, true);
});

test("fallback-variant-switching: multi-option flow keeps existing selection when cleared", () => {
  const optionsResponse: TrainingPlanOptionsResponse = {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: [
      makeOption("option-1", "tpe-1", "Bench Press", "Rack A"),
      makeOption("option-1b", "tpe-1", "Incline Press", "Rack B"),
    ],
  };
  const workoutPlan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    optionsResponse,
  );

  const nextPlan = withFallbackOptionSelected(workoutPlan, 0, null);

  assert.equal(nextPlan.exercises[0]!.selectedPlanExerciseOptionId, "option-1");
  assert.equal(nextPlan.exercises[0]!.selectedVariantId, "option-1-variant");
  assert.equal(nextPlan.exercises[0]!.selectedStationId, "option-1-station");
});

test("fallback-variant-switching: unknown option id is ignored", () => {
  const optionsResponse: TrainingPlanOptionsResponse = {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: [
      makeOption("option-1", "tpe-1", "Bench Press", "Rack A"),
      makeOption("option-1b", "tpe-1", "Incline Press", "Rack B"),
    ],
  };
  const workoutPlan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    optionsResponse,
  );

  const nextPlan = withFallbackOptionSelected(workoutPlan, 0, "missing-option");

  assert.equal(nextPlan.exercises[0]!.selectedPlanExerciseOptionId, "option-1");
  assert.equal(nextPlan.exercises[0]!.selectedVariantId, "option-1-variant");
  assert.equal(nextPlan.exercises[0]!.selectedStationId, "option-1-station");
});

test("fallback-variant-switching: completed exercise keeps fallback selection immutable", () => {
  const optionsResponse: TrainingPlanOptionsResponse = {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    options: [
      makeOption("option-1", "tpe-1", "Bench Press", "Rack A"),
      makeOption("option-1b", "tpe-1", "Incline Press", "Rack B"),
    ],
  };
  const workoutPlan = buildWorkoutPlan(
    { id: "plan-1", name: "Push Day", exercise_count: 1 },
    optionsResponse,
  );
  workoutPlan.exercises[0]!.completedSets.push({
    setIndex: 1,
    loadValue: 10,
    reps: 10,
  });

  const nextPlan = withFallbackOptionSelected(workoutPlan, 0, "option-1b");

  assert.equal(nextPlan.exercises[0]!.selectedPlanExerciseOptionId, "option-1");
  assert.equal(nextPlan.exercises[0]!.selectedVariantId, "option-1-variant");
  assert.equal(nextPlan.exercises[0]!.selectedStationId, "option-1-station");
});

test("fallback-variant-switching: multi-option flow persists selected fallback only after explicit confirmation", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const updatePayloads: Array<{ workoutId: string; payload: unknown }> = [];

  const options: PlanExerciseOptionSummary[] = [
    makeOption("option-1", "tpe-1", "Bench Press", "Rack A"),
    makeOption("option-1b", "tpe-1", "Incline Press", "Rack B"),
  ];

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      return {
        workout: {
          id: "active-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-03-20T10:00:00.000Z",
          updated_at: "2026-03-20T10:00:00.000Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: null,
              selected_variant_id: null,
              selected_variant_name: null,
              selected_station_id: null,
              selected_station_name: null,
              completed_sets: [],
              suggested_set: {
                load_value: 10,
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
        options,
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  const updateResponse: ActiveWorkoutResponse = {
    workout: {
      id: "active-1",
      training_plan_id: "plan-1",
      training_plan_name: "Push Day",
      gym_id: "gym-1",
      gym_name: "Forge Downtown",
      started_at: "2026-03-20T10:00:00.000Z",
      updated_at: "2026-03-20T10:00:30.000Z",
      current_exercise_position: 1,
      total_exercise_count: 1,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          exercise_name: "Bench Press",
          selected_plan_exercise_option_id: "option-1b",
          selected_variant_id: "option-1b-variant",
          selected_variant_name: "Incline Press",
          selected_station_id: "option-1b-station",
          selected_station_name: "Rack B",
          completed_sets: [],
          suggested_set: {
            load_value: 10,
            reps: 10,
          },
        },
      ],
    },
  };

  createApp(
    app,
    fetchJson,
    {
      createActiveWorkout: async () => {
        throw new Error("createActiveWorkout should not run");
      },
      updateActiveWorkout: async (workoutId, payload) => {
        updatePayloads.push({ workoutId, payload });
        return updateResponse;
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

  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLSelectElement("switch-fallback-option", "option-1b"),
  );
  await flushAsyncWork();

  assert.equal(updatePayloads.length, 0);
  assert.match((app as unknown as FakeAppElement).innerHTML, /value="option-1b" selected/);
  assert.match(
    (app as unknown as FakeAppElement).innerHTML,
    /class="fallback-option-controls"[\s\S]*id="fallback-option-select"[\s\S]*data-action="confirm-fallback-option"/,
  );

  (app as unknown as FakeAppElement).emit(
    "click",
    new FakeHTMLElement("confirm-fallback-option"),
  );
  await flushAsyncWork();

  assert.equal(updatePayloads.length, 1);
  assert.equal(updatePayloads[0]!.workoutId, "active-1");
  assert.deepEqual(updatePayloads[0]!.payload, {
    training_plan_id: "plan-1",
    gym_id: "gym-1",
    started_at: "2026-03-20T10:00:00.000Z",
    current_exercise_position: 1,
    total_exercise_count: 1,
    exercises: [
      {
        training_plan_exercise_id: "tpe-1",
        position: 1,
        selected_plan_exercise_option_id: "option-1b",
        selected_variant_id: "option-1b-variant",
        selected_station_id: "option-1b-station",
        completed_sets: [],
      },
    ],
    last_confirmed_exercise_position: 1,
  });
  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="fallback-option-select"/);
  assert.match((app as unknown as FakeAppElement).innerHTML, /class="exercise-variant-label">Incline Press</);
  assert.match((app as unknown as FakeAppElement).innerHTML, /Complete Set/);
});

test("fallback-variant-switching: completed set blocks fallback mutation", async () => {
  const app = new FakeAppElement() as unknown as HTMLElement;
  const updatePayloads: Array<{ workoutId: string; payload: unknown }> = [];

  const options: PlanExerciseOptionSummary[] = [
    makeOption("option-1", "tpe-1", "Bench Press", "Rack A"),
    makeOption("option-1b", "tpe-1", "Incline Press", "Rack B"),
  ];

  const fetchJson = async <T>(input: string): Promise<T> => {
    if (input === "/api/active-workout") {
      return {
        workout: {
          id: "active-1",
          training_plan_id: "plan-1",
          training_plan_name: "Push Day",
          gym_id: "gym-1",
          gym_name: "Forge Downtown",
          started_at: "2026-03-20T10:00:00.000Z",
          updated_at: "2026-03-20T10:00:00.000Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Bench Press",
              selected_plan_exercise_option_id: "option-1",
              selected_variant_id: "option-1-variant",
              selected_variant_name: "Bench Press",
              selected_station_id: "option-1-station",
              selected_station_name: "Rack A",
              completed_sets: [{ set_index: 1, load_value: 10, reps: 10 }],
              suggested_set: {
                load_value: 10,
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
        options,
      } as T;
    }

    throw new Error(`Unexpected path: ${input}`);
  };

  createApp(
    app,
    fetchJson,
    {
      createActiveWorkout: async () => {
        throw new Error("createActiveWorkout should not run");
      },
      updateActiveWorkout: async (workoutId, payload) => {
        updatePayloads.push({ workoutId, payload });
        throw new Error("updateActiveWorkout should not run for locked fallback");
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

  assert.doesNotMatch((app as unknown as FakeAppElement).innerHTML, /id="fallback-option-select"/);

  (app as unknown as FakeAppElement).emit(
    "change",
    new FakeHTMLSelectElement("switch-fallback-option", "option-1b"),
  );
  await flushAsyncWork();

  assert.equal(updatePayloads.length, 0);
  assert.match((app as unknown as FakeAppElement).innerHTML, /class="exercise-variant-label">Bench Press</);
});

// Residual gap accepted for this item:
// out-of-range exercise indexes are handled as immutable no-ops in workout-state and are
// already covered indirectly by orchestrator flow tests.
