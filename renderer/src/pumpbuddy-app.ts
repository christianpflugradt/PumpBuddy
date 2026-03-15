import { createApp } from "./app";
import createAuthGate from "./auth-gate";

const pumpbuddyAppTag = "pumpbuddy-app";

class PumpbuddyAppElement extends HTMLElement {
  #bootstrapped = false;

  connectedCallback(): void {
    if (this.#bootstrapped) {
      return;
    }

    this.#bootstrapped = true;
    this.classList.add("app");

    // Use a small auth gate module that integrates with the app styles
    const gate = createAuthGate(this, (el) => createApp(el));
    void gate.init();
  }
}


const registerAppShell = (): void => {
  if (!customElements.get(pumpbuddyAppTag)) {
    customElements.define(pumpbuddyAppTag, PumpbuddyAppElement);
  }
};

export { pumpbuddyAppTag, registerAppShell };
