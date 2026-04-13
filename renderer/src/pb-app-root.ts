import type { AppState } from "./workout-types";
import { pbStartScreenTag, registerPbStartScreen } from "./pb-start-screen";
import type { CompletionScreenState } from "./pb-completion-screen";
import { pbCompletionScreenTag, registerPbCompletionScreen } from "./pb-completion-screen";
import type { ExerciseScreenState } from "./pb-exercise-screen";
import { pbExerciseScreenTag, registerPbExerciseScreen } from "./pb-exercise-screen";
import type { SettingsScreenState } from "./pb-settings-screen";
import { pbSettingsScreenTag, registerPbSettingsScreen } from "./pb-settings-screen";

export const pbAppRootTag = "pb-app-root";

export type AppRootState = AppState;

class PbAppRootElement extends HTMLElement {
  #state: AppRootState | null = null;

  connectedCallback(): void {
    registerPbStartScreen();
    registerPbExerciseScreen();
    registerPbCompletionScreen();
    registerPbSettingsScreen();
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
