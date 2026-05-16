import type { WorkoutProgressStatus } from "./workout-contract";
import type { WorkoutPlan } from "./workout-types";
import { countCompletedExerciseLogicalSets } from "./logical-set-count";
import { sumWorkoutPlanVolumeKg } from "./workout-volume";

export const pbCompletionScreenTag = "pb-completion-screen";

export type CompletionScreenState = {
  plan: WorkoutPlan;
  completion: {
    startedAt: string | null;
    completedAt: string | null;
    averageDurationMinutes?: number | null;
    workoutProgress?: number | null;
    workoutProgressStatus?: WorkoutProgressStatus;
  };
};

type UiAction = "return-to-start";
type ProgressTone = "green" | "yellow" | "red" | "gray";
type CompletionStatKey = "exercises" | "sets" | "reps" | "kg-moved";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderCompletionHeader = (): string => `
  <header class="app-header">
    <img
      class="start-banner"
      src="/images/banner.png?v=20260401-2"
      alt="PumpBuddy banner"
    />
  </header>
`;

const progressMessageByTone: Record<ProgressTone, string> = {
  green: "You've improved on your recent level. Great work.",
  yellow: "You've maintained your recent level. Solid work.",
  red: "You went a bit lighter today - that's part of the process.",
  gray: "Not enough similar data yet for a comparison.",
};

const resolveProgressTone = (completion: CompletionScreenState["completion"]): ProgressTone => {
  if (completion.workoutProgressStatus !== "AVAILABLE" || completion.workoutProgress == null) {
    return "gray";
  }

  if (completion.workoutProgress < 0.95) {
    return "red";
  }

  if (completion.workoutProgress <= 1.03) {
    return "yellow";
  }

  return "green";
};

const renderProgressVisual = (tone: ProgressTone): string => {
  if (tone === "gray") {
    return `
      <div class="completion-progress-wave" aria-hidden="true">
        <svg viewBox="0 0 200 20" focusable="false" aria-hidden="true">
          <path d="M0 10 C10 4, 20 4, 30 10 S50 16, 60 10 S80 4, 90 10 S110 16, 120 10 S140 4, 150 10 S170 16, 180 10 S200 10, 200 10"></path>
        </svg>
      </div>
    `;
  }

  const arrowPath = tone === "red" ? "M11 2.5 L4 7 L11 11.5" : "M3 2.5 L10 7 L3 11.5";

  return `
    <div class="completion-progress-flow" aria-hidden="true">
      <span class="completion-progress-arrow completion-progress-arrow-1">
        <svg viewBox="0 0 14 14" focusable="false" aria-hidden="true">
          <path d="${arrowPath}"></path>
        </svg>
      </span>
      <span class="completion-progress-arrow completion-progress-arrow-2">
        <svg viewBox="0 0 14 14" focusable="false" aria-hidden="true">
          <path d="${arrowPath}"></path>
        </svg>
      </span>
      <span class="completion-progress-arrow completion-progress-arrow-3">
        <svg viewBox="0 0 14 14" focusable="false" aria-hidden="true">
          <path d="${arrowPath}"></path>
        </svg>
      </span>
      <span class="completion-progress-arrow completion-progress-arrow-4">
        <svg viewBox="0 0 14 14" focusable="false" aria-hidden="true">
          <path d="${arrowPath}"></path>
        </svg>
      </span>
    </div>
  `;
};

const computeDurationMinutes = (startedAt: string | null, completedAt: string | null): number => {
  if (!startedAt || !completedAt) {
    return 0;
  }

  const startedAtMs = Date.parse(startedAt);
  const completedAtMs = Date.parse(completedAt);
  if (Number.isNaN(startedAtMs) || Number.isNaN(completedAtMs) || completedAtMs <= startedAtMs) {
    return 0;
  }

  return Math.max(1, Math.floor((completedAtMs - startedAtMs) / 60000));
};

const formatDurationDeltaText = (
  actualDurationMinutes: number,
  averageDurationMinutes: number | null | undefined,
): string | null => {
  if (averageDurationMinutes == null || averageDurationMinutes <= 0) {
    return null;
  }

  const deviationMinutes = actualDurationMinutes - averageDurationMinutes;
  if (Math.abs(deviationMinutes) < 5) {
    return null;
  }

  const absDeviation = Math.abs(Math.round(deviationMinutes));
  return deviationMinutes < 0
    ? `${absDeviation} min shorter than usual`
    : `${absDeviation} min longer than usual`;
};

const formatWholeNumber = (value: number): string => new Intl.NumberFormat("en-US").format(value);

