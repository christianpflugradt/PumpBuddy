export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

import { renderLoginMarkup, attachLoginHandlers } from "./login-component";

export const createAuthGate = (
  app: HTMLElement,
  initApp: (el: HTMLElement) => void,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
) => {
  const showLogin = (errorMessage = ""): void => {
    app.innerHTML = renderLoginMarkup(errorMessage);
    attachLoginHandlers(app, (value) => void submitAccessKey(value));
  };

  const submitAccessKey = async (accessKey: string): Promise<void> => {
    try {
      // show a compact loading indicator while login request runs
      const loginErrorEl = (app as unknown as Element).querySelector('#login-error') as HTMLDivElement | null;
      if (loginErrorEl) loginErrorEl.textContent = '';
      const submitBtn = (app as unknown as Element).querySelector("button[type=submit]") as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
      }
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

  // attachLoginHandlers is used inside showLogin to wire DOM handlers

  const init = async (): Promise<void> => {
    try {
      // show a lightweight loading skeleton while we check session
      app.innerHTML = `
        <section class="auth-loading">
          <div class="shimmer" style="width:40%"></div>
          <div class="shimmer" style="width:70%"></div>
          <div class="shimmer" style="width:30%"></div>
        </section>
      `;

      const resp = await fetchImpl("/auth/session", { method: "GET" });
      if (resp.ok) {
        initApp(app);
        return;
      }

      if ((resp as Response).status === 401) {
        showLogin();
        return;
      }

      showLogin("Unable to verify session. Please sign in.");
    } catch (err) {
      showLogin("Network error. Please sign in when online.");
    }
  };

  return { init, submitAccessKey };
};

export default createAuthGate;
