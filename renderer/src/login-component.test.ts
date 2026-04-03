import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachLoginHandlers, renderLoginMarkup } from "./login-component";

describe("login-component", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders login form", () => {
    const html = renderLoginMarkup();
    expect(html).toContain("Access Key");
    expect(html).toContain("Sign in");
  });

  it("renders error message", () => {
    const html = renderLoginMarkup("Error");
    expect(html).toContain("Error");
  });

  it("submits entered access key through callback", () => {
    const app = document.createElement("div");
    app.innerHTML = renderLoginMarkup();

    const callback = vi.fn();
    attachLoginHandlers(app, callback);

    const input = app.querySelector("#access-key") as HTMLInputElement;
    input.value = "secret-key";

    const form = app.querySelector("#access-key-form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(callback).toHaveBeenCalledWith("secret-key");
  });

  it("toggles password visibility and aria state", () => {
    const app = document.createElement("div");
    app.innerHTML = renderLoginMarkup();

    attachLoginHandlers(app, vi.fn());

    const input = app.querySelector("#access-key") as HTMLInputElement;
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
