import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("renders login form", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Access Key");
    expect(text).toContain("Sign in");
  });

  it("emits auth-submit with entered value", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const input = el.shadowRoot?.querySelector("#access-key") as HTMLInputElement;
    input.value = "secret";

    const form = el.shadowRoot?.querySelector("#access-key-form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.action).toBe("auth-submit");
    expect(handler.mock.calls[0][0].detail.payload).toBe("secret");
  });

  it("shows error message", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = {
      errorMessage: "Invalid access key",
      isLoading: false,
    };

    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("Invalid access key");
  });

  it("disables input when loading", () => {
    const el = document.createElement(pbLoginTag) as HTMLElement & { state: LoginState };
    document.body.append(el);

    el.state = {
      errorMessage: null,
      isLoading: true,
    };

    const input = el.shadowRoot?.querySelector("#access-key") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
