import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorLoadProfilesScreenTag,
  registerPbConfiguratorLoadProfilesScreen,
  type ConfiguratorLoadProfilesScreenState,
} from "./pb-configurator-load-profiles-screen";

describe("pb-configurator-load-profiles-screen", () => {
  beforeEach(() => {
    registerPbConfiguratorLoadProfilesScreen();
  });

  const createState = (): ConfiguratorLoadProfilesScreenState => ({
    mode: "list",
    loadProfiles: [
      {
        id: "profile-new",
        name: "Alpha Draft",
        status: "new",
        definition_kind: "fixed_list",
        weight_unit: "KG",
        station_count: 0,
      },
      {
        id: "profile-active",
        name: "Bravo Active",
        status: "active",
        definition_kind: "formula",
        weight_unit: "LBS",
        station_count: 3,
      },
      {
        id: "profile-inactive",
        name: "Charlie Inactive",
        status: "inactive",
        definition_kind: "fixed_list",
        weight_unit: "KG",
        station_count: 1,
      },
    ],
    selectedLoadProfile: null,
    isLoading: false,
    errorMessage: null,
  });

  it("renders mobile-first load profile cards with status, definition, usage, and inactive divider", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag) as HTMLElement & {
      state: ConfiguratorLoadProfilesScreenState;
    };
    document.body.append(el);
    el.state = createState();

    expect(el.textContent ?? "").toContain("Configurator");
    expect(el.textContent ?? "").toContain("Load Profiles");
    expect(el.textContent ?? "").toContain("Alpha Draft");
    expect(el.textContent ?? "").toContain("Draft");
    expect(el.textContent ?? "").toContain("Fixed list · KG");
    expect(el.textContent ?? "").toContain("Not used by any stations");
    expect(el.textContent ?? "").toContain("Bravo Active");
    expect(el.textContent ?? "").toContain("Formula · LBS");
    expect(el.textContent ?? "").toContain("Used by 3 stations");
    expect(el.textContent ?? "").toContain("Inactive");
    expect(
      el.querySelector(".configurator-load-profile-card--inactive"),
    ).toBeTruthy();
    expect(
      el.querySelector('[data-ui-action="navigate-workout"]'),
    ).toBeTruthy();
  });

  it("renders loading, error, and empty list states", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag) as HTMLElement & {
      state: ConfiguratorLoadProfilesScreenState;
    };
    document.body.append(el);

    el.state = { ...createState(), loadProfiles: [], isLoading: true };
    expect(el.textContent ?? "").toContain("Loading load profiles...");

    el.state = {
      ...createState(),
      loadProfiles: [],
      errorMessage: "Unable to load load profiles right now.",
    };
    expect(el.textContent ?? "").toContain(
      "Unable to load load profiles right now.",
    );

    el.state = { ...createState(), loadProfiles: [] };
    expect(el.textContent ?? "").toContain("No load profiles available yet.");
  });

  it("emits create and existing-detail actions from the list screen", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag) as HTMLElement & {
      state: ConfiguratorLoadProfilesScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const createButton = el.querySelector(
      '[data-ui-action="start-configurator-load-profile-create"]',
    ) as HTMLButtonElement | null;
    const detailButton = el.querySelector(
      '[data-load-profile-id="profile-active"]',
    ) as HTMLButtonElement | null;

    createButton?.click();
    detailButton?.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]?.[0].detail).toEqual({
      action: "start-configurator-load-profile-create",
    });
    expect(handler.mock.calls[1]?.[0].detail).toEqual({
      action: "open-configurator-load-profile-detail",
      payload: { loadProfileId: "profile-active" },
    });
  });

  it("renders configurator-internal create and detail destinations with a back action", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag) as HTMLElement & {
      state: ConfiguratorLoadProfilesScreenState;
    };
    document.body.append(el);

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    el.state = {
      ...createState(),
      mode: "create",
    };
    expect(el.textContent ?? "").toContain("New Load Profile");
    const backFromCreate = el.querySelector(
      '[data-ui-action="navigate-back-from-configurator-load-profile-detail"]',
    ) as HTMLButtonElement | null;
    backFromCreate?.click();

    el.state = {
      ...createState(),
      mode: "detail",
      selectedLoadProfile: createState().loadProfiles[1] ?? null,
    };
    expect(el.textContent ?? "").toContain("Bravo Active");
    const backFromDetail = el.querySelector(
      '[data-ui-action="navigate-back-from-configurator-load-profile-detail"]',
    ) as HTMLButtonElement | null;
    backFromDetail?.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]?.[0].detail.action).toBe(
      "navigate-back-from-configurator-load-profile-detail",
    );
    expect(handler.mock.calls[1]?.[0].detail.action).toBe(
      "navigate-back-from-configurator-load-profile-detail",
    );
  });

  it("emits workout return action from the configurator side menu", () => {
    const el = document.createElement(pbConfiguratorLoadProfilesScreenTag) as HTMLElement & {
      state: ConfiguratorLoadProfilesScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector(
      '[data-ui-action="navigate-workout"]',
    ) as HTMLButtonElement | null;
    workoutEntry?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.action).toBe("navigate-workout");
  });
});
