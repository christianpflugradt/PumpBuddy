import { pbLoginTag, registerPbLogin } from "./pb-login";
import type { SessionUser } from "./workout-types";

type SessionResponse = {
  authenticated?: boolean;
  user?: {
    id?: string;
    display_name?: string;
  };
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
};

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    credentials?: RequestCredentials;
  },
) => Promise<FetchResponseLike>;

export const createAuthGate = (
  app: HTMLElement,
  initApp: (el: HTMLElement, sessionUser: SessionUser | null) => void,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
) => {
  registerPbLogin();

  const resolveSessionUser = async (): Promise<SessionUser | null> => {
    try {
      const sessionResponse = await fetchImpl("/auth/session", {
        method: "GET",
        credentials: "same-origin",
      });
      if (!sessionResponse.ok || typeof sessionResponse.json !== "function") {
        return null;
      }

      const payload = (await sessionResponse.json()) as SessionResponse;
      const userId = payload?.user?.id;
      const displayName = payload?.user?.display_name;
      if (typeof userId !== "string" || typeof displayName !== "string") {
        return null;
      }

      return {
        id: userId,
        displayName,
      };
    } catch {
      return null;
    }
  };

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
      initApp(app, await resolveSessionUser());
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
        let sessionUser: SessionUser | null = null;
        if (typeof resp.json === "function") {
          try {
            const payload = (await resp.json()) as SessionResponse;
            const userId = payload?.user?.id;
            const displayName = payload?.user?.display_name;
            if (typeof userId === "string" && typeof displayName === "string") {
              sessionUser = {
                id: userId,
                displayName,
              };
            }
          } catch {
            sessionUser = null;
          }
        }
        initApp(app, sessionUser);
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
