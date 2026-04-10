import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachLoginHandlers, renderLoginMarkup } from "./login-component";

describe("login-component", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders login form", () => {
    const html = renderLoginMarkup();
    expect(html).toContain("Login");
    expect(html).toContain("Password");
    expect(html).toContain("Sign in");
  });

  it("renders error message", () => {
    const html = renderLoginMarkup("Error");
    expect(html).toContain("Error");
  });

  it("submits entered login credentials through callback", () => {
    const app = document.createElement("div");
    app.innerHTML = renderLoginMarkup();

    const callback = vi.fn();
    attachLoginHandlers(app, callback);

    const loginInput = app.querySelector("#login") as HTMLInputElement;
    const passwordInput = app.querySelector("#password") as HTMLInputElement;
    loginInput.value = "primary";
    passwordInput.value = "secret-key";

    const form = app.querySelector("#login-form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(callback).toHaveBeenCalledWith({ login: "primary", password: "secret-key" });
  });

  it("allows blank login and password submission", () => {
    const app = document.createElement("div");
    app.innerHTML = renderLoginMarkup();

    const callback = vi.fn();
    attachLoginHandlers(app, callback);

    const form = app.querySelector("#login-form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(callback).toHaveBeenCalledWith({ login: "", password: "" });
  });

  it("toggles password visibility and aria state", () => {
    const app = document.createElement("div");
    app.innerHTML = renderLoginMarkup();

    attachLoginHandlers(app, vi.fn());

    const input = app.querySelector("#password") as HTMLInputElement;
    const toggle = app.querySelector("#toggle-show") as HTMLButtonElement;

    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    toggle.click();
    expect(input.type).toBe("text");
    expect(toggle.textContent).toBe("Hide");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    toggle.click();
    expect(input.type).toBe("password");
    expect(toggle.textContent).toBe("Show");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("is best-effort when required nodes are absent", () => {
    const app = document.createElement("div");
    expect(() => attachLoginHandlers(app, vi.fn())).not.toThrow();
  });
});
