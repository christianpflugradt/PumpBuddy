import type { AppState } from "./workout-types";
import { pbStartScreenTag, registerPbStartScreen } from "./pb-start-screen";
import type { CompletionScreenState } from "./pb-completion-screen";
import { pbCompletionScreenTag, registerPbCompletionScreen } from "./pb-completion-screen";
import type { ExerciseScreenState } from "./pb-exercise-screen";
import { pbExerciseScreenTag, registerPbExerciseScreen } from "./pb-exercise-screen";
import type { AboutScreenState } from "./pb-about-screen";
import { pbAboutScreenTag, registerPbAboutScreen } from "./pb-about-screen";
import type { SettingsScreenState } from "./pb-settings-screen";
import { pbSettingsScreenTag, registerPbSettingsScreen } from "./pb-settings-screen";
import type { HistoryScreenState } from "./pb-history-screen";
import { pbHistoryScreenTag, registerPbHistoryScreen } from "./pb-history-screen";
import type { ProgressScreenState } from "./pb-progress-screen";
import { pbProgressScreenTag, registerPbProgressScreen } from "./pb-progress-screen";
import type { ExercisesScreenState } from "./pb-exercises-screen";
import { pbExercisesScreenTag, registerPbExercisesScreen } from "./pb-exercises-screen";
import type { GymsScreenState } from "./pb-gyms-screen";
import { pbGymsScreenTag, registerPbGymsScreen } from "./pb-gyms-screen";
import type { TrainingPlansScreenState } from "./pb-training-plans-screen";
import {
  pbTrainingPlansScreenTag,
  registerPbTrainingPlansScreen,
} from "./pb-training-plans-screen";
import type { TrainingPlanDetailScreenState } from "./pb-training-plan-detail-screen";
import {
  pbTrainingPlanDetailScreenTag,
  registerPbTrainingPlanDetailScreen,
} from "./pb-training-plan-detail-screen";
import type { TrainingPlanExerciseDetailScreenState } from "./pb-training-plan-exercise-detail-screen";
import {
  pbTrainingPlanExerciseDetailScreenTag,
  registerPbTrainingPlanExerciseDetailScreen,
} from "./pb-training-plan-exercise-detail-screen";
import type { GymDetailScreenState } from "./pb-gym-detail-screen";
import { pbGymDetailScreenTag, registerPbGymDetailScreen } from "./pb-gym-detail-screen";
import type { StationDetailScreenState } from "./pb-station-detail-screen";
import { pbStationDetailScreenTag, registerPbStationDetailScreen } from "./pb-station-detail-screen";
import type { ExerciseVariantDetailScreenState } from "./pb-exercise-variant-detail-screen";
import {
  pbExerciseVariantDetailScreenTag,
  registerPbExerciseVariantDetailScreen,
} from "./pb-exercise-variant-detail-screen";
import type { WorkoutDetailScreenState } from "./pb-workout-detail-screen";
import {
  pbWorkoutDetailScreenTag,
  registerPbWorkoutDetailScreen,
} from "./pb-workout-detail-screen";

export const pbAppRootTag = "pb-app-root";

export type AppRootState = AppState;

class PbAppRootElement extends HTMLElement {
  #state: AppRootState | null = null;

  connectedCallback(): void {
    registerPbStartScreen();
    registerPbExerciseScreen();
    registerPbCompletionScreen();
    registerPbSettingsScreen();
    registerPbAboutScreen();
    registerPbHistoryScreen();
    registerPbProgressScreen();
    registerPbExercisesScreen();
    registerPbGymsScreen();
    registerPbTrainingPlansScreen();
    registerPbTrainingPlanDetailScreen();
    registerPbTrainingPlanExerciseDetailScreen();
    registerPbGymDetailScreen();
    registerPbStationDetailScreen();
    registerPbExerciseVariantDetailScreen();
    registerPbWorkoutDetailScreen();
    this.#render();
  }

  set state(value: AppRootState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): AppRootState | null {
    return this.#state;
  }

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    this.innerHTML = `<div class="pb-app-root"></div>`;

    const container = this.querySelector(".pb-app-root");
    if (!(container instanceof HTMLElement)) {
      return;
    }

