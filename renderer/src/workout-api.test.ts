import { describe, expect, it, vi } from "vitest";
import {
  RequestError,
  createActiveWorkoutApi,
  createFetchJson,
  loadActiveWorkout,
  loadStartScreenData,
  loadTrainingPlanDetail,
} from "./workout-api";

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

  it("dispatches unauthorized event and preserves error body for fetchJson", async () => {
    const dispatchEvent = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { dispatchEvent },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Session expired" }),
    });

    const fetchJson = createFetchJson(fetchMock as unknown as typeof fetch);

    await expect(fetchJson("/api/training-plans")).rejects.toMatchObject({
      status: 401,
      message: "Session expired",
      body: { message: "Session expired" },
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toBeInstanceOf(CustomEvent);
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe("pb-unauthorized");
  });

  it("creates fallback request error when error response JSON cannot be parsed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("invalid-json");
      },
    });

    const fetchJson = createFetchJson(fetchMock as unknown as typeof fetch);

    await expect(fetchJson("/api/training-plans")).rejects.toMatchObject({
      status: 500,
      body: null,
      message: "Request failed with status 500",
    });
  });

  it("loadStartScreenData fetches plans and gyms in parallel", async () => {
    const fetchJson = vi
      .fn()
      .mockImplementationOnce(async () => [{ id: "plan-1", name: "Plan", exercise_count: 3 }])
      .mockImplementationOnce(async () => [{ id: "gym-1", name: "Gym" }]);

    await expect(loadStartScreenData(fetchJson)).resolves.toEqual({
      trainingPlans: [{ id: "plan-1", name: "Plan", exercise_count: 3 }],
      gyms: [{ id: "gym-1", name: "Gym" }],
    });

    expect(fetchJson).toHaveBeenNthCalledWith(1, "/api/training-plans");
    expect(fetchJson).toHaveBeenNthCalledWith(2, "/api/gyms");
  });

  it("encodes training plan id in detail endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue({ training_plan_id: "plan/with/slash" });

    await loadTrainingPlanDetail(fetchJson, "plan/with/slash");

    expect(fetchJson).toHaveBeenCalledWith("/api/training-plans/plan%2Fwith%2Fslash");
  });

  it("returns null for active workout 404 responses", async () => {
    const fetchJson = vi.fn().mockRejectedValue(new RequestError(404, { message: "not found" }));

    await expect(loadActiveWorkout(fetchJson)).resolves.toBeNull();
  });

  it("returns null for plain error message containing status 404", async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error("Request failed with status 404"));

    await expect(loadActiveWorkout(fetchJson)).resolves.toBeNull();
  });

  it("rethrows non-404 active workout errors", async () => {
    const rootError = new Error("network down");
    const fetchJson = vi.fn().mockRejectedValue(rootError);

    await expect(loadActiveWorkout(fetchJson)).rejects.toBe(rootError);
  });

  it("propagates request errors from API submit calls", async () => {
    const dispatchEvent = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { dispatchEvent },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Nope" }),
    });
    const api = createActiveWorkoutApi(fetchMock as unknown as typeof fetch);

    await expect(api.cancelActiveWorkout("w1")).rejects.toMatchObject({
      status: 401,
      message: "Nope",
    });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
