import { beforeEach, describe, expect, it } from "vitest";
import {
  pbConfiguratorHeaderTag,
  registerPbConfiguratorHeader,
} from "./pb-configurator-header";

describe("pb-configurator-header", () => {
  beforeEach(() => registerPbConfiguratorHeader());

  it("renders its Configurator title, context, and accessible banner in light DOM", () => {
    const element = document.createElement(pbConfiguratorHeaderTag);
    element.setAttribute("title", "Exercises");
    element.setAttribute("context", "Manage the canonical movements and their variants.");
    element.setAttribute("banner", "");
    document.body.append(element);

    expect(element.querySelector("header.configurator-header")).not.toBeNull();
    expect(element.querySelector("h1")?.textContent).toBe("Exercises");
    expect(element.querySelector("p")?.textContent).toBe(
      "Manage the canonical movements and their variants.",
    );
    expect(element.querySelector("img")?.alt).toBe("PumpBuddy banner");
  });

  it("omits optional context and banner markup", () => {
    const element = document.createElement(pbConfiguratorHeaderTag);
    element.setAttribute("title", "Current plan");
    document.body.append(element);

    expect(element.querySelector("h1")?.textContent).toBe("Current plan");
    expect(element.querySelector("p")).toBeNull();
    expect(element.querySelector("img")).toBeNull();
  });
});
