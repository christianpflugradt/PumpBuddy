import { describe, expect, it, vi } from "vitest";
import {
  RequestError,
  createActiveWorkoutApi,
  createFetchJson,
  loadActiveWorkout,
  loadAboutMetadata,
  loadGymDetail,
  loadGymSummaries,
  loadLoadProfileSummaries,
  loadStationDetail,
  loadWorkoutDetail,
  loadWorkoutExercisesPerformance,
  loadWorkoutHistory,
  loadWorkoutProgress,
  loadStartScreenData,
  loadTrainingPlanDetail,
  loadTrainingPlanOptions,
} from "./workout-api";

describe("workout-api credentials", () => {
  const activeWorkoutResponsePayload = () => ({
    workout: {
      id: "aw-1",
      training_plan_id: "plan-1",
      training_plan_name: "Plan",
      gym_id: null,
      gym_name: null,
      started_at: "2026-04-17T10:00:00.000Z",
      updated_at: "2026-04-17T10:05:00.000Z",
      current_exercise_position: 1,
      total_exercise_count: 1,
      exercises: [
        {
          training_plan_exercise_id: "tpe-1",
          position: 1,
          exercise_name: "Squat",
          selected_training_plan_exercise_variant_id: null,
          selected_variant_id: null,
          selected_variant_name: null,
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          selected_station_id: null,
          selected_station_name: null,
          skipped_at: null,
          completed_sets: [],
          suggested_set: {
            set_index: 1,
            set_side: "BILATERAL",
            load_value: 20,
            repetition_kind: "REPS",
            repetition_value: 8,
          },
          next_set: {
            set_index: 1,
            set_side: "BILATERAL",
          },
        },
      ],
    },
  });

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

  it("loads load profile summaries through generated renderer models", async () => {
    const fetchJson = vi.fn().mockResolvedValue([
      {
        id: "profile-1",
        name: "Config Alpha",
        status: "inactive",
        definition_kind: "formula",
        weight_unit: "LBS",
        station_count: 4,
      },
    ]);

    await expect(loadLoadProfileSummaries(fetchJson)).resolves.toEqual([
      {
        id: "profile-1",
        name: "Config Alpha",
        status: "inactive",
        definition_kind: "formula",
        weight_unit: "LBS",
        station_count: 4,
      },
    ]);
    expect(fetchJson).toHaveBeenCalledWith("/api/load-profiles");
  });

  it("uses same-origin credentials for JSON submissions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "w1",
        training_plan_id: "plan-1",
        training_plan_name: "Plan",
        gym_id: null,
        gym_name: null,
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        exercise_count: 1,
        completed_set_count: 1,
        workout_progress_status: "AVAILABLE",
      }),
    });
    const api = createActiveWorkoutApi(fetchMock as unknown as typeof fetch);

    await api.createWorkout?.({
      training_plan_id: "plan-1",
      gym_id: null,
      started_at: "2026-04-17T10:00:00.000Z",
      completed_at: "2026-04-17T10:45:00.000Z",
      exercises: [],
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/workouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        training_plan_id: "plan-1",
        gym_id: null,
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        exercises: [],
      }),
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

  it("posts active-workout set confirmation commands", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => activeWorkoutResponsePayload(),
    });
    const api = createActiveWorkoutApi(fetchMock as unknown as typeof fetch);

    await api.confirmActiveWorkoutSet("aw-1", 2, {
      set: {
        load_value: 12.5,
        repetition_value: 8,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/active-workout/aw-1/exercises/2/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        set: {
          load_value: 12.5,
          repetition_value: 8,
        },
      }),
      credentials: "same-origin",
    });
  });

  it("deletes the latest active-workout set with a JSON response boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => activeWorkoutResponsePayload(),
    });
    const api = createActiveWorkoutApi(fetchMock as unknown as typeof fetch);

    const response = await api.deleteLatestActiveWorkoutSet("aw-1", 2);

    expect(response.workout.id).toBe("aw-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/active-workout/aw-1/exercises/2/sets/latest",
      {
        method: "DELETE",
        credentials: "same-origin",
      },
    );
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
      .mockImplementationOnce(async () => [
        {
          id: "plan-1",
          name: "Plan",
          exercise_count: 3,
          last_completed_at: "2026-04-17T10:00:00.000Z",
          start_selection_rank: 1,
        },
      ])
      .mockImplementationOnce(async () => [{ id: "gym-1", name: "Gym" }]);

    await expect(loadStartScreenData(fetchJson)).resolves.toEqual({
      trainingPlans: [
        {
          id: "plan-1",
          name: "Plan",
          exercise_count: 3,
          last_completed_at: "2026-04-17T10:00:00.000Z",
          start_selection_rank: 1,
        },
      ],
      gyms: [{ id: "gym-1", name: "Gym" }],
    });

    expect(fetchJson).toHaveBeenNthCalledWith(1, "/api/training-plans");
    expect(fetchJson).toHaveBeenNthCalledWith(2, "/api/gyms");
  });

  it("loads enriched gym summaries from backend endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue([
      {
        id: "gym-1",
        name: "Downtown",
        station_count: 8,
        last_visited_at: "2026-04-17T10:45:00.000Z",
      },
    ]);

    await expect(loadGymSummaries(fetchJson)).resolves.toEqual([
      {
        id: "gym-1",
        name: "Downtown",
        station_count: 8,
        last_visited_at: "2026-04-17T10:45:00.000Z",
      },
    ]);

    expect(fetchJson).toHaveBeenCalledWith("/api/gyms");
  });

  it("loads gym detail from backend endpoint with encoded id", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      id: "gym/1",
      name: "Downtown",
      station_count: 1,
      last_visited_at: null,
      stations: [
        {
          id: "station-1",
          name: "Rack",
          load_profile_name: "Barbell",
          suitable_variant_count: 4,
        },
      ],
      exercise_groups: [
        {
          exercise_id: "exercise-1",
          exercise_name: "Squat",
          variants: [
            {
              variant_id: "variant-1",
              variant_name: "Back Squat",
              requires_station: true,
              station_availability: "SINGLE_STATION",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              station_options: [{ station_id: "station-1", station_name: "Rack" }],
            },
          ],
        },
      ],
    });

    await expect(loadGymDetail(fetchJson, "gym/1")).resolves.toEqual({
      id: "gym/1",
      name: "Downtown",
      station_count: 1,
      last_visited_at: null,
      stations: [
        {
          id: "station-1",
          name: "Rack",
          load_profile_name: "Barbell",
          suitable_variant_count: 4,
        },
      ],
      exercise_groups: [
        {
          exercise_id: "exercise-1",
          exercise_name: "Squat",
          variants: [
            {
              variant_id: "variant-1",
              variant_name: "Back Squat",
              requires_station: true,
              station_availability: "SINGLE_STATION",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              station_options: [{ station_id: "station-1", station_name: "Rack" }],
            },
          ],
        },
      ],
    });

    expect(fetchJson).toHaveBeenCalledWith("/api/gyms/gym%2F1");
  });

  it("loads station detail from backend endpoint with encoded ids", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      gym_id: "gym/1",
      gym_name: "Downtown",
      station_id: "station/1",
      station_name: "Rack",
      load_profile: {
        id: "profile-1",
        name: "Barbell",
        weight_unit: "KG",
        definition_kind: "fixed_list",
        possible_loads_kg: [20, 22.5, 25],
      },
      suitable_variant_groups: [
        {
          exercise_id: "exercise-1",
          exercise_name: "Squat",
          variants: [
            {
              variant_id: "variant-1",
              variant_name: "Back Squat",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
            },
          ],
        },
      ],
    });

    await expect(loadStationDetail(fetchJson, "gym/1", "station/1")).resolves.toEqual({
      gym_id: "gym/1",
      gym_name: "Downtown",
      station_id: "station/1",
      station_name: "Rack",
      load_profile: {
        id: "profile-1",
        name: "Barbell",
        weight_unit: "KG",
        definition_kind: "fixed_list",
        possible_loads_kg: [20, 22.5, 25],
      },
      suitable_variant_groups: [
        {
          exercise_id: "exercise-1",
          exercise_name: "Squat",
          variants: [
            {
              variant_id: "variant-1",
              variant_name: "Back Squat",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
            },
          ],
        },
      ],
    });

    expect(fetchJson).toHaveBeenCalledWith("/api/gyms/gym%2F1/stations/station%2F1");
  });

  it("loads about metadata from backend endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      app_version: "0.1.0",
      commit_hash_short: "abc1234",
      build_timestamp_utc: "2026-04-13 07:30 UTC",
      channel: "stable",
    });

    await expect(loadAboutMetadata(fetchJson)).resolves.toEqual({
      app_version: "0.1.0",
      commit_hash_short: "abc1234",
      build_timestamp_utc: "2026-04-13 07:30 UTC",
      channel: "stable",
    });
    expect(fetchJson).toHaveBeenCalledWith("/api/about");
  });

  it("loads workout history from backend endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue([
      {
        id: "w1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);

    await expect(loadWorkoutHistory(fetchJson)).resolves.toEqual([
      {
        id: "w1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ]);
    expect(fetchJson).toHaveBeenCalledWith("/api/workouts");
  });

  it("loads workout detail from backend endpoint with encoded id", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      id: "w/1",
      hero: {
        training_plan_name: "Plan",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        duration_minutes: 45,
        gym_name: "Gym",
      },
      completion_stats: {
        exercise_count: 1,
        completed_set_count: 1,
        average_duration_minutes: 42,
        workout_progress: 1.01,
        workout_progress_status: "AVAILABLE",
      },
      exercises: [],
    });

    await expect(loadWorkoutDetail(fetchJson, "w/1")).resolves.toEqual({
      id: "w/1",
      hero: {
        training_plan_name: "Plan",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        duration_minutes: 45,
        gym_name: "Gym",
      },
      completion_stats: {
        exercise_count: 1,
        completed_set_count: 1,
        average_duration_minutes: 42,
        workout_progress: 1.01,
        workout_progress_status: "AVAILABLE",
      },
      exercises: [],
    });

    expect(fetchJson).toHaveBeenCalledWith("/api/workouts/w%2F1");
  });

  it("loads workout progress from backend endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      workouts: [
        {
          id: "w1",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-17T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
    });

    await expect(loadWorkoutProgress(fetchJson)).resolves.toEqual({
      workouts: [
        {
          id: "w1",
          training_plan_name: "Leg Day",
          completed_at: "2026-04-17T10:45:00.000Z",
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
    });
    expect(fetchJson).toHaveBeenCalledWith("/api/workouts/progress");
  });

  it("loads exercises performance from backend endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      groups: [
        {
          tone: "YELLOW",
          rows: [
            {
              variant_id: "v1",
              variant_name: "Cable Row",
              last_performed_at: "2026-04-17T10:45:00.000Z",
              last_performed_days_ago: 4,
              last_performed_first_set_display: "60 kg x 8 reps",
              selected_station_average_score_30d: 1.0,
              variant_session_count_30d: 6,
              performance_status: "AVAILABLE",
              performance_tone: "YELLOW",
            },
          ],
        },
      ],
    });

    await expect(loadWorkoutExercisesPerformance(fetchJson)).resolves.toEqual({
      groups: [
        {
          tone: "YELLOW",
          rows: [
            {
              variant_id: "v1",
              variant_name: "Cable Row",
              last_performed_at: "2026-04-17T10:45:00.000Z",
              last_performed_days_ago: 4,
              last_performed_first_set_display: "60 kg x 8 reps",
              selected_station_average_score_30d: 1.0,
              variant_session_count_30d: 6,
              performance_status: "AVAILABLE",
              performance_tone: "YELLOW",
            },
          ],
        },
      ],
    });
    expect(fetchJson).toHaveBeenCalledWith("/api/workouts/exercises-performance");
  });

  it("encodes training plan id in detail endpoint", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      id: "plan/with/slash",
      name: "Plan",
      selected_gym_id: null,
      is_executable: null,
      execution_status: null,
      execution_summary: null,
      exercises: [
        {
          training_plan_exercise_id: "exercise-1",
          exercise_name: "Squat",
          exercise_position: 1,
          configured_variant_count: 1,
          executable_variant_count: null,
          execution_status: null,
          variants: [
            {
              id: "option-1",
              training_plan_exercise_id: "exercise-1",
              variant_id: "variant-1",
              variant_name: "Bodyweight",
              requires_station: false,
              rep_min: null,
              rep_max: 60,
              target_sets: 3,
              repetition_kind: "SECS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              availability: null,
              compatible_stations: [],
            },
          ],
        },
      ],
    });

    await expect(loadTrainingPlanDetail(fetchJson, "plan/with/slash")).resolves.toEqual({
      id: "plan/with/slash",
      name: "Plan",
      selected_gym_id: null,
      is_executable: null,
      execution_status: null,
      execution_summary: null,
      exercises: [
        {
          training_plan_exercise_id: "exercise-1",
          exercise_name: "Squat",
          exercise_position: 1,
          configured_variant_count: 1,
          executable_variant_count: null,
          execution_status: null,
          variants: [
            {
              id: "option-1",
              training_plan_exercise_id: "exercise-1",
              variant_id: "variant-1",
              variant_name: "Bodyweight",
              requires_station: false,
              rep_min: null,
              rep_max: 60,
              target_sets: 3,
              repetition_kind: "SECS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              availability: null,
              compatible_stations: [],
            },
          ],
        },
      ],
    });

    expect(fetchJson).toHaveBeenCalledWith("/api/training-plans/plan%2Fwith%2Fslash");
  });

  it("loads selected-gym training plan detail through generated contract adapters", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      id: "plan/with/slash",
      name: "Plan",
      selected_gym_id: "gym with/slash",
      is_executable: false,
      execution_status: "RED",
      execution_summary: "1 of 1 exercise has no executable variant.",
      exercises: [
        {
          training_plan_exercise_id: "exercise-1",
          exercise_name: "Squat",
          exercise_position: 1,
          configured_variant_count: 2,
          executable_variant_count: 1,
          execution_status: "YELLOW",
          variants: [
            {
              id: "option-1",
              training_plan_exercise_id: "exercise-1",
              variant_id: "variant-1",
              variant_name: "Back Squat",
              requires_station: true,
              rep_min: 5,
              rep_max: 8,
              target_sets: 3,
              repetition_kind: "REPS",
              load_input_mode: "PER_SIDE",
              set_tracking_mode: "UNILATERAL",
              availability: "AVAILABLE",
              compatible_stations: [
                {
                  station_id: "station-1",
                  station_name: "Rack",
                  station_profile_loads_kg: [10, 12.5, 15],
                },
              ],
            },
            {
              id: "option-2",
              training_plan_exercise_id: "exercise-1",
              variant_id: "variant-2",
              variant_name: "Box Squat",
              requires_station: true,
              rep_min: null,
              rep_max: null,
              target_sets: null,
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              availability: "NOT_AVAILABLE",
              compatible_stations: [],
            },
          ],
        },
      ],
    });

    await expect(
      loadTrainingPlanDetail(fetchJson, "plan/with/slash", "gym with/slash"),
    ).resolves.toEqual({
      id: "plan/with/slash",
      name: "Plan",
      selected_gym_id: "gym with/slash",
      is_executable: false,
      execution_status: "RED",
      execution_summary: "1 of 1 exercise has no executable variant.",
      exercises: [
        {
          training_plan_exercise_id: "exercise-1",
          exercise_name: "Squat",
          exercise_position: 1,
          configured_variant_count: 2,
          executable_variant_count: 1,
          execution_status: "YELLOW",
          variants: [
            {
              id: "option-1",
              training_plan_exercise_id: "exercise-1",
              variant_id: "variant-1",
              variant_name: "Back Squat",
              requires_station: true,
              rep_min: 5,
              rep_max: 8,
              target_sets: 3,
              repetition_kind: "REPS",
              load_input_mode: "PER_SIDE",
              set_tracking_mode: "UNILATERAL",
              availability: "AVAILABLE",
              compatible_stations: [
                {
                  station_id: "station-1",
                  station_name: "Rack",
                  station_profile_loads_kg: [10, 12.5, 15],
                },
              ],
            },
            {
              id: "option-2",
              training_plan_exercise_id: "exercise-1",
              variant_id: "variant-2",
              variant_name: "Box Squat",
              requires_station: true,
              rep_min: null,
              rep_max: null,
              target_sets: null,
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              availability: "NOT_AVAILABLE",
              compatible_stations: [],
            },
          ],
        },
      ],
    });

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/training-plans/plan%2Fwith%2Fslash?gymId=gym%20with%2Fslash",
    );
  });

  it("loads training plan options through generated contract adapters", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      training_plan_id: "plan/with/slash",
      gym_id: "gym with space",
      exercise_variants: [
        {
          id: "opt-1",
          training_plan_exercise_id: "exercise-1",
          exercise_name: "Squat",
          exercise_position: 1,
          rep_min: null,
          rep_max: null,
          target_sets: null,
          variant_id: "variant-1",
          variant_name: "Bodyweight",
          repetition_kind: "SECS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          station_id: null,
          station_name: null,
          station_profile_loads_kg: null,
          suggested_start_load_kg: null,
          last_completed_at: "2026-04-17T10:00:00.000Z",
          fallback_selection_rank: 1,
        },
      ],
    });

    await expect(
      loadTrainingPlanOptions(fetchJson, "plan/with/slash", "gym with space"),
    ).resolves.toEqual({
      training_plan_id: "plan/with/slash",
      gym_id: "gym with space",
      exercise_variants: [
        {
          id: "opt-1",
          training_plan_exercise_id: "exercise-1",
          exercise_name: "Squat",
          exercise_position: 1,
          rep_min: null,
          rep_max: null,
          target_sets: null,
          variant_id: "variant-1",
          variant_name: "Bodyweight",
          repetition_kind: "SECS",
          load_input_mode: "TOTAL",
          set_tracking_mode: "BILATERAL",
          station_id: null,
          station_name: null,
          station_profile_loads_kg: [],
          suggested_start_load_kg: null,
          last_completed_at: "2026-04-17T10:00:00.000Z",
          fallback_selection_rank: 1,
        },
      ],
    });

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/training-plans/plan%2Fwith%2Fslash/options?gymId=gym%20with%20space",
    );
  });

  it("loads active-workout-scoped training plan options when resuming configured workouts", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      training_plan_id: "plan/with/slash",
      gym_id: "gym with space",
      exercise_variants: [],
    });

    await loadTrainingPlanOptions(
      fetchJson,
      "plan/with/slash",
      "gym with space",
      "active workout/1",
    );

    expect(fetchJson).toHaveBeenCalledWith(
      "/api/training-plans/plan%2Fwith%2Fslash/options?gymId=gym%20with%20space&activeWorkoutId=active%20workout%2F1",
    );
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
