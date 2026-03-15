import type { AppState, StartScreenState, WorkoutPlan } from "./workout-types";
import { canStartWorkout } from "./workout-state";

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

const renderReadOnlySetField = (label: string, value: string): string => `
  <div class="set-row-field">
    <span class="set-row-field-label">${label}</span>
    <span class="set-row-field-value">${value}</span>
  </div>
`;

const renderEditableSetField = (
  label: string,
  inputId: string,
  inputAction: "load-input" | "reps-input",
  decrementAction: "decrement-load" | "decrement-reps",
  incrementAction: "increment-load" | "increment-reps",
  value: number,
  ariaLabel: string,
  controlsDisabled: string,
): string => `
  <div class="set-row-field set-row-field-editable">
    <label class="set-row-field-label" for="${inputId}">${label}</label>
    <div class="weight-controls" aria-label="${label} controls">
      <button type="button" class="weight-button" data-action="${decrementAction}" ${controlsDisabled}>-</button>
      <input
        id="${inputId}"
        class="weight-input"
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
  fields: { loadValue: number; reps: number },
  controlsDisabled: string,
  editable: boolean,
): string => `
  <li
    class="set-row ${editable ? "set-row-editable" : "set-row-readonly"}"
    ${editable ? 'aria-label="Current editable set"' : ""}
  >
    <span class="set-row-index">Set ${setIndex}</span>
    <div class="set-row-fields">
      ${
        editable
          ? renderEditableSetField(
              "Load",
              "exercise-load",
              "load-input",
              "decrement-load",
              "increment-load",
              fields.loadValue,
              "Exercise load in kilograms",
              controlsDisabled,
            )
          : renderReadOnlySetField("Load", `${fields.loadValue} kg`)
      }
      ${
        editable
          ? renderEditableSetField(
              "Reps",
              "exercise-reps",
              "reps-input",
              "decrement-reps",
              "increment-reps",
              fields.reps,
              "Exercise reps",
              controlsDisabled,
            )
          : renderReadOnlySetField("Reps", String(fields.reps))
      }
    </div>
  </li>
`;

const renderCompletedSetRow = (setIndex: number, fields: { loadValue: number; reps: number }): string => `
  <li class="completed-set-row" aria-label="Completed set ${setIndex}: ${fields.loadValue} kilograms for ${fields.reps} reps">
    <span class="completed-set-cell completed-set-cell-index">${setIndex}</span>
    <span class="completed-set-cell">${fields.loadValue} kg</span>
    <span class="completed-set-cell">${fields.reps}</span>
    <span class="completed-set-cell completed-set-cell-status" aria-hidden="true">✓</span>
  </li>
