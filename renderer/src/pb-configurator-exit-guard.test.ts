import { describe, expect, it } from "vitest";
import {
  pbConfiguratorExitGuardTag,
  type ConfiguratorExitGuardState,
} from "./pb-configurator-exit-guard";

describe("pb-configurator-exit-guard", () => {
  it("uses the shared confirmation dialog with the required discard choices", () => {
    const element = document.createElement(pbConfiguratorExitGuardTag) as HTMLElement & {
      state: ConfiguratorExitGuardState;
    };
    document.body.append(element);
    element.state = { open: true };

    expect(element.querySelector(".confirm-dialog-title")?.textContent).toBe("Discard changes?");
    expect(element.querySelector('[data-ui-action="continue-configurator-draft-editing"]')?.textContent).toBe("Continue Editing");
    expect(element.querySelector('[data-ui-action="discard-configurator-draft"]')?.textContent).toBe("Discard Changes");
  });
});
