import type {
  AppState,
  TrainingPlanOptionsResponse,
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
  buildWorkoutPlanFromActiveWorkout,
  buildWorkoutPlanFromFreeModeActiveWorkout,
  countPersistedExercises,
  createInitialStartScreenState,
  formatLoadInputValue,
  setExerciseReadOnly,
  stepWithinProfileLoadsForInputMode,
  shouldConfirmForwardNavigation,
} from "./workout-state";
import { createWorkflowOrchestrator } from "./workflow-orchestrator";
import { pbAppRootTag } from "./pb-app-root";

const uiFeedbackResetDelayMs = 220;
const forwardNavigationConfirmationMessage =
  "Move to the next exercise? This draft set will not be saved.";
const finishWorkoutConfirmationMessage = "Finish this workout? This draft set will not be saved.";

const setRootState = (app: HTMLElement, state: AppState): void => {
  const root = (
    app.matches(pbAppRootTag) ? app : app.querySelector(pbAppRootTag)
  ) as (HTMLElement & { state?: AppState }) | null;
  if (root) {
    root.state = state;
  }
};

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
  };

  const render = (): void => {
    setRootState(app, state);
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
        blockedStartModal: null,
        trainingPlans,
        gyms,
        selectedTrainingPlanId: trainingPlans[0]?.id ?? "",
        selectedGymId: gyms[0]?.id ?? "",
        selectedWorkoutMode: "configured-gym",
      },
      completion: {
        startedAt: null,
        completedAt: null,
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
        const freeModeWorkout = activeWorkoutResponse.workout.gym_id === null;
        const configuredGymId = activeWorkoutResponse.workout.gym_id ?? "";
        const workoutPlan = freeModeWorkout
          ? buildWorkoutPlanFromFreeModeActiveWorkout(activeWorkoutResponse)
          : buildWorkoutPlanFromActiveWorkout(
              activeWorkoutResponse,
              await fetchJson<TrainingPlanOptionsResponse>(
                `/api/training-plans/${activeWorkoutResponse.workout.training_plan_id}/options?gymId=${encodeURIComponent(
                  configuredGymId,
                )}`,
              ),
            );

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
            blockedStartModal: null,
            selectedTrainingPlanId: activeWorkoutResponse.workout.training_plan_id,
            selectedGymId: activeWorkoutResponse.workout.gym_id ?? "",
            selectedWorkoutMode: freeModeWorkout ? "free-mode" : "configured-gym",
          },
          completion: {
            startedAt: null,
            completedAt: null,
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
              blockedStartModal: null,
              trainingPlans,
              gyms,
              selectedTrainingPlanId: trainingPlans[0]?.id ?? "",
              selectedGymId: gyms[0]?.id ?? "",
              selectedWorkoutMode: "configured-gym",
            },
          };
        } catch {
          state = {
            ...state,
            startScreen: {
              ...state.startScreen,
              isLoading: false,
              errorMessage: "Unable to load start selections. Refresh and try again.",
              blockedStartModal: null,
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
          blockedStartModal: null,
        },
      };
    }

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
        exerciseIndex: Math.min(nextExerciseIndex, state.workoutPlan.exercises.length - 1),
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
        finishWorkoutConfirmationMessage,
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

  app.addEventListener("pb-ui-action", (event: Event) => {
    const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
    const action = customEvent.detail?.action;

    if (!action) {
      return;
    }

    switch (action) {
      case "start-workout":
        void orchestrator.startWorkout();
        return;
      case "dismiss-start-blocked-modal":
        if (state.viewState.screen !== "start") {
          return;
        }
        state = {
          ...state,
          startScreen: {
            ...state.startScreen,
            blockedStartModal: null,
          },
        };
        render();
        return;
      case "return-to-start":
        if (state.viewState.screen !== "completion") {
          return;
        }
        void loadStartScreenSelections().then(render);
        return;
      case "confirm-dialog-dismiss":
        if (!state.workoutSave.isSaving) {
          closeConfirmDialog();
          render();
        }
        return;
      case "confirm-dialog-confirm":
        if (state.workoutSave.isSaving) {
          return;
        }
        if (state.confirmDialog.onConfirm) {
          const onConfirm = state.confirmDialog.onConfirm;
          closeConfirmDialog();
          render();
          void onConfirm();
        }
        return;
      case "next-set":
        if (state.confirmDialog.message) {
          return;
        }
        void orchestrator.persistActiveSet();
        return;
      case "decrement-load":
      case "increment-load":
      case "decrement-reps":
      case "increment-reps":
        if (
          state.confirmDialog.message ||
          state.viewState.screen !== "exercise" ||
          !state.workoutPlan ||
          state.workoutSave.isSaving
        ) {
          return;
        }
        {
          const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
          if (!current) {
            return;
          }
          const isStationlessSelectedOption =
            current.selectedPlanExerciseOptionId !== null && current.selectedStationId === null;
          if (
            (action === "decrement-load" || action === "increment-load") &&
            (current.isReadOnly || isStationlessSelectedOption)
          ) {
            return;
          }
          if ((action === "decrement-reps" || action === "increment-reps") && current.isReadOnly) {
            return;
          }

          if (action === "decrement-load" || action === "increment-load") {
            const currentLoadValue = current.activeSet.loadValue;
            if (currentLoadValue === null) {
              return;
            }

            current.activeSet.loadValue =
              state.startScreen.selectedWorkoutMode === "configured-gym"
                ? (stepWithinProfileLoadsForInputMode(
                    current.selectedStationProfileLoadsKg,
                    currentLoadValue,
                    current.loadInputMode,
                    action === "decrement-load" ? "decrease" : "increase",
                  ) ?? currentLoadValue)
                : action === "decrement-load"
                  ? Math.max(0, currentLoadValue - 1)
                  : currentLoadValue + 1;
            current.activeSetInput.loadValue = formatLoadInputValue(current.activeSet.loadValue);
            pulseUiFeedback("loadTickToken");
            render();
            return;
          }

          if (action === "decrement-reps") {
            current.activeSet.reps = Math.max(1, current.activeSet.reps - 1);
            current.activeSetInput.reps = String(current.activeSet.reps);
            pulseUiFeedback("repsTickToken");
            render();
            return;
          }

          if (action === "increment-reps") {
            current.activeSet.reps += 1;
            current.activeSetInput.reps = String(current.activeSet.reps);
            pulseUiFeedback("repsTickToken");
            render();
            return;
          }
        }
        return;
      case "previous-exercise":
        if (state.viewState.screen === "exercise" && state.viewState.exerciseIndex > 0 && !state.workoutSave.isSaving) {
          state = {
            ...state,
            viewState: {
              screen: "exercise",
              exerciseIndex: state.viewState.exerciseIndex - 1,
            },
          };
          render();
        }
        return;
      case "next-exercise":
        if (state.confirmDialog.message) {
          return;
        }
        requestNextExerciseNavigation();
        return;
      case "jump-to-current-exercise":
        if (state.viewState.screen === "exercise" && state.workoutPlan && !state.workoutSave.isSaving) {
          const currentExerciseIndex = state.workoutPlan.exercises.findIndex((exercise) => !exercise.isReadOnly);
          if (currentExerciseIndex >= 0) {
            state = {
              ...state,
              viewState: {
                screen: "exercise",
                exerciseIndex: currentExerciseIndex,
              },
            };
            render();
          }
        }
        return;
      case "finish-workout":
        if (state.confirmDialog.message) {
          return;
        }
        requestFinishWorkout();
        return;
      case "cancel-workout":
        openConfirmDialog(
          "Cancel this workout? Your unfinished workout data will be deleted.",
          "Cancel Workout",
          orchestrator.cancelWorkout,
        );
        return;
      case "confirm-fallback-option":
        if (state.viewState.screen === "exercise" && state.workoutPlan) {
          const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
          const selectedOptionKey =
            current?.selectedPlanExerciseOptionId === null
              ? null
              : `${current.selectedPlanExerciseOptionId}::${current.selectedStationId ?? ""}`;
          void orchestrator.persistFallbackSelection(selectedOptionKey);
        }
        return;
      case "auth-submit":
        return;
      default:
        return;
    }
  });

  app.addEventListener("pb-ui-input", (event: Event) => {
    const customEvent = event as CustomEvent<{ action: string; value?: string }>;
    const action = customEvent.detail?.action;
    const value = customEvent.detail?.value ?? "";

    if (!action) {
      return;
    }

    if (state.viewState.screen === "start") {
      if (action === "select-training-plan") {
        state = {
          ...state,
          startScreen: {
            ...state.startScreen,
            selectedTrainingPlanId: value,
            errorMessage: null,
            blockedStartModal: null,
          },
        };
        render();
        return;
      }

      if (action === "select-gym") {
        state = {
          ...state,
          startScreen: {
            ...state.startScreen,
            selectedGymId: value,
            errorMessage: null,
            blockedStartModal: null,
          },
        };
        render();
        return;
      }

      if (action === "select-workout-mode" && (value === "configured-gym" || value === "free-mode")) {
        state = {
          ...state,
          startScreen: {
            ...state.startScreen,
            selectedWorkoutMode: value,
            errorMessage: null,
            blockedStartModal: null,
          },
        };
        render();
        return;
      }
    }

    if (state.viewState.screen === "exercise" && state.workoutPlan) {
      const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
      if (!current || current.isReadOnly) {
        return;
      }

      if (action === "switch-fallback-option") {
        orchestrator.selectFallbackOption(value || null);
        return;
      }

      if (action === "load-input") {
        current.activeSetInput.loadValue = value.trim();
        render();
        return;
      }

      if (action === "reps-input") {
        current.activeSetInput.reps = value.trim();
        render();
      }
    }
  });

  render();
  void bootstrapStartScreen();
};
