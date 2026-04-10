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
      const toggleButton = actionElement instanceof HTMLButtonElement ? actionElement : null;
      if (!input) return;

      const isPasswordVisible = input.type === "password";
      input.type = isPasswordVisible ? "text" : "password";
      if (toggleButton) {
        this.#setPasswordToggleState(toggleButton, isPasswordVisible);
      }
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
          <img
            class="start-banner"
            src="/images/banner.png?v=20260401-2"
            alt="PumpBuddy banner"
          />
        </header>

        <p class="start-copy">Please enter your login details to continue.</p>

        <form id="login-form" class="login-form">
          <div class="start-field login-field">
            <label class="start-label" for="login">Login</label>
            <div class="login-input-shell">
              <input
                id="login"
                type="text"
                class="weight-input"
                autocomplete="username"
                ${!isLoading ? "autofocus" : ""}
                ${isLoading ? "disabled" : ""}
              />
            </div>
          </div>

          <div class="start-field login-field">
            <label class="start-label" for="password">Password</label>
            <div class="login-input-shell">
              <input
                id="password"
                type="password"
                class="weight-input login-password-input"
                autocomplete="current-password"
                ${isLoading ? "disabled" : ""}
              />

              <button
                type="button"
                class="password-toggle"
                data-ui-action="toggle-password"
                data-icon-state="hidden"
                aria-label="${this.#passwordToggleLabel(false)}"
                title="${this.#passwordToggleLabel(false)}"
                ${isLoading ? "disabled" : ""}
              >
                ${this.#passwordToggleIconSvg(false)}
              </button>
            </div>
          </div>

          <div id="login-error">
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

  #passwordToggleLabel(isPasswordVisible: boolean): string {
    return isPasswordVisible ? "Hide password" : "Show password";
  }

  #passwordToggleIconSvg(isPasswordVisible: boolean): string {
    if (isPasswordVisible) {
      return `
        <svg
          class="password-toggle-icon"
          data-icon="eye"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2.5 12c1.9-3.2 5.2-5.8 9.5-5.8S19.6 8.8 21.5 12c-1.9 3.2-5.2 5.8-9.5 5.8S4.4 15.2 2.5 12Z" />
          <circle cx="12" cy="12" r="3.1" />
        </svg>
      `;
    }

    return `
      <svg
        class="password-toggle-icon"
        data-icon="eye-off"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M2.5 12c1.9-3.2 5.2-5.8 9.5-5.8S19.6 8.8 21.5 12c-1.9 3.2-5.2 5.8-9.5 5.8S4.4 15.2 2.5 12Z" />
        <circle cx="12" cy="12" r="3.1" />
        <path d="M4 4l16 16" />
      </svg>
    `;
  }

  #setPasswordToggleState(button: HTMLButtonElement, isPasswordVisible: boolean): void {
    button.dataset.iconState = isPasswordVisible ? "visible" : "hidden";
    const label = this.#passwordToggleLabel(isPasswordVisible);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.innerHTML = this.#passwordToggleIconSvg(isPasswordVisible);
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
