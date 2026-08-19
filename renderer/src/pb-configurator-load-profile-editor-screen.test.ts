import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbConfiguratorLoadProfileEditorScreenTag,
  registerPbConfiguratorLoadProfileEditorScreen,
  type ConfiguratorLoadProfileEditorScreenState,
} from "./pb-configurator-load-profile-editor-screen";

describe("pb-configurator-load-profile-editor-screen", () => {
  beforeEach(() => {
    registerPbConfiguratorLoadProfileEditorScreen();
  });

  const createState = (): ConfiguratorLoadProfileEditorScreenState => ({
    mode: "edit",
    loadProfiles: [
      {
        id: "profile-1",
        name: "Alpha Draft",
        status: "new",
        definition_kind: "fixed_list",
        weight_unit: "KG",
        station_count: 0,
      },
      {
        id: "profile-2",
        name: "Bravo Draft",
        status: "new",
        definition_kind: "formula",
        weight_unit: "LBS",
        station_count: 0,
      },
    ],
    detail: {
      id: "profile-1",
      name: "Alpha Draft",
      status: "new",
      weight_unit: "KG",
      station_count: 0,
      definition: {
        kind: "fixed_list",
        values: [20, 25, 30],
      },
      possible_loads_kg: [20, 25, 30],
    },
    isLoading: false,
    errorMessage: null,
  });

  it("prefills edit state from the detail payload and renders preview loads", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);

    el.state = createState();

    expect(el.textContent ?? "").toContain("Alpha Draft");
    expect(el.textContent ?? "").toContain("20 kg");
    const textarea = el.querySelector(
      '[data-field="fixed-list"]',
    ) as HTMLTextAreaElement | null;
    expect(textarea?.value).toContain("25");
  });

  it("emits a save event for create mode once the draft is valid", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      mode: "create",
      detail: null,
    };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const nameInput = el.querySelector('[data-field="name"]') as HTMLInputElement;
    nameInput.value = "Created Draft";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    const textarea = el.querySelector('[data-field="fixed-list"]') as HTMLTextAreaElement;
    textarea.value = "20\n25";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    const saveButton = el.querySelector(
      '[data-ui-action="save-load-profile"]',
    ) as HTMLButtonElement;
    const reopenedSaveButton = el.querySelector(
      '[data-ui-action="save-load-profile"]',
    ) as HTMLButtonElement | null;
    reopenedSaveButton?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({
      mode: "create",
      loadProfileId: null,
      request: {
        name: "Created Draft",
        weight_unit: "KG",
        definition: {
          kind: "fixed_list",
          values: [20, 25],
        },
      },
    });
  });

  it("shows live validation feedback for duplicate names and malformed numeric input", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      mode: "create",
      detail: null,
    };

    const nameInput = el.querySelector('[data-field="name"]') as HTMLInputElement;
    nameInput.value = "Bravo Draft";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    const textarea = el.querySelector('[data-field="fixed-list"]') as HTMLTextAreaElement;
    textarea.value = "20\nabc";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    expect(el.textContent ?? "").toContain("Name must be unique.");
    expect(el.textContent ?? "").toContain(
      "Fixed list values must be numbers separated by commas or lines.",
    );
  });

  it("emits delete requests for editable draft details", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const deleteButton = el.querySelector(
      '[data-ui-action="delete-load-profile"]',
    ) as HTMLButtonElement | null;
    deleteButton?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({
      loadProfileId: "profile-1",
    });
  });

  it("keeps historical definition fields read-only and only emits rename save after warning confirmation", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = {
      ...createState(),
      detail: {
        ...createState().detail!,
        status: "active",
      },
      loadProfiles: [
        {
          id: "profile-1",
          name: "Alpha Draft",
          status: "active",
          definition_kind: "fixed_list",
          weight_unit: "KG",
          station_count: 1,
        },
      ],
    };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    expect((el.querySelector('[data-field="weight-unit"]') as HTMLSelectElement).disabled).toBe(true);
    expect((el.querySelector('[data-field="definition-kind"]') as HTMLSelectElement).disabled).toBe(true);
    expect((el.querySelector('[data-field="fixed-list"]') as HTMLTextAreaElement).disabled).toBe(true);
    expect(el.textContent ?? "").toContain("Only the name can change");

    const nameInput = el.querySelector('[data-field="name"]') as HTMLInputElement;
    nameInput.value = "Alpha Historical";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));

    const saveButton = el.querySelector('[data-ui-action="save-load-profile"]') as HTMLButtonElement;
    saveButton.click();

    expect(handler).not.toHaveBeenCalled();
    expect(el.textContent ?? "").toContain("historical workouts are understood");

    const keepEditingButton = Array.from(el.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Keep Editing",
    ) as HTMLButtonElement | undefined;
    keepEditingButton?.click();

    expect(handler).not.toHaveBeenCalled();
    expect(el.textContent ?? "").not.toContain("historical workouts are understood");

    const reopenedSaveButton = el.querySelector(
      '[data-ui-action="save-load-profile"]',
    ) as HTMLButtonElement | null;
    reopenedSaveButton?.click();
    const confirmButton = el.querySelector(
      '.confirm-dialog [data-ui-action="save-load-profile"]',
    ) as HTMLButtonElement | null;
    confirmButton?.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].detail.payload).toEqual({
      mode: "edit",
      loadProfileId: "profile-1",
      request: {
        name: "Alpha Historical",
      },
    });
  });

  it("opens preview loads in a station-detail-style popup and closes only from the close button", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const inspectButton = el.querySelector(
      '[data-ui-action="open-load-profile-preview"]',
    ) as HTMLButtonElement | null;
    inspectButton?.click();

    const dialog = el.querySelector('[role="dialog"]');
    expect(dialog?.textContent ?? "").toContain("Alpha Draft");
    expect(dialog?.textContent ?? "").toContain("20 kg");
    expect(dialog?.textContent ?? "").toContain("25 kg");
    expect(
      el.querySelectorAll(".station-load-profile-value button, .station-load-profile-value input, .station-load-profile-value select, .station-load-profile-value textarea"),
    ).toHaveLength(0);

    const backdrop = el.querySelector(".station-load-profile-dialog-backdrop") as HTMLElement;
    backdrop.click();
    expect(el.querySelector('[role="dialog"]')?.textContent ?? "").toContain("Alpha Draft");

    const closeButton = el.querySelector(
      '[data-ui-action="dismiss-load-profile-preview"]',
    ) as HTMLButtonElement | null;
    closeButton?.click();

    expect(el.querySelector(".station-load-profile-dialog")).toBeNull();
  });
});
