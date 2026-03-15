import test from "node:test";
import assert from "node:assert/strict";

import createAuthGate from "./auth-gate";

class FakeAppElement {
  innerHTML = "";
  querySelector(selector: string) {
    if (selector === "#login-error") return { textContent: "" } as any;
    if (selector === "button[type=submit]") return { disabled: false, textContent: "" } as any;
    return null;
  }
}

test("auth gate initializes app when session is valid", async () => {
  let initCalled = false;
  const fetchImpl = async (input: string) => {
    if (input === "/auth/session") return { ok: true, status: 200 } as Response;
    throw new Error("unexpected");
  };

  const app = new FakeAppElement();
  const gate = createAuthGate(app as unknown as HTMLElement, () => {
    initCalled = true;
  }, fetchImpl as unknown as typeof fetch);

  await gate.init();
  assert.equal(initCalled, true);
});

test("auth gate shows login when session is unauthorized", async () => {
  let initCalled = false;
  const fetchImpl = async (input: string) => {
    if (input === "/auth/session") return { ok: false, status: 401 } as Response;
    throw new Error("unexpected");
  };

  const app = new FakeAppElement();
  const gate = createAuthGate(app as unknown as HTMLElement, () => {
    initCalled = true;
  }, fetchImpl as unknown as typeof fetch);

  await gate.init();
  assert.equal(initCalled, false);
  assert.match(app.innerHTML, /Access Key/);
  assert.match(app.innerHTML, /Sign in/);
});

test("auth gate falls back to login on network error", async () => {
  const fetchImpl = async (_: string) => {
    throw new Error("network");
  };

  const app = new FakeAppElement();
  const gate = createAuthGate(app as unknown as HTMLElement, () => {}, fetchImpl as unknown as typeof fetch);

  await gate.init();
  assert.match(app.innerHTML, /Network error/);
});

test("submitAccessKey transitions to app on successful login", async () => {
  let initCalled = false;
  const fetchImpl = async (input: string, init?: RequestInit) => {
    if (input === "/auth/session") return { ok: false, status: 401 } as Response;
    if (input === "/auth/login" && init?.method === "POST") return { ok: true, status: 200 } as Response;
    throw new Error("unexpected");
  };

  const app = new FakeAppElement();
  const gate = createAuthGate(app as unknown as HTMLElement, () => {
    initCalled = true;
  }, fetchImpl as unknown as typeof fetch);

  await gate.init();
  // login view present
  assert.match(app.innerHTML, /Sign in/);

  await gate.submitAccessKey("the-key");
  assert.equal(initCalled, true);
  assert.equal(app.innerHTML, "");
});

test("submitAccessKey shows invalid message on 401", async () => {
  const fetchImpl = async (input: string, init?: RequestInit) => {
    if (input === "/auth/session") return { ok: false, status: 401 } as Response;
    if (input === "/auth/login" && init?.method === "POST") return { ok: false, status: 401 } as Response;
    throw new Error("unexpected");
  };

  const app = new FakeAppElement();
  const gate = createAuthGate(app as unknown as HTMLElement, () => {}, fetchImpl as unknown as typeof fetch);

  await gate.init();
  await gate.submitAccessKey("wrong");
  assert.match(app.innerHTML, /Invalid access key/);
});
