import type {
  AppState,
  SessionUser,
  TrainingPlanExerciseVariantsResponse,
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
  selectDefaultGymId,
  selectDefaultTrainingPlanId,
  setExerciseReadOnly,
  stepWithinProfileLoadsForInputMode,
  shouldConfirmForwardNavigation,
} from "./workout-state";
import { createWorkflowOrchestrator } from "./workflow-orchestrator";
import { pbAppRootTag } from "./pb-app-root";
import { createSecsTimerController, parseSecsInputValue } from "./workout-controller-secs-timer";
import { createScreenDataController } from "./workout-controller-screen-data";
import { handleSettingsAction } from "./workout-controller-settings";
import { handleScreenNavigationAction } from "./workout-controller-navigation";

const uiFeedbackResetDelayMs = 220;
const forwardNavigationConfirmationMessage =
  "Move to the next exercise? This draft set will not be saved.";
const finishWorkoutConfirmationMessage = "Finish this workout? This draft set will not be saved.";
const minEditableReps = 1;
const maxEditableReps = 99;
const minEditableMaxLoadKg = 100;
const maxEditableMaxLoadKg = 999;

const clampEditableReps = (value: number): number =>
  Math.max(minEditableReps, Math.min(maxEditableReps, Math.floor(value)));

const dispatchLogout = (): void => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(new CustomEvent("pb-logout"));
};

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
  sessionUser: SessionUser | null = null,
): void => {
  let state: AppState = {
    sessionUser,
    aboutScreen: {
      metadata: null,
      errorMessage: null,
    },
    historyScreen: {
      workouts: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
      restoreWorkoutId: null,
    },
    progressScreen: {
      workouts: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
    },
    exercisesScreen: {
      groups: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
      restoreScrollY: null,
    },
    workoutDetailScreen: {
      workoutId: null,
      detail: null,
      isLoading: false,
      errorMessage: null,
    },
    startScreen: createInitialStartScreenState(),
    workoutPlan: null,
    viewState: { screen: "start" },
    completion: {
      startedAt: null,
      completedAt: null,
      averageDurationMinutes: null,
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

  const getState = (): AppState => state;
  const setState = (next: AppState): void => {
    state = next;
  };

  let secsTimerController: ReturnType<typeof createSecsTimerController> | null = null;

  const render = (): void => {
    setRootState(app, state);
    secsTimerController?.sync();
  };

  secsTimerController = createSecsTimerController({ getState, render });

  const screenDataController = createScreenDataController({
    getState,
    setState,
    render,
    fetchJson,
  });
  const loadWorkoutDetailScreenData = screenDataController.loadWorkoutDetailScreenData;

  const stopSecsTimerOnCurrentExercise = (): void => {
    secsTimerController?.stopOnCurrentExercise();
  };

  const hasRunningSecsTimerOnCurrentExercise = (): boolean => {
    return secsTimerController?.hasRunningOnCurrentExercise() ?? false;
  };

  const hasZeroSecsOnCurrentExercise = (): boolean => {
    return secsTimerController?.hasZeroOnCurrentExercise() ?? false;
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
    getState,
    setState,
    render,
    fetchJson,
    activeWorkoutApi,
    now,
    openConfirmDialog,
    closeConfirmDialog,
    pulseUiFeedback,
  });

  const loadAboutScreenMetadata = screenDataController.loadAboutScreenMetadata;
  const loadHistoryScreenData = screenDataController.loadHistoryScreenData;
  const loadProgressScreenData = screenDataController.loadProgressScreenData;
  const loadExercisesScreenData = screenDataController.loadExercisesScreenData;

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
        selectedTrainingPlanId: selectDefaultTrainingPlanId(trainingPlans),
        selectedGymId: selectDefaultGymId(gyms, state.sessionUser?.favoriteGymId),
        selectedWorkoutMode: "configured-gym",
      },
      completion: {
        startedAt: null,
        completedAt: null,
        averageDurationMinutes: null,
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
              await fetchJson<TrainingPlanExerciseVariantsResponse>(
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
            averageDurationMinutes: null,
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
              selectedTrainingPlanId: selectDefaultTrainingPlanId(trainingPlans),
              selectedGymId: selectDefaultGymId(gyms, state.sessionUser?.favoriteGymId),
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

    const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (current?.repetitionKind === "SECS") {
      current.isSecsTimerRunning = false;
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

    if (hasRunningSecsTimerOnCurrentExercise()) {
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

    if (hasRunningSecsTimerOnCurrentExercise()) {
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

    if (
      handleSettingsAction(event, action, {
        getState,
        setState,
        render,
        minEditableMaxLoadKg,
        maxEditableMaxLoadKg,
      })
    ) {
      return;
    }

    if (
      handleScreenNavigationAction(event, action, {
        getState,
        setState,
        render,
        loadAboutScreenMetadata,
        loadHistoryScreenData,
        loadProgressScreenData,
        loadExercisesScreenData,
        loadWorkoutDetailScreenData,
      })
    ) {
      return;
    }

    switch (action) {
      case "save-display-name": {
        type SaveDisplayNameEventDetail = {
          action: "save-display-name";
          payload?: { displayName?: string };
          respond?: (result: { ok: boolean; errorMessage?: string }) => void;
        };
        type AuthSessionPatchResponse = {
          authenticated?: boolean;
          user?: {
            id?: string;
            display_name?: string;
            max_load_kg?: number;
            login?: string;
            registration_date?: string;
            favorite_gym_id?: string | null;
          };
        };
        type ErrorResponsePayload = { message?: string };

        const saveEvent = event as CustomEvent<SaveDisplayNameEventDetail>;
        const nextDisplayName = saveEvent.detail?.payload?.displayName?.trim() ?? "";
        event.preventDefault();

        if (!state.sessionUser) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "You are not signed in.",
          });
          return;
        }
        const currentSessionUser = state.sessionUser;

        if (nextDisplayName.length === 0) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Display name cannot be empty.",
          });
          return;
        }

        void (async () => {
          try {
            const response = await fetch("/auth/session", {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({ display_name: nextDisplayName }),
            });

            if (!response.ok) {
              let message = "Unable to save display name right now.";
              try {
                const payload = (await response.json()) as ErrorResponsePayload;
                if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                  message = payload.message;
                }
              } catch {
                // keep fallback message when error body is not available
              }

              saveEvent.detail?.respond?.({
                ok: false,
                errorMessage: message,
              });
              return;
            }

            const payload = (await response.json()) as AuthSessionPatchResponse;
            const user = payload.user;
            const apiDisplayName = user?.display_name?.trim();
            const resolvedDisplayName =
              apiDisplayName && apiDisplayName.length > 0 ? apiDisplayName : nextDisplayName;

            state = {
              ...state,
              sessionUser: {
                id:
                  typeof user?.id === "string" && user.id.length > 0
                    ? user.id
                    : currentSessionUser.id,
                displayName: resolvedDisplayName,
                maxLoadKg:
                  typeof user?.max_load_kg === "number" && Number.isFinite(user.max_load_kg)
                    ? user.max_load_kg
                    : currentSessionUser.maxLoadKg,
                login:
                  typeof user?.login === "string" && user.login.length > 0
                    ? user.login
                    : currentSessionUser.login,
                registrationDate:
                  typeof user?.registration_date === "string" && user.registration_date.length > 0
                    ? user.registration_date
                    : currentSessionUser.registrationDate,
                favoriteGymId:
                  typeof user?.favorite_gym_id === "string" || user?.favorite_gym_id === null
                    ? user.favorite_gym_id
                    : currentSessionUser.favoriteGymId,
              },
            };
            render();
            saveEvent.detail?.respond?.({ ok: true });
          } catch {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: "Unable to save display name right now.",
            });
          }
        })();
        return;
      }
      case "save-favorite-gym": {
        type SaveFavoriteGymEventDetail = {
          action: "save-favorite-gym";
          payload?: { favoriteGymId?: string | null };
          respond?: (result: { ok: boolean; errorMessage?: string }) => void;
        };
        type AuthSessionPatchResponse = {
          authenticated?: boolean;
          user?: {
            id?: string;
            display_name?: string;
            max_load_kg?: number;
            login?: string;
            registration_date?: string;
            favorite_gym_id?: string | null;
          };
        };
        type ErrorResponsePayload = { message?: string };

        const saveEvent = event as CustomEvent<SaveFavoriteGymEventDetail>;
        const nextFavoriteGymIdRaw = saveEvent.detail?.payload?.favoriteGymId;
        const nextFavoriteGymId =
          typeof nextFavoriteGymIdRaw === "string" && nextFavoriteGymIdRaw.length > 0 ? nextFavoriteGymIdRaw : null;
        event.preventDefault();

        if (!state.sessionUser) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "You are not signed in.",
          });
          return;
        }
        const currentSessionUser = state.sessionUser;
        const currentDisplayName = currentSessionUser.displayName.trim();

        if (currentDisplayName.length === 0) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Unable to save favorite gym right now.",
          });
          return;
        }

        if (nextFavoriteGymId && !state.startScreen.gyms.some((gym) => gym.id === nextFavoriteGymId)) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Choose a valid gym from the list.",
          });
          return;
        }

        void (async () => {
          try {
            const response = await fetch("/auth/session", {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({
                display_name: currentDisplayName,
                favorite_gym_id: nextFavoriteGymId,
              }),
            });

            if (!response.ok) {
              let message = "Unable to save favorite gym right now.";
              try {
                const payload = (await response.json()) as ErrorResponsePayload;
                if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                  message = payload.message;
                }
              } catch {
                // keep fallback message when error body is not available
              }

              saveEvent.detail?.respond?.({
                ok: false,
                errorMessage: message,
              });
              return;
            }

            const payload = (await response.json()) as AuthSessionPatchResponse;
            const user = payload.user;
            const resolvedFavoriteGymId =
              typeof user?.favorite_gym_id === "string" || user?.favorite_gym_id === null
                ? user.favorite_gym_id
                : nextFavoriteGymId;

            state = {
              ...state,
              sessionUser: {
                id:
                  typeof user?.id === "string" && user.id.length > 0
                    ? user.id
                    : currentSessionUser.id,
                displayName:
                  typeof user?.display_name === "string" && user.display_name.trim().length > 0
                    ? user.display_name
                    : currentSessionUser.displayName,
                maxLoadKg:
                  typeof user?.max_load_kg === "number" && Number.isFinite(user.max_load_kg)
                    ? user.max_load_kg
                    : currentSessionUser.maxLoadKg,
                login:
                  typeof user?.login === "string" && user.login.length > 0
                    ? user.login
                    : currentSessionUser.login,
                registrationDate:
                  typeof user?.registration_date === "string" && user.registration_date.length > 0
                    ? user.registration_date
                    : currentSessionUser.registrationDate,
                favoriteGymId: resolvedFavoriteGymId,
              },
              startScreen: {
                ...state.startScreen,
                selectedGymId: selectDefaultGymId(state.startScreen.gyms, resolvedFavoriteGymId),
              },
            };
            render();
            saveEvent.detail?.respond?.({ ok: true });
          } catch {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: "Unable to save favorite gym right now.",
            });
          }
        })();
        return;
      }
      case "save-max-load": {
        type SaveMaxLoadEventDetail = {
          action: "save-max-load";
          payload?: { maxLoadKg?: number };
          respond?: (result: { ok: boolean; errorMessage?: string }) => void;
        };
        type AuthSessionPatchResponse = {
          authenticated?: boolean;
          user?: {
            id?: string;
            display_name?: string;
            max_load_kg?: number;
            login?: string;
            registration_date?: string;
            favorite_gym_id?: string | null;
          };
        };
        type ErrorResponsePayload = { message?: string };

        const saveEvent = event as CustomEvent<SaveMaxLoadEventDetail>;
        const nextMaxLoadKgRaw = saveEvent.detail?.payload?.maxLoadKg;
        const nextMaxLoadKg =
          typeof nextMaxLoadKgRaw === "number" && Number.isFinite(nextMaxLoadKgRaw)
            ? Math.floor(nextMaxLoadKgRaw)
            : NaN;
        event.preventDefault();

        if (!state.sessionUser) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "You are not signed in.",
          });
          return;
        }
        const currentSessionUser = state.sessionUser;
        const currentDisplayName = currentSessionUser.displayName.trim();

        if (currentDisplayName.length === 0) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "Unable to save max load right now.",
          });
          return;
        }

        if (
          !Number.isFinite(nextMaxLoadKg) ||
          nextMaxLoadKg < minEditableMaxLoadKg ||
          nextMaxLoadKg > maxEditableMaxLoadKg
        ) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: `Max load must be between ${minEditableMaxLoadKg} and ${maxEditableMaxLoadKg} kg.`,
          });
          return;
        }

        void (async () => {
          try {
            const response = await fetch("/auth/session", {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({
                display_name: currentDisplayName,
                max_load_kg: nextMaxLoadKg,
              }),
            });

            if (!response.ok) {
              let message = "Unable to save max load right now.";
              try {
                const payload = (await response.json()) as ErrorResponsePayload;
                if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                  message = payload.message;
                }
              } catch {
                // keep fallback message when error body is not available
              }

              saveEvent.detail?.respond?.({
                ok: false,
                errorMessage: message,
              });
              return;
            }

            const payload = (await response.json()) as AuthSessionPatchResponse;
            const user = payload.user;
            const resolvedMaxLoadKg =
              typeof user?.max_load_kg === "number" && Number.isFinite(user.max_load_kg)
                ? user.max_load_kg
                : nextMaxLoadKg;

            state = {
              ...state,
              sessionUser: {
                id:
                  typeof user?.id === "string" && user.id.length > 0
                    ? user.id
                    : currentSessionUser.id,
                displayName:
                  typeof user?.display_name === "string" && user.display_name.trim().length > 0
                    ? user.display_name
                    : currentSessionUser.displayName,
                maxLoadKg: resolvedMaxLoadKg,
                login:
                  typeof user?.login === "string" && user.login.length > 0
                    ? user.login
                    : currentSessionUser.login,
                registrationDate:
                  typeof user?.registration_date === "string" && user.registration_date.length > 0
                    ? user.registration_date
                    : currentSessionUser.registrationDate,
                favoriteGymId:
                  typeof user?.favorite_gym_id === "string" || user?.favorite_gym_id === null
                    ? user.favorite_gym_id
                    : currentSessionUser.favoriteGymId,
              },
            };
            render();
            saveEvent.detail?.respond?.({ ok: true });
          } catch {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: "Unable to save max load right now.",
            });
          }
        })();
        return;
      }
      case "save-password": {
        type SavePasswordEventDetail = {
          action: "save-password";
          payload?: {
            currentPassword?: string;
            newPassword?: string;
            confirmNewPassword?: string;
          };
          respond?: (result: { ok: boolean; errorMessage?: string }) => void;
        };
        type ErrorResponsePayload = { message?: string };

        const saveEvent = event as CustomEvent<SavePasswordEventDetail>;
        const currentPassword = saveEvent.detail?.payload?.currentPassword ?? "";
        const newPassword = saveEvent.detail?.payload?.newPassword ?? "";
        const confirmNewPassword = saveEvent.detail?.payload?.confirmNewPassword ?? "";
        event.preventDefault();

        if (!state.sessionUser) {
          saveEvent.detail?.respond?.({
            ok: false,
            errorMessage: "You are not signed in.",
          });
          return;
        }

        void (async () => {
          try {
            const response = await fetch("/auth/password", {
              method: "POST",
              headers: {
                "content-type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
                confirm_new_password: confirmNewPassword,
              }),
            });

            if (!response.ok) {
              let message = "Unable to update password right now.";
              try {
                const payload = (await response.json()) as ErrorResponsePayload;
                if (typeof payload.message === "string" && payload.message.trim().length > 0) {
                  message = payload.message;
                }
              } catch {
                // keep fallback message when error body is not available
              }

              saveEvent.detail?.respond?.({
                ok: false,
                errorMessage: message,
              });
              return;
            }

            saveEvent.detail?.respond?.({ ok: true });
          } catch {
            saveEvent.detail?.respond?.({
              ok: false,
              errorMessage: "Unable to update password right now.",
            });
          }
        })();
        return;
      }
      case "navigate-settings":
        if (
          state.viewState.screen !== "start" &&
          state.viewState.screen !== "about" &&
          state.viewState.screen !== "history" &&
          state.viewState.screen !== "progress" &&
          state.viewState.screen !== "exercises" &&
          state.viewState.screen !== "exercise-variant-detail"
        ) {
          return;
        }
        state = {
          ...state,
          viewState: { screen: "settings" },
        };
        render();
        return;
      case "navigate-history":
        if (
          state.viewState.screen !== "start" &&
          state.viewState.screen !== "about" &&
          state.viewState.screen !== "settings" &&
          state.viewState.screen !== "progress" &&
          state.viewState.screen !== "exercises" &&
          state.viewState.screen !== "exercise-variant-detail" &&
          state.viewState.screen !== "workout-detail"
        ) {
          return;
        }

        if (state.viewState.screen === "workout-detail" && state.viewState.returnScreen === "progress") {
          state = {
            ...state,
            viewState: { screen: "progress" },
          };
          render();
          return;
        }

        const shouldLoadHistoryData = state.viewState.screen !== "workout-detail";
        const restoreWorkoutId =
          state.viewState.screen === "workout-detail" ? state.viewState.workoutId : state.historyScreen.restoreWorkoutId;

        state = {
          ...state,
          historyScreen: {
            ...state.historyScreen,
            restoreWorkoutId,
          },
          viewState: { screen: "history" },
        };
        render();

        if (shouldLoadHistoryData) {
          void loadHistoryScreenData();
        }
        return;
      case "navigate-progress":
        if (
          state.viewState.screen !== "start" &&
          state.viewState.screen !== "about" &&
          state.viewState.screen !== "settings" &&
          state.viewState.screen !== "history" &&
          state.viewState.screen !== "exercises" &&
          state.viewState.screen !== "exercise-variant-detail"
        ) {
          return;
        }
        state = {
          ...state,
          viewState: { screen: "progress" },
        };
        render();
        void loadProgressScreenData();
        return;
      case "navigate-exercises":
        if (
          state.viewState.screen !== "start" &&
          state.viewState.screen !== "about" &&
          state.viewState.screen !== "settings" &&
          state.viewState.screen !== "history" &&
          state.viewState.screen !== "progress" &&
          state.viewState.screen !== "exercise-variant-detail" &&
          state.viewState.screen !== "workout-detail"
        ) {
          return;
        }
        {
          const shouldLoadExercisesData = state.viewState.screen !== "exercise-variant-detail";
          state = {
            ...state,
            viewState: { screen: "exercises" },
          };
          render();
          if (shouldLoadExercisesData) {
            void loadExercisesScreenData();
          }
        }
        return;
      case "open-exercise-variant-detail": {
        const openedFromExercises = state.viewState.screen === "exercises";
        const openedFromWorkoutDetail = state.viewState.screen === "workout-detail";
        if (!openedFromExercises && !openedFromWorkoutDetail) {
          return;
        }
        const workoutDetailSource =
          state.viewState.screen === "workout-detail"
            ? {
                workoutId: state.viewState.workoutId,
                returnScreen: state.viewState.returnScreen,
              }
            : null;

        const payload = customEvent.detail?.payload as { variantId?: unknown; scrollY?: unknown } | undefined;
        const variantId = typeof payload?.variantId === "string" ? payload.variantId.trim() : "";
        if (variantId.length === 0) {
          return;
        }

        state = {
          ...state,
          exercisesScreen: openedFromExercises
            ? {
                ...state.exercisesScreen,
                restoreScrollY:
                  typeof payload?.scrollY === "number" && Number.isFinite(payload.scrollY) ? Math.max(0, payload.scrollY) : 0,
              }
            : state.exercisesScreen,
          viewState: openedFromWorkoutDetail
            ? {
                screen: "exercise-variant-detail",
                variantId,
                returnScreen: "workout-detail",
                returnWorkoutId: workoutDetailSource?.workoutId,
                ...(workoutDetailSource?.returnScreen
                  ? { returnWorkoutSourceScreen: workoutDetailSource.returnScreen }
                  : {}),
              }
            : { screen: "exercise-variant-detail", variantId, returnScreen: "exercises" },
        };
        render();
        if (openedFromWorkoutDetail && !state.exercisesScreen.hasLoaded && !state.exercisesScreen.isLoading) {
          void loadExercisesScreenData();
        }
        return;
      }
      case "navigate-back-from-variant-detail":
        if (state.viewState.screen !== "exercise-variant-detail") {
          return;
        }
        if (state.viewState.returnScreen === "workout-detail" && typeof state.viewState.returnWorkoutId === "string") {
          const workoutId = state.viewState.returnWorkoutId.trim();
          if (workoutId.length === 0) {
            return;
          }
          state = {
            ...state,
            viewState: {
              screen: "workout-detail",
              workoutId,
              ...(state.viewState.returnWorkoutSourceScreen
                ? { returnScreen: state.viewState.returnWorkoutSourceScreen }
                : {}),
            },
          };
          render();
          return;
        }
        state = {
          ...state,
          viewState: { screen: "exercises" },
        };
        render();
        return;
      case "exercises-restore-complete":
        if (state.exercisesScreen.restoreScrollY === null) {
          return;
        }

        state = {
          ...state,
          exercisesScreen: {
            ...state.exercisesScreen,
            restoreScrollY: null,
          },
        };
        render();
        return;
      case "navigate-about":
        if (
          state.viewState.screen !== "start" &&
          state.viewState.screen !== "settings" &&
          state.viewState.screen !== "history" &&
          state.viewState.screen !== "progress" &&
          state.viewState.screen !== "exercises" &&
          state.viewState.screen !== "exercise-variant-detail" &&
          state.viewState.screen !== "workout-detail"
        ) {
          return;
        }
        state = {
          ...state,
          viewState: { screen: "about" },
        };
        render();
        void loadAboutScreenMetadata();
        return;
      case "navigate-workout":
        if (
          state.viewState.screen !== "settings" &&
          state.viewState.screen !== "about" &&
          state.viewState.screen !== "history" &&
          state.viewState.screen !== "progress" &&
          state.viewState.screen !== "exercises" &&
          state.viewState.screen !== "exercise-variant-detail" &&
          state.viewState.screen !== "workout-detail"
        ) {
          return;
        }
        state = {
          ...state,
          viewState: { screen: "start" },
        };
        render();
        return;
      case "logout":
        stopSecsTimerOnCurrentExercise();
        closeConfirmDialog();
        dispatchLogout();
        return;
      case "open-workout-detail": {
        if (state.viewState.screen !== "history" && state.viewState.screen !== "progress") {
          return;
        }

        const payload = customEvent.detail?.payload as { workoutId?: unknown } | undefined;
        const workoutId = typeof payload?.workoutId === "string" ? payload.workoutId.trim() : "";
        if (workoutId.length === 0) {
          return;
        }

        const openedFromHistory = state.viewState.screen === "history";
        state = {
          ...state,
          historyScreen: openedFromHistory
            ? {
                ...state.historyScreen,
                restoreWorkoutId: workoutId,
              }
            : state.historyScreen,
          workoutDetailScreen: {
            workoutId,
            detail: null,
            isLoading: true,
            errorMessage: null,
          },
          viewState: {
            screen: "workout-detail",
            workoutId,
            ...(openedFromHistory ? {} : { returnScreen: "progress" }),
          },
        };
        render();
        void loadWorkoutDetailScreenData(workoutId);
        return;
      }
      case "history-restore-complete": {
        if (state.historyScreen.restoreWorkoutId === null) {
          return;
        }

        state = {
          ...state,
          historyScreen: {
            ...state.historyScreen,
            restoreWorkoutId: null,
          },
        };
        render();
        return;
      }
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
        stopSecsTimerOnCurrentExercise();
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
        if (state.confirmDialog.message || hasRunningSecsTimerOnCurrentExercise() || hasZeroSecsOnCurrentExercise()) {
          return;
        }
        void orchestrator.persistActiveSet();
        return;
      case "delete-latest-set":
        if (
          state.confirmDialog.message ||
          state.viewState.screen !== "exercise" ||
          !state.workoutPlan ||
          state.workoutSave.isSaving ||
          hasRunningSecsTimerOnCurrentExercise()
        ) {
          return;
        }
        {
          const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
          if (!current || current.isReadOnly || current.completedSets.length === 0) {
            return;
          }
        }
        openConfirmDialog(
          "Delete the latest completed set?",
          "Delete Set",
          orchestrator.persistDeleteLatestSet,
        );
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
            current.selectedTrainingPlanExerciseVariantId !== null && current.selectedStationId === null;
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
            if (current.repetitionKind === "SECS") {
              current.isSecsTimerRunning = false;
              current.activeSet.reps = 0;
              current.activeSetInput.reps = "0";
              render();
              return;
            }

            current.activeSet.reps = clampEditableReps(current.activeSet.reps - 1);
            current.activeSetInput.reps = String(current.activeSet.reps);
            pulseUiFeedback("repsTickToken");
            render();
            return;
          }

          if (action === "increment-reps") {
            if (current.repetitionKind === "SECS") {
              current.isSecsTimerRunning = !current.isSecsTimerRunning;
              render();
              return;
            }

            current.activeSet.reps = clampEditableReps(current.activeSet.reps + 1);
            current.activeSetInput.reps = String(current.activeSet.reps);
            pulseUiFeedback("repsTickToken");
            render();
            return;
          }
        }
        return;
      case "previous-exercise":
        if (
          state.viewState.screen === "exercise" &&
          state.viewState.exerciseIndex > 0 &&
          !state.workoutSave.isSaving &&
          !hasRunningSecsTimerOnCurrentExercise()
        ) {
          const current = state.workoutPlan?.exercises[state.viewState.exerciseIndex];
          if (current?.repetitionKind === "SECS") {
            current.isSecsTimerRunning = false;
          }

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
        if (hasRunningSecsTimerOnCurrentExercise()) {
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
        if (hasRunningSecsTimerOnCurrentExercise()) {
          return;
        }
        requestFinishWorkout();
        return;
      case "cancel-workout":
        stopSecsTimerOnCurrentExercise();
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
            current?.selectedTrainingPlanExerciseVariantId === null
              ? null
              : `${current.selectedTrainingPlanExerciseVariantId}::${current.selectedStationId ?? ""}`;
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
        current.isSecsTimerRunning = false;
        orchestrator.selectFallbackOption(value || null);
        return;
      }

      if (action === "load-input") {
        if (current.repetitionKind === "SECS") {
          current.isSecsTimerRunning = false;
        }
        const trimmedValue = value.trim();
        current.activeSetInput.loadValue = trimmedValue;
        const parsedLoadValue = Number.parseFloat(trimmedValue);
        if (Number.isFinite(parsedLoadValue)) {
          current.activeSet.loadValue = parsedLoadValue;
        }
        render();
        return;
      }

      if (action === "reps-input") {
        if (current.repetitionKind !== "REPS") {
          return;
        }
        const parsedReps = Number.parseInt(value.trim(), 10);
        const nextReps = Number.isFinite(parsedReps) ? clampEditableReps(parsedReps) : minEditableReps;
        current.activeSet.reps = nextReps;
        current.activeSetInput.reps = String(nextReps);
        render();
        return;
      }

      if (action === "secs-input") {
        if (current.repetitionKind !== "SECS") {
          return;
        }

        const nextTotal = parseSecsInputValue(value);

        current.isSecsTimerRunning = false;
        current.activeSet.reps = nextTotal;
        current.activeSetInput.reps = String(nextTotal);
        render();
      }
    }
  });

  render();
  void bootstrapStartScreen();
};
