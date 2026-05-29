import type { GymSummary } from "./workout-contract";
import type { SessionUser } from "./workout-types";

export const pbSettingsScreenTag = "pb-settings-screen";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const NEW_PASSWORD_MIN_LENGTH = 8;
const NEW_PASSWORD_MIN_LENGTH_ERROR = `New password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters.`;
const PASSWORD_MISMATCH_ERROR = "New password and confirmation must match.";
const MIN_EDITABLE_MAX_LOAD_KG = 100;
const MAX_EDITABLE_MAX_LOAD_KG = 999;
const MAX_LOAD_BOUNDS_ERROR = `Max load must be between ${MIN_EDITABLE_MAX_LOAD_KG} and ${MAX_EDITABLE_MAX_LOAD_KG} kg.`;
const MAX_LOAD_INTEGER_ONLY_ERROR = "Max load must be a whole number in kg.";

const formatRegistrationDate = (value: string | undefined): string => {
  if (!value) {
    return "Unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
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
  gyms: GymSummary[];
};

type SideMenuUiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-gyms"
  | "navigate-history"
  | "navigate-about"
  | "logout";
type DisplayNameUiAction =
  | "enter-display-name-edit"
  | "save-display-name-edit"
  | "discard-display-name-edit";
type FavoriteGymUiAction =
  | "enter-favorite-gym-edit"
  | "save-favorite-gym-edit"
  | "discard-favorite-gym-edit";
type MaxLoadUiAction = "enter-max-load-edit" | "save-max-load-edit" | "discard-max-load-edit";
type PasswordUiAction = "enter-password-edit" | "save-password-edit" | "discard-password-edit";
type UiAction = SideMenuUiAction | DisplayNameUiAction | FavoriteGymUiAction | MaxLoadUiAction | PasswordUiAction;

type SaveResult = {
  ok: boolean;
  errorMessage?: string;
};

type SaveDisplayNameUiActionDetail = {
  action: "save-display-name";
  payload: {
    displayName: string;
  };
  respond: (result: SaveResult) => void;
};

type SaveFavoriteGymUiActionDetail = {
  action: "save-favorite-gym";
  payload: {
    favoriteGymId: string | null;
  };
  respond: (result: SaveResult) => void;
};

type SaveMaxLoadUiActionDetail = {
  action: "save-max-load";
  payload: {
    maxLoadKg: number;
  };
  respond: (result: SaveResult) => void;
};

type SavePasswordUiActionDetail = {
  action: "save-password";
  payload: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  };
  respond: (result: SaveResult) => void;
};

type PasswordFeedback = {
  kind: "success" | "error";
  message: string;
};

const PASSWORD_MASK = "********";

class PbSettingsScreenElement extends HTMLElement {
  #state: SettingsScreenState | null = null;

  #isSideMenuOpen = false;
  #isDisplayNameEditing = false;
  #displayNameDraft = "";
  #displayNameSaveError: string | null = null;
  #isDisplayNameSaving = false;
  #savedDisplayName: string | null = null;

  #isFavoriteGymEditing = false;
  #favoriteGymDraftId = "";
  #favoriteGymSaveError: string | null = null;
  #isFavoriteGymSaving = false;
  #savedFavoriteGymId: string | null | undefined = undefined;

  #isMaxLoadEditing = false;
  #maxLoadDraft = "";
  #maxLoadSaveError: string | null = null;
  #isMaxLoadSaving = false;
  #savedMaxLoadKg: number | undefined = undefined;

  #isPasswordEditing = false;
  #isPasswordSaving = false;
  #passwordDraftCurrent = "";
  #passwordDraftNext = "";
  #passwordDraftConfirm = "";
  #passwordValidationError: string | null = null;
  #passwordFeedback: PasswordFeedback | null = null;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("input", this.#onInput);
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("change", this.#onChange);
    this.#syncOutsideClickListener();
  }

