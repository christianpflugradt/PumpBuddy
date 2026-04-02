import type { SetSide, SetTrackingMode } from "./workout-types";

type CurrentSetPhaseSource = {
  completedSetsCount: number;
  setTrackingMode?: SetTrackingMode | null;
  currentSetIndex?: number;
  currentSetSide?: SetSide;
};

export type CurrentSetPhase = {
  setIndex: number;
  setSide: SetSide;
  headingLabel: string;
  actionLabel: string;
};

const normalizeSetTrackingMode = (mode: SetTrackingMode | null | undefined): SetTrackingMode =>
  mode === "UNILATERAL" ? "UNILATERAL" : "BILATERAL";

export const resolveCurrentSetPhase = (source: CurrentSetPhaseSource): CurrentSetPhase => {
  const trackingMode = normalizeSetTrackingMode(source.setTrackingMode);
  const fallbackSetIndex = source.completedSetsCount + 1;

  if (trackingMode !== "UNILATERAL") {
    return {
      setIndex: source.currentSetIndex ?? fallbackSetIndex,
      setSide: "BILATERAL",
      headingLabel: "Current Set",
      actionLabel: "Complete Set",
    };
  }

  const side = source.currentSetSide === "RIGHT" ? "RIGHT" : "LEFT";
  return {
    setIndex: source.currentSetIndex ?? fallbackSetIndex,
    setSide: side,
    headingLabel: side === "LEFT" ? "Current Set (Left Side)" : "Current Set (Right Side)",
    actionLabel: side === "LEFT" ? "Complete Left Side" : "Complete Set",
  };
};
