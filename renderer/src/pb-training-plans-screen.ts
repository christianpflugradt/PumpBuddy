import type { TrainingPlanSummary } from "./workout-contract";
import "./pb-side-menu";

export const pbTrainingPlansScreenTag = "pb-training-plans-screen";

export type TrainingPlansScreenState = {
  trainingPlans: TrainingPlanSummary[];
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "open-training-plan-detail"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-gyms"
  | "navigate-history"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const formatExerciseCount = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) {
    return "Exercises unavailable";
  }

  const exerciseCount = Math.floor(value);
  return exerciseCount === 1 ? "1 exercise" : `${exerciseCount} exercises`;
};

const formatLastCompleted = (value: string | null | undefined): string => {
  if (!value) {
    return "Never completed";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Never completed";
  }

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);

  return `Last completed ${formattedDate}`;
};

class PbTrainingPlansScreenElement extends HTMLElement {
  #state: TrainingPlansScreenState = {
    trainingPlans: [],
    isLoading: false,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
  }

  set state(value: TrainingPlansScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): TrainingPlansScreenState {
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


    if (action === "open-training-plan-detail") {
      const trainingPlanId = actionElement.dataset.trainingPlanId?.trim() ?? "";
      if (trainingPlanId.length === 0) {
        return;
      }

      this.#emitUiAction(action, { trainingPlanId });
      return;
    }

    this.#emitUiAction(action);
  };

  #renderRows(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading training plans...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (this.#state.trainingPlans.length === 0) {
      return `<p class="start-copy">No training plans available yet.</p>`;
    }

    return `
      <div class="history-sections" aria-label="Training plans list">
        <section class="history-month-section" aria-label="Training Plans">
          <ul class="history-workout-list" aria-label="Training Plans">
            ${this.#state.trainingPlans
              .map((trainingPlan) => {
                const exerciseCountText = formatExerciseCount(trainingPlan.exercise_count);
                const lastCompletedText = formatLastCompleted(trainingPlan.last_completed_at);
                return `
                  <li>
                    <button
                      type="button"
                      class="history-workout-row"
                      data-ui-action="open-training-plan-detail"
                      data-training-plan-id="${escapeAttribute(trainingPlan.id)}"
                      aria-label="Open ${escapeAttribute(trainingPlan.name)} training plan details"
                    >
                      <span class="history-workout-row-body">
                        <span class="history-workout-row-title">${escapeHtml(trainingPlan.name)}</span>
                        <span class="history-workout-row-meta">
                          ${escapeHtml(exerciseCountText)} &middot; ${escapeHtml(lastCompletedText)}
                        </span>
                      </span>
                      <span class="history-workout-chevron" aria-hidden="true">&#8250;</span>
                    </button>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </section>
      </div>
    `;
  }

  #render(): void {
    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <pb-side-menu active-screen="training-plans" menu-id="training-plans-screen-side-menu"></pb-side-menu>
        <section class="screen-panel start-screen" aria-label="Training Plans screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <h2 class="settings-title">Training Plans</h2>
          ${this.#renderRows()}
        </section>
      </div>
    `;
  }
}

export const registerPbTrainingPlansScreen = (): void => {
  if (!customElements.get(pbTrainingPlansScreenTag)) {
    customElements.define(pbTrainingPlansScreenTag, PbTrainingPlansScreenElement);
  }
};
