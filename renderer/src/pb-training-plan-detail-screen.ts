import type {
  GymSummary,
  TrainingPlanDetailResponse,
  TrainingPlanExerciseDetail,
  TrainingPlanExecutionStatus,
} from "./workout-contract";

export const pbTrainingPlanDetailScreenTag = "pb-training-plan-detail-screen";

export type TrainingPlanDetailScreenState = {
  trainingPlanId: string;
  selectedGymId: string | null;
  detail: TrainingPlanDetailResponse | null;
  gyms: GymSummary[];
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "navigate-back-from-training-plan-detail"
  | "select-training-plan-detail-gym"
  | "open-training-plan-exercise-detail";

type StatusTone = "green" | "yellow" | "red" | "gray";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(count)))} ${
    Math.floor(count) === 1 ? singular : plural
  }`;

const sortExercises = (exercises: TrainingPlanExerciseDetail[]): TrainingPlanExerciseDetail[] =>
  [...exercises].sort((left, right) => {
    const positionComparison = left.exercise_position - right.exercise_position;
    return positionComparison === 0
      ? left.exercise_name.localeCompare(right.exercise_name)
      : positionComparison;
  });

const resolveStatusTone = (status: TrainingPlanExecutionStatus | null): StatusTone => {
  if (status === "GREEN") {
    return "green";
  }

  if (status === "YELLOW") {
    return "yellow";
  }

  if (status === "RED") {
    return "red";
  }

  return "gray";
};

const resolvePlanTone = (isExecutable: boolean | null): StatusTone => {
  if (isExecutable === true) {
    return "green";
  }

  if (isExecutable === false) {
    return "red";
  }

  return "gray";
};

const formatPlanStatusTitle = (isExecutable: boolean | null): string => {
  if (isExecutable === true) {
    return "Plan is executable";
  }

  if (isExecutable === false) {
    return "Plan is not executable";
  }

  return "Plan availability unavailable";
};

const formatPlanExecutionSummary = (detail: TrainingPlanDetailResponse): string => {
  const totalExercises = detail.exercises.length;
  if (detail.is_executable === true) {
    return `All ${pluralize(totalExercises, "exercise")} ${
      totalExercises === 1 ? "has" : "have"
    } at least one executable variant.`;
  }

  const unavailableExerciseCount = detail.exercises.filter(
    (exercise) => (exercise.executable_variant_count ?? 0) <= 0,
  ).length;
  return `${unavailableExerciseCount} of ${pluralize(totalExercises, "exercise")} ${
    unavailableExerciseCount === 1 ? "has" : "have"
  } no executable variant.`;
};

const formatVariantExecutionSummary = (detail: TrainingPlanDetailResponse): string => {
  const totalVariants = detail.exercises.reduce(
    (sum, exercise) => sum + exercise.configured_variant_count,
    0,
  );
  const executableVariants = detail.exercises.reduce(
    (sum, exercise) => sum + (exercise.executable_variant_count ?? 0),
    0,
  );
  return `${executableVariants} of ${totalVariants} variants executable`;
};

const formatAvailableCount = (exercise: TrainingPlanExerciseDetail): string => {
  const executableVariantCount = exercise.executable_variant_count ?? 0;
  return `${executableVariantCount} of ${exercise.configured_variant_count} variants available`;
};

const formatExerciseStatusAriaLabel = (status: TrainingPlanExecutionStatus | null): string => {
  if (status === "GREEN") {
    return "All variants available";
  }

  if (status === "YELLOW") {
    return "Some variants available";
  }

  if (status === "RED") {
    return "No variants available";
  }

  return "Availability unavailable";
};

class PbTrainingPlanDetailScreenElement extends HTMLElement {
  #state: TrainingPlanDetailScreenState = {
    trainingPlanId: "",
    selectedGymId: null,
    detail: null,
    gyms: [],
    isLoading: false,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
  }

  set state(value: TrainingPlanDetailScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): TrainingPlanDetailScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction, payload?: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: payload ? { action, payload } : { action },
      }),
    );
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) {
      return;
    }

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    if (action === "open-training-plan-exercise-detail") {
      const trainingPlanExerciseId = actionElement.dataset.trainingPlanExerciseId?.trim() ?? "";
      if (trainingPlanExerciseId.length === 0) {
        return;
      }
      this.#emitUiAction(action, { trainingPlanExerciseId });
      return;
    }

    this.#emitUiAction(action);
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !this.contains(target)) {
      return;
    }

    if (target.dataset.selectAction !== "select-training-plan-detail-gym") {
      return;
    }

    const selectedGymId = target.value.trim();
    this.#emitUiAction("select-training-plan-detail-gym", {
      selectedGymId: selectedGymId.length > 0 ? selectedGymId : null,
    });
  };

  #renderGymSelect(): string {
    const selectedGymId = this.#state.selectedGymId ?? "";
    const hasSelectedGymOption =
      selectedGymId.length === 0 || this.#state.gyms.some((gym) => gym.id === selectedGymId);
    const selectedFallbackOption =
      selectedGymId.length > 0 && !hasSelectedGymOption
        ? `<option value="${escapeAttribute(selectedGymId)}" selected>Selected gym</option>`
        : "";

    return `
      <label class="training-plan-detail-gym-field">
        <span class="training-plan-detail-gym-label">Select gym</span>
        <select class="training-plan-detail-gym-select" data-select-action="select-training-plan-detail-gym">
          <option value=""${selectedGymId.length === 0 ? " selected" : ""}>No gym selected</option>
          ${selectedFallbackOption}
          ${this.#state.gyms
            .map(
              (gym) => `
                <option value="${escapeAttribute(gym.id)}"${gym.id === selectedGymId ? " selected" : ""}>
                  ${escapeHtml(gym.name)}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    `;
  }

  #renderStatus(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading training plan detail...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (!this.#state.detail) {
      return `<p class="start-status" role="status">Training plan detail unavailable.</p>`;
    }

    return "";
  }

  #renderPlanExecution(detail: TrainingPlanDetailResponse): string {
    if (!this.#state.selectedGymId) {
      return "";
    }

    const tone = resolvePlanTone(detail.is_executable);
    const summary = detail.execution_summary?.trim() || formatPlanExecutionSummary(detail);

    return `
      <div class="training-plan-detail-plan-summary">
        <section
          class="training-plan-detail-plan-status training-plan-detail-status--${tone}"
          aria-label="Plan execution status"
        >
          <div class="training-plan-detail-plan-status-main">
            <span class="training-plan-detail-status-dot" aria-hidden="true"></span>
            <div>
              <p class="training-plan-detail-plan-status-title">
                ${escapeHtml(formatPlanStatusTitle(detail.is_executable))}
              </p>
              <p class="training-plan-detail-plan-status-copy">${escapeHtml(summary)}</p>
            </div>
          </div>
        </section>
        <p class="training-plan-detail-summary">${escapeHtml(formatVariantExecutionSummary(detail))}</p>
      </div>
    `;
  }

  #renderNoGymExercise(exercise: TrainingPlanExerciseDetail): string {
    return `
      <li>
        <button
          type="button"
          class="training-plan-detail-exercise-card"
          data-ui-action="open-training-plan-exercise-detail"
          data-training-plan-exercise-id="${escapeAttribute(exercise.training_plan_exercise_id)}"
          aria-label="Open ${escapeAttribute(exercise.exercise_name)} exercise in plan"
        >
          <span class="training-plan-detail-exercise-main">
            <span class="workout-detail-exercise-position">
              ${escapeHtml(String(exercise.exercise_position))}
            </span>
            <span class="training-plan-detail-exercise-name">${escapeHtml(exercise.exercise_name)}</span>
            <span class="workout-detail-exercise-subtitle">
              ${escapeHtml(pluralize(exercise.configured_variant_count, "variant"))}
            </span>
          </span>
          <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
        </button>
      </li>
    `;
  }

  #renderSelectedGymExercise(exercise: TrainingPlanExerciseDetail): string {
    const tone = resolveStatusTone(exercise.execution_status);
    return `
      <li>
        <button
          type="button"
          class="training-plan-detail-exercise-card training-plan-detail-exercise-card--${tone}"
          data-ui-action="open-training-plan-exercise-detail"
          data-training-plan-exercise-id="${escapeAttribute(exercise.training_plan_exercise_id)}"
          aria-label="Open ${escapeAttribute(exercise.exercise_name)} exercise in plan"
        >
          <span class="training-plan-detail-exercise-main">
            <span class="workout-detail-exercise-position">
              ${escapeHtml(String(exercise.exercise_position))}
            </span>
            <span class="training-plan-detail-exercise-title-row">
              <span class="training-plan-detail-exercise-name">${escapeHtml(exercise.exercise_name)}</span>
              <span
                class="training-plan-detail-exercise-status training-plan-detail-status--${tone}"
                aria-label="${escapeAttribute(formatExerciseStatusAriaLabel(exercise.execution_status))}"
              >
                <span class="training-plan-detail-status-dot" aria-hidden="true"></span>
              </span>
            </span>
            <span class="workout-detail-exercise-subtitle">
              ${escapeHtml(formatAvailableCount(exercise))}
            </span>
          </span>
          <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
        </button>
      </li>
    `;
  }

  #renderExercises(detail: TrainingPlanDetailResponse): string {
    const exercises = sortExercises(detail.exercises);
    if (exercises.length === 0) {
      return `<p class="start-copy">No exercises configured for this training plan.</p>`;
    }

    const hasSelectedGym = Boolean(this.#state.selectedGymId);
    return `
      <section class="training-plan-detail-exercises" aria-label="Exercises in training plan">
        <h3 class="training-plan-section-title">Exercises in this plan</h3>
        <ol class="training-plan-detail-exercise-list">
          ${exercises
            .map((exercise) =>
              hasSelectedGym
                ? this.#renderSelectedGymExercise(exercise)
                : this.#renderNoGymExercise(exercise),
            )
            .join("")}
        </ol>
      </section>
    `;
  }

  #render(): void {
    const detail = this.#state.detail;
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle detail-back-button"
          data-ui-action="navigate-back-from-training-plan-detail"
          aria-label="Back to training plans"
        >
          <span aria-hidden="true">←</span>
        </button>
        <section class="screen-panel start-screen workout-detail-screen training-plan-detail-screen" aria-label="Training Plan detail screen">
          <header class="exercise-variant-detail-header training-plan-detail-header">
            <h2 class="exercise-variant-detail-header-title">${escapeHtml(detail?.name ?? "Training Plan")}</h2>
            <p class="exercise-variant-detail-header-subtitle">Training Plan</p>
          </header>
          ${this.#renderGymSelect()}
          ${this.#renderStatus()}
          ${detail ? this.#renderPlanExecution(detail) : ""}
          ${detail ? this.#renderExercises(detail) : ""}
        </section>
      </div>
    `;
  }
}

export const registerPbTrainingPlanDetailScreen = (): void => {
  if (!customElements.get(pbTrainingPlanDetailScreenTag)) {
    customElements.define(pbTrainingPlanDetailScreenTag, PbTrainingPlanDetailScreenElement);
  }
};
