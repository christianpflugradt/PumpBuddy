import { describe, it, expect, vi } from "vitest";
import createAuthGate from "./auth-gate";

describe("auth-gate", () => {
  const createFetch = (response: Partial<Response>): any =>
    vi.fn().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => ({}),
    });

  it("calls initApp when session is valid", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const gate = createAuthGate(app, initApp, createFetch({ ok: true }));

    await gate.init();

    expect(initApp).toHaveBeenCalled();
  });

  it("renders login when unauthorized", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const gate = createAuthGate(app, initApp, createFetch({ ok: false, status: 401 }));

    await gate.init();

    expect(app.innerHTML).not.toBe("");
  });

  it("submits access key", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const fetchMock = vi.fn()
      // first call session check
      .mockResolvedValueOnce({ ok: false, status: 401 })
      // second call login
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const gate = createAuthGate(app, initApp, fetchMock as any);

    await gate.init();

    // simulate login event
    const loginEl = app.firstElementChild as HTMLElement;
    loginEl.dispatchEvent(new CustomEvent("pb-ui-action", {
      bubbles: true,
      composed: true,
      detail: { action: "auth-submit", payload: "key" },
    }));

    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalled();
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

  it("submits login with same-origin credentials", async () => {
    const app = document.createElement("div");
    const initApp = vi.fn();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const gate = createAuthGate(app, initApp, fetchMock as any);
    await gate.init();

    const loginEl = app.firstElementChild as HTMLElement;
    loginEl.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action: "auth-submit", payload: "key" },
      }),
    );

    await Promise.resolve();

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_key: "key" }),
      credentials: "same-origin",
    });
  });
});
