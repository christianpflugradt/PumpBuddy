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
      selectedWorkoutId: null,
    },
    exercisesScreen: {
      groups: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
      restoreScrollY: null,
    },
    gymsScreen: {
      gyms: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
    },
    trainingPlansScreen: {
      trainingPlans: [],
      isLoading: false,
      errorMessage: null,
      hasLoaded: false,
      selectedTrainingPlanId: null,
      selectedGymId: null,
    },
    trainingPlanDetailScreen: {
      trainingPlanId: null,
      selectedGymId: null,
      detail: null,
      isLoading: false,
      errorMessage: null,
    },
    gymDetailScreen: {
      gymId: null,
      detail: null,
      activeSheet: "stations",
      isLoading: false,
      errorMessage: null,
      stationChooser: null,
    },
    stationDetailScreen: {
      gymId: null,
      stationId: null,
      detail: null,
      isLoading: false,
      errorMessage: null,
      loadProfilePopupOpen: false,
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

  it("passes the selected workout highlight into the progress screen", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "progress" };
    state.progressScreen = {
      workouts: [
        {
          id: "workout-1",
          training_plan_name: "Push Day",
          completed_at: new Date().toISOString(),
          workout_progress: 1.02,
          workout_progress_status: "AVAILABLE",
          progress_tone: "YELLOW",
        },
      ],
      isLoading: false,
      errorMessage: null,
      hasLoaded: true,
      selectedWorkoutId: "workout-1",
    };

    el.state = state;

    const selectedCell = el.querySelector('[data-workout-id="workout-1"]');
    expect(selectedCell?.classList.contains("progress-heatmap-cell--selected")).toBe(true);
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

  it("renders gyms screen when gyms view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "gyms" };
    state.gymsScreen.gyms = [
      {
        id: "gym-1",
        name: "Downtown",
        station_count: 8,
        last_visited_at: "2026-04-17T10:45:00.000Z",
      },
    ];

    el.state = state;

    const gymsEl = el.querySelector("pb-gyms-screen");
    expect(gymsEl).toBeTruthy();
    expect(gymsEl?.textContent ?? "").toContain("Gyms");
    expect(gymsEl?.textContent ?? "").toContain("Downtown");
    expect(gymsEl?.textContent ?? "").toContain("8 stations");
  });

  it("renders training plans screen when training plans view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "training-plans" };
    state.trainingPlansScreen.trainingPlans = [
      {
        id: "plan-1",
        name: "Leg Day",
        exercise_count: 3,
        last_completed_at: "2026-04-17T10:45:00.000Z",
      },
    ];

    el.state = state;

    const trainingPlansEl = el.querySelector("pb-training-plans-screen");
    expect(trainingPlansEl).toBeTruthy();
    expect(trainingPlansEl?.textContent ?? "").toContain("Training Plans");
    expect(trainingPlansEl?.textContent ?? "").toContain("Leg Day");
    expect(trainingPlansEl?.textContent ?? "").toContain("3 exercises");
  });

  it("renders training plan detail screen when training plan detail view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "training-plan-detail", trainingPlanId: "plan-1", selectedGymId: null };
    state.startScreen.gyms = [{ id: "gym-1", name: "Downtown" }];
    state.trainingPlanDetailScreen = {
      trainingPlanId: "plan-1",
      selectedGymId: null,
      isLoading: false,
      errorMessage: null,
      detail: {
        id: "plan-1",
        name: "Leg Day",
        selected_gym_id: null,
        is_executable: null,
        execution_status: null,
        execution_summary: null,
        exercises: [
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Squat",
            exercise_position: 1,
            configured_variant_count: 2,
            executable_variant_count: null,
            execution_status: null,
            variants: [],
          },
        ],
      },
    };

    el.state = state;

    const detailEl = el.querySelector("pb-training-plan-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Leg Day");
    expect(detailEl?.textContent ?? "").toContain("Squat");
    expect(detailEl?.textContent ?? "").toContain("2 variants");
  });

  it("renders training plan exercise detail screen when plan exercise detail view is selected", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = {
      screen: "training-plan-exercise-detail",
      trainingPlanId: "plan-1",
      trainingPlanExerciseId: "exercise-1",
      selectedGymId: "gym-1",
    };
    state.startScreen.gyms = [{ id: "gym-1", name: "Downtown" }];
    state.trainingPlanDetailScreen = {
      trainingPlanId: "plan-1",
      selectedGymId: "gym-1",
      isLoading: false,
      errorMessage: null,
      detail: {
        id: "plan-1",
        name: "Leg Day",
        selected_gym_id: "gym-1",
        is_executable: true,
        execution_status: "GREEN",
        execution_summary: null,
        exercises: [
          {
            training_plan_exercise_id: "exercise-1",
            exercise_name: "Squat",
            exercise_position: 1,
            configured_variant_count: 1,
            executable_variant_count: 1,
            execution_status: "GREEN",
            variants: [
              {
                id: "tpv-1",
                training_plan_exercise_id: "exercise-1",
                variant_id: "variant-1",
                variant_name: "Back Squat",
                requires_station: true,
                rep_min: 8,
                rep_max: 12,
                target_sets: 3,
                repetition_kind: "REPS",
                load_input_mode: "TOTAL",
                set_tracking_mode: "BILATERAL",
                availability: "AVAILABLE",
                compatible_stations: [{ station_id: "station-1", station_name: "Rack" }],
              },
            ],
          },
        ],
      },
    };

    el.state = state;

    const detailEl = el.querySelector("pb-training-plan-exercise-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Squat");
    expect(detailEl?.textContent ?? "").toContain("Leg Day");
    expect(detailEl?.textContent ?? "").toContain("Back Squat");
    expect(detailEl?.textContent ?? "").toContain("Downtown");
    expect(detailEl?.textContent ?? "").toContain("3 sets · 8-12 reps");
  });

  it("renders gym detail browser with selected gym id", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "gym-detail", gymId: "gym-1" };
    state.gymDetailScreen = {
      gymId: "gym-1",
      activeSheet: "stations",
      isLoading: false,
      errorMessage: null,
      stationChooser: null,
      detail: {
        id: "gym-1",
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
        exercise_groups: [],
      },
    };

    el.state = state;

    const detailEl = el.querySelector("pb-gym-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Downtown");
    expect(detailEl?.textContent ?? "").toContain("Rack");
    expect(detailEl?.querySelector("[data-gym-id]")?.getAttribute("data-gym-id")).toBe("gym-1");
  });

  it("renders station detail handoff with selected station id", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = { screen: "station-detail", gymId: "gym-1", stationId: "station-1" };
    state.gymDetailScreen.detail = {
      id: "gym-1",
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
      exercise_groups: [],
    };
    state.stationDetailScreen = {
      gymId: "gym-1",
      stationId: "station-1",
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
          possible_loads_kg: [20, 25],
        },
        suitable_variant_groups: [],
      },
    };

    el.state = state;

    const stationEl = el.querySelector("pb-station-detail-screen");
    expect(stationEl).toBeTruthy();
    expect(stationEl?.textContent ?? "").toContain("Rack");
    expect(stationEl?.textContent ?? "").toContain("Barbell");
    expect(stationEl?.querySelector("[data-station-id]")?.getAttribute("data-station-id")).toBe("station-1");
  });

  it("renders exercise variant detail fallback from station detail return context", () => {
    const el = document.createElement(pbAppRootTag) as HTMLElement & { state: AppState };
    document.body.append(el);

    const state = createState();
    state.viewState = {
      screen: "exercise-variant-detail",
      variantId: "variant-1",
      returnScreen: "station-detail",
      returnGymId: "gym-1",
      returnStationId: "station-1",
    };
    state.stationDetailScreen = {
      gymId: "gym-1",
      stationId: "station-1",
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
          possible_loads_kg: [20],
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
      },
    };

    el.state = state;

    const detailEl = el.querySelector("pb-exercise-variant-detail-screen");
    expect(detailEl).toBeTruthy();
    expect(detailEl?.textContent ?? "").toContain("Squat");
    expect(detailEl?.textContent ?? "").toContain("Back Squat");
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
    state.viewState = { screen: "workout-detail", workoutId: "workout-1", returnScreen: "progress" };
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
    expect(detailEl?.querySelector('[data-ui-action="navigate-history"]')?.getAttribute("aria-label")).toBe(
      "Back to progress",
    );
  });
});
