import "./pb-confirm-dialog";

export const pbConfiguratorExitGuardTag = "pb-configurator-exit-guard";

export type ConfiguratorExitGuardState = {
  open: boolean;
};

class PbConfiguratorExitGuardElement extends HTMLElement {
  #state: ConfiguratorExitGuardState = { open: false };

  connectedCallback(): void {
    this.#render();
  }

  set state(value: ConfiguratorExitGuardState) {
    this.#state = value;
    this.#render();
  }

  get state(): ConfiguratorExitGuardState {
    return this.#state;
  }

  #render(): void {
    if (!this.#state.open) {
      this.innerHTML = "";
      return;
    }

    this.innerHTML = "<pb-confirm-dialog></pb-confirm-dialog>";
    const dialog = this.querySelector("pb-confirm-dialog") as HTMLElement & {
      state: import("./pb-confirm-dialog").ConfirmDialogState;
    } | null;
    if (dialog) {
      dialog.state = {
        accessibleName: "Discard changes?",
        title: "Discard changes?",
        message: "You have unsaved changes. Discard them and leave this editor?",
        dismissAction: "continue-configurator-draft-editing",
        dismissLabel: "Continue Editing",
        confirmAction: "discard-configurator-draft",
        confirmLabel: "Discard Changes",
        intent: "destructive",
      };
    }
  }
}

export const registerPbConfiguratorExitGuard = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbConfiguratorExitGuardTag)) {
    customElements.define(pbConfiguratorExitGuardTag, PbConfiguratorExitGuardElement);
  }
};

registerPbConfiguratorExitGuard();
