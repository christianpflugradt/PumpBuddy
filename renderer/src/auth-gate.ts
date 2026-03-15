export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const createAuthGate = (
  app: HTMLElement,
  initApp: (el: HTMLElement) => void,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
) => {
  const showLogin = (errorMessage = ""): void => {
    app.innerHTML = `
      <section class="screen-panel login-shell" aria-label="Sign in">
        <header class="app-header">
          <p class="app-kicker">Welcome back</p>
          <h1 class="app-title">PumpBuddy</h1>
        </header>
        <p class="start-copy">Please enter your Access Key to continue.</p>

        <form id="access-key-form">
          <label class="start-label" for="access-key">Access Key</label>
          <input id="access-key" name="access_key" type="password" autocomplete="current-password" class="weight-input" required />
          <div style="height:1em;color:#b00" id="login-error">${errorMessage}</div>
          <button type="submit" class="start-button" data-action="auth-submit">Sign in</button>
        </form>
      </section>
    `;
  };

  const submitAccessKey = async (accessKey: string): Promise<void> => {
    try {
      const resp = await fetchImpl("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_key: accessKey }),
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          showLogin("Invalid access key.");
          return;
        }
        showLogin("Unable to sign in. Try again.");
        return;
      }

      // Success — clear login view and initialize protected app
      app.innerHTML = "";
      initApp(app);
    } catch (err) {
      showLogin("Unable to sign in. Try again.");
    }
  };

  const attachDomHandlers = (): void => {
    try {
      // If running in a browser-like environment, wire the form to submitAccessKey
      const form = (app as unknown as Element).querySelector?.("#access-key-form") as HTMLFormElement | null;
      if (form && form.addEventListener) {
        form.addEventListener("submit", (ev) => {
          ev.preventDefault();
          const input = (app as unknown as Element).querySelector?.("#access-key") as HTMLInputElement | null;
          void submitAccessKey(input?.value ?? "");
        });
      }
    } catch (e) {
      // ignore — testing environments may not provide DOM nodes
    }
  };

  const init = async (): Promise<void> => {
    try {
      const resp = await fetchImpl("/auth/session", { method: "GET" });
      if (resp.ok) {
        initApp(app);
        return;
      }

      if ((resp as Response).status === 401) {
        showLogin();
        attachDomHandlers();
        return;
      }

      showLogin("Unable to verify session. Please sign in.");
      attachDomHandlers();
    } catch (err) {
      showLogin("Network error. Please sign in when online.");
      attachDomHandlers();
    }
  };

  return { init, submitAccessKey };
};

export default createAuthGate;
