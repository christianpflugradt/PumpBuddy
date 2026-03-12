export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: ExerciseStep[];
};

export type WorkoutSetDraft = {
  loadValue: number;
  reps: number;
};

export type CompletedExerciseSet = WorkoutSetDraft & {
  setIndex: number;
};

export type ExerciseStep = {
  trainingPlanExerciseId: string;
  name: string;
  selectedPlanExerciseOptionId: string | null;
  selectedVariantId: string | null;
  selectedStationId: string | null;
  activeSet: WorkoutSetDraft;
  completedSets: CompletedExerciseSet[];
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

type WorkoutSummary = {
  id: string;
  training_plan_id: string;
  training_plan_name: string;
  gym_id: string;
  gym_name: string;
  started_at: string | null;
  completed_at: string | null;
  exercise_count: number;
  completed_set_count: number;
};

type ActiveWorkoutSet = {
  load_value: number;
  reps: number | null;
};

type CompletedActiveWorkoutSet = ActiveWorkoutSet & {
  set_index: number;
};

type ActiveWorkoutExercise = {
  training_plan_exercise_id: string;
  position: number;
  exercise_name: string;
  selected_plan_exercise_option_id: string | null;
  selected_variant_id: string | null;
  selected_variant_name: string | null;
  selected_station_id: string | null;
  selected_station_name: string | null;
  completed_sets: CompletedActiveWorkoutSet[];
  suggested_set: ActiveWorkoutSet;
};

type ActiveWorkout = {
  id: string;
  training_plan_id: string;
  training_plan_name: string;
  gym_id: string;
  gym_name: string;
  started_at: string;
  updated_at: string;
  current_exercise_position: number;
  total_exercise_count: number;
  exercises: ActiveWorkoutExercise[];
};

type ActiveWorkoutResponse = {
  workout: ActiveWorkout;
};

type CreateWorkoutRequest = {
  training_plan_id: string;
  gym_id: string;
  completed_at: string;
  exercises: CreateWorkoutExerciseInput[];
};

type CreateWorkoutExerciseInput = {
  training_plan_exercise_id: string;
  position: number;
  selected_plan_exercise_option_id: string | null;
  selected_variant_id: string | null;
  selected_station_id: string | null;
  set: {
    load_value: number;
    reps: number;
  };
};

type ActiveWorkoutExerciseInput = {
  training_plan_exercise_id: string;
  position: number;
  selected_plan_exercise_option_id: string | null;
  selected_variant_id: string | null;
  selected_station_id: string | null;
  completed_sets: Array<{
    load_value: number;
    reps: number;
  }>;
};

type ActiveWorkoutProgressPayload = {
  training_plan_id: string;
  gym_id: string;
  started_at: string;
  current_exercise_position: number;
  total_exercise_count: number;
  exercises: ActiveWorkoutExerciseInput[];
};

type CreateActiveWorkoutRequest = ActiveWorkoutProgressPayload & {
  first_confirmed_exercise_position: number;
};

type UpdateActiveWorkoutRequest = ActiveWorkoutProgressPayload & {
  last_confirmed_exercise_position: number;
};

type CompleteActiveWorkoutRequest = ActiveWorkoutProgressPayload & {
  completed_at: string;
  last_confirmed_exercise_position: number;
};

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
  activeWorkout: {
    id: string | null;
    startedAt: string | null;
    persistedExerciseCount: number;
  };
  workoutSave: {
    isSaving: boolean;
    errorMessage: string | null;
  };
};

type FetchJson = <T>(input: string) => Promise<T>;
type ActiveWorkoutApi = {
  createActiveWorkout: (payload: CreateActiveWorkoutRequest) => Promise<ActiveWorkoutResponse>;
  updateActiveWorkout: (
    workoutId: string,
    payload: UpdateActiveWorkoutRequest,
  ) => Promise<ActiveWorkoutResponse>;
  cancelActiveWorkout: (workoutId: string) => Promise<void>;
  completeActiveWorkout: (
    workoutId: string,
    payload: CompleteActiveWorkoutRequest,
  ) => Promise<WorkoutSummary>;
};

