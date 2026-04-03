import type { AppState, StartScreenState, WorkoutPlan } from "./workout-types";
import { formatLoadWithUnitDisplay } from "./workout-load-display";
import { resolveCurrentSetPhase } from "./current-set-phase";
import { buildCompletedSetHistoryModel } from "./completed-set-history";

export const pbExerciseScreenTag = "pb-exercise-screen";

export type ExerciseScreenState = {
  plan: WorkoutPlan;
  exerciseIndex: number;
  startScreen: Pick<StartScreenState, "selectedWorkoutMode" | "selectedGymId" | "gyms">;
  confirmDialog: AppState["confirmDialog"];
  activeWorkout: AppState["activeWorkout"];
  workoutSave: AppState["workoutSave"];
  uiFeedback: AppState["uiFeedback"];
};

type UiAction =
  | "decrement-load"
  | "increment-load"
  | "decrement-reps"
  | "increment-reps"
  | "next-set"
  | "previous-exercise"
  | "next-exercise"
  | "finish-workout"
  | "cancel-workout"
  | "confirm-dialog-dismiss"
  | "confirm-dialog-confirm"
  | "confirm-fallback-option"
  | "jump-to-current-exercise";

type InputAction =
  | "load-input"
  | "reps-input"
  | "secs-minutes-input"
  | "secs-seconds-input"
  | "switch-fallback-option";

const formatSecondsToMinutesSeconds = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const splitSecondsForSpinner = (totalSeconds: number): { minutes: number; seconds: number } => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  return {
    minutes: Math.floor(normalized / 60),
    seconds: normalized % 60,
  };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const fallbackOptionKey = (optionId: string, stationId: string | null): string =>
  `${optionId}::${stationId ?? ""}`;

const findSelectedItem = <T extends { id: string }>(items: T[], selectedId: string): T | null =>
  items.find((item) => item.id === selectedId) ?? null;

const renderCompletedSetHistory = (exerciseStep: WorkoutPlan["exercises"][number]): string => {
  const historyModel = buildCompletedSetHistoryModel(exerciseStep.completedSets, exerciseStep.setTrackingMode);

  return `
  <section
    class="completed-set-list"
    aria-label="Completed set history"
    data-history-state="${historyModel.rows.length > 0 ? "populated" : "empty"}"
  >
    <h4 class="set-list-subtitle">History</h4>
    <div class="completed-set-header completed-set-grid--${historyModel.mode}" aria-hidden="true">
      ${historyModel.headerCells.map((cell) => `<span class="completed-set-header-cell">${cell}</span>`).join("")}
    </div>
    ${
      historyModel.rows.length > 0
        ? `<ol class="completed-set-rows">
        ${historyModel.rows
          .map(
            (row) => `<li class="completed-set-row completed-set-grid--${historyModel.mode}" aria-label="${row.ariaLabel}">
            ${row.cells
              .map(
                (cell, index) =>
                  `<span class="completed-set-cell${index === 0 ? " completed-set-cell-index" : ""}">${cell}</span>`,
              )
              .join("")}
          </li>`,
          )
          .join("")}
      </ol>`
        : `<p class="completed-set-empty" role="status">No completed sets yet.</p>`
    }
  </section>
`;
};

const renderFallbackSelector = (
  fallbackOptions: WorkoutPlan["exercises"][number]["fallbackOptions"],
  selectedOptionId: string | null,
  selectedStationId: string | null,
  isSelectionConfirmed: boolean,
  controlsDisabled: string,
  isLockedAfterSetCompletion: boolean,
): string => {
  if (fallbackOptions.length === 0 || isSelectionConfirmed) {
    return "";
  }

  const hasSelectedOption = fallbackOptions.some(
    (option) => option.id === selectedOptionId && option.station_id === selectedStationId,
  );

  const selectorDisabled = controlsDisabled || isLockedAfterSetCompletion ? "disabled" : "";
  const confirmDisabled =
    controlsDisabled || isLockedAfterSetCompletion || !hasSelectedOption ? "disabled" : "";

  return `
    <section class="fallback-option-panel" aria-label="Fallback exercise option">
      <div class="fallback-option-controls">
        <select
          id="fallback-option-select"
          class="start-select"
          data-input-action="switch-fallback-option"
          ${selectorDisabled}
        >
          ${fallbackOptions
            .map(
              (option) =>
                `<option value="${escapeHtml(fallbackOptionKey(option.id, option.station_id))}" ${
                  option.id === selectedOptionId && option.station_id === selectedStationId
                    ? "selected"
                    : ""
                }>${escapeHtml(`${option.variant_name} at ${option.station_name}`)}</option>`,
            )
            .join("")}
        </select>
        <button
          type="button"
          class="nav-button nav-button-primary fallback-option-select-button"
          data-ui-action="confirm-fallback-option"
          ${confirmDisabled}
        >
          Select
        </button>
      </div>
      ${
        isLockedAfterSetCompletion
          ? '<p class="fallback-option-copy">Locked after the first completed set.</p>'
          : ""
      }
    </section>
  `;
};

