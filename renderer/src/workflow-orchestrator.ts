import {
  loadActiveWorkout,
  loadStartScreenData,
  loadTrainingPlanDetail,
  loadTrainingPlanOptions,
} from "./workout-api";
import type { FetchJson, ActiveWorkoutApi } from "./workout-api";
import type { AppState, WorkoutPlan, WorkoutSummary } from "./workout-types";
import {
  applyActiveWorkoutResponse,
  buildBlockedStartModalState,
  buildActiveWorkoutProgressPayload,
  buildFreeModeWorkoutPlan,
  buildWorkoutPlan,
  buildWorkoutPlanFromActiveWorkout,
  canReopenPreviousExercise,
  countPersistedExercises,
  getNextViewState,
  normalizeExerciseActiveSet,
  selectDefaultTrainingPlanId,
  withFallbackOptionSelected,
  withFallbackOptionSelectionConfirmed,
  withCurrentSetCompleted,
  withExerciseMarkedSkipped,
  withLatestCompletedSetRemoved,
  shouldConfirmForwardNavigation,
} from "./workout-state";

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
  const includeExercisePositionsForMode = (
    workoutPlan: WorkoutPlan,
    mode: "configured-gym" | "free-mode",
  ): number[] | undefined =>
    mode === "configured-gym"
      ? workoutPlan.exercises.map((_, index) => index + 1)
      : undefined;

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
        selectedGymId: gyms[0]?.id ?? "",
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

  // The orchestrator exposes pure orchestration but defers error display to the controller
  // to preserve the controller's responsibility for UI messaging. The controller provides
  // `bootstrapStartScreen` wrapper that calls `loadStartScreenSelections` directly when needed.
  const bootstrapStartScreen = async (): Promise<void> => {
    // intentionally minimal: call loadStartScreenSelections and let the controller handle UI errors
    await loadStartScreenSelections();
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
      const workoutPlan = freeModeSelected
        ? buildFreeModeWorkoutPlan(
            selectedPlan,
            await loadTrainingPlanDetail(fetchJson, selectedPlan.id),
          )
        : buildWorkoutPlan(
            selectedPlan,
            await loadTrainingPlanOptions(
              fetchJson,
              selectedPlan.id,
              state.startScreen.selectedGymId,
            ),
          );
      const startedAt = now();

      const persistedWorkoutPlan = !freeModeSelected
        ? (() => {
            const includeExercisePositions = workoutPlan.exercises.map((_, index) => index + 1);
            const createPayload = buildActiveWorkoutProgressPayload(
              workoutPlan,
              state.startScreen.selectedGymId,
              startedAt,
              1,
              { includeExercisePositions },
            );

            return activeWorkoutApi.createActiveWorkout({
              ...createPayload,
              first_confirmed_exercise_position: 1,
            });
          })()
        : null;

      const createResponse = persistedWorkoutPlan ? await persistedWorkoutPlan : null;
      const nextWorkoutPlan = createResponse
        ? applyActiveWorkoutResponse(workoutPlan, createResponse)
        : workoutPlan;

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
          id: createResponse?.workout.id ?? null,
          startedAt: createResponse?.workout.started_at ?? startedAt,
          persistedExerciseCount: createResponse
            ? countPersistedExercises(createResponse)
            : 0,
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
      !state.activeWorkout.id ||
      state.activeWorkout.persistedExerciseCount < 1
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

    const currentExercisePosition = state.viewState.exerciseIndex + 1;
    const startedAt: string = state.activeWorkout.startedAt ?? now();
    const includeExercisePositions = includeExercisePositionsForMode(
      planToPersist,
      state.startScreen.selectedWorkoutMode,
    );
    const progressPayload = buildActiveWorkoutProgressPayload(
      planToPersist,
      state.startScreen.selectedWorkoutMode === "free-mode" ? null : state.startScreen.selectedGymId,
      startedAt,
      currentExercisePosition,
      { includeExercisePositions },
    );
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
      let workoutId = getState().activeWorkout.id;
      let completionSummary: WorkoutSummary | null = null;

      if (!workoutId && progressPayload.exercises.length === 0) {
        if (!activeWorkoutApi.createWorkout) {
          throw new Error("Workout creation API is unavailable");
        }

        completionSummary = await activeWorkoutApi.createWorkout({
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
        completionSummary = await activeWorkoutApi.completeActiveWorkout(workoutId, {
          ...progressPayload,
          completed_at: completedAt,
          last_confirmed_exercise_position: currentExercisePosition,
        });
      }

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

    const draftPlan = withCurrentSetCompleted(state.workoutPlan, exerciseIndex);
    const shouldResetSecsDraft = draftPlan.exercises[exerciseIndex]?.repetitionKind === "SECS";
    const startedAt: string = state.activeWorkout.startedAt ?? now();
    const includeExercisePositions = includeExercisePositionsForMode(
      draftPlan,
      state.startScreen.selectedWorkoutMode,
    );

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const activeWorkoutId = getState().activeWorkout.id;
      const response = activeWorkoutId
        ? await activeWorkoutApi.updateActiveWorkout(activeWorkoutId, {
            ...buildActiveWorkoutProgressPayload(
              draftPlan,
              getState().startScreen.selectedWorkoutMode === "free-mode"
                ? null
                : getState().startScreen.selectedGymId,
              startedAt,
              currentExercisePosition,
              { includeExercisePositions },
            ),
            last_confirmed_exercise_position: currentExercisePosition,
          })
        : await activeWorkoutApi.createActiveWorkout({
            ...buildActiveWorkoutProgressPayload(
              draftPlan,
              getState().startScreen.selectedWorkoutMode === "free-mode"
                ? null
                : getState().startScreen.selectedGymId,
              startedAt,
              currentExercisePosition,
              { includeExercisePositions },
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

    const startedAt = state.activeWorkout.startedAt ?? now();
    const gymId =
      getState().startScreen.selectedWorkoutMode === "free-mode"
        ? null
        : getState().startScreen.selectedGymId;
    const includeExercisePositions = includeExercisePositionsForMode(
      confirmedPlan,
      getState().startScreen.selectedWorkoutMode,
    );

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
      const activeWorkoutId = getState().activeWorkout.id;
      const payload = buildActiveWorkoutProgressPayload(
        confirmedPlan,
        gymId,
        startedAt,
        currentExercisePosition,
        { includeExercisePositions },
      );

      const response = activeWorkoutId
        ? await activeWorkoutApi.updateActiveWorkout(activeWorkoutId, {
            ...payload,
            last_confirmed_exercise_position: currentExercisePosition,
          })
        : await activeWorkoutApi.createActiveWorkout({
            ...payload,
            first_confirmed_exercise_position: currentExercisePosition,
          });

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
    const startedAt = state.activeWorkout.startedAt ?? now();
    const includeExercisePositions = includeExercisePositionsForMode(
      state.workoutPlan,
      state.startScreen.selectedWorkoutMode,
    );

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const activeWorkoutId = getState().activeWorkout.id;
      const payload = buildActiveWorkoutProgressPayload(
        state.workoutPlan,
        getState().startScreen.selectedWorkoutMode === "free-mode"
          ? null
          : getState().startScreen.selectedGymId,
        startedAt,
        nextCursorPosition,
        { includeExercisePositions },
      );

      const response = activeWorkoutId
        ? await activeWorkoutApi.updateActiveWorkout(activeWorkoutId, {
            ...payload,
            last_confirmed_exercise_position: currentExercisePosition,
          })
        : await activeWorkoutApi.createActiveWorkout({
            ...payload,
            first_confirmed_exercise_position: currentExercisePosition,
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
    const startedAt = state.activeWorkout.startedAt ?? now();
    const includeExercisePositions = includeExercisePositionsForMode(
      state.workoutPlan,
      state.startScreen.selectedWorkoutMode,
    );

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const payload = buildActiveWorkoutProgressPayload(
        state.workoutPlan,
        getState().startScreen.selectedWorkoutMode === "free-mode"
          ? null
          : getState().startScreen.selectedGymId,
        startedAt,
        previousCursorPosition,
        { includeExercisePositions },
      );

      const response = await activeWorkoutApi.updateActiveWorkout(state.activeWorkout.id, {
        ...payload,
        last_confirmed_exercise_position: previousCursorPosition,
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

    const draftPlan = withLatestCompletedSetRemoved(state.workoutPlan, exerciseIndex);
    const startedAt = state.activeWorkout.startedAt ?? now();
    const includeExercisePositions = includeExercisePositionsForMode(
      draftPlan,
      state.startScreen.selectedWorkoutMode,
    );

    setState({
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const activeWorkoutId = getState().activeWorkout.id;
      const payload = buildActiveWorkoutProgressPayload(
        draftPlan,
        getState().startScreen.selectedWorkoutMode === "free-mode"
          ? null
          : getState().startScreen.selectedGymId,
        startedAt,
        currentExercisePosition,
        { includeExercisePositions },
      );

      const response = activeWorkoutId
        ? await activeWorkoutApi.updateActiveWorkout(activeWorkoutId, {
            ...payload,
            last_confirmed_exercise_position: currentExercisePosition,
          })
        : await activeWorkoutApi.createActiveWorkout({
            ...payload,
            first_confirmed_exercise_position: currentExercisePosition,
          });

      const nextPlan = applyActiveWorkoutResponse(draftPlan, response);
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
    const skippedPlan = withExerciseMarkedSkipped(state.workoutPlan, exerciseIndex, now());
    const startedAt = state.activeWorkout.startedAt ?? now();
    const gymId =
      getState().startScreen.selectedWorkoutMode === "free-mode"
        ? null
        : getState().startScreen.selectedGymId;
    const includeExercisePositions = includeExercisePositionsForMode(
      skippedPlan,
      getState().startScreen.selectedWorkoutMode,
    );

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
      const activeWorkoutId = getState().activeWorkout.id;
      const payload = buildActiveWorkoutProgressPayload(
        skippedPlan,
        gymId,
        startedAt,
        nextCursorPosition,
        { includeExercisePositions },
      );

      const response = activeWorkoutId
        ? await activeWorkoutApi.updateActiveWorkout(activeWorkoutId, {
            ...payload,
            last_confirmed_exercise_position: currentExercisePosition,
          })
        : await activeWorkoutApi.createActiveWorkout({
            ...payload,
            first_confirmed_exercise_position: currentExercisePosition,
          });

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
