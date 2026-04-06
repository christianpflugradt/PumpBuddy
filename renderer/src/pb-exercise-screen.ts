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
  | "delete-latest-set"
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
  | "secs-input"
  | "switch-fallback-option";

const formatSecondsToMinutesSeconds = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const splitSecondsForPicker = (totalSeconds: number): { minutes: number; seconds: number } => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  return {
    minutes: Math.floor(normalized / 60),
    seconds: normalized % 60,
  };
};

const secsPickerRowHeightPx = 40;

const resetIconSvg = `
  <svg class="secs-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 5a7 7 0 1 1-5.43 11.42"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="M6.5 4.5v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

const playIconSvg = `
  <svg class="secs-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 6.5v11l9-5.5z" fill="currentColor" />
  </svg>
`;

const pauseIconSvg = `
  <svg class="secs-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="7" y="6.5" width="3.5" height="11" rx="1" fill="currentColor" />
    <rect x="13.5" y="6.5" width="3.5" height="11" rx="1" fill="currentColor" />
  </svg>
`;

const deleteIconSvg = `
  <svg class="completed-set-delete-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 7l10 10M17 7L7 17"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const fallbackOptionKey = (optionId: string, stationId: string | null): string =>
  `${optionId}::${stationId ?? ""}`;

const countCompletedLogicalSets = (
  completedSets: WorkoutPlan["exercises"][number]["completedSets"],
  setTrackingMode: WorkoutPlan["exercises"][number]["setTrackingMode"],
): number => {
  if (setTrackingMode !== "UNILATERAL") {
    return completedSets.length;
  }

  const sidesByIndex = new Map<number, { hasLeft: boolean; hasRight: boolean }>();
  for (const set of completedSets) {
    const current = sidesByIndex.get(set.setIndex) ?? { hasLeft: false, hasRight: false };
    if (set.setSide === "RIGHT") {
      current.hasRight = true;
    } else {
      current.hasLeft = true;
    }
    sidesByIndex.set(set.setIndex, current);
  }

  return Array.from(sidesByIndex.values()).filter((entry) => entry.hasLeft && entry.hasRight).length;
};

const findSelectedItem = <T extends { id: string }>(items: T[], selectedId: string): T | null =>
  items.find((item) => item.id === selectedId) ?? null;

const renderCompletedSetHistory = (exerciseStep: WorkoutPlan["exercises"][number]): string => {
  const historyModel = buildCompletedSetHistoryModel(
    exerciseStep.completedSets,
    exerciseStep.setTrackingMode,
    exerciseStep.repetitionKind,
  );

  return `
  <section
    class="completed-set-list"
    aria-label="Completed set history"
    data-history-state="${historyModel.rows.length > 0 ? "populated" : "empty"}"
  >
    <h4 class="set-list-subtitle">History</h4>
    <div class="completed-set-header completed-set-grid--${historyModel.mode}" aria-hidden="true">
      ${historyModel.headerCells.map((cell) => `<span class="completed-set-header-cell">${cell}</span>`).join("")}
      <span class="completed-set-header-cell completed-set-header-cell-action" aria-hidden="true"></span>
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
            ${
              row.canDelete
                ? `<button type="button" class="completed-set-delete" data-ui-action="delete-latest-set" aria-label="Delete set ${row.setIndex}">${deleteIconSvg}</button>`
                : '<span class="completed-set-delete-placeholder" aria-hidden="true"></span>'
            }
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
  displayLabel: string,
  controlsLabel: string,
  inputId: string,
  inputAction: "load-input" | "reps-input",
  decrementAction: "decrement-load" | "decrement-reps",
  incrementAction: "increment-load" | "increment-reps",
  value: string,
  ariaLabel: string,
  controlsDisabled: string,
  inputFeedbackClass: string,
  guidanceLabel: string | null = null,
): string => `
  <div class="set-row-field set-row-field-editable set-row-field-${fieldKey}">
    <label class="set-row-field-label" for="${inputId}">${displayLabel}</label>
    ${
      guidanceLabel
        ? `<span class="set-row-field-label set-row-field-guidance">${escapeHtml(guidanceLabel)}</span>`
        : ""
    }
    <div class="weight-controls weight-controls-${fieldKey}" aria-label="${controlsLabel} controls">
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
  guidanceLabel: string | null,
): string => {
  const pickerDisabled = controlsDisabled || isRunning ? "disabled" : "";
  const label = guidanceLabel ?? "SECS";
  const labelClassName = guidanceLabel ? "set-row-field-label set-row-field-guidance" : "set-row-field-label";

  return `
  <div class="set-row-field set-row-field-editable set-row-field-secs">
    <span class="${labelClassName}">${label}</span>
    <div class="secs-control-row" aria-label="Timed set controls">
      <button
        type="button"
        class="weight-button secs-icon-button"
        data-ui-action="decrement-reps"
        aria-label="Reset timer"
        ${controlsDisabled}
      >
        ${resetIconSvg}
      </button>
      <button
        type="button"
        id="exercise-secs"
        class="weight-input weight-input-secs secs-picker-trigger"
        data-ui-action="open-secs-picker"
        aria-label="Set timer value"
        ${pickerDisabled}
      >
        ${formatSecondsToMinutesSeconds(totalSeconds)}
      </button>
      <button
        type="button"
        class="weight-button secs-icon-button"
        data-ui-action="increment-reps"
        aria-label="${isRunning ? "Pause timer" : "Start timer"}"
        ${controlsDisabled}
      >
        ${isRunning ? pauseIconSvg : playIconSvg}
      </button>
    </div>
  </div>
`;
};

