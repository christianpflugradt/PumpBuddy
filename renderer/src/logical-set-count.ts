import type { WorkoutDetailSetLine } from "./workout-contract";
import type { CompletedExerciseSet, SetTrackingMode } from "./workout-types";

type SetSideLike = "LEFT" | "RIGHT" | "BILATERAL" | undefined | null;

const countCompletedLogicalSets = <T>(
  rows: T[],
  trackingMode: SetTrackingMode | null | undefined,
  getSetIndex: (row: T) => number,
  getSetSide: (row: T) => SetSideLike,
): number => {
  if (trackingMode !== "UNILATERAL") {
    return rows.length;
  }

  const sidesByIndex = new Map<number, { hasLeft: boolean; hasRight: boolean }>();
  for (const row of rows) {
    const index = getSetIndex(row);
    const current = sidesByIndex.get(index) ?? { hasLeft: false, hasRight: false };
    if (getSetSide(row) === "RIGHT") {
      current.hasRight = true;
    } else {
      current.hasLeft = true;
    }
    sidesByIndex.set(index, current);
  }

  return Array.from(sidesByIndex.values()).filter((entry) => entry.hasLeft && entry.hasRight).length;
};

export const countCompletedExerciseLogicalSets = (
  completedSets: CompletedExerciseSet[],
  trackingMode: SetTrackingMode | null | undefined,
): number => countCompletedLogicalSets(completedSets, trackingMode, (set) => set.setIndex, (set) => set.setSide);

export const countWorkoutDetailLogicalSets = (
  setLines: WorkoutDetailSetLine[],
  trackingMode: SetTrackingMode | null | undefined,
): number => countCompletedLogicalSets(setLines, trackingMode, (set) => set.set_index, (set) => set.set_side);