const renderEditableSetField = (
  fieldKey: "load" | "reps",
  label: string,
  inputId: string,
  inputAction: "load-input" | "reps-input",
  decrementAction: "decrement-load" | "decrement-reps",
  incrementAction: "increment-load" | "increment-reps",
  value: string,
  ariaLabel: string,
  controlsDisabled: string,
  inputFeedbackClass: string,
): string => `
  <div class="set-row-field set-row-field-editable set-row-field-${fieldKey}">
    <label class="set-row-field-label" for="${inputId}">${label}</label>
    <div class="weight-controls weight-controls-${fieldKey}" aria-label="${label} controls">
      <button type="button" class="weight-button" data-ui-action="${decrementAction}" ${controlsDisabled}>-</button>
      <input
        id="${inputId}"
        class="weight-input weight-input-${fieldKey}${inputFeedbackClass}"
        data-input-action="${inputAction}"
        inputmode="numeric"
        pattern="[0-9]*"
        value="${escapeHtml(value)}"
        aria-label="${escapeHtml(ariaLabel)}"
        ${controlsDisabled}
      />
      <button type="button" class="weight-button" data-ui-action="${incrementAction}" ${controlsDisabled}>+</button>
    </div>
  </div>
`;

const renderReadOnlySetField = (label: string, value: string): string => `
  <div class="set-row-field">
    <span class="set-row-field-label">${label}</span>
    <span class="set-row-field-value">${value}</span>
  </div>
`;

const renderSecsSetField = (
  totalSeconds: number,
  controlsDisabled: string,
  isRunning: boolean,
): string => {
  const spinner = splitSecondsForSpinner(totalSeconds);

  return `
  <div class="set-row-field set-row-field-editable set-row-field-secs">
    <span class="set-row-field-label">Time</span>
    <span class="set-row-field-value set-row-field-value-secs">${formatSecondsToMinutesSeconds(totalSeconds)}</span>
    <div class="secs-spinner" aria-label="Timed set controls">
      <label class="secs-spinner-part">
        <span class="secs-spinner-label">Min</span>
        <input
          id="exercise-secs-minutes"
          class="weight-input secs-spinner-input"
          data-input-action="secs-minutes-input"
          type="number"
          min="0"
          max="59"
          step="1"
          value="${spinner.minutes}"
          aria-label="Minutes"
          ${controlsDisabled}
        />
      </label>
      <label class="secs-spinner-part">
        <span class="secs-spinner-label">Sec</span>
        <input
          id="exercise-secs-seconds"
          class="weight-input secs-spinner-input"
          data-input-action="secs-seconds-input"
          type="number"
          min="0"
          max="59"
          step="1"
          value="${spinner.seconds}"
          aria-label="Seconds"
          ${controlsDisabled}
        />
      </label>
    </div>
    <div class="secs-controls" aria-label="Timer controls">
      <button type="button" class="weight-button secs-control-button" data-ui-action="decrement-reps" ${controlsDisabled}>Reset</button>
      <button type="button" class="weight-button secs-control-button" data-ui-action="increment-reps" ${controlsDisabled}>${isRunning ? "Pause" : "Play"}</button>
    </div>
  </div>
`;
};

