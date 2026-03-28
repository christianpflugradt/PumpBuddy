import { describe, it, expect, vi } from "vitest";
import { createApp } from "./workout-controller";

describe("workout-controller (createApp)", () => {
  it("initializes without crashing", () => {
    const app = document.createElement("div");

    createApp(
      app,
      vi.fn(),
      {
        createActiveWorkout: vi.fn(),
        updateActiveWorkout: vi.fn(),
        cancelActiveWorkout: vi.fn(),
        completeActiveWorkout: vi.fn(),
      } as any,
      () => "now",
    );

    expect(app.innerHTML).toBeDefined();
  });
});
