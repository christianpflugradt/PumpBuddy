import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbGymDetailScreenTag,
  registerPbGymDetailScreen,
  type GymDetailScreenState,
} from "./pb-gym-detail-screen";

describe("pb-gym-detail-screen", () => {
  beforeEach(() => {
    registerPbGymDetailScreen();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  const createState = (): GymDetailScreenState => ({
    gymId: "gym-1",
    activeSheet: "stations",
    isLoading: false,
    errorMessage: null,
    stationChooser: null,
    detail: {
      id: "gym-1",
      name: "Downtown",
      station_count: 2,
      last_visited_at: null,
      stations: [
        {
          id: "station-b",
          name: "Z Rack",
          load_profile_name: "Barbell",
          suitable_variant_count: 6,
        },
        {
          id: "station-a",
          name: "A Cable",
          load_profile_name: "Cable Stack",
          suitable_variant_count: 1,
        },
      ],
      exercise_groups: [
        {
          exercise_id: "exercise-2",
          exercise_name: "Squat",
          variants: [
            {
              variant_id: "variant-multi",
              variant_name: "Back Squat",
              requires_station: true,
              station_availability: "MULTI_STATION",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              station_options: [
                { station_id: "station-b", station_name: "Z Rack" },
                { station_id: "station-a", station_name: "A Cable" },
              ],
            },
          ],
        },
        {
          exercise_id: "exercise-1",
          exercise_name: "Pushup",
          variants: [
            {
              variant_id: "variant-stationless",
              variant_name: "Pushup",
              requires_station: false,
              station_availability: "STATIONLESS",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
              station_options: [],
            },
          ],
        },
      ],
    },
  });

  it("opens with Stations selected and lists stations alphabetically", () => {
    const el = document.createElement(pbGymDetailScreenTag) as HTMLElement & { state: GymDetailScreenState };
    document.body.append(el);

    el.state = createState();

    const stationsTab = el.querySelector('[data-sheet="stations"]') as HTMLButtonElement;
    const exercisesTab = el.querySelector('[data-sheet="exercises"]') as HTMLButtonElement;
    const firstStation = el.querySelector('[data-station-id="station-a"]') as HTMLButtonElement;
    const secondStation = el.querySelector('[data-station-id="station-b"]') as HTMLButtonElement;
    expect(stationsTab.getAttribute("aria-pressed")).toBe("true");
    expect(exercisesTab.getAttribute("aria-pressed")).toBe("false");
    expect(el.textContent ?? "").toContain("A Cable");
    expect(el.textContent ?? "").toContain("Z Rack");
    expect(firstStation.compareDocumentPosition(secondStation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("emits sheet and station navigation actions", () => {
    const el = document.createElement(pbGymDetailScreenTag) as HTMLElement & { state: GymDetailScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const exercisesTab = el.querySelector('[data-sheet="exercises"]') as HTMLButtonElement;
    exercisesTab.click();

    const stationRow = el.querySelector('[data-station-id="station-a"]') as HTMLButtonElement;
    stationRow.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "switch-gym-detail-sheet",
      payload: { sheet: "exercises" },
    });
    expect(handler.mock.calls[1][0].detail).toEqual({
      action: "open-station-detail",
      payload: { stationId: "station-a" },
    });
  });

  it("renders exercise variants with station metadata and emits variant action", () => {
    const el = document.createElement(pbGymDetailScreenTag) as HTMLElement & { state: GymDetailScreenState };
    document.body.append(el);
    el.state = { ...createState(), activeSheet: "exercises" };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const stationlessRow = el.querySelector('[data-variant-id="variant-stationless"]') as HTMLButtonElement;
    const multiRow = el.querySelector('[data-variant-id="variant-multi"]') as HTMLButtonElement;
    expect(el.textContent ?? "").toContain("Stationless");
    expect(el.textContent ?? "").toContain("2 stations");
    expect(stationlessRow.compareDocumentPosition(multiRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    stationlessRow.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "open-gym-variant",
      payload: { variantId: "variant-stationless" },
    });
  });

  it("emits chooser selection and dismissal actions", () => {
    const el = document.createElement(pbGymDetailScreenTag) as HTMLElement & { state: GymDetailScreenState };
    document.body.append(el);
    el.state = {
      ...createState(),
      activeSheet: "exercises",
      stationChooser: {
        variantId: "variant-multi",
        exerciseName: "Squat",
        variantName: "Back Squat",
        stationOptions: [
          { station_id: "station-b", station_name: "Z Rack" },
          { station_id: "station-a", station_name: "A Cable" },
        ],
      },
    };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const option = el.querySelector('[data-ui-action="choose-gym-variant-station"]') as HTMLButtonElement;
    const dismiss = el.querySelector('[data-ui-action="dismiss-gym-station-chooser"]') as HTMLButtonElement;
    option.click();
    dismiss.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "choose-gym-variant-station",
      payload: { stationId: "station-a" },
    });
    expect(handler.mock.calls[1][0].detail).toEqual({ action: "dismiss-gym-station-chooser" });
  });

  it("dismisses the chooser on outside pointerdown when state is set before connection", () => {
    const el = document.createElement(pbGymDetailScreenTag) as HTMLElement & { state: GymDetailScreenState };
    el.state = {
      ...createState(),
      activeSheet: "exercises",
      stationChooser: {
        variantId: "variant-multi",
        exerciseName: "Squat",
        variantName: "Back Squat",
        stationOptions: [
          { station_id: "station-b", station_name: "Z Rack" },
          { station_id: "station-a", station_name: "A Cable" },
        ],
      },
    };
    document.body.append(el);

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "dismiss-gym-station-chooser" });
  });
});
