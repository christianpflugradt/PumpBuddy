import type { AppState } from "./workout-types";

type GetState = () => AppState;
type SetState = (next: AppState) => void;

type Dependencies = {
  getState: GetState;
  setState: SetState;
  render: () => void;
  loadAboutScreenMetadata: () => Promise<void>;
  loadHistoryScreenData: () => Promise<void>;
  loadProgressScreenData: () => Promise<void>;
  loadExercisesScreenData: () => Promise<void>;
  loadGymsScreenData: () => Promise<void>;
  loadGymDetailScreenData: (gymId: string) => Promise<void>;
  loadStationDetailScreenData: (gymId: string, stationId: string) => Promise<void>;
  loadWorkoutDetailScreenData: (workoutId: string) => Promise<void>;
  loadTrainingPlansScreenData: () => Promise<void>;
  loadTrainingPlanDetailScreenData: (
    trainingPlanId: string,
    selectedGymId?: string | null,
  ) => Promise<void>;
};

const isProgressReturnFlow = (state: AppState): boolean => {
  if (state.viewState.screen === "workout-detail") {
    return state.viewState.returnScreen === "progress";
  }

  if (state.viewState.screen === "exercise-variant-detail") {
    return state.viewState.returnWorkoutSourceScreen === "progress";
  }

  return false;
};

const clearProgressSelection = (state: AppState): AppState => {
  if ((state.progressScreen.selectedWorkoutId ?? null) === null) {
    return state;
  }

  return {
    ...state,
    progressScreen: {
      ...state.progressScreen,
      selectedWorkoutId: null,
    },
  };
};

const shouldClearProgressSelection = (state: AppState): boolean =>
  state.viewState.screen === "progress" || isProgressReturnFlow(state);

const canNavigateFromScreen = (state: AppState): boolean =>
  state.viewState.screen === "start" ||
  state.viewState.screen === "about" ||
  state.viewState.screen === "settings" ||
  state.viewState.screen === "history" ||
  state.viewState.screen === "progress" ||
  state.viewState.screen === "exercises" ||
  state.viewState.screen === "gyms" ||
  state.viewState.screen === "training-plans" ||
  state.viewState.screen === "training-plan-detail" ||
  state.viewState.screen === "training-plan-exercise-detail" ||
  state.viewState.screen === "gym-detail" ||
  state.viewState.screen === "station-detail" ||
  state.viewState.screen === "exercise-variant-detail" ||
  state.viewState.screen === "workout-detail";

const findGymVariant = (state: AppState, variantId: string) => {
  const detail = state.gymDetailScreen.detail;
  if (!detail) {
    return null;
  }

  for (const group of detail.exercise_groups) {
    const variant = group.variants.find((candidate) => candidate.variant_id === variantId) ?? null;
    if (variant) {
      return { group, variant };
    }
  }

  return null;
};

const findStationVariant = (state: AppState, variantId: string) => {
  const detail = state.stationDetailScreen.detail;
  if (!detail) {
    return null;
  }

  for (const group of detail.suitable_variant_groups) {
    const variant = group.variants.find((candidate) => candidate.variant_id === variantId) ?? null;
    if (variant) {
      return { group, variant };
    }
  }

  return null;
};

