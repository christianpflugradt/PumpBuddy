import {
  loadActiveWorkout,
  loadStartScreenData,
  loadTrainingPlanOptions,
} from "./workout-api";
import type { FetchJson, ActiveWorkoutApi } from "./workout-api";
import type { AppState, WorkoutMode, WorkoutPlan } from "./workout-types";
import {
  canReopenPreviousExercise,
  getNextViewState,
  normalizeExerciseActiveSet,
  withFallbackOptionSelected,
  withFallbackOptionSelectionConfirmed,
  withExerciseMarkedSkipped,
  shouldConfirmForwardNavigation,
} from "./workout-state";
import {
  applyActiveWorkoutResponse,
  buildBlockedStartModalState,
  buildWorkoutPlanFromActiveWorkout,
  buildWorkoutPlanFromFreeModeActiveWorkout,
  countPersistedExercises,
  selectDefaultGymId,
  selectDefaultTrainingPlanId,
} from "./workout-contract-state";

type GetState = () => AppState;
type SetState = (next: AppState) => void;

export const createWorkflowOrchestrator = (exercise_variants: {
  getState: GetState;
  setState: SetState;
  render: () => void;
  fetchJson: FetchJson;
  activeWorkoutApi: ActiveWorkoutApi;
  now: () => string;
  openConfirmDialog: (message: string, label: string, onConfirm: () => void | Promise<void>) => void;
  closeConfirmDialog: () => void;
  pulseUiFeedback: (key: keyof AppState["uiFeedback"]) => void;
}): {
  bootstrapStartScreen: () => Promise<void>;
  startWorkout: () => Promise<void>;
  cancelWorkout: () => Promise<void>;
  completeWorkout: (planToPersist: WorkoutPlan) => Promise<void>;
  finishWorkout: () => Promise<void>;
  persistActiveSet: () => Promise<void>;
  persistNextExerciseTransition: () => Promise<boolean>;
  persistPreviousExerciseTransition: () => Promise<boolean>;
  persistDeleteLatestSet: () => Promise<void>;
  persistSkipTransition: (mode: "next" | "finish") => Promise<boolean>;
  selectFallbackOption: (selectedOptionId: string | null) => void;
  persistFallbackSelection: (selectedOptionId: string | null) => Promise<void>;
} => {
  const { getState, setState, render, fetchJson, activeWorkoutApi, now, openConfirmDialog, closeConfirmDialog, pulseUiFeedback } = exercise_variants;
  const workoutModeFromApiGymId = (gymId: string | null): WorkoutMode =>
    gymId === null ? "free-mode" : "configured-gym";
  const gymIdForApiWorkoutMode = (mode: WorkoutMode, selectedGymId: string): string | null =>
    mode === "free-mode" ? null : selectedGymId;

  const loadStartScreenSelections = async (): Promise<void> => {
    const state = getState();
    const { trainingPlans, gyms } = await loadStartScreenData(fetchJson);

    setState({
      ...state,
      workoutPlan: null,
      viewState: { screen: "start" },
      completion: {
        startedAt: null,
        completedAt: null,
        averageDurationMinutes: null,
        workoutProgress: null,
        workoutProgressStatus: "NOT_ENOUGH_DATA",
      },
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
        blockedStartModal: null,
        trainingPlans,
        gyms,
        selectedTrainingPlanId: selectDefaultTrainingPlanId(trainingPlans),
        selectedGymId: selectDefaultGymId(gyms, state.sessionUser?.favoriteGymId),
        selectedWorkoutMode: "configured-gym",
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
  };

  const bootstrapStartScreen = async (): Promise<void> => {
    try {
      const activeWorkoutResponse = await loadActiveWorkout(fetchJson);

      if (activeWorkoutResponse) {
        const selectedWorkoutMode = workoutModeFromApiGymId(activeWorkoutResponse.workout.gym_id);
        const freeModeWorkout = selectedWorkoutMode === "free-mode";
        const configuredGymId = activeWorkoutResponse.workout.gym_id ?? "";
        const workoutPlan = freeModeWorkout
          ? buildWorkoutPlanFromFreeModeActiveWorkout(activeWorkoutResponse)
          : buildWorkoutPlanFromActiveWorkout(
              activeWorkoutResponse,
              await loadTrainingPlanOptions(
                fetchJson,
                activeWorkoutResponse.workout.training_plan_id,
                configuredGymId,
              ),
            );

        workoutPlan.exercises.forEach((exercise, index) => {
          exercise.isReadOnly = index < activeWorkoutResponse.workout.current_exercise_position - 1;
        });

        setState({
          ...getState(),
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
            ...getState().startScreen,
            isLoading: false,
            isStarting: false,
            errorMessage: null,
            blockedStartModal: null,
            selectedTrainingPlanId: activeWorkoutResponse.workout.training_plan_id,
            selectedGymId: activeWorkoutResponse.workout.gym_id ?? "",
            selectedWorkoutMode,
          },
          completion: {
            startedAt: null,
            completedAt: null,
            averageDurationMinutes: null,
            workoutProgress: null,
            workoutProgressStatus: "NOT_ENOUGH_DATA",
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
        });
      } else {
        await loadStartScreenSelections();
      }
    } catch {
      const current = getState();
      setState({
        ...current,
        startScreen: {
          ...current.startScreen,
          isLoading: false,
          isStarting: false,
          errorMessage: "Unable to load start selections. Refresh and try again.",
          blockedStartModal: null,
        },
      });
    }

    render();
  };

  const startWorkout = async (): Promise<void> => {
    const state = getState();
    if (!state.startScreen || state.startScreen.isLoading || state.startScreen.isStarting || state.startScreen.errorMessage) {
      return;
    }

    const selectedPlan = state.startScreen.trainingPlans.find(
      (plan) => plan.id === state.startScreen.selectedTrainingPlanId,
    );

    if (!selectedPlan) {
      return;
    }

    setState({
      ...state,
      startScreen: {
        ...state.startScreen,
        isStarting: true,
        errorMessage: null,
        blockedStartModal: null,
      },
    });
    render();

    try {
      const freeModeSelected = state.startScreen.selectedWorkoutMode === "free-mode";
      const startedAt = now();
      const payloadGymId = gymIdForApiWorkoutMode(
        state.startScreen.selectedWorkoutMode,
        state.startScreen.selectedGymId,
      );
      const createResponse = await activeWorkoutApi.createActiveWorkout({
        training_plan_id: selectedPlan.id,
        gym_id: payloadGymId,
        started_at: startedAt,
      });
      const nextWorkoutPlan = freeModeSelected
        ? buildWorkoutPlanFromFreeModeActiveWorkout(createResponse)
        : buildWorkoutPlanFromActiveWorkout(
            createResponse,
            await loadTrainingPlanOptions(
              fetchJson,
              selectedPlan.id,
              state.startScreen.selectedGymId,
            ),
          );

      const nextState = {
        ...getState(),
        workoutPlan: nextWorkoutPlan,
        completion: {
          startedAt: null,
          completedAt: null,
          averageDurationMinutes: null,
          workoutProgress: null,
          workoutProgressStatus: "NOT_ENOUGH_DATA",
        },
        startScreen: {
          ...getState().startScreen,
          isStarting: false,
          blockedStartModal: null,
        },
        activeWorkout: {
          id: createResponse.workout.id,
          startedAt: createResponse.workout.started_at,
          persistedExerciseCount: countPersistedExercises(createResponse),
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
      } as AppState;

      nextState.viewState = getNextViewState(
        nextState.viewState,
        "start-workout",
        nextWorkoutPlan.exercises.length,
      );
      setState(nextState);
    } catch (error) {
      const current = getState();
      const selectedGym =
        current.startScreen.gyms.find((gym) => gym.id === current.startScreen.selectedGymId) ??
        null;
      const blockedStartModal =
        current.startScreen.selectedWorkoutMode === "configured-gym"
          ? buildBlockedStartModalState(
              error,
              selectedPlan.name,
              selectedGym?.name ?? "Configured Gym",
            )
          : null;
      setState({
        ...current,
        startScreen: {
          ...current.startScreen,
          isStarting: false,
          errorMessage: blockedStartModal
            ? null
            : current.startScreen.selectedWorkoutMode === "free-mode"
              ? "Unable to prepare this workout for free mode."
              : "Unable to prepare this workout for the selected gym.",
          blockedStartModal,
        },
      });
    }

    render();
  };

  const cancelWorkout = async (): Promise<void> => {
    const state = getState();
    if (
      state.viewState.screen !== "exercise" ||
      !state.workoutPlan ||
      state.workoutSave.isSaving ||
      !state.activeWorkout.id
    ) {
      return;
    }

    const activeWorkoutId = state.activeWorkout.id;
    closeConfirmDialog();

    setState({
      ...getState(),
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      await activeWorkoutApi.cancelActiveWorkout(activeWorkoutId);
      await loadStartScreenSelections();
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutSave: {
          isSaving: false,
          errorMessage:
            "Connection issue. Your workout is still active and no progress was deleted. Keep this page open and retry when your network returns.",
        },
      });
    }

    render();
  };

  const completeWorkout = async (planToPersist: WorkoutPlan): Promise<void> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || state.workoutSave.isSaving) {
      return;
    }

    const startedAt: string = state.activeWorkout.startedAt ?? now();
    const workoutId = state.activeWorkout.id;
    if (!workoutId) {
      return;
    }
    const completedAt = now();

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const completionSummary = await activeWorkoutApi.completeActiveWorkout(workoutId, {
        completed_at: completedAt,
      });

      setState({
        ...getState(),
        workoutPlan: planToPersist,
        viewState: { screen: "completion" },
        completion: {
          startedAt,
          completedAt,
          averageDurationMinutes: completionSummary?.average_duration_minutes ?? null,
          workoutProgress: completionSummary?.workout_progress ?? null,
          workoutProgressStatus: completionSummary?.workout_progress_status ?? "NOT_ENOUGH_DATA",
        },
        activeWorkout: {
          id: null,
          startedAt,
          persistedExerciseCount: 0,
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      });
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutSave: {
          isSaving: false,
          errorMessage: "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
    }

    render();
  };

  const finishWorkout = async (): Promise<void> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    closeConfirmDialog();
    await completeWorkout(state.workoutPlan);
  };

  const persistActiveSet = async (): Promise<void> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercisePosition = exerciseIndex + 1;
    const currentExercise = state.workoutPlan.exercises[exerciseIndex];
    if (!currentExercise) {
      return;
    }

    normalizeExerciseActiveSet(currentExercise, state.startScreen.selectedWorkoutMode);

    const activeWorkoutId = state.activeWorkout.id;
    if (!activeWorkoutId) {
      return;
    }

    const shouldResetSecsDraft = currentExercise.repetitionKind === "SECS";

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await activeWorkoutApi.confirmActiveWorkoutSet(
        activeWorkoutId,
        currentExercisePosition,
        {
          set: {
            load_value: currentExercise.activeSet.loadValue,
            repetition_value: currentExercise.activeSet.reps,
          },
        },
      );
      const nextPlan = applyActiveWorkoutResponse(
        getState().workoutPlan ?? state.workoutPlan,
        response,
      );
      nextPlan.exercises.forEach((exercise, index) => {
        if (index < response.workout.current_exercise_position - 1) {
          exercise.isReadOnly = true;
        } else if (index === response.workout.current_exercise_position - 1) {
          exercise.isReadOnly = false;
        }
      });

      setState({
        ...getState(),
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
      });

      const latestState = getState();
      const latestExercise = latestState.workoutPlan?.exercises[exerciseIndex];
      if (shouldResetSecsDraft && latestExercise) {
        latestExercise.activeSet.reps = 0;
        latestExercise.activeSetInput.reps = "0";
        setState({
          ...latestState,
          workoutPlan: {
            ...latestState.workoutPlan!,
            exercises: [...latestState.workoutPlan!.exercises],
          },
        });
      }

      pulseUiFeedback("completedSetPulseToken");
      return;
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutSave: {
          isSaving: false,
          errorMessage: "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
    }

    render();
  };

  const persistFallbackSelection = async (selectedOptionId: string | null): Promise<void> => {
    const state = getState();
    if (
      state.viewState.screen !== "exercise" ||
      !state.workoutPlan ||
      state.workoutSave.isSaving ||
      state.startScreen.selectedWorkoutMode === "free-mode"
    ) {
      return;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercisePosition = exerciseIndex + 1;
    const nextPlan = withFallbackOptionSelected(state.workoutPlan, exerciseIndex, selectedOptionId);
    const confirmedPlan = withFallbackOptionSelectionConfirmed(nextPlan, exerciseIndex);
    const currentExercise = state.workoutPlan.exercises[exerciseIndex];
    const nextExercise = confirmedPlan.exercises[exerciseIndex];

    if (!currentExercise || !nextExercise) {
      return;
    }

    if (currentExercise.completedSets.length > 0) {
      return;
    }

    if (
      currentExercise.selectedTrainingPlanExerciseVariantId === nextExercise.selectedTrainingPlanExerciseVariantId &&
      currentExercise.selectedVariantId === nextExercise.selectedVariantId &&
      currentExercise.selectedStationId === nextExercise.selectedStationId &&
      currentExercise.isFallbackOptionConfirmed === nextExercise.isFallbackOptionConfirmed
    ) {
      return;
    }

    if (!state.activeWorkout.id || !nextExercise.selectedTrainingPlanExerciseVariantId) {
      return;
    }

    setState({
      ...state,
      workoutPlan: confirmedPlan,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await activeWorkoutApi.selectActiveWorkoutExerciseOption(
        state.activeWorkout.id,
        currentExercisePosition,
        {
          training_plan_exercise_variant_id:
            nextExercise.selectedTrainingPlanExerciseVariantId,
          selected_station_id: nextExercise.selectedStationId,
        },
      );

      const persistedPlan = applyActiveWorkoutResponse(confirmedPlan, response);
      setState({
        ...getState(),
        workoutPlan: persistedPlan,
        activeWorkout: {
          id: response.workout.id,
          startedAt: response.workout.started_at,
          persistedExerciseCount: countPersistedExercises(response),
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      });
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutPlan: state.workoutPlan,
        workoutSave: {
          isSaving: false,
          errorMessage:
            "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
    }

    render();
  };

  const persistNextExerciseTransition = async (): Promise<boolean> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return false;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercisePosition = exerciseIndex + 1;
    const currentExercise = state.workoutPlan.exercises[exerciseIndex];
    if (!currentExercise || currentExercise.completedSets.length === 0) {
      return false;
    }

    const nextCursorPosition = Math.min(
      currentExercisePosition + 1,
      state.workoutPlan.exercises.length,
    );
    if (!state.activeWorkout.id) {
      return false;
    }

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await activeWorkoutApi.updateActiveWorkout(state.activeWorkout.id, {
        current_exercise_position: nextCursorPosition,
      });

      const nextPlan = applyActiveWorkoutResponse(state.workoutPlan, response);
      nextPlan.exercises.forEach((exercise, index) => {
        exercise.isReadOnly = index < response.workout.current_exercise_position - 1;
      });

      setState({
        ...getState(),
        workoutPlan: nextPlan,
        viewState: {
          screen: "exercise",
          exerciseIndex: response.workout.current_exercise_position - 1,
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
      });
      render();
      return true;
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutSave: {
          isSaving: false,
          errorMessage:
            "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
      render();
      return false;
    }
  };

  const persistPreviousExerciseTransition = async (): Promise<boolean> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return false;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    if (!state.activeWorkout.id || !canReopenPreviousExercise(state.workoutPlan, exerciseIndex)) {
      return false;
    }

    const previousCursorPosition = exerciseIndex;

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await activeWorkoutApi.reopenActiveWorkoutExercise(state.activeWorkout.id, {
        current_exercise_position: previousCursorPosition,
      });

      const nextPlan = applyActiveWorkoutResponse(state.workoutPlan, response);
      nextPlan.exercises.forEach((exercise, index) => {
        exercise.isReadOnly = index < response.workout.current_exercise_position - 1;
      });

      setState({
        ...getState(),
        workoutPlan: nextPlan,
        viewState: {
          screen: "exercise",
          exerciseIndex: response.workout.current_exercise_position - 1,
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
      });
      render();
      return true;
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutSave: {
          isSaving: false,
          errorMessage:
            "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
      render();
      return false;
    }
  };

  const persistDeleteLatestSet = async (): Promise<void> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercisePosition = exerciseIndex + 1;
    const currentExercise = state.workoutPlan.exercises[exerciseIndex];
    if (!currentExercise || currentExercise.completedSets.length === 0) {
      return;
    }

    const activeWorkoutId = state.activeWorkout.id;
    if (!activeWorkoutId) {
      return;
    }

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await activeWorkoutApi.deleteLatestActiveWorkoutSet(
        activeWorkoutId,
        currentExercisePosition,
      );
      const nextPlan = applyActiveWorkoutResponse(
        getState().workoutPlan ?? state.workoutPlan,
        response,
      );
      nextPlan.exercises.forEach((exercise, index) => {
        exercise.isReadOnly = index < response.workout.current_exercise_position - 1;
      });

      setState({
        ...getState(),
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
      });
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutSave: {
          isSaving: false,
          errorMessage:
            "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
    }

    render();
  };

  const persistSkipTransition = async (mode: "next" | "finish"): Promise<boolean> => {
    const state = getState();
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return false;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercisePosition = exerciseIndex + 1;
    const currentExercise = state.workoutPlan.exercises[exerciseIndex];
    if (!currentExercise || !shouldConfirmForwardNavigation(currentExercise)) {
      return false;
    }

    const nextCursorPosition =
      mode === "next" ? Math.min(currentExercisePosition + 1, state.workoutPlan.exercises.length) : currentExercisePosition;
    const skippedAt = now();
    const skippedPlan = withExerciseMarkedSkipped(state.workoutPlan, exerciseIndex, skippedAt);
    if (!state.activeWorkout.id) {
      return false;
    }

    setState({
      ...state,
      workoutPlan: skippedPlan,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await activeWorkoutApi.skipActiveWorkoutExercise(
        state.activeWorkout.id,
        currentExercisePosition,
        {
          skipped_at: skippedAt,
          current_exercise_position: nextCursorPosition,
        },
      );

      const persistedPlan = applyActiveWorkoutResponse(skippedPlan, response);
      setState({
        ...getState(),
        workoutPlan: persistedPlan,
        activeWorkout: {
          id: response.workout.id,
          startedAt: response.workout.started_at,
          persistedExerciseCount: countPersistedExercises(response),
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      });
      render();
      return true;
    } catch {
      const current = getState();
      setState({
        ...current,
        workoutPlan: state.workoutPlan,
        workoutSave: {
          isSaving: false,
          errorMessage:
            "Connection issue. Your workout progress is still saved in this session on this device and has not synced yet. Keep this page open and retry when your network returns.",
        },
      });
      render();
      return false;
    }
  };

  const selectFallbackOption = (selectedOptionId: string | null): void => {
    const state = getState();
    if (
      state.viewState.screen !== "exercise" ||
      !state.workoutPlan ||
      state.workoutSave.isSaving ||
      state.startScreen.selectedWorkoutMode === "free-mode"
    ) {
      return;
    }

    const exerciseIndex = state.viewState.exerciseIndex;
    const currentExercise = state.workoutPlan.exercises[exerciseIndex];
    if (!currentExercise || currentExercise.completedSets.length > 0) {
      return;
    }

    const nextPlan = withFallbackOptionSelected(state.workoutPlan, exerciseIndex, selectedOptionId);
    const nextExercise = nextPlan.exercises[exerciseIndex];
    if (!nextExercise) {
      return;
    }

    if (
      currentExercise.selectedTrainingPlanExerciseVariantId === nextExercise.selectedTrainingPlanExerciseVariantId &&
      currentExercise.selectedVariantId === nextExercise.selectedVariantId &&
      currentExercise.selectedStationId === nextExercise.selectedStationId &&
      currentExercise.isFallbackOptionConfirmed === nextExercise.isFallbackOptionConfirmed
    ) {
      return;
    }

    setState({
      ...state,
      workoutPlan: nextPlan,
    });
    render();
  };

  return {
    bootstrapStartScreen,
    startWorkout,
    cancelWorkout,
    completeWorkout,
    finishWorkout,
    persistActiveSet,
    persistNextExerciseTransition,
    persistPreviousExerciseTransition,
    persistDeleteLatestSet,
    persistSkipTransition,
    selectFallbackOption,
    persistFallbackSelection,
  };
};
