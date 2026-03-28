export const renderLoginMarkup = (errorMessage = ""): string => {
  return `
    <section class="screen-panel login-shell" aria-label="Sign in">
      <header class="app-header">
        <p class="app-kicker">Welcome back</p>
      </header>
      <p class="start-copy">Please enter your Access Key to continue.</p>

      <form id="access-key-form">
        <label class="start-label" for="access-key">Access Key</label>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <input id="access-key" name="access_key" type="password" autocomplete="current-password" class="weight-input" required />
          <button type="button" id="toggle-show" aria-pressed="false" style="border:0;background:transparent;color:var(--text-muted);">Show</button>
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

export const attachLoginHandlers = (app: HTMLElement, submitCallback: (value: string) => void): void => {
  try {
    const form = (app as unknown as Element).querySelector?.("#access-key-form") as HTMLFormElement | null;
    const input = (app as unknown as Element).querySelector?.("#access-key") as HTMLInputElement | null;
    const toggle = (app as unknown as Element).querySelector?.("#toggle-show") as HTMLButtonElement | null;

    if (input) {
      // prefer autofocus in real browsers
      try { input.focus?.(); } catch {}
    }

    if (toggle && input) {
      toggle.addEventListener("click", () => {
        const isShown = input.type === "text";
        input.type = isShown ? "password" : "text";
        toggle.textContent = isShown ? "Show" : "Hide";
        toggle.setAttribute("aria-pressed", String(!isShown));
      });
    }

    if (form) {
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (!input) return;
        submitCallback(input.value);
      });
    }
  } catch (err) {
    // testing environment may not support full DOM — handlers best-effort
  }
};

export default { renderLoginMarkup, attachLoginHandlers };
