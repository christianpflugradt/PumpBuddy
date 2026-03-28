import type { AppState } from "./workout-types";
import type { createWorkflowOrchestrator as _co } from "./workflow-orchestrator";
import {
  formatLoadInputValue,
  setExerciseReadOnly,
  normalizeExerciseActiveSet,
  stepWithinProfileLoads,
  shouldConfirmForwardNavigation,
} from "./workout-state";

// Register DOM listeners and route UI events to the orchestrator/controller.
export const registerAppInteraction = (options: {
  app: HTMLElement;
  getState: () => AppState;
  setState: (next: AppState) => void;
  render: () => void;
  orchestrator: ReturnType<typeof _co>;
  openConfirmDialog: (message: string, label: string, onConfirm: () => void | Promise<void>) => void;
  closeConfirmDialog: () => void;
  pulseUiFeedback: (key: keyof AppState["uiFeedback"]) => void;
}): (() => void) => {
  const { app, getState, setState, render, orchestrator, openConfirmDialog, closeConfirmDialog, pulseUiFeedback } = options;

  const navigateToPreviousExercise = (): void => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    if (state.viewState.exerciseIndex === 0) {
      return;
    }

    setState({
      ...state,
      viewState: {
        screen: "exercise",
        exerciseIndex: state.viewState.exerciseIndex - 1,
      },
    });
    render();
  };

  const navigateToNextExercise = (): void => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const nextExerciseIndex = state.viewState.exerciseIndex + 1;

    setState({
      ...state,
      workoutPlan: setExerciseReadOnly(state.workoutPlan, state.viewState.exerciseIndex, true),
      viewState: {
        screen: "exercise",
        exerciseIndex: nextExerciseIndex,
      },
    });
    render();
  };

  const navigateToCurrentExercise = (): void => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const currentExerciseIndex = state.workoutPlan.exercises.findIndex((exercise) => !exercise.isReadOnly);
    if (currentExerciseIndex < 0 || currentExerciseIndex === state.viewState.exerciseIndex) {
      return;
    }

    setState({
      ...state,
      viewState: {
        screen: "exercise",
        exerciseIndex: currentExerciseIndex,
      },
    });
    render();
  };

  const requestNextExerciseNavigation = (): void => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const exerciseStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!exerciseStep) {
      return;
    }

    if (shouldConfirmForwardNavigation(exerciseStep)) {
      openConfirmDialog(
        "Move to the next exercise? This draft set will not be saved.",
        "Skip Exercise",
        async () => {
          const persisted = await orchestrator.persistSkipTransition("next");
          if (persisted) {
            navigateToNextExercise();
          }
        },
      );
      return;
    }

    closeConfirmDialog();
    navigateToNextExercise();
  };

  const requestFinishWorkout = (): void => {
    const state = getState();
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
      openConfirmDialog(
        "Finish this workout? This draft set will not be saved.",
        "Finish Workout",
        async () => {
          const persisted = await orchestrator.persistSkipTransition("finish");
          if (persisted) {
            await orchestrator.finishWorkout();
          }
        },
      );
      return;
    }

    void orchestrator.finishWorkout();
  };

  const persistActiveSetRequest = (): void => {
    void orchestrator.persistActiveSet();
  };

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const state = getState();
    const action = target.dataset.action;

    if (action === "start-workout") {
      void orchestrator.startWorkout();
      return;
    }

    if (action === "dismiss-start-blocked-modal") {
      if (state.viewState.screen !== "start") {
        return;
      }

      setState({
        ...state,
        startScreen: {
          ...state.startScreen,
          blockedStartModal: null,
        },
      });
      render();
      return;
    }

    if (action === "return-to-start") {
      if (state.viewState.screen !== "completion") {
        return;
      }

      setState({
        ...state,
        workoutPlan: null,
        viewState: { screen: "start" },
        completion: {
          startedAt: null,
          completedAt: null,
        },
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
      });
      render();
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
    const isStationlessSelectedOption =
      currentStep.selectedPlanExerciseOptionId !== null && currentStep.selectedStationId === null;

    if (action === "decrement-load") {
      if (currentStep.isReadOnly || isStationlessSelectedOption) {
        return;
      }
      const currentLoadValue = currentStep.activeSet.loadValue;
      if (currentLoadValue === null) {
        return;
      }
      currentStep.activeSet.loadValue =
        state.startScreen.selectedWorkoutMode === "configured-gym"
          ? (stepWithinProfileLoads(
              currentStep.selectedStationProfileLoadsKg,
              currentLoadValue,
              "decrease",
            ) ?? currentLoadValue)
          : Math.max(0, currentLoadValue - 1);
      currentStep.activeSetInput.loadValue = formatLoadInputValue(currentStep.activeSet.loadValue);
      pulseUiFeedback("loadTickToken");
      return;
    }

    if (action === "increment-load") {
      if (currentStep.isReadOnly || isStationlessSelectedOption) {
        return;
      }
      const currentLoadValue = currentStep.activeSet.loadValue;
      if (currentLoadValue === null) {
        return;
      }
      currentStep.activeSet.loadValue =
        state.startScreen.selectedWorkoutMode === "configured-gym"
          ? (stepWithinProfileLoads(
              currentStep.selectedStationProfileLoadsKg,
              currentLoadValue,
              "increase",
            ) ?? currentLoadValue)
          : currentLoadValue + 1;
      currentStep.activeSetInput.loadValue = formatLoadInputValue(currentStep.activeSet.loadValue);
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
      if (currentStep.isReadOnly || !currentStep.isFallbackOptionConfirmed) {
        return;
      }
      void orchestrator.persistActiveSet();
      return;
    }

    if (action === "confirm-fallback-option") {
      const selectedOptionKey =
        currentStep.selectedPlanExerciseOptionId === null
          ? null
          : `${currentStep.selectedPlanExerciseOptionId}::${currentStep.selectedStationId ?? ""}`;
      void orchestrator.persistFallbackSelection(selectedOptionKey);
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

    if (action === "jump-to-current-exercise") {
      navigateToCurrentExercise();
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
  };

  const onChange = (event: Event): void => {
    const target = event.target;
    const state = getState();
    if (target instanceof HTMLInputElement && target.dataset.action === "select-workout-mode") {
      if (state.viewState.screen !== "start") {
        return;
      }

      if (target.value !== "configured-gym" && target.value !== "free-mode") {
        return;
      }
      setState({
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedWorkoutMode: target.value,
          errorMessage: null,
          blockedStartModal: null,
        },
      });
      render();
      return;
    }

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    if (state.viewState.screen === "exercise" && target.dataset.action === "switch-fallback-option") {
      orchestrator.selectFallbackOption(target.value || null);
      return;
    }

    if (state.viewState.screen !== "start") {
      return;
    }

    if (target.dataset.action === "select-training-plan") {
      setState({
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedTrainingPlanId: target.value,
          errorMessage: null,
          blockedStartModal: null,
        },
      });
      render();
      return;
    }

    if (target.dataset.action === "select-gym") {
      setState({
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedGymId: target.value,
          errorMessage: null,
          blockedStartModal: null,
        },
      });
      render();
    }
  };

  const onInput = (event: Event): void => {
    const target = event.target;
    const state = getState();
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
      if (currentStep.selectedPlanExerciseOptionId !== null && currentStep.selectedStationId === null) {
        currentStep.activeSet.loadValue = null;
        currentStep.activeSetInput.loadValue = "";
        return;
      }
      currentStep.activeSetInput.loadValue = nextValue;

      if (/^\d+$/.test(nextValue)) {
        currentStep.activeSet.loadValue = Number(nextValue);
      }
      return;
    }

    if (target.dataset.action === "reps-input") {
      currentStep.activeSetInput.reps = nextValue;

      if (/^\d+$/.test(nextValue)) {
        currentStep.activeSet.reps = Math.max(1, Number(nextValue));
      }
    }
  };

  const onFocusOut = (event: Event): void => {
    const target = event.target;
    const state = getState();
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

    normalizeExerciseActiveSet(currentStep, state.startScreen.selectedWorkoutMode);
    render();
  };

  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("input", onInput);
  app.addEventListener("focusout", onFocusOut);

  return () => {
    app.removeEventListener("click", onClick);
    app.removeEventListener("change", onChange);
    app.removeEventListener("input", onInput);
    app.removeEventListener("focusout", onFocusOut);
  };
};
