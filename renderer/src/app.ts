export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: ExerciseStep[];
};

export type ExerciseStep = {
  name: string;
  weight: number;
};

export type TrainingPlanSummary = {
  id: string;
  name: string;
  exercise_count: number;
};

export type GymSummary = {
  id: string;
  name: string;
};

export type PlanExerciseOptionSummary = {
  id: string;
  training_plan_exercise_id: string;
  exercise_name: string;
  exercise_position: number;
  variant_id: string;
  variant_name: string;
  variant_type: string;
  station_id: string;
  station_name: string;
};

type ViewState =
  | { screen: "start" }
  | { screen: "exercise"; exerciseIndex: number }
  | { screen: "completion" };

type StartScreenState = {
  isLoading: boolean;
  isStarting: boolean;
  errorMessage: string | null;
  trainingPlans: TrainingPlanSummary[];
  gyms: GymSummary[];
  selectedTrainingPlanId: string;
  selectedGymId: string;
};

type AppState = {
  startScreen: StartScreenState;
  workoutPlan: WorkoutPlan | null;
  viewState: ViewState;
};

type FetchJson = <T>(input: string) => Promise<T>;

type TrainingPlanOptionsResponse = {
  training_plan_id: string;
  gym_id: string;
  options: PlanExerciseOptionSummary[];
};

const DEFAULT_EXERCISE_WEIGHT_KG = 0;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderOptions = (
  items: Array<{ id: string; name: string }>,
  selectedId: string,
  placeholder: string,
): string => `
  <option value="">${escapeHtml(placeholder)}</option>
  ${items
    .map(
      (item) => `
        <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>
          ${escapeHtml(item.name)}
        </option>
      `,
    )
    .join("")}
`;

export const createInitialStartScreenState = (): StartScreenState => ({
  isLoading: true,
  isStarting: false,
  errorMessage: null,
  trainingPlans: [],
  gyms: [],
  selectedTrainingPlanId: "",
  selectedGymId: "",
});

export const canStartWorkout = (startScreen: StartScreenState): boolean =>
  !startScreen.isLoading &&
  !startScreen.isStarting &&
  startScreen.selectedTrainingPlanId.length > 0 &&
  startScreen.selectedGymId.length > 0 &&
  startScreen.errorMessage === null;

export const createFetchJson = (fetchImpl: typeof fetch = fetch): FetchJson => {
  return async <T>(input: string): Promise<T> => {
    const response = await fetchImpl(input);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  };
};

export const loadStartScreenData = async (fetchJson: FetchJson): Promise<{
  trainingPlans: TrainingPlanSummary[];
  gyms: GymSummary[];
}> => {
  const [trainingPlans, gyms] = await Promise.all([
    fetchJson<TrainingPlanSummary[]>("/api/training-plans"),
    fetchJson<GymSummary[]>("/api/gyms"),
  ]);

  return { trainingPlans, gyms };
};

export const buildWorkoutPlan = (
  selectedPlan: TrainingPlanSummary,
  optionsResponse: TrainingPlanOptionsResponse,
): WorkoutPlan => {
  const optionsByExercise = new Map<string, PlanExerciseOptionSummary>();

  for (const option of optionsResponse.options) {
    if (!optionsByExercise.has(option.training_plan_exercise_id)) {
      optionsByExercise.set(option.training_plan_exercise_id, option);
    }
  }

  const exercises = [...optionsByExercise.values()]
    .sort((left, right) => left.exercise_position - right.exercise_position)
    .map((option) => ({
      name: option.exercise_name,
      weight: DEFAULT_EXERCISE_WEIGHT_KG,
    }));

  if (exercises.length === 0) {
    throw new Error("Selected training plan has no available exercises for this gym");
  }

  return {
    id: selectedPlan.id,
    name: selectedPlan.name,
    exercises,
  };
};