  set state(value: SettingsScreenState | null) {
    const incomingDisplayName = value?.sessionUser?.displayName ?? null;
    if (this.#savedDisplayName !== null && incomingDisplayName === this.#savedDisplayName) {
      this.#savedDisplayName = null;
    }

    const incomingFavoriteGymId =
      typeof value?.sessionUser?.favoriteGymId === "string" || value?.sessionUser?.favoriteGymId === null
        ? value.sessionUser.favoriteGymId
        : null;
    if (this.#savedFavoriteGymId !== undefined && incomingFavoriteGymId === this.#savedFavoriteGymId) {
      this.#savedFavoriteGymId = undefined;
    }

    const incomingMaxLoadKg = Number.isFinite(value?.sessionUser?.maxLoadKg)
      ? Math.floor(value?.sessionUser?.maxLoadKg ?? 0)
      : null;
    if (this.#savedMaxLoadKg !== undefined && incomingMaxLoadKg === this.#savedMaxLoadKg) {
      this.#savedMaxLoadKg = undefined;
    }

    if (!this.#isDisplayNameEditing) {
      this.#displayNameDraft = incomingDisplayName ?? "";
      this.#displayNameSaveError = null;
      this.#isDisplayNameSaving = false;
    }

    if (!this.#isFavoriteGymEditing) {
      this.#favoriteGymDraftId = incomingFavoriteGymId ?? "";
      this.#favoriteGymSaveError = null;
      this.#isFavoriteGymSaving = false;
    }

    if (!this.#isMaxLoadEditing) {
      this.#maxLoadDraft = incomingMaxLoadKg === null ? "" : String(incomingMaxLoadKg);
      this.#maxLoadSaveError = null;
      this.#isMaxLoadSaving = false;
    }

    if (!this.#isPasswordEditing) {
      this.#resetPasswordDrafts();
      this.#passwordValidationError = null;
      this.#isPasswordSaving = false;
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

  #getCurrentFavoriteGymId(): string | null {
    if (this.#savedFavoriteGymId !== undefined) {
      return this.#savedFavoriteGymId;
    }

    const value = this.#state?.sessionUser?.favoriteGymId;
    return typeof value === "string" || value === null ? value : null;
  }

  #getFavoriteGymLabel(favoriteGymId: string | null): string {
    if (favoriteGymId === null) {
      return "Not set";
    }

    const gym = this.#state?.gyms.find((candidate) => candidate.id === favoriteGymId) ?? null;
    if (!gym) {
      return "Not set";
    }

    return gym.name;
  }

  #getCurrentMaxLoadKg(): number | null {
    if (this.#savedMaxLoadKg !== undefined) {
      return this.#savedMaxLoadKg;
    }

