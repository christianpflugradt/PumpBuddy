import { buildCompletedSetHistoryModel } from "./completed-set-history";
import type { RepetitionKind, SetTrackingMode } from "./workout-types";

export const pbSetHistoryTag = "pb-set-history";

export type SetHistoryItem = {
  setIndex: number;
  loadValue: number | null;
  reps: number;
};

export type SetHistoryState = {
  items: SetHistoryItem[];
  setTrackingMode?: SetTrackingMode | null;
  repetitionKind?: RepetitionKind;
};

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
    const historyModel = buildCompletedSetHistoryModel(
      (state?.items ?? []).map((item) => ({
        setIndex: item.setIndex,
        loadValue: item.loadValue,
        reps: item.reps,
      })),
      state?.setTrackingMode,
      state?.repetitionKind,
    );

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      <section
        class="completed-set-list"
        aria-label="Completed set history"
        data-history-state="${historyModel.rows.length > 0 ? "populated" : "empty"}"
      >
        <h4 class="set-list-subtitle">History</h4>
        <div class="completed-set-header completed-set-grid--${historyModel.mode}" aria-hidden="true">
          ${historyModel.headerCells
            .map((cell) => `<span class="completed-set-header-cell">${cell}</span>`)
            .join("")}
        </div>
        ${
          historyModel.rows.length > 0
            ? `<ol class="completed-set-rows">
                ${historyModel.rows
                  .map(
                    (row) => `<li class="completed-set-row completed-set-grid--${historyModel.mode}" aria-label="${row.ariaLabel}">
                    ${row.cells
                      .map(
                        (cell, index) =>
                          `<span class="completed-set-cell${index === 0 ? " completed-set-cell-index" : ""}">${cell}</span>`,
                      )
                      .join("")}
                  </li>`,
                  )
                  .join("")}
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
