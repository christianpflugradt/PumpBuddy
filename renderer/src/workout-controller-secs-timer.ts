import type { AppState } from './workout-types';

const timerTickMs = 1000;
const maxEditableSecs = 59 * 60 + 59;

type GetState = () => AppState;

export const parseSecsInputValue = (value: string): number => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [hoursText, minutesText, secondsText] = trimmed.split(':');
    const parsedHours = Number.parseInt(hoursText ?? '', 10);
    const parsedMinutes = Number.parseInt(minutesText ?? '', 10);
    const parsedSeconds = Number.parseInt(secondsText ?? '', 10);

    const boundedHours = Number.isFinite(parsedHours) ? Math.max(0, parsedHours) : 0;
    const boundedMinutes = Number.isFinite(parsedMinutes) ? Math.max(0, Math.min(59, parsedMinutes)) : 0;
    const boundedSeconds = Number.isFinite(parsedSeconds) ? Math.max(0, Math.min(59, parsedSeconds)) : 0;

    return Math.min(maxEditableSecs, boundedHours * 3600 + boundedMinutes * 60 + boundedSeconds);
  }

  if (trimmed.includes(':')) {
    const [minutesText, secondsText] = trimmed.split(':', 2);
    const parsedMinutes = Number.parseInt(minutesText ?? '', 10);
    const parsedSeconds = Number.parseInt(secondsText ?? '', 10);
    const boundedMinutes = Number.isFinite(parsedMinutes) ? Math.max(0, parsedMinutes) : 0;
    const boundedSeconds = Number.isFinite(parsedSeconds) ? Math.max(0, Math.min(59, parsedSeconds)) : 0;
    return Math.min(maxEditableSecs, boundedMinutes * 60 + boundedSeconds);
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(maxEditableSecs, Math.max(0, parsed));
};

export const createSecsTimerController = (params: {
  getState: GetState;
  render: () => void;
}): {
  sync: () => void;
  stopOnCurrentExercise: () => void;
  hasRunningOnCurrentExercise: () => boolean;
  hasZeroOnCurrentExercise: () => boolean;
} => {
  const { getState, render } = params;
  let secsTimerId: number | null = null;

  const clear = (): void => {
    if (secsTimerId === null) {
      return;
    }

    window.clearInterval(secsTimerId);
    secsTimerId = null;
  };

  const hasRunningOnCurrentExercise = (): boolean => {
    const state = getState();
    if (state.viewState.screen !== 'exercise' || !state.workoutPlan) {
      return false;
    }

    const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    return Boolean(current && current.repetitionKind === 'SECS' && current.isSecsTimerRunning);
  };

  const hasZeroOnCurrentExercise = (): boolean => {
    const state = getState();
    if (state.viewState.screen !== 'exercise' || !state.workoutPlan) {
      return false;
    }

    const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    return Boolean(current && current.repetitionKind === 'SECS' && current.activeSet.reps <= 0);
  };

  const stopOnCurrentExercise = (): void => {
    clear();

    const state = getState();
    if (state.viewState.screen !== 'exercise' || !state.workoutPlan) {
      return;
    }

    const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (current?.repetitionKind === 'SECS') {
      current.isSecsTimerRunning = false;
    }
  };

  const sync = (): void => {
    const state = getState();
    if (state.viewState.screen !== 'exercise' || !state.workoutPlan || state.workoutSave.isSaving) {
      clear();
      return;
    }

    const current = state.workoutPlan.exercises[state.viewState.exerciseIndex];
    if (!current || current.repetitionKind !== 'SECS' || !current.isSecsTimerRunning || current.isReadOnly) {
      clear();
      return;
    }

    if (secsTimerId !== null) {
      return;
    }

    secsTimerId = window.setInterval(() => {
      const nextState = getState();
      if (nextState.viewState.screen !== 'exercise' || !nextState.workoutPlan || nextState.workoutSave.isSaving) {
        clear();
        return;
      }

      const activeExercise = nextState.workoutPlan.exercises[nextState.viewState.exerciseIndex];
      if (
        !activeExercise ||
        activeExercise.repetitionKind !== 'SECS' ||
        !activeExercise.isSecsTimerRunning ||
        activeExercise.isReadOnly
      ) {
        clear();
        return;
      }

      activeExercise.activeSet.reps += 1;
      activeExercise.activeSetInput.reps = String(activeExercise.activeSet.reps);
      render();
    }, timerTickMs);
  };

  return {
    sync,
    stopOnCurrentExercise,
    hasRunningOnCurrentExercise,
    hasZeroOnCurrentExercise,
  };
};
