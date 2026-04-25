import { describe, it, expect, beforeEach } from "vitest";
import { registerPbAppRoot, pbAppRootTag } from "./pb-app-root";
import type { AppState } from "./workout-types";

describe("pb-app-root", () => {
  beforeEach(() => {
    registerPbAppRoot();
  });

  const createState = (): AppState => ({
    historyScreen: {
      workouts: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
      restoreWorkoutId: null,
    },
    progressScreen: {
      workouts: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
    },
    exercisesScreen: {
      groups: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
      restoreScrollY: null,
    },
    startScreen: {
      isLoading: false,
      isStarting: false,
      errorMessage: null,
      blockedStartModal: null,
      trainingPlans: [],
      gyms: [],
      selectedTrainingPlanId: "",
      selectedGymId: "",
      selectedWorkoutMode: "configured-gym",
    },
    workoutPlan: null,
    viewState: { screen: "start" },
    completion: { startedAt: null, completedAt: null },
    confirmDialog: { message: null, confirmActionLabel: null, onConfirm: null },
    activeWorkout: { id: null, startedAt: null, persistedExerciseCount: 0 },
    workoutSave: { isSaving: false, errorMessage: null },
    uiFeedback: { completedSetPulseToken: 0, loadTickToken: 0, repsTickToken: 0 },
  });

  it("renders start screen", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    el.state = createState();

    expect(el.innerHTML).toContain("pb-app-root");
  });

  it("passes session user to start screen for personalized greeting", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.sessionUser = {
      id: "2f6f7ad5-488f-46cd-b763-f5ef9f878f3f",
      displayName: "Casey",
      login: "casey-login",
      registrationDate: "2026-04-10T09:15:00.000Z",
      favoriteGymId: "gym-1",
    };
    state.startScreen.gyms = [{ id: "gym-1", name: "Downtown" }];
    el.state = state;

    const startEl = el.querySelector("pb-start-screen");
    expect(startEl).toBeTruthy();
    expect(startEl?.textContent ?? "").toContain("Welcome back, Casey!");
  });

  it("renders completion screen when state changes", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "completion" };
    state.workoutPlan = {
      id: "p1",
      name: "Plan",
      exercises: [],
    };

    el.state = state;

    const completionEl = el.querySelector("pb-completion-screen");
    expect(completionEl).toBeTruthy();
  });

  it("falls back to start screen with error when plan is missing outside start view", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };

    el.state = state;

    const startEl = el.querySelector("pb-start-screen") as HTMLElement;
    expect(startEl).toBeTruthy();
    expect(startEl.textContent ?? "").toContain("Unable to render the workout plan.");
  });

  it("renders exercise screen when plan and exercise view are available", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercise", exerciseIndex: 0 };
    state.workoutPlan = {
      id: "plan-1",
      name: "Plan",
      exercises: [
        {
          trainingPlanExerciseId: "ex-1",
          name: "Bench",
          fallbackOptions: [],
          selectedTrainingPlanExerciseVariantId: null,
          selectedVariantId: null,
          selectedStationId: null,
          selectedStationProfileLoadsKg: [],
          loadInputMode: "TOTAL",
          setTrackingMode: "BILATERAL",
          isFallbackOptionConfirmed: true,
          skippedAt: null,
          suggestedSet: { loadValue: 40, reps: 8 },
          activeSet: { loadValue: 40, reps: 8 },
          activeSetInput: { loadValue: "40", reps: "8" },
          completedSets: [],
          currentSetIndex: 1,
          currentSetSide: "BILATERAL",
          isReadOnly: false,
        },
      ],
    };

    el.state = state;

    const exerciseEl = el.querySelector("pb-exercise-screen");
    expect(exerciseEl).toBeTruthy();
  });

  it("renders settings screen when settings view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "settings" };
    state.sessionUser = {
      id: "2f6f7ad5-488f-46cd-b763-f5ef9f878f3f",
      displayName: "Casey",
      login: "casey-login",
      registrationDate: "2026-04-10T09:15:00.000Z",
      favoriteGymId: "gym-1",
    };
    state.startScreen.gyms = [{ id: "gym-1", name: "Downtown" }];

    el.state = state;

    const settingsEl = el.querySelector("pb-settings-screen");
    expect(settingsEl).toBeTruthy();
    expect(settingsEl?.textContent ?? "").toContain("casey-login");
    expect(settingsEl?.textContent ?? "").toContain("Casey");
    expect(settingsEl?.textContent ?? "").toContain("Downtown");
    expect(settingsEl?.textContent ?? "").toContain("April 10, 2026");
  });

  it("renders about screen when about view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "about" };

    el.state = state;

    const aboutEl = el.querySelector("pb-about-screen");
    expect(aboutEl).toBeTruthy();
    expect(aboutEl?.textContent ?? "").toContain("About");
  });

  it("renders history screen when history view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "history" };
    state.historyScreen.workouts = [
      {
        id: "w1",
        training_plan_name: "Leg Day",
        started_at: "2026-04-17T10:00:00.000Z",
        completed_at: "2026-04-17T10:45:00.000Z",
        gym_name: "Downtown",
        duration_minutes: 45,
      },
    ];

    el.state = state;

    const historyEl = el.querySelector("pb-history-screen");
    expect(historyEl).toBeTruthy();
    expect(historyEl?.textContent ?? "").toContain("History");
    expect(historyEl?.textContent ?? "").toContain("Leg Day");
  });

  it("renders progress screen when progress view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "progress" };
    state.progressScreen.workouts = [
      {
        id: "w1",
        training_plan_name: "Leg Day",
        completed_at: "2026-04-17T10:45:00.000Z",
        workout_progress: 1.04,
        workout_progress_status: "AVAILABLE",
        progress_tone: "GREEN",
      },
    ];

    el.state = state;

    const progressEl = el.querySelector("pb-progress-screen");
    expect(progressEl).toBeTruthy();
    expect(progressEl?.textContent ?? "").toContain("Progress");
  });

  it("renders exercises screen when exercises view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercises" };
    state.exercisesScreen.groups = [
      {
        tone: "GREEN",
        rows: [
          {
            variant_id: "v1",
            variant_name: "Barbell Squat",
            last_performed_at: "2026-04-17T10:45:00.000Z",
            last_performed_days_ago: 2,
            last_performed_first_set_display: "100 kg x 5 reps",
            selected_station_average_score_30d: 1.07,
            variant_session_count_30d: 6,
            performance_status: "AVAILABLE",
            performance_tone: "GREEN",
          },
        ],
      },
    ];

    el.state = state;

    const exercisesEl = el.querySelector("pb-exercises-screen");
    expect(exercisesEl).toBeTruthy();
    expect(exercisesEl?.textContent ?? "").toContain("Exercises");
    expect(exercisesEl?.textContent ?? "").toContain("Barbell Squat");
  });

  it("renders exercise variant detail screen by variant ID", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercise-variant-detail", variantId: "v1" };
    state.exercisesScreen.groups = [
      {
        tone: "GREEN",
        rows: [
          {
            variant_id: "v1",
            variant_name: "Barbell Squat",
            last_performed_at: "2026-04-17T10:45:00.000Z",
            last_performed_days_ago: 2,
            last_performed_first_set_display: "100 kg x 5 reps",
            selected_station_average_score_30d: 1.07,
            variant_session_count_30d: 6,
            performance_status: "AVAILABLE",
            performance_tone: "GREEN",
          },
        ],
      },
    ];

    el.state = state;

    const detailEl = el.querySelector("pb-exercise-variant-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Barbell Squat");
    expect(detailEl?.textContent ?? "").toContain("Last 30 days");
  });

  it("renders exercise variant detail fallback for stale variant IDs", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "exercise-variant-detail", variantId: "missing-variant" };
    el.state = state;

    const detailEl = el.querySelector("pb-exercise-variant-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Exercise Variant");
    expect(detailEl?.textContent ?? "").toContain("Variant context unavailable");
  });

  it("renders workout detail screen when workout detail view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "workout-detail", workoutId: "workout-1" };
    state.workoutDetailScreen = {
      workoutId: "workout-1",
      isLoading: false,
      errorMessage: null,
      detail: {
        id: "workout-1",
        hero: {
          training_plan_name: "Push Day",
          started_at: "2026-04-14T16:32:00.000Z",
          completed_at: "2026-04-14T17:14:00.000Z",
          duration_minutes: 42,
          gym_name: "Alpha Gym",
        },
        completion_stats: {
          exercise_count: 8,
          completed_set_count: 20,
          average_duration_minutes: 44,
          workout_progress: 0.12,
          workout_progress_status: "AVAILABLE",
        },
        exercises: [],
      },
    };

    el.state = state;

    const detailEl = el.querySelector("pb-workout-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Push Day");
    expect(detailEl?.textContent ?? "").toContain("Alpha Gym");
    expect(detailEl?.textContent ?? "").not.toContain("42 min");
  });
});