export const handleScreenNavigationAction = (
  event: Event,
  action: string,
  deps: Dependencies,
): boolean => {
  const {
    getState,
    setState,
    render,
    loadAboutScreenMetadata,
    loadHistoryScreenData,
    loadProgressScreenData,
    loadExercisesScreenData,
    loadGymsScreenData,
    loadGymDetailScreenData,
    loadStationDetailScreenData,
    loadWorkoutDetailScreenData,
    loadTrainingPlansScreenData,
    loadTrainingPlanDetailScreenData,
  } = deps;

  const openStationDetail = (state: AppState, gymId: string, stationId: string): void => {
    setState({
      ...state,
      gymDetailScreen: {
        ...state.gymDetailScreen,
        stationChooser: null,
      },
      stationDetailScreen: {
        gymId,
        stationId,
        detail: null,
        isLoading: true,
        errorMessage: null,
        loadProfilePopupOpen: false,
      },
      viewState: { screen: "station-detail", gymId, stationId },
    });
    render();
    void loadStationDetailScreenData(gymId, stationId);
  };

  switch (action) {
    case "navigate-settings": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;
      setState({
        ...nextState,
        viewState: { screen: "settings" },
      });
      render();
      return true;
    }
    case "navigate-history": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }

      if (state.viewState.screen === "workout-detail" && state.viewState.returnScreen === "progress") {
        setState({
          ...state,
          viewState: { screen: "progress" },
        });
        render();
        return true;
      }

      const shouldLoadHistoryData = state.viewState.screen !== "workout-detail";
      const restoreWorkoutId =
        state.viewState.screen === "workout-detail" ? state.viewState.workoutId : state.historyScreen.restoreWorkoutId;
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;

      setState({
        ...nextState,
        historyScreen: {
          ...nextState.historyScreen,
          restoreWorkoutId,
        },
        viewState: { screen: "history" },
      });
      render();

      if (shouldLoadHistoryData) {
        void loadHistoryScreenData();
      }
      return true;
    }
    case "navigate-progress": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }
      setState({
        ...state,
        viewState: { screen: "progress" },
      });
      render();
      void loadProgressScreenData();
      return true;
    }
    case "navigate-exercises": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }

      const shouldLoadExercisesData = state.viewState.screen !== "exercise-variant-detail";
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;
      setState({
        ...nextState,
        viewState: { screen: "exercises" },
      });
      render();
      if (shouldLoadExercisesData) {
        void loadExercisesScreenData();
      }
      return true;
    }
    case "navigate-gyms": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;
      setState({
        ...nextState,
        viewState: { screen: "gyms" },
      });
      render();
      void loadGymsScreenData();
      return true;
    }
    case "navigate-training-plans": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;
      setState({
        ...nextState,
        viewState: { screen: "training-plans" },
      });
      render();
      void loadTrainingPlansScreenData();
      return true;
    }
    case "open-training-plan-detail": {
      const state = getState();
      if (state.viewState.screen !== "training-plans") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as
        | { trainingPlanId?: unknown; selectedGymId?: unknown }
        | undefined;
      const trainingPlanId =
        typeof payload?.trainingPlanId === "string" ? payload.trainingPlanId.trim() : "";
      const selectedGymId =
        typeof payload?.selectedGymId === "string" && payload.selectedGymId.trim().length > 0
          ? payload.selectedGymId.trim()
          : null;
      if (trainingPlanId.length === 0) {
        return true;
      }

      setState({
        ...state,
        viewState: { screen: "training-plan-detail", trainingPlanId, selectedGymId },
      });
      render();
      void loadTrainingPlanDetailScreenData(trainingPlanId, selectedGymId);
      return true;
    }
    case "open-training-plan-exercise-detail": {
      const state = getState();
      if (state.viewState.screen !== "training-plan-detail") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { trainingPlanExerciseId?: unknown } | undefined;
      const trainingPlanExerciseId =
        typeof payload?.trainingPlanExerciseId === "string"
          ? payload.trainingPlanExerciseId.trim()
          : "";
      if (trainingPlanExerciseId.length === 0) {
        return true;
      }

      setState({
        ...state,
        viewState: {
          screen: "training-plan-exercise-detail",
          trainingPlanId: state.viewState.trainingPlanId,
          trainingPlanExerciseId,
          selectedGymId: state.viewState.selectedGymId,
        },
      });
      render();
      return true;
    }
    case "navigate-back-from-training-plan-detail": {
      const state = getState();
      if (state.viewState.screen !== "training-plan-detail") {
        return true;
      }

      setState({
        ...state,
        viewState: { screen: "training-plans" },
      });
      render();
      return true;
    }
    case "navigate-back-from-training-plan-exercise-detail": {
      const state = getState();
      if (state.viewState.screen !== "training-plan-exercise-detail") {
        return true;
      }

      setState({
        ...state,
        viewState: {
          screen: "training-plan-detail",
          trainingPlanId: state.viewState.trainingPlanId,
          selectedGymId: state.viewState.selectedGymId,
        },
      });
      render();
      return true;
    }
    case "open-gym-detail": {
      const state = getState();
      if (state.viewState.screen !== "gyms") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { gymId?: unknown } | undefined;
      const gymId = typeof payload?.gymId === "string" ? payload.gymId.trim() : "";
      if (gymId.length === 0) {
        return true;
      }

      setState({
        ...state,
        gymDetailScreen: {
          gymId,
          detail: null,
          activeSheet: "stations",
          isLoading: true,
          errorMessage: null,
          stationChooser: null,
        },
        viewState: { screen: "gym-detail", gymId },
      });
      render();
      void loadGymDetailScreenData(gymId);
      return true;
    }
    case "switch-gym-detail-sheet": {
      const state = getState();
      if (state.viewState.screen !== "gym-detail") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { sheet?: unknown } | undefined;
      const sheet = payload?.sheet === "exercises" ? "exercises" : payload?.sheet === "stations" ? "stations" : null;
      if (!sheet) {
        return true;
      }

      setState({
        ...state,
        gymDetailScreen: {
          ...state.gymDetailScreen,
          activeSheet: sheet,
          stationChooser: null,
        },
      });
      render();
      return true;
    }
    case "open-station-detail": {
      const state = getState();
      if (state.viewState.screen !== "gym-detail") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { stationId?: unknown } | undefined;
      const stationId = typeof payload?.stationId === "string" ? payload.stationId.trim() : "";
      if (stationId.length === 0) {
        return true;
      }

      openStationDetail(state, state.viewState.gymId, stationId);
      return true;
    }
    case "open-gym-variant": {
      const state = getState();
      if (state.viewState.screen !== "gym-detail") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { variantId?: unknown } | undefined;
      const variantId = typeof payload?.variantId === "string" ? payload.variantId.trim() : "";
      if (variantId.length === 0) {
        return true;
      }

      const match = findGymVariant(state, variantId);
      if (!match) {
        return true;
      }

      const stationOptions = [...(match.variant.station_options ?? [])]
        .filter((option) => option.station_id.trim().length > 0)
        .sort((left, right) => left.station_name.localeCompare(right.station_name));
      if (stationOptions.length === 0 || match.variant.station_availability === "STATIONLESS") {
        setState({
          ...state,
          gymDetailScreen: {
            ...state.gymDetailScreen,
            stationChooser: null,
          },
          viewState: {
            screen: "exercise-variant-detail",
            variantId,
            returnScreen: "gym-detail",
            returnGymId: state.viewState.gymId,
            fallbackExerciseName: match.group.exercise_name,
            fallbackVariantName: match.variant.variant_name,
          },
        });
        render();
        return true;
      }

      if (stationOptions.length === 1) {
        openStationDetail(state, state.viewState.gymId, stationOptions[0]!.station_id);
        return true;
      }

      setState({
        ...state,
        gymDetailScreen: {
          ...state.gymDetailScreen,
          stationChooser: {
            variantId,
            exerciseName: match.group.exercise_name,
            variantName: match.variant.variant_name,
            stationOptions,
          },
        },
      });
      render();
      return true;
    }
    case "choose-gym-variant-station": {
      const state = getState();
      if (state.viewState.screen !== "gym-detail" || !state.gymDetailScreen.stationChooser) {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { stationId?: unknown } | undefined;
      const stationId = typeof payload?.stationId === "string" ? payload.stationId.trim() : "";
      const isKnownStation = state.gymDetailScreen.stationChooser.stationOptions.some(
        (option) => option.station_id === stationId,
      );
      if (!isKnownStation) {
        return true;
      }

      openStationDetail(state, state.viewState.gymId, stationId);
      return true;
    }
    case "dismiss-gym-station-chooser": {
      const state = getState();
      if (!state.gymDetailScreen.stationChooser) {
        return true;
      }

      setState({
        ...state,
        gymDetailScreen: {
          ...state.gymDetailScreen,
          stationChooser: null,
        },
      });
      render();
      return true;
    }
    case "open-station-load-profile": {
      const state = getState();
      if (state.viewState.screen !== "station-detail") {
        return true;
      }

      setState({
        ...state,
        stationDetailScreen: {
          ...state.stationDetailScreen,
          loadProfilePopupOpen: true,
        },
      });
      render();
      return true;
    }
    case "dismiss-station-load-profile": {
      const state = getState();
      if (state.viewState.screen !== "station-detail" || !state.stationDetailScreen.loadProfilePopupOpen) {
        return true;
      }

      setState({
        ...state,
        stationDetailScreen: {
          ...state.stationDetailScreen,
          loadProfilePopupOpen: false,
        },
      });
      render();
      return true;
    }
    case "open-station-variant-detail": {
      const state = getState();
      if (state.viewState.screen !== "station-detail") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { variantId?: unknown } | undefined;
      const variantId = typeof payload?.variantId === "string" ? payload.variantId.trim() : "";
      if (variantId.length === 0) {
        return true;
      }

      const match = findStationVariant(state, variantId);
      if (!match) {
        return true;
      }

      setState({
        ...state,
        stationDetailScreen: {
          ...state.stationDetailScreen,
          loadProfilePopupOpen: false,
        },
        viewState: {
          screen: "exercise-variant-detail",
          variantId,
          returnScreen: "station-detail",
          returnGymId: state.viewState.gymId,
          returnStationId: state.viewState.stationId,
          fallbackExerciseName: match.group.exercise_name,
          fallbackVariantName: match.variant.variant_name,
        },
      });
      render();
      return true;
    }
    case "open-exercise-variant-detail": {
      const state = getState();
      const openedFromExercises = state.viewState.screen === "exercises";
      const openedFromWorkoutDetail = state.viewState.screen === "workout-detail";
      if (!openedFromExercises && !openedFromWorkoutDetail) {
        return true;
      }
      const workoutDetailSource =
        state.viewState.screen === "workout-detail"
          ? {
              workoutId: state.viewState.workoutId,
              returnScreen: state.viewState.returnScreen,
            }
          : null;

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { variantId?: unknown; scrollY?: unknown } | undefined;
      const variantId = typeof payload?.variantId === "string" ? payload.variantId.trim() : "";
      if (variantId.length === 0) {
        return true;
      }

      const nextState = {
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
              screen: "exercise-variant-detail" as const,
              variantId,
              returnScreen: "workout-detail" as const,
              returnWorkoutId: workoutDetailSource?.workoutId,
              ...(workoutDetailSource?.returnScreen
                ? { returnWorkoutSourceScreen: workoutDetailSource.returnScreen }
                : {}),
            }
          : { screen: "exercise-variant-detail" as const, variantId, returnScreen: "exercises" as const },
      };
      setState(nextState);
      render();
      if (openedFromWorkoutDetail && !nextState.exercisesScreen.hasLoaded && !nextState.exercisesScreen.isLoading) {
        void loadExercisesScreenData();
      }
      return true;
    }
    case "navigate-back-from-variant-detail": {
      const state = getState();
      if (state.viewState.screen !== "exercise-variant-detail") {
        return true;
      }
      if (
        state.viewState.returnScreen === "station-detail" &&
        typeof state.viewState.returnGymId === "string" &&
        typeof state.viewState.returnStationId === "string"
      ) {
        const gymId = state.viewState.returnGymId.trim();
        const stationId = state.viewState.returnStationId.trim();
        if (gymId.length === 0 || stationId.length === 0) {
          return true;
        }
        setState({
          ...state,
          stationDetailScreen: {
            ...state.stationDetailScreen,
            loadProfilePopupOpen: false,
          },
          viewState: { screen: "station-detail", gymId, stationId },
        });
        render();
        return true;
      }
      if (state.viewState.returnScreen === "gym-detail" && typeof state.viewState.returnGymId === "string") {
        const gymId = state.viewState.returnGymId.trim();
        if (gymId.length === 0) {
          return true;
        }
        setState({
          ...state,
          viewState: { screen: "gym-detail", gymId },
        });
        render();
        return true;
      }
      if (state.viewState.returnScreen === "workout-detail" && typeof state.viewState.returnWorkoutId === "string") {
        const workoutId = state.viewState.returnWorkoutId.trim();
        if (workoutId.length === 0) {
          return true;
        }
        setState({
          ...state,
          viewState: {
            screen: "workout-detail",
            workoutId,
            ...(state.viewState.returnWorkoutSourceScreen
              ? { returnScreen: state.viewState.returnWorkoutSourceScreen }
              : {}),
          },
        });
        render();
        return true;
      }
      setState({
        ...state,
        viewState: { screen: "exercises" },
      });
      render();
      return true;
    }
    case "navigate-back-from-station-detail": {
      const state = getState();
      if (state.viewState.screen !== "station-detail") {
        return true;
      }

      setState({
        ...state,
        stationDetailScreen: {
          ...state.stationDetailScreen,
          loadProfilePopupOpen: false,
        },
        viewState: { screen: "gym-detail", gymId: state.viewState.gymId },
      });
      render();
      return true;
    }
    case "exercises-restore-complete": {
      const state = getState();
      if (state.exercisesScreen.restoreScrollY === null) {
        return true;
      }

      setState({
        ...state,
        exercisesScreen: {
          ...state.exercisesScreen,
          restoreScrollY: null,
        },
      });
      render();
      return true;
    }
    case "navigate-about": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;
      setState({
        ...nextState,
        viewState: { screen: "about" },
      });
      render();
      void loadAboutScreenMetadata();
      return true;
    }
    case "navigate-workout": {
      const state = getState();
      if (!canNavigateFromScreen(state)) {
        return true;
      }
      const nextState = shouldClearProgressSelection(state) ? clearProgressSelection(state) : state;
      setState({
        ...nextState,
        viewState: { screen: "start" },
      });
      render();
      return true;
    }
    case "open-workout-detail": {
      const state = getState();
      if (state.viewState.screen !== "history" && state.viewState.screen !== "progress") {
        return true;
      }

      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      const payload = customEvent.detail?.payload as { workoutId?: unknown } | undefined;
      const workoutId = typeof payload?.workoutId === "string" ? payload.workoutId.trim() : "";
      if (workoutId.length === 0) {
        return true;
      }

      const openedFromHistory = state.viewState.screen === "history";
      setState({
        ...state,
        progressScreen: openedFromHistory
          ? state.progressScreen
          : {
              ...state.progressScreen,
              selectedWorkoutId: workoutId,
            },
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
      });
      render();
      void loadWorkoutDetailScreenData(workoutId);
      return true;
    }
    case "history-restore-complete": {
      const state = getState();
      if (state.historyScreen.restoreWorkoutId === null) {
        return true;
      }

      setState({
        ...state,
        historyScreen: {
          ...state.historyScreen,
          restoreWorkoutId: null,
        },
      });
      render();
      return true;
    }
    default:
      return false;
  }
};
