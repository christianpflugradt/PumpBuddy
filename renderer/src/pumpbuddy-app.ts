import { registerPbAppRoot, pbAppRootTag } from "./pb-app-root";
import createAuthGate from "./auth-gate";
import { createApp } from "./workout-controller";

const pumpbuddyAppTag = "pumpbuddy-app";

class PumpbuddyAppElement extends HTMLElement {
  #bootstrapped = false;
  #onUnauthorized: EventListener | null = null;

  connectedCallback(): void {
    if (this.#bootstrapped) return;
    this.#bootstrapped = true;

    registerPbAppRoot();

    const mountApp = (el: HTMLElement) => {
      const root = document.createElement(pbAppRootTag) as HTMLElement & { state: unknown };
      el.replaceChildren(root);
      createApp(root);

      // expose setter via custom event channel (controller will hook in later)
      this.dispatchEvent(
        new CustomEvent("pb-app-mounted", {
          bubbles: true,
          composed: true,
          detail: { root },
        }),
      );
    };

    const gate = createAuthGate(this, mountApp);

    this.#onUnauthorized = () => {
      this.innerHTML = "";
      void gate.init();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pb-unauthorized", this.#onUnauthorized);
    }

    void gate.init();
  }

  disconnectedCallback(): void {
    if (this.#onUnauthorized && typeof window !== "undefined") {
      window.removeEventListener("pb-unauthorized", this.#onUnauthorized);
    }
  }
}

export const registerAppShell = (): void => {
  if (!customElements.get(pumpbuddyAppTag)) {
    customElements.define(pumpbuddyAppTag, PumpbuddyAppElement);
  }
};

export { pumpbuddyAppTag };
