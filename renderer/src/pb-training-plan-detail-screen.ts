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

const formatStatusLabel = (status: TrainingPlanExecutionStatus | null): string => {
  if (status === "GREEN") {
    return "Green";
  }

  if (status === "YELLOW") {
    return "Yellow";
  }

  if (status === "RED") {
    return "Red";
  }

  return "Not assessed";
};

const formatPlanExecutable = (isExecutable: boolean | null, gymName: string): string => {
  if (isExecutable === true) {
    return `Executable in ${gymName}`;
  }

  if (isExecutable === false) {
    return `Not executable in ${gymName}`;
  }

  return `Execution unknown in ${gymName}`;
};

const formatExecutableCount = (exercise: TrainingPlanExerciseDetail): string => {
  if (exercise.executable_variant_count === null) {
    return "Executable variants unavailable";
  }

  return `${exercise.executable_variant_count} of ${pluralize(
    exercise.configured_variant_count,
    "configured variant",
  )} executable`;
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

  #selectedGym(): GymSummary | null {
    const selectedGymId = this.#state.selectedGymId;
    if (!selectedGymId) {
      return null;
    }

    return this.#state.gyms.find((gym) => gym.id === selectedGymId) ?? null;
  }

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
        <span class="training-plan-detail-gym-label">Gym context</span>
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

  #renderPlanExecution(detail: TrainingPlanDetailResponse, selectedGym: GymSummary | null): string {
    if (!this.#state.selectedGymId) {
      return "";
    }

    const gymName = selectedGym?.name ?? "selected gym";
    const tone = resolveStatusTone(detail.execution_status);
    const summary = detail.execution_summary?.trim() ?? "";

    return `
      <section
        class="training-plan-detail-plan-status training-plan-detail-status--${tone}"
        aria-label="Plan execution status"
      >
        <div class="training-plan-detail-plan-status-main">
          <span class="training-plan-detail-status-dot" aria-hidden="true"></span>
          <div>
            <p class="training-plan-detail-plan-status-title">
              ${escapeHtml(formatPlanExecutable(detail.is_executable, gymName))}
            </p>
            <p class="training-plan-detail-plan-status-label">${escapeHtml(formatStatusLabel(detail.execution_status))}</p>
          </div>
        </div>
        ${summary ? `<p class="training-plan-detail-summary">${escapeHtml(summary)}</p>` : ""}
      </section>
    `;
  }

  #renderNoGymExercise(exercise: TrainingPlanExerciseDetail, totalExercises: number): string {
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
              ${escapeHtml(String(exercise.exercise_position))} of ${escapeHtml(String(totalExercises))}
            </span>
            <span class="training-plan-detail-exercise-name">${escapeHtml(exercise.exercise_name)}</span>
            <span class="workout-detail-exercise-subtitle">
              ${escapeHtml(pluralize(exercise.configured_variant_count, "configured variant"))}
            </span>
          </span>
          <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
        </button>
      </li>
    `;
  }

  #renderSelectedGymExercise(exercise: TrainingPlanExerciseDetail, totalExercises: number): string {
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
              ${escapeHtml(String(exercise.exercise_position))} of ${escapeHtml(String(totalExercises))}
            </span>
            <span class="training-plan-detail-exercise-name">${escapeHtml(exercise.exercise_name)}</span>
            <span class="workout-detail-exercise-subtitle">
              ${escapeHtml(formatExecutableCount(exercise))}
            </span>
          </span>
          <span class="training-plan-detail-exercise-status training-plan-detail-status--${tone}">
            <span class="training-plan-detail-status-dot" aria-hidden="true"></span>
            ${escapeHtml(formatStatusLabel(exercise.execution_status))}
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
        <ol class="training-plan-detail-exercise-list">
          ${exercises
            .map((exercise) =>
              hasSelectedGym
                ? this.#renderSelectedGymExercise(exercise, exercises.length)
                : this.#renderNoGymExercise(exercise, exercises.length),
            )
            .join("")}
        </ol>
      </section>
    `;
  }

  #render(): void {
    const detail = this.#state.detail;
    const selectedGym = this.#selectedGym();
    const exerciseCount = detail?.exercises.length ?? 0;
    this.innerHTML = `
      <section class="screen-panel start-screen training-plan-detail-screen" aria-label="Training Plan detail screen">
        <button
          type="button"
          class="nav-button nav-button-secondary training-plan-detail-back"
          data-ui-action="navigate-back-from-training-plan-detail"
        >
          Back to Training Plans
        </button>
        <div class="gym-detail-header training-plan-detail-header">
          <div>
            <h2 class="settings-title">${escapeHtml(detail?.name ?? "Training Plan")}</h2>
            <p class="training-plan-detail-subtitle">
              ${escapeHtml(pluralize(exerciseCount, "exercise"))}
            </p>
          </div>
          ${this.#renderGymSelect()}
        </div>
        ${this.#renderStatus()}
        ${detail ? this.#renderPlanExecution(detail, selectedGym) : ""}
        ${detail ? this.#renderExercises(detail) : ""}
      </section>
    `;
  }
}

export const registerPbTrainingPlanDetailScreen = (): void => {
  if (!customElements.get(pbTrainingPlanDetailScreenTag)) {
    customElements.define(pbTrainingPlanDetailScreenTag, PbTrainingPlanDetailScreenElement);
  }
};
