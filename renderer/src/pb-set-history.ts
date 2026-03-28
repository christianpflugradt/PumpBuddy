import { formatLoadWithUnitDisplay } from "./workout-load-display";

export const pbSetHistoryTag = "pb-set-history";

export type SetHistoryItem = {
  setIndex: number;
  loadValue: number | null;
  reps: number;
};

export type SetHistoryState = {
  items: SetHistoryItem[];
};

const renderCompletedSetRow = (item: SetHistoryItem): string => `
  <li class="completed-set-row" aria-label="Completed set ${item.setIndex}: ${formatLoadWithUnitDisplay(
    item.loadValue,
  )} for ${item.reps} reps">
    <span class="completed-set-cell completed-set-cell-index">${item.setIndex}</span>
    <span class="completed-set-cell">${formatLoadWithUnitDisplay(item.loadValue)}</span>
    <span class="completed-set-cell">${item.reps}</span>
    <span class="completed-set-cell completed-set-cell-status" aria-hidden="true">✓</span>
  </li>
`;

class PbSetHistoryElement extends HTMLElement {
  #state: SetHistoryState | null = null;
  #shadow = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.#render();
  }

  set state(value: SetHistoryState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): SetHistoryState | null {
    return this.#state;
  }

  #render(): void {
    const state = this.#state;
    const items = state?.items ?? [];

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      <section
        class="completed-set-list"
        aria-label="Completed set history"
        data-history-state="${items.length > 0 ? "populated" : "empty"}"
      >
        <h4 class="set-list-subtitle">History</h4>
        <div class="completed-set-header" aria-hidden="true">
          <span class="completed-set-header-cell">Set</span>
          <span class="completed-set-header-cell">Kg</span>
          <span class="completed-set-header-cell">Reps</span>
          <span class="completed-set-header-cell">Status</span>
        </div>
        ${
          items.length > 0
            ? `<ol class="completed-set-rows">
                ${items.map((item) => renderCompletedSetRow(item)).join("")}
              </ol>`
            : `<p class="completed-set-empty" role="status">No completed sets yet.</p>`
        }
      </section>
    `;
  }
}

export const registerPbSetHistory = (): void => {
  if (!customElements.get(pbSetHistoryTag)) {
    customElements.define(pbSetHistoryTag, PbSetHistoryElement);
  }
};
