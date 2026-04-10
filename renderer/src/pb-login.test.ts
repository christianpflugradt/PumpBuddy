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

  const queryLoginInput = (el: HTMLElement): HTMLInputElement | null =>
    (query(el, "#login") ?? query(el, 'input[type="text"]')) as HTMLInputElement | null;

  const queryPasswordInput = (el: HTMLElement): HTMLInputElement | null =>
    (query(el, "#password") ?? query(el, 'input[type="password"]')) as HTMLInputElement | null;

  const queryForm = (el: HTMLElement): HTMLFormElement | null =>
    (query(el, "#login-form") ?? query(el, "form")) as HTMLFormElement | null;

  it("renders login form", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Login");
    expect(text).toContain("Password");
    expect(text).toContain("Sign in");
  });

  it("renders form controls for authentication", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const loginInput = queryLoginInput(el);
    const passwordInput = queryPasswordInput(el);
    expect(loginInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    const form = queryForm(el);
    expect(form).not.toBeNull();
    const submitButton = query(el, 'button[type="submit"]');
    expect(submitButton).not.toBeNull();
  });

  it("shows error message", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = {
      errorMessage: "Invalid login or password",
      isLoading: false,
    };

    const text = el.textContent ?? "";
    expect(text).toContain("Invalid login or password");
  });

  it("disables inputs when loading", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = {
      errorMessage: null,
      isLoading: true,
    };

    const loginInput = queryLoginInput(el);
    const passwordInput = queryPasswordInput(el);
    expect(loginInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    if (!loginInput || !passwordInput) return;
    expect(loginInput.disabled).toBe(true);
    expect(passwordInput.disabled).toBe(true);
  });

  it("focuses login input when ready", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const input = queryLoginInput(el);
    expect(input).not.toBeNull();
    if (!input) return;
    const activeElement = document.activeElement as HTMLElement | null;
    expect(activeElement?.id).toBe("login");
  });

  it("emits auth-submit action with entered login and password", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const emitSpy = vi.fn();
    el.addEventListener("pb-ui-action", emitSpy);

    const loginInput = queryLoginInput(el);
    const passwordInput = queryPasswordInput(el);
    const form = queryForm(el);

    expect(loginInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(form).not.toBeNull();
    if (!loginInput || !passwordInput || !form) return;

    loginInput.value = "primary";
    passwordInput.value = "abc-123";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(emitSpy).toHaveBeenCalledTimes(1);
    const event = emitSpy.mock.calls[0]?.[0] as CustomEvent<{ action: string; payload?: unknown }>;
    expect(event.detail).toEqual({
      action: "auth-submit",
      payload: { login: "primary", password: "abc-123" },
    });
  });

  it("allows blank login and password submission", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);
    el.state = createState();

    const emitSpy = vi.fn();
    el.addEventListener("pb-ui-action", emitSpy);

    const loginInput = queryLoginInput(el);
    const passwordInput = queryPasswordInput(el);
    const form = queryForm(el);
    expect(loginInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(form).not.toBeNull();
    if (!loginInput || !passwordInput || !form) return;

    loginInput.value = "";
    passwordInput.value = "";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const event = emitSpy.mock.calls[0]?.[0] as CustomEvent<{ action: string; payload?: unknown }>;
    expect(event.detail).toEqual({
      action: "auth-submit",
      payload: { login: "", password: "" },
    });
  });

  it("toggles password visibility from the UI action button", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const input = queryPasswordInput(el);
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

  it("toggles password visibility when clicking nested element", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const input = queryPasswordInput(el);
    const toggle = query(el, '[data-ui-action="toggle-password"]') as HTMLButtonElement | null;

    expect(input).not.toBeNull();
    expect(toggle).not.toBeNull();
    if (!input || !toggle) return;

    const child = document.createElement("span");
    child.textContent = "Show";
    toggle.textContent = "";
    toggle.append(child);

    child.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(input.type).toBe("text");
    expect(toggle.textContent).toContain("Hide");
  });
});
