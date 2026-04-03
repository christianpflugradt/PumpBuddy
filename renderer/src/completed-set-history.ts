import { formatLoadWithUnitDisplay } from "./workout-load-display";
import type { CompletedExerciseSet, RepetitionKind, SetTrackingMode } from "./workout-types";

type HistoryMode = "bilateral" | "unilateral";

type HistoryRow = {
  setIndex: number;
  cells: string[];
  ariaLabel: string;
};

export type CompletedSetHistoryModel = {
  mode: HistoryMode;
  headerCells: string[];
  rows: HistoryRow[];
};

const getSide = (
  set: Pick<CompletedExerciseSet, "setSide">,
  mode: HistoryMode,
): "LEFT" | "RIGHT" | "BILATERAL" => {
  if (mode === "unilateral") {
    return set.setSide === "RIGHT" ? "RIGHT" : "LEFT";
  }

  return "BILATERAL";
};

const buildBilateralRows = (completedSets: CompletedExerciseSet[]): HistoryRow[] =>
  completedSets.map((set) => {
    const loadDisplay = formatLoadWithUnitDisplay(set.loadValue);
    return {
      setIndex: set.setIndex,
      cells: [String(set.setIndex), loadDisplay, String(set.reps)],
      ariaLabel: `Completed set ${set.setIndex}: ${loadDisplay} for ${set.reps} reps`,
    };
  });

const buildUnilateralRows = (completedSets: CompletedExerciseSet[]): HistoryRow[] => {
  const groupedSets = new Map<
    number,
    {
      left: CompletedExerciseSet | null;
      right: CompletedExerciseSet | null;
    }
  >();

  for (const set of completedSets) {
    const current = groupedSets.get(set.setIndex) ?? { left: null, right: null };
    const side = getSide(set, "unilateral");

    if (side === "RIGHT") {
      current.right = set;
    } else {
      current.left = set;
    }

    groupedSets.set(set.setIndex, current);
  }

  return Array.from(groupedSets.entries())
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([setIndex, grouped]) => {
      const leftLoad = grouped.left ? formatLoadWithUnitDisplay(grouped.left.loadValue) : "";
      const leftReps = grouped.left ? String(grouped.left.reps) : "";
      const rightLoad = grouped.right ? formatLoadWithUnitDisplay(grouped.right.loadValue) : "";
      const rightReps = grouped.right ? String(grouped.right.reps) : "";

      const ariaLabel =
        grouped.right && grouped.left
          ? `Completed set ${setIndex}: left ${leftLoad} for ${leftReps} reps, right ${rightLoad} for ${rightReps} reps`
          : `Completed set ${setIndex}: left ${leftLoad} for ${leftReps} reps, right side pending`;

      return {
        setIndex,
        cells: [String(setIndex), leftLoad, leftReps, rightLoad, rightReps],
        ariaLabel,
      };
    });
};

export const buildCompletedSetHistoryModel = (
  completedSets: CompletedExerciseSet[],
  setTrackingMode?: SetTrackingMode | null,
  repetitionKind: RepetitionKind = "REPS",
): CompletedSetHistoryModel => {
  const repetitionHeader = repetitionKind === "SECS" ? "secs" : "reps";

  if (setTrackingMode === "UNILATERAL") {
    return {
      mode: "unilateral",
      headerCells: ["Set", "kg (L)", `${repetitionHeader} (L)`, "kg (R)", `${repetitionHeader} (R)`],
      rows: buildUnilateralRows(completedSets),
    };
  }

  return {
    mode: "bilateral",
    headerCells: ["Set", "kg", repetitionHeader],
    rows: buildBilateralRows(completedSets),
  };
};
