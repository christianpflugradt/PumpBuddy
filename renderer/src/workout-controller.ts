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
  setExerciseReadOnly,
  shouldConfirmForwardNavigation,
  withCurrentSetCompleted,
} from "./workout-state";
import {
  renderCompletionScreen,
  renderExerciseScreen,
  renderStartScreen,
} from "./workout-render";

const forwardNavigationConfirmationMessage =
  "Move to the next exercise? This draft set will not be saved.";
const finishWorkoutConfirmationMessage = "Finish this workout? This draft set will not be saved.";

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
    );
  };

  const closeConfirmDialog = (): void => {
    if (!state.confirmDialog.message && !state.confirmDialog.onConfirm) {
      return;
    }

    state = {
      ...state,
      confirmDialog: {
        message: null,
        onConfirm: null,
      },
    };
  };

  const openConfirmDialog = (
    message: string,
    onConfirm: () => void | Promise<void>,
  ): void => {
    state = {
      ...state,
      confirmDialog: {
        message,
        onConfirm,
      },
    };
    render();
  };

  const loadStartScreenSelections = async (): Promise<void> => {
    const { trainingPlans, gyms } = await loadStartScreenData(fetchJson);

    state = {
      ...state,
      workoutPlan: null,
      viewState: { screen: "start" },
      confirmDialog: {
        message: null,
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
        };
      } else {
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

  const startWorkout = async (): Promise<void> => {
    if (!canStartWorkout(state.startScreen)) {
      return;
    }

    const selectedPlan = state.startScreen.trainingPlans.find(
      (plan) => plan.id === state.startScreen.selectedTrainingPlanId,
    );

    if (!selectedPlan) {
      return;
    }

    state = {
      ...state,
      startScreen: {
        ...state.startScreen,
        isStarting: true,
        errorMessage: null,
      },
    };
    render();

    try {
      const optionsResponse = await fetchJson<TrainingPlanOptionsResponse>(
        `/api/training-plans/${selectedPlan.id}/options?gymId=${encodeURIComponent(
          state.startScreen.selectedGymId,
        )}`,
      );
      const workoutPlan = buildWorkoutPlan(selectedPlan, optionsResponse);

      state = {
        ...state,
        workoutPlan,
        startScreen: {
          ...state.startScreen,
          isStarting: false,
        },
        activeWorkout: {
          id: null,
          startedAt: now(),
          persistedExerciseCount: 0,
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      };
      state.viewState = getNextViewState(state.viewState, "start-workout", workoutPlan.exercises.length);
    } catch {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          isStarting: false,
          errorMessage: "Unable to prepare this workout for the selected gym.",
        },
      };
    }

    render();
  };

  const cancelWorkout = async (): Promise<void> => {
    if (
      state.viewState.screen !== "exercise" ||
      !state.workoutPlan ||
      state.workoutSave.isSaving ||
      !state.activeWorkout.id ||
      state.activeWorkout.persistedExerciseCount < 1
    ) {
      return;
    }

    const activeWorkoutId = state.activeWorkout.id;
    closeConfirmDialog();

    state = {
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    };
    render();

    try {
      await activeWorkoutApi.cancelActiveWorkout(activeWorkoutId);
      await loadStartScreenSelections();
    } catch {
      state = {
        ...state,
        workoutSave: {
          isSaving: false,
          errorMessage: "Unable to cancel this workout. Try again.",
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
      openConfirmDialog(forwardNavigationConfirmationMessage, navigateToNextExercise);
      return;
    }

    closeConfirmDialog();
    navigateToNextExercise();
  };

  const completeWorkout = async (planToPersist: WorkoutPlan): Promise<void> => {
    if (state.viewState.screen !== "exercise" || state.workoutSave.isSaving) {
      return;
    }

    const currentExercisePosition = state.viewState.exerciseIndex + 1;
    const startedAt = state.activeWorkout.startedAt ?? now();
    const progressPayload = buildActiveWorkoutProgressPayload(
      planToPersist,
      state.startScreen.selectedGymId,
      startedAt,
      currentExercisePosition,
    );
    const completedAt = now();

    state = {
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    };
    render();

    try {
      let workoutId = state.activeWorkout.id;

      if (!workoutId && progressPayload.exercises.length === 0) {
        if (!activeWorkoutApi.createWorkout) {
          throw new Error("Workout creation API is unavailable");
        }

        await activeWorkoutApi.createWorkout({
          training_plan_id: progressPayload.training_plan_id,
          gym_id: progressPayload.gym_id,
          started_at: progressPayload.started_at,
          completed_at: completedAt,
          exercises: [],
        });
      } else if (!workoutId) {
        const createResponse = await activeWorkoutApi.createActiveWorkout({
          ...progressPayload,
          first_confirmed_exercise_position: currentExercisePosition,
        });

        workoutId = createResponse.workout.id;
      }

      if (workoutId) {
        await activeWorkoutApi.completeActiveWorkout(workoutId, {
          ...progressPayload,
          completed_at: completedAt,
          last_confirmed_exercise_position: currentExercisePosition,
        });
      }

      state = {
        ...state,
        workoutPlan: planToPersist,
        viewState: { screen: "completion" },
        activeWorkout: {
          id: null,
          startedAt: null,
          persistedExerciseCount: 0,
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      };
    } catch {
      state = {
        ...state,
        workoutSave: {
          isSaving: false,
          errorMessage: "Unable to save this workout. Try again.",
        },
      };
    }

    render();
  };

  const finishWorkout = async (): Promise<void> => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    closeConfirmDialog();
    await completeWorkout(state.workoutPlan);
  };

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
      openConfirmDialog(finishWorkoutConfirmationMessage, finishWorkout);
      return;
    }

    void finishWorkout();
  };

  const persistActiveSet = async (): Promise<void> => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercisePosition = exerciseIndex + 1;
    const draftPlan = withCurrentSetCompleted(state.workoutPlan, exerciseIndex);
    const startedAt = state.activeWorkout.startedAt ?? now();

    state = {
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    };
    render();

    try {
      const response = state.activeWorkout.id
        ? await activeWorkoutApi.updateActiveWorkout(state.activeWorkout.id, {
            ...buildActiveWorkoutProgressPayload(
              draftPlan,
              state.startScreen.selectedGymId,
              startedAt,
              currentExercisePosition,
            ),
            last_confirmed_exercise_position: currentExercisePosition,
          })
        : await activeWorkoutApi.createActiveWorkout({
            ...buildActiveWorkoutProgressPayload(
              draftPlan,
              state.startScreen.selectedGymId,
              startedAt,
              currentExercisePosition,
            ),
            first_confirmed_exercise_position: currentExercisePosition,
          });
      const nextPlan = applyActiveWorkoutResponse(draftPlan, response);
      nextPlan.exercises.forEach((exercise, index) => {
        if (index < response.workout.current_exercise_position - 1) {
          exercise.isReadOnly = true;
        } else if (index === response.workout.current_exercise_position - 1) {
          exercise.isReadOnly = false;
        }
      });

      state = {
        ...state,
        workoutPlan: nextPlan,
        viewState: {
          screen: "exercise",
          exerciseIndex,
        },
        activeWorkout: {
          id: response.workout.id,
          startedAt: response.workout.started_at,
          persistedExerciseCount: countPersistedExercises(response),
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      };
    } catch {
      state = {
        ...state,
        workoutSave: {
          isSaving: false,
          errorMessage: "Unable to save this workout. Try again.",
        },
      };
    }

    render();
  };

  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;

    if (action === "start-workout") {
      void startWorkout();
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
      render();
      return;
    }

    if (action === "increment-load") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.loadValue += 1;
      render();
      return;
    }

    if (action === "decrement-reps") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.reps = Math.max(1, currentStep.activeSet.reps - 1);
      render();
      return;
    }

    if (action === "increment-reps") {
      if (currentStep.isReadOnly) {
        return;
      }
      currentStep.activeSet.reps += 1;
      render();
      return;
    }

    if (action === "next-set") {
      if (currentStep.isReadOnly) {
        return;
      }
      void persistActiveSet();
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
        cancelWorkout,
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

    if (!isDigitsOnly(nextValue)) {
      if (target.dataset.action === "load-input") {
        target.value = String(currentStep.activeSet.loadValue);
      } else if (target.dataset.action === "reps-input") {
        target.value = String(currentStep.activeSet.reps);
      }
      return;
    }

    if (target.dataset.action === "load-input") {
      currentStep.activeSet.loadValue = Number(nextValue);
      return;
    }

    if (target.dataset.action === "reps-input") {
      currentStep.activeSet.reps = Math.max(1, Number(nextValue));
      target.value = String(currentStep.activeSet.reps);
    }
  });

  render();
  void bootstrapStartScreen();
};
