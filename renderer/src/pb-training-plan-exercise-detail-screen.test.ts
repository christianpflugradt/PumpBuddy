import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbTrainingPlanExerciseDetailScreenTag,
  registerPbTrainingPlanExerciseDetailScreen,
  type TrainingPlanExerciseDetailScreenState,
} from "./pb-training-plan-exercise-detail-screen";
import type {
  TrainingPlanExerciseDetail,
  TrainingPlanExerciseVariantDetail,
} from "./workout-contract";

const createVariant = (
  overrides: Partial<TrainingPlanExerciseVariantDetail> = {},
): TrainingPlanExerciseVariantDetail => ({
  id: "tpv-1",
  training_plan_exercise_id: "exercise-1",
  variant_id: "variant-1",
  variant_name: "Back Squat",
  requires_station: true,
  rep_min: null,
  rep_max: null,
  target_sets: null,
  repetition_kind: "REPS",
  load_input_mode: "TOTAL",
  set_tracking_mode: "BILATERAL",
  availability: null,
  compatible_stations: [],
  ...overrides,
});

const createExercise = (
  variants: TrainingPlanExerciseVariantDetail[],
  overrides: Partial<TrainingPlanExerciseDetail> = {},
): TrainingPlanExerciseDetail => ({
  training_plan_exercise_id: "exercise-1",
  exercise_name: "Squat",
  exercise_position: 1,
  configured_variant_count: variants.length,
  executable_variant_count: null,
  execution_status: null,
  variants,
  ...overrides,
});

const createState = (
  overrides: Partial<TrainingPlanExerciseDetailScreenState> = {},
): TrainingPlanExerciseDetailScreenState => ({
  trainingPlanId: "plan-1",
  trainingPlanExerciseId: "exercise-1",
  selectedGymId: null,
  selectedGymName: null,
  planName: "Leg Day",
  exercise: createExercise([createVariant()]),
  totalExercises: 3,
  isLoading: false,
  errorMessage: null,
  ...overrides,
});

const appendScreen = (state: TrainingPlanExerciseDetailScreenState): HTMLElement => {
  const el = document.createElement(pbTrainingPlanExerciseDetailScreenTag) as HTMLElement & {
    state: TrainingPlanExerciseDetailScreenState;
  };
  document.body.append(el);
  el.state = state;
  return el;
};

const variantCard = (el: HTMLElement, variantName: string): HTMLElement => {
  const card =
    Array.from(el.querySelectorAll<HTMLElement>(".training-plan-exercise-detail-variant-card")).find(
      (candidate) => (candidate.textContent ?? "").includes(variantName),
    ) ?? null;
  expect(card).toBeTruthy();
  return card!;
};