`;

export const renderStartScreen = (startScreen: StartScreenState): string => `
  <section class="screen-panel start-screen" aria-label="Workout start screen">
    <header class="app-header">
      <p class="app-kicker">Workout tracker</p>
      <h1 class="app-title">PumpBuddy</h1>
      <p class="start-copy">Select a seeded plan and gym to begin.</p>
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
    </div>
    <button
      type="button"
      class="start-button"
      data-action="start-workout"
      ${canStartWorkout(startScreen) ? "" : "disabled"}
    >
      ${startScreen.isStarting ? "Preparing Workout..." : "Start Workout"}
    </button>
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
            Confirm
          </button>
        </div>
      </section>
    </div>
  `;
};

export const renderExerciseScreen = (
  plan: WorkoutPlan,
  exerciseIndex: number,
  confirmDialog: AppState["confirmDialog"],
  activeWorkout: AppState["activeWorkout"],
  workoutSave: AppState["workoutSave"],
): string => {
  const exerciseStep = plan.exercises[exerciseIndex];
  const stepNumber = exerciseIndex + 1;
  const totalSteps = plan.exercises.length;
  const isLastStep = exerciseIndex === totalSteps - 1;
  const isFirstStep = exerciseIndex === 0;
  const isReadOnlyExercise = exerciseStep.isReadOnly;
  const controlsDisabled = workoutSave.isSaving ? "disabled" : "";
  const previousExerciseDisabled = isFirstStep || workoutSave.isSaving ? "disabled" : "";
  const completeSetDisabled = workoutSave.isSaving || isReadOnlyExercise ? "disabled" : "";
  const canCancelWorkout =
    activeWorkout.id !== null &&
    activeWorkout.persistedExerciseCount > 0 &&
    !workoutSave.isSaving;

  return `
    <section class="screen-panel exercise-step" aria-live="polite" aria-label="Workout exercise step">
      <header class="app-header app-header-compact">
        <p class="app-kicker">Workout in progress</p>
        <h1 class="app-title">PumpBuddy</h1>
      </header>
      <div class="exercise-step-header">
        <div class="exercise-step-copy">
          <p class="plan-label">${escapeHtml(plan.name)}</p>
          <p class="step-counter">Exercise ${stepNumber} of ${totalSteps}</p>
          <h2 class="exercise-name">${escapeHtml(exerciseStep.name)}</h2>
        </div>
      </div>
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
      <section class="set-list" aria-label="Exercise sets">
        <div class="set-list-heading">
          <h3 class="set-list-title">Current Set</h3>
          <p class="set-counter">Set ${exerciseStep.completedSets.length + 1}</p>
        </div>
        <ol class="set-rows">
          ${renderSetRow(
            exerciseStep.completedSets.length + 1,
            exerciseStep.activeSet,
            controlsDisabled,
            !isReadOnlyExercise,
          )}
        </ol>
        <button
          type="button"
          class="nav-button nav-button-primary"
          data-action="next-set"
          ${completeSetDisabled}
        >
          ${workoutSave.isSaving ? "Saving..." : "Complete Set"}
        </button>
        ${
          exerciseStep.completedSets.length > 0
            ? `<section class="completed-set-list" aria-label="Completed set history">
          <h4 class="set-list-subtitle">History</h4>
          <div class="completed-set-header" aria-hidden="true">
            <span class="completed-set-header-cell">Set</span>
            <span class="completed-set-header-cell">Kg</span>
            <span class="completed-set-header-cell">Reps</span>
            <span class="completed-set-header-cell">Status</span>
          </div>
          <ol class="completed-set-rows">
            ${exerciseStep.completedSets.map((set) => renderCompletedSetRow(set.setIndex, set)).join("")}
          </ol>
        </section>`
            : ""
        }
      </section>
      <div class="step-actions">
        <div class="step-actions-secondary">
          <button
            type="button"
            class="nav-button nav-button-secondary"
            data-action="previous-exercise"
            ${previousExerciseDisabled}
          >
            Previous Exercise
          </button>
          ${
            isLastStep
              ? `<button type="button" class="nav-button nav-button-secondary" data-action="finish-workout" ${controlsDisabled}>
            ${workoutSave.isSaving ? "Saving..." : "Finish Workout"}
          </button>`
              : `<button type="button" class="nav-button nav-button-secondary" data-action="next-exercise" ${controlsDisabled}>
            ${workoutSave.isSaving ? "Saving..." : "Next Exercise"}
          </button>`
          }
        </div>
      </div>
      ${
        canCancelWorkout
          ? `<div class="step-actions-tertiary">
          <button type="button" class="nav-button cancel-button" data-action="cancel-workout">Cancel Workout</button>
        </div>`
          : ""
      }
    </section>
    ${renderConfirmDialog(confirmDialog, workoutSave)}
  `;
};

export const renderCompletionScreen = (plan: WorkoutPlan): string => `
  <section class="screen-panel completion-screen" aria-label="Workout completion screen">
    <header class="app-header">
      <p class="app-kicker">Workout complete</p>
      <h1 class="app-title">PumpBuddy</h1>
    </header>
    <p class="plan-label">${escapeHtml(plan.name)}</p>
    <h2 class="completion-title">Plan Completed</h2>
    <p class="completion-copy">Great work. You finished all ${plan.exercises.length} exercises.</p>
  </section>
`;
