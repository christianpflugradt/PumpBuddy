export const pbWorkoutHeaderTag = "pb-workout-header";

export type WorkoutHeaderState = {
  title: string;
  subtitle?: string | null;
  contextLine?: string | null;
  isReadMode?: boolean;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

class PbWorkoutHeaderElement extends HTMLElement {
  #state: WorkoutHeaderState | null = null;
  #shadow = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.#render();
  }

  set state(value: WorkoutHeaderState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): WorkoutHeaderState | null {
    return this.#state;
  }

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.#shadow.innerHTML = "";
      return;
    }

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      <div class="exercise-step-header">
        <h2 class="exercise-name">${escapeHtml(state.title)}</h2>

        ${
          state.subtitle
            ? `<p class="exercise-variant-label">${escapeHtml(state.subtitle)}</p>`
            : ""
        }

        ${
          state.contextLine
            ? `<p class="plan-label">${escapeHtml(state.contextLine)}</p>`
            : ""
        }

        ${
          state.isReadMode
            ? `<p class="exercise-read-mode-indicator">Viewing previous exercise</p>`
            : ""
        }
      </div>
    `;
  }
}

export const registerPbWorkoutHeader = (): void => {
  if (!customElements.get(pbWorkoutHeaderTag)) {
    customElements.define(pbWorkoutHeaderTag, PbWorkoutHeaderElement);
  }
};
