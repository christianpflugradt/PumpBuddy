export const renderLoginMarkup = (errorMessage = ""): string => {
  return `
    <section class="screen-panel login-shell" aria-label="Sign in">
      <header class="app-header">
        <p class="app-kicker">Welcome back</p>
      </header>
      <p class="start-copy">Please enter your login details to continue.</p>

      <form id="login-form">
        <label class="start-label" for="login">Login</label>
        <input id="login" name="login" type="text" autocomplete="username" class="weight-input" />

        <label class="start-label" for="password">Password</label>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <input id="password" name="password" type="password" autocomplete="current-password" class="weight-input" />
          <button type="button" id="toggle-show" aria-pressed="false" style="border:0;background:transparent;color:var(--text-primary);">Show</button>
        </div>
        <div id="login-error" style="min-height:1.1em;color:#b00">${errorMessage}</div>
        <button
          type="submit"
          class="start-button nav-button nav-button-primary action-button action-button-primary"
          data-action="auth-submit"
        >
          Sign in
        </button>
      </form>
    </section>
  `;
};

export const attachLoginHandlers = (
  app: HTMLElement,
  submitCallback: (value: { login: string; password: string }) => void,
): void => {
  try {
    const form = (app as unknown as Element).querySelector?.("#login-form") as HTMLFormElement | null;
    const loginInput = (app as unknown as Element).querySelector?.("#login") as HTMLInputElement | null;
    const passwordInput = (app as unknown as Element).querySelector?.("#password") as HTMLInputElement | null;
    const toggle = (app as unknown as Element).querySelector?.("#toggle-show") as HTMLButtonElement | null;

    if (loginInput) {
      // prefer autofocus in real browsers
      try { loginInput.focus?.(); } catch {}
    }

    if (toggle && passwordInput) {
      toggle.addEventListener("click", () => {
        const isShown = passwordInput.type === "text";
        passwordInput.type = isShown ? "password" : "text";
        toggle.textContent = isShown ? "Show" : "Hide";
        toggle.setAttribute("aria-pressed", String(!isShown));
      });
    }

    if (form) {
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        submitCallback({
          login: loginInput?.value ?? "",
          password: passwordInput?.value ?? "",
        });
      });
    }
  } catch (err) {
    // testing environment may not support full DOM — handlers best-effort
  }
};

export default { renderLoginMarkup, attachLoginHandlers };
