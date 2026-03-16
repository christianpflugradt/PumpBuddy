import type {
  AppState,
  TrainingPlanOptionsResponse,
  WorkoutPlan,
} from "./workout-types";
import {
  createActiveWorkoutApi,
  createFetchJson,
  loadActiveWorkout,
  loadStartScreenData,
  type ActiveWorkoutApi,
  type FetchJson,
} from "./workout-api";
import {
  applyActiveWorkoutResponse,
  buildActiveWorkoutProgressPayload,
  buildWorkoutPlan,
  buildWorkoutPlanFromActiveWorkout,
  canStartWorkout,
  countPersistedExercises,
  createInitialStartScreenState,
  getNextViewState,
  isDigitsOnly,
  normalizeExerciseActiveSet,
  setExerciseReadOnly,
  shouldConfirmForwardNavigation,
  withCurrentSetCompleted,
} from "./workout-state";
import {
  renderCompletionScreen,
  renderExerciseScreen,
  renderStartScreen,
} from "./workout-render";
import { createWorkflowOrchestrator } from "./workflow-orchestrator";

const forwardNavigationConfirmationMessage =
  "Move to the next exercise? This draft set will not be saved.";
const finishWorkoutConfirmationMessage = "Finish this workout? This draft set will not be saved.";
const workoutSaveRecoveryMessage =
  "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.";
const uiFeedbackResetDelayMs = 220;

