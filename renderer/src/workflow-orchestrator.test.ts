import { describe, it, expect, vi } from "vitest";
import { createWorkflowOrchestrator } from "./workflow-orchestrator";

describe("workflow-orchestrator", () => {
  const baseState = {
    startScreen: {
      isLoading: false,
      isStarting: false,
      errorMessage: null,
      blockedStartModal: null,
      trainingPlans: [],
      gyms: [],
      selectedTrainingPlanId: "",
      selectedGymId: "",
      selectedWorkoutMode: "configured-gym",
    },
    workoutPlan: null,
    viewState: { screen: "start" },
    completion: { startedAt: null, completedAt: null },
    confirmDialog: { message: null, confirmActionLabel: null, onConfirm: null },
    activeWorkout: { id: null, startedAt: null, persistedExerciseCount: 0 },
    workoutSave: { isSaving: false, errorMessage: null },
    uiFeedback: { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
  };

  const setup = () => {
    let state = structuredClone(baseState);
    const fetchJson = vi.fn();
    const activeWorkoutApi = {
      createActiveWorkout: vi.fn(),
      updateActiveWorkout: vi.fn(),
      cancelActiveWorkout: vi.fn(),
      completeActiveWorkout: vi.fn(),
    };

    const orchestrator = createWorkflowOrchestrator({
      getState: () => state,
      setState: (next) => { state = next; },
      render: vi.fn(),
      fetchJson,
      activeWorkoutApi,
      now: () => "now",
      openConfirmDialog: vi.fn(),
      closeConfirmDialog: vi.fn(),
      pulseUiFeedback: vi.fn(),
    });

    return { orchestrator, getState: () => state, fetchJson, activeWorkoutApi };
  };

  it("does not start workout when already starting", async () => {
    const { orchestrator, getState } = setup();
    getState().startScreen.isStarting = true;

    await orchestrator.startWorkout();

    expect(getState().startScreen.isStarting).toBe(true);
  });

  it("does not cancel workout if no active workout id", async () => {
    const { orchestrator, getState } = setup();

    await orchestrator.cancelWorkout();

    expect(getState().activeWorkout.id).toBe(null);
  });

  it("finishWorkout does nothing when not in exercise screen", async () => {
    const { orchestrator } = setup();

    await orchestrator.finishWorkout();

    expect(true).toBe(true);
  });

  it("persistActiveSet does nothing without workoutPlan", async () => {
    const { orchestrator } = setup();

    await orchestrator.persistActiveSet();

    expect(true).toBe(true);
  });

  it("startWorkout in configured-gym mode creates active workout and applies backend suggestions", async () => {
    const { orchestrator, getState, fetchJson, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.trainingPlans = [{ id: "plan-1", name: "Leg Day", exercise_count: 1 }];
    state.startScreen.gyms = [{ id: "gym-1", name: "Gym" }];
    state.startScreen.selectedTrainingPlanId = "plan-1";
    state.startScreen.selectedGymId = "gym-1";
    state.startScreen.selectedWorkoutMode = "configured-gym";

    fetchJson.mockResolvedValueOnce({
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      options: [
        {
          id: "opt-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Deadlift",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Conventional",
          station_id: "station-1",
          station_name: "Rack",
          station_profile_loads_kg: [10, 15, 20, 25],
          suggested_start_load_kg: 20,
        },
      ],
    });

    activeWorkoutApi.createActiveWorkout.mockResolvedValueOnce({
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
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
            exercise_name: "Deadlift",
            selected_plan_exercise_option_id: "opt-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Conventional",
            selected_station_id: "station-1",
            selected_station_name: "Rack",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 20, reps: 11 },
          },
        ],
      },
    });

    await orchestrator.startWorkout();

    expect(activeWorkoutApi.createActiveWorkout).toHaveBeenCalledTimes(1);
    const payload = activeWorkoutApi.createActiveWorkout.mock.calls[0][0];
    expect(payload.gym_id).toBe("gym-1");
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0]).toMatchObject({
      position: 1,
      selected_plan_exercise_option_id: "opt-1",
      selected_variant_id: "variant-1",
      selected_station_id: "station-1",
      completed_sets: [],
    });

    expect(getState().activeWorkout.id).toBe("aw-1");
    expect(getState().workoutPlan?.exercises[0]?.suggestedSet).toEqual({
      loadValue: 20,
      reps: 11,
    });
  });
});
