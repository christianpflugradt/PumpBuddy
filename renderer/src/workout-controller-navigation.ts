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
  loadWorkoutDetailScreenData: (workoutId: string) => Promise<void>;
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
  state.viewState.screen === "gym-detail" ||
  state.viewState.screen === "exercise-variant-detail" ||
  state.viewState.screen === "workout-detail";

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
    loadWorkoutDetailScreenData,
  } = deps;

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
        viewState: { screen: "gym-detail", gymId },
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