export const createApp = (
  app: HTMLElement,
  fetchJson: FetchJson = createFetchJson(),
  activeWorkoutApi: ActiveWorkoutApi = createActiveWorkoutApi(),
  now: () => string = () => new Date().toISOString(),
): void => {
  let state: AppState = {
    startScreen: createInitialStartScreenState(),
    workoutPlan: null,
    viewState: { screen: "start" },
    confirmDialog: {
      message: null,
      confirmActionLabel: null,
      onConfirm: null,
    },
    activeWorkout: {
      id: null,
      startedAt: null,
      persistedExerciseCount: 0,
    },
    workoutSave: {
      isSaving: false,
      errorMessage: null,
    },
    uiFeedback: {
      completedSetPulseToken: 0,
      loadTickToken: 0,
      repsTickToken: 0,
    },
  };

  const render = (): void => {
    if (state.viewState.screen === "start") {
      app.innerHTML = renderStartScreen(state.startScreen);
      return;
    }

    if (!state.workoutPlan) {
      app.innerHTML = renderStartScreen({
        ...state.startScreen,
        errorMessage: "Unable to render the workout plan.",
      });
      return;
    }

    if (state.viewState.screen === "completion") {
      app.innerHTML = renderCompletionScreen(state.workoutPlan);
      return;
    }

    app.innerHTML = renderExerciseScreen(
      state.workoutPlan,
      state.viewState.exerciseIndex,
      state.confirmDialog,
      state.activeWorkout,
      state.workoutSave,
      state.uiFeedback,
    );
  };

  const pulseUiFeedback = (key: keyof AppState["uiFeedback"]): void => {
    const nextToken = state.uiFeedback[key] + 1;
    state = {
      ...state,
      uiFeedback: {
        ...state.uiFeedback,
        [key]: nextToken,
      },
    };
    render();

    window.setTimeout(() => {
      if (state.uiFeedback[key] !== nextToken) {
        return;
      }

      state = {
        ...state,
        uiFeedback: {
          ...state.uiFeedback,
          [key]: 0,
        },
      };
      render();
    }, uiFeedbackResetDelayMs);
  };

  const closeConfirmDialog = (): void => {
    if (!state.confirmDialog.message && !state.confirmDialog.onConfirm) {
      return;
    }

    state = {
      ...state,
      confirmDialog: {
        message: null,
        confirmActionLabel: null,
        onConfirm: null,
      },
    };
  };

  const openConfirmDialog = (
    message: string,
    confirmActionLabel: string,
    onConfirm: () => void | Promise<void>,
  ): void => {
    state = {
      ...state,
      confirmDialog: {
        message,
        confirmActionLabel,
        onConfirm,
      },
    };
    render();
  };

  // Orchestrator will own workflow transitions (start, save, resume, complete, cancel).
  // Create it here and expose its methods for UI event handlers to call.
  const orchestrator = createWorkflowOrchestrator({
    getState: () => state,
    setState: (next: AppState) => {
      state = next;
    },
    render,
    fetchJson,
    activeWorkoutApi,
    now,
    openConfirmDialog,
    closeConfirmDialog,
    pulseUiFeedback,
  });

  // Orchestrator-provided methods will be called from UI event handlers below.

  const loadStartScreenSelections = async (): Promise<void> => {
    const { trainingPlans, gyms } = await loadStartScreenData(fetchJson);

    state = {
      ...state,
      workoutPlan: null,
      viewState: { screen: "start" },
      confirmDialog: {
        message: null,
        confirmActionLabel: null,
        onConfirm: null,
      },
      startScreen: {
        ...state.startScreen,
        isLoading: false,
        isStarting: false,
        errorMessage: null,
        trainingPlans,
        gyms,
        selectedTrainingPlanId: trainingPlans[0]?.id ?? "",
        selectedGymId: gyms[0]?.id ?? "",
      },
      activeWorkout: {
        id: null,
        startedAt: null,
        persistedExerciseCount: 0,
      },
      workoutSave: {
        isSaving: false,
        errorMessage: null,
      },
      uiFeedback: {
        completedSetPulseToken: 0,
        loadTickToken: 0,
        repsTickToken: 0,
      },
    };
  };

  const bootstrapStartScreen = async (): Promise<void> => {
    try {
      const activeWorkoutResponse = await loadActiveWorkout(fetchJson);

      if (activeWorkoutResponse) {
        const optionsResponse = await fetchJson<TrainingPlanOptionsResponse>(
          `/api/training-plans/${activeWorkoutResponse.workout.training_plan_id}/options?gymId=${encodeURIComponent(
            activeWorkoutResponse.workout.gym_id,
          )}`,
        );
        const workoutPlan = buildWorkoutPlanFromActiveWorkout(activeWorkoutResponse, optionsResponse);
        workoutPlan.exercises.forEach((exercise, index) => {
          exercise.isReadOnly = index < activeWorkoutResponse.workout.current_exercise_position - 1;
        });

        state = {
          ...state,
          workoutPlan,
          viewState: {
            screen: "exercise",
            exerciseIndex: activeWorkoutResponse.workout.current_exercise_position - 1,
          },
          confirmDialog: {
            message: null,
            confirmActionLabel: null,
            onConfirm: null,
          },
          startScreen: {
            ...state.startScreen,
            isLoading: false,
            errorMessage: null,
            selectedTrainingPlanId: activeWorkoutResponse.workout.training_plan_id,
            selectedGymId: activeWorkoutResponse.workout.gym_id,
          },
          activeWorkout: {
            id: activeWorkoutResponse.workout.id,
            startedAt: activeWorkoutResponse.workout.started_at,
            persistedExerciseCount: countPersistedExercises(activeWorkoutResponse),
          },
          workoutSave: {
            isSaving: false,
            errorMessage: null,
          },
          uiFeedback: {
            completedSetPulseToken: 0,
            loadTickToken: 0,
            repsTickToken: 0,
          },
        };
      } else {
        try {
          const { trainingPlans, gyms } = await loadStartScreenData(fetchJson);
          state = {
            ...state,
            startScreen: {
              ...state.startScreen,
              isLoading: false,
              errorMessage: null,
              trainingPlans,
              gyms,
              selectedTrainingPlanId: trainingPlans[0]?.id ?? "",
              selectedGymId: gyms[0]?.id ?? "",
            },
          };
        } catch {
          state = {
            ...state,
            startScreen: {
              ...state.startScreen,
              isLoading: false,
              errorMessage: "Unable to load start selections. Refresh and try again.",
            },
          };
        }
      }
    } catch {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          isLoading: false,
          errorMessage: "Unable to load start selections. Refresh and try again.",
        },
      };
    }

    render();
  };

  const navigateToPreviousExercise = (): void => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    if (state.viewState.exerciseIndex === 0) {
      return;
    }

    state = {
      ...state,
      viewState: {
        screen: "exercise",
        exerciseIndex: state.viewState.exerciseIndex - 1,
      },
    };
    render();
  };

  const navigateToNextExercise = (): void => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const nextExerciseIndex = state.viewState.exerciseIndex + 1;

    state = {
      ...state,
      workoutPlan: setExerciseReadOnly(state.workoutPlan, state.viewState.exerciseIndex, true),
      viewState: {
        screen: "exercise",
        exerciseIndex: nextExerciseIndex,
      },
    };
    render();
  };

  const requestNextExerciseNavigation = (): void => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const exerciseStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!exerciseStep) {
      return;
    }

    if (shouldConfirmForwardNavigation(exerciseStep)) {
      openConfirmDialog(
        forwardNavigationConfirmationMessage,
        "Skip Exercise",
        navigateToNextExercise,
      );
      return;
    }

    closeConfirmDialog();
    navigateToNextExercise();
  };

  // requestFinishWorkout and requestNextExerciseNavigation remain in controller since they affect presentation
  const requestFinishWorkout = (): void => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const currentExercisePosition = state.viewState.exerciseIndex + 1;
    if (currentExercisePosition !== state.workoutPlan.exercises.length) {
      return;
    }

    const exerciseStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!exerciseStep) {
      return;
    }

    if (shouldConfirmForwardNavigation(exerciseStep)) {
      openConfirmDialog(finishWorkoutConfirmationMessage, "Finish Workout", orchestrator.finishWorkout);
      return;
    }

    void orchestrator.finishWorkout();
  };

  const persistActiveSetRequest = (): void => {
    void orchestrator.persistActiveSet();
  };

  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;

    if (action === "start-workout") {
      void orchestrator.startWorkout();
      return;
    }

    if (action === "confirm-dialog-dismiss") {
      if (!state.workoutSave.isSaving) {
        closeConfirmDialog();
        render();
      }
      return;
    }

    if (action === "confirm-dialog-confirm") {
      if (state.workoutSave.isSaving) {
        return;
      }

      const onConfirm = state.confirmDialog.onConfirm;
      if (!onConfirm) {
        return;
      }

      closeConfirmDialog();
      render();
      void onConfirm();
      return;
    }

    if (state.confirmDialog.message) {
      return;
    }

    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!currentStep) {
      return;
    }

    if (action === "decrement-load") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.loadValue = Math.max(0, currentStep.activeSet.loadValue - 1);
      currentStep.activeSetInput.loadValue = String(currentStep.activeSet.loadValue);
      pulseUiFeedback("loadTickToken");
      return;
    }

    if (action === "increment-load") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.loadValue += 1;
      currentStep.activeSetInput.loadValue = String(currentStep.activeSet.loadValue);
      pulseUiFeedback("loadTickToken");
      return;
    }

    if (action === "decrement-reps") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.reps = Math.max(1, currentStep.activeSet.reps - 1);
      currentStep.activeSetInput.reps = String(currentStep.activeSet.reps);
      pulseUiFeedback("repsTickToken");
      return;
    }

    if (action === "increment-reps") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.reps += 1;
      currentStep.activeSetInput.reps = String(currentStep.activeSet.reps);
      pulseUiFeedback("repsTickToken");
      return;
    }

    if (action === "next-set") {
      if (currentStep.isReadOnly) {
        return;
      }
      void orchestrator.persistActiveSet();
      return;
    }

    if (action === "previous-exercise") {
      navigateToPreviousExercise();
      return;
    }

    if (action === "next-exercise") {
      requestNextExerciseNavigation();
      return;
    }

    if (action === "finish-workout") {
      requestFinishWorkout();
      return;
    }

    if (action === "cancel-workout") {
      openConfirmDialog(
        "Cancel this workout? Your unfinished workout data will be deleted.",
        "Cancel Workout",
        orchestrator.cancelWorkout,
      );
    }
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || state.viewState.screen !== "start") {
      return;
    }

    if (target.dataset.action === "select-training-plan") {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedTrainingPlanId: target.value,
          errorMessage: null,
        },
      };
      render();
      return;
    }

    if (target.dataset.action === "select-gym") {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedGymId: target.value,
          errorMessage: null,
        },
      };
      render();
    }
  });

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (state.viewState.screen !== "exercise" || !state.workoutPlan) {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!currentStep || currentStep.isReadOnly) {
      return;
    }

    const nextValue = target.value.trim();

    if (target.dataset.action === "load-input") {
      currentStep.activeSetInput.loadValue = nextValue;

      if (isDigitsOnly(nextValue)) {
        currentStep.activeSet.loadValue = Number(nextValue);
      }
      return;
    }

    if (target.dataset.action === "reps-input") {
      currentStep.activeSetInput.reps = nextValue;

      if (isDigitsOnly(nextValue)) {
        currentStep.activeSet.reps = Math.max(1, Number(nextValue));
      }
    }
  });

  app.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (state.viewState.screen !== "exercise" || !state.workoutPlan) {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!currentStep || currentStep.isReadOnly) {
      return;
    }

    if (target.dataset.action !== "load-input" && target.dataset.action !== "reps-input") {
      return;
    }

    normalizeExerciseActiveSet(currentStep);
    render();
  });

  render();
  // bootstrap start screen (use controller-level wrapper to ensure test behavior)
  void bootstrapStartScreen();
};
