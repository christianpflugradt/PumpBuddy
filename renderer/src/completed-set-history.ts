import { formatLoadWithUnitDisplay } from "./workout-load-display";
import type { CompletedExerciseSet, RepetitionKind, SetTrackingMode } from "./workout-types";

type HistoryMode = "bilateral" | "unilateral";

type HistoryRow = {
  setIndex: number;
  cells: string[];
  ariaLabel: string;
  canDelete: boolean;
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

const formatSecondsToMinutesSeconds = (totalSeconds: number): string => {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatRepetitionDisplay = (reps: number, repetitionKind: RepetitionKind): string =>
  repetitionKind === "SECS" ? formatSecondsToMinutesSeconds(reps) : String(reps);

const formatRepetitionAriaValue = (reps: number, repetitionKind: RepetitionKind): string =>
  repetitionKind === "SECS" ? formatSecondsToMinutesSeconds(reps) : `${reps} reps`;

const formatSetRepetitionDisplay = (set: CompletedExerciseSet | null, repetitionKind: RepetitionKind): string =>
  set ? formatRepetitionDisplay(set.reps, repetitionKind) : "";

const formatSetRepetitionAriaValue = (set: CompletedExerciseSet | null, repetitionKind: RepetitionKind): string =>
  set ? formatRepetitionAriaValue(set.reps, repetitionKind) : "";

const buildBilateralRows = (
  completedSets: CompletedExerciseSet[],
  repetitionKind: RepetitionKind,
): Omit<HistoryRow, "canDelete">[] =>
  completedSets.map((set) => {
    const loadDisplay = formatLoadWithUnitDisplay(set.loadValue);
    const repetitionDisplay = formatRepetitionDisplay(set.reps, repetitionKind);
    const repetitionAriaValue = formatRepetitionAriaValue(set.reps, repetitionKind);
    return {
      setIndex: set.setIndex,
      cells: [String(set.setIndex), loadDisplay, repetitionDisplay],
      ariaLabel: `Completed set ${set.setIndex}: ${loadDisplay} for ${repetitionAriaValue}`,
    };
  });

const buildUnilateralRows = (
  completedSets: CompletedExerciseSet[],
  repetitionKind: RepetitionKind,
): Omit<HistoryRow, "canDelete">[] => {
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
      const leftReps = formatSetRepetitionDisplay(grouped.left, repetitionKind);
      const leftRepsAriaValue = formatSetRepetitionAriaValue(grouped.left, repetitionKind);
      const rightLoad = grouped.right ? formatLoadWithUnitDisplay(grouped.right.loadValue) : "";
      const rightReps = formatSetRepetitionDisplay(grouped.right, repetitionKind);
      const rightRepsAriaValue = formatSetRepetitionAriaValue(grouped.right, repetitionKind);

      const ariaLabel =
        grouped.right && grouped.left
          ? `Completed set ${setIndex}: left ${leftLoad} for ${leftRepsAriaValue}, right ${rightLoad} for ${rightRepsAriaValue}`
          : `Completed set ${setIndex}: left ${leftLoad} for ${leftRepsAriaValue}, right side pending`;

      return {
        setIndex,
        cells: [String(setIndex), leftLoad, leftReps, rightLoad, rightReps],
        ariaLabel,
      };
    });
};

const markLatestRowDeletable = (rows: Omit<HistoryRow, "canDelete">[]): HistoryRow[] =>
  rows.map((row, index) => ({
    ...row,
    canDelete: index === rows.length - 1,
  }));

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
      rows: markLatestRowDeletable(buildUnilateralRows(completedSets, repetitionKind)),
    };
  }

  return {
    mode: "bilateral",
    headerCells: ["Set", "kg", repetitionHeader],
    rows: markLatestRowDeletable(buildBilateralRows(completedSets, repetitionKind)),
  };
};
