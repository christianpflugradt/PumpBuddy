import type {
  LoadInputMode,
  RepetitionKind,
  SetSide,
  SetTrackingMode,
  WorkoutSetDraft,
  WorkoutSetDraftInput,
} from "./workout-types";
import { formatLoadInputDisplay, LOAD_DISPLAY_DECIMAL_PLACES } from "./workout-load-display";

export const DEFAULT_SUGGESTED_LOAD_KG = 10;
export const DEFAULT_SUGGESTED_REPS = 10;
export const DEFAULT_SUGGESTED_SECS = 0;
export const MIN_REPS = 1;
const PER_SIDE_FACTOR = 2;
export const LOAD_DISPLAY_ROUNDING_TOLERANCE = 1 / 10 ** LOAD_DISPLAY_DECIMAL_PLACES;
export const FLOAT_TOLERANCE = 1e-9;

export type LoadStepDirection = "increase" | "decrease";

const approxEq = (left: number, right: number): boolean => Math.abs(left - right) <= FLOAT_TOLERANCE;

const isValidProfileLoads = (loads: number[]): boolean =>
  loads.length > 0 && loads.every((load) => Number.isFinite(load));

export const normalizeLoadInputMode = (mode: LoadInputMode | null | undefined): LoadInputMode =>
  mode === "PER_SIDE" ? "PER_SIDE" : "TOTAL";

export const normalizeSetTrackingMode = (
  mode: SetTrackingMode | null | undefined,
): SetTrackingMode => (mode === "UNILATERAL" ? "UNILATERAL" : "BILATERAL");

export const normalizeRepetitionKind = (
  kind: string | null | undefined,
): RepetitionKind => (kind === "SECS" ? "SECS" : "REPS");

export const normalizeSetSide = (side: SetSide | null | undefined): SetSide | null => {
  if (side === "LEFT" || side === "RIGHT" || side === "BILATERAL") {
    return side;
  }

  return null;
};

export const toInputLoadValue = (
  canonicalTotalLoadValue: number | null,
  loadInputMode: LoadInputMode | null | undefined,
): number | null => {
  if (canonicalTotalLoadValue === null) {
    return null;
  }

  return normalizeLoadInputMode(loadInputMode) === "PER_SIDE"
    ? canonicalTotalLoadValue / PER_SIDE_FACTOR
    : canonicalTotalLoadValue;
};

export const toCanonicalTotalLoadValue = (
  inputLoadValue: number | null,
  loadInputMode: LoadInputMode | null | undefined,
): number | null => {
  if (inputLoadValue === null) {
    return null;
  }

  return normalizeLoadInputMode(loadInputMode) === "PER_SIDE"
    ? inputLoadValue * PER_SIDE_FACTOR
    : inputLoadValue;
};

const suggestStartSet = (suggestedStartLoadKg: number | null | undefined): WorkoutSetDraft => ({
  loadValue: suggestedStartLoadKg ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: DEFAULT_SUGGESTED_REPS,
});

const suggestStartSecsSet = (
  suggestedStartLoadKg: number | null | undefined,
): WorkoutSetDraft => ({
  loadValue: suggestedStartLoadKg ?? DEFAULT_SUGGESTED_LOAD_KG,
  reps: DEFAULT_SUGGESTED_SECS,
});

export const isStationlessOption = (option: { station_id: string | null }): boolean =>
  option.station_id === null || option.station_id.trim().length === 0;

export const optionSelectionKey = (option: {
  id: string;
  station_id: string | null;
}): string => `${option.id}::${option.station_id ?? ""}`;

export const suggestStartSetForOption = (option: {
  repetition_kind?: string | null;
  station_id: string | null;
  suggested_start_load_kg?: number | null;
}): WorkoutSetDraft =>
  normalizeRepetitionKind(option.repetition_kind) === "SECS"
    ? isStationlessOption(option)
      ? {
          loadValue: null,
          reps: DEFAULT_SUGGESTED_SECS,
        }
      : suggestStartSecsSet(option.suggested_start_load_kg ?? null)
    : isStationlessOption(option)
      ? {
          loadValue: null,
          reps: DEFAULT_SUGGESTED_REPS,
        }
      : suggestStartSet(option.suggested_start_load_kg ?? null);

