import type { AppState, BlockedStartModalState, StartScreenState, WorkoutPlan } from "./workout-types";
import { canStartWorkout } from "./workout-state";
import { formatLoadWithUnitDisplay } from "./workout-load-display";
import { resolveCurrentSetPhase } from "./current-set-phase";
import { buildCompletedSetHistoryModel } from "./completed-set-history";

const fallbackOptionKey = (optionId: string, stationId: string | null): string =>
  `${optionId}::${stationId ?? ""}`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderOptions = (
  items: Array<{ id: string; name: string }>,
  selectedId: string,
  placeholder: string,
): string => `
  <option value="">${escapeHtml(placeholder)}</option>
  ${items
    .map(
      (item) => `
        <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>
          ${escapeHtml(item.name)}
        </option>
      `,
    )
    .join("")}
`;

const findSelectedItem = <T extends { id: string }>(items: T[], selectedId: string): T | null =>
  items.find((item) => item.id === selectedId) ?? null;

const renderStartPreview = (startScreen: StartScreenState): string => {
  const selectedPlan = findSelectedItem(startScreen.trainingPlans, startScreen.selectedTrainingPlanId);
  const selectedGym = findSelectedItem(startScreen.gyms, startScreen.selectedGymId);
  const freeModeSelected = startScreen.selectedWorkoutMode === "free-mode";
  const previewLine = selectedPlan
    ? `${selectedPlan.exercise_count} exercises lined up for ${escapeHtml(selectedPlan.name)}.`
    : "Choose a plan to preview your workout structure.";

  return `
    <section class="start-preview" aria-label="Upcoming workout preview">
      <div class="start-preview-header">
        <h2 class="start-preview-title">Workout Preview</h2>
        <p class="start-preview-copy">${previewLine}</p>
      </div>
      <ul class="start-preview-cues" aria-label="Workout context cues">
        <li class="start-preview-cue">
          <span class="start-preview-cue-label">Training Plan</span>
          <span class="start-preview-cue-value">${
            selectedPlan ? escapeHtml(selectedPlan.name) : "Not selected"
          }</span>
        </li>
        <li class="start-preview-cue">
          <span class="start-preview-cue-label">Location</span>
          <span class="start-preview-cue-value">${
            freeModeSelected
              ? "Free Mode (No Gym)"
              : selectedGym
                ? escapeHtml(selectedGym.name)
                : "Not selected"
          }</span>
        </li>
      </ul>
    </section>
  `;
};

const renderReadOnlySetField = (label: string, value: string): string => `
  <div class="set-row-field">
    <span class="set-row-field-label">${label}</span>
    <span class="set-row-field-value">${value}</span>
  </div>
`;

const formatSecondsToMinutesSeconds = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatSecondsForTimeInput = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `00:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

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

const renderSecsSetField = (
  totalSeconds: number,
  controlsDisabled: string,
  isRunning: boolean,
): string => {
  return `
  <div class="set-row-field set-row-field-editable set-row-field-secs">
    <span class="set-row-field-label">SECS</span>
    <div class="secs-control-row" aria-label="Timed set controls">
      <button
        type="button"
        class="weight-button secs-icon-button"
        data-action="decrement-reps"
        aria-label="Reset timer"
        ${controlsDisabled}
      >
        ${resetIconSvg}
      </button>
      <input
        id="exercise-secs"
        class="weight-input weight-input-secs"
        data-action="secs-input"
        type="time"
        step="1"
        min="00:00:00"
        max="00:59:59"
        value="${formatSecondsForTimeInput(totalSeconds)}"
        aria-label="SECS timer value"
        ${controlsDisabled}
      />
      <button
        type="button"
        class="weight-button secs-icon-button"
        data-action="increment-reps"
        aria-label="${isRunning ? "Pause timer" : "Start timer"}"
        ${controlsDisabled}
      >
        ${isRunning ? pauseIconSvg : playIconSvg}
      </button>
    </div>
  </div>
