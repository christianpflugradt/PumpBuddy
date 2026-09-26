export const pbConfirmDialogTag = "pb-confirm-dialog";

export type ConfirmDialogState = {
  accessibleName: string;
  message: string;
  dismissAction: string;
  dismissLabel: string;
  confirmAction: string;
  confirmLabel: string;
  /** Disabled confirmations also ignore Escape, so an in-flight safety action cannot be bypassed. */
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
  #invoker: HTMLElement | null = null;

  set state(value: ConfirmDialogState | null) {
    if (value && !this.#state) {
      this.#invoker = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }
    const wasOpen = Boolean(this.#state);
    this.#state = value;
    this.#render();
    if (!value && wasOpen) {
      this.#restoreFocus();
    }
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
    const title = state.title ?? state.accessibleName;
    const confirmClass = state.intent === "destructive"
      ? "configurator-action-danger"
      : "configurator-action-primary";
    const backdrop = state.backdrop === false
      ? ""
      : '<div class="confirm-dialog-backdrop" role="presentation"></div>';

    this.innerHTML = `
      <div class="confirm-dialog-layer" role="presentation">
        ${backdrop}
        <section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-label="${escapeHtml(state.accessibleName)}">
          <h2 id="confirm-dialog-title" class="confirm-dialog-title">${escapeHtml(title)}</h2>
          <p class="confirm-dialog-message">${escapeHtml(state.message)}</p>
          <div class="confirm-dialog-actions">
            <button type="button" class="configurator-action-dismiss" data-ui-action="${escapeHtml(state.dismissAction)}" ${disabled}>${escapeHtml(state.dismissLabel)}</button>
            <button type="button" class="${confirmClass}" data-ui-action="${escapeHtml(state.confirmAction)}" ${disabled}>${escapeHtml(state.confirmLabel)}</button>
          </div>
        </section>
      </div>
    `;

    this.#focusInitialControl();
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#restoreFocus();
  }

  #focusInitialControl(): void {
    this.#focusableControls()[0]?.focus();
  }

  #focusableControls(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.closest("[hidden], [aria-hidden=\"true\"], [inert]"));
  }

  #restoreFocus(): void {
    const invoker = this.#invoker;
    this.#invoker = null;
    if (!invoker || !invoker.isConnected || invoker.matches(":disabled") || invoker.hidden || invoker.closest("[hidden], [aria-hidden=\"true\"], [inert]")) {
      return;
    }
    invoker.focus();
  }

  connectedCallback(): void {
    this.#render();
    this.addEventListener("keydown", this.#onKeyDown);
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const state = this.#state;
    if (!state || state.controlsDisabled) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      const dismissButton = this.querySelector<HTMLButtonElement>(".configurator-action-dismiss");
      dismissButton?.click();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const controls = this.#focusableControls();
    if (controls.length === 0) {
      return;
    }

    const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
    if (activeIndex === -1 || (!event.shiftKey && activeIndex === controls.length - 1)) {
      event.preventDefault();
      controls[0]?.focus();
    } else if (event.shiftKey && activeIndex === 0) {
      event.preventDefault();
      controls.at(-1)?.focus();
    }
  };
}

export const registerPbConfirmDialog = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfirmDialogTag)) {
    customElements.define(pbConfirmDialogTag, PbConfirmDialogElement);
  }
};

registerPbConfirmDialog();