type TrainingPlanOptionsResponse = {
  training_plan_id: string;
  gym_id: string;
  options: PlanExerciseOptionSummary[];
};

const DEFAULT_SUGGESTED_LOAD_KG = 10;
const DEFAULT_SUGGESTED_REPS = 10;

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

const toDraftSet = (set: ActiveWorkoutSet | null | undefined): WorkoutSetDraft => ({
  loadValue: set?.load_value ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: set?.reps ?? DEFAULT_SUGGESTED_REPS,
});

const cloneWorkoutPlan = (plan: WorkoutPlan): WorkoutPlan => ({
  ...plan,
  exercises: plan.exercises.map((exercise) => ({
    ...exercise,
    activeSet: { ...exercise.activeSet },
    completedSets: exercise.completedSets.map((set) => ({ ...set })),
  })),
});

const withCurrentSetCompleted = (plan: WorkoutPlan, exerciseIndex: number): WorkoutPlan => {
  const nextPlan = cloneWorkoutPlan(plan);
  const exercise = nextPlan.exercises[exerciseIndex];

  if (!exercise) {
    return nextPlan;
  }

  exercise.completedSets.push({
    setIndex: exercise.completedSets.length + 1,
    loadValue: exercise.activeSet.loadValue,
    reps: exercise.activeSet.reps,
  });

  return nextPlan;
};

const countPersistedExercises = (response: ActiveWorkoutResponse): number =>
  response.workout.exercises.filter((exercise) => exercise.completed_sets.length > 0).length;

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

export const isNotFoundRequestError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("status 404");

