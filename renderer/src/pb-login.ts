export const pbLoginTag = "pb-login";

export type LoginState = {
  errorMessage: string | null;
  isLoading: boolean;
};

type UiAction = "auth-submit" | "toggle-password";
type AuthSubmitPayload = {
  login: string;
  password: string;
};

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
    if (!(target instanceof Element)) return;

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) return;

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) return;

    if (action === "toggle-password") {
      const input = this.#query("#password") as HTMLInputElement | null;
      if (!input) return;

      const isShown = input.type === "text";
      input.type = isShown ? "password" : "text";
      actionElement.textContent = isShown ? "Show" : "Hide";
      return;
    }
  };

  #onSubmit = (event: Event): void => {
    event.preventDefault();

    const loginInput = this.#query("#login") as HTMLInputElement | null;
    const passwordInput = this.#query("#password") as HTMLInputElement | null;
    if (!loginInput || !passwordInput) return;

    const payload: AuthSubmitPayload = {
      login: loginInput.value,
      password: passwordInput.value,
    };
    this.#emit("auth-submit", payload);
  };

  #render(): void {
    const { errorMessage, isLoading } = this.#state;

    this.innerHTML = `
      <section class="screen-panel login-shell" aria-label="Sign in">
        <header class="app-header">
          <p class="app-kicker">Welcome back</p>
        </header>

        <p class="start-copy">Please enter your login details to continue.</p>

        <form id="login-form">
          <label class="start-label" for="login">Login</label>
          <input
            id="login"
            type="text"
            class="weight-input"
            autocomplete="username"
            ${!isLoading ? "autofocus" : ""}
            ${isLoading ? "disabled" : ""}
          />

          <label class="start-label" for="password">Password</label>

          <div style="display:flex;gap:0.5rem;align-items:center;">
            <input
              id="password"
              type="password"
              class="weight-input"
              autocomplete="current-password"
              ${isLoading ? "disabled" : ""}
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

    this.#focusAccessKeyInput();
  }

  #focusAccessKeyInput(): void {
    if (this.#state.isLoading) return;

    const input = this.#query("#login");
    if (!(input instanceof HTMLInputElement)) return;

    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      return;
    }

    try {
      input.focus();
    } catch {
      // Best effort: some test/runtime environments can reject focus calls.
    }
  }
}

export const registerPbLogin = (): void => {
  if (!customElements.get(pbLoginTag)) {
    customElements.define(pbLoginTag, PbLoginElement);
  }
};
