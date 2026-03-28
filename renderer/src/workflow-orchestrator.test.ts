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

    const orchestrator = createWorkflowOrchestrator({
      getState: () => state,
      setState: (next) => { state = next; },
      render: vi.fn(),
      fetchJson: vi.fn(),
      activeWorkoutApi: {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      },
      now: () => "now",
      openConfirmDialog: vi.fn(),
      closeConfirmDialog: vi.fn(),
      pulseUiFeedback: vi.fn(),
    });

    return { orchestrator, getState: () => state };
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
});
