export const pbLoginTag = "pb-login";

export type LoginState = {
  errorMessage: string | null;
  isLoading: boolean;
};

type UiAction = "auth-submit" | "toggle-password";

class PbLoginElement extends HTMLElement {
  #state: LoginState = { errorMessage: null, isLoading: false };

  constructor() {
    super();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("submit", this.#onSubmit);
  }

  connectedCallback(): void {
    // Preserve state assigned before the custom element was upgraded.
    if (Object.prototype.hasOwnProperty.call(this, "state")) {
      const preUpgradeState = (this as unknown as { state?: LoginState }).state;
      delete (this as unknown as { state?: LoginState }).state;
      if (preUpgradeState) {
        this.#state = preUpgradeState;
      }
    }

    this.#render();
  }

  set state(value: LoginState) {
    this.#state = value;
    this.#render();
  }

  get state(): LoginState {
    return this.#state;
  }

  #query(selector: string): Element | null {
    return this.querySelector(selector) ?? this.shadowRoot?.querySelector(selector) ?? null;
  }

  #emit(action: UiAction, payload?: unknown): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action, payload },
      }),
    );
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.dataset.uiAction as UiAction | undefined;
    if (!action) return;

    if (action === "toggle-password") {
      const input = this.#query("#access-key") as HTMLInputElement | null;
      if (!input) return;

      const isShown = input.type === "text";
      input.type = isShown ? "password" : "text";
      target.textContent = isShown ? "Show" : "Hide";
      return;
    }
  };

  #onSubmit = (event: Event): void => {
    event.preventDefault();

    const input = this.#query("#access-key") as HTMLInputElement | null;
    if (!input) return;

    this.#emit("auth-submit", input.value);
  };

  #render(): void {
    const { errorMessage, isLoading } = this.#state;

    this.innerHTML = `
      <section class="screen-panel login-shell" aria-label="Sign in">
        <header class="app-header">
          <p class="app-kicker">Welcome back</p>
        </header>

        <p class="start-copy">Please enter your Access Key to continue.</p>

        <form id="access-key-form">
          <label class="start-label" for="access-key">Access Key</label>

          <div style="display:flex;gap:0.5rem;align-items:center;">
            <input
              id="access-key"
              type="password"
              class="weight-input"
              ${isLoading ? "disabled" : ""}
              required
            />

            <button
              type="button"
              data-ui-action="toggle-password"
              style="border:0;background:transparent;color:var(--text-primary);"
            >
              Show
            </button>
          </div>

          <div style="min-height:1.1em;color:#b00">
            ${errorMessage ?? ""}
          </div>

          <button
            type="submit"
            class="nav-button nav-button-primary action-button action-button-primary"
            ${isLoading ? "disabled" : ""}
          >
            ${isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    `;
  }
}

export const registerPbLogin = (): void => {
  if (!customElements.get(pbLoginTag)) {
    customElements.define(pbLoginTag, PbLoginElement);
  }
};
