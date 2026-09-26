const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class ModalFocus {
  #root: HTMLElement;
  #returnFocusSelector: string | null = null;

  constructor(root: HTMLElement) {
    this.#root = root;
  }

  open(invoker: HTMLElement | null, initialFocusSelector: string): void {
    this.#returnFocusSelector = this.#selectorFor(invoker);
    this.focusInitial(initialFocusSelector);
  }

  close(fallbackSelector?: string): void {
    const returnFocusSelector = this.#returnFocusSelector;
    this.#returnFocusSelector = null;
    if (!this.#focus(returnFocusSelector)) this.#focus(fallbackSelector);
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

  #selectorFor(invoker: HTMLElement | null): string | null {
    if (!invoker) return null;
    if (invoker.id) return `#${CSS.escape(invoker.id)}`;

    const dataAttributes = Object.entries(invoker.dataset)
      .flatMap(([name, value]) => {
        if (!value) return [];
        const attribute = `data-${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
        return `[${attribute}="${CSS.escape(value)}"]`;
      });
    return dataAttributes.length > 0 ? dataAttributes.join("") : null;
  }

  #focus(selector: string | null | undefined): boolean {
    if (!selector) return false;
    const control = this.#root.querySelector<HTMLElement>(selector);
    if (!control?.isConnected || control.matches(":disabled") || control.hidden || control.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
    control.focus();
    return true;
  }
}
