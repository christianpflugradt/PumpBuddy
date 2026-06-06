import type { AboutMetadata } from "./workout-contract";
import "./pb-side-menu";

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
  #state: AboutScreenState = {
    metadata: null,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
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


    this.#emitUiAction(action);
  };

  #render(): void {
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
        <pb-side-menu active-screen="about" menu-id="about-screen-side-menu"></pb-side-menu>
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
