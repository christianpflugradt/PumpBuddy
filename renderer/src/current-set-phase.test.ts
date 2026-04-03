import { describe, expect, it } from "vitest";
import { resolveCurrentSetPhase } from "./current-set-phase";

describe("current-set-phase", () => {
  it("defaults unilateral phase to left side when explicit side is missing", () => {
    const phase = resolveCurrentSetPhase({
      completedSetsCount: 1,
      setTrackingMode: "UNILATERAL",
      currentSetIndex: 2,
    });

    expect(phase).toEqual({
      setIndex: 2,
      setSide: "LEFT",
      headingLabel: "Current Set (Left Side)",
      actionLabel: "Complete Left Side",
    });
  });

  it("keeps unilateral right-side phase labels aligned with right-side completion", () => {
    const phase = resolveCurrentSetPhase({
      completedSetsCount: 1,
      setTrackingMode: "UNILATERAL",
      currentSetIndex: 1,
      currentSetSide: "RIGHT",
    });

    expect(phase).toEqual({
      setIndex: 1,
      setSide: "RIGHT",
      headingLabel: "Current Set (Right Side)",
      actionLabel: "Complete Set",
    });
  });

  it("keeps bilateral phase labels canonical", () => {
    const phase = resolveCurrentSetPhase({
      completedSetsCount: 2,
      setTrackingMode: "BILATERAL",
      currentSetIndex: 3,
      currentSetSide: "RIGHT",
    });

    expect(phase).toEqual({
      setIndex: 3,
      setSide: "BILATERAL",
      headingLabel: "Current Set",
      actionLabel: "Complete Set",
    });
  });
});