export const loadActiveWorkout = async (
  fetchJson: FetchJson,
): Promise<ActiveWorkoutResponse | null> => {
  try {
    return await fetchJson<ActiveWorkoutResponse>("/api/active-workout");
  } catch (error) {
    if (isNotFoundRequestError(error)) {
      return null;
    }

    throw error;
  }
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
      trainingPlanExerciseId: option.training_plan_exercise_id,
      name: option.exercise_name,
      selectedPlanExerciseOptionId: option.id,
      selectedVariantId: option.variant_id,
      selectedStationId: option.station_id,
      activeSet: {
        loadValue: DEFAULT_SUGGESTED_LOAD_KG,
        reps: DEFAULT_SUGGESTED_REPS,
      },
      completedSets: [],
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

export const buildCreateWorkoutRequest = (
  workoutPlan: WorkoutPlan,
  gymId: string,
  completedAt: string,
): CreateWorkoutRequest => ({
  training_plan_id: workoutPlan.id,
  gym_id: gymId,
  completed_at: completedAt,
  exercises: workoutPlan.exercises.map((exercise, index) => ({
    training_plan_exercise_id: exercise.trainingPlanExerciseId,
    position: index + 1,
    selected_plan_exercise_option_id: exercise.selectedPlanExerciseOptionId,
    selected_variant_id: exercise.selectedVariantId,
    selected_station_id: exercise.selectedStationId,
    set: {
      load_value: exercise.activeSet.loadValue,
      reps: exercise.activeSet.reps,
    },
  })),
});

export const buildActiveWorkoutProgressPayload = (
  workoutPlan: WorkoutPlan,
  gymId: string,
  startedAt: string,
  currentExercisePosition: number,
): ActiveWorkoutProgressPayload => ({
  training_plan_id: workoutPlan.id,
  gym_id: gymId,
  started_at: startedAt,
  current_exercise_position: currentExercisePosition,
  total_exercise_count: workoutPlan.exercises.length,
  exercises: workoutPlan.exercises
    .filter((exercise) => exercise.completedSets.length > 0)
    .map((exercise, index) => ({
      training_plan_exercise_id: exercise.trainingPlanExerciseId,
      position: index + 1,
      selected_plan_exercise_option_id: exercise.selectedPlanExerciseOptionId,
      selected_variant_id: exercise.selectedVariantId,
      selected_station_id: exercise.selectedStationId,
      completed_sets: exercise.completedSets.map((set) => ({
        load_value: set.loadValue,
        reps: set.reps,
      })),
    })),
});

export const applyActiveWorkoutResponse = (
  workoutPlan: WorkoutPlan,
  response: ActiveWorkoutResponse,
): WorkoutPlan => {
  const exercisesByPosition = new Map(
    response.workout.exercises.map((exercise) => [exercise.position, exercise] as const),
  );

  return {
    id: response.workout.training_plan_id,
    name: response.workout.training_plan_name,
    exercises: workoutPlan.exercises.map((exercise, index) => {
      const persistedExercise = exercisesByPosition.get(index + 1);

      if (!persistedExercise) {
        return exercise;
      }

      return {
        trainingPlanExerciseId: persistedExercise.training_plan_exercise_id,
        name: persistedExercise.exercise_name,
        selectedPlanExerciseOptionId: persistedExercise.selected_plan_exercise_option_id,
        selectedVariantId: persistedExercise.selected_variant_id,
        selectedStationId: persistedExercise.selected_station_id,
        completedSets: persistedExercise.completed_sets.map((set) => ({
          setIndex: set.set_index,
          loadValue: set.load_value,
          reps: set.reps ?? DEFAULT_SUGGESTED_REPS,
        })),
        activeSet: toDraftSet(persistedExercise.suggested_set),
      };
    }),
  };
};

export const buildWorkoutPlanFromActiveWorkout = (
  response: ActiveWorkoutResponse,
  optionsResponse: TrainingPlanOptionsResponse,
): WorkoutPlan =>
  applyActiveWorkoutResponse(
    buildWorkoutPlan(
      {
        id: response.workout.training_plan_id,
        name: response.workout.training_plan_name,
        exercise_count: response.workout.total_exercise_count,
      },
      optionsResponse,
    ),
    response,
  );

export const createActiveWorkoutApi = (fetchImpl: typeof fetch = fetch): ActiveWorkoutApi => {
  const submitJson = async <T>(input: string, method: string, payload: unknown): Promise<T> => {
    const response = await fetchImpl(input, {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  };

  const submitWithoutBody = async (input: string, method: string): Promise<void> => {
    const response = await fetchImpl(input, { method });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
  };

  return {
    createActiveWorkout: async (payload) =>
      await submitJson<ActiveWorkoutResponse>("/api/active-workout", "POST", payload),
    updateActiveWorkout: async (workoutId, payload) =>
      await submitJson<ActiveWorkoutResponse>(`/api/active-workout/${workoutId}`, "PUT", payload),
    cancelActiveWorkout: async (workoutId) =>
      await submitWithoutBody(`/api/active-workout/${workoutId}`, "DELETE"),
    completeActiveWorkout: async (workoutId, payload) =>
      await submitJson<WorkoutSummary>(`/api/active-workout/${workoutId}/complete`, "POST", payload),
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

const renderReadOnlySetField = (label: string, value: string): string => `
  <div class="set-row-field">
    <span class="set-row-field-label">${label}</span>
    <span class="set-row-field-value">${value}</span>
  </div>
`;

const renderEditableSetField = (
  label: string,
  inputId: string,
  inputAction: "load-input" | "reps-input",
  decrementAction: "decrement-load" | "decrement-reps",
  incrementAction: "increment-load" | "increment-reps",
  value: number,
  ariaLabel: string,
  controlsDisabled: string,
): string => `
  <div class="set-row-field set-row-field-editable">
    <label class="set-row-field-label" for="${inputId}">${label}</label>
    <div class="weight-controls" aria-label="${label} controls">
      <button type="button" class="weight-button" data-action="${decrementAction}" ${controlsDisabled}>-</button>
      <input
        id="${inputId}"
        class="weight-input"
        data-action="${inputAction}"
        inputmode="numeric"
        pattern="[0-9]*"
        value="${value}"
        aria-label="${ariaLabel}"
        ${controlsDisabled}
      />
      <button type="button" class="weight-button" data-action="${incrementAction}" ${controlsDisabled}>+</button>
    </div>
  </div>
`;

const renderSetRow = (
  setIndex: number,
  fields: { loadValue: number; reps: number },
  controlsDisabled: string,
  editable: boolean,
): string => `
  <li
    class="set-row ${editable ? "set-row-editable" : "set-row-readonly"}"
    ${editable ? 'aria-label="Current editable set"' : ""}
  >
    <span class="set-row-index">Set ${setIndex}</span>
    <div class="set-row-fields">
      ${
        editable
          ? renderEditableSetField(
              "Load",
              "exercise-load",
              "load-input",
              "decrement-load",
              "increment-load",
              fields.loadValue,
              "Exercise load in kilograms",
              controlsDisabled,
            )
          : renderReadOnlySetField("Load", `${fields.loadValue} kg`)
      }
      ${
        editable
          ? renderEditableSetField(
              "Reps",
              "exercise-reps",
              "reps-input",
              "decrement-reps",
              "increment-reps",
              fields.reps,
              "Exercise reps",
              controlsDisabled,
            )
          : renderReadOnlySetField("Reps", String(fields.reps))
      }
    </div>
  </li>
`;

const renderExerciseScreen = (
  plan: WorkoutPlan,
  exerciseIndex: number,
  activeWorkout: AppState["activeWorkout"],
  workoutSave: AppState["workoutSave"],
): string => {
  const exerciseStep = plan.exercises[exerciseIndex];
  const stepNumber = exerciseIndex + 1;
  const totalSteps = plan.exercises.length;
  const isLastStep = exerciseIndex === totalSteps - 1;
  const controlsDisabled = workoutSave.isSaving ? "disabled" : "";
  const canCancelWorkout =
    activeWorkout.id !== null &&
    activeWorkout.persistedExerciseCount > 0 &&
    !workoutSave.isSaving;

  return `
    <h1>PumpBuddy</h1>
    <section class="exercise-step" aria-live="polite" aria-label="Workout exercise step">
      <p class="plan-label">${escapeHtml(plan.name)}</p>
      <p class="step-counter">Exercise ${stepNumber} of ${totalSteps}</p>
      <h2 class="exercise-name">${escapeHtml(exerciseStep.name)}</h2>
      <p class="set-counter">Set ${exerciseStep.completedSets.length + 1}</p>
      ${
        workoutSave.errorMessage
          ? `<p class="save-error" role="alert">${escapeHtml(workoutSave.errorMessage)}</p>`
          : ""
      }
      ${
        workoutSave.isSaving
          ? '<p class="save-status" role="status">Saving workout progress...</p>'
          : ""
      }
      <section class="set-list" aria-label="Exercise sets">
        <h3 class="set-list-title">Sets</h3>
        <ol class="set-rows">
          ${exerciseStep.completedSets
            .map((set) => renderSetRow(set.setIndex, set, controlsDisabled, false))
            .join("")}
          ${renderSetRow(
            exerciseStep.completedSets.length + 1,
            exerciseStep.activeSet,
            controlsDisabled,
            true,
          )}
        </ol>
      </section>
      <div class="step-actions">
        <button type="button" class="nav-button" data-action="next-set" ${controlsDisabled}>
          ${workoutSave.isSaving ? "Saving..." : "Next Set"}
        </button>
        <button type="button" class="nav-button" data-action="next-exercise" ${controlsDisabled}>
          ${workoutSave.isSaving ? "Saving..." : isLastStep ? "Complete Plan" : "Next Exercise"}
        </button>
      </div>
      ${
        canCancelWorkout
          ? `<button type="button" class="nav-button cancel-button" data-action="cancel-workout">Cancel Workout</button>`
          : ""
      }
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
  action: "start-workout" | "next",
  totalExercises: number,
): ViewState => {
  if (action === "start-workout") {
    return { screen: "exercise", exerciseIndex: 0 };
  }

  if (viewState.screen !== "exercise") {
    return viewState;
  }

  if (viewState.exerciseIndex < totalExercises - 1) {
    return {
      ...viewState,
      exerciseIndex: viewState.exerciseIndex + 1,
    };
  }

  return { screen: "completion" };
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
    activeWorkout: {
      id: null,
      startedAt: null,
      persistedExerciseCount: 0,
    },
    workoutSave: {
      isSaving: false,
      errorMessage: null,
    },
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

    app.innerHTML = renderExerciseScreen(
      state.workoutPlan,
      state.viewState.exerciseIndex,
      state.activeWorkout,
      state.workoutSave,
    );
  };

  const loadStartScreenSelections = async (): Promise<void> => {
    const { trainingPlans, gyms } = await loadStartScreenData(fetchJson);

    state = {
      ...state,
      workoutPlan: null,
      viewState: { screen: "start" },
      startScreen: {
        ...state.startScreen,
        isLoading: false,
        isStarting: false,
        errorMessage: null,
        trainingPlans,
        gyms,
        selectedTrainingPlanId: trainingPlans[0]?.id ?? "",
        selectedGymId: gyms[0]?.id ?? "",
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
    };
  };

  const bootstrapStartScreen = async (): Promise<void> => {
    try {
      const activeWorkoutResponse = await loadActiveWorkout(fetchJson);

      if (activeWorkoutResponse) {
        const optionsResponse = await fetchJson<TrainingPlanOptionsResponse>(
          `/api/training-plans/${activeWorkoutResponse.workout.training_plan_id}/options?gymId=${encodeURIComponent(
            activeWorkoutResponse.workout.gym_id,
          )}`,
        );
        const workoutPlan = buildWorkoutPlanFromActiveWorkout(activeWorkoutResponse, optionsResponse);

        state = {
          ...state,
          workoutPlan,
          viewState: {
            screen: "exercise",
            exerciseIndex: activeWorkoutResponse.workout.current_exercise_position - 1,
          },
          startScreen: {
            ...state.startScreen,
            isLoading: false,
            errorMessage: null,
            selectedTrainingPlanId: activeWorkoutResponse.workout.training_plan_id,
            selectedGymId: activeWorkoutResponse.workout.gym_id,
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
        };
      } else {
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
      }
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
      const workoutPlan = buildWorkoutPlan(selectedPlan, optionsResponse);

      state = {
        ...state,
        workoutPlan,
        startScreen: {
          ...state.startScreen,
          isStarting: false,
        },
        activeWorkout: {
          id: null,
          startedAt: now(),
          persistedExerciseCount: 0,
        },
        workoutSave: {
          isSaving: false,
          errorMessage: null,
        },
      };
      state.viewState = getNextViewState(state.viewState, "start-workout", workoutPlan.exercises.length);
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

  const cancelWorkout = async (): Promise<void> => {
    if (
      state.viewState.screen !== "exercise" ||
      !state.workoutPlan ||
      state.workoutSave.isSaving ||
      !state.activeWorkout.id ||
      state.activeWorkout.persistedExerciseCount < 1
    ) {
      return;
    }

    const shouldCancel = window.confirm(
      "Cancel this workout? Your unfinished workout data will be deleted.",
    );
    if (!shouldCancel) {
      return;
    }

    state = {
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    };
    render();

    try {
      await activeWorkoutApi.cancelActiveWorkout(state.activeWorkout.id);
      await loadStartScreenSelections();
    } catch {
      state = {
        ...state,
        workoutSave: {
          isSaving: false,
          errorMessage: "Unable to cancel this workout. Try again.",
        },
      };
    }

    render();
  };

  const persistActiveSet = async (advance: "set" | "exercise"): Promise<void> => {
    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const currentExercisePosition = state.viewState.exerciseIndex + 1;
    const totalExercises = state.workoutPlan.exercises.length;
    const isLastExercise = currentExercisePosition === totalExercises;
    const shouldComplete = advance === "exercise" && isLastExercise;
    const draftPlan = withCurrentSetCompleted(state.workoutPlan, state.viewState.exerciseIndex);
    const startedAt = state.activeWorkout.startedAt ?? now();
    const nextExercisePosition =
      advance === "set" ? currentExercisePosition : Math.min(currentExercisePosition + 1, totalExercises);

    state = {
      ...state,
      workoutSave: {
        isSaving: true,
        errorMessage: null,
      },
    };
    render();

    try {
      if (shouldComplete) {
        let workoutId = state.activeWorkout.id;

        if (!workoutId) {
          const createResponse = await activeWorkoutApi.createActiveWorkout({
            ...buildActiveWorkoutProgressPayload(
              draftPlan,
              state.startScreen.selectedGymId,
              startedAt,
              currentExercisePosition,
            ),
            first_confirmed_exercise_position: currentExercisePosition,
          });

          workoutId = createResponse.workout.id;
        }

        await activeWorkoutApi.completeActiveWorkout(workoutId, {
          ...buildActiveWorkoutProgressPayload(
            draftPlan,
            state.startScreen.selectedGymId,
            startedAt,
            currentExercisePosition,
          ),
          completed_at: now(),
          last_confirmed_exercise_position: currentExercisePosition,
        });

        state = {
          ...state,
          workoutPlan: draftPlan,
          viewState: { screen: "completion" },
          activeWorkout: {
            id: null,
            startedAt: null,
            persistedExerciseCount: 0,
          },
          workoutSave: {
            isSaving: false,
            errorMessage: null,
          },
        };
      } else {
        const response = state.activeWorkout.id
          ? await activeWorkoutApi.updateActiveWorkout(state.activeWorkout.id, {
              ...buildActiveWorkoutProgressPayload(
                draftPlan,
                state.startScreen.selectedGymId,
                startedAt,
                nextExercisePosition,
              ),
              last_confirmed_exercise_position: currentExercisePosition,
            })
          : await activeWorkoutApi.createActiveWorkout({
              ...buildActiveWorkoutProgressPayload(
                draftPlan,
                state.startScreen.selectedGymId,
                startedAt,
                nextExercisePosition,
              ),
              first_confirmed_exercise_position: currentExercisePosition,
            });

        state = {
          ...state,
          workoutPlan: applyActiveWorkoutResponse(draftPlan, response),
          viewState: {
            screen: "exercise",
            exerciseIndex: response.workout.current_exercise_position - 1,
          },
          activeWorkout: {
            id: response.workout.id,
            startedAt: response.workout.started_at,
            persistedExerciseCount: countPersistedExercises(response),
          },
          workoutSave: {
            isSaving: false,
            errorMessage: null,
          },
        };
      }
    } catch {
      state = {
        ...state,
        workoutSave: {
          isSaving: false,
          errorMessage: "Unable to save this workout. Try again.",
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

    if (state.viewState.screen !== "exercise" || !state.workoutPlan || state.workoutSave.isSaving) {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!currentStep) {
      return;
    }

    if (action === "decrement-load") {
      currentStep.activeSet.loadValue = Math.max(0, currentStep.activeSet.loadValue - 1);
      render();
      return;
    }

    if (action === "increment-load") {
      currentStep.activeSet.loadValue += 1;
      render();
      return;
    }

    if (action === "decrement-reps") {
      currentStep.activeSet.reps = Math.max(1, currentStep.activeSet.reps - 1);
      render();
      return;
    }

    if (action === "increment-reps") {
      currentStep.activeSet.reps += 1;
      render();
      return;
    }

    if (action === "next-set") {
      void persistActiveSet("set");
      return;
    }

    if (action === "next-exercise") {
      void persistActiveSet("exercise");
      return;
    }

    if (action === "cancel-workout") {
      void cancelWorkout();
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

    if (state.viewState.screen !== "exercise" || !state.workoutPlan) {
      return;
    }

    const currentStep = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!currentStep) {
      return;
    }

    const nextValue = target.value.trim();

    if (!isDigitsOnly(nextValue)) {
      if (target.dataset.action === "load-input") {
        target.value = String(currentStep.activeSet.loadValue);
      } else if (target.dataset.action === "reps-input") {
        target.value = String(currentStep.activeSet.reps);
      }
      return;
    }

    if (target.dataset.action === "load-input") {
      currentStep.activeSet.loadValue = Number(nextValue);
      return;
    }

    if (target.dataset.action === "reps-input") {
      currentStep.activeSet.reps = Math.max(1, Number(nextValue));
      target.value = String(currentStep.activeSet.reps);
    }
  });

  render();
  void bootstrapStartScreen();
};
