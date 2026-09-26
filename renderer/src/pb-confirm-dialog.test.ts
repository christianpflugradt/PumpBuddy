import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(element.querySelector('[role="alertdialog"]')?.getAttribute("aria-labelledby")).toBe("confirm-dialog-title");
    expect(element.querySelector(".confirm-dialog-title")?.textContent).toBe("Historical rename warning");
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

  it("focuses the safe dismiss action, contains Tab, dismisses on Escape, and returns focus to its invoker", () => {
    const invoker = document.createElement("button");
    invoker.textContent = "Delete gym";
    document.body.append(invoker);
    invoker.focus();
    const element = document.createElement(pbConfirmDialogTag) as HTMLElement & {
      state: ConfirmDialogState | null;
    };
    document.body.append(element);
    element.state = {
      accessibleName: "Delete gym?",
      message: "This will delete the gym.",
      dismissAction: "dismiss-delete-gym-warning",
      dismissLabel: "Cancel",
      confirmAction: "delete-gym",
      confirmLabel: "Delete",
      intent: "destructive",
    };

    const dismiss = element.querySelector<HTMLButtonElement>(".configurator-action-dismiss")!;
    const confirm = element.querySelector<HTMLButtonElement>(".configurator-action-danger")!;
    expect(document.activeElement).toBe(dismiss);
    confirm.focus();
    confirm.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(dismiss);
    dismiss.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(confirm);

    const dismissed = vi.fn();
    dismiss.addEventListener("click", dismissed);
    dismiss.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(dismissed).toHaveBeenCalledOnce();
    element.remove();
    expect(document.activeElement).toBe(invoker);
  });

  it("does not dismiss a disabled confirmation with Escape or return focus to a removed invoker", () => {
    const invoker = document.createElement("button");
    document.body.append(invoker);
    invoker.focus();
    const element = document.createElement(pbConfirmDialogTag) as HTMLElement & {
      state: ConfirmDialogState | null;
    };
    document.body.append(element);
    element.state = {
      accessibleName: "Saving changes",
      message: "Saving is in progress.",
      dismissAction: "dismiss-save",
      dismissLabel: "Cancel",
      confirmAction: "save",
      confirmLabel: "Save",
      controlsDisabled: true,
    };

    const dismiss = element.querySelector<HTMLButtonElement>(".configurator-action-dismiss")!;
    const dismissed = vi.fn();
    dismiss.addEventListener("click", dismissed);
    dismiss.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(dismissed).not.toHaveBeenCalled();
    invoker.remove();
    element.remove();
    expect(document.activeElement).not.toBe(invoker);
  });
});
