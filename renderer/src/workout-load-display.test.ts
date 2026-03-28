import { describe, it, expect } from "vitest";
import { formatLoadDisplayNumber, formatLoadInputDisplay, formatLoadWithUnitDisplay } from "./workout-load-display";

describe("workout-load-display", () => {
  it("formats integers without decimals", () => {
    expect(formatLoadDisplayNumber(10)).toBe("10");
  });

  it("formats decimals with trimming", () => {
    expect(formatLoadDisplayNumber(10.5)).toBe("10.5");
    expect(formatLoadDisplayNumber(10.0)).toBe("10");
  });

  it("returns null for invalid values", () => {
    expect(formatLoadDisplayNumber(null)).toBe(null);
    expect(formatLoadDisplayNumber(NaN)).toBe(null);
  });

  it("formats input display", () => {
    expect(formatLoadInputDisplay(12.34)).toBe("12.34");
    expect(formatLoadInputDisplay(null)).toBe("");
  });

  it("formats with unit", () => {
    expect(formatLoadWithUnitDisplay(15)).toBe("15 kg");
    expect(formatLoadWithUnitDisplay(null)).toBe("—");
  });
});
