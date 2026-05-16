import type {
  CompletedExerciseSet,
  RepetitionKind,
  SetSide,
  SetTrackingMode,
  WorkoutPlan,
} from "./workout-types";
import type { WorkoutDetailSetLine } from "./workout-contract";

type SetSideLike = SetSide | null | undefined;

type VolumeSetRow = {
  setIndex: number;
  setSide: SetSideLike;
  loadValue: number | null;
  repetitionKind: RepetitionKind;
  repetitionValue: number | null;
};

const resolveTrackingModeFromRows = (trackingMode: SetTrackingMode | null | undefined, rows: VolumeSetRow[]): SetTrackingMode => {
  if (trackingMode === "UNILATERAL") {
    return "UNILATERAL";
  }

  if (trackingMode === "BILATERAL") {
    return "BILATERAL";
  }

  return rows.some((row) => row.setSide === "LEFT" || row.setSide === "RIGHT") ? "UNILATERAL" : "BILATERAL";
};

const normalizePositiveInteger = (value: number | null): number => {
  if (!Number.isFinite(value) || value === null || value <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

const resolveSetRowVolume = (row: VolumeSetRow): number => {
  if (!Number.isFinite(row.loadValue) || row.loadValue === null || row.loadValue <= 0) {
    return 0;
  }

  const multiplier = row.repetitionKind === "SECS" ? 1 : normalizePositiveInteger(row.repetitionValue);
  if (multiplier <= 0) {
    return 0;
  }

  return row.loadValue * multiplier;
};

const sumVolume = (rows: VolumeSetRow[], trackingMode: SetTrackingMode | null | undefined): number => {
  if (resolveTrackingModeFromRows(trackingMode, rows) !== "UNILATERAL") {
    return rows.reduce((sum, row) => sum + resolveSetRowVolume(row), 0);
  }

  const rowsByIndex = new Map<number, { left: VolumeSetRow | null; right: VolumeSetRow | null }>();
  for (const row of rows) {
    const current = rowsByIndex.get(row.setIndex) ?? { left: null, right: null };
    if (row.setSide === "RIGHT") {
      current.right = row;
    } else {
      current.left = row;
    }
    rowsByIndex.set(row.setIndex, current);
  }

  let volume = 0;
  for (const grouped of rowsByIndex.values()) {
    if (!grouped.left || !grouped.right) {
      continue;
    }

    volume += (resolveSetRowVolume(grouped.left) + resolveSetRowVolume(grouped.right)) / 2;
  }

  return volume;
};

export const sumWorkoutPlanVolumeKg = (plan: WorkoutPlan): number => {
  return plan.exercises.reduce((sum, exercise) => {
    const rows: VolumeSetRow[] = exercise.completedSets.map((set): VolumeSetRow => ({
      setIndex: set.setIndex,
      setSide: set.setSide,
      loadValue: set.loadValue,
      repetitionKind: exercise.repetitionKind,
      repetitionValue: set.reps,
    }));
    return sum + sumVolume(rows, exercise.setTrackingMode);
  }, 0);
};

export const sumWorkoutDetailVolumeKg = (
  exercises: Array<{
    set_tracking_mode: SetTrackingMode | null;
    repetition_kind: RepetitionKind | null;
    sets: WorkoutDetailSetLine[];
  }>,
): number => {
  return exercises.reduce((sum, exercise) => {
    const defaultRepetitionKind = exercise.repetition_kind ?? "REPS";
    const rows: VolumeSetRow[] = exercise.sets.map((set): VolumeSetRow => ({
      setIndex: set.set_index,
      setSide: set.set_side,
      loadValue: set.load_value,
      repetitionKind: set.repetition_kind ?? defaultRepetitionKind,
      repetitionValue: set.repetition_value,
    }));
    return sum + sumVolume(rows, exercise.set_tracking_mode);
  }, 0);
};

export const sumExerciseSetsVolumeKg = (
  completedSets: CompletedExerciseSet[],
  trackingMode: SetTrackingMode | null | undefined,
  repetitionKind: RepetitionKind,
): number => {
  const rows: VolumeSetRow[] = completedSets.map((set): VolumeSetRow => ({
    setIndex: set.setIndex,
    setSide: set.setSide,
    loadValue: set.loadValue,
    repetitionKind,
    repetitionValue: set.reps,
  }));

  return sumVolume(rows, trackingMode);
};
