import { beforeEach, describe, expect, it } from "vitest";
import { pbCreateButtonTag, registerPbCreateButton } from "./pb-create-button";

describe("pb-create-button", () => {
  beforeEach(() => registerPbCreateButton());

  it("renders a page-level create action from its label and action attributes", () => {
    const element = document.createElement(pbCreateButtonTag);
    element.setAttribute("action", "start-configurator-exercise-create");
    element.setAttribute("label", "New Exercise");
    document.body.append(element);

    const button = element.querySelector("button");
    expect(button?.textContent).toBe("+ New Exercise");
    expect(button?.dataset.uiAction).toBe("start-configurator-exercise-create");
    expect(button?.classList.contains("nav-button-primary")).toBe(true);
    expect(button?.classList.contains("action-button-primary")).toBe(true);
  });
});
