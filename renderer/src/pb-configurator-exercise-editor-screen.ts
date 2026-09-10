import type {
  ExerciseCreateRequest,
  ExerciseSummary,
  ExerciseUpdateRequest,
  ConfiguratorExerciseVariant,
} from "./workout-contract";
import { TextInputBinding } from "./text-input-binding";

export const pbConfiguratorExerciseEditorScreenTag =
  "pb-configurator-exercise-editor-screen";

export type ConfiguratorExerciseEditorScreenState = {
  mode: "create" | "edit";
  exercises: ExerciseSummary[];
  detail: ExerciseSummary | null;
  isLoading: boolean;
  errorMessage: string | null;
  variants: ConfiguratorExerciseVariant[];
};

type SaveResult = { ok: boolean; errorMessage?: string };
type SaveDetail = {
  action: "save-configurator-exercise";
  payload: {
    mode: "create" | "edit";
    exerciseId: string | null;
    request: ExerciseCreateRequest | ExerciseUpdateRequest;
  };
  respond: (result: SaveResult) => void;
};
type DeleteDetail = {
  action: "delete-configurator-exercise";
  payload: { exerciseId: string };
  respond: (result: SaveResult) => void;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const normalizeName = (value: string): string =>
  value.trim().toLocaleLowerCase("en-US");
const statusLabel = (status: ExerciseSummary["status"]): string =>
  status === "new" ? "Draft" : status === "active" ? "Active" : "Inactive";

class PbConfiguratorExerciseEditorScreenElement extends HTMLElement {
  #state: ConfiguratorExerciseEditorScreenState = {
    mode: "create",
    exercises: [],
    detail: null,
    isLoading: false,
    errorMessage: null,
    variants: [],
  };
  #loadedKey: string | null = null;
  #nameDraft = "";
  #submitError: string | null = null;
  #isSaving = false;
  #isDeleting = false;
  #renameWarningOpen = false;
  #deleteWarningOpen = false;
  #touched = false;
  #textInput = new TextInputBinding(this, ({ field, value }) => this.#onTextInput(field, value));

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.#textInput.connect();
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.#textInput.disconnect();
  }

  set state(value: ConfiguratorExerciseEditorScreenState) {
    this.#state = value;
    const key =
      value.mode === "create"
        ? "create"
        : value.detail
          ? `edit:${value.detail.id}`
          : "edit:loading";
    if (key !== this.#loadedKey && (value.mode === "create" || value.detail)) {
      this.#loadedKey = key;
      this.#nameDraft = value.detail?.name ?? "";
      this.#submitError = null;
      this.#isSaving = false;
      this.#isDeleting = false;
      this.#renameWarningOpen = false;
      this.#deleteWarningOpen = false;
      this.#touched = false;
    }
    this.#render();
  }

  get state(): ConfiguratorExerciseEditorScreenState {
    return this.#state;
  }

  #nameError(): string | null {
    const name = this.#nameDraft.trim();
    if (!name) return "Name is required.";
    const currentId = this.#state.detail?.id;
    return this.#state.exercises.some(
      (exercise) =>
        exercise.id !== currentId && normalizeName(exercise.name) === normalizeName(name),
    )
      ? "Name must be unique."
      : null;
  }

  #isHistorical(): boolean {
    return (
      this.#state.detail?.status === "active" ||
      this.#state.detail?.status === "inactive"
    );
  }

  #hasChanges(): boolean {
    return (
      this.#state.mode === "create" ||
      normalizeName(this.#nameDraft) !==
        normalizeName(this.#state.detail?.name ?? "")
    );
  }

  #emit(action: string): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action },
      }),
    );
  }

  #onTextInput = (field: string, value: string): void => {
    if (field !== "name") return;
    this.#nameDraft = value;
    this.#touched = true;
    this.#submitError = null;
    const error = this.#nameError();
    const fieldElement = this.querySelector('[data-field="name"]')?.closest(".configurator-gym-field");
    fieldElement?.querySelector(".configurator-gym-field-error")?.remove();
    if (error && fieldElement) { const message = document.createElement("span"); message.className = "configurator-gym-field-error"; message.textContent = error; fieldElement.append(message); }
    const saveButton = this.querySelector<HTMLButtonElement>('[data-ui-action="save-configurator-exercise"]');
    if (saveButton) saveButton.disabled = this.#isSaving || this.#isDeleting || !!error;
  };

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>("[data-ui-action]")?.dataset.uiAction;
    if (!action) return;

    if (action === "navigate-back-from-configurator-exercise-detail") {
      this.#emit(action);
      return;
    }
    if (action === "start-configurator-exercise-variant-create") {
      if (this.#state.detail) this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { exerciseId: this.#state.detail.id } } }));
      return;
    }
    if (action === "open-configurator-exercise-variant-detail") {
      const variantId = target.closest<HTMLElement>("[data-variant-id]")?.dataset.variantId;
      if (this.#state.detail && variantId) this.dispatchEvent(new CustomEvent("pb-ui-action", { bubbles: true, composed: true, detail: { action, payload: { exerciseId: this.#state.detail.id, variantId } } }));
      return;
    }
    if (action === "dismiss-historical-rename-warning") {
      this.#renameWarningOpen = false;
      this.#render();
      return;
    }
    if (action === "dismiss-delete-exercise-warning") {
      this.#deleteWarningOpen = false;
      this.#render();
      return;
    }
    if (action === "save-configurator-exercise") {
      const error = this.#nameError();
      if (error) {
        this.#touched = true;
        this.#submitError = error;
        this.#render();
        return;
      }
      if (this.#isHistorical() && this.#hasChanges() && !this.#renameWarningOpen) {
        this.#renameWarningOpen = true;
        this.#render();
        return;
      }
      if (this.#isSaving || this.#isDeleting) return;
      this.#isSaving = true;
      this.#renameWarningOpen = false;
      this.#submitError = null;
      this.#render();
      this.dispatchEvent(
        new CustomEvent<SaveDetail>("pb-ui-action", {
          bubbles: true,
          composed: true,
          detail: {
            action,
            payload: {
              mode: this.#state.mode,
              exerciseId: this.#state.detail?.id ?? null,
              request: { name: this.#nameDraft.trim() },
            },
            respond: (result) => {
              this.#isSaving = false;
              this.#submitError = result.ok ? null : result.errorMessage ?? null;
              this.#render();
            },
          },
        }),
      );
      return;
    }
    if (action === "delete-configurator-exercise") {
      const exercise = this.#state.detail;
      if (!exercise || exercise.status !== "new" || this.#isSaving || this.#isDeleting) return;
      if ((this.#state.variants ?? []).length > 0 && !this.#deleteWarningOpen) {
        this.#deleteWarningOpen = true;
        this.#render();
        return;
      }
      this.#isDeleting = true;
      this.#submitError = null;
      this.#render();
      this.dispatchEvent(
        new CustomEvent<DeleteDetail>("pb-ui-action", {
          bubbles: true,
          composed: true,
          detail: {
            action,
            payload: { exerciseId: exercise.id },
            respond: (result) => {
              this.#isDeleting = false;
              this.#submitError = result.ok ? null : result.errorMessage ?? null;
              this.#render();
            },
          },
        }),
      );
    }
  };

  #render(): void {
    const detail = this.#state.detail;
    const isCreate = this.#state.mode === "create";
    const error = this.#nameError();
    const disabled =
      this.#isSaving ||
      this.#isDeleting ||
      !!error ||
      (!isCreate && !this.#hasChanges());
    const body = this.#state.isLoading
      ? '<p class="start-status" role="status">Loading exercise detail...</p>'
      : this.#state.errorMessage
        ? `<p class="start-error" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`
        : !isCreate && !detail
          ? '<p class="start-error" role="alert">Unable to find that Exercise right now.</p>'
          : (() => { const variants = this.#state.variants ?? []; return `<div class="configurator-gym-editor-card"><label class="configurator-gym-field"><span class="configurator-gym-field-label">Name</span><input class="configurator-gym-input" data-field="name" value="${escapeHtml(this.#nameDraft)}" ${this.#isSaving || this.#isDeleting ? "disabled" : ""} />${error && this.#touched ? `<span class="configurator-gym-field-error">${escapeHtml(error)}</span>` : ""}</label>${detail ? `<dl class="configurator-load-profile-metadata"><div><dt>Status</dt><dd>${statusLabel(detail.status)}</dd></div><div><dt>Variants</dt><dd>${detail.variant_count === 1 ? "1 variant" : `${detail.variant_count} variants`}</dd></div></dl><section class="configurator-exercise-variants" aria-label="Variants"><div class="configurator-gym-editor-actions"><button type="button" class="nav-button" data-ui-action="start-configurator-exercise-variant-create">+ New Variant</button></div>${variants.length ? `<div class="configurator-exercise-list">${variants.map((variant) => `<button type="button" class="configurator-exercise-card configurator-exercise-card--${variant.status}" data-ui-action="open-configurator-exercise-variant-detail" data-variant-id="${escapeHtml(variant.id)}"><span class="configurator-exercise-card-topline"><span class="configurator-exercise-name">${escapeHtml(variant.name)}</span><span class="configurator-exercise-status configurator-exercise-status--${variant.status}">${statusLabel(variant.status)}</span></span><span class="configurator-exercise-card-metadata">${variant.requires_station ? "Station required" : "Stationless"} · ${variant.repetition_kind === "REPS" ? "Reps" : "Seconds"}</span></button>`).join("")}</div>` : '<p class="start-copy">No Variants yet.</p>'}</section>` : ""}${this.#submitError ? `<p class="start-error" role="alert">${escapeHtml(this.#submitError)}</p>` : ""}<div class="configurator-gym-editor-actions"><button type="button" class="configurator-gym-save-button" data-ui-action="save-configurator-exercise" ${disabled ? "disabled" : ""}>${this.#isSaving ? "Saving..." : isCreate ? "Create Exercise" : "Save Name"}</button>${detail?.status === "new" ? `<button type="button" class="configurator-gym-delete-button" data-ui-action="delete-configurator-exercise" ${this.#isDeleting ? "disabled" : ""}>${this.#isDeleting ? "Deleting..." : "Delete Draft"}</button>` : ""}</div></div>`; })();
    const warning = this.#renameWarningOpen
      ? `<div class="confirm-dialog-layer" role="presentation"><div class="confirm-dialog-backdrop" role="presentation"></div><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="Historical rename warning"><p class="confirm-dialog-message">Renaming an active or inactive Exercise can affect how historical workouts are understood. Save this name change?</p><div class="confirm-dialog-actions"><button type="button" class="nav-button" data-ui-action="dismiss-historical-rename-warning">Keep Editing</button><button type="button" class="nav-button" data-ui-action="save-configurator-exercise">Save Name</button></div></section></div>`
      : this.#deleteWarningOpen
        ? `<div class="confirm-dialog-layer" role="presentation"><div class="confirm-dialog-backdrop" role="presentation"></div><section class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-exercise-warning-title"><h2 class="confirm-dialog-title" id="delete-exercise-warning-title">Delete draft exercise?</h2><p class="confirm-dialog-message">This will also delete ${(this.#state.variants ?? []).length} ${(this.#state.variants ?? []).length === 1 ? "variant" : "variants"}.</p><div class="confirm-dialog-actions"><button type="button" class="nav-button" data-ui-action="dismiss-delete-exercise-warning">Cancel</button><button type="button" class="nav-button" data-ui-action="delete-configurator-exercise">Delete</button></div></section></div>`
        : "";
    this.innerHTML = `<div class="app-screen-shell"><button type="button" class="side-menu-toggle detail-back-button" data-ui-action="navigate-back-from-configurator-exercise-detail" aria-label="Back"><span aria-hidden="true">←</span></button><section class="screen-panel configurator-gym-editor-screen" aria-label="Exercise editor"><header class="exercise-variant-detail-header configurator-app-header"><img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" /><h1 class="exercise-variant-detail-header-title">${isCreate ? "New Exercise" : "Exercise"}</h1></header>${body}</section>${warning}</div>`;
  }
}

export const registerPbConfiguratorExerciseEditorScreen = (): void => {
  if (
    typeof customElements !== "undefined" &&
    !customElements.get(pbConfiguratorExerciseEditorScreenTag)
  ) {
    customElements.define(
      pbConfiguratorExerciseEditorScreenTag,
      PbConfiguratorExerciseEditorScreenElement,
    );
  }
};

registerPbConfiguratorExerciseEditorScreen();
