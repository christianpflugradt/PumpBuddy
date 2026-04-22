import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerPbStartScreen, pbStartScreenTag } from "./pb-start-screen";
import type { StartScreenState } from "./workout-types";

describe("pb-start-screen", () => {
  beforeEach(() => {
    registerPbStartScreen();
  });

  const createState = (): StartScreenState => ({
    isLoading: false,
    isStarting: false,
    errorMessage: null,
    blockedStartModal: null,
    trainingPlans: [{ id: "p1", name: "Plan A", exercise_count: 3 }],
    gyms: [{ id: "g1", name: "Gym A" }],
    selectedTrainingPlanId: "p1",
    selectedGymId: "g1",
    selectedWorkoutMode: "configured-gym",
  });

  it("renders training plan name", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const text = el.textContent ?? "";
    expect(text).toContain("Plan A");
  });

  it("renders personalized greeting above chooser copy when session user is present", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.sessionUser = {
      id: "user-1",
      displayName: "Casey",
    };
    el.state = state;

    const greeting = el.querySelector(".start-greeting");
    const startCopy = el.querySelector("p.start-copy:not(.start-greeting)");
    expect(greeting?.textContent ?? "").toContain("Welcome back, Casey!");
    expect(greeting).toBeTruthy();
    expect(startCopy).toBeTruthy();
    expect(
      (greeting as HTMLElement).compareDocumentPosition(startCopy as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("emits start-workout action", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    button?.click();

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.action).toBe("start-workout");
  });

  it("disables start button when loading", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.isLoading = true;

    el.state = state;

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("emits select input actions for plan and gym", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const planSelect = el.querySelector('[data-input-action="select-training-plan"]') as HTMLSelectElement;
    planSelect.value = "p1";
    planSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const gymSelect = el.querySelector('[data-input-action="select-gym"]') as HTMLSelectElement;
    gymSelect.value = "g1";
    gymSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0].detail).toEqual({ action: "select-training-plan", value: "p1" });
    expect(handler.mock.calls[1][0].detail).toEqual({ action: "select-gym", value: "g1" });
  });

  it("emits workout mode selection from radio input", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.selectedWorkoutMode = "free-mode";
    state.selectedGymId = "";
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-input", handler);

    const gymModeRadio = el.querySelector('input[value="configured-gym"]') as HTMLInputElement;
    gymModeRadio.checked = true;
    gymModeRadio.dispatchEvent(new Event("change", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      action: "select-workout-mode",
      value: "configured-gym",
    });
  });

  it("hides gym selector and renders free mode preview context", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.selectedWorkoutMode = "free-mode";
    state.selectedGymId = "";
    el.state = state;

    expect(el.querySelector("#gym-select")).toBeNull();
    expect(el.textContent ?? "").toContain("Free Mode (No Gym)");
  });

  it("renders blocked-start modal and emits dismiss action", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.blockedStartModal = {
      message: "Cannot start",
      trainingPlanName: "Plan A",
      gymName: "Gym A",
      missingExercises: [
        {
          exercise_position: 1,
          exercise_name: "Chest Press",
          reason: "no_realizable_option_in_selected_gym",
        },
      ],
    };
    el.state = state;

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const dismiss = el.querySelector('[data-ui-action="dismiss-start-blocked-modal"]') as HTMLButtonElement;
    dismiss.click();

    const text = el.textContent ?? "";
    expect(text).toContain("Chest Press is unavailable at Gym A");
    expect(text).toContain("No realizable option is configured in this gym");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("dismiss-start-blocked-modal");
  });

  it("renders preparing label while starting", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    const state = createState();
    state.isStarting = true;
    el.state = state;

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    expect(button.textContent ?? "").toContain("Preparing Workout...");
  });

  it("toggles side menu from burger button", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;

    expect(menuShell.classList.contains("is-open")).toBe(false);

    let toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();
    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);

    toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();
    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);
  });

  it("closes side menu when clicking outside menu panel", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
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

  it("keeps the screen panel as direct shell child to avoid layout flow shift", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const shell = el.querySelector(".start-screen-shell") as HTMLElement;
    const panel = el.querySelector(".screen-panel.start-screen") as HTMLElement;
    expect(panel.parentElement).toBe(shell);
  });

  it("emits start action when clicking nested element inside button", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);

    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const button = el.querySelector('[data-ui-action="start-workout"]') as HTMLButtonElement;
    const child = document.createElement("span");
    child.textContent = "Start";
    button.append(child);

    child.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("start-workout");
  });

  it("emits navigate-settings action from side menu entry", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const settingsEntry = el.querySelector('[data-ui-action="navigate-settings"]') as HTMLButtonElement;
    settingsEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-settings");
  });

  it("emits navigate-history action from side menu entry and keeps Exercises between Progress and History", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const workoutEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    const progressEntry = el.querySelector('[data-ui-action="navigate-progress"]') as HTMLButtonElement;
    const exercisesEntry = el.querySelector('[data-ui-action="navigate-exercises"]') as HTMLButtonElement;
    const historyEntry = el.querySelector('[data-ui-action="navigate-history"]') as HTMLButtonElement;
    const settingsEntry = el.querySelector('[data-ui-action="navigate-settings"]') as HTMLButtonElement;
    expect(workoutEntry).toBeTruthy();
    expect(progressEntry).toBeTruthy();
    expect(exercisesEntry).toBeTruthy();
    expect(historyEntry).toBeTruthy();
    expect(settingsEntry).toBeTruthy();
    expect(
      workoutEntry.compareDocumentPosition(progressEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      progressEntry.compareDocumentPosition(exercisesEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      exercisesEntry.compareDocumentPosition(historyEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      historyEntry.compareDocumentPosition(settingsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    historyEntry.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("navigate-history");
  });

  it("emits navigate-about action from side menu entry and keeps About above logout", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
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

  it("emits logout action from side menu entry", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const handler = vi.fn();
    el.addEventListener("pb-ui-action", handler);

    const logoutEntry = el.querySelector('[data-ui-action="logout"]') as HTMLButtonElement;
    logoutEntry.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.action).toBe("logout");
  });

  it("closes side menu when clicking workout entry while already on workout screen", () => {
    const el = document.createElement(pbStartScreenTag) as HTMLElement & { state: StartScreenState };
    document.body.append(el);
    el.state = createState();

    const toggle = el.querySelector('[data-ui-action="toggle-side-menu"]') as HTMLButtonElement;
    toggle.click();

    let menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(true);

    const workoutEntry = el.querySelector('[data-ui-action="close-side-menu"]') as HTMLButtonElement;
    workoutEntry.click();

    menuShell = el.querySelector(".side-menu-shell") as HTMLElement;
    expect(menuShell.classList.contains("is-open")).toBe(false);
  });
});
