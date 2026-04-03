import { beforeEach, describe, expect, it, vi } from "vitest";
import createAuthGate from "./auth-gate";

describe("auth-gate", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it("calls initApp when session is valid", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const gate = createAuthGate(app, initApp, vi.fn().mockResolvedValue({ ok: true, status: 200 }) as any);

    await gate.init();

    expect(initApp).toHaveBeenCalledWith(app);
  });

  it("renders login when unauthorized session is detected", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const gate = createAuthGate(
      app,
      initApp,
      vi.fn().mockResolvedValue({ ok: false, status: 401 }) as any,
    );

    await gate.init();

    const login = app.querySelector("pb-login");
    expect(login).toBeTruthy();
    expect(app.textContent ?? "").toContain("Access Key");
  });

  it("renders verification error when session check fails with non-401", async () => {
    const app = document.createElement("div");

    const gate = createAuthGate(
      app,
      vi.fn(),
      vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any,
    );

    await gate.init();

    expect(app.textContent ?? "").toContain("Unable to verify session. Please sign in.");
  });

  it("renders network error when session fetch throws", async () => {
    const app = document.createElement("div");

    const gate = createAuthGate(
      app,
      vi.fn(),
      vi.fn().mockRejectedValue(new Error("offline")) as any,
    );

    await gate.init();

    expect(app.textContent ?? "").toContain("Network error. Please sign in when online.");
  });

  it("submits login with same-origin credentials", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const gate = createAuthGate(app, initApp, fetchMock as any);
    await gate.init();

    const loginEl = app.querySelector("pb-login") as HTMLElement;
    loginEl.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action: "auth-submit", payload: "key" },
      }),
    );

    await flush();

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_key: "key" }),
      credentials: "same-origin",
    });
    expect(initApp).toHaveBeenCalledWith(app);
  });

  it("shows invalid key message on 401 login response", async () => {
    const app = document.createElement("div");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 });

    const gate = createAuthGate(app, vi.fn(), fetchMock as any);
    await gate.init();

    const loginEl = app.querySelector("pb-login") as HTMLElement;
    loginEl.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action: "auth-submit", payload: "wrong" },
      }),
    );

    await flush();

    expect(app.textContent ?? "").toContain("Invalid access key.");
  });

  it("shows generic login error on non-401 login response", async () => {
    const app = document.createElement("div");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const gate = createAuthGate(app, vi.fn(), fetchMock as any);
    await gate.init();

    const loginEl = app.querySelector("pb-login") as HTMLElement;
    loginEl.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action: "auth-submit", payload: "key" },
      }),
    );

    await flush();

    expect(app.textContent ?? "").toContain("Unable to sign in. Try again.");
  });

  it("shows generic login error when login request throws", async () => {
    const app = document.createElement("div");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockRejectedValueOnce(new Error("offline"));

    const gate = createAuthGate(app, vi.fn(), fetchMock as any);
    await gate.init();

    const loginEl = app.querySelector("pb-login") as HTMLElement;
    loginEl.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action: "auth-submit", payload: "key" },
      }),
    );

    await flush();

    expect(app.textContent ?? "").toContain("Unable to sign in. Try again.");
  });

  it("ignores non-auth-submit UI actions", async () => {
    const app = document.createElement("div");

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const gate = createAuthGate(app, vi.fn(), fetchMock as any);

    await gate.init();

    const loginEl = app.querySelector("pb-login") as HTMLElement;
    loginEl.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action: "toggle-password" },
      }),
    );

    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks session with same-origin credentials", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    const gate = createAuthGate(app, initApp, fetchMock as any);
    await gate.init();

    expect(fetchMock).toHaveBeenCalledWith("/auth/session", {
      method: "GET",
      credentials: "same-origin",
    });
  });
});
