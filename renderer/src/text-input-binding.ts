export type TextInputChange = {
  field: string;
  value: string;
};

type EditableTextInput = HTMLInputElement | HTMLTextAreaElement;

/**
 * Routes text changes through a form renderer without dropping the user's
 * focus or selection when that renderer replaces DOM nodes.
 */
export class TextInputBinding {
  readonly #host: HTMLElement;
  readonly #onChange: (change: TextInputChange) => void;

  constructor(host: HTMLElement, onChange: (change: TextInputChange) => void) {
    this.#host = host;
    this.#onChange = onChange;
  }

  connect(): void {
    this.#host.addEventListener("input", this.#handleInput);
  }

  disconnect(): void {
    this.#host.removeEventListener("input", this.#handleInput);
  }

  #handleInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
    const field = input.dataset.field;
    if (!field) return;

    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const selectionDirection = input.selectionDirection ?? "none";
    this.#onChange({ field, value: input.value });

    const replacement = this.#host.querySelector(`[data-field="${field}"]`);
    if (replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement) {
      this.#preserveInputNode(input, replacement);
    }

    const restoreFocus = (): void => {
      const replacement = this.#host.querySelector(`[data-field="${field}"]`);
      if (!(replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement)) return;
      replacement.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        replacement.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
      }
    };
    restoreFocus();
    queueMicrotask(() => {
      restoreFocus();
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(restoreFocus);
      } else {
        setTimeout(restoreFocus, 0);
      }
    });
  };

  #preserveInputNode(original: EditableTextInput, replacement: EditableTextInput): void {
    if (original === replacement || original.constructor !== replacement.constructor) return;
    for (const attribute of [...original.attributes]) {
      if (!replacement.hasAttribute(attribute.name)) original.removeAttribute(attribute.name);
    }
    for (const attribute of [...replacement.attributes]) {
      original.setAttribute(attribute.name, attribute.value);
    }
    original.value = replacement.value;
    replacement.replaceWith(original);
  }
}
