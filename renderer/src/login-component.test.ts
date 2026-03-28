import { describe, it, expect } from "vitest";
import { renderLoginMarkup } from "./login-component";

describe("login-component", () => {
  it("renders login form", () => {
    const html = renderLoginMarkup();
    expect(html).toContain("Access Key");
    expect(html).toContain("Sign in");
  });

  it("renders error message", () => {
    const html = renderLoginMarkup("Error");
    expect(html).toContain("Error");
  });
});