const renderSetRow = (
  setIndex: number,
  fields: { loadValue: number | null; reps: number },
  inputFields: { loadValue: string; reps: string },
  controlsDisabled: string,
  editable: boolean,
  showLoadField: boolean,
  loadLabel: string,
  inputFeedbackClasses: { load: string; reps: string },
  repetitionKind: "REPS" | "SECS",
  isSecsTimerRunning: boolean,
): string => `
  <li class="set-row ${editable ? "set-row-editable" : "set-row-readonly"}">
    ${editable ? "" : `<span class="set-row-index">Set ${setIndex}</span>`}
    <div class="set-row-fields">
      ${
        showLoadField && editable
          ? renderEditableSetField(
              "load",
              loadLabel,
              "exercise-load",
              "load-input",
              "decrement-load",
              "increment-load",
              inputFields.loadValue,
              loadLabel === "Load per Side"
                ? "Exercise load per side in kilograms"
                : "Exercise load in kilograms",
              controlsDisabled,
              inputFeedbackClasses.load,
            )
          : showLoadField
            ? renderReadOnlySetField(loadLabel, formatLoadWithUnitDisplay(fields.loadValue))
            : ""
      }
      ${
        editable && repetitionKind === "REPS"
          ? renderEditableSetField(
              "reps",
              "Reps",
              "exercise-reps",
              "reps-input",
              "decrement-reps",
              "increment-reps",
              inputFields.reps,
              "Exercise reps",
              controlsDisabled,
              inputFeedbackClasses.reps,
            )
          : editable
            ? renderSecsSetField(fields.reps, controlsDisabled, isSecsTimerRunning)
          : renderReadOnlySetField(
              repetitionKind === "SECS" ? "Time" : "Reps",
              repetitionKind === "SECS" ? formatSecondsToMinutesSeconds(fields.reps) : String(fields.reps),
            )
      }
    </div>
  </li>
`;

class PbExerciseScreenElement extends HTMLElement {
  #state: ExerciseScreenState | null = null;