`;
};

const formatMissingExerciseReason = (reason: string): string => {
  if (reason === "no_realizable_option_in_selected_gym") {
    return "No realizable option in selected gym";
  }

  return reason.replaceAll("_", " ");
};

const renderBlockedStartModal = (blockedStartModal: BlockedStartModalState | null): string => {
  if (!blockedStartModal) {
    return "";
  }

  return `
    <div class="confirm-dialog-layer" role="presentation">
      <div class="confirm-dialog-backdrop" role="presentation"></div>
      <section
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Workout start blocked"
      >
        <p class="confirm-dialog-message">${escapeHtml(blockedStartModal.message)}</p>
        <p class="confirm-dialog-context">
          ${escapeHtml(blockedStartModal.trainingPlanName)} at ${escapeHtml(blockedStartModal.gymName)}
        </p>
        <ul class="confirm-dialog-list" aria-label="Missing realizable exercises">
          ${blockedStartModal.missingExercises
            .map(
              (exercise) => `
                <li>
                  Exercise ${exercise.exercise_position}: ${escapeHtml(exercise.exercise_name)} (${escapeHtml(
                    formatMissingExerciseReason(exercise.reason),
                  )})
                </li>
              `,
            )
            .join("")}
        </ul>
        <div class="confirm-dialog-actions">
          <button
            type="button"
            class="nav-button nav-button-primary"
            data-action="dismiss-start-blocked-modal"
          >
            OK
          </button>
        </div>
      </section>
    </div>
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
      <button type="button" class="weight-button" data-action="${decrementAction}" ${controlsDisabled}>-</button>
      <input
        id="${inputId}"
        class="weight-input weight-input-${fieldKey}${inputFeedbackClass}"
        data-action="${inputAction}"
        inputmode="numeric"
        pattern="[0-9]*"
        value="${value}"
        aria-label="${ariaLabel}"
        ${controlsDisabled}
      />
      <button type="button" class="weight-button" data-action="${incrementAction}" ${controlsDisabled}>+</button>
    </div>
  </div>
