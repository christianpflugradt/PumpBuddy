export const pbConfirmDialogTag = "pb-confirm-dialog";

export type ConfirmDialogState = {
  message: string | null;
  confirmActionLabel: string | null;
  controlsDisabled: boolean;
};

type UiAction =
  | "confirm-dialog-dismiss"
  | "confirm-dialog-confirm";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

class PbConfirmDialogElement extends HTMLElement {
  #state: ConfirmDialogState | null = null;
  #shadow = this.attachShadow({ mode: "open" });

  connectedCallback(): void {
    this.#render();
    this.#shadow.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.#shadow.removeEventListener("click", this.#onClick);
  }

  set state(value: ConfirmDialogState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): ConfirmDialogState | null {
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
    if (!actionElement || !this.#shadow.contains(actionElement)) {
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
    if (!state || !state.message) {
      this.#shadow.innerHTML = "";
      return;
    }

    const controlsDisabled = state.controlsDisabled ? "disabled" : "";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: contents;
        }
      </style>

      <div class="confirm-dialog-layer" role="presentation">
        <div class="confirm-dialog-backdrop" role="presentation"></div>
        <section
          class="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirmation dialog"
        >
          <p class="confirm-dialog-message">${escapeHtml(state.message)}</p>
          <div class="confirm-dialog-actions">
            <button
              type="button"
              class="nav-button"
              data-ui-action="confirm-dialog-dismiss"
              ${controlsDisabled}
            >
              Keep Editing
            </button>
            <button
              type="button"
              class="nav-button"
              data-ui-action="confirm-dialog-confirm"
              ${controlsDisabled}
            >
              ${escapeHtml(state.confirmActionLabel ?? "Confirm")}
            </button>
          </div>
        </section>
      </div>
    `;
  }
}

export const registerPbConfirmDialog = (): void => {
  if (!customElements.get(pbConfirmDialogTag)) {
    customElements.define(pbConfirmDialogTag, PbConfirmDialogElement);
  }
};
