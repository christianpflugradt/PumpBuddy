import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pbSettingsScreenTag,
  registerPbSettingsScreen,
  type SettingsScreenState,
} from "./pb-settings-screen";

describe("pb-settings-screen", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = originalTimeZone;
    registerPbSettingsScreen();
  });

  afterEach(() => {
    process.env.TZ = originalTimeZone;
  });

  const createState = (): SettingsScreenState => ({
    sessionUser: {
      id: "f8e58e03-f5f2-4923-bec6-4d2c0ecdb126",
      displayName: "Jordan",
      maxLoadKg: 200,
      login: "jordan-login",
      registrationDate: "2026-04-11T23:30:00.000Z",
      favoriteGymId: "gym-1",
    },
    gyms: [
      { id: "gym-1", name: "Downtown" },
      { id: "gym-2", name: "North" },
    ],
  });

  const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it("renders session user fields with registration date before display name and editable entries after display name", () => {
    process.env.TZ = "Asia/Dubai";

    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);

    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("User login");
    expect(text).toContain("Display name");
    expect(text).toContain("Favorite gym");
    expect(text).toContain("Max load");
    expect(text).toContain("Password");
    expect(text).toContain("Registration date");
    expect(text).toContain("jordan-login");
    expect(text).toContain("Jordan");
    expect(text).toContain("Downtown");
    expect(text).toContain("200 kg");
    expect(text).toContain("********");
    expect(text).toContain("April 12, 2026");
    expect(text.indexOf("Registration date")).toBeLessThan(text.indexOf("Display name"));
    expect(text.indexOf("Display name")).toBeLessThan(text.indexOf("Favorite gym"));

    const registrationRow = Array.from(el.querySelectorAll(".settings-detail-row")).find((row) =>
      (row.textContent ?? "").includes("Registration date"),
    ) as HTMLElement;
    expect(registrationRow.querySelector("button")).toBeNull();

    const displayNameRow = Array.from(el.querySelectorAll(".settings-detail-row")).find((row) =>
      (row.textContent ?? "").includes("Display name"),
    ) as HTMLElement;
    expect(displayNameRow.querySelector('[data-ui-action="enter-display-name-edit"]')).toBeTruthy();
  });

  it("uses unavailable fallback values when session user is missing", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);

    el.state = { sessionUser: null, gyms: [] };

    const text = el.textContent ?? "";
    expect(text).toContain("Unavailable");
    expect(text).toContain("Not set");
  });

  it("toggles side menu from burger button", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);
  });

  it("closes side menu when clicking outside menu panel", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);
  });

  it("emits navigate-workout action from side menu entry", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    workoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-workout");
  });

  it("emits gyms and history navigation from side menu entries in menu order", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="navigate-workout"]') as HTMLButtonElement;
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    const gymsEntry = el.querySelector('[data-ui-action="navigate-gyms"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    const settingsEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(progressEntry).toBeTruthy();
    expect(exercisesEntry).toBeTruthy();
    expect(gymsEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(settingsEntry).toBeTruthy();
    expect(
      workoutEntry.compareDocumentPosition(progressEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      progressEntry.compareDocumentPosition(exercisesEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(gymsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      gymsEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      historyEntry.compareDocumentPosition(settingsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    gymsEntry.click();
    historyEntry.click();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-gyms");
    expect(handler.mock.calls[1][0].detail.action).toBe("navigate-history");
  });

  it("emits logout action from side menu entry", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const logoutEntry = el.querySelector('[data-ui-action="logout"]') as HTMLButtonElement;
    logoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("logout");
  });

  it("emits navigate-about action from side menu entry and keeps About above logout", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const aboutEntry = el.querySelector('[data-ui-action="navigate-about"]') as HTMLButtonElement;
    const logoutEntry = el.querySelector('[data-ui-action="logout"]') as HTMLButtonElement;
    expect(aboutEntry).toBeTruthy();
    expect(logoutEntry).toBeTruthy();
    expect(
      aboutEntry.compareDocumentPosition(logoutEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    aboutEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-about");
  });

  it("closes side menu when clicking settings entry while already on settings screen", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);

    const settingsEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    settingsEntry.click();

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);
  });

  it("enters display-name edit mode from the pen button and exits after save success", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-display-name-edit"]') as HTMLButtonElement;
    expect(penButton.querySelector('svg[data-icon="pen"]')).not.toBeNull();
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="display-name-draft"]') as HTMLInputElement;
    expect(draftInput).toBeTruthy();
    expect(el.querySelector('[data-ui-action="save-display-name-edit"]')).toBeTruthy();
    expect(el.querySelector('[data-ui-action="discard-display-name-edit"]')).toBeTruthy();

    draftInput.value = "Jordan Prime";
    draftInput.dispatchEvent(new Event("input", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-display-name") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({ ok: true });
    });

    const saveButton = el.querySelector('[data-ui-action="save-display-name-edit"]') as HTMLButtonElement;
    saveButton.click();
    await flush();

    expect(el.querySelector('[data-ui-input="display-name-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("Jordan Prime");
    const editButton = el.querySelector('[data-ui-action="enter-display-name-edit"]') as HTMLButtonElement;
    expect(editButton.querySelector('svg[data-icon="pen"]')).not.toBeNull();
  });

  it("exits display-name edit mode and restores previous value after discard", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-display-name-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="display-name-draft"]') as HTMLInputElement;
    draftInput.value = "Changed Name";
    draftInput.dispatchEvent(new Event("input", { bubbles: true }));

    const discardButton = el.querySelector('[data-ui-action="discard-display-name-edit"]') as HTMLButtonElement;
    discardButton.click();

    expect(el.querySelector('[data-ui-input="display-name-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("Jordan");
    expect(el.textContent ?? "").not.toContain("Changed Name");
  });

  it("keeps edit mode open with draft value after display-name save failure", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-display-name-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="display-name-draft"]') as HTMLInputElement;
    draftInput.value = "Jordan Retry";
    draftInput.dispatchEvent(new Event("input", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-display-name") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({
        ok: false,
        errorMessage: "Unable to save display name right now.",
      });
    });

    const saveButton = el.querySelector('[data-ui-action="save-display-name-edit"]') as HTMLButtonElement;
    expect(saveButton.classList.contains("nav-button-primary")).toBe(true);
    saveButton.click();
    await flush();

    const retryInput = el.querySelector('[data-ui-input="display-name-draft"]') as HTMLInputElement;
    expect(retryInput).toBeTruthy();
    expect(retryInput.value).toBe("Jordan Retry");
    expect(el.textContent ?? "").toContain("Unable to save display name right now.");
    expect(el.querySelector('[data-ui-action="save-display-name-edit"]')).toBeTruthy();
    const discardButton = el.querySelector('[data-ui-action="discard-display-name-edit"]') as HTMLButtonElement;
    expect(discardButton).toBeTruthy();
    expect(discardButton.classList.contains("nav-button-secondary")).toBe(true);
  });

  it("enters favorite-gym edit mode and exits after save success", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-favorite-gym-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftSelect = el.querySelector('[data-ui-input="favorite-gym-draft"]') as HTMLSelectElement;
    expect(draftSelect).toBeTruthy();
    expect(draftSelect.classList.contains("start-select")).toBe(true);
    expect(draftSelect.classList.contains("settings-favorite-gym-select")).toBe(true);
    draftSelect.value = "gym-2";
    draftSelect.dispatchEvent(new Event("change", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-favorite-gym") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({ ok: true });
    });

    const saveButton = el.querySelector('[data-ui-action="save-favorite-gym-edit"]') as HTMLButtonElement;
    saveButton.click();
    await flush();

    expect(el.querySelector('[data-ui-input="favorite-gym-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("North");
  });

  it("exits favorite-gym edit mode and restores previous value after discard", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-favorite-gym-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftSelect = el.querySelector('[data-ui-input="favorite-gym-draft"]') as HTMLSelectElement;
    draftSelect.value = "gym-2";
    draftSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const discardButton = el.querySelector('[data-ui-action="discard-favorite-gym-edit"]') as HTMLButtonElement;
    discardButton.click();

    expect(el.querySelector('[data-ui-input="favorite-gym-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("Downtown");
    expect(el.textContent ?? "").not.toContain("North");
  });

  it("keeps favorite-gym edit mode open after save failure", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-favorite-gym-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftSelect = el.querySelector('[data-ui-input="favorite-gym-draft"]') as HTMLSelectElement;
    draftSelect.value = "gym-2";
    draftSelect.dispatchEvent(new Event("change", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-favorite-gym") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({
        ok: false,
        errorMessage: "Unable to save favorite gym right now.",
      });
    });

    const saveButton = el.querySelector('[data-ui-action="save-favorite-gym-edit"]') as HTMLButtonElement;
    saveButton.click();
    await flush();

    const retrySelect = el.querySelector('[data-ui-input="favorite-gym-draft"]') as HTMLSelectElement;
    expect(retrySelect).toBeTruthy();
    expect(retrySelect.value).toBe("gym-2");
    expect(el.textContent ?? "").toContain("Unable to save favorite gym right now.");
  });

  it("enters max-load edit mode and exits after save success", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-max-load-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    expect(draftInput).toBeTruthy();
    expect(draftInput.type).toBe("text");
    expect(draftInput.inputMode).toBe("numeric");
    expect(draftInput.pattern).toBe("[0-9]*");
    draftInput.value = "275";
    draftInput.dispatchEvent(new Event("input", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        payload?: { maxLoadKg?: number };
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-max-load") {
        return;
      }

      event.preventDefault();
      expect(customEvent.detail.payload?.maxLoadKg).toBe(275);
      customEvent.detail.respond?.({ ok: true });
    });

    let saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    saveButton.click();
    await flush();

    expect(el.querySelector('[data-ui-input="max-load-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("275 kg");
  });

  it("keeps max-load save action available while showing inline validation hints for invalid input", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-max-load-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    let saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    const actionHandler = vi.fn();
    el.addEventListener("pb-ui-action", actionHandler);

    draftInput.value = "99";
    draftInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(saveButton.disabled).toBe(false);
    expect(el.textContent ?? "").toContain("Max load must be between 100 and 999 kg.");
    saveButton.click();
    expect(
      actionHandler.mock.calls.some(
        ([event]) => (event as CustomEvent<{ action?: string }>).detail?.action === "save-max-load",
      ),
    ).toBe(false);

    const decimalDraftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    decimalDraftInput.value = "200.25";
    decimalDraftInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(saveButton.disabled).toBe(false);
    expect(el.textContent ?? "").toContain("Max load must be a whole number in kg.");
    saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    saveButton.click();
    expect(
      actionHandler.mock.calls.some(
        ([event]) => (event as CustomEvent<{ action?: string }>).detail?.action === "save-max-load",
      ),
    ).toBe(false);

    const localizedDecimalDraftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    localizedDecimalDraftInput.value = "200,25";
    localizedDecimalDraftInput.dispatchEvent(new Event("input", { bubbles: true }));
    saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    expect(el.textContent ?? "").toContain("Max load must be a whole number in kg.");

    const minBoundaryDraftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    minBoundaryDraftInput.value = "100";
    minBoundaryDraftInput.dispatchEvent(new Event("input", { bubbles: true }));
    saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    expect(el.textContent ?? "").not.toContain("Max load must be a whole number in kg.");
    expect(el.textContent ?? "").not.toContain("Max load must be between 100 and 999 kg.");

    const maxBoundaryDraftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    maxBoundaryDraftInput.value = "999";
    maxBoundaryDraftInput.dispatchEvent(new Event("input", { bubbles: true }));
    saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it("shows Not set for unset max-load and keeps edit field empty until a value is entered", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = {
      ...createState(),
      sessionUser: {
        ...createState().sessionUser!,
        maxLoadKg: undefined,
      },
    };

    expect(el.textContent ?? "").toContain("Not set");

    const penButton = el.querySelector('[data-ui-action="enter-max-load-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    expect(draftInput.value).toBe("");
  });

  it("uses display-name parity classes for max-load edit controls", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const maxLoadPenButton = el.querySelector('[data-ui-action="enter-max-load-edit"]') as HTMLButtonElement;
    expect(maxLoadPenButton.classList.contains("settings-max-load-edit")).toBe(true);
    expect(maxLoadPenButton.querySelector('svg[data-icon="pen"]')).not.toBeNull();

    maxLoadPenButton.click();

    const actions = el.querySelector(".settings-max-load-actions") as HTMLElement;
    expect(actions).toBeTruthy();
    const saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    const discardButton = el.querySelector('[data-ui-action="discard-max-load-edit"]') as HTMLButtonElement;
    expect(saveButton.classList.contains("action-button")).toBe(true);
    expect(saveButton.classList.contains("nav-button-primary")).toBe(true);
    expect(discardButton.classList.contains("action-button")).toBe(true);
    expect(discardButton.classList.contains("nav-button-secondary")).toBe(true);
  });

  it("keeps max-load edit mode open after save failure", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-max-load-edit"]') as HTMLButtonElement;
    penButton.click();

    const draftInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    draftInput.value = "250";
    draftInput.dispatchEvent(new Event("input", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-max-load") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({
        ok: false,
        errorMessage: "Unable to save max load right now.",
      });
    });

    const saveButton = el.querySelector('[data-ui-action="save-max-load-edit"]') as HTMLButtonElement;
    saveButton.click();
    await flush();

    const retryInput = el.querySelector('[data-ui-input="max-load-draft"]') as HTMLInputElement;
    expect(retryInput).toBeTruthy();
    expect(retryInput.value).toBe("250");
    expect(el.textContent ?? "").toContain("Unable to save max load right now.");
  });

  it("shows password mismatch validation and blocks save until values match", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const actionHandler = vi.fn();
    el.addEventListener("pb-ui-action", actionHandler);

    const penButton = el.querySelector('[data-ui-action="enter-password-edit"]') as HTMLButtonElement;
    penButton.click();

    const currentInput = el.querySelector('[data-ui-input="password-current-draft"]') as HTMLInputElement;
    currentInput.value = "old-secret";
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));

    const newInput = el.querySelector('[data-ui-input="password-new-draft"]') as HTMLInputElement;
    newInput.value = "new-secret";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));

    const confirmInput = el.querySelector('[data-ui-input="password-confirm-draft"]') as HTMLInputElement;
    confirmInput.value = "different-secret";
    confirmInput.dispatchEvent(new Event("input", { bubbles: true }));

    const saveButton = el.querySelector('[data-ui-action="save-password-edit"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(el.textContent ?? "").toContain("New password and confirmation must match.");
    saveButton.click();
    expect(
      actionHandler.mock.calls.some(
        ([event]) => (event as CustomEvent<{ action?: string }>).detail?.action === "save-password",
      ),
    ).toBe(false);

    const refreshedConfirmInput = el.querySelector('[data-ui-input="password-confirm-draft"]') as HTMLInputElement;
    refreshedConfirmInput.value = "new-secret";
    refreshedConfirmInput.dispatchEvent(new Event("input", { bubbles: true }));

    const enabledSaveButton = el.querySelector('[data-ui-action="save-password-edit"]') as HTMLButtonElement;
    expect(enabledSaveButton.disabled).toBe(false);
  });

  it("keeps focus in password inputs while typing", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-password-edit"]') as HTMLButtonElement;
    penButton.click();

    const newInput = el.querySelector('[data-ui-input="password-new-draft"]') as HTMLInputElement;
    newInput.focus();
    expect(document.activeElement).toBe(newInput);

    newInput.value = "new-secr";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(newInput.isConnected).toBe(true);
    expect(document.activeElement).toBe(newInput);

    newInput.value = "new-secret";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.activeElement).toBe(newInput);
  });

  it("shows minimum-length validation and blocks save until new password has at least 8 characters", () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const actionHandler = vi.fn();
    el.addEventListener("pb-ui-action", actionHandler);

    const penButton = el.querySelector('[data-ui-action="enter-password-edit"]') as HTMLButtonElement;
    penButton.click();

    const currentInput = el.querySelector('[data-ui-input="password-current-draft"]') as HTMLInputElement;
    currentInput.value = "old-secret";
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));

    const newInput = el.querySelector('[data-ui-input="password-new-draft"]') as HTMLInputElement;
    newInput.value = "1234567";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));

    const confirmInput = el.querySelector('[data-ui-input="password-confirm-draft"]') as HTMLInputElement;
    confirmInput.value = "1234567";
    confirmInput.dispatchEvent(new Event("input", { bubbles: true }));

    const saveButton = el.querySelector('[data-ui-action="save-password-edit"]') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    expect(el.textContent ?? "").toContain("New password must be at least 8 characters.");
    saveButton.click();
    expect(
      actionHandler.mock.calls.some(
        ([event]) => (event as CustomEvent<{ action?: string }>).detail?.action === "save-password",
      ),
    ).toBe(false);

    const refreshedNewInput = el.querySelector('[data-ui-input="password-new-draft"]') as HTMLInputElement;
    refreshedNewInput.value = "12345678";
    refreshedNewInput.dispatchEvent(new Event("input", { bubbles: true }));
    const refreshedConfirmInput = el.querySelector('[data-ui-input="password-confirm-draft"]') as HTMLInputElement;
    refreshedConfirmInput.value = "12345678";
    refreshedConfirmInput.dispatchEvent(new Event("input", { bubbles: true }));

    const enabledSaveButton = el.querySelector('[data-ui-action="save-password-edit"]') as HTMLButtonElement;
    expect(enabledSaveButton.disabled).toBe(false);
    expect(el.textContent ?? "").not.toContain("New password must be at least 8 characters.");
  });

  it("returns to read-only password mode and shows success feedback after save", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-password-edit"]') as HTMLButtonElement;
    penButton.click();

    const currentInput = el.querySelector('[data-ui-input="password-current-draft"]') as HTMLInputElement;
    const newInput = el.querySelector('[data-ui-input="password-new-draft"]') as HTMLInputElement;
    const confirmInput = el.querySelector('[data-ui-input="password-confirm-draft"]') as HTMLInputElement;
    currentInput.value = "old-secret";
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));
    newInput.value = "new-secret";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));
    confirmInput.value = "new-secret";
    confirmInput.dispatchEvent(new Event("input", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-password") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({ ok: true });
    });

    const saveButton = el.querySelector('[data-ui-action="save-password-edit"]') as HTMLButtonElement;
    saveButton.click();
    await flush();

    expect(el.querySelector('[data-ui-input="password-current-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("********");
    expect(el.textContent ?? "").toContain("Password updated successfully.");
  });

  it("returns to read-only password mode and shows error feedback after save failure", async () => {
    const el = document.createElement(pbSettingsScreenTag) as HTMLElement & { state: SettingsScreenState };
    document.body.append(el);
    el.state = createState();

    const penButton = el.querySelector('[data-ui-action="enter-password-edit"]') as HTMLButtonElement;
    penButton.click();

    const currentInput = el.querySelector('[data-ui-input="password-current-draft"]') as HTMLInputElement;
    const newInput = el.querySelector('[data-ui-input="password-new-draft"]') as HTMLInputElement;
    const confirmInput = el.querySelector('[data-ui-input="password-confirm-draft"]') as HTMLInputElement;
    currentInput.value = "old-secret";
    currentInput.dispatchEvent(new Event("input", { bubbles: true }));
    newInput.value = "new-secret";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));
    confirmInput.value = "new-secret";
    confirmInput.dispatchEvent(new Event("input", { bubbles: true }));

    el.addEventListener("pb-ui-action", (event: Event) => {
      const customEvent = event as CustomEvent<{
        action?: string;
        respond?: (result: { ok: boolean; errorMessage?: string }) => void;
      }>;
      if (customEvent.detail?.action !== "save-password") {
        return;
      }

      event.preventDefault();
      customEvent.detail.respond?.({
        ok: false,
        errorMessage: "Current password is incorrect.",
      });
    });

    const saveButton = el.querySelector('[data-ui-action="save-password-edit"]') as HTMLButtonElement;
    saveButton.click();
    await flush();

    expect(el.querySelector('[data-ui-input="password-current-draft"]')).toBeNull();
    expect(el.textContent ?? "").toContain("Current password is incorrect.");
  });
});