    if (state.viewState.screen === "start") {
      const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: AppState["startScreen"] };
      el.state = {
        ...state.startScreen,
        sessionUser: state.sessionUser ?? null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "settings") {
      const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
      el.state = {
        sessionUser: state.sessionUser ?? null,
        gyms: state.startScreen.gyms,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "about") {
      const el = document.createElement(pbAboutScreenTag) as HTMLElement & { state: AboutScreenState };
      el.state = {
        metadata: state.aboutScreen?.metadata ?? null,
        errorMessage: state.aboutScreen?.errorMessage ?? null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "history") {
      const el = document.createElement(pbHistoryScreenTag) as HTMLElement & { state: HistoryScreenState };
      el.state = {
        workouts: state.historyScreen.workouts,
        isLoading: state.historyScreen.isLoading,
        errorMessage: state.historyScreen.errorMessage,
        restoreWorkoutId: state.historyScreen.restoreWorkoutId,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "progress") {
      const el = document.createElement(pbProgressScreenTag) as HTMLElement & { state: ProgressScreenState };
      el.state = {
        workouts: state.progressScreen.workouts,
        isLoading: state.progressScreen.isLoading,
        errorMessage: state.progressScreen.errorMessage,
        selectedWorkoutId: state.progressScreen.selectedWorkoutId ?? null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "exercises") {
      const el = document.createElement(pbExercisesScreenTag) as HTMLElement & { state: ExercisesScreenState };
      el.state = {
        groups: state.exercisesScreen.groups,
        isLoading: state.exercisesScreen.isLoading,
        errorMessage: state.exercisesScreen.errorMessage,
        restoreScrollY: state.exercisesScreen.restoreScrollY,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "gyms") {
      const el = document.createElement(pbGymsScreenTag) as HTMLElement & { state: GymsScreenState };
      el.state = {
        gyms: state.gymsScreen.gyms,
        isLoading: state.gymsScreen.isLoading,
        errorMessage: state.gymsScreen.errorMessage,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "training-plans") {
      const el = document.createElement(pbTrainingPlansScreenTag) as HTMLElement & {
        state: TrainingPlansScreenState;
      };
      el.state = {
        trainingPlans: state.trainingPlansScreen.trainingPlans,
        isLoading: state.trainingPlansScreen.isLoading,
        errorMessage: state.trainingPlansScreen.errorMessage,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "training-plan-detail") {
      const trainingPlanId = state.viewState.trainingPlanId;
      const selectedGymId = state.viewState.selectedGymId;
      const detailState =
        state.trainingPlanDetailScreen.trainingPlanId === trainingPlanId &&
        state.trainingPlanDetailScreen.selectedGymId === selectedGymId
          ? state.trainingPlanDetailScreen
          : null;
      const el = document.createElement(pbTrainingPlanDetailScreenTag) as HTMLElement & {
        state: TrainingPlanDetailScreenState;
      };
      el.state = {
        trainingPlanId,
        selectedGymId,
        detail: detailState?.detail ?? null,
        gyms: state.startScreen.gyms,
        isLoading: detailState?.isLoading ?? false,
        errorMessage: detailState?.errorMessage ?? null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "training-plan-exercise-detail") {
      const trainingPlanId = state.viewState.trainingPlanId;
      const trainingPlanExerciseId = state.viewState.trainingPlanExerciseId;
      const selectedGymId = state.viewState.selectedGymId;
      const detailState =
        state.trainingPlanDetailScreen.trainingPlanId === trainingPlanId &&
        state.trainingPlanDetailScreen.selectedGymId === selectedGymId
          ? state.trainingPlanDetailScreen
          : null;
      const detail = detailState?.detail ?? null;
      const selectedGym =
        selectedGymId === null
          ? null
          : state.startScreen.gyms.find((gym) => gym.id === selectedGymId) ?? null;
      const el = document.createElement(pbTrainingPlanExerciseDetailScreenTag) as HTMLElement & {
        state: TrainingPlanExerciseDetailScreenState;
      };
      el.state = {
        trainingPlanId,
        trainingPlanExerciseId,
        selectedGymId,
        selectedGymName: selectedGym?.name ?? null,
        planName: detail?.name ?? null,
        exercise:
          detail?.exercises.find(
            (exercise) => exercise.training_plan_exercise_id === trainingPlanExerciseId,
          ) ?? null,
        totalExercises: detail?.exercises.length ?? 0,
        isLoading: detailState?.isLoading ?? false,
        errorMessage: detailState?.errorMessage ?? null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "gym-detail") {
      const gymId = state.viewState.gymId;
      const el = document.createElement(pbGymDetailScreenTag) as HTMLElement & {
        state: GymDetailScreenState;
      };
      el.state = {
        gymId,
        detail: state.gymDetailScreen.gymId === gymId ? state.gymDetailScreen.detail : null,
        activeSheet: state.gymDetailScreen.activeSheet,
        isLoading: state.gymDetailScreen.gymId === gymId ? state.gymDetailScreen.isLoading : false,
        errorMessage: state.gymDetailScreen.gymId === gymId ? state.gymDetailScreen.errorMessage : null,
        stationChooser: state.gymDetailScreen.gymId === gymId ? state.gymDetailScreen.stationChooser : null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "station-detail") {
      const gymId = state.viewState.gymId;
      const stationId = state.viewState.stationId;
      const stationDetailState =
        state.stationDetailScreen.gymId === gymId && state.stationDetailScreen.stationId === stationId
          ? state.stationDetailScreen
          : null;
      const selectedStation =
        state.gymDetailScreen.detail?.stations.find((station) => station.id === stationId) ?? null;
      const el = document.createElement(pbStationDetailScreenTag) as HTMLElement & {
        state: StationDetailScreenState;
      };
      el.state = {
        gymId,
        stationId,
        stationName: stationDetailState?.detail?.station_name ?? selectedStation?.name ?? null,
        detail: stationDetailState?.detail ?? null,
        isLoading: stationDetailState?.isLoading ?? false,
        errorMessage: stationDetailState?.errorMessage ?? null,
        loadProfilePopupOpen: stationDetailState?.loadProfilePopupOpen ?? false,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "exercise-variant-detail") {
      const variantId = state.viewState.variantId;
      const selectedRow =
        state.exercisesScreen.groups
          .flatMap((group) => group.rows)
          .find((row) => row.variant_id === variantId) ?? null;
      const gymVariant =
        state.viewState.returnScreen === "gym-detail"
          ? state.gymDetailScreen.detail?.exercise_groups
              .flatMap((group) =>
                group.variants.map((variant) => ({
                  exerciseName: group.exercise_name,
                  variantName: variant.variant_name,
                  variantId: variant.variant_id,
                })),
              )
              .find((variant) => variant.variantId === variantId) ?? null
          : null;
      const stationVariant =
        state.viewState.returnScreen === "station-detail"
          ? state.stationDetailScreen.detail?.suitable_variant_groups
              .flatMap((group) =>
                group.variants.map((variant) => ({
                  exerciseName: group.exercise_name,
                  variantName: variant.variant_name,
                  variantId: variant.variant_id,
                })),
              )
              .find((variant) => variant.variantId === variantId) ?? null
          : null;
      const trainingPlanVariant =
        state.viewState.returnScreen === "training-plan-exercise-detail"
          ? state.trainingPlanDetailScreen.detail?.exercises
              .flatMap((exercise) =>
                exercise.variants.map((variant) => ({
                  exerciseName: exercise.exercise_name,
                  variantName: variant.variant_name,
                  variantId: variant.variant_id,
                })),
              )
              .find((variant) => variant.variantId === variantId) ?? null
          : null;
      const el = document.createElement(pbExerciseVariantDetailScreenTag) as HTMLElement & {
        state: ExerciseVariantDetailScreenState;
      };
      el.state = {
        variantId,
        row: selectedRow,
        fallbackExerciseName:
          state.viewState.fallbackExerciseName ??
          gymVariant?.exerciseName ??
          stationVariant?.exerciseName ??
          trainingPlanVariant?.exerciseName ??
          null,
        fallbackVariantName:
          state.viewState.fallbackVariantName ??
          gymVariant?.variantName ??
          stationVariant?.variantName ??
          trainingPlanVariant?.variantName ??
          null,
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "workout-detail") {
      const detailState =
        state.workoutDetailScreen?.workoutId === state.viewState.workoutId
          ? state.workoutDetailScreen
          : null;
      const el = document.createElement(pbWorkoutDetailScreenTag) as HTMLElement & {
        state: WorkoutDetailScreenState;
      };
      el.state = {
        workoutId: state.viewState.workoutId,
        detail: detailState?.detail ?? null,
        isLoading: detailState?.isLoading ?? false,
        errorMessage: detailState?.errorMessage ?? null,
        enableVariantRowNavigation: true,
        returnScreen: state.viewState.returnScreen,
      };
      container.append(el);
      return;
    }

    if (!state.workoutPlan) {
      const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: AppState["startScreen"] };
      el.state = {
        ...state.startScreen,
        sessionUser: state.sessionUser ?? null,
        errorMessage: "Unable to render the workout plan.",
      };
      container.append(el);
      return;
    }

    if (state.viewState.screen === "completion") {
      const el = document.createElement(pbCompletionScreenTag) as HTMLElement & { state: CompletionScreenState };
      el.state = {
        plan: state.workoutPlan,
        completion: state.completion,
      };
      container.append(el);
      return;
    }

    const exerciseEl = document.createElement(pbExerciseScreenTag) as HTMLElement & { state: ExerciseScreenState };
    exerciseEl.state = {
      plan: state.workoutPlan,
      exerciseIndex: state.viewState.exerciseIndex,
      startScreen: {
        selectedWorkoutMode: state.startScreen.selectedWorkoutMode,
        selectedGymId: state.startScreen.selectedGymId,
        gyms: state.startScreen.gyms,
      },
      confirmDialog: state.confirmDialog,
      activeWorkout: state.activeWorkout,
      workoutSave: state.workoutSave,
      uiFeedback: state.uiFeedback,
    };
    container.append(exerciseEl);
  }
}

export const registerPbAppRoot = (): void => {
  if (!customElements.get(pbAppRootTag)) {
    customElements.define(pbAppRootTag, PbAppRootElement);
  }
};