const renderStartScreen = (startScreen: StartScreenState): string => `
  <h1>PumpBuddy</h1>
  <section class="start-screen" aria-label="Workout start screen">
    <p>Select a seeded plan and gym to begin.</p>
    ${
      startScreen.isLoading
        ? '<p class="start-status" role="status">Loading available plans and gyms...</p>'
        : ""
    }
    ${
      startScreen.errorMessage
        ? `<p class="start-error" role="alert">${escapeHtml(startScreen.errorMessage)}</p>`
        : ""
    }
    <label class="start-label" for="training-plan-select">Training Plan</label>
    <select
      id="training-plan-select"
      class="start-select"
      data-action="select-training-plan"
      ${startScreen.isLoading || startScreen.isStarting ? "disabled" : ""}
    >
      ${renderOptions(startScreen.trainingPlans, startScreen.selectedTrainingPlanId, "Choose a plan")}
    </select>
    <label class="start-label" for="gym-select">Gym</label>
    <select
      id="gym-select"
      class="start-select"
      data-action="select-gym"
      ${startScreen.isLoading || startScreen.isStarting ? "disabled" : ""}
    >
      ${renderOptions(startScreen.gyms, startScreen.selectedGymId, "Choose a gym")}
    </select>
    <button
      type="button"
      class="start-button"
      data-action="start-workout"
      ${canStartWorkout(startScreen) ? "" : "disabled"}
    >
      ${startScreen.isStarting ? "Preparing Workout..." : "Start Workout"}
    </button>
  </section>
`;

const renderExerciseScreen = (plan: WorkoutPlan, exerciseIndex: number): string => {
  const exerciseStep = plan.exercises[exerciseIndex];
  const stepNumber = exerciseIndex + 1;
  const totalSteps = plan.exercises.length;
  const isLastStep = exerciseIndex === totalSteps - 1;

  return `
    <h1>PumpBuddy</h1>
    <section class="exercise-step" aria-live="polite" aria-label="Workout exercise step">
      <p class="plan-label">${escapeHtml(plan.name)}</p>
      <p class="step-counter">Exercise ${stepNumber} of ${totalSteps}</p>
      <h2 class="exercise-name">${escapeHtml(exerciseStep.name)}</h2>
      <label class="weight-label" for="exercise-weight">Weight (kg)</label>
      <div class="weight-controls" aria-label="Weight controls">
        <button type="button" class="weight-button" data-action="decrement-weight">-</button>
        <input
          id="exercise-weight"
          class="weight-input"
          data-action="weight-input"
          inputmode="numeric"
          pattern="[0-9]*"
          value="${exerciseStep.weight}"
          aria-label="Exercise weight in kilograms"
        />
        <button type="button" class="weight-button" data-action="increment-weight">+</button>
      </div>
      <div class="step-actions">
        <button
          type="button"
          class="nav-button"
          data-action="previous"
          ${exerciseIndex === 0 ? "disabled" : ""}
        >
          Previous
        </button>
        <button type="button" class="nav-button" data-action="next">
          ${isLastStep ? "Complete Plan" : "Next"}
        </button>
      </div>
    </section>
  `;
};

const renderCompletionScreen = (plan: WorkoutPlan): string => `
  <h1>PumpBuddy</h1>
  <section class="completion-screen" aria-label="Workout completion screen">
    <p class="plan-label">${escapeHtml(plan.name)}</p>
    <h2 class="completion-title">Plan Completed</h2>
    <p class="completion-copy">Great work. You finished all ${plan.exercises.length} exercises.</p>
  </section>
`;

export const isDigitsOnly = (value: string): boolean => /^[0-9]+$/.test(value);

export const getNextViewState = (
  viewState: ViewState,
  action: "start-workout" | "previous" | "next",
  totalExercises: number,
): ViewState => {
  if (action === "start-workout") {
    return { screen: "exercise", exerciseIndex: 0 };
  }

  if (viewState.screen !== "exercise") {
    return viewState;
  }

  if (action === "previous" && viewState.exerciseIndex > 0) {
    return {
      ...viewState,
      exerciseIndex: viewState.exerciseIndex - 1,
    };
  }

  if (action === "next") {
    if (viewState.exerciseIndex < totalExercises - 1) {
      return {
        ...viewState,
        exerciseIndex: viewState.exerciseIndex + 1,
      };
    }

    return { screen: "completion" };
  }

  return viewState;
};

