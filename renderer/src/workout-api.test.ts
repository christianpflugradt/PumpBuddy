import { describe, expect, it, vi } from "vitest";
import { createActiveWorkoutApi, createFetchJson } from "./workout-api";

describe("workout-api credentials", () => {
  it("uses same-origin credentials for fetchJson", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const fetchJson = createFetchJson(fetchMock as unknown as typeof fetch);
    await fetchJson("/api/training-plans");

    expect(fetchMock).toHaveBeenCalledWith("/api/training-plans", {
      credentials: "same-origin",
    });
  });

  it("uses same-origin credentials for JSON submissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "w1" }),
    });
    const api = createActiveWorkoutApi(fetchMock as unknown as typeof fetch);

    await api.createWorkout?.({} as never);

    expect(fetchMock).toHaveBeenCalledWith("/api/workouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    });
  });

  it("uses same-origin credentials for body-less submissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });
    const api = createActiveWorkoutApi(fetchMock as unknown as typeof fetch);

    await api.cancelActiveWorkout("abc");

    expect(fetchMock).toHaveBeenCalledWith("/api/active-workout/abc", {
      method: "DELETE",
      credentials: "same-origin",
    });
  });
});
