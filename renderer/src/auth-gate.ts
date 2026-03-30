import { pbLoginTag, registerPbLogin } from "./pb-login";

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    credentials?: RequestCredentials;
  },
) => Promise<{ ok: boolean; status: number }>;

export const createAuthGate = (
  app: HTMLElement,
  initApp: (el: HTMLElement) => void,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
) => {
  registerPbLogin();

  const renderLogin = (errorMessage: string | null = null, isLoading = false): void => {
    const login = document.createElement(pbLoginTag) as HTMLElement & {
      state: { errorMessage: string | null; isLoading: boolean };
    };
    login.state = { errorMessage, isLoading };

    login.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{ action: string; payload?: unknown }>;
      if (customEvent.detail?.action !== "auth-submit") {
        return;
      }

      const accessKey = typeof customEvent.detail.payload === "string" ? customEvent.detail.payload : "";
      void submitAccessKey(accessKey);
    });

    app.replaceChildren(login);
  };

  const submitAccessKey = async (accessKey: string): Promise<void> => {
    try {
      renderLogin(null, true);
      const resp = await fetchImpl("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_key: accessKey }),
        credentials: "same-origin",
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          renderLogin("Invalid access key.", false);
          return;
        }

        renderLogin("Unable to sign in. Try again.", false);
        return;
      }

      app.innerHTML = "";
      initApp(app);
    } catch {
      renderLogin("Unable to sign in. Try again.", false);
    }
  };

  const init = async (): Promise<void> => {
    try {
      app.innerHTML = `
        <section class="auth-loading">
          <div class="shimmer" style="width:40%"></div>
          <div class="shimmer" style="width:70%"></div>
          <div class="shimmer" style="width:30%"></div>
        </section>
      `;

      const resp = await fetchImpl("/auth/session", {
        method: "GET",
        credentials: "same-origin",
      });
      if (resp.ok) {
        initApp(app);
        return;
      }

      if (resp.status === 401) {
        renderLogin();
        return;
      }

      renderLogin("Unable to verify session. Please sign in.");
    } catch {
      renderLogin("Network error. Please sign in when online.");
    }
  };

  return { init, submitAccessKey };
};

export default createAuthGate;
