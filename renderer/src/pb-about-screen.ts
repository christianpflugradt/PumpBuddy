import type { AboutMetadata } from "./workout-contract";

export const pbAboutScreenTag = "pb-about-screen";
export type AboutScreenState = {
  metadata: AboutMetadata | null;
  errorMessage: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-training-plans"
  | "navigate-gyms"
  | "navigate-history"
  | "navigate-settings"
  | "logout";

class PbAboutScreenElement extends HTMLElement {
  #isSideMenuOpen = false;
  #state: AboutScreenState = {
    metadata: null,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#syncOutsideClickListener();
  }

  set state(value: AboutScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): AboutScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action },
      }),
    );
  }

  #syncSideMenuUi(): void {
    const toggleButton = this.querySelector('[data-ui-action="toggle-side-menu"]');
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.setAttribute("aria-expanded", this.#isSideMenuOpen ? "true" : "false");
      toggleButton.setAttribute(
        "aria-label",
        this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu",
      );
    }

    const sideMenuShell = this.querySelector(".side-menu-shell");
    if (sideMenuShell instanceof HTMLElement) {
      sideMenuShell.classList.toggle("is-open", this.#isSideMenuOpen);
      sideMenuShell.setAttribute("aria-hidden", this.#isSideMenuOpen ? "false" : "true");
    }
  }

  #setSideMenuOpen(nextOpen: boolean): void {
    if (this.#isSideMenuOpen === nextOpen) {
      return;
    }

    this.#isSideMenuOpen = nextOpen;
    this.#syncSideMenuUi();
    this.#syncOutsideClickListener();
  }

  #closeSideMenu = (): void => {
    this.#setSideMenuOpen(false);
  };

  #toggleSideMenu = (): void => {
    this.#setSideMenuOpen(!this.#isSideMenuOpen);
  };

  #onGlobalPointerDown = (event: Event): void => {
    if (!this.#isSideMenuOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-ui-action="toggle-side-menu"]')) {
      return;
    }

    if (target.closest(".side-menu-panel")) {
      return;
    }

    this.#closeSideMenu();
  };

  #syncOutsideClickListener(): void {
    if (this.#isSideMenuOpen && this.isConnected) {
      window.addEventListener("pointerdown", this.#onGlobalPointerDown, true);
      return;
    }

    window.removeEventListener("pointerdown", this.#onGlobalPointerDown, true);
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) {
      return;
    }

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    if (action === "toggle-side-menu") {
      this.#toggleSideMenu();
      return;
    }

    if (action === "close-side-menu") {
      this.#closeSideMenu();
      return;
    }

    this.#setSideMenuOpen(false);
    this.#emitUiAction(action);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (!this.#isSideMenuOpen) {
      return;
    }

    event.preventDefault();
    this.#closeSideMenu();
  };

  #render(): void {
    const sideMenuOpenClass = this.#isSideMenuOpen ? " is-open" : "";
    const metadata = this.#state.metadata;
    const version = metadata?.app_version ?? "unknown";
    const commitHashShort = metadata?.commit_hash_short ?? "unknown";
    const buildTimestampUtc = metadata?.build_timestamp_utc ?? "1970-01-01 00:00 UTC";
    const channel = metadata?.channel ?? "stable";
    const metadataNotice =
      this.#state.errorMessage ??
      (metadata ? "" : "Loading build metadata...");

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle"
          data-ui-action="toggle-side-menu"
          aria-label="${this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu"}"
          aria-expanded="${this.#isSideMenuOpen ? "true" : "false"}"
          aria-controls="about-screen-side-menu"
        >
          <span class="side-menu-toggle-lines" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <div
          class="side-menu-shell${sideMenuOpenClass}"
          aria-hidden="${this.#isSideMenuOpen ? "false" : "true"}"
        >
          <div class="side-menu-backdrop" role="presentation"></div>
          <nav class="side-menu-panel" id="about-screen-side-menu" aria-label="Main navigation">
            <p class="side-menu-title">Navigation</p>
            <ul class="side-menu-list">
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-workout">
                  Workout
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-progress">
                  Progress
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-exercises">
                  Exercises
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-training-plans">
                  Training Plans
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-gyms">
                  Gyms
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-history">
                  History
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-settings">
                  Settings
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  About
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="logout">
                  Log out
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <section class="screen-panel about-screen" aria-label="About screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <h2 class="settings-title">About</h2>
          <dl class="about-meta-list">
            <div class="about-meta-row">
              <dt>Version</dt>
              <dd>${version}</dd>
            </div>
            <div class="about-meta-row">
              <dt>Commit</dt>
              <dd>${commitHashShort}</dd>
            </div>
            <div class="about-meta-row">
              <dt>Build Timestamp</dt>
              <dd>${buildTimestampUtc}</dd>
            </div>
            <div class="about-meta-row">
              <dt>Channel</dt>
              <dd>${channel}</dd>
            </div>
          </dl>
          <p class="about-legal-copy">
            <br />
            <br />
            Copyright (c) 2026 Christian Pflugradt
            <br />
            PolyForm Noncommercial License 1.0.0
            <br />
            <br />
            Contact: <a href="mailto:dev@pflugradts.de">dev@pflugradts.de</a>
          </p>
          <p class="about-meta-status" aria-live="polite">${metadataNotice}</p>
        </section>
      </div>
    `;
  }
}

export const registerPbAboutScreen = (): void => {
  if (!customElements.get(pbAboutScreenTag)) {
    customElements.define(pbAboutScreenTag, PbAboutScreenElement);
  }
};
