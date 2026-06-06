import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbStationDetailScreenTag,
  registerPbStationDetailScreen,
  type StationDetailScreenState,
} from "./pb-station-detail-screen";

describe("pb-station-detail-screen", () => {
  beforeEach(() => {
    registerPbStationDetailScreen();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  const createState = (): StationDetailScreenState => ({
    gymId: "gym-1",
    stationId: "station-1",
    stationName: "Rack",
    isLoading: false,
    errorMessage: null,
    loadProfilePopupOpen: false,
    detail: {
      gym_id: "gym-1",
      gym_name: "Downtown",
      station_id: "station-1",
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
          exercise_id: "exercise-2",
          exercise_name: "Squat",
          variants: [
            {
              variant_id: "variant-z",
              variant_name: "Front Squat",
              repetition_kind: "REPS",
              load_input_mode: "PER_SIDE",
              set_tracking_mode: "UNILATERAL",
            },
            {
              variant_id: "variant-a",
              variant_name: "Back Squat",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
            },
          ],
        },
        {
          exercise_id: "exercise-1",
          exercise_name: "Bench Press",
          variants: [
            {
              variant_id: "variant-bench",
              variant_name: "Barbell Bench",
              repetition_kind: "REPS",
              load_input_mode: "TOTAL",
              set_tracking_mode: "BILATERAL",
            },
          ],
        },
      ],
    },
  });

  it("renders station heading, load profile summary, and sorted suitable variants without metadata bubbles", () => {
    const el = document.createElement(pbStationDetailScreenTag) as HTMLElement & {
      state: StationDetailScreenState;
    };
    document.body.append(el);

    el.state = createState();

    expect(el.textContent ?? "").toContain("Rack");
    expect(el.textContent ?? "").toContain("Downtown");
    expect(el.textContent ?? "").toContain("Barbell");
    expect(el.textContent ?? "").toContain("20 kg - 25 kg");
    expect(el.textContent ?? "").not.toContain("Inspect loads");
    expect(el.querySelector(".station-load-profile-open")).toBeNull();
    const loadSummaryRows = Array.from(el.querySelectorAll(".station-load-profile-summary > div"));
    expect(loadSummaryRows).toHaveLength(3);
    expect(loadSummaryRows[1]?.querySelector("dt")?.textContent?.trim()).toBe("Number of loads");
    expect(loadSummaryRows[1]?.querySelector("dd")?.textContent?.trim()).toBe("3");
    expect(loadSummaryRows[2]?.querySelector("dt")?.textContent?.trim()).toBe("Range");
    expect(loadSummaryRows[2]?.querySelector(".station-load-profile-range-text")?.textContent?.trim()).toBe(
      "20 kg - 25 kg",
    );
    const inspectButton = loadSummaryRows[2]?.querySelector(
      '[data-ui-action="open-station-load-profile"]',
    ) as HTMLButtonElement | null;
    expect(inspectButton).toBeTruthy();
    expect(inspectButton?.classList.contains("station-load-profile-inspect-button")).toBe(true);
    expect(inspectButton?.getAttribute("aria-label")).toBe("Inspect station loads");
    expect(inspectButton?.disabled).toBe(false);
    expect(inspectButton?.textContent?.trim()).toBe("");
    expect(inspectButton?.querySelector("svg")).toBeTruthy();
    expect(el.textContent ?? "").not.toContain("Station ID");
    expect(el.textContent ?? "").not.toContain("station-1");
    expect(el.textContent ?? "").not.toContain("Unit");
    expect(el.textContent ?? "").not.toContain("Definition");
    expect(el.querySelector(".station-detail-meta-grid")).toBeNull();

    const groupNames = Array.from(el.querySelectorAll(".workout-detail-exercise-name")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(groupNames).toEqual(["Bench Press", "Squat"]);

    const variantNames = Array.from(el.querySelectorAll(".station-detail-variant-name")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    expect(variantNames).toEqual(["Barbell Bench", "Back Squat", "Front Squat"]);
  });

  it("emits variant and load profile actions without changing values into controls", () => {
    const el = document.createElement(pbStationDetailScreenTag) as HTMLElement & {
      state: StationDetailScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const profileButton = el.querySelector(".station-load-profile-inspect-button") as HTMLButtonElement;
    profileButton.click();

    const variantButton = el.querySelector('[data-variant-id="variant-a"]') as HTMLButtonElement;
    variantButton.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "open-station-load-profile" });
    expect(handler.mock.calls[1][0].detail).toEqual({
      action: "open-station-variant-detail",
      payload: { variantId: "variant-a" },
    });
  });

  it("keeps the inline inspect control disabled when no possible loads are present", () => {
    const el = document.createElement(pbStationDetailScreenTag) as HTMLElement & {
      state: StationDetailScreenState;
    };
    document.body.append(el);
    const state = createState();
    el.state = {
      ...state,
      detail: {
        ...state.detail!,
        load_profile: {
          ...state.detail!.load_profile,
          possible_loads_kg: [],
        },
      },
    };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    expect(el.textContent ?? "").toContain("No loads provided");
    expect(el.textContent ?? "").not.toContain("Inspect loads");
    expect(el.querySelector(".station-load-profile-open")).toBeNull();
    const inspectButton = el.querySelector(".station-load-profile-inspect-button") as HTMLButtonElement | null;
    expect(inspectButton).toBeTruthy();
    expect(inspectButton?.getAttribute("aria-label")).toBe("Inspect station loads");
    expect(inspectButton?.disabled).toBe(true);

    inspectButton?.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it("renders load profile values read-only and closes only from the close button", () => {
    const el = document.createElement(pbStationDetailScreenTag) as HTMLElement & {
      state: StationDetailScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      loadProfilePopupOpen: true,
    };

    const dialog = el.querySelector('[role="dialog"]');
    const valueList = el.querySelector(".station-load-profile-value-list");
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent ?? "").toContain("20 kg");
    expect(dialog?.textContent ?? "").toContain("22.5 kg");
    expect(dialog?.textContent ?? "").toContain("25 kg");
    expect(valueList?.querySelectorAll("button,input,select,textarea")).toHaveLength(0);

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const backdrop = el.querySelector(".station-load-profile-dialog-backdrop") as HTMLElement;
    backdrop.click();
    expect(handler).not.toHaveBeenCalled();

    const firstValue = el.querySelector(".station-load-profile-value") as HTMLElement;
    firstValue.click();
    expect(handler).not.toHaveBeenCalled();

    const closeButton = el.querySelector('[data-ui-action="dismiss-station-load-profile"]') as HTMLButtonElement;
    closeButton.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "dismiss-station-load-profile" });
  });

  it("renders loading and error states without detail controls", () => {
    const el = document.createElement(pbStationDetailScreenTag) as HTMLElement & {
      state: StationDetailScreenState;
    };
    document.body.append(el);

    el.state = {
      gymId: "gym-1",
      stationId: "station-1",
      stationName: "Rack",
      detail: null,
      isLoading: true,
      errorMessage: null,
      loadProfilePopupOpen: false,
    };
    expect(el.textContent ?? "").toContain("Loading station detail...");
    expect(el.querySelector('[data-ui-action="open-station-load-profile"]')).toBeNull();

    el.state = {
      ...el.state,
      isLoading: false,
      errorMessage: "Unable to load station detail right now.",
    };
    expect(el.textContent ?? "").toContain("Unable to load station detail right now.");
  });
});
