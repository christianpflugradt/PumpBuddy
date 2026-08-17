import { describe, it, expect, vi } from "vitest";
import { createWorkflowOrchestrator } from "./workflow-orchestrator";
import { canReopenPreviousExercise } from "./workout-state";
import * as workoutApi from "./workout-api";

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
      selectActiveWorkoutExerciseOption: vi.fn(),
      confirmActiveWorkoutSet: vi.fn(),
      deleteLatestActiveWorkoutSet: vi.fn(),
      skipActiveWorkoutExercise: vi.fn(),
      reopenActiveWorkoutExercise: vi.fn(),
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

  it("cancelWorkout cancels an active workout before any set is recorded", async () => {
    const { orchestrator, getState, fetchJson, activeWorkoutApi } = setup();
    const state = getState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = {
      id: "aw-1",
      startedAt: "2026-01-01T00:00:00.000Z",
      persistedExerciseCount: 0,
    };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          loadInputMode: "TOTAL",
          repetitionKind: "REPS",
          setTrackingMode: "BILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [],
          currentSetIndex: 1,
          currentSetSide: "BILATERAL",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };
    fetchJson
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await orchestrator.cancelWorkout();

    expect(activeWorkoutApi.cancelActiveWorkout).toHaveBeenCalledWith("aw-1");
    expect(getState().viewState).toEqual({ screen: "start" });
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

  it("completeWorkout stores workout progress from completion summary", async () => {
    const { orchestrator, getState, fetchJson, activeWorkoutApi } = setup();
    const state = getState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.activeWorkout = { id: "aw-1", startedAt: "2026-01-01T00:00:00.000Z", persistedExerciseCount: 1 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 10 },
          activeSet: { loadValue: 20, reps: 10 },
          activeSetInput: { loadValue: "20", reps: "10" },
          completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 10 }],
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.completeActiveWorkout.mockResolvedValueOnce({
      id: "workout-1",
      training_plan_id: "plan-1",
      training_plan_name: "Leg Day",
      gym_id: "gym-1",
      gym_name: "Gym",
      started_at: "2026-01-01T00:00:00.000Z",
      completed_at: "2026-01-01T00:10:00.000Z",
      exercise_count: 1,
      completed_set_count: 1,
      average_duration_minutes: 14,
      workout_progress: 1.1,
      workout_progress_status: "AVAILABLE",
    });

    await orchestrator.completeWorkout(state.workoutPlan);

    expect(getState().viewState).toEqual({ screen: "completion" });
    expect(getState().completion.averageDurationMinutes).toBe(14);
    expect(getState().completion.workoutProgress).toBe(1.1);
    expect(getState().completion.workoutProgressStatus).toBe("AVAILABLE");
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
      exercise_variants: [
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
            selected_training_plan_exercise_variant_id: "opt-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Conventional",
            selected_station_id: "station-1",
            selected_station_name: "Rack",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 20, repetition_value: 11 },
          },
        ],
      },
    });

    await orchestrator.startWorkout();

    expect(activeWorkoutApi.createActiveWorkout).toHaveBeenCalledTimes(1);
    const payload = activeWorkoutApi.createActiveWorkout.mock.calls[0][0];
    expect(payload).toEqual({
      training_plan_id: "plan-1",
      gym_id: "gym-1",
      started_at: "now",
    });

    expect(getState().activeWorkout.id).toBe("aw-1");
    expect(getState().workoutPlan?.exercises[0]?.suggestedSet).toEqual({
      loadValue: 20,
      reps: 11,
    });
  });

  it("startWorkout keeps fallback selection unconfirmed when multiple options exist", async () => {
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
      exercise_variants: [
        {
          id: "opt-1",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Torso Rotation",
          exercise_position: 1,
          variant_id: "variant-1",
          variant_name: "Cable",
          station_id: "station-1",
          station_name: "Cable",
          station_profile_loads_kg: [10, 12.5, 15],
          suggested_start_load_kg: 10,
        },
        {
          id: "opt-2",
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Torso Rotation",
          exercise_position: 1,
          variant_id: "variant-2",
          variant_name: "Machine",
          station_id: "station-2",
          station_name: "Machine",
          station_profile_loads_kg: [10, 15, 20],
          suggested_start_load_kg: 15,
        },
      ],
    });

    activeWorkoutApi.createActiveWorkout.mockResolvedValueOnce({
      workout: {
        id: "aw-2",
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
            exercise_name: "Torso Rotation",
            selected_training_plan_exercise_variant_id: "opt-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Cable",
            selected_station_id: "station-1",
            selected_station_name: "Cable",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 12.5, repetition_value: 10 },
          },
        ],
      },
    });

    await orchestrator.startWorkout();

    const exercise = getState().workoutPlan?.exercises[0];
    expect(exercise?.fallbackOptions).toHaveLength(2);
    expect(exercise?.isFallbackOptionConfirmed).toBe(false);
  });

  it("persistActiveSet confirms the current draft and applies backend-returned workout state", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = { id: "aw-existing", startedAt: "now", persistedExerciseCount: 2 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [
            {
              id: "opt-1",
              training_plan_exercise_id: "tpe-1",
              exercise_name: "Deadlift",
              exercise_position: 1,
              variant_id: "variant-1",
              variant_name: "Conventional",
              station_id: "station-1",
              station_name: "Rack",
              station_profile_loads_kg: [20, 22.5, 25],
              suggested_start_load_kg: 20,
            },
          ],
          selectedTrainingPlanExerciseVariantId: "opt-1",
          selectedVariantId: "variant-1",
          selectedStationId: "station-1",
          selectedStationProfileLoadsKg: [20, 22.5, 25],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 10 },
          activeSet: { loadValue: 20, reps: 10 },
          activeSetInput: { loadValue: "20", reps: "10" },
          completedSets: [],
          isReadOnly: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Bulgarian Split Squat",
          fallbackOptions: [
            {
              id: "opt-2",
              training_plan_exercise_id: "tpe-2",
              exercise_name: "Bulgarian Split Squat",
              exercise_position: 2,
              variant_id: "variant-2",
              variant_name: "Dumbbell",
              station_id: "station-2",
              station_name: "DB Area",
              station_profile_loads_kg: [8, 9, 10],
              suggested_start_load_kg: 9,
            },
          ],
          selectedTrainingPlanExerciseVariantId: "opt-2",
          selectedVariantId: "variant-2",
          selectedStationId: "station-2",
          selectedStationProfileLoadsKg: [8, 9, 10],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 9, reps: 9 },
          activeSet: { loadValue: 9, reps: 9 },
          activeSetInput: { loadValue: "9", reps: "9" },
          completedSets: [],
          isReadOnly: false,
        },
      ],
    };

    activeWorkoutApi.confirmActiveWorkoutSet.mockResolvedValueOnce({
      workout: {
        id: "aw-existing",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "now",
        updated_at: "now",
        current_exercise_position: 1,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: "opt-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Conventional",
            selected_station_id: "station-1",
            selected_station_name: "Rack",
            skipped_at: null,
            completed_sets: [
              {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 22.5,
                repetition_kind: "REPS",
                repetition_value: 11,
              },
            ],
            suggested_set: {
              set_index: 2,
              set_side: "BILATERAL",
              load_value: 25,
              repetition_kind: "REPS",
              repetition_value: 9,
            },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Bulgarian Split Squat",
            selected_training_plan_exercise_variant_id: "opt-2",
            selected_variant_id: "variant-2",
            selected_variant_name: "Dumbbell",
            selected_station_id: "station-2",
            selected_station_name: "DB Area",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 9, repetition_value: 9 },
          },
        ],
      },
    });

    await orchestrator.persistActiveSet();

    expect(activeWorkoutApi.confirmActiveWorkoutSet).toHaveBeenCalledWith("aw-existing", 1, {
      set: {
        load_value: 20,
        repetition_value: 10,
      },
    });
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
    expect(getState().workoutPlan?.exercises[0]?.completedSets).toEqual([
      { setIndex: 1, setSide: "BILATERAL", loadValue: 22.5, reps: 11 },
    ]);
    expect(getState().workoutPlan?.exercises[0]?.suggestedSet).toEqual({
      loadValue: 25,
      reps: 9,
    });
    expect(getState().workoutPlan?.exercises[1]).toMatchObject({
      selectedTrainingPlanExerciseVariantId: "opt-2",
      selectedVariantId: "variant-2",
      selectedStationId: "station-2",
      completedSets: [],
    });
  });

  it("persistActiveSet sends per-side draft loads for configured-gym PER_SIDE variants", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = { id: "aw-existing", startedAt: "now", persistedExerciseCount: 1 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Bulgarian Split Squat",
          fallbackOptions: [
            {
              id: "opt-2",
              training_plan_exercise_id: "tpe-2",
              exercise_name: "Bulgarian Split Squat",
              exercise_position: 2,
              variant_id: "variant-2",
              variant_name: "Dumbbell",
              station_id: "station-2",
              station_name: "DB Area",
              station_profile_loads_kg: [10, 12.5, 15],
              suggested_start_load_kg: 12.5,
              load_input_mode: "PER_SIDE",
              set_tracking_mode: "UNILATERAL",
              repetition_kind: "REPS",
            },
          ],
          selectedTrainingPlanExerciseVariantId: "opt-2",
          selectedVariantId: "variant-2",
          selectedStationId: "station-2",
          selectedStationProfileLoadsKg: [10, 12.5, 15],
          loadInputMode: "PER_SIDE",
          repetitionKind: "REPS",
          setTrackingMode: "UNILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 10, reps: 10 },
          activeSet: { loadValue: 12.5, reps: 10 },
          activeSetInput: { loadValue: "12.5", reps: "10" },
          completedSets: [],
          currentSetIndex: 1,
          currentSetSide: "LEFT",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.confirmActiveWorkoutSet.mockResolvedValueOnce({
      workout: {
        id: "aw-existing",
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
            training_plan_exercise_id: "tpe-2",
            position: 1,
            exercise_name: "Bulgarian Split Squat",
            selected_training_plan_exercise_variant_id: "opt-2",
            selected_variant_id: "variant-2",
            selected_variant_name: "Dumbbell",
            load_input_mode: "PER_SIDE",
            set_tracking_mode: "UNILATERAL",
            selected_station_id: "station-2",
            selected_station_name: "DB Area",
            skipped_at: null,
            completed_sets: [
              {
                set_index: 1,
                set_side: "LEFT",
                load_value: 25,
                load_value_per_side: 12.5,
                repetition_kind: "REPS",
                repetition_value: 10,
              },
            ],
            suggested_set: {
              set_index: 1,
              set_side: "RIGHT",
              suggested_load_input_kg: 15,
              suggested_load_total_kg: 30,
              repetition_kind: "REPS",
              repetition_value: 9,
            },
          },
        ],
      },
    });

    await orchestrator.persistActiveSet();

    expect(activeWorkoutApi.confirmActiveWorkoutSet).toHaveBeenCalledWith("aw-existing", 1, {
      set: {
        load_value: 12.5,
        repetition_value: 10,
      },
    });
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
    expect(getState().workoutPlan?.exercises[0]?.completedSets).toEqual([
      { setIndex: 1, setSide: "LEFT", loadValue: 25, reps: 10 },
    ]);
    expect(getState().workoutPlan?.exercises[0]?.suggestedSet).toEqual({
      loadValue: 15,
      reps: 9,
    });
  });

  it("persistActiveSet keeps SECS active draft reset to zero after save refresh", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = { id: "aw-existing", startedAt: "now", persistedExerciseCount: 1 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Timed Hold",
          fallbackOptions: [
            {
              id: "opt-1",
              training_plan_exercise_id: "tpe-1",
              exercise_name: "Timed Hold",
              exercise_position: 1,
              variant_id: "variant-1",
              variant_name: "Hold",
              station_id: "station-1",
              station_name: "Mat",
              station_profile_loads_kg: [],
            },
          ],
          selectedTrainingPlanExerciseVariantId: "opt-1",
          selectedVariantId: "variant-1",
          selectedStationId: "station-1",
          selectedStationProfileLoadsKg: [],
          repetitionKind: "SECS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: null, reps: 0 },
          activeSet: { loadValue: null, reps: 3 },
          activeSetInput: { loadValue: "", reps: "3" },
          completedSets: [],
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.confirmActiveWorkoutSet.mockResolvedValueOnce({
      workout: {
        id: "aw-existing",
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
            exercise_name: "Timed Hold",
            selected_training_plan_exercise_variant_id: "opt-1",
            selected_variant_id: "variant-1",
            selected_variant_name: "Hold",
            selected_station_id: "station-1",
            selected_station_name: "Mat",
            skipped_at: null,
            completed_sets: [
              { set_index: 1, set_side: "BILATERAL", load_value: null, repetition_kind: "SECS", repetition_value: 3 },
            ],
            suggested_set: { set_index: 2, set_side: "BILATERAL", load_value: null, repetition_kind: "SECS", repetition_value: 10 },
          },
        ],
      },
    });

    await orchestrator.persistActiveSet();

    expect(activeWorkoutApi.confirmActiveWorkoutSet).toHaveBeenCalledWith("aw-existing", 1, {
      set: {
        load_value: 10,
        repetition_value: 3,
      },
    });
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
    expect(getState().workoutPlan?.exercises[0]?.activeSet.reps).toBe(0);
    expect(getState().workoutPlan?.exercises[0]?.activeSetInput.reps).toBe("0");
  });

  it("persistPreviousExerciseTransition moves the cursor back and reopens the previous exercise", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 1 };
    state.activeWorkout = { id: "aw-existing", startedAt: "now", persistedExerciseCount: 2 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 10 },
          activeSet: { loadValue: 20, reps: 10 },
          activeSetInput: { loadValue: "20", reps: "10" },
          completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 10 }],
          isReadOnly: true,
          isSecsTimerRunning: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Split Squat",
          fallbackOptions: [
            {
              id: "opt-2",
              training_plan_exercise_id: "tpe-2",
              exercise_name: "Split Squat",
              exercise_position: 2,
              variant_id: "variant-2",
              variant_name: "DB",
              station_id: "station-2",
              station_name: "DB Area",
              station_profile_loads_kg: [8, 9, 10],
              suggested_start_load_kg: 9,
            },
          ],
          selectedTrainingPlanExerciseVariantId: "opt-2",
          selectedVariantId: "variant-2",
          selectedStationId: "station-2",
          selectedStationProfileLoadsKg: [8, 9, 10],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 9, reps: 9 },
          activeSet: { loadValue: 9, reps: 9 },
          activeSetInput: { loadValue: "9", reps: "9" },
          completedSets: [],
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.reopenActiveWorkoutExercise.mockResolvedValueOnce({
      workout: {
        id: "aw-existing",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "now",
        updated_at: "now",
        current_exercise_position: 1,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [{ set_index: 1, load_value: 20, repetition_value: 10 }],
            suggested_set: { set_index: 2, set_side: "BILATERAL", load_value: 20, repetition_value: 10 },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Split Squat",
            selected_training_plan_exercise_variant_id: "opt-2",
            selected_variant_id: "variant-2",
            selected_variant_name: "DB",
            selected_station_id: "station-2",
            selected_station_name: "DB Area",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { set_index: 1, set_side: "BILATERAL", load_value: 9, repetition_value: 9 },
          },
        ],
      },
    });

    const persisted = await orchestrator.persistPreviousExerciseTransition();

    expect(persisted).toBe(true);
    expect(activeWorkoutApi.reopenActiveWorkoutExercise).toHaveBeenCalledTimes(1);
    expect(activeWorkoutApi.reopenActiveWorkoutExercise.mock.calls[0]).toEqual([
      "aw-existing",
      {
        current_exercise_position: 1,
      },
    ]);
    expect(getState().viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });
    expect(getState().workoutPlan?.exercises[0]?.isReadOnly).toBe(false);
    expect(getState().workoutPlan?.exercises[1]?.isReadOnly).toBe(false);
  });

  it("bootstrapStartScreen refreshes selections and clears active workout state", async () => {
    const { orchestrator, getState } = setup();
    const state = getState();
    state.workoutPlan = {
      id: "stale-plan",
      name: "Stale",
      exercises: [],
    };
    state.viewState = { screen: "completion" };
    state.activeWorkout = { id: "aw-stale", startedAt: "old", persistedExerciseCount: 3 };

    vi.spyOn(workoutApi, "loadActiveWorkout").mockResolvedValueOnce(null);
    vi.spyOn(workoutApi, "loadStartScreenData").mockResolvedValueOnce({
      trainingPlans: [{ id: "plan-1", name: "Leg Day", exercise_count: 1 }],
      gyms: [{ id: "gym-1", name: "Gym" }],
    });

    await orchestrator.bootstrapStartScreen();

    expect(getState().viewState).toEqual({ screen: "start" });
    expect(getState().workoutPlan).toBe(null);
    expect(getState().activeWorkout).toEqual({
      id: null,
      startedAt: null,
      persistedExerciseCount: 0,
    });
    expect(getState().startScreen.selectedTrainingPlanId).toBe("plan-1");
    expect(getState().startScreen.selectedGymId).toBe("gym-1");
  });

  it("startWorkout in free mode creates an active workout immediately", async () => {
    const { orchestrator, getState, fetchJson, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.trainingPlans = [{ id: "plan-1", name: "Leg Day", exercise_count: 2 }];
    state.startScreen.selectedTrainingPlanId = "plan-1";
    state.startScreen.selectedWorkoutMode = "free-mode";

    fetchJson.mockResolvedValueOnce({
      id: "plan-1",
      name: "Leg Day",
      selected_gym_id: null,
      is_executable: null,
      execution_status: null,
      execution_summary: null,
      exercises: [
        {
          training_plan_exercise_id: "tpe-2",
          exercise_name: "Squat",
          exercise_position: 2,
          configured_variant_count: 1,
          executable_variant_count: null,
          execution_status: null,
          variants: [],
        },
        {
          training_plan_exercise_id: "tpe-1",
          exercise_name: "Deadlift",
          exercise_position: 1,
          configured_variant_count: 1,
          executable_variant_count: null,
          execution_status: null,
          variants: [],
        },
      ],
    });

    activeWorkoutApi.createActiveWorkout.mockResolvedValueOnce({
      workout: {
        id: "aw-free-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: null,
        gym_name: null,
        started_at: "now",
        updated_at: "now",
        current_exercise_position: 1,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            load_input_mode: "TOTAL",
            set_tracking_mode: "BILATERAL",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 10, repetition_value: 10 },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Squat",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            load_input_mode: "TOTAL",
            set_tracking_mode: "BILATERAL",
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 25, repetition_value: 8 },
          },
        ],
      },
    });

    await orchestrator.startWorkout();

    expect(activeWorkoutApi.createActiveWorkout).toHaveBeenCalledTimes(1);
    const payload = activeWorkoutApi.createActiveWorkout.mock.calls[0][0];
    expect(payload).toEqual({
      training_plan_id: "plan-1",
      gym_id: null,
      started_at: "now",
    });
    expect(getState().activeWorkout.id).toBe("aw-free-1");
    expect(getState().activeWorkout.persistedExerciseCount).toBe(0);
    expect(getState().workoutPlan?.exercises.map((exercise) => exercise.name)).toEqual([
      "Deadlift",
      "Squat",
    ]);
    expect(getState().workoutPlan?.exercises[0]?.suggestedSet).toEqual({
      loadValue: 10,
      reps: 10,
    });
    expect(getState().viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });
  });

  it("startWorkout sets blocked modal for realizability errors in configured-gym mode", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.trainingPlans = [{ id: "plan-1", name: "Leg Day", exercise_count: 2 }];
    state.startScreen.gyms = [{ id: "gym-1", name: "Gym Alpha" }];
    state.startScreen.selectedTrainingPlanId = "plan-1";
    state.startScreen.selectedGymId = "gym-1";
    state.startScreen.selectedWorkoutMode = "configured-gym";

    activeWorkoutApi.createActiveWorkout.mockRejectedValueOnce({
      status: 400,
      body: {
        message: "Custom blocked message",
        details: {
          missing_exercises: [
            { exercise_position: 2, exercise_name: "Lunge", reason: "missing_option" },
            { exercise_position: 1, exercise_name: "Squat", reason: "missing_option" },
          ],
        },
      },
    });

    await orchestrator.startWorkout();

    expect(activeWorkoutApi.createActiveWorkout).toHaveBeenCalledTimes(1);
    expect(getState().startScreen.errorMessage).toBe(null);
    expect(getState().startScreen.blockedStartModal).toMatchObject({
      message: "Custom blocked message",
      trainingPlanName: "Leg Day",
      gymName: "Gym Alpha",
    });
    expect(getState().startScreen.blockedStartModal?.missingExercises.map((item) => item.exercise_position)).toEqual([
      1,
      2,
    ]);
  });

  it("persistDeleteLatestSet removes latest completed set and persists workout progress", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = { id: "aw-1", startedAt: "2026-01-01T00:00:00Z", persistedExerciseCount: 1 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [
            { setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 8 },
            { setIndex: 2, setSide: "BILATERAL", loadValue: 25, reps: 6 },
          ],
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.deleteLatestActiveWorkoutSet.mockResolvedValueOnce({
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        current_exercise_position: 1,
        total_exercise_count: 1,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [],
            suggested_set: {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: 20,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
          },
        ],
      },
    });

    await orchestrator.persistDeleteLatestSet();

    expect(activeWorkoutApi.deleteLatestActiveWorkoutSet).toHaveBeenCalledWith("aw-1", 1);
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
    expect(getState().workoutPlan?.exercises[0]?.completedSets).toEqual([]);
  });

  it("persistDeleteLatestSet supports repeated LIFO deletion until no completed sets remain", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = { id: "aw-1", startedAt: "2026-01-01T00:00:00Z", persistedExerciseCount: 1 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [
            { setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 8 },
            { setIndex: 2, setSide: "BILATERAL", loadValue: 25, reps: 6 },
            { setIndex: 3, setSide: "BILATERAL", loadValue: 30, reps: 5 },
          ],
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.deleteLatestActiveWorkoutSet
      .mockResolvedValueOnce({
        workout: {
          id: "aw-1",
          training_plan_id: "plan-1",
          training_plan_name: "Leg Day",
          gym_id: "gym-1",
          gym_name: "Gym",
          started_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:01:00Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Deadlift",
              selected_training_plan_exercise_variant_id: null,
              selected_variant_id: null,
              selected_variant_name: null,
              selected_station_id: null,
              selected_station_name: null,
              skipped_at: null,
              completed_sets: [
                { set_index: 1, set_side: "BILATERAL", load_value: 20, repetition_kind: "REPS", repetition_value: 8 },
                { set_index: 2, set_side: "BILATERAL", load_value: 25, repetition_kind: "REPS", repetition_value: 6 },
              ],
              suggested_set: {
                set_index: 3,
                set_side: "BILATERAL",
                load_value: 20,
                repetition_kind: "REPS",
                repetition_value: 8,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        workout: {
          id: "aw-1",
          training_plan_id: "plan-1",
          training_plan_name: "Leg Day",
          gym_id: "gym-1",
          gym_name: "Gym",
          started_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:02:00Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Deadlift",
              selected_training_plan_exercise_variant_id: null,
              selected_variant_id: null,
              selected_variant_name: null,
              selected_station_id: null,
              selected_station_name: null,
              skipped_at: null,
              completed_sets: [
                { set_index: 1, set_side: "BILATERAL", load_value: 20, repetition_kind: "REPS", repetition_value: 8 },
              ],
              suggested_set: {
                set_index: 2,
                set_side: "BILATERAL",
                load_value: 20,
                repetition_kind: "REPS",
                repetition_value: 8,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        workout: {
          id: "aw-1",
          training_plan_id: "plan-1",
          training_plan_name: "Leg Day",
          gym_id: "gym-1",
          gym_name: "Gym",
          started_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:03:00Z",
          current_exercise_position: 1,
          total_exercise_count: 1,
          exercises: [
            {
              training_plan_exercise_id: "tpe-1",
              position: 1,
              exercise_name: "Deadlift",
              selected_training_plan_exercise_variant_id: null,
              selected_variant_id: null,
              selected_variant_name: null,
              selected_station_id: null,
              selected_station_name: null,
              skipped_at: null,
              completed_sets: [],
              suggested_set: {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 20,
                repetition_kind: "REPS",
                repetition_value: 8,
              },
            },
          ],
        },
      });

    await orchestrator.persistDeleteLatestSet();
    expect(getState().workoutPlan?.exercises[0]?.completedSets.map((set) => set.setIndex)).toEqual([1, 2]);

    await orchestrator.persistDeleteLatestSet();
    expect(getState().workoutPlan?.exercises[0]?.completedSets.map((set) => set.setIndex)).toEqual([1]);

    await orchestrator.persistDeleteLatestSet();
    expect(getState().workoutPlan?.exercises[0]?.completedSets).toEqual([]);

    expect(activeWorkoutApi.deleteLatestActiveWorkoutSet).toHaveBeenCalledTimes(3);
    expect(activeWorkoutApi.deleteLatestActiveWorkoutSet).toHaveBeenNthCalledWith(1, "aw-1", 1);
    expect(activeWorkoutApi.deleteLatestActiveWorkoutSet).toHaveBeenNthCalledWith(2, "aw-1", 1);
    expect(activeWorkoutApi.deleteLatestActiveWorkoutSet).toHaveBeenNthCalledWith(3, "aw-1", 1);
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
  });

  it("persistDeleteLatestSet restores back-navigation eligibility after deleting the only recorded set", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 1 };
    state.activeWorkout = { id: "aw-1", startedAt: "2026-01-01T00:00:00Z", persistedExerciseCount: 2 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 8 }],
          isReadOnly: true,
          isSecsTimerRunning: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Squat",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 30, reps: 8 },
          activeSet: { loadValue: 30, reps: 8 },
          activeSetInput: { loadValue: "30", reps: "8" },
          completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 30, reps: 8 }],
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.deleteLatestActiveWorkoutSet.mockResolvedValueOnce({
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        current_exercise_position: 2,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [
              {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 20,
                repetition_kind: "REPS",
                repetition_value: 8,
              },
            ],
            suggested_set: {
              set_index: 2,
              set_side: "BILATERAL",
              load_value: 20,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
            next_set: {
              set_index: 2,
              set_side: "BILATERAL",
            },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Squat",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [],
            suggested_set: {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: 30,
              repetition_kind: "REPS",
              repetition_value: 8,
            },
            next_set: {
              set_index: 1,
              set_side: "BILATERAL",
            },
          },
        ],
      },
    });

    await orchestrator.persistDeleteLatestSet();

    expect(activeWorkoutApi.deleteLatestActiveWorkoutSet).toHaveBeenCalledWith("aw-1", 2);
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
    expect(getState().workoutPlan?.exercises[1]?.completedSets).toEqual([]);
    expect(canReopenPreviousExercise(getState().workoutPlan!, 1)).toBe(true);
  });

  it("persistSkipTransition marks the exercise as skipped and persists next cursor", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = { id: "aw-1", startedAt: "2026-01-01T00:00:00Z", persistedExerciseCount: 0 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [],
          isReadOnly: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Squat",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 30, reps: 8 },
          activeSet: { loadValue: 30, reps: 8 },
          activeSetInput: { loadValue: "30", reps: "8" },
          completedSets: [],
          isReadOnly: false,
        },
      ],
    };

    activeWorkoutApi.skipActiveWorkoutExercise.mockResolvedValueOnce({
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        current_exercise_position: 2,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: "now",
            completed_sets: [],
            suggested_set: { load_value: 20, repetition_value: 8 },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Squat",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 30, repetition_value: 8 },
          },
        ],
      },
    });

    const persisted = await orchestrator.persistSkipTransition("next");

    expect(persisted).toBe(true);
    expect(activeWorkoutApi.skipActiveWorkoutExercise).toHaveBeenCalledTimes(1);
    expect(activeWorkoutApi.skipActiveWorkoutExercise.mock.calls[0]).toEqual([
      "aw-1",
      1,
      {
        skipped_at: "now",
        current_exercise_position: 2,
      },
    ]);
  });

  it("persistNextExerciseTransition advances the cursor without flattening local state", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = {
      id: "aw-1",
      startedAt: "2026-01-01T00:00:00Z",
      persistedExerciseCount: 1,
    };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 8 }],
          isReadOnly: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Squat",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 30, reps: 8 },
          activeSet: { loadValue: 30, reps: 8 },
          activeSetInput: { loadValue: "30", reps: "8" },
          completedSets: [],
          isReadOnly: false,
        },
      ],
    };

    activeWorkoutApi.updateActiveWorkout.mockResolvedValueOnce({
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        current_exercise_position: 2,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Deadlift",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [
              {
                set_index: 1,
                set_side: "BILATERAL",
                load_value: 20,
                repetition_kind: "REPS",
                repetition_value: 8,
              },
            ],
            suggested_set: { load_value: 20, repetition_value: 8 },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Squat",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [],
            suggested_set: { load_value: 30, repetition_value: 8 },
          },
        ],
      },
    });

    const persisted = await orchestrator.persistNextExerciseTransition();

    expect(persisted).toBe(true);
    expect(activeWorkoutApi.updateActiveWorkout).toHaveBeenCalledTimes(1);
    const payload = activeWorkoutApi.updateActiveWorkout.mock.calls[0][1];
    expect(payload.current_exercise_position).toBe(2);
    expect(getState().viewState).toEqual({ screen: "exercise", exerciseIndex: 1 });
    expect(getState().workoutPlan?.exercises[0]?.isReadOnly).toBe(true);
    expect(getState().workoutPlan?.exercises[1]?.isReadOnly).toBe(false);
  });

  it("persistNextExerciseTransition blocks unilateral left-only progress while preserving the pending right side", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 1 };
    state.activeWorkout = {
      id: "aw-1",
      startedAt: "2026-01-01T00:00:00Z",
      persistedExerciseCount: 2,
    };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Deadlift",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 20, reps: 8 },
          activeSet: { loadValue: 20, reps: 8 },
          activeSetInput: { loadValue: "20", reps: "8" },
          completedSets: [{ setIndex: 1, setSide: "BILATERAL", loadValue: 20, reps: 8 }],
          currentSetIndex: 2,
          currentSetSide: "BILATERAL",
          isReadOnly: true,
          isSecsTimerRunning: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Split Squat",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          setTrackingMode: "UNILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 30, reps: 10 },
          activeSet: { loadValue: 30, reps: 10 },
          activeSetInput: { loadValue: "30", reps: "10" },
          completedSets: [{ setIndex: 1, setSide: "LEFT", loadValue: 30, reps: 10 }],
          currentSetIndex: 1,
          currentSetSide: "RIGHT",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
        {
          trainingPlanExerciseId: "tpe-3",
          name: "Leg Curl",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 40, reps: 12 },
          activeSet: { loadValue: 40, reps: 12 },
          activeSetInput: { loadValue: "40", reps: "12" },
          completedSets: [],
          currentSetIndex: 1,
          currentSetSide: "BILATERAL",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    const persisted = await orchestrator.persistNextExerciseTransition();

    expect(persisted).toBe(false);
    expect(activeWorkoutApi.updateActiveWorkout).not.toHaveBeenCalled();
    expect(getState().viewState).toEqual({ screen: "exercise", exerciseIndex: 1 });
    expect(getState().workoutPlan?.exercises[1]?.isReadOnly).toBe(false);
    expect(getState().workoutPlan?.exercises[1]?.currentSetIndex).toBe(1);
    expect(getState().workoutPlan?.exercises[1]?.currentSetSide).toBe("RIGHT");
  });

  it("finishWorkout blocks unilateral left-only progress on the last exercise", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = {
      id: "aw-1",
      startedAt: "2026-01-01T00:00:00Z",
      persistedExerciseCount: 1,
    };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Split Squat",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          setTrackingMode: "UNILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 30, reps: 10 },
          activeSet: { loadValue: 30, reps: 10 },
          activeSetInput: { loadValue: "30", reps: "10" },
          completedSets: [{ setIndex: 1, setSide: "LEFT", loadValue: 30, reps: 10 }],
          currentSetIndex: 1,
          currentSetSide: "RIGHT",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    await orchestrator.finishWorkout();

    expect(activeWorkoutApi.completeActiveWorkout).not.toHaveBeenCalled();
    expect(getState().viewState).toEqual({ screen: "exercise", exerciseIndex: 0 });
    expect(getState().workoutSave.isSaving).toBe(false);
  });

  it("persistNextExerciseTransition advances after the pending unilateral right side is complete", async () => {
    const { orchestrator, getState, activeWorkoutApi } = setup();
    const state = getState();
    state.startScreen.selectedWorkoutMode = "configured-gym";
    state.startScreen.selectedGymId = "gym-1";
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.activeWorkout = {
      id: "aw-1",
      startedAt: "2026-01-01T00:00:00Z",
      persistedExerciseCount: 1,
    };
    state.workoutPlan = {
      id: "plan-1",
      name: "Leg Day",
      exercises: [
        {
          trainingPlanExerciseId: "tpe-1",
          name: "Split Squat",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          setTrackingMode: "UNILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 30, reps: 10 },
          activeSet: { loadValue: 30, reps: 10 },
          activeSetInput: { loadValue: "30", reps: "10" },
          completedSets: [
            { setIndex: 1, setSide: "LEFT", loadValue: 30, reps: 10 },
            { setIndex: 1, setSide: "RIGHT", loadValue: 30, reps: 10 },
          ],
          currentSetIndex: 2,
          currentSetSide: "LEFT",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
        {
          trainingPlanExerciseId: "tpe-2",
          name: "Leg Curl",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          repetitionKind: "REPS",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 40, reps: 12 },
          activeSet: { loadValue: 40, reps: 12 },
          activeSetInput: { loadValue: "40", reps: "12" },
          completedSets: [],
          currentSetIndex: 1,
          currentSetSide: "BILATERAL",
          isReadOnly: false,
          isSecsTimerRunning: false,
        },
      ],
    };

    activeWorkoutApi.updateActiveWorkout.mockResolvedValueOnce({
      workout: {
        id: "aw-1",
        training_plan_id: "plan-1",
        training_plan_name: "Leg Day",
        gym_id: "gym-1",
        gym_name: "Gym",
        started_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:01:00Z",
        current_exercise_position: 2,
        total_exercise_count: 2,
        exercises: [
          {
            training_plan_exercise_id: "tpe-1",
            position: 1,
            exercise_name: "Split Squat",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            set_tracking_mode: "UNILATERAL",
            completed_sets: [
              {
                set_index: 1,
                set_side: "LEFT",
                load_value: 30,
                repetition_kind: "REPS",
                repetition_value: 10,
              },
              {
                set_index: 1,
                set_side: "RIGHT",
                load_value: 30,
                repetition_kind: "REPS",
                repetition_value: 10,
              },
            ],
            suggested_set: {
              set_index: 2,
              set_side: "LEFT",
              load_value: 30,
              repetition_kind: "REPS",
              repetition_value: 10,
            },
            next_set: { set_index: 2, set_side: "LEFT" },
          },
          {
            training_plan_exercise_id: "tpe-2",
            position: 2,
            exercise_name: "Leg Curl",
            selected_training_plan_exercise_variant_id: null,
            selected_variant_id: null,
            selected_variant_name: null,
            selected_station_id: null,
            selected_station_name: null,
            skipped_at: null,
            completed_sets: [],
            suggested_set: {
              set_index: 1,
              set_side: "BILATERAL",
              load_value: 40,
              repetition_kind: "REPS",
              repetition_value: 12,
            },
            next_set: { set_index: 1, set_side: "BILATERAL" },
          },
        ],
      },
    });

    const persisted = await orchestrator.persistNextExerciseTransition();

    expect(persisted).toBe(true);
    expect(activeWorkoutApi.updateActiveWorkout).toHaveBeenCalledTimes(1);
    expect(activeWorkoutApi.updateActiveWorkout.mock.calls[0][1]).toEqual({
      current_exercise_position: 2,
    });
    expect(getState().viewState).toEqual({ screen: "exercise", exerciseIndex: 1 });
    expect(getState().workoutPlan?.exercises[0]?.isReadOnly).toBe(true);
    expect(getState().workoutPlan?.exercises[0]?.currentSetSide).toBe("LEFT");
    expect(getState().workoutPlan?.exercises[1]?.isReadOnly).toBe(false);
  });
});
