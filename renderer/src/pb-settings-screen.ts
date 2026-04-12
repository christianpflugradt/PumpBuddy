import type { SessionUser } from "./workout-types";

export const pbSettingsScreenTag = "pb-settings-screen";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatLocalDateOnly = (value: string | undefined): string => {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const penIconSvg = (): string => `
  <svg
    class="settings-display-name-edit-icon"
    data-icon="pen"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
  </svg>
`;

export type SettingsScreenState = {
  sessionUser: SessionUser | null;
};

type SideMenuUiAction = "toggle-side-menu" | "close-side-menu" | "navigate-workout" | "logout";
type DisplayNameUiAction =
  | "enter-display-name-edit"
  | "save-display-name-edit"
  | "discard-display-name-edit";
type UiAction = SideMenuUiAction | DisplayNameUiAction;

type SaveDisplayNameResult = {
  ok: boolean;
  errorMessage?: string;
};

type SaveDisplayNameUiActionDetail = {
  action: "save-display-name";
  payload: {
    displayName: string;
  };
  respond: (result: SaveDisplayNameResult) => void;
};

class PbSettingsScreenElement extends HTMLElement {
  #state: SettingsScreenState | null = null;

  #isSideMenuOpen = false;
  #isDisplayNameEditing = false;
  #displayNameDraft = "";
  #displayNameSaveError: string | null = null;
  #isDisplayNameSaving = false;
  #savedDisplayName: string | null = null;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("input", this.#onInput);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("input", this.#onInput);
    this.#syncOutsideClickListener();
  }

  set state(value: SettingsScreenState | null) {
    const incomingDisplayName = value?.sessionUser?.displayName ?? null;
    if (this.#savedDisplayName !== null && incomingDisplayName === this.#savedDisplayName) {
      this.#savedDisplayName = null;
    }

    if (!this.#isDisplayNameEditing) {
      this.#displayNameDraft = incomingDisplayName ?? "";
      this.#displayNameSaveError = null;
      this.#isDisplayNameSaving = false;
    }

    this.#state = value;
    this.#isSideMenuOpen = false;
    this.#render();
  }

  get state(): SettingsScreenState | null {
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

  #getCurrentDisplayNameValue(): string {
    const stateValue = this.#state?.sessionUser?.displayName ?? null;
    return this.#savedDisplayName ?? stateValue ?? "Unavailable";
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

    if (action === "enter-display-name-edit") {
      const currentDisplayName = this.#getCurrentDisplayNameValue();
      this.#isDisplayNameEditing = true;
      this.#displayNameDraft = currentDisplayName === "Unavailable" ? "" : currentDisplayName;
      this.#displayNameSaveError = null;
      this.#isDisplayNameSaving = false;
      this.#render();
      return;
    }

    if (action === "discard-display-name-edit") {
      const currentDisplayName = this.#getCurrentDisplayNameValue();
      this.#isDisplayNameEditing = false;
      this.#displayNameDraft = currentDisplayName === "Unavailable" ? "" : currentDisplayName;
      this.#displayNameSaveError = null;
      this.#isDisplayNameSaving = false;
      this.#render();
      return;
    }

    if (action === "save-display-name-edit") {
      if (!this.#isDisplayNameEditing || this.#isDisplayNameSaving) {
        return;
      }

      void this.#saveDisplayNameDraft();
      return;
    }

    this.#setSideMenuOpen(false);
    this.#emitUiAction(action);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.uiInput !== "display-name-draft") {
      return;
    }

    this.#displayNameDraft = target.value;
    if (this.#displayNameSaveError) {
      this.#displayNameSaveError = null;
      const error = this.querySelector(".settings-display-name-error");
      if (error) {
        error.remove();
      }
    }

    const saveButton = this.querySelector('[data-ui-action="save-display-name-edit"]');
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = this.#isDisplayNameSaving || this.#displayNameDraft.trim().length === 0;
    }
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

  #requestDisplayNameSave(displayName: string): Promise<SaveDisplayNameResult> {
    return new Promise((resolve) => {
      let hasResolved = false;
      const respond = (result: SaveDisplayNameResult): void => {
        if (hasResolved) {
          return;
        }
        hasResolved = true;
        resolve(result);
      };

      const actionDetail: SaveDisplayNameUiActionDetail = {
        action: "save-display-name",
        payload: { displayName },
        respond,
      };

      const saveEvent = new CustomEvent<SaveDisplayNameUiActionDetail>("pb-ui-action", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: actionDetail,
      });

      this.dispatchEvent(saveEvent);

      // Default to local success when no external save handler takes ownership.
      if (!saveEvent.defaultPrevented) {
        respond({ ok: true });
      }
    });
  }

  async #saveDisplayNameDraft(): Promise<void> {
    const draft = this.#displayNameDraft.trim();
    if (draft.length === 0) {
      this.#displayNameSaveError = "Display name cannot be empty.";
      this.#render();
      return;
    }

    this.#isDisplayNameSaving = true;
    this.#displayNameSaveError = null;
    this.#render();

    const result = await this.#requestDisplayNameSave(draft);

    if (result.ok) {
      this.#savedDisplayName = draft;
      this.#isDisplayNameEditing = false;
      this.#isDisplayNameSaving = false;
      this.#displayNameSaveError = null;
      this.#displayNameDraft = draft;
      this.#render();
      return;
    }

    this.#isDisplayNameSaving = false;
    this.#displayNameSaveError = result.errorMessage ?? "Unable to save display name. Retry.";
    this.#render();
  }

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    const loginIdentity = state.sessionUser?.login ?? "Unavailable";
    const displayName = this.#getCurrentDisplayNameValue();
    const registrationDate = formatLocalDateOnly(state.sessionUser?.registrationDate);
    const sideMenuOpenClass = this.#isSideMenuOpen ? " is-open" : "";
    const isDisplayNameDraftInvalid = this.#displayNameDraft.trim().length === 0;
    const displayNameFieldMarkup = this.#isDisplayNameEditing
      ? `
              <div class="settings-display-name-editor">
                <input
                  type="text"
                  class="weight-input settings-display-name-input"
                  data-ui-input="display-name-draft"
                  value="${escapeHtml(this.#displayNameDraft)}"
                  aria-label="Display name"
                  ${this.#isDisplayNameSaving ? "disabled" : ""}
                />
                <div class="settings-display-name-actions">
                  <button
                    type="button"
                    class="settings-display-name-save nav-button nav-button-primary action-button action-button-primary"
                    data-ui-action="save-display-name-edit"
                    ${this.#isDisplayNameSaving || isDisplayNameDraftInvalid ? "disabled" : ""}
                  >
                    ${this.#isDisplayNameSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    class="settings-display-name-discard nav-button nav-button-secondary action-button action-button-secondary"
                    data-ui-action="discard-display-name-edit"
                    ${this.#isDisplayNameSaving ? "disabled" : ""}
                  >
                    Discard
                  </button>
                </div>
                ${
                  this.#displayNameSaveError
                    ? `<p class="settings-display-name-error" role="alert">${escapeHtml(this.#displayNameSaveError)}</p>`
                    : ""
                }
              </div>
            `
      : `
              <div class="settings-display-name-view">
                <span class="settings-display-name-text">${escapeHtml(displayName)}</span>
                <button
                  type="button"
                  class="settings-display-name-edit"
                  data-ui-action="enter-display-name-edit"
                  aria-label="Edit display name"
                  title="Edit display name"
                >
                  ${penIconSvg()}
                </button>
              </div>
            `;

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle"
          data-ui-action="toggle-side-menu"
          aria-label="${this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu"}"
          aria-expanded="${this.#isSideMenuOpen ? "true" : "false"}"
          aria-controls="settings-screen-side-menu"
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
          <nav class="side-menu-panel" id="settings-screen-side-menu" aria-label="Main navigation">
            <p class="side-menu-title">Navigation</p>
            <ul class="side-menu-list">
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-workout">
                  Workout
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  Settings
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
        <section class="screen-panel settings-screen" aria-label="Settings screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
            <p class="start-copy">Account details from your active session.</p>
          </header>
          <h2 class="settings-title">Settings</h2>
          <dl class="settings-details" aria-label="Session user details">
            <div class="settings-detail-row">
              <dt class="settings-detail-key">User login</dt>
              <dd class="settings-detail-value">${escapeHtml(loginIdentity)}</dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Display name</dt>
              <dd class="settings-detail-value">
                ${displayNameFieldMarkup}
              </dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Registration date</dt>
              <dd class="settings-detail-value">${escapeHtml(registrationDate)}</dd>
            </div>
          </dl>
        </section>
      </div>
    `;
  }
}

export const registerPbSettingsScreen = (): void => {
  if (!customElements.get(pbSettingsScreenTag)) {
    customElements.define(pbSettingsScreenTag, PbSettingsScreenElement);
  }
};
