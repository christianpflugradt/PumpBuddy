import type { WorkoutPlan } from "./workout-types";

export const pbCompletionScreenTag = "pb-completion-screen";

export type CompletionScreenState = {
  plan: WorkoutPlan;
  completion: {
    startedAt: string | null;
    completedAt: string | null;
  };
};

type UiAction = "return-to-start";

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
    <p class="start-copy">Workout complete. Review your totals and start another session when ready.</p>
  </header>
`;

const formatDuration = (startedAt: string, completedAt: string): string => {
  const startedAtMs = Date.parse(startedAt);
  const completedAtMs = Date.parse(completedAt);
  if (Number.isNaN(startedAtMs) || Number.isNaN(completedAtMs) || completedAtMs <= startedAtMs) {
    return "0m";
  }

  const durationMinutes = Math.max(1, Math.floor((completedAtMs - startedAtMs) / 60000));
  return `${durationMinutes}m`;
};

const computeCompletionMetrics = (
  plan: WorkoutPlan,
  completion: { startedAt: string | null; completedAt: string | null },
): Array<{ label: string; value: string }> => {
  const exercisesCompleted = plan.exercises.length;
  const completedSets = plan.exercises.flatMap((exercise) => exercise.completedSets);
  const totalSetsCompleted = completedSets.length;
  const totalReps = completedSets.reduce((sum, set) => sum + set.reps, 0);
  const totalWeightMoved = completedSets.reduce((sum, set) => sum + (set.loadValue ?? 0) * set.reps, 0);
  const totalWeightMovedRounded = Math.round(totalWeightMoved);
  const workoutDuration =
    completion.startedAt && completion.completedAt
      ? formatDuration(completion.startedAt, completion.completedAt)
      : "0m";
  const durationMinutes = Number.parseInt(workoutDuration, 10);
  const volumePerMinute =
    durationMinutes > 0 ? totalWeightMovedRounded / durationMinutes : totalWeightMovedRounded;

  return [
    { label: "Exercises Completed", value: String(exercisesCompleted) },
    { label: "Total Sets Completed", value: String(totalSetsCompleted) },
    { label: "Total Reps", value: String(totalReps) },
    { label: "Total Weight Moved", value: `${totalWeightMovedRounded} kg` },
    { label: "Workout Duration", value: workoutDuration },
    { label: "Volume per Minute", value: `${volumePerMinute.toFixed(1)} kg/min` },
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
    const metrics = computeCompletionMetrics(plan, completion);

    this.innerHTML = `
      <section class="screen-panel completion-screen" aria-label="Workout completion screen">
        ${renderCompletionHeader()}
        <p class="plan-label">${escapeHtml(plan.name)}</p>
        <h2 class="completion-title">Plan Completed</h2>
        <p class="completion-copy">Great work. You finished all ${plan.exercises.length} exercises.</p>

        <dl class="completion-metrics" aria-label="Workout completion metrics">
          ${metrics
            .map(
              (metric) => `
                <div class="completion-metric-row">
                  <dt class="completion-metric-key">${escapeHtml(metric.label)}</dt>
                  <dd class="completion-metric-value">${escapeHtml(metric.value)}</dd>
                </div>
              `,
            )
            .join("")}
        </dl>

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
    `;
  }
}

export const registerPbCompletionScreen = (): void => {
  if (!customElements.get(pbCompletionScreenTag)) {
    customElements.define(pbCompletionScreenTag, PbCompletionScreenElement);
  }
};
