import { beforeEach, describe, expect, it, vi } from "vitest";
import { pbLoginTag, registerPbLogin } from "./pb-login";
import type { LoginState } from "./pb-login";

describe("pb-login", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    registerPbLogin();
  });

  const createState = (): LoginState => ({
    errorMessage: null,
    isLoading: false,
  });

  const query = (el: HTMLElement, selector: string): Element | null =>
    el.querySelector(selector) ?? el.shadowRoot?.querySelector(selector) ?? null;

  const queryInput = (el: HTMLElement): HTMLInputElement | null =>
    (query(el, "#access-key") ??
      query(el, 'input[type="password"]') ??
      query(el, 'input[type="text"]')) as HTMLInputElement | null;

  const queryForm = (el: HTMLElement): HTMLFormElement | null =>
    (query(el, "#access-key-form") ?? query(el, "form")) as HTMLFormElement | null;

  it("renders login form", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Access Key");
    expect(text).toContain("Sign in");
  });

  it("renders form controls for authentication", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const input = queryInput(el);
    expect(input).not.toBeNull();
    const form = queryForm(el);
    expect(form).not.toBeNull();
    const submitButton = query(el, 'button[type="submit"]');
    expect(submitButton).not.toBeNull();
  });

  it("shows error message", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = {
      errorMessage: "Invalid access key",
      isLoading: false,
    };

    const text = el.textContent ?? "";
    expect(text).toContain("Invalid access key");
  });

  it("disables input when loading", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = {
      errorMessage: null,
      isLoading: true,
    };

    const input = queryInput(el);
    expect(input).not.toBeNull();
    if (!input) return;
    expect(input.disabled).toBe(true);
  });

  it("focuses access key input when ready", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const input = queryInput(el);
    expect(input).not.toBeNull();
    if (!input) return;
    const activeElement = document.activeElement as HTMLElement | null;
    expect(activeElement?.id).toBe("access-key");
  });

  it("emits auth-submit action with entered key", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const emitSpy = vi.fn();
    el.addEventListener("pb-ui-action", emitSpy);

    const input = queryInput(el);
    const form = queryForm(el);

    expect(input).not.toBeNull();
    expect(form).not.toBeNull();
    if (!input || !form) return;

    input.value = "abc-123";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(emitSpy).toHaveBeenCalledTimes(1);
    const event = emitSpy.mock.calls[0]?.[0] as CustomEvent<{ action: string; payload?: unknown }>;
    expect(event.detail).toEqual({ action: "auth-submit", payload: "abc-123" });
  });

  it("toggles password visibility from the UI action button", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const input = queryInput(el);
    const toggle = query(el, '[data-ui-action="toggle-password"]') as HTMLButtonElement | null;

    expect(input).not.toBeNull();
    expect(toggle).not.toBeNull();
    if (!input || !toggle) return;

    expect(input.type).toBe("password");

    toggle.click();
    expect(input.type).toBe("text");
    expect(toggle.textContent).toContain("Hide");

    toggle.click();
    expect(input.type).toBe("password");
    expect(toggle.textContent).toContain("Show");
  });
});
