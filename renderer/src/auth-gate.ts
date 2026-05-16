import { pbLoginTag, registerPbLogin } from "./pb-login";
import type { SessionUser } from "./workout-types";
import {
  parseSessionUserResponse,
  serializeAuthLoginRequest,
} from "./openapi-contract";

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

      return parseSessionUserResponse(await sessionResponse.json());
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

      const payload = customEvent.detail.payload as { login?: unknown; password?: unknown } | undefined;
      const login = typeof payload?.login === "string" ? payload.login : "";
      const password = typeof payload?.password === "string" ? payload.password : "";
      void submitCredentials(login, password);
    });

    app.replaceChildren(login);
  };

  const submitCredentials = async (login: string, password: string): Promise<void> => {
    const normalizedLogin = login.trim();
    if (normalizedLogin.length === 0) {
      renderLogin("Login is required.", false);
      return;
    }

    try {
      renderLogin(null, true);
      const resp = await fetchImpl("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serializeAuthLoginRequest(normalizedLogin, password)),
        credentials: "same-origin",
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          renderLogin("Invalid login or password.", false);
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

  const logout = async (): Promise<void> => {
    try {
      await fetchImpl("/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // best-effort logout
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
            sessionUser = parseSessionUserResponse(await resp.json());
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

  return { init, submitCredentials, logout };
};

export default createAuthGate;