const renderSecsPickerSheet = (minutes: number, seconds: number): string => {
  const previewValue = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return `
    <div class="secs-picker-layer" role="presentation">
      <button
        type="button"
        class="secs-picker-backdrop"
        data-ui-action="secs-picker-cancel"
        aria-label="Close timer picker"
      ></button>
      <section class="secs-picker-sheet" role="dialog" aria-modal="true" aria-label="Set time">
        <header class="secs-picker-header">
          <h4 class="secs-picker-title">Set time</h4>
          <p class="secs-picker-preview-value">${previewValue}</p>
        </header>

        <div class="secs-picker-wheels" aria-label="Minutes and seconds picker">
          <div class="secs-wheel" data-secs-wheel="minutes" role="listbox" aria-label="Minutes">
            <div class="secs-wheel-pad" aria-hidden="true"></div>
            ${Array.from({ length: 60 }, (_, value) => {
              const selectedClass = value === minutes ? " secs-wheel-row-selected" : "";
              return `<button type="button" class="secs-wheel-row${selectedClass}" data-ui-action="secs-picker-minute-row" data-secs-value="${value}" role="option" aria-selected="${value === minutes}">${value}</button>`;
            }).join("")}
            <div class="secs-wheel-pad" aria-hidden="true"></div>
          </div>

          <span class="secs-wheel-colon" aria-hidden="true">:</span>

          <div class="secs-wheel" data-secs-wheel="seconds" role="listbox" aria-label="Seconds">
            <div class="secs-wheel-pad" aria-hidden="true"></div>
            ${Array.from({ length: 60 }, (_, value) => {
              const selectedClass = value === seconds ? " secs-wheel-row-selected" : "";
              return `<button type="button" class="secs-wheel-row${selectedClass}" data-ui-action="secs-picker-second-row" data-secs-value="${value}" role="option" aria-selected="${value === seconds}">${String(value).padStart(2, "0")}</button>`;
            }).join("")}
            <div class="secs-wheel-pad" aria-hidden="true"></div>
          </div>
          <div class="secs-wheel-highlight" aria-hidden="true"></div>
        </div>

        <footer class="secs-picker-actions">
          <button type="button" class="nav-button nav-button-secondary" data-ui-action="secs-picker-cancel">Cancel</button>
          <button type="button" class="nav-button nav-button-tertiary" data-ui-action="secs-picker-reset">Reset</button>
          <button type="button" class="nav-button nav-button-primary" data-ui-action="secs-picker-apply">Apply</button>
        </footer>
      </section>
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
  repsFieldGuidance: string | null,
  secsFieldGuidance: string | null,
): string => `
  <li class="set-row ${editable ? "set-row-editable" : "set-row-readonly"}">
    ${editable ? "" : `<span class="set-row-index">Set ${setIndex}</span>`}
    <div class="set-row-fields">
      ${
        showLoadField && editable
          ? renderEditableSetField(
              "load",
              loadLabel,
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
              "REPS",
              "Reps",
              "exercise-reps",
              "reps-input",
              "decrement-reps",
              "increment-reps",
              inputFields.reps,
              "Exercise reps",
              controlsDisabled,
              inputFeedbackClasses.reps,
              repsFieldGuidance,
            )
          : editable
            ? renderSecsSetField(fields.reps, controlsDisabled, isSecsTimerRunning, secsFieldGuidance)
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
  #secsPicker = { isOpen: false, minutes: 0, seconds: 0 };
  #secsWheelSnapTimers: { minutes: number | null; seconds: number | null } = { minutes: null, seconds: null };

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
    this.addEventListener("scroll", this.#onScroll, true);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("scroll", this.#onScroll, true);
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
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) {
      return;
    }

    const rawAction = actionElement.dataset.uiAction;
    if (!rawAction) {
      return;
    }

    if (rawAction === "open-secs-picker") {
      if (!this.#state) {
        return;
      }
      const exerciseStep = this.#getCurrentExerciseStep();
      if (!exerciseStep || exerciseStep.repetitionKind !== "SECS" || exerciseStep.isSecsTimerRunning) {
        return;
      }
      const split = splitSecondsForPicker(exerciseStep.activeSet.reps);
      this.#secsPicker = { isOpen: true, minutes: split.minutes, seconds: split.seconds };
      this.#render();
      return;
    }

    if (rawAction === "secs-picker-cancel") {
      this.#secsPicker.isOpen = false;
      this.#render();
      return;
    }

    if (rawAction === "secs-picker-reset") {
      this.#setPickerValue("minutes", 0, true);
      this.#setPickerValue("seconds", 0, true);
      return;
    }

    if (rawAction === "secs-picker-apply") {
      const value = `${this.#secsPicker.minutes}:${String(this.#secsPicker.seconds).padStart(2, "0")}`;
      this.#secsPicker.isOpen = false;
      this.#emitInputAction("secs-input", value);
      this.#render();
      return;
    }

    if (rawAction === "secs-picker-minute-row" || rawAction === "secs-picker-second-row") {
      const nextValue = Number.parseInt(actionElement.dataset.secsValue ?? "", 10);
      if (!Number.isFinite(nextValue)) {
        return;
      }
      this.#setPickerValue(rawAction === "secs-picker-minute-row" ? "minutes" : "seconds", nextValue, true);
      return;
    }

    const action = rawAction as UiAction;

    this.#emitUiAction(action);
  };

  #onScroll = (event: Event): void => {
    if (!this.#secsPicker.isOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const wheel = target.dataset.secsWheel;
    if (wheel !== "minutes" && wheel !== "seconds") {
      return;
    }

    const nextValue = Math.max(0, Math.min(59, Math.round(target.scrollTop / secsPickerRowHeightPx)));
    this.#setPickerValue(wheel, nextValue, false);

    const existingTimer = this.#secsWheelSnapTimers[wheel];
    if (existingTimer !== null) {
      window.clearTimeout(existingTimer);
    }

    this.#secsWheelSnapTimers[wheel] = window.setTimeout(() => {
      target.scrollTo({ top: nextValue * secsPickerRowHeightPx, behavior: "smooth" });
      this.#secsWheelSnapTimers[wheel] = null;
    }, 90);
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

  #getCurrentExerciseStep(): WorkoutPlan["exercises"][number] | null {
    if (!this.#state) {
      return null;
    }
    const { plan, exerciseIndex } = this.#state;
    return plan.exercises[exerciseIndex] ?? null;
  }

  #setPickerValue(wheel: "minutes" | "seconds", value: number, syncScroll: boolean): void {
    const bounded = Math.max(0, Math.min(59, Math.floor(value)));
    this.#secsPicker[wheel] = bounded;
    this.#updatePickerPreview();
    this.#updatePickerSelection(wheel, bounded);
    if (syncScroll) {
      this.#syncWheelScroll(wheel, bounded);
    }
  }

  #updatePickerPreview(): void {
    const preview = this.querySelector(".secs-picker-preview-value");
    if (!preview) {
      return;
    }
    preview.textContent = `${this.#secsPicker.minutes}:${String(this.#secsPicker.seconds).padStart(2, "0")}`;
  }

  #updatePickerSelection(wheel: "minutes" | "seconds", selected: number): void {
    const wheelElement = this.querySelector(`.secs-wheel[data-secs-wheel="${wheel}"]`);
    if (!wheelElement) {
      return;
    }

    const rows = wheelElement.querySelectorAll<HTMLElement>(".secs-wheel-row");
    rows.forEach((row) => {
      const isSelected = Number.parseInt(row.dataset.secsValue ?? "", 10) === selected;
      row.classList.toggle("secs-wheel-row-selected", isSelected);
      row.setAttribute("aria-selected", String(isSelected));
    });
  }

  #syncWheelScroll(wheel: "minutes" | "seconds", value: number): void {
    const wheelElement = this.querySelector<HTMLElement>(`.secs-wheel[data-secs-wheel="${wheel}"]`);
    if (!wheelElement) {
      return;
    }

    const nextTop = value * secsPickerRowHeightPx;
    if (typeof wheelElement.scrollTo === "function") {
      wheelElement.scrollTo({ top: nextTop, behavior: "smooth" });
      return;
    }

    wheelElement.scrollTop = nextTop;
  }

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
    const hasRunningSecsLockout =
      (exerciseStep.repetitionKind ?? "REPS") === "SECS" && (exerciseStep.isSecsTimerRunning ?? false);
    const hasZeroSecsLockout =
      (exerciseStep.repetitionKind ?? "REPS") === "SECS" && Math.max(0, exerciseStep.activeSet.reps) === 0;
    const previousExerciseDisabled =
      isFirstStep || workoutSave.isSaving || hasRunningSecsLockout ? "disabled" : "";
    const completeSetDisabled =
      workoutSave.isSaving || isReadMode || hasRunningSecsLockout || hasZeroSecsLockout ? "disabled" : "";
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
    const completedLogicalSets = countCompletedLogicalSets(
      exerciseStep.completedSets,
      exerciseStep.setTrackingMode,
    );
    const targetSets =
      typeof selectedFallbackOption?.target_sets === "number" && selectedFallbackOption.target_sets >= 1
        ? selectedFallbackOption.target_sets
        : null;
    const isStationlessSelection =
      exerciseStep.selectedPlanExerciseOptionId !== null && exerciseStep.selectedStationId === null;
    const isSetCompletionAction =
      currentSetPhase.actionLabel === "Complete Set" || currentSetPhase.actionLabel === "Complete Left Side";
    const shouldOutlineCompleteSet =
      isSetCompletionAction && targetSets !== null && completedLogicalSets >= targetSets;
    const repRangeGuidance =
      repetitionKind === "REPS" &&
      typeof exerciseStep.activeSet.loadValue === "number" &&
      typeof selectedFallbackOption?.rep_min === "number" &&
      typeof selectedFallbackOption?.rep_max === "number"
        ? `${selectedFallbackOption.rep_min}-${selectedFallbackOption.rep_max}`
        : null;
    const hasStationlessFallbackLinkage = isStationlessSelection && selectedFallbackOption?.station_id === null;
    const noLoadPriorGuidance =
      hasStationlessFallbackLinkage &&
      typeof exerciseStep.suggestedSet.reps === "number" &&
      exerciseStep.suggestedSet.reps > 0
        ? repetitionKind === "SECS"
          ? `try >=${formatSecondsToMinutesSeconds(exerciseStep.suggestedSet.reps)}`
          : `try >=${exerciseStep.suggestedSet.reps}`
        : null;
    const repsFieldGuidance = repRangeGuidance ?? (repetitionKind === "REPS" ? noLoadPriorGuidance : null);
    const secsFieldGuidance = repetitionKind === "SECS" ? noLoadPriorGuidance : null;
    const completeSetButtonClass = shouldOutlineCompleteSet
      ? "nav-button nav-button-primary action-button action-button-primary action-button-primary-outlined"
      : "nav-button nav-button-primary action-button action-button-primary";
    const loadLabel = exerciseStep.loadInputMode === "PER_SIDE" ? "Load per Side" : "Load";
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
                      repsFieldGuidance,
                      secsFieldGuidance,
                    )}
                  </ol>
                  <button
                    type="button"
                    class="${completeSetButtonClass}"
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
                    ${controlsDisabled || (hasRunningSecsLockout ? "disabled" : "")}
                  >
                    ${workoutSave.isSaving ? "Saving..." : "Finish Workout"}
                  </button>`
                : !requiresFallbackConfirmation
                  ? `<button
                      type="button"
                      class="nav-button nav-button-secondary action-button action-button-secondary"
                      data-ui-action="next-exercise"
                      ${controlsDisabled || (hasRunningSecsLockout ? "disabled" : "")}
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

        ${this.#secsPicker.isOpen ? renderSecsPickerSheet(this.#secsPicker.minutes, this.#secsPicker.seconds) : ""}

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
    if (this.#secsPicker.isOpen) {
      this.#syncWheelScroll("minutes", this.#secsPicker.minutes);
      this.#syncWheelScroll("seconds", this.#secsPicker.seconds);
    }
    restoreInputSelection();
  }
}

export const registerPbExerciseScreen = (): void => {
  if (!customElements.get(pbExerciseScreenTag)) {
    customElements.define(pbExerciseScreenTag, PbExerciseScreenElement);
  }
};
