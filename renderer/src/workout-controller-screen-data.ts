import {
  loadAboutMetadata,
  loadGymDetail,
  loadGymSummaries,
  loadWorkoutDetail,
  loadWorkoutExercisesPerformance,
  loadWorkoutHistory,
  loadWorkoutProgress,
  type FetchJson,
} from "./workout-api";
import type { AppState } from "./workout-types";

type GetState = () => AppState;
type SetState = (next: AppState) => void;

type Dependencies = {
  getState: GetState;
  setState: SetState;
  render: () => void;
  fetchJson: FetchJson;
};

export const createScreenDataController = (deps: Dependencies): {
  loadAboutScreenMetadata: () => Promise<void>;
  loadHistoryScreenData: () => Promise<void>;
  loadProgressScreenData: () => Promise<void>;
  loadExercisesScreenData: () => Promise<void>;
  loadGymsScreenData: () => Promise<void>;
  loadGymDetailScreenData: (gymId: string) => Promise<void>;
  loadWorkoutDetailScreenData: (workoutId: string) => Promise<void>;
} => {
  const { getState, setState, render, fetchJson } = deps;
  let workoutDetailLoadToken = 0;
  let gymDetailLoadToken = 0;

  const loadWorkoutDetailScreenData = async (workoutId: string): Promise<void> => {
    if (!workoutId.trim()) {
      return;
    }

    const requestToken = ++workoutDetailLoadToken;
    const state = getState();

    setState({
      ...state,
      workoutDetailScreen: {
        workoutId,
        detail: null,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const detail = await loadWorkoutDetail(fetchJson, workoutId);
      if (requestToken !== workoutDetailLoadToken) {
        return;
      }

      setState({
        ...getState(),
        workoutDetailScreen: {
          workoutId,
          detail,
          isLoading: false,
          errorMessage: null,
        },
      });
      render();
    } catch {
      if (requestToken !== workoutDetailLoadToken) {
        return;
      }

      setState({
        ...getState(),
        workoutDetailScreen: {
          workoutId,
          detail: null,
          isLoading: false,
          errorMessage: "Unable to load workout detail right now.",
        },
      });
      render();
    }
  };

  const loadAboutScreenMetadata = async (): Promise<void> => {
    const state = getState();
    if (state.aboutScreen?.metadata) {
      return;
    }

    try {
      const metadata = await loadAboutMetadata(fetchJson);
      setState({
        ...state,
        aboutScreen: {
          metadata,
          errorMessage: null,
        },
      });
      render();
    } catch {
      setState({
        ...state,
        aboutScreen: {
          metadata: null,
          errorMessage: "Unable to load build metadata right now.",
        },
      });
      render();
    }
  };

  const loadHistoryScreenData = async (): Promise<void> => {
    const state = getState();
    if (state.historyScreen.isLoading) {
      return;
    }

    setState({
      ...state,
      historyScreen: {
        ...state.historyScreen,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const workouts = await loadWorkoutHistory(fetchJson);
      setState({
        ...state,
        historyScreen: {
          workouts,
          isLoading: false,
          errorMessage: null,
          hasLoaded: true,
          restoreWorkoutId: state.historyScreen.restoreWorkoutId,
        },
      });
      render();
    } catch {
      setState({
        ...state,
        historyScreen: {
          ...state.historyScreen,
          isLoading: false,
          errorMessage: "Unable to load workout history right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadProgressScreenData = async (): Promise<void> => {
    const state = getState();
    if (state.progressScreen.isLoading) {
      return;
    }

    setState({
      ...state,
      progressScreen: {
        ...state.progressScreen,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await loadWorkoutProgress(fetchJson);
      setState({
        ...state,
        progressScreen: {
          ...state.progressScreen,
          workouts: response.workouts,
          isLoading: false,
          errorMessage: null,
          hasLoaded: true,
        },
      });
      render();
    } catch {
      setState({
        ...state,
        progressScreen: {
          ...state.progressScreen,
          isLoading: false,
          errorMessage: "Unable to load progress right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadExercisesScreenData = async (): Promise<void> => {
    const state = getState();
    if (state.exercisesScreen.isLoading) {
      return;
    }

    setState({
      ...state,
      exercisesScreen: {
        ...state.exercisesScreen,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const response = await loadWorkoutExercisesPerformance(fetchJson);
      setState({
        ...state,
        exercisesScreen: {
          groups: response.groups,
          isLoading: false,
          errorMessage: null,
          hasLoaded: true,
          restoreScrollY: state.exercisesScreen.restoreScrollY,
        },
      });
      render();
    } catch {
      setState({
        ...state,
        exercisesScreen: {
          ...state.exercisesScreen,
          isLoading: false,
          errorMessage: "Unable to load exercises performance right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadGymsScreenData = async (): Promise<void> => {
    const state = getState();
    if (state.gymsScreen.isLoading) {
      return;
    }

    setState({
      ...state,
      gymsScreen: {
        ...state.gymsScreen,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const gyms = await loadGymSummaries(fetchJson);
      const nextState = getState();
      setState({
        ...nextState,
        gymsScreen: {
          gyms,
          isLoading: false,
          errorMessage: null,
          hasLoaded: true,
        },
      });
      render();
    } catch {
      const nextState = getState();
      setState({
        ...nextState,
        gymsScreen: {
          ...nextState.gymsScreen,
          isLoading: false,
          errorMessage: "Unable to load gyms right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadGymDetailScreenData = async (gymId: string): Promise<void> => {
    if (!gymId.trim()) {
      return;
    }

    const requestToken = ++gymDetailLoadToken;
    const state = getState();
    setState({
      ...state,
      gymDetailScreen: {
        ...state.gymDetailScreen,
        gymId,
        detail: null,
        activeSheet: "stations",
        isLoading: true,
        errorMessage: null,
        stationChooser: null,
      },
    });
    render();

    try {
      const detail = await loadGymDetail(fetchJson, gymId);
      if (requestToken !== gymDetailLoadToken) {
        return;
      }

      setState({
        ...getState(),
        gymDetailScreen: {
          gymId,
          detail,
          activeSheet: "stations",
          isLoading: false,
          errorMessage: null,
          stationChooser: null,
        },
      });
      render();
    } catch {
      if (requestToken !== gymDetailLoadToken) {
        return;
      }

      setState({
        ...getState(),
        gymDetailScreen: {
          gymId,
          detail: null,
          activeSheet: "stations",
          isLoading: false,
          errorMessage: "Unable to load gym detail right now.",
          stationChooser: null,
        },
      });
      render();
    }
  };

  return {
    loadAboutScreenMetadata,
    loadHistoryScreenData,
    loadProgressScreenData,
    loadExercisesScreenData,
    loadGymsScreenData,
    loadGymDetailScreenData,
    loadWorkoutDetailScreenData,
  };
};
