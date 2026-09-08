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

  it("prefills edit state from the detail payload with a compact parsed summary", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);

    el.state = createState();

    expect(el.querySelector("h1")?.textContent).toBe("Load Profile");
    expect(el.textContent ?? "").toContain("3 values · 20–30 KG");
    const textarea = el.querySelector(
      '[data-field="fixed-list"]',
    ) as HTMLTextAreaElement | null;
    expect(textarea?.value).toContain("25");
  });

  it("keeps text fields focused through live validation renders", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = createState();

    const updateTextField = (field: string, value: string): void => {
      const input = el.querySelector(`[data-field="${field}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement;
      input.focus();
      input.value = value;
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const updatedInput = el.querySelector(`[data-field="${field}"]`);
      expect(document.activeElement).toBe(updatedInput);
      const focusedInput = updatedInput as HTMLInputElement | HTMLTextAreaElement;
      expect(focusedInput.value).toBe(value);
      expect(focusedInput.selectionStart).toBe(value.length);
      expect(focusedInput.selectionEnd).toBe(value.length);
    };

    updateTextField("name", "Alpha Updated");
    updateTextField("fixed-list", "20\n25\n30\n35");

    const definitionKind = el.querySelector(
      '[data-field="definition-kind"]',
    ) as HTMLSelectElement;
    definitionKind.value = "formula";
    definitionKind.dispatchEvent(new Event("change", { bubbles: true }));

    updateTextField("formula-min", "20");
    updateTextField("formula-step", "2.5");
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

  it("keeps a new form quiet until interaction, then shows specific validation feedback", () => {
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

    expect(el.textContent ?? "").not.toContain("Name is required.");
    expect(el.textContent ?? "").not.toContain("Add at least one fixed value.");

    const nameInput = el.querySelector('[data-field="name"]') as HTMLInputElement;
    nameInput.value = "Bravo Draft";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    const textarea = el.querySelector('[data-field="fixed-list"]') as HTMLTextAreaElement;
    textarea.value = "20 12..5";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    expect(el.textContent ?? "").toContain("Name must be unique.");
    expect(el.textContent ?? "").toContain(
      "Could not read '12..5' as a weight.",
    );
  });

  it("accepts spaces, commas, and line breaks in fixed-list values", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & { state: ConfiguratorLoadProfileEditorScreenState };
    document.body.append(el);
    el.state = { ...createState(), mode: "create", detail: null };

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);
    const nameInput = el.querySelector('[data-field="name"]') as HTMLInputElement;
    nameInput.value = "Mixed Separators";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    const textarea = el.querySelector('[data-field="fixed-list"]') as HTMLTextAreaElement;
    textarea.value = "2.5, 5 7.5\n10";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    (el.querySelector('[data-ui-action="save-load-profile"]') as HTMLButtonElement).click();

    expect(handler.mock.calls[0]?.[0].detail.payload.request.definition).toEqual({
      kind: "fixed_list",
      values: [2.5, 5, 7.5, 10],
    });
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

  it("presents historical structure as read-only metadata and only emits rename save after warning confirmation", () => {
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

    expect(el.querySelector('[data-field="weight-unit"]')).toBeNull();
    expect(el.querySelector('[data-field="definition-kind"]')).toBeNull();
    expect(el.querySelector('[data-field="fixed-list"]')).toBeNull();
    expect(el.textContent ?? "").toContain("20 KG · 25 KG · 30 KG");
    expect(el.textContent ?? "").not.toContain("Preview");

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

  it("uses the shared detail header and does not render immutable values twice", () => {
    const el = document.createElement(
      pbConfiguratorLoadProfileEditorScreenTag,
    ) as HTMLElement & {
      state: ConfiguratorLoadProfileEditorScreenState;
    };
    document.body.append(el);
    el.state = createState();

    expect(el.querySelector("pb-side-menu")).toBeNull();
    expect(el.querySelector(".detail-back-button")).not.toBeNull();
    expect(el.querySelector(".configurator-load-profile-back-button")).toBeNull();
    expect(el.querySelector('[aria-label="Preview"]')).toBeNull();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});