const renderCompletionStatIcon = (key: CompletionStatKey): string => {
  if (key === "exercises") {
    return `
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M3 9h2v6H3V9zm3-2h2v10H6V7zm3 4h6v2H9v-2zm7-4h2v10h-2V7zm3 2h2v6h-2V9z"></path>
      </svg>
    `;
  }

  if (key === "sets") {
    return `
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M4 6h12v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z"></path>
      </svg>
    `;
  }

  if (key === "reps") {
    return `
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 4a8 8 0 0 1 7.2 4.5l-1.8.9A6 6 0 1 0 18 12h2a8 8 0 1 1-8-8zm5.6.4L21 5v3.4h-1.8V6.8L16.8 9 15.6 7.8l2-1.9z"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M12 5c4.1 0 7 1.5 7 3.5S16.1 12 12 12s-7-1.5-7-3.5S7.9 5 12 5zm-7 6c0 2 2.9 3.5 7 3.5s7-1.5 7-3.5v2.5c0 2-2.9 3.5-7 3.5s-7-1.5-7-3.5V11zm0 5c0 2 2.9 3.5 7 3.5s7-1.5 7-3.5v2.5c0 2-2.9 3.5-7 3.5s-7-1.5-7-3.5V16z"></path>
    </svg>
  `;
};

const computeCompletionStats = (plan: WorkoutPlan): Array<{ key: CompletionStatKey; value: string; label: string }> => {
  const repsCompletedSets = plan.exercises
    .filter((exercise) => exercise.repetitionKind !== "SECS")
    .flatMap((exercise) => exercise.completedSets);
  const exercisesCount = plan.exercises.length;
  const setCount = plan.exercises.reduce(
    (sum, exercise) => sum + countCompletedExerciseLogicalSets(exercise.completedSets, exercise.setTrackingMode),
    0,
  );
  const repsCount = repsCompletedSets.reduce((sum, set) => sum + set.reps, 0);
  const kgMoved = Math.round(sumWorkoutPlanVolumeKg(plan));

  return [
    { key: "exercises", value: formatWholeNumber(exercisesCount), label: "exercises" },
    { key: "sets", value: formatWholeNumber(setCount), label: "sets" },
    { key: "reps", value: formatWholeNumber(repsCount), label: "reps" },
    { key: "kg-moved", value: formatWholeNumber(kgMoved), label: "kg moved" },
  ];
};

class PbCompletionScreenElement extends HTMLElement {
  #state: CompletionScreenState | null = null;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: CompletionScreenState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): CompletionScreenState | null {
    return this.#state;
  }

  #emitUiAction(action: UiAction): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action },
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

    this.#emitUiAction(action);
  };

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    const { plan, completion } = state;
    const progressTone = resolveProgressTone(completion);
    const progressMessage = progressMessageByTone[progressTone];
    const completionStats = computeCompletionStats(plan);
    const durationMinutes = computeDurationMinutes(completion.startedAt, completion.completedAt);
    const durationDeltaText = formatDurationDeltaText(durationMinutes, completion.averageDurationMinutes);

    this.innerHTML = `
      <div class="app-screen-shell">
        <section class="screen-panel completion-screen" aria-label="Workout completion screen">
        ${renderCompletionHeader()}
        <p class="completion-plan-name">
          <span class="completion-plan-name-text">${escapeHtml(plan.name)}</span>
        </p>
        <h2 class="completion-title">Completed</h2>
        <section
          class="completion-progress completion-progress--${progressTone}"
          aria-label="Workout progress indicator"
          data-progress-tone="${progressTone}"
        >
          ${renderProgressVisual(progressTone)}
          <p class="completion-progress-message">${escapeHtml(progressMessage)}</p>
        </section>
        <section class="completion-duration" aria-label="Workout duration summary">
          <p class="completion-duration-primary">Duration: ${durationMinutes} min</p>
          ${
            durationDeltaText
              ? `<p class="completion-duration-secondary">${escapeHtml(durationDeltaText)}</p>`
              : ""
          }
        </section>
        <section class="completion-stats-grid" aria-label="Workout stats tiles">
          ${completionStats
            .map(
              (stat) => `
                <article class="completion-stat-tile completion-stat-tile--${stat.key}" aria-label="${escapeHtml(stat.label)}">
                  <div class="completion-stat-icon" aria-hidden="true">
                    ${renderCompletionStatIcon(stat.key)}
                  </div>
                  <p class="completion-stat-value">
                    <span class="completion-stat-number">${escapeHtml(stat.value)}</span>
                    <span class="completion-stat-label">${escapeHtml(stat.label)}</span>
                  </p>
                </article>
              `,
            )
            .join("")}
        </section>

        <div class="step-actions">
          <button
            type="button"
            class="nav-button nav-button-primary action-button action-button-primary"
            data-ui-action="return-to-start"
          >
            Return to Start
          </button>
        </div>
        </section>
      </div>
    `;
  }
}

export const registerPbCompletionScreen = (): void => {
  if (!customElements.get(pbCompletionScreenTag)) {
    customElements.define(pbCompletionScreenTag, PbCompletionScreenElement);
  }
};
