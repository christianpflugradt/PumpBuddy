import { createApp } from "./app";
import createAuthGate from "./auth-gate";
import { renderLoginMarkup, attachLoginHandlers } from "./login-component";

const pumpbuddyAppTag = "pumpbuddy-app";

class PumpbuddyAppElement extends HTMLElement {
  #bootstrapped = false;
  #onUnauthorized = null;

  connectedCallback(): void {
    if (this.#bootstrapped) {
      return;
    }

    this.#bootstrapped = true;
    this.classList.add("app");

    // Use a small auth gate module that integrates with the app styles
    const gate = createAuthGate(this, (el) => createApp(el));

    // react to global unauthorized events emitted by fetch helpers
    this.#onUnauthorized = () => {
      try {
        // clear current UI and re-run auth gate which will show the login on 401
        this.innerHTML = "";
        void gate.init();
      } catch (err) {
        // best-effort
      }
    };

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pb-unauthorized", this.#onUnauthorized);
    }

    void gate.init();
  }

  disconnectedCallback(): void {
    if (this.#onUnauthorized && typeof window !== "undefined" && typeof window.removeEventListener === "function") {
      window.removeEventListener("pb-unauthorized", this.#onUnauthorized);
    }
  }
}


const registerAppShell = (): void => {
  if (!customElements.get(pumpbuddyAppTag)) {
    customElements.define(pumpbuddyAppTag, PumpbuddyAppElement);
  }
};

export { pumpbuddyAppTag, registerAppShell };