export const createApp = (
  app: HTMLElement,
  fetchJson: FetchJson = createFetchJson(),
): void => {
  let state: AppState = {
    startScreen: createInitialStartScreenState(),
    workoutPlan: null,
    viewState: { screen: "start" },
  };

  const render = (): void => {
    if (state.viewState.screen === "start") {
      app.innerHTML = renderStartScreen(state.startScreen);
      return;
    }

    if (!state.workoutPlan) {
      app.innerHTML = renderStartScreen({
        ...state.startScreen,
        errorMessage: "Unable to render the workout plan.",
      });
      return;
    }

    if (state.viewState.screen === "completion") {
      app.innerHTML = renderCompletionScreen(state.workoutPlan);
      return;
    }

    app.innerHTML = renderExerciseScreen(state.workoutPlan, state.viewState.exerciseIndex);
  };

  const bootstrapStartScreen = async (): Promise<void> => {
    try {
      const { trainingPlans, gyms } = await loadStartScreenData(fetchJson);
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          isLoading: false,
          errorMessage: null,
          trainingPlans,
          gyms,
          selectedTrainingPlanId: trainingPlans[0]?.id ?? "",
          selectedGymId: gyms[0]?.id ?? "",
        },
      };
    } catch {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          isLoading: false,
          errorMessage: "Unable to load start selections. Refresh and try again.",
        },
      };
    }

    render();
  };

  const startWorkout = async (): Promise<void> => {
    if (!canStartWorkout(state.startScreen)) {
      return;
    }

    const selectedPlan = state.startScreen.trainingPlans.find(
      (plan) => plan.id === state.startScreen.selectedTrainingPlanId,
    );

    if (!selectedPlan) {
      return;
    }

    state = {
      ...state,
      startScreen: {
        ...state.startScreen,
        isStarting: true,
        errorMessage: null,
      },
    };
    render();

    try {
      const optionsResponse = await fetchJson<TrainingPlanOptionsResponse>(
        `/api/training-plans/${selectedPlan.id}/options?gymId=${encodeURIComponent(
          state.startScreen.selectedGymId,
        )}`,
      );

      state = {
        ...state,
        workoutPlan: buildWorkoutPlan(selectedPlan, optionsResponse),
        startScreen: {
          ...state.startScreen,
          isStarting: false,
        },
      };
      state.viewState = getNextViewState(state.viewState, "start-workout", state.workoutPlan.exercises.length);
    } catch {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          isStarting: false,
          errorMessage: "Unable to prepare this workout for the selected gym.",
        },
      };
    }

    render();
  };

  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.action;

    if (action === "start-workout") {
      void startWorkout();
      return;
    }

    if (state.viewState.screen !== "exercise" || !state.workoutPlan) {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];

    if (action === "decrement-weight") {
      currentStep.weight = Math.max(0, currentStep.weight - 1);
      render();
      return;
    }

    if (action === "increment-weight") {
      currentStep.weight += 1;
      render();
      return;
    }

    if (action === "previous" && state.viewState.exerciseIndex > 0) {
      state.viewState = getNextViewState(state.viewState, action, state.workoutPlan.exercises.length);
      render();
      return;
    }

    if (action === "next") {
      state.viewState = getNextViewState(state.viewState, action, state.workoutPlan.exercises.length);
      render();
    }
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || state.viewState.screen !== "start") {
      return;
    }

    if (target.dataset.action === "select-training-plan") {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedTrainingPlanId: target.value,
          errorMessage: null,
        },
      };
      render();
      return;
    }

    if (target.dataset.action === "select-gym") {
      state = {
        ...state,
        startScreen: {
          ...state.startScreen,
          selectedGymId: target.value,
          errorMessage: null,
        },
      };
      render();
    }
  });

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (state.viewState.screen !== "exercise" || !state.workoutPlan || target.dataset.action !== "weight-input") {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    const nextValue = target.value.trim();

    if (isDigitsOnly(nextValue)) {
      currentStep.weight = Number(nextValue);
      return;
    }

    target.value = String(currentStep.weight);
  });

  render();
  void bootstrapStartScreen();
};
