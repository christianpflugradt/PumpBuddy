import { beforeEach, describe, expect, it } from "vitest";
import {
  pbConfiguratorStatusTag,
  registerPbConfiguratorStatus,
} from "./pb-configurator-status";

describe("pb-configurator-status", () => {
  beforeEach(() => registerPbConfiguratorStatus());

  it.each([
    ["new", "Draft"],
    ["active", "Active"],
    ["inactive", "Inactive"],
  ] as const)("maps %s to %s with its semantic class", (value, label) => {
    const element = document.createElement(pbConfiguratorStatusTag);
    element.setAttribute("value", value);
    document.body.append(element);

    expect(element.textContent).toBe(label);
    expect(element.classList.contains("configurator-status")).toBe(true);
    expect(element.classList.contains(`configurator-status--${value}`)).toBe(true);
  });
});
