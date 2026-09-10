import {
  loadAboutMetadata,
  loadConfiguratorStations,
  loadConfiguratorExerciseVariants,
  loadExerciseSummaries,
  loadGymDetail,
  loadGymSummaries,
  loadLoadProfileDetail,
  loadLoadProfileSummaries,
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
  loadConfiguratorOverviewScreenData: () => Promise<void>;
  loadConfiguratorLoadProfilesScreenData: () => Promise<void>;
  loadConfiguratorGymsScreenData: () => Promise<void>;
  loadConfiguratorExercisesScreenData: () => Promise<void>;
  loadConfiguratorExerciseDetailScreenData: (exerciseId: string) => Promise<void>;
  loadConfiguratorGymDetailScreenData: (gymId: string) => Promise<void>;
  loadConfiguratorLoadProfileDetailScreenData: (
    loadProfileId: string,
  ) => Promise<void>;
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
    selectedVersionNumber?: number | null,
  ) => Promise<void>;
} => {
  const { getState, setState, render, fetchJson } = deps;
  let workoutDetailLoadToken = 0;
  let configuratorOverviewToken = 0;
  let configuratorLoadProfilesToken = 0;
  let configuratorGymsToken = 0;
  let configuratorExercisesToken = 0;
  let configuratorExerciseDetailToken = 0;
  let configuratorGymDetailToken = 0;
  let configuratorLoadProfileDetailToken = 0;
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

  const loadConfiguratorOverviewScreenData = async (): Promise<void> => {
    const requestToken = ++configuratorOverviewToken;
    const state = getState();
    const current = state.configuratorOverviewScreen;
    if (current?.isLoading) {
      return;
    }

    setState({
      ...state,
      configuratorOverviewScreen: {
        counts: current?.counts ?? {
          loadProfiles: 0,
          gyms: 0,
          stations: 0,
          exercises: 0,
          exerciseVariants: 0,
        },
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const [loadProfiles, gyms, exercises] = await Promise.all([
        loadLoadProfileSummaries(fetchJson),
        loadGymSummaries(fetchJson),
        loadExerciseSummaries(fetchJson),
      ]);
      const stationLists = await Promise.all(
        gyms.map((gym) => loadConfiguratorStations(fetchJson, gym.id)),
      );
      if (requestToken !== configuratorOverviewToken) {
        return;
      }

      setState({
        ...getState(),
        configuratorOverviewScreen: {
          counts: {
            loadProfiles: loadProfiles.length,
            gyms: gyms.length,
            stations: stationLists.reduce((total, stations) => total + stations.length, 0),
            exercises: exercises.length,
            exerciseVariants: exercises.reduce(
              (total, exercise) => total + exercise.variant_count,
              0,
            ),
          },
          isLoading: false,
          errorMessage: null,
        },
      });
      render();
    } catch {
      if (requestToken !== configuratorOverviewToken) {
        return;
      }
      const nextState = getState();
      setState({
        ...nextState,
        configuratorOverviewScreen: {
          counts: nextState.configuratorOverviewScreen?.counts ?? {
            loadProfiles: 0,
            gyms: 0,
            stations: 0,
            exercises: 0,
            exerciseVariants: 0,
          },
          isLoading: false,
          errorMessage: "Unable to load configurator overview right now.",
        },
      });
      render();
    }
  };

  const loadConfiguratorLoadProfilesScreenData = async (): Promise<void> => {
    const requestToken = ++configuratorLoadProfilesToken;
    const state = getState();
    const current = state.configuratorLoadProfilesScreen;
    if (current?.isLoading) {
      return;
    }

    setState({
      ...state,
      configuratorLoadProfilesScreen: {
        loadProfiles: current?.loadProfiles ?? [],
        isLoading: true,
        errorMessage: null,
        hasLoaded: current?.hasLoaded ?? false,
      },
    });
    render();

    try {
      const loadProfiles = await loadLoadProfileSummaries(fetchJson);
      if (requestToken !== configuratorLoadProfilesToken) {
        return;
      }

      setState({
        ...getState(),
        configuratorLoadProfilesScreen: {
          loadProfiles,
          isLoading: false,
          errorMessage: null,
          hasLoaded: true,
        },
      });
      render();
    } catch {
      if (requestToken !== configuratorLoadProfilesToken) {
        return;
      }

      const nextState = getState();
      setState({
        ...nextState,
        configuratorLoadProfilesScreen: {
          loadProfiles: nextState.configuratorLoadProfilesScreen?.loadProfiles ?? [],
          isLoading: false,
          errorMessage: "Unable to load load profiles right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadConfiguratorGymsScreenData = async (): Promise<void> => {
    const requestToken = ++configuratorGymsToken;
    const state = getState();
    const current = state.configuratorGymsScreen;
    if (current?.isLoading) {
      return;
    }

    setState({
      ...state,
      configuratorGymsScreen: {
        gyms: current?.gyms ?? [],
        isLoading: true,
        errorMessage: null,
        hasLoaded: current?.hasLoaded ?? false,
      },
    });
    render();

    try {
      const gyms = await loadGymSummaries(fetchJson);
      if (requestToken !== configuratorGymsToken) {
        return;
      }
      setState({
        ...getState(),
        configuratorGymsScreen: { gyms, isLoading: false, errorMessage: null, hasLoaded: true },
      });
      render();
    } catch {
      if (requestToken !== configuratorGymsToken) {
        return;
      }
      const nextState = getState();
      setState({
        ...nextState,
        configuratorGymsScreen: {
          gyms: nextState.configuratorGymsScreen?.gyms ?? [],
          isLoading: false,
          errorMessage: "Unable to load gyms right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadConfiguratorExercisesScreenData = async (): Promise<void> => {
    const requestToken = ++configuratorExercisesToken;
    const state = getState();
    const current = state.configuratorExercisesScreen;
    if (current?.isLoading) return;

    setState({
      ...state,
      configuratorExercisesScreen: {
        exercises: current?.exercises ?? [],
        isLoading: true,
        errorMessage: null,
        hasLoaded: current?.hasLoaded ?? false,
      },
    });
    render();

    try {
      const exercises = await loadExerciseSummaries(fetchJson);
      if (requestToken !== configuratorExercisesToken) return;
      setState({
        ...getState(),
        configuratorExercisesScreen: { exercises, isLoading: false, errorMessage: null, hasLoaded: true },
      });
      render();
    } catch {
      if (requestToken !== configuratorExercisesToken) return;
      const nextState = getState();
      setState({
        ...nextState,
        configuratorExercisesScreen: {
          exercises: nextState.configuratorExercisesScreen?.exercises ?? [],
          isLoading: false,
          errorMessage: "Unable to load exercises right now.",
          hasLoaded: false,
        },
      });
      render();
    }
  };

  const loadConfiguratorExerciseDetailScreenData = async (exerciseId: string): Promise<void> => {
    const token = ++configuratorExerciseDetailToken;
    setState({ ...getState(), configuratorExerciseDetailScreen: { exerciseId, variants: [], isLoading: true, errorMessage: null } });
    render();
    try {
      const variants = await loadConfiguratorExerciseVariants(fetchJson, exerciseId);
      if (token !== configuratorExerciseDetailToken) return;
      setState({ ...getState(), configuratorExerciseDetailScreen: { exerciseId, variants, isLoading: false, errorMessage: null } });
      render();
    } catch {
      if (token !== configuratorExerciseDetailToken) return;
      setState({ ...getState(), configuratorExerciseDetailScreen: { exerciseId, variants: [], isLoading: false, errorMessage: "Unable to load Variants right now." } });
      render();
    }
  };

  const loadConfiguratorGymDetailScreenData = async (gymId: string): Promise<void> => {
    if (!gymId.trim()) return;
    const requestToken = ++configuratorGymDetailToken;
    setState({ ...getState(), configuratorGymDetailScreen: { gymId, detail: null, stations: [], isLoading: true, errorMessage: null } });
    render();
    try {
      const [detail, stations] = await Promise.all([
        loadGymDetail(fetchJson, gymId),
        loadConfiguratorStations(fetchJson, gymId),
      ]);
      if (requestToken !== configuratorGymDetailToken) return;
      setState({ ...getState(), configuratorGymDetailScreen: { gymId, detail, stations, isLoading: false, errorMessage: null } });
    } catch {
      if (requestToken !== configuratorGymDetailToken) return;
      setState({ ...getState(), configuratorGymDetailScreen: { gymId, detail: null, stations: [], isLoading: false, errorMessage: "Unable to load Gym right now." } });
    }
    render();
  };

  const loadConfiguratorLoadProfileDetailScreenData = async (
    loadProfileId: string,
  ): Promise<void> => {
    if (!loadProfileId.trim()) {
      return;
    }

    const requestToken = ++configuratorLoadProfileDetailToken;
    const state = getState();
    setState({
      ...state,
      configuratorLoadProfileDetailScreen: {
        loadProfileId,
        detail: null,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const detail = await loadLoadProfileDetail(fetchJson, loadProfileId);
      if (requestToken !== configuratorLoadProfileDetailToken) {
        return;
      }

      setState({
        ...getState(),
        configuratorLoadProfileDetailScreen: {
          loadProfileId,
          detail,
          isLoading: false,
          errorMessage: null,
        },
      });
      render();
    } catch {
      if (requestToken !== configuratorLoadProfileDetailToken) {
        return;
      }

      setState({
        ...getState(),
        configuratorLoadProfileDetailScreen: {
          loadProfileId,
          detail: null,
          isLoading: false,
          errorMessage: "Unable to load load profile detail right now.",
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
    selectedVersionNumber?: number | null,
  ): Promise<void> => {
    const normalizedTrainingPlanId = trainingPlanId.trim();
    if (!normalizedTrainingPlanId) {
      return;
    }

    const normalizedGymId = normalizeOptionalId(selectedGymId);
    const normalizedVersionNumber =
      Number.isInteger(selectedVersionNumber) && (selectedVersionNumber ?? 0) > 0
        ? selectedVersionNumber ?? null
        : null;
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
        selectedVersionNumber: normalizedVersionNumber,
        detail: null,
        isLoading: true,
        errorMessage: null,
      },
    });
    render();

    try {
      const detail = await loadTrainingPlanDetail(
        fetchJson,
        normalizedTrainingPlanId,
        normalizedGymId,
        normalizedVersionNumber,
      );
      if (requestToken !== trainingPlanDetailLoadToken) {
        return;
      }

      const nextState = getState();
      if (
        nextState.trainingPlanDetailScreen.trainingPlanId !== normalizedTrainingPlanId ||
        nextState.trainingPlanDetailScreen.selectedGymId !== normalizedGymId ||
        nextState.trainingPlanDetailScreen.selectedVersionNumber !== normalizedVersionNumber
      ) {
        return;
      }

      setState({
        ...nextState,
        trainingPlanDetailScreen: {
          trainingPlanId: normalizedTrainingPlanId,
          selectedGymId: normalizedGymId,
          selectedVersionNumber: normalizedVersionNumber,
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
        nextState.trainingPlanDetailScreen.selectedGymId !== normalizedGymId ||
        nextState.trainingPlanDetailScreen.selectedVersionNumber !== normalizedVersionNumber
      ) {
        return;
      }

      setState({
        ...nextState,
        trainingPlanDetailScreen: {
          trainingPlanId: normalizedTrainingPlanId,
          selectedGymId: normalizedGymId,
          selectedVersionNumber: normalizedVersionNumber,
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
    loadConfiguratorOverviewScreenData,
    loadConfiguratorLoadProfilesScreenData,
    loadConfiguratorGymsScreenData,
    loadConfiguratorExercisesScreenData,
    loadConfiguratorExerciseDetailScreenData,
    loadConfiguratorGymDetailScreenData,
    loadConfiguratorLoadProfileDetailScreenData,
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