describe("pb-training-plan-exercise-detail-screen", () => {
  beforeEach(() => {
    registerPbTrainingPlanExerciseDetailScreen();
  });

  it("renders all variants and conditionally formats target cases", () => {
    const el = appendScreen(
      createState({
        exercise: createExercise([
          createVariant({ id: "tpv-min", variant_id: "variant-min", variant_name: "Minimum", rep_min: 8 }),
          createVariant({ id: "tpv-max", variant_id: "variant-max", variant_name: "Maximum", rep_max: 12 }),
          createVariant({
            id: "tpv-range",
            variant_id: "variant-range",
            variant_name: "Range",
            rep_min: 8,
            rep_max: 12,
          }),
          createVariant({ id: "tpv-sets", variant_id: "variant-sets", variant_name: "Sets", target_sets: 3 }),
          createVariant({
            id: "tpv-combined",
            variant_id: "variant-combined",
            variant_name: "Combined",
            target_sets: 4,
            rep_min: 30,
            rep_max: 45,
            repetition_kind: "SECS",
          }),
          createVariant({ id: "tpv-empty", variant_id: "variant-empty", variant_name: "Empty Target" }),
        ]),
      }),
    );

    expect(el.querySelectorAll(".training-plan-exercise-detail-variant-card")).toHaveLength(6);
    expect(el.textContent ?? "").toContain("1st Exercise in Plan");
    expect(el.querySelector(".training-plan-exercise-detail-overview")).toBeNull();
    expect(el.textContent ?? "").not.toContain("Position in plan");
    expect(el.textContent ?? "").not.toContain("Exercise overview");
    expect(variantCard(el, "Minimum").textContent ?? "").not.toContain("TARGET");
    expect(variantCard(el, "Minimum").textContent ?? "").toContain("at least 8 reps");
    expect(variantCard(el, "Maximum").textContent ?? "").toContain("at most 12 reps");
    expect(variantCard(el, "Range").textContent ?? "").toContain("8-12 reps");
    expect(variantCard(el, "Sets").textContent ?? "").toContain("3 sets");
    expect(variantCard(el, "Combined").textContent ?? "").toContain("4 sets · 30-45 sec");
    expect(variantCard(el, "Empty Target").querySelector(".training-plan-exercise-detail-target")).toBeNull();
  });

  it("omits selected-gym availability and station rows in no-gym mode", () => {
    const el = appendScreen(
      createState({
        selectedGymId: null,
        selectedGymName: null,
        exercise: createExercise(
          [
            createVariant({
              variant_name: "Unavailable Rack Squat",
              availability: "NOT_AVAILABLE",
              compatible_stations: [{ station_id: "station-1", station_name: "Rack" }],
            }),
            createVariant({
              id: "tpv-2",
              variant_id: "variant-2",
              variant_name: "Stationless Squat",
              requires_station: false,
              availability: "AVAILABLE",
            }),
          ],
          { exercise_position: 2 },
        ),
      }),
    );

    expect(el.textContent ?? "").toContain("Unavailable Rack Squat");
    expect(el.textContent ?? "").toContain("2nd Exercise in Plan");
    expect(el.textContent ?? "").toContain("Stationless Squat");
    expect(el.querySelector(".training-plan-exercise-detail-availability")).toBeNull();
    expect(el.querySelector(".training-plan-exercise-detail-station-row")).toBeNull();
    expect(el.querySelector(".training-plan-exercise-detail-station-status")).toBeNull();
    expect(el.textContent ?? "").not.toContain("Available");
    expect(el.textContent ?? "").not.toContain("Not available");
    expect(el.textContent ?? "").not.toContain("No compatible station in this gym");
    expect(el.textContent ?? "").not.toContain("Available at");
  });

  it("renders selected-gym availability, station rows, unavailable status, and actions", () => {
    const el = appendScreen(
      createState({
        selectedGymId: "gym-1",
        selectedGymName: "Downtown",
        exercise: createExercise([
          createVariant({
            id: "tpv-stationless",
            variant_id: "variant-stationless",
            variant_name: "Air Squat",
            requires_station: false,
            availability: "AVAILABLE",
          }),
          createVariant({
            id: "tpv-single",
            variant_id: "variant-single",
            variant_name: "Box Squat",
            availability: "AVAILABLE",
            compatible_stations: [
              { station_id: "station-1", station_name: "Rack", station_profile_loads_kg: [10, 12.5, 15] },
            ],
          }),
          createVariant({
            id: "tpv-multi",
            variant_id: "variant-multi",
            variant_name: "Back Squat",
            availability: "AVAILABLE",
            compatible_stations: [
              { station_id: "station-2", station_name: "Platform", station_profile_loads_kg: [20] },
              { station_id: "station-1", station_name: "Rack", station_profile_loads_kg: [10, 15, 20] },
            ],
          }),
          createVariant({
            id: "tpv-unavailable",
            variant_id: "variant-unavailable",
            variant_name: "Machine Squat",
            availability: "NOT_AVAILABLE",
            compatible_stations: [],
          }),
        ]),
      }),
    );
    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    expect(el.querySelectorAll(".training-plan-exercise-detail-availability")).toHaveLength(4);
    expect(variantCard(el, "Air Squat").textContent ?? "").toContain("Available");
    expect(variantCard(el, "Box Squat").textContent ?? "").toContain("Available at");
    expect(variantCard(el, "Box Squat").textContent ?? "").toContain("Rack");
    expect(variantCard(el, "Box Squat").textContent ?? "").toContain("10 kg - 15 kg");
    expect(variantCard(el, "Back Squat").textContent ?? "").toContain("Platform");
    expect(variantCard(el, "Back Squat").textContent ?? "").toContain("20 kg");
    expect(variantCard(el, "Machine Squat").textContent ?? "").toContain("Not available");
    expect(variantCard(el, "Machine Squat").textContent ?? "").toContain("Not available in this gym");
    expect(el.querySelectorAll(".training-plan-exercise-detail-station-row")).toHaveLength(3);

    const variantButton = variantCard(el, "Back Squat").querySelector(
      '[data-ui-action="open-training-plan-exercise-variant-detail"]',
    ) as HTMLButtonElement;
    variantButton.click();

    const rackButton =
      Array.from(el.querySelectorAll<HTMLButtonElement>(".training-plan-exercise-detail-station-row")).find(
        (button) => (button.textContent ?? "").includes("Rack"),
      ) ?? null;
    expect(rackButton).toBeTruthy();
    rackButton!.click();

    const backButton = el.querySelector(
      '[data-ui-action="navigate-back-from-training-plan-exercise-detail"]',
    ) as HTMLButtonElement;
    backButton.click();

    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-training-plan-exercise-variant-detail",
      payload: { variantId: "variant-multi" },
    });
    expect(handler.mock.calls[1][0].detail).toEqual({
      action: "open-training-plan-exercise-station-detail",
      payload: { stationId: "station-1" },
    });
    expect(handler.mock.calls[2][0].detail).toEqual({
      action: "navigate-back-from-training-plan-exercise-detail",
    });
  });

  it("renders loading, error, and unavailable states", () => {
    expect(appendScreen(createState({ exercise: null, isLoading: true })).textContent ?? "").toContain(
      "Loading exercise detail...",
    );
    expect(appendScreen(createState({ exercise: null, errorMessage: "Unable to load exercise." })).textContent ?? "").toContain(
      "Unable to load exercise.",
    );
    expect(appendScreen(createState({ exercise: null })).textContent ?? "").toContain(
      "Training plan exercise detail unavailable.",
    );
  });
});
