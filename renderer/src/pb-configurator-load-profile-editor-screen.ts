import "./pb-side-menu";
import type {
  LoadProfileCreateRequest,
  LoadProfileDetailResponse,
  LoadProfileSummary,
  LoadProfileUpdateRequest,
} from "./workout-contract";

export const pbConfiguratorLoadProfileEditorScreenTag =
  "pb-configurator-load-profile-editor-screen";

export type ConfiguratorLoadProfileEditorScreenState = {
  mode: "create" | "edit";
  loadProfiles: LoadProfileSummary[];
  detail: LoadProfileDetailResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
};

type WeightUnit = "KG" | "LBS";
type DefinitionKind = "fixed_list" | "formula";
type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "navigate-workout"
  | "navigate-configurator-load-profiles"
  | "navigate-settings"
  | "navigate-about"
  | "logout"
  | "navigate-back-from-configurator-load-profile-detail";

type SaveResult = {
  ok: boolean;
  errorMessage?: string;
};

type SaveDetail = {
  action: "save-configurator-load-profile";
  payload: {
    mode: "create" | "edit";
    loadProfileId: string | null;
    request: LoadProfileCreateRequest | LoadProfileUpdateRequest;
  };
  respond: (result: SaveResult) => void;
};

type DeleteDetail = {
  action: "delete-configurator-load-profile";
  payload: {
    loadProfileId: string;
  };
  respond: (result: SaveResult) => void;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string =>
  escapeHtml(value).replaceAll("`", "&#96;");

const formatPreviewLoads = (values: number[]): string => {
  if (values.length === 0) {
    return "No preview loads yet.";
  }

  return values.map((value) => `${value} kg`).join(" · ");
};

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(count)))} ${
    Math.floor(count) === 1 ? singular : plural
  }`;

const formatLoadRange = (loads: number[]): string => {
  if (loads.length === 0) {
    return "No loads provided";
  }

  const sortedLoads = [...loads].sort((left, right) => left - right);
  const first = sortedLoads[0]!;
  const last = sortedLoads[sortedLoads.length - 1]!;
  if (first === last) {
    return `${first} kg`;
  }

  return `${first} kg - ${last} kg`;
};

const renderInspectLoadsIcon = (): string => `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M7.1 2.25a4.85 4.85 0 1 0 3.03 8.63l2.74 2.75 1.06-1.06-2.75-2.74A4.85 4.85 0 0 0 7.1 2.25Zm0 1.5a3.35 3.35 0 1 1 0 6.7 3.35 3.35 0 0 1 0-6.7Z"
      fill="currentColor"
    ></path>
  </svg>