`;

const renderSetRow = (
  setIndex: number,
  fields: { loadValue: number | null; reps: number },
  inputFields: { loadValue: string; reps: string },
  controlsDisabled: string,
  editable: boolean,
  showLoadField: boolean,
  inputFeedbackClasses: { load: string; reps: string },
  repetitionKind: "REPS" | "SECS",
  isSecsTimerRunning: boolean,
): string => `
  <li
    class="set-row ${editable ? "set-row-editable" : "set-row-readonly"}"
    ${editable ? `aria-label="Current editable set ${setIndex}"` : ""}
  >
    ${editable ? "" : `<span class="set-row-index">Set ${setIndex}</span>`}
    <div class="set-row-fields">
      ${
        showLoadField && editable
          ? renderEditableSetField(
              "load",
              "Load",
              "exercise-load",
              "load-input",
              "decrement-load",
              "increment-load",
              inputFields.loadValue,
              "Exercise load in kilograms",
              controlsDisabled,
              inputFeedbackClasses.load,
            )
            : showLoadField
              ? renderReadOnlySetField("Load", formatLoadWithUnitDisplay(fields.loadValue))
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

const renderFallbackSelector = (
  fallbackOptions: WorkoutPlan["exercises"][number]["fallbackOptions"],
  selectedOptionId: string | null,
  selectedStationId: string | null,
  isSelectionConfirmed: boolean,
  controlsDisabled: string,
  isLockedAfterSetCompletion: boolean,
): string => {
  if (fallbackOptions.length === 0) {
    return "";
  }

  const selectedOption = fallbackOptions.find(
    (option) =>
      option.id === selectedOptionId &&
      option.station_id === selectedStationId,
  ) ?? fallbackOptions.find((option) => option.id === selectedOptionId) ?? fallbackOptions[0];
  const hasSelectedOption = selectedOption !== undefined;

  if (isSelectionConfirmed) {
    return "";
  }

  const selectorDisabled =
    controlsDisabled || isLockedAfterSetCompletion ? "disabled" : "";
  const confirmDisabled =
    controlsDisabled || isLockedAfterSetCompletion || !hasSelectedOption
      ? "disabled"
      : "";

  return `
    <section class="fallback-option-panel" aria-label="Fallback exercise option">
      <div class="fallback-option-controls">
        <select
          id="fallback-option-select"
          class="start-select"
          data-action="switch-fallback-option"
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
          data-action="confirm-fallback-option"
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

export const renderStartScreen = (startScreen: StartScreenState): string => `
  <section class="screen-panel start-screen" aria-label="Workout start screen">
    <header class="app-header">
      <img
        class="start-banner"
        src="/images/banner.png?v=20260401-2"
        alt="PumpBuddy banner"
      />
      <p class="start-copy">Choose a training plan, then pick gym mode or free mode to begin.</p>
    </header>
    ${
      startScreen.isLoading
        ? '<p class="start-status" role="status">Loading available plans and gyms...</p>'
        : ""
    }
    ${
      startScreen.errorMessage
        ? `<p class="start-error" role="alert">${escapeHtml(startScreen.errorMessage)}</p>`
        : ""
    }
    <div class="start-fields">
      <div class="start-field">
        <label class="start-label" for="training-plan-select">Training Plan</label>
        <select
          id="training-plan-select"
          class="start-select"
          data-action="select-training-plan"
          ${startScreen.isLoading || startScreen.isStarting ? "disabled" : ""}
        >
          ${renderOptions(startScreen.trainingPlans, startScreen.selectedTrainingPlanId, "Choose a plan")}
        </select>
      </div>
      <fieldset class="start-field start-mode-field">
        <legend class="start-label">Workout Mode</legend>
        <label class="start-mode-option">
          <input
            type="radio"
            name="workout-mode"
            value="configured-gym"
            data-action="select-workout-mode"
            ${startScreen.selectedWorkoutMode === "configured-gym" ? "checked" : ""}
            ${startScreen.isLoading || startScreen.isStarting ? "disabled" : ""}
          />
          <span>Gym Mode</span>
        </label>
        <label class="start-mode-option">
          <input
            type="radio"
            name="workout-mode"
            value="free-mode"
            data-action="select-workout-mode"
            ${startScreen.selectedWorkoutMode === "free-mode" ? "checked" : ""}
            ${startScreen.isLoading || startScreen.isStarting ? "disabled" : ""}
          />
          <span>Free Mode</span>
        </label>
      </fieldset>
      ${
        startScreen.selectedWorkoutMode === "configured-gym"
          ? `
      <div class="start-field">
        <label class="start-label" for="gym-select">Gym</label>
        <select
          id="gym-select"
          class="start-select"
          data-action="select-gym"
          ${startScreen.isLoading || startScreen.isStarting ? "disabled" : ""}
        >
          ${renderOptions(startScreen.gyms, startScreen.selectedGymId, "Choose a gym")}
        </select>
      </div>
      `
          : ""
      }
    </div>
    ${renderStartPreview(startScreen)}
    <button
      type="button"
      class="start-button nav-button nav-button-primary action-button action-button-primary"
      data-action="start-workout"
      ${canStartWorkout(startScreen) ? "" : "disabled"}
    >
      ${startScreen.isStarting ? "Preparing Workout..." : "Start Workout"}
    </button>
    ${renderBlockedStartModal(startScreen.blockedStartModal)}
  </section>
`;

export const renderConfirmDialog = (
  confirmDialog: AppState["confirmDialog"],
  workoutSave: AppState["workoutSave"],
): string => {
  if (!confirmDialog.message) {
    return "";
  }

  const controlsDisabled = workoutSave.isSaving ? "disabled" : "";

  return `
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
            class="nav-button"
            data-action="confirm-dialog-dismiss"
            ${controlsDisabled}
          >
            Keep Editing
          </button>
          <button
            type="button"
            class="nav-button"
            data-action="confirm-dialog-confirm"
            ${controlsDisabled}
          >
            ${escapeHtml(confirmDialog.confirmActionLabel ?? "Confirm")}
          </button>
        </div>
      </section>
    </div>
  `;
};

export const renderExerciseScreen = (
  plan: WorkoutPlan,
  exerciseIndex: number,
  startScreen: Pick<StartScreenState, "selectedWorkoutMode" | "selectedGymId" | "gyms">,
  confirmDialog: AppState["confirmDialog"],
  activeWorkout: AppState["activeWorkout"],
  workoutSave: AppState["workoutSave"],
  uiFeedback: AppState["uiFeedback"],
): string => {
  const exerciseStep = plan.exercises[exerciseIndex];
  const stepNumber = exerciseIndex + 1;
  const totalSteps = plan.exercises.length;
  const isLastStep = exerciseIndex === totalSteps - 1;
  const isFirstStep = exerciseIndex === 0;
  const isReadOnlyExercise = exerciseStep.isReadOnly;
  const isReadMode = isReadOnlyExercise;
  const controlsDisabled = workoutSave.isSaving ? "disabled" : "";
  const previousExerciseDisabled = isFirstStep || workoutSave.isSaving ? "disabled" : "";
  const completeSetDisabled = workoutSave.isSaving || isReadOnlyExercise ? "disabled" : "";
  const setListFeedbackClass = uiFeedback.completedSetPulseToken > 0 ? " set-list-feedback-complete" : "";
  const loadInputFeedbackClass = uiFeedback.loadTickToken > 0 ? " input-feedback-tick" : "";
  const repsInputFeedbackClass = uiFeedback.repsTickToken > 0 ? " input-feedback-tick" : "";
  const selectedGym = findSelectedItem(startScreen.gyms, startScreen.selectedGymId);
  const selectedFallbackOption =
    exerciseStep.fallbackOptions.find(
      (option) =>
        option.id === exerciseStep.selectedPlanExerciseOptionId &&
        option.station_id === exerciseStep.selectedStationId,
    ) ?? exerciseStep.fallbackOptions.find((option) => option.id === exerciseStep.selectedPlanExerciseOptionId) ?? null;
  const isConfiguredGymMode = startScreen.selectedWorkoutMode === "configured-gym";
  const requiresFallbackConfirmation =
    isConfiguredGymMode &&
    exerciseStep.fallbackOptions.length > 1 &&
    !exerciseStep.isFallbackOptionConfirmed;
  const selectedGymName = isConfiguredGymMode
    ? selectedGym
      ? selectedGym.name
      : "Configured Gym"
    : null;
  const workoutContextLine =
    selectedGymName
      ? `${plan.name} at ${selectedGymName}`
      : plan.name;
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
  const completedSetHistoryModel = buildCompletedSetHistoryModel(
    exerciseStep.completedSets,
    exerciseStep.setTrackingMode,
    exerciseStep.repetitionKind,
  );
  const completedSetHistory = `<section
          class="completed-set-list"
          aria-label="Completed set history"
          data-history-state="${exerciseStep.completedSets.length > 0 ? "populated" : "empty"}"
        >
          <h4 class="set-list-subtitle">History</h4>
          <div class="completed-set-header completed-set-grid--${completedSetHistoryModel.mode}" aria-hidden="true">
            ${completedSetHistoryModel.headerCells
              .map((cell) => `<span class="completed-set-header-cell">${cell}</span>`)
              .join("")}
          </div>
          ${
            completedSetHistoryModel.rows.length > 0
              ? `<ol class="completed-set-rows">
            ${completedSetHistoryModel.rows
              .map(
                (row) => `<li class="completed-set-row completed-set-grid--${completedSetHistoryModel.mode}" aria-label="${row.ariaLabel}">
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
        </section>`;

  return `
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
      ${
        isReadMode
          ? '<p class="exercise-read-mode-indicator">Viewing previous exercise</p>'
          : ""
      }
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
            !isReadOnlyExercise,
            !isStationlessSelection,
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
          data-action="next-set"
          ${completeSetDisabled}
        >
          ${workoutSave.isSaving ? "Saving..." : currentSetPhase.actionLabel}
        </button>
        ${completedSetHistory}
        </section>`
          : ''
      }
      ${
        isReadMode
          ? `<div class="step-actions-read-primary">
          <button
            type="button"
            class="nav-button nav-button-primary action-button action-button-primary"
            data-action="jump-to-current-exercise"
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
            data-action="previous-exercise"
            ${previousExerciseDisabled}
          >
            Previous
          </button>
          ${
            isLastStep
              ? `<button type="button" class="nav-button nav-button-secondary action-button action-button-secondary" data-action="finish-workout" ${controlsDisabled}>
            ${workoutSave.isSaving ? "Saving..." : "Finish Workout"}
          </button>`
              : !requiresFallbackConfirmation
                ? `<button type="button" class="nav-button nav-button-secondary action-button action-button-secondary" data-action="next-exercise" ${controlsDisabled}>
            ${workoutSave.isSaving ? "Saving..." : "Next"}
          </button>`
                : ""
          }
        </div>
      </div>
      ${
        canCancelWorkout
          ? `<div class="step-actions-tertiary">
          <button type="button" class="nav-button nav-button-tertiary action-button action-button-tertiary cancel-button" data-action="cancel-workout">Cancel Workout</button>
        </div>`
          : ""
      }
    </section>
    ${renderConfirmDialog(confirmDialog, workoutSave)}
  `;
};

const formatDuration = (startedAt: string, completedAt: string): string => {
  const startedAtMs = Date.parse(startedAt);
  const completedAtMs = Date.parse(completedAt);
  if (Number.isNaN(startedAtMs) || Number.isNaN(completedAtMs) || completedAtMs <= startedAtMs) {
    return "0m";
  }

  const durationMinutes = Math.max(1, Math.floor((completedAtMs - startedAtMs) / 60000));
  return `${durationMinutes}m`;
};

const computeCompletionMetrics = (
  plan: WorkoutPlan,
  completion: { startedAt: string | null; completedAt: string | null },
): Array<{ label: string; value: string }> => {
  const exercisesCompleted = plan.exercises.length;
  const completedSets = plan.exercises.flatMap((exercise) => exercise.completedSets);
  const totalSetsCompleted = completedSets.length;
  const totalReps = completedSets.reduce((sum, set) => sum + set.reps, 0);
  const totalWeightMoved = completedSets.reduce((sum, set) => sum + (set.loadValue ?? 0) * set.reps, 0);
  const totalWeightMovedRounded = Math.round(totalWeightMoved);
  const workoutDuration =
    completion.startedAt && completion.completedAt
      ? formatDuration(completion.startedAt, completion.completedAt)
      : "0m";
  const durationMinutes = Number.parseInt(workoutDuration, 10);
  const volumePerMinute =
    durationMinutes > 0 ? totalWeightMovedRounded / durationMinutes : totalWeightMovedRounded;

  return [
    { label: "Exercises Completed", value: String(exercisesCompleted) },
    { label: "Total Sets Completed", value: String(totalSetsCompleted) },
    { label: "Total Reps", value: String(totalReps) },
    { label: "Total Weight Moved", value: `${totalWeightMovedRounded} kg` },
    { label: "Workout Duration", value: workoutDuration },
    { label: "Volume per Minute", value: `${volumePerMinute.toFixed(1)} kg/min` },
  ];
};

export const renderCompletionScreen = (
  plan: WorkoutPlan,
  completion: { startedAt: string | null; completedAt: string | null },
): string => `
  <section class="screen-panel completion-screen" aria-label="Workout completion screen">
    <p class="plan-label">${escapeHtml(plan.name)}</p>
    <h2 class="completion-title">Plan Completed</h2>
    <p class="completion-copy">Great work. You finished all ${plan.exercises.length} exercises.</p>
    <dl class="completion-metrics" aria-label="Workout completion metrics">
      ${computeCompletionMetrics(plan, completion)
        .map(
          (metric) => `
            <div class="completion-metric-row">
              <dt class="completion-metric-key">${metric.label}</dt>
              <dd class="completion-metric-value">${metric.value}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
    <div class="step-actions">
      <button type="button" class="nav-button nav-button-primary action-button action-button-primary" data-action="return-to-start">
        Return to Start
      </button>
    </div>
  </section>
`;
