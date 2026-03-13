import { createApp } from "./app";

const pumpbuddyAppTag = "pumpbuddy-app";

class PumpbuddyAppElement extends HTMLElement {
  #bootstrapped = false;

  connectedCallback(): void {
    if (this.#bootstrapped) {
      return;
    }

    this.#bootstrapped = true;
    this.classList.add("app");
    createApp(this);
  }
}

const registerAppShell = (): void => {
  if (!customElements.get(pumpbuddyAppTag)) {
    customElements.define(pumpbuddyAppTag, PumpbuddyAppElement);
  }
};

export { pumpbuddyAppTag, registerAppShell };