  #captureInputSelection(): () => void {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement) || !this.contains(active) || !active.id) {
      return () => {};
    }

    const { id, selectionStart, selectionEnd } = active;
    return () => {
      const next = this.querySelector<HTMLInputElement>(`#${id}`);
      if (!next) {
        return;
      }
      next.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        next.setSelectionRange(selectionStart, selectionEnd);
      }
    };
  }

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("change", this.#onChange);
    this.addEventListener("input", this.#onInput);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("input", this.#onInput);
  }

  set state(value: ExerciseScreenState | null) {
    this.#state = value;
    this.#render();
  }

  get state(): ExerciseScreenState | null {
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

  #emitInputAction(action: InputAction, value: string): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-input", {
        bubbles: true,
        composed: true,
        detail: { action, value },
      }),
    );
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    this.#emitUiAction(action);
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const action = target.dataset.inputAction as InputAction | undefined;
    if (!action) {
      return;
    }

    this.#emitInputAction(action, target.value);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const action = target.dataset.inputAction as InputAction | undefined;
    if (!action) {
      return;
    }

    this.#emitInputAction(action, target.value);
  };

  #render(): void {
    const state = this.#state;
    if (!state) {
      this.innerHTML = "";
      return;
    }

    const { plan, exerciseIndex, startScreen, confirmDialog, activeWorkout, workoutSave, uiFeedback } = state;
    const exerciseStep = plan.exercises[exerciseIndex];
    if (!exerciseStep) {
      this.innerHTML = "";
      return;
    }

    const stepNumber = exerciseIndex + 1;
    const totalSteps = plan.exercises.length;
    const isLastStep = exerciseIndex === totalSteps - 1;
    const isFirstStep = exerciseIndex === 0;
    const isReadMode = exerciseStep.isReadOnly;
    const controlsDisabled = workoutSave.isSaving ? "disabled" : "";
    const previousExerciseDisabled = isFirstStep || workoutSave.isSaving ? "disabled" : "";
    const completeSetDisabled = workoutSave.isSaving || isReadMode ? "disabled" : "";
    const setListFeedbackClass = uiFeedback.completedSetPulseToken > 0 ? " set-list-feedback-complete" : "";
    const loadInputFeedbackClass = uiFeedback.loadTickToken > 0 ? " input-feedback-tick" : "";
    const repsInputFeedbackClass = uiFeedback.repsTickToken > 0 ? " input-feedback-tick" : "";
    const selectedGym = findSelectedItem(startScreen.gyms, startScreen.selectedGymId);
    const selectedFallbackOption =
      exerciseStep.fallbackOptions.find(
        (option) =>
          option.id === exerciseStep.selectedPlanExerciseOptionId &&
          option.station_id === exerciseStep.selectedStationId,
      ) ??
      exerciseStep.fallbackOptions.find((option) => option.id === exerciseStep.selectedPlanExerciseOptionId) ??
      null;
    const isConfiguredGymMode = startScreen.selectedWorkoutMode === "configured-gym";
    const requiresFallbackConfirmation =
      isConfiguredGymMode &&
      exerciseStep.fallbackOptions.length > 1 &&
      !exerciseStep.isFallbackOptionConfirmed;
    const selectedGymName = isConfiguredGymMode ? selectedGym?.name ?? "Configured Gym" : null;
    const workoutContextLine = selectedGymName ? `${plan.name} at ${selectedGymName}` : plan.name;
    const planAndPositionLine = `${workoutContextLine} · ${stepNumber}/${totalSteps}`;
    const canRenderSetControls = !requiresFallbackConfirmation;
    const repetitionKind = exerciseStep.repetitionKind ?? "REPS";
    const isSecsTimerRunning = exerciseStep.isSecsTimerRunning ?? false;
    const currentSetPhase = resolveCurrentSetPhase({
      completedSetsCount: exerciseStep.completedSets.length,
      setTrackingMode: exerciseStep.setTrackingMode,
      currentSetIndex: exerciseStep.currentSetIndex,
      currentSetSide: exerciseStep.currentSetSide,
    });
    const loadLabel = exerciseStep.loadInputMode === "PER_SIDE" ? "Load per Side" : "Load";
    const isStationlessSelection =
      exerciseStep.selectedPlanExerciseOptionId !== null && exerciseStep.selectedStationId === null;
    const canCancelWorkout =
      activeWorkout.id !== null &&
      activeWorkout.persistedExerciseCount > 0 &&
      !workoutSave.isSaving &&
      !isReadMode;
    const currentExerciseIndex = plan.exercises.findIndex((exercise) => !exercise.isReadOnly);
    const jumpToCurrentExerciseDisabled =
      workoutSave.isSaving ||
      currentExerciseIndex < 0 ||
      currentExerciseIndex === exerciseIndex
        ? "disabled"
        : "";
    const completedSetHistory = renderCompletedSetHistory(exerciseStep);
    const restoreInputSelection = this.#captureInputSelection();

    this.innerHTML = `
      <section class="screen-panel exercise-step" aria-live="polite" aria-label="Workout exercise step">
        <div class="exercise-step-header">
          <h2 class="exercise-name">${escapeHtml(exerciseStep.name)}</h2>
          ${
            isConfiguredGymMode && exerciseStep.isFallbackOptionConfirmed && selectedFallbackOption
              ? `<p class="exercise-variant-label">${escapeHtml(selectedFallbackOption.variant_name)}</p>`
              : ""
          }
          <p class="plan-label">${escapeHtml(planAndPositionLine)}</p>
        </div>

        ${isReadMode ? '<p class="exercise-read-mode-indicator">Viewing previous exercise</p>' : ""}

        ${renderFallbackSelector(
          exerciseStep.fallbackOptions,
          exerciseStep.selectedPlanExerciseOptionId,
          exerciseStep.selectedStationId,
          exerciseStep.isFallbackOptionConfirmed,
          controlsDisabled,
          exerciseStep.completedSets.length > 0,
        )}

        <div class="exercise-step-status" aria-live="polite">
          ${
            workoutSave.errorMessage
              ? `<p class="save-error" role="alert">${escapeHtml(workoutSave.errorMessage)}</p>`
              : ""
          }
          ${
            workoutSave.isSaving
              ? '<p class="save-status" role="status">Saving workout progress...</p>'
              : ""
          }
        </div>

        ${
          canRenderSetControls
            ? isReadMode
              ? `<section class="set-list read-mode-set-list${setListFeedbackClass}" aria-label="Exercise sets">
                  ${completedSetHistory}
                </section>`
              : `<section class="set-list${setListFeedbackClass}" aria-label="Exercise sets">
                  <div class="set-list-heading">
                    <h3 class="set-list-title">${currentSetPhase.headingLabel}</h3>
                    <p class="set-counter">Set ${currentSetPhase.setIndex}</p>
                  </div>
                  <ol class="set-rows">
                    ${renderSetRow(
                      currentSetPhase.setIndex,
                      exerciseStep.activeSet,
                      exerciseStep.activeSetInput,
                      controlsDisabled,
                      !isReadMode,
                      !isStationlessSelection,
                      loadLabel,
                      {
                        load: loadInputFeedbackClass,
                        reps: repsInputFeedbackClass,
                      },
                      repetitionKind,
                      isSecsTimerRunning,
                    )}
                  </ol>
                  <button
                    type="button"
                    class="nav-button nav-button-primary action-button action-button-primary"
                    data-ui-action="next-set"
                    ${completeSetDisabled}
                  >
                    ${workoutSave.isSaving ? "Saving..." : currentSetPhase.actionLabel}
                  </button>
                  ${completedSetHistory}
                </section>`
            : ""
        }

        ${
          isReadMode
            ? `<div class="step-actions-read-primary">
                <button
                  type="button"
                  class="nav-button nav-button-primary action-button action-button-primary"
                  data-ui-action="jump-to-current-exercise"
                  ${jumpToCurrentExerciseDisabled}
                >
                  Jump to Current Exercise
                </button>
              </div>`
            : ""
        }

        <div class="step-actions">
          <div class="step-actions-secondary">
            <button
              type="button"
              class="nav-button nav-button-secondary action-button action-button-secondary"
              data-ui-action="previous-exercise"
              ${previousExerciseDisabled}
            >
              Previous
            </button>
            ${
              isLastStep
                ? `<button
                    type="button"
                    class="nav-button nav-button-secondary action-button action-button-secondary"
                    data-ui-action="finish-workout"
                    ${controlsDisabled}
                  >
                    ${workoutSave.isSaving ? "Saving..." : "Finish Workout"}
                  </button>`
                : !requiresFallbackConfirmation
                  ? `<button
                      type="button"
                      class="nav-button nav-button-secondary action-button action-button-secondary"
                      data-ui-action="next-exercise"
                      ${controlsDisabled}
                    >
                      ${workoutSave.isSaving ? "Saving..." : "Next"}
                    </button>`
                  : ""
            }
          </div>
        </div>

        ${
          canCancelWorkout
            ? `<div class="step-actions-tertiary">
                <button
                  type="button"
                  class="nav-button nav-button-tertiary action-button action-button-tertiary cancel-button"
                  data-ui-action="cancel-workout"
                >
                  Cancel Workout
                </button>
              </div>`
            : ""
        }

        ${
          confirmDialog.message
            ? `
              <div class="confirm-dialog-layer" role="presentation">
                <div class="confirm-dialog-backdrop" role="presentation"></div>
                <section
                  class="confirm-dialog"
                  role="alertdialog"
                  aria-modal="true"
                  aria-label="Confirmation dialog"
                >
                  <p class="confirm-dialog-message">${escapeHtml(confirmDialog.message)}</p>
                  <div class="confirm-dialog-actions">
                    <button
                      type="button"
                      class="nav-button nav-button-secondary"
                      data-ui-action="confirm-dialog-dismiss"
                      ${controlsDisabled}
                    >
                      Keep Editing
                    </button>
                    <button
                      type="button"
                      class="nav-button nav-button-primary"
                      data-ui-action="confirm-dialog-confirm"
                      ${controlsDisabled}
                    >
                      ${escapeHtml(confirmDialog.confirmActionLabel ?? "Confirm")}
                    </button>
                  </div>
                </section>
              </div>
            `
            : ""
        }
      </section>
    `;
    restoreInputSelection();
  }
}

export const registerPbExerciseScreen = (): void => {
  if (!customElements.get(pbExerciseScreenTag)) {
    customElements.define(pbExerciseScreenTag, PbExerciseScreenElement);
  }
};