    const value = this.#state?.sessionUser?.maxLoadKg;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    return Math.floor(value);
  }

  #parseMaxLoadDraftValue(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    if (parsed < MIN_EDITABLE_MAX_LOAD_KG || parsed > MAX_EDITABLE_MAX_LOAD_KG) {
      return null;
    }

    return parsed;
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

    if (action === "enter-favorite-gym-edit") {
      this.#isFavoriteGymEditing = true;
      this.#favoriteGymDraftId = this.#getCurrentFavoriteGymId() ?? "";
      this.#favoriteGymSaveError = null;
      this.#isFavoriteGymSaving = false;
      this.#render();
      return;
    }

    if (action === "discard-favorite-gym-edit") {
      this.#isFavoriteGymEditing = false;
      this.#favoriteGymDraftId = this.#getCurrentFavoriteGymId() ?? "";
      this.#favoriteGymSaveError = null;
      this.#isFavoriteGymSaving = false;
      this.#render();
      return;
    }

    if (action === "save-favorite-gym-edit") {
      if (!this.#isFavoriteGymEditing || this.#isFavoriteGymSaving) {
        return;
      }

      void this.#saveFavoriteGymDraft();
      return;
    }

    if (action === "enter-max-load-edit") {
      this.#isMaxLoadEditing = true;
      const currentMaxLoadKg = this.#getCurrentMaxLoadKg();
      this.#maxLoadDraft = currentMaxLoadKg === null ? "" : String(currentMaxLoadKg);
      this.#maxLoadSaveError = null;
      this.#isMaxLoadSaving = false;
      this.#render();
      return;
    }

    if (action === "discard-max-load-edit") {
      this.#isMaxLoadEditing = false;
      const currentMaxLoadKg = this.#getCurrentMaxLoadKg();
      this.#maxLoadDraft = currentMaxLoadKg === null ? "" : String(currentMaxLoadKg);
      this.#maxLoadSaveError = null;
      this.#isMaxLoadSaving = false;
      this.#render();
      return;
    }

    if (action === "save-max-load-edit") {
      if (!this.#isMaxLoadEditing || this.#isMaxLoadSaving) {
        return;
      }

      void this.#saveMaxLoadDraft();
      return;
    }

    if (action === "enter-password-edit") {
      this.#isPasswordEditing = true;
      this.#resetPasswordDrafts();
      this.#passwordValidationError = null;
      this.#passwordFeedback = null;
      this.#isPasswordSaving = false;
      this.#render();
      return;
    }

    if (action === "discard-password-edit") {
      this.#isPasswordEditing = false;
      this.#resetPasswordDrafts();
      this.#passwordValidationError = null;
      this.#isPasswordSaving = false;
      this.#passwordFeedback = null;
      this.#render();
      return;
    }

    if (action === "save-password-edit") {
      if (!this.#isPasswordEditing || this.#isPasswordSaving) {
        return;
      }

      void this.#savePasswordDraft();
      return;
    }

    this.#setSideMenuOpen(false);
    this.#emitUiAction(action);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.dataset.uiInput === "display-name-draft") {
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
      return;
    }

    if (target.dataset.uiInput === "max-load-draft") {
      this.#maxLoadDraft = target.value;
      if (this.#maxLoadSaveError) {
        this.#maxLoadSaveError = null;
      }

      this.#syncMaxLoadEditorUi();
      return;
    }

    const passwordInput = target.dataset.uiInput;
    if (passwordInput === "password-current-draft") {
      this.#passwordDraftCurrent = target.value;
    } else if (passwordInput === "password-new-draft") {
      this.#passwordDraftNext = target.value;
    } else if (passwordInput === "password-confirm-draft") {
      this.#passwordDraftConfirm = target.value;
    } else {
      return;
    }

    this.#passwordValidationError = this.#getPasswordValidationError(
      this.#passwordDraftNext,
      this.#passwordDraftConfirm,
    );
    this.#passwordFeedback = null;
    this.#syncPasswordEditorUi();
  };

  #syncPasswordEditorUi(): void {
    const saveButton = this.querySelector('[data-ui-action="save-password-edit"]');
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = this.#isPasswordSaving || Boolean(this.#passwordValidationError);
    }

    const editor = this.querySelector(".settings-password-editor");
    if (!(editor instanceof HTMLElement)) {
      return;
    }

    const feedback = this.querySelector(".settings-password-feedback");
    if (feedback instanceof HTMLElement) {
      feedback.remove();
    }

    const existingError = editor.querySelector(".settings-password-error");
    if (this.#passwordValidationError) {
      if (existingError instanceof HTMLElement) {
        existingError.textContent = this.#passwordValidationError;
        return;
      }

      const error = document.createElement("p");
      error.className = "settings-password-error";
      error.setAttribute("role", "alert");
      error.textContent = this.#passwordValidationError;
      editor.append(error);
      return;
    }

    if (existingError instanceof HTMLElement) {
      existingError.remove();
    }
  }

  #getMaxLoadValidationError(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (!/^\d+$/.test(trimmed)) {
      return MAX_LOAD_INTEGER_ONLY_ERROR;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_EDITABLE_MAX_LOAD_KG || parsed > MAX_EDITABLE_MAX_LOAD_KG) {
      return MAX_LOAD_BOUNDS_ERROR;
    }

    return null;
  }

  #syncMaxLoadEditorUi(): void {
    const saveButton = this.querySelector('[data-ui-action="save-max-load-edit"]');
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled = this.#isMaxLoadSaving;
    }

    const editor = this.querySelector(".settings-max-load-editor");
    if (!(editor instanceof HTMLElement)) {
      return;
    }

    const validationError = this.#getMaxLoadValidationError(this.#maxLoadDraft);
    const existingError = editor.querySelector(".settings-max-load-error");
    if (validationError) {
      if (existingError instanceof HTMLElement) {
        existingError.textContent = validationError;
        return;
      }

      const error = document.createElement("p");
      error.className = "settings-password-error settings-max-load-error";
      error.setAttribute("role", "alert");
      error.textContent = validationError;
      editor.append(error);
      return;
    }

    if (existingError instanceof HTMLElement) {
      existingError.remove();
    }
  }

  #onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.dataset.uiInput !== "favorite-gym-draft") {
      return;
    }

    this.#favoriteGymDraftId = target.value;
    if (this.#favoriteGymSaveError) {
      this.#favoriteGymSaveError = null;
      const error = this.querySelector(".settings-favorite-gym-error");
      if (error) {
        error.remove();
      }
    }

    const currentFavoriteGymId = this.#getCurrentFavoriteGymId();
    const saveButton = this.querySelector('[data-ui-action="save-favorite-gym-edit"]');
    if (saveButton instanceof HTMLButtonElement) {
      saveButton.disabled =
        this.#isFavoriteGymSaving || (this.#favoriteGymDraftId || null) === currentFavoriteGymId;
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

  #requestDisplayNameSave(displayName: string): Promise<SaveResult> {
    return new Promise((resolve) => {
      let hasResolved = false;
      const respond = (result: SaveResult): void => {
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

  #requestFavoriteGymSave(favoriteGymId: string | null): Promise<SaveResult> {
    return new Promise((resolve) => {
      let hasResolved = false;
      const respond = (result: SaveResult): void => {
        if (hasResolved) {
          return;
        }
        hasResolved = true;
        resolve(result);
      };

      const actionDetail: SaveFavoriteGymUiActionDetail = {
        action: "save-favorite-gym",
        payload: { favoriteGymId },
        respond,
      };

      const saveEvent = new CustomEvent<SaveFavoriteGymUiActionDetail>("pb-ui-action", {
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

  #requestMaxLoadSave(maxLoadKg: number): Promise<SaveResult> {
    return new Promise((resolve) => {
      let hasResolved = false;
      const respond = (result: SaveResult): void => {
        if (hasResolved) {
          return;
        }
        hasResolved = true;
        resolve(result);
      };

      const actionDetail: SaveMaxLoadUiActionDetail = {
        action: "save-max-load",
        payload: { maxLoadKg },
        respond,
      };

      const saveEvent = new CustomEvent<SaveMaxLoadUiActionDetail>("pb-ui-action", {
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

  #requestPasswordSave(
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ): Promise<SaveResult> {
    return new Promise((resolve) => {
      let hasResolved = false;
      const respond = (result: SaveResult): void => {
        if (hasResolved) {
          return;
        }
        hasResolved = true;
        resolve(result);
      };

      const actionDetail: SavePasswordUiActionDetail = {
        action: "save-password",
        payload: {
          currentPassword,
          newPassword,
          confirmNewPassword,
        },
        respond,
      };

      const saveEvent = new CustomEvent<SavePasswordUiActionDetail>("pb-ui-action", {
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

  async #saveFavoriteGymDraft(): Promise<void> {
    const draftFavoriteGymId = this.#favoriteGymDraftId || null;
    this.#isFavoriteGymSaving = true;
    this.#favoriteGymSaveError = null;
    this.#render();

    const result = await this.#requestFavoriteGymSave(draftFavoriteGymId);

    if (result.ok) {
      this.#savedFavoriteGymId = draftFavoriteGymId;
      this.#isFavoriteGymEditing = false;
      this.#isFavoriteGymSaving = false;
      this.#favoriteGymSaveError = null;
      this.#favoriteGymDraftId = draftFavoriteGymId ?? "";
      this.#render();
      return;
    }

    this.#isFavoriteGymSaving = false;
    this.#favoriteGymSaveError = result.errorMessage ?? "Unable to save favorite gym. Retry.";
    this.#render();
  }

  async #saveMaxLoadDraft(): Promise<void> {
    const validationError = this.#getMaxLoadValidationError(this.#maxLoadDraft);
    if (validationError) {
      this.#maxLoadSaveError = validationError;
      this.#render();
      return;
    }

    const draftMaxLoadKg = this.#parseMaxLoadDraftValue(this.#maxLoadDraft);
    if (draftMaxLoadKg === null) {
      this.#maxLoadSaveError = MAX_LOAD_BOUNDS_ERROR;
      this.#render();
      return;
    }

    const currentMaxLoadKg = this.#getCurrentMaxLoadKg();
    if (draftMaxLoadKg === currentMaxLoadKg) {
      this.#isMaxLoadEditing = false;
      this.#isMaxLoadSaving = false;
      this.#maxLoadSaveError = null;
      this.#maxLoadDraft = currentMaxLoadKg === null ? "" : String(currentMaxLoadKg);
      this.#render();
      return;
    }

    this.#isMaxLoadSaving = true;
    this.#maxLoadSaveError = null;
    this.#render();

    const result = await this.#requestMaxLoadSave(draftMaxLoadKg);

    if (result.ok) {
      this.#savedMaxLoadKg = draftMaxLoadKg;
      this.#isMaxLoadEditing = false;
      this.#isMaxLoadSaving = false;
      this.#maxLoadSaveError = null;
      this.#maxLoadDraft = String(draftMaxLoadKg);
      this.#render();
      return;
    }

    this.#isMaxLoadSaving = false;
    this.#maxLoadSaveError = result.errorMessage ?? "Unable to save max load. Retry.";
    this.#render();
  }

  #resetPasswordDrafts(): void {
    this.#passwordDraftCurrent = "";
    this.#passwordDraftNext = "";
    this.#passwordDraftConfirm = "";
  }

  #getPasswordValidationError(newPassword: string, confirmNewPassword: string): string | null {
    if (newPassword.length > 0 && newPassword.length < NEW_PASSWORD_MIN_LENGTH) {
      return NEW_PASSWORD_MIN_LENGTH_ERROR;
    }

    if (
      newPassword.length > 0 &&
      confirmNewPassword.length > 0 &&
      newPassword !== confirmNewPassword
    ) {
      return PASSWORD_MISMATCH_ERROR;
    }

    return null;
  }

  async #savePasswordDraft(): Promise<void> {
    const currentPassword = this.#passwordDraftCurrent;
    const newPassword = this.#passwordDraftNext;
    const confirmNewPassword = this.#passwordDraftConfirm;

    const validationError = this.#getPasswordValidationError(newPassword, confirmNewPassword);
    if (validationError) {
      this.#passwordValidationError = validationError;
      this.#render();
      return;
    }

    this.#isPasswordSaving = true;
    this.#passwordValidationError = null;
    this.#passwordFeedback = null;
    this.#render();

    const result = await this.#requestPasswordSave(currentPassword, newPassword, confirmNewPassword);

    this.#isPasswordSaving = false;
    this.#isPasswordEditing = false;
    this.#passwordValidationError = null;
    this.#resetPasswordDrafts();
    this.#passwordFeedback = result.ok
      ? { kind: "success", message: "Password updated successfully." }
      : { kind: "error", message: result.errorMessage ?? "Unable to update password right now." };
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
    const registrationDate = formatRegistrationDate(state.sessionUser?.registrationDate);
    const currentFavoriteGymId = this.#getCurrentFavoriteGymId();
    const favoriteGymLabel = this.#getFavoriteGymLabel(currentFavoriteGymId);
    const currentMaxLoadKg = this.#getCurrentMaxLoadKg();
    const maxLoadDisplayValue = currentMaxLoadKg === null ? "Not set" : `${currentMaxLoadKg} kg`;
    const sideMenuOpenClass = this.#isSideMenuOpen ? " is-open" : "";
    const isDisplayNameDraftInvalid = this.#displayNameDraft.trim().length === 0;
    const isFavoriteGymDraftUnchanged = (this.#favoriteGymDraftId || null) === currentFavoriteGymId;
    const maxLoadValidationError = this.#isMaxLoadEditing ? this.#getMaxLoadValidationError(this.#maxLoadDraft) : null;
    const passwordValidationError = this.#getPasswordValidationError(
      this.#passwordDraftNext,
      this.#passwordDraftConfirm,
    );
    const passwordFieldMarkup = this.#isPasswordEditing
      ? `
              <div class="settings-password-editor">
                <label class="start-label" for="settings-password-current">Current password</label>
                <input
                  id="settings-password-current"
                  type="password"
                  class="weight-input settings-password-input"
                  data-ui-input="password-current-draft"
                  value="${escapeHtml(this.#passwordDraftCurrent)}"
                  autocomplete="current-password"
                  aria-label="Current password"
                  ${this.#isPasswordSaving ? "disabled" : ""}
                />
                <label class="start-label" for="settings-password-new">New password</label>
                <input
                  id="settings-password-new"
                  type="password"
                  class="weight-input settings-password-input"
                  data-ui-input="password-new-draft"
                  value="${escapeHtml(this.#passwordDraftNext)}"
                  autocomplete="new-password"
                  aria-label="New password"
                  ${this.#isPasswordSaving ? "disabled" : ""}
                />
                <label class="start-label" for="settings-password-confirm">Confirm new password</label>
                <input
                  id="settings-password-confirm"
                  type="password"
                  class="weight-input settings-password-input"
                  data-ui-input="password-confirm-draft"
                  value="${escapeHtml(this.#passwordDraftConfirm)}"
                  autocomplete="new-password"
                  aria-label="Confirm new password"
                  ${this.#isPasswordSaving ? "disabled" : ""}
                />
                <div class="settings-password-actions">
                  <button
                    type="button"
                    class="settings-password-save nav-button nav-button-primary action-button action-button-primary"
                    data-ui-action="save-password-edit"
                    ${this.#isPasswordSaving || passwordValidationError ? "disabled" : ""}
                  >
                    ${this.#isPasswordSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    class="settings-password-discard nav-button nav-button-secondary action-button action-button-secondary"
                    data-ui-action="discard-password-edit"
                    ${this.#isPasswordSaving ? "disabled" : ""}
                  >
                    Discard
                  </button>
                </div>
                ${
                  this.#passwordValidationError
                    ? `<p class="settings-password-error" role="alert">${escapeHtml(this.#passwordValidationError)}</p>`
                    : ""
                }
              </div>
            `
      : `
              <div class="settings-password-view">
                <span class="settings-password-text">${PASSWORD_MASK}</span>
                <button
                  type="button"
                  class="settings-password-edit"
                  data-ui-action="enter-password-edit"
                  aria-label="Edit password"
                  title="Edit password"
                >
                  ${penIconSvg()}
                </button>
              </div>
            `;
    const passwordFeedbackMarkup = this.#passwordFeedback
      ? `<p class="settings-password-feedback settings-password-feedback-${this.#passwordFeedback.kind}" role="status">${escapeHtml(this.#passwordFeedback.message)}</p>`
      : "";
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
    const favoriteGymFieldMarkup = this.#isFavoriteGymEditing
      ? `
              <div class="settings-favorite-gym-editor">
                <select
                  class="start-select settings-favorite-gym-select"
                  data-ui-input="favorite-gym-draft"
                  aria-label="Favorite gym"
                  ${this.#isFavoriteGymSaving ? "disabled" : ""}
                >
                  <option value="" ${this.#favoriteGymDraftId === "" ? "selected" : ""}>No favorite gym</option>
                  ${state.gyms
                    .map(
                      (gym) =>
                        `<option value="${escapeHtml(gym.id)}" ${gym.id === this.#favoriteGymDraftId ? "selected" : ""}>${escapeHtml(gym.name)}</option>`,
                    )
                    .join("")}
                </select>
                <div class="settings-favorite-gym-actions">
                  <button
                    type="button"
                    class="settings-favorite-gym-save nav-button nav-button-primary action-button action-button-primary"
                    data-ui-action="save-favorite-gym-edit"
                    ${this.#isFavoriteGymSaving || isFavoriteGymDraftUnchanged ? "disabled" : ""}
                  >
                    ${this.#isFavoriteGymSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    class="settings-favorite-gym-discard nav-button nav-button-secondary action-button action-button-secondary"
                    data-ui-action="discard-favorite-gym-edit"
                    ${this.#isFavoriteGymSaving ? "disabled" : ""}
                  >
                    Discard
                  </button>
                </div>
                ${
                  this.#favoriteGymSaveError
                    ? `<p class="settings-favorite-gym-error" role="alert">${escapeHtml(this.#favoriteGymSaveError)}</p>`
                    : ""
                }
              </div>
            `
      : `
              <div class="settings-favorite-gym-view">
                <span class="settings-favorite-gym-text">${escapeHtml(favoriteGymLabel)}</span>
                <button
                  type="button"
                  class="settings-favorite-gym-edit"
                  data-ui-action="enter-favorite-gym-edit"
                  aria-label="Edit favorite gym"
                  title="Edit favorite gym"
                >
                  ${penIconSvg()}
                </button>
              </div>
            `;
    const maxLoadFieldMarkup = this.#isMaxLoadEditing
      ? `
              <div class="settings-max-load-editor">
                <input
                  type="text"
                  class="weight-input settings-max-load-input"
                  data-ui-input="max-load-draft"
                  value="${escapeHtml(this.#maxLoadDraft)}"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  aria-label="Max load in kilograms"
                  ${this.#isMaxLoadSaving ? "disabled" : ""}
                />
                <div class="settings-max-load-actions">
                  <button
                    type="button"
                    class="settings-max-load-save nav-button nav-button-primary action-button action-button-primary"
                    data-ui-action="save-max-load-edit"
                    ${this.#isMaxLoadSaving ? "disabled" : ""}
                  >
                    ${this.#isMaxLoadSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    class="settings-max-load-discard nav-button nav-button-secondary action-button action-button-secondary"
                    data-ui-action="discard-max-load-edit"
                    ${this.#isMaxLoadSaving ? "disabled" : ""}
                  >
                    Discard
                  </button>
                </div>
                ${
                  this.#maxLoadSaveError || maxLoadValidationError
                    ? `<p class="settings-password-error settings-max-load-error" role="alert">${escapeHtml(this.#maxLoadSaveError ?? maxLoadValidationError ?? "")}</p>`
                    : ""
                }
              </div>
            `
      : `
              <div class="settings-max-load-view">
                <span class="settings-max-load-text">${escapeHtml(maxLoadDisplayValue)}</span>
                <button
                  type="button"
                  class="settings-max-load-edit"
                  data-ui-action="enter-max-load-edit"
                  aria-label="Edit max load"
                  title="Edit max load"
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
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  Settings
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-about">
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
        <section class="screen-panel settings-screen" aria-label="Settings screen">
          <header class="app-header">
            <img
              class="start-banner"
              src="/images/banner.png?v=20260401-2"
              alt="PumpBuddy banner"
            />
          </header>
          <h2 class="settings-title">Settings</h2>
          <dl class="settings-details" aria-label="Session user details">
            <div class="settings-detail-row">
              <dt class="settings-detail-key">User login</dt>
              <dd class="settings-detail-value">${escapeHtml(loginIdentity)}</dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Registration date</dt>
              <dd class="settings-detail-value">
                ${escapeHtml(registrationDate)}
              </dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Display name</dt>
              <dd class="settings-detail-value">
                ${displayNameFieldMarkup}
              </dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Favorite gym</dt>
              <dd class="settings-detail-value">
                ${favoriteGymFieldMarkup}
              </dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Max load</dt>
              <dd class="settings-detail-value">
                ${maxLoadFieldMarkup}
              </dd>
            </div>
            <div class="settings-detail-row">
              <dt class="settings-detail-key">Password</dt>
              <dd class="settings-detail-value">
                ${passwordFieldMarkup}
                ${passwordFeedbackMarkup}
              </dd>
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
