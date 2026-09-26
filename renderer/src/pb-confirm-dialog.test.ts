import { beforeEach, describe, expect, it } from "vitest";
import {
  pbConfirmDialogTag,
  registerPbConfirmDialog,
  type ConfirmDialogState,
} from "./pb-confirm-dialog";

describe("pb-confirm-dialog", () => {
  beforeEach(() => registerPbConfirmDialog());

  it("renders caller-supplied accessible content, actions, disabled state, and affirmative intent in light DOM", () => {
    const element = document.createElement(pbConfirmDialogTag) as HTMLElement & {
      state: ConfirmDialogState;
    };
    document.body.append(element);
    element.state = {
      accessibleName: "Historical rename warning",
      message: "Save this name change?",
      dismissAction: "dismiss-rename-warning",
      dismissLabel: "Keep Editing",
      confirmAction: "save-name",
      confirmLabel: "Save Name",
      controlsDisabled: true,
    };

    expect(element.shadowRoot).toBeNull();
    expect(element.querySelector('[role="alertdialog"]')?.getAttribute("aria-label")).toBe("Historical rename warning");
    expect(element.querySelector('[data-ui-action="dismiss-rename-warning"]')?.textContent).toBe("Keep Editing");
    expect(element.querySelector('[data-ui-action="save-name"]')?.classList.contains("configurator-action-primary")).toBe(true);
    expect([...element.querySelectorAll<HTMLButtonElement>("button")].every((button) => button.disabled)).toBe(true);
  });

  it("renders caller-supplied destructive confirmation presentation", () => {
    const element = document.createElement(pbConfirmDialogTag) as HTMLElement & {
      state: ConfirmDialogState;
    };
    document.body.append(element);
    element.state = {
      accessibleName: "Delete draft gym?",
      title: "Delete draft gym?",
      message: "This will also delete 1 station.",
      dismissAction: "dismiss-delete-gym-warning",
      dismissLabel: "Cancel",
      confirmAction: "delete-gym",
      confirmLabel: "Delete",
      intent: "destructive",
    };

    expect(element.querySelector(".confirm-dialog-title")?.textContent).toBe("Delete draft gym?");
    expect(element.querySelector('[data-ui-action="delete-gym"]')?.classList.contains("configurator-action-danger")).toBe(true);
  });
});