export const normalizeStationId = (stationId: string | null): string | null =>
  stationId === null || stationId.trim().length === 0 ? null : stationId;

const normalizeLoadForSelection = (
  loadValue: number | null,
  selectedTrainingPlanExerciseVariantId: string | null,
  selectedStationId: string | null,
): number | null =>
  selectedTrainingPlanExerciseVariantId !== null && selectedStationId === null ? null : loadValue;

export const findRoundedCanonicalProfileLoad = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  tolerance: number,
): number | null => {
  if (!isValidProfileLoads(profileLoadsKg) || !Number.isFinite(currentLoadKg)) {
    return null;
  }

  const roundedMatch = profileLoadsKg.find(
    (load) => Math.abs(load - currentLoadKg) <= tolerance,
  );
  return roundedMatch ?? null;
};

export const normalizeLoadForSelectionAndProfile = (
  loadValue: number | null,
  selectedTrainingPlanExerciseVariantId: string | null,
  selectedStationId: string | null,
  selectedStationProfileLoadsKg: number[],
): number | null => {
  const selectionNormalized = normalizeLoadForSelection(
    loadValue,
    selectedTrainingPlanExerciseVariantId,
    selectedStationId,
  );

  if (selectionNormalized === null || selectedStationId === null) {
    return selectionNormalized;
  }

  const roundedCanonical = findRoundedCanonicalProfileLoad(
    selectedStationProfileLoadsKg,
    selectionNormalized,
    LOAD_DISPLAY_ROUNDING_TOLERANCE + FLOAT_TOLERANCE,
  );
  if (roundedCanonical === null) {
    return selectionNormalized;
  }

  if (
    Math.abs(roundedCanonical - selectionNormalized) <=
    LOAD_DISPLAY_ROUNDING_TOLERANCE + FLOAT_TOLERANCE
  ) {
    return roundedCanonical;
  }

  return selectionNormalized;
};

export const stepWithinProfileLoads = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  direction: LoadStepDirection,
): number | null => {
  if (!isValidProfileLoads(profileLoadsKg) || !Number.isFinite(currentLoadKg)) {
    return null;
  }

  const min = profileLoadsKg[0]!;
  const max = profileLoadsKg[profileLoadsKg.length - 1]!;
  const exactIndex = profileLoadsKg.findIndex((load) => approxEq(load, currentLoadKg));

  if (exactIndex >= 0) {
    if (direction === "decrease") {
      return exactIndex === 0 ? min : profileLoadsKg[exactIndex - 1]!;
    }
    return exactIndex + 1 >= profileLoadsKg.length ? max : profileLoadsKg[exactIndex + 1]!;
  }

  if (currentLoadKg <= min) {
    return min;
  }

  if (currentLoadKg >= max) {
    return max;
  }

  const upperIndex = profileLoadsKg.findIndex((load) => load > currentLoadKg);
  if (upperIndex <= 0) {
    return direction === "decrease" ? min : max;
  }

  return direction === "decrease" ? profileLoadsKg[upperIndex - 1]! : profileLoadsKg[upperIndex]!;
};

export const stepWithinProfileLoadsForInputMode = (
  profileLoadsKg: number[],
  currentLoadKg: number,
  _loadInputMode: LoadInputMode | null | undefined,
  direction: LoadStepDirection,
): number | null => stepWithinProfileLoads(profileLoadsKg, currentLoadKg, direction);

export const formatLoadInputValue = (loadValue: number | null): string =>
  formatLoadInputDisplay(loadValue);

export const toDraftSetInput = (
  set: WorkoutSetDraft,
): WorkoutSetDraftInput => ({
  loadValue: formatLoadInputValue(set.loadValue),
  reps: String(set.reps),
});
