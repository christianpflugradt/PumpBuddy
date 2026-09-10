export const pbCreateButtonTag = "pb-create-button";

class PbCreateButtonElement extends HTMLElement {
  connectedCallback(): void {
    const action = this.getAttribute("action");
    const label = this.getAttribute("label");
    if (!action || !label) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-button nav-button-primary action-button action-button-primary";
    button.dataset.uiAction = action;
    button.textContent = `+ ${label}`;
    this.replaceChildren(button);
  }
}

export const registerPbCreateButton = (): void => {
  if (typeof customElements !== "undefined" && !customElements.get(pbCreateButtonTag)) {
    customElements.define(pbCreateButtonTag, PbCreateButtonElement);
  }
};

registerPbCreateButton();
