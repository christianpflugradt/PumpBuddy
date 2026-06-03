import {
  loadAboutMetadata,
  loadGymDetail,
  loadGymSummaries,
  loadStationDetail,
  loadTrainingPlanDetail,
  loadTrainingPlanSummaries,
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
  loadStationDetailScreenData: (gymId: string, stationId: string) => Promise<void>;
  loadWorkoutDetailScreenData: (workoutId: string) => Promise<void>;
  loadTrainingPlansScreenData: () => Promise<void>;
  loadTrainingPlanDetailScreenData: (
    trainingPlanId: string,
    selectedGymId?: string | null,
  ) => Promise<void>;
} => {
  const { getState, setState, render, fetchJson } = deps;
  let workoutDetailLoadToken = 0;
  let gymDetailLoadToken = 0;
  let stationDetailLoadToken = 0;
  let trainingPlanDetailLoadToken = 0;

  const normalizeOptionalId = (id?: string | null): string | null => {
    const normalizedId = id?.trim() ?? "";
    return normalizedId.length > 0 ? normalizedId : null;
  };

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

  const loadTrainingPlansScreenData = async (): Promise<void> => {
    const state = getState();
    if (state.trainingPlansScreen.isLoading) {
      return;
    }

    setState({
      ...state,
      trainingPlansScreen: {
        ...state.trainingPlansScreen,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const trainingPlans = await loadTrainingPlanSummaries(fetchJson);
      const nextState = getState();
      setState({
        ...nextState,
        trainingPlansScreen: {
          ...nextState.trainingPlansScreen,
          trainingPlans,
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
        trainingPlansScreen: {
          ...nextState.trainingPlansScreen,
          isLoading: false,
          errorMessage: "Unable to load training plans right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadTrainingPlanDetailScreenData = async (
    trainingPlanId: string,
    selectedGymId?: string | null,
  ): Promise<void> => {
    const normalizedTrainingPlanId = trainingPlanId.trim();
    if (!normalizedTrainingPlanId) {
      return;
    }

    const normalizedGymId = normalizeOptionalId(selectedGymId);
    const requestToken = ++trainingPlanDetailLoadToken;
    const state = getState();
    setState({
      ...state,
      trainingPlansScreen: {
        ...state.trainingPlansScreen,
        selectedTrainingPlanId: normalizedTrainingPlanId,
        selectedGymId: normalizedGymId,
      },
      trainingPlanDetailScreen: {
        trainingPlanId: normalizedTrainingPlanId,
        selectedGymId: normalizedGymId,
        detail: null,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const detail = await loadTrainingPlanDetail(fetchJson, normalizedTrainingPlanId, normalizedGymId);
      if (requestToken !== trainingPlanDetailLoadToken) {
        return;
      }

      const nextState = getState();
      if (
        nextState.trainingPlanDetailScreen.trainingPlanId !== normalizedTrainingPlanId ||
        nextState.trainingPlanDetailScreen.selectedGymId !== normalizedGymId
      ) {
        return;
      }

      setState({
        ...nextState,
        trainingPlanDetailScreen: {
          trainingPlanId: normalizedTrainingPlanId,
          selectedGymId: normalizedGymId,
          detail,
          isLoading: false,
          errorMessage: null,
        },
      });
      render();
    } catch {
      if (requestToken !== trainingPlanDetailLoadToken) {
        return;
      }

      const nextState = getState();
      if (
        nextState.trainingPlanDetailScreen.trainingPlanId !== normalizedTrainingPlanId ||
        nextState.trainingPlanDetailScreen.selectedGymId !== normalizedGymId
      ) {
        return;
      }

      setState({
        ...nextState,
        trainingPlanDetailScreen: {
          trainingPlanId: normalizedTrainingPlanId,
          selectedGymId: normalizedGymId,
          detail: null,
          isLoading: false,
          errorMessage: "Unable to load training plan detail right now.",
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

  const loadStationDetailScreenData = async (gymId: string, stationId: string): Promise<void> => {
    if (!gymId.trim() || !stationId.trim()) {
      return;
    }

    const requestToken = ++stationDetailLoadToken;
    const state = getState();
    setState({
      ...state,
      stationDetailScreen: {
        gymId,
        stationId,
        detail: null,
        isLoading: true,
        errorMessage: null,
        loadProfilePopupOpen: false,
      },
    });
    render();

    try {
      const detail = await loadStationDetail(fetchJson, gymId, stationId);
      if (requestToken !== stationDetailLoadToken) {
        return;
      }

      setState({
        ...getState(),
        stationDetailScreen: {
          gymId,
          stationId,
          detail,
          isLoading: false,
          errorMessage: null,
          loadProfilePopupOpen: false,
        },
      });
      render();
    } catch {
      if (requestToken !== stationDetailLoadToken) {
        return;
      }

      setState({
        ...getState(),
        stationDetailScreen: {
          gymId,
          stationId,
          detail: null,
          isLoading: false,
          errorMessage: "Unable to load station detail right now.",
          loadProfilePopupOpen: false,
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
    loadStationDetailScreenData,
    loadWorkoutDetailScreenData,
    loadTrainingPlansScreenData,
    loadTrainingPlanDetailScreenData,
  };
};
