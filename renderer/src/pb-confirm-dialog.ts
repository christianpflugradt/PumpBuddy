export const pbConfirmDialogTag = "pb-confirm-dialog";

export type ConfirmDialogState = {
  accessibleName: string;
  message: string;
  dismissAction: string;
  dismissLabel: string;
  confirmAction: string;
  confirmLabel: string;
  controlsDisabled?: boolean;
  backdrop?: boolean;
  intent?: "affirmative" | "destructive";
  title?: string | null;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

class PbConfirmDialogElement extends HTMLElement {
  #state: ConfirmDialogState | null = null;

  connectedCallback(): void {
    this.#render();
  }

  set state(value: ConfirmDialogState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): ConfirmDialogState | null {
    return this.#state;
  }

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    const disabled = state.controlsDisabled ? "disabled" : "";
    const title = state.title
      ? `<h2 class="confirm-dialog-title">${escapeHtml(state.title)}</h2>`
      : "";
    const confirmClass = state.intent === "destructive"
      ? "configurator-action-danger"
      : "configurator-action-primary";
    const backdrop = state.backdrop === false
      ? ""
      : '<div class="confirm-dialog-backdrop" role="presentation"></div>';

    this.innerHTML = `
      <div class="confirm-dialog-layer" role="presentation">
        ${backdrop}
        <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="${escapeHtml(state.accessibleName)}">
          ${title}
          <p class="confirm-dialog-message">${escapeHtml(state.message)}</p>
          <div class="confirm-dialog-actions">
            <button type="button" class="configurator-action-dismiss" data-ui-action="${escapeHtml(state.dismissAction)}" ${disabled}>${escapeHtml(state.dismissLabel)}</button>
            <button type="button" class="${confirmClass}" data-ui-action="${escapeHtml(state.confirmAction)}" ${disabled}>${escapeHtml(state.confirmLabel)}</button>
          </div>
        </section>
      </div>
    `;
  }
}

export const registerPbConfirmDialog = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfirmDialogTag)) {
    customElements.define(pbConfirmDialogTag, PbConfirmDialogElement);
  }
};

registerPbConfirmDialog();
