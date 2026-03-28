import { describe, it, expect } from "vitest";
import { registerAppShell } from "./pumpbuddy-app";

describe("pumpbuddy-app", () => {
  it("registers custom element without throwing", () => {
    expect(() => registerAppShell()).not.toThrow();
  });

  it("defines custom element", () => {
    registerAppShell();
    expect(customElements.get("pumpbuddy-app")).toBeDefined();
  });
});
