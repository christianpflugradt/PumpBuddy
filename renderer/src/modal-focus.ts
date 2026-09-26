const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class ModalFocus {
  #root: HTMLElement;
  #returnFocusSelector: string | null = null;

  constructor(root: HTMLElement) {
    this.#root = root;
  }

  open(invoker: HTMLElement | null, initialFocusSelector: string): void {
    this.#returnFocusSelector = invoker?.id
      ? `#${CSS.escape(invoker.id)}`
      : invoker?.dataset.uiAction
        ? `[data-ui-action="${CSS.escape(invoker.dataset.uiAction)}"]`
        : null;
    this.focusInitial(initialFocusSelector);
  }

  close(fallbackSelector?: string): void {
    const selector = this.#returnFocusSelector ?? fallbackSelector;
    this.#returnFocusSelector = null;
    this.#focus(selector);
  }

  focusInitial(selector: string): void {
    this.#focus(selector);
  }

  handleKeyDown(event: KeyboardEvent, dialog: HTMLElement | null, dismiss: () => void): boolean {
    if (!dialog) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return true;
    }
    if (event.key !== "Tab") return false;

    const controls = this.#focusableControls(dialog);
    if (controls.length === 0) return true;
    const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
    if (activeIndex === -1 || (!event.shiftKey && activeIndex === controls.length - 1)) {
      event.preventDefault();
      controls[0]?.focus();
    } else if (event.shiftKey && activeIndex === 0) {
      event.preventDefault();
      controls.at(-1)?.focus();
    }
    return true;
  }

  #focusableControls(dialog: HTMLElement): HTMLElement[] {
    return [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => !element.closest('[hidden], [aria-hidden="true"], [inert]'));
  }

  #focus(selector: string | null | undefined): void {
    if (!selector) return;
    const control = this.#root.querySelector<HTMLElement>(selector);
    if (control?.isConnected && !control.matches(":disabled") && !control.hidden && !control.closest('[hidden], [aria-hidden="true"], [inert]')) control.focus();
  }
}