`;

const parseNumericDraft = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseFixedListDraft = (
  value: string,
): { values: number[]; hasInvalidToken: boolean } => {
  const tokens = value
    .split(/[\n,]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return { values: [], hasInvalidToken: false };
  }

  const values: number[] = [];
  for (const token of tokens) {
    const parsed = Number.parseFloat(token);
    if (!Number.isFinite(parsed)) {
      return { values: [], hasInvalidToken: true };
    }
    values.push(parsed);
  }

  return { values, hasInvalidToken: false };
};

class PbConfiguratorLoadProfileEditorScreenElement extends HTMLElement {
  #state: ConfiguratorLoadProfileEditorScreenState = {
    mode: "create",
    loadProfiles: [],
    detail: null,
    isLoading: false,
    errorMessage: null,
  };

  #loadedKey: string | null = null;
  #nameDraft = "";
  #weightUnitDraft: WeightUnit = "KG";
  #definitionKindDraft: DefinitionKind = "fixed_list";
  #fixedListDraft = "";
  #formulaMinDraft = "";
  #formulaStepDraft = "";
  #submitError: string | null = null;
  #isSaving = false;
  #isDeleting = false;
  #previewPopupOpen = false;
  #renameWarningOpen = false;

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("input", this.#onInput);
    this.addEventListener("change", this.#onChange);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("change", this.#onChange);
  }

  set state(value: ConfiguratorLoadProfileEditorScreenState) {
    this.#state = value;
    const nextKey =
      value.mode === "create"
        ? "create"
        : value.detail
          ? `edit:${value.detail.id}`
          : "edit:loading";
    if (nextKey !== this.#loadedKey && (value.mode === "create" || value.detail)) {
      this.#loadedKey = nextKey;
      this.#submitError = null;
      this.#isSaving = false;
      this.#isDeleting = false;
      this.#previewPopupOpen = false;
      this.#renameWarningOpen = false;
      if (value.mode === "create") {
        this.#nameDraft = "";
        this.#weightUnitDraft = "KG";
        this.#definitionKindDraft = "fixed_list";
        this.#fixedListDraft = "";
        this.#formulaMinDraft = "";
        this.#formulaStepDraft = "";
      } else if (value.detail) {
        this.#nameDraft = value.detail.name;
        this.#weightUnitDraft = value.detail.weight_unit;
        this.#definitionKindDraft = value.detail.definition.kind;
        this.#fixedListDraft = (value.detail.definition.values ?? []).join("\n");
        this.#formulaMinDraft =
          value.detail.definition.min === undefined
            ? ""
            : String(value.detail.definition.min);
        this.#formulaStepDraft =
          value.detail.definition.step === undefined
            ? ""
            : String(value.detail.definition.step);
      }
    }
    this.#render();
  }

  get state(): ConfiguratorLoadProfileEditorScreenState {
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

  #getNameError(): string | null {
    const trimmedName = this.#nameDraft.trim();
    if (trimmedName.length === 0) {
      return "Name is required.";
    }

    const normalizedName = trimmedName.toLocaleLowerCase("en-US");
    const currentId = this.#state.detail?.id ?? null;
    const duplicate = this.#state.loadProfiles.some(
      (profile) =>
        profile.id !== currentId &&
        profile.name.trim().toLocaleLowerCase("en-US") === normalizedName,
    );

    return duplicate ? "Name must be unique." : null;
  }

  #getDefinitionError(): string | null {
    if (this.#definitionKindDraft === "fixed_list") {
      const parsed = parseFixedListDraft(this.#fixedListDraft);
      if (parsed.hasInvalidToken) {
        return "Fixed list values must be numbers separated by commas or lines.";
      }
      if (parsed.values.length === 0) {
        return "Add at least one fixed value.";
      }
      return null;
    }

    const min = parseNumericDraft(this.#formulaMinDraft);
    const step = parseNumericDraft(this.#formulaStepDraft);
    if (min === null) {
      return "Formula minimum must be a number.";
    }
    if (step === null || step <= 0) {
      return "Formula step must be a positive number.";
    }
    return null;
  }

  #isDraftEditable(): boolean {
    return this.#state.mode === "create" || this.#state.detail?.status === "new";
  }

  #isHistoricalProfile(): boolean {
    return this.#state.detail?.status === "active" || this.#state.detail?.status === "inactive";
  }

  #hasHistoricalRenameChange(): boolean {
    if (!this.#isHistoricalProfile() || !this.#state.detail) {
      return false;
    }

    return this.#nameDraft.trim() !== this.#state.detail.name.trim();
  }

  #buildRequest(): LoadProfileCreateRequest | LoadProfileUpdateRequest | null {
    const nameError = this.#getNameError();
    const definitionError = this.#getDefinitionError();
    if (nameError || definitionError) {
      return null;
    }

    const definition =
      this.#definitionKindDraft === "fixed_list"
        ? {
            kind: "fixed_list" as const,
            values: parseFixedListDraft(this.#fixedListDraft).values,
          }
        : {
            kind: "formula" as const,
            min: parseNumericDraft(this.#formulaMinDraft) ?? undefined,
            step: parseNumericDraft(this.#formulaStepDraft) ?? undefined,
          };

    if (this.#state.mode === "create") {
      return {
        name: this.#nameDraft.trim(),
        weight_unit: this.#weightUnitDraft,
        definition,
      };
    }

    return {
      name: this.#nameDraft.trim(),
      ...(this.#isDraftEditable()
        ? {
            weight_unit: this.#weightUnitDraft,
            definition,
          }
        : {}),
    };
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

    const action = actionElement.dataset.uiAction;
    if (action === "save-load-profile") {
      if (this.#isSaving || this.#isDeleting) {
        return;
      }
      const request = this.#buildRequest();
      if (!request) {
        this.#submitError = this.#getNameError() ?? this.#getDefinitionError();
        this.#render();
        return;
      }

      if (this.#isHistoricalProfile() && this.#hasHistoricalRenameChange() && !this.#renameWarningOpen) {
        this.#renameWarningOpen = true;
        this.#submitError = null;
        this.#render();
        return;
      }

      this.#isSaving = true;
      this.#renameWarningOpen = false;
      this.#submitError = null;
      this.#render();

      const saveEvent = new CustomEvent<SaveDetail>("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: {
          action: "save-configurator-load-profile",
          payload: {
            mode: this.#state.mode,
            loadProfileId: this.#state.detail?.id ?? null,
            request,
          },
          respond: (result) => {
            this.#isSaving = false;
            this.#submitError = result.ok ? null : result.errorMessage ?? null;
            this.#render();
          },
        },
      });
      this.dispatchEvent(saveEvent);
      return;
    }

    if (action === "delete-load-profile") {
      const loadProfileId = this.#state.detail?.id ?? null;
      if (!loadProfileId || this.#isSaving || this.#isDeleting) {
        return;
      }

      this.#isDeleting = true;
      this.#submitError = null;
      this.#render();

      const deleteEvent = new CustomEvent<DeleteDetail>("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: {
          action: "delete-configurator-load-profile",
          payload: { loadProfileId },
          respond: (result) => {
            this.#isDeleting = false;
            this.#submitError = result.ok ? null : result.errorMessage ?? null;
            this.#render();
          },
        },
      });
      this.dispatchEvent(deleteEvent);
      return;
    }

    if (action === "open-load-profile-preview") {
      if (!this.#state.detail || this.#state.detail.possible_loads_kg.length === 0) {
        return;
      }
      this.#previewPopupOpen = true;
      this.#render();
      return;
    }

    if (action === "dismiss-load-profile-preview") {
      this.#previewPopupOpen = false;
      this.#render();
      return;
    }

    if (action === "dismiss-historical-rename-warning") {
      this.#renameWarningOpen = false;
      this.#render();
      return;
    }

    if (action === "navigate-back-from-configurator-load-profile-detail") {
      this.#emitUiAction(action);
      return;
    }

    this.#emitUiAction(action as UiAction);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const field = target.dataset.field;
    if (!field) {
      return;
    }

    if (field === "name") {
      this.#nameDraft = target.value;
    } else if (field === "fixed-list") {
      this.#fixedListDraft = target.value;
    } else if (field === "formula-min") {
      this.#formulaMinDraft = target.value;
    } else if (field === "formula-step") {
      this.#formulaStepDraft = target.value;
    } else {
      return;
    }

    this.#submitError = null;
    this.#render();
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const field = target.dataset.field;
    if (field === "weight-unit" && (target.value === "KG" || target.value === "LBS")) {
      this.#weightUnitDraft = target.value;
    }
    if (
      field === "definition-kind" &&
      (target.value === "fixed_list" || target.value === "formula")
    ) {
      this.#definitionKindDraft = target.value;
    }

    this.#submitError = null;
    this.#render();
  };

  #renderForm(): string {
    if (this.#state.isLoading) {
      return `<p class="start-status" role="status">Loading load profile detail...</p>`;
    }

    if (this.#state.errorMessage) {
      return `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`;
    }

    if (this.#state.mode === "edit" && !this.#state.detail) {
      return `<p class="start-error" role="alert">Unable to find that draft load profile right now.</p>`;
    }

    const nameError = this.#getNameError();
    const definitionError = this.#getDefinitionError();
    const isEditable = this.#isDraftEditable();
    const isHistoricalProfile = this.#isHistoricalProfile();
    const historicalRenameChanged = this.#hasHistoricalRenameChange();
    const saveDisabled =
      !!nameError ||
      !!definitionError ||
      this.#isSaving ||
      this.#isDeleting ||
      (isHistoricalProfile && !historicalRenameChanged);
    const canDelete = this.#state.mode === "edit" && this.#state.detail?.status === "new";

    return `
      <div class="configurator-load-profile-editor-card">
        ${
          !isEditable
            ? `
              <p class="configurator-load-profile-editor-note" role="note">
                ${
                  isHistoricalProfile
                    ? "This historical load profile keeps its definition and weight unit read-only. Only the name can change after a warning-confirmed save."
                    : "Only draft load profiles are editable in this flow right now."
                }
              </p>
            `
            : ""
        }
        <label class="configurator-load-profile-field">
          <span class="configurator-load-profile-field-label">Name</span>
          <input
            class="configurator-load-profile-input"
            data-field="name"
            value="${escapeHtml(this.#nameDraft)}"
            ${this.#isSaving || this.#isDeleting ? "disabled" : ""}
          />
          ${
            nameError
              ? `<span class="configurator-load-profile-field-error">${escapeHtml(nameError)}</span>`
              : ""
          }
        </label>

        <div class="configurator-load-profile-field-grid">
          <label class="configurator-load-profile-field">
            <span class="configurator-load-profile-field-label">Weight Unit</span>
            <select
              class="configurator-load-profile-select"
              data-field="weight-unit"
              ${!isEditable || this.#isSaving || this.#isDeleting ? "disabled" : ""}
            >
              <option value="KG" ${this.#weightUnitDraft === "KG" ? "selected" : ""}>KG</option>
              <option value="LBS" ${this.#weightUnitDraft === "LBS" ? "selected" : ""}>LBS</option>
            </select>
          </label>
          <label class="configurator-load-profile-field">
            <span class="configurator-load-profile-field-label">Definition</span>
            <select
              class="configurator-load-profile-select"
              data-field="definition-kind"
              ${!isEditable || this.#isSaving || this.#isDeleting ? "disabled" : ""}
            >
              <option value="fixed_list" ${this.#definitionKindDraft === "fixed_list" ? "selected" : ""}>Fixed list</option>
              <option value="formula" ${this.#definitionKindDraft === "formula" ? "selected" : ""}>Formula</option>
            </select>
          </label>
        </div>

        ${
          this.#definitionKindDraft === "fixed_list"
            ? `
              <label class="configurator-load-profile-field">
                <span class="configurator-load-profile-field-label">Fixed Values</span>
                <textarea
                  class="configurator-load-profile-textarea"
                  data-field="fixed-list"
                  placeholder="20&#10;25&#10;30"
                  ${!isEditable || this.#isSaving || this.#isDeleting ? "disabled" : ""}
                >${escapeHtml(this.#fixedListDraft)}</textarea>
              </label>
            `
            : `
              <div class="configurator-load-profile-field-grid">
                <label class="configurator-load-profile-field">
                  <span class="configurator-load-profile-field-label">Minimum</span>
                  <input
                    class="configurator-load-profile-input"
                    data-field="formula-min"
                    value="${escapeHtml(this.#formulaMinDraft)}"
                    ${!isEditable || this.#isSaving || this.#isDeleting ? "disabled" : ""}
                  />
                </label>
                <label class="configurator-load-profile-field">
                  <span class="configurator-load-profile-field-label">Step</span>
                  <input
                    class="configurator-load-profile-input"
                    data-field="formula-step"
                    value="${escapeHtml(this.#formulaStepDraft)}"
                    ${!isEditable || this.#isSaving || this.#isDeleting ? "disabled" : ""}
                  />
                </label>
              </div>
            `
        }

        ${
          definitionError
            ? `<p class="configurator-load-profile-field-error">${escapeHtml(definitionError)}</p>`
            : ""
        }

        ${
          this.#state.detail
            ? `
              <section class="configurator-load-profile-preview">
                <div class="station-load-profile-summary">
                  <div>
                    <dt>Preview</dt>
                    <dd>${escapeHtml(pluralize(this.#state.detail.possible_loads_kg.length, "possible load"))}</dd>
                  </div>
                  <div>
                    <dt>Range</dt>
                    <dd class="station-load-profile-range">
                      <span class="station-load-profile-range-text">${escapeHtml(
                        formatLoadRange(this.#state.detail.possible_loads_kg),
                      )}</span>
                      <button
                        type="button"
                        class="station-load-profile-inspect-button"
                        data-ui-action="open-load-profile-preview"
                        aria-label="Inspect preview loads"
                        ${this.#state.detail.possible_loads_kg.length > 0 ? "" : "disabled"}
                      >
                        <span class="station-load-profile-inspect-icon">${renderInspectLoadsIcon()}</span>
                      </button>
                    </dd>
                  </div>
                </div>
                <p class="configurator-load-profile-preview-values">${escapeHtml(
                  formatPreviewLoads(this.#state.detail.possible_loads_kg),
                )}</p>
              </section>
            `
            : ""
        }

        ${
          this.#submitError
            ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>`
            : ""
        }

        <div class="configurator-load-profile-editor-actions">
          <button
            type="button"
            class="configurator-load-profile-save-button"
            data-ui-action="save-load-profile"
            ${saveDisabled ? "disabled" : ""}
          >
            ${
              this.#isSaving
                ? "Saving..."
                : isHistoricalProfile
                  ? "Save Name"
                  : "Save Draft"
            }
          </button>
          ${
            canDelete
              ? `
                <button
                  type="button"
                  class="configurator-load-profile-delete-button"
                  data-ui-action="delete-load-profile"
                  ${this.#isDeleting ? "disabled" : ""}
                >
                  ${this.#isDeleting ? "Deleting..." : "Delete Draft"}
                </button>
              `
              : ""
          }
        </div>
      </div>
    `;
  }

  #renderPreviewPopup(): string {
    if (!this.#previewPopupOpen || !this.#state.detail) {
      return "";
    }

    const loads = this.#state.detail.possible_loads_kg;

    return `
      <div class="station-load-profile-dialog-layer">
        <div class="station-load-profile-dialog-backdrop" aria-hidden="true"></div>
        <section
          class="station-load-profile-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="configurator-load-profile-preview-title"
        >
          <header class="station-load-profile-dialog-header">
            <div>
              <h3 id="configurator-load-profile-preview-title" class="station-load-profile-dialog-title">${escapeHtml(this.#state.detail.name)}</h3>
              <p class="station-load-profile-dialog-subtitle">${escapeHtml(pluralize(loads.length, "possible load"))}</p>
            </div>
            <button
              type="button"
              class="station-load-profile-dialog-close"
              data-ui-action="dismiss-load-profile-preview"
              aria-label="Close load profile preview"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <ol class="station-load-profile-value-list" aria-label="Possible loads">
            ${loads
              .map(
                (loadValue) => `
                  <li class="station-load-profile-value">
                    <span>${escapeHtml(`${loadValue} kg`)}</span>
                  </li>
                `,
              )
              .join("")}
          </ol>
        </section>
      </div>
    `;
  }

  #renderHistoricalRenameWarning(): string {
    if (!this.#renameWarningOpen || !this.#isHistoricalProfile()) {
      return "";
    }

    return `
      <div class="confirm-dialog-layer" role="presentation">
        <div class="confirm-dialog-backdrop" role="presentation"></div>
        <section
          class="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-label="Historical rename warning"
        >
          <p class="confirm-dialog-message">
            Renaming an active or inactive load profile can affect how historical workouts are understood. Save this name change?
          </p>
          <div class="confirm-dialog-actions">
            <button
              type="button"
              class="nav-button"
              data-ui-action="dismiss-historical-rename-warning"
            >
              Keep Editing
            </button>
            <button
              type="button"
              class="nav-button"
              data-ui-action="save-load-profile"
            >
              Save Name
            </button>
          </div>
        </section>
      </div>
    `;
  }

  #render(): void {
    const title =
      this.#state.mode === "create"
        ? "New Load Profile"
        : this.#state.detail?.name ?? "Load Profile";

    this.innerHTML = `
      <div class="app-screen-shell">
        <pb-side-menu
          mode="configurator"
          active-screen="configurator-load-profiles"
          menu-id="configurator-load-profile-editor-side-menu"
        ></pb-side-menu>
        <section
          class="screen-panel configurator-load-profile-editor-screen"
          aria-label="Load profile editor"
        >
          <header class="app-header app-header-compact">
            <p class="app-kicker">Configurator</p>
            <h1 class="app-title">${escapeHtml(title)}</h1>
            <p class="start-copy">
              Build draft load profiles in a full-screen mobile flow with lightweight live validation
              and backend-owned persistence rules.
            </p>
          </header>
          <button
            type="button"
            class="configurator-load-profile-back-button"
            data-ui-action="navigate-back-from-configurator-load-profile-detail"
          >
            ‹ Back to Load Profiles
          </button>
          ${this.#renderForm()}
        </section>
        ${this.#renderPreviewPopup()}
        ${this.#renderHistoricalRenameWarning()}
      </div>
    `;
  }
}

export const registerPbConfiguratorLoadProfileEditorScreen = (): void => {
  if (
    typeof customElements !== "undefined" &&
    !customElements.get(pbConfiguratorLoadProfileEditorScreenTag)
  ) {
    customElements.define(
      pbConfiguratorLoadProfileEditorScreenTag,
      PbConfiguratorLoadProfileEditorScreenElement,
    );
  }
};

registerPbConfiguratorLoadProfileEditorScreen();
