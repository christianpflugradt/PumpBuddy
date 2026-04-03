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

  it("builds unilateral rows with both sides merged by set index while keeping bilateral layout stable", () => {
    const unilateralSets: CompletedExerciseSet[] = [
      { setIndex: 2, setSide: "LEFT", loadValue: 22, reps: 10 },
      { setIndex: 2, setSide: "RIGHT", loadValue: 24, reps: 9 },
    ];
    const bilateralSets: CompletedExerciseSet[] = [
      { setIndex: 1, setSide: "BILATERAL", loadValue: 60, reps: 8 },
    ];

    const unilateralModel = buildCompletedSetHistoryModel(unilateralSets, "UNILATERAL");
    const bilateralModel = buildCompletedSetHistoryModel(bilateralSets, "BILATERAL");

    expect(unilateralModel.headerCells).toEqual(["Set", "kg (L)", "reps (L)", "kg (R)", "reps (R)"]);
    expect(unilateralModel.rows).toEqual([
      {
        setIndex: 2,
        cells: ["2", "22 kg", "10", "24 kg", "9"],
        ariaLabel: "Completed set 2: left 22 kg for 10 reps, right 24 kg for 9 reps",
      },
    ]);

    expect(bilateralModel.headerCells).toEqual(["Set", "kg", "reps"]);
    expect(bilateralModel.rows).toEqual([
      {
        setIndex: 1,
        cells: ["1", "60 kg", "8"],
        ariaLabel: "Completed set 1: 60 kg for 8 reps",
      },
    ]);
  });

  it("uses secs header labels for timed variants", () => {
    const bilateralModel = buildCompletedSetHistoryModel(
      [{ setIndex: 1, setSide: "BILATERAL", loadValue: 0, reps: 125 }],
      "BILATERAL",
      "SECS",
    );
    const unilateralModel = buildCompletedSetHistoryModel(
      [{ setIndex: 1, setSide: "LEFT", loadValue: 0, reps: 42 }],
      "UNILATERAL",
      "SECS",
    );

    expect(bilateralModel.headerCells).toEqual(["Set", "kg", "secs"]);
    expect(unilateralModel.headerCells).toEqual(["Set", "kg (L)", "secs (L)", "kg (R)", "secs (R)"]);
  });
});
