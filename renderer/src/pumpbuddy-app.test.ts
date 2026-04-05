import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  registerPbAppRootMock,
  createAppMock,
  gateInitMock,
  gateLogoutMock,
  createAuthGateMock,
} = vi.hoisted(() => ({
  registerPbAppRootMock: vi.fn(),
  createAppMock: vi.fn(),
  gateInitMock: vi.fn(async () => {}),
  gateLogoutMock: vi.fn(async () => {}),
  createAuthGateMock: vi.fn(),
}));

createAuthGateMock.mockImplementation(() => ({ init: gateInitMock, logout: gateLogoutMock }));

vi.mock("./pb-app-root", () => ({
  pbAppRootTag: "pb-app-root",
  registerPbAppRoot: registerPbAppRootMock,
}));

vi.mock("./workout-controller", () => ({
  createApp: createAppMock,
}));

vi.mock("./auth-gate", () => ({
  default: createAuthGateMock,
}));

import { pumpbuddyAppTag, registerAppShell } from "./pumpbuddy-app";

describe("pumpbuddy-app", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    createAuthGateMock.mockImplementation(() => ({ init: gateInitMock, logout: gateLogoutMock }));
  });

  it("registers custom element without throwing", () => {
    expect(() => registerAppShell()).not.toThrow();
  });

  it("defines custom element", () => {
    registerAppShell();
    expect(customElements.get(pumpbuddyAppTag)).toBeDefined();
  });

  it("bootstraps auth gate and mounts app root on successful init", async () => {
    const initImpl = vi.fn(async () => {});

    createAuthGateMock.mockImplementation(
      (app: HTMLElement, initApp: (el: HTMLElement, sessionUser: unknown) => void) => ({
        init: vi.fn(async () => {
          await initImpl();
          initApp(app, { id: "test-user", displayName: "Test User" });
        }),
      }),
    );

    registerAppShell();

    const el = document.createElement(pumpbuddyAppTag) as HTMLElement;
    const mountedSpy = vi.fn();
    el.addEventListener("pb-app-mounted", mountedSpy);

    document.body.append(el);
    await Promise.resolve();

    expect(registerPbAppRootMock).toHaveBeenCalledTimes(1);
    expect(createAuthGateMock).toHaveBeenCalledTimes(1);
    expect(initImpl).toHaveBeenCalledTimes(1);

    const root = el.querySelector("pb-app-root");
    expect(root).toBeTruthy();
    expect(createAppMock).toHaveBeenCalledWith(
      root,
      undefined,
      undefined,
      undefined,
      { id: "test-user", displayName: "Test User" },
    );

    expect(mountedSpy).toHaveBeenCalledTimes(1);
    const mountedEvent = mountedSpy.mock.calls[0]?.[0] as CustomEvent<{ root: HTMLElement }>;
    expect(mountedEvent.detail.root.tagName.toLowerCase()).toBe("pb-app-root");
  });

  it("re-initializes auth gate when unauthorized event is fired", async () => {
    registerAppShell();

    const el = document.createElement(pumpbuddyAppTag);
    document.body.append(el);
    await Promise.resolve();

    expect(gateInitMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pb-unauthorized"));
    await Promise.resolve();

    expect(gateInitMock).toHaveBeenCalledTimes(2);
  });

  it("removes unauthorized listener on disconnect", async () => {
    registerAppShell();

    const el = document.createElement(pumpbuddyAppTag);
    document.body.append(el);
    await Promise.resolve();

    expect(gateInitMock).toHaveBeenCalledTimes(1);

    el.remove();
    window.dispatchEvent(new Event("pb-unauthorized"));
    await Promise.resolve();

    expect(gateInitMock).toHaveBeenCalledTimes(1);
  });

  it("clears session cookie and re-initializes auth gate on logout event", async () => {
    registerAppShell();

    const el = document.createElement(pumpbuddyAppTag);
    document.body.append(el);
    await Promise.resolve();

    expect(gateInitMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pb-logout"));
    await Promise.resolve();

    expect(gateLogoutMock).toHaveBeenCalledTimes(1);
    expect(gateInitMock).toHaveBeenCalledTimes(2);
  });
});
