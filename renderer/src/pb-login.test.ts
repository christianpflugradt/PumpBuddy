import { describe, it, expect, beforeEach } from "vitest";
import { registerPbLogin, pbLoginTag } from "./pb-login";
import type { LoginState } from "./pb-login";

describe("pb-login", () => {
  beforeEach(() => {
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
});
