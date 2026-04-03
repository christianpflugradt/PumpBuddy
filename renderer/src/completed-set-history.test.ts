import { describe, expect, it } from "vitest";
import { buildCompletedSetHistoryModel } from "./completed-set-history";
import type { CompletedExerciseSet } from "./workout-types";

describe("completed-set-history", () => {
  it("builds bilateral rows as Set|kg|reps", () => {
    const completedSets: CompletedExerciseSet[] = [{ setIndex: 1, setSide: "BILATERAL", loadValue: 60, reps: 8 }];

    const model = buildCompletedSetHistoryModel(completedSets, "BILATERAL");

    expect(model.headerCells).toEqual(["Set", "kg", "reps"]);
    expect(model.rows).toEqual([
      {
        setIndex: 1,
        cells: ["1", "60 kg", "8"],
        ariaLabel: "Completed set 1: 60 kg for 8 reps",
      },
    ]);
  });

  it("builds unilateral rows with blank right-side cells when only left exists", () => {
    const completedSets: CompletedExerciseSet[] = [{ setIndex: 3, setSide: "LEFT", loadValue: 24, reps: 10 }];

    const model = buildCompletedSetHistoryModel(completedSets, "UNILATERAL");

    expect(model.headerCells).toEqual(["Set", "kg (L)", "reps (L)", "kg (R)", "reps (R)"]);
    expect(model.rows).toEqual([
      {
        setIndex: 3,
        cells: ["3", "24 kg", "10", "", ""],
        ariaLabel: "Completed set 3: left 24 kg for 10 reps, right side pending",
      },
    ]);
  });
});
