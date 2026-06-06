import type { WorkoutProgressEntry, WorkoutProgressTone } from "./workout-contract";

export const pbProgressScreenTag = "pb-progress-screen";

export type ProgressScreenState = {
  workouts: WorkoutProgressEntry[];
  isLoading: boolean;
  errorMessage: string | null;
  selectedWorkoutId?: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "open-workout-detail"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-training-plans"
  | "navigate-gyms"
  | "navigate-history"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

type OverallTone = "green" | "yellow" | "red" | "gray";

const MIN_PROGRESS = 0.7;
const MID_PROGRESS = 0.95;
const MAX_PROGRESS = 1.2;
const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_DRILL_DELAY_MS = 150;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeAttribute = (value: string): string => escapeHtml(value).replaceAll("`", "&#96;");

const parseDate = (value: string): Date | null => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const normalizeTone = (tone: WorkoutProgressTone): OverallTone => {
  if (tone === "GREEN") {
    return "green";
  }

  if (tone === "YELLOW") {
    return "yellow";
  }

  if (tone === "RED") {
    return "red";
  }

  return "gray";
};

const toLocalDayKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;

const toLocalDayTimestamp = (value: Date): number =>
  Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());

type ParsedWorkoutEntry = {
  workout: WorkoutProgressEntry;
  date: Date;
  dayTimestamp: number;
};

const resolveRecentWindowWorkouts = (
  workouts: WorkoutProgressEntry[],
  dayCount: number,
): ParsedWorkoutEntry[] => {
  const now = new Date();
  const windowEndDay = toLocalDayTimestamp(now);
  const windowStartDay = windowEndDay - (dayCount - 1) * DAY_MS;

  return workouts
    .map((workout): ParsedWorkoutEntry | null => {
      const date = parseDate(workout.completed_at);
      if (!date) {
        return null;
      }

      const dayTimestamp = toLocalDayTimestamp(date);
      if (dayTimestamp < windowStartDay || dayTimestamp > windowEndDay) {
        return null;
      }

      return {
        workout,
        date,
        dayTimestamp,
      };
    })
    .filter((entry): entry is ParsedWorkoutEntry => entry !== null);
};

const resolveScoredWorkouts = (workouts: WorkoutProgressEntry[]): WorkoutProgressEntry[] =>
  resolveRecentWindowWorkouts(workouts, 30)
    .filter(
      ({ workout }) =>
        workout.workout_progress_status === "AVAILABLE" &&
        typeof workout.workout_progress === "number" &&
        Number.isFinite(workout.workout_progress),
    )
    .sort((left, right) => {
      const leftTime = left.date.getTime();
      const rightTime = right.date.getTime();
      return leftTime - rightTime;
    })
    .map(({ workout }) => workout);

const resolveOverallTone = (workouts: WorkoutProgressEntry[]): OverallTone => {
  const scored = resolveScoredWorkouts(workouts);
  if (scored.length < 3) {
    return "gray";
  }

  const average =
    scored.reduce((sum, workout) => sum + (workout.workout_progress ?? 0), 0) / scored.length;

  if (average < MID_PROGRESS) {
    return "red";
  }

  if (average <= 1.03) {
    return "yellow";
  }

  return "green";
};

const overallCopy: Record<OverallTone, { title: string; subtitle: string }> = {
  green: {
    title: "Improving",
    subtitle: "You’ve been improving over recent workouts.",
  },
  yellow: {
    title: "Stable",
    subtitle: "You’ve been holding your recent level.",
  },
  red: {
    title: "Lighter Phase",
    subtitle: "Recent workouts were lighter than your usual level.",
  },
  gray: {
    title: "Not enough data",
    subtitle: "We need at least 3 scored workouts in the last 30 days.",
  },
};

const renderOverallIcon = (tone: OverallTone): string => {
  if (tone === "gray") {
    return `
      <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M22 49 C30 40, 38 40, 46 49 S62 58, 69 49" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
      </svg>
    `;
  }

  if (tone === "red") {
    return `
      <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M26 32 C40 32, 50 40, 60 52" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
        <path d="M48 53 L61 53 L61 40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  if (tone === "yellow") {
    return `
      <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
        <path d="M26 44 L60 44" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
        <path d="M49 34 L61 44 L49 54" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 88 88" width="72" height="72" aria-hidden="true" focusable="false">
      <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" stroke-width="2.5"></circle>
      <path d="M26 58 C40 58, 50 48, 60 37" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path>
      <path d="M48 34 L61 34 L61 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
};

const renderTrendChart = (workouts: WorkoutProgressEntry[]): string => {
  const scored = resolveScoredWorkouts(workouts);
  if (scored.length === 0) {
    return `<p class="progress-empty-copy">No scored workouts yet.</p>`;
  }
  const overallTone = resolveOverallTone(workouts);

  const width = 640;
  const height = 220;
  const padTop = 14;
  const padRight = 12;
  const padBottom = 18;
  const padLeft = 34;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const points = scored.map((workout, index) => {
    const x =
      scored.length === 1
        ? padLeft + innerWidth / 2
        : padLeft + (innerWidth * index) / (scored.length - 1);
    const progress = (workout.workout_progress ?? MIN_PROGRESS) - MIN_PROGRESS;
    const y = padTop + innerHeight - (progress / (MAX_PROGRESS - MIN_PROGRESS)) * innerHeight;
    return {
      x,
      y,
      tone: normalizeTone(workout.progress_tone),
    };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const yTicks = [1.2, 0.95, 0.7];

  return `
    <svg class="progress-trend-svg progress-trend-svg--${overallTone}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      ${yTicks
        .map((value) => {
          const y =
            padTop + innerHeight - ((value - MIN_PROGRESS) / (MAX_PROGRESS - MIN_PROGRESS)) * innerHeight;
          return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="progress-trend-grid"></line>`;
        })
        .join("")}
      <path d="${path}" class="progress-trend-line"></path>
      ${points
        .map((point) => {
          return `<circle cx="${point.x}" cy="${point.y}" r="5.5" class="progress-trend-dot progress-trend-dot--${point.tone}"></circle>`;
        })
        .join("")}
    </svg>
  `;
};

type HeatMapCell = {
  variant: "none" | "gray" | "l1" | "l2" | "l3";
  workoutId: string | null;
  label: { kind: "today" | "date"; text: string } | null;
};

const formatHeatMapDateLabel = (value: Date): string => `${value.getMonth() + 1}/${value.getDate()}`;

const heatMapCellVariant = (
  tone: WorkoutProgressTone,
): { priority: 0 | 1 | 2 | 3; variant: HeatMapCell["variant"] } => {
  if (tone === "GREEN") {
    return { priority: 3, variant: "l3" };
  }

  if (tone === "YELLOW") {
    return { priority: 2, variant: "l2" };
  }

  if (tone === "RED") {
    return { priority: 1, variant: "l1" };
  }

  return { priority: 0, variant: "gray" };
};

const buildHeatMapCells = (workouts: WorkoutProgressEntry[]): HeatMapCell[] => {
  const tonesByDate = new Map<
    string,
    {
      priority: 0 | 1 | 2 | 3;
      variant: HeatMapCell["variant"];
      workoutId: string;
      completedAtMs: number;
    }
  >();

  for (const { workout, date } of resolveRecentWindowWorkouts(workouts, 30)) {
    const nextCell = heatMapCellVariant(workout.progress_tone);
    const key = toLocalDayKey(date);
    const completedAtMs = date.getTime();
    const previous = tonesByDate.get(key);
    if (!previous) {
      tonesByDate.set(key, {
        priority: nextCell.priority,
        variant: nextCell.variant,
        workoutId: workout.id,
        completedAtMs,
      });
      continue;
    }

    if (
      nextCell.priority > previous.priority ||
      (nextCell.priority === previous.priority && completedAtMs > previous.completedAtMs)
    ) {
      tonesByDate.set(key, {
        priority: nextCell.priority,
        variant: nextCell.variant,
        workoutId: workout.id,
        completedAtMs,
      });
    }
  }

  const cells: HeatMapCell[] = [];
  const now = new Date();
  const currentLocalDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(currentLocalDay);
    day.setDate(day.getDate() - offset);
    const tone = tonesByDate.get(toLocalDayKey(day));
    const label =
      tone !== undefined
        ? { kind: "date" as const, text: formatHeatMapDateLabel(day) }
        : offset === 0
          ? { kind: "today" as const, text: "Today" }
          : null;
    cells.push({
      variant: tone?.variant ?? "none",
      workoutId: tone?.workoutId ?? null,
      label,
    });
  }

  return cells;
};

const renderRecentActivity = (workouts: WorkoutProgressEntry[]): string => {
  const windowedWorkouts = resolveRecentWindowWorkouts(workouts, 30).sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  );
  const currentDay = toLocalDayTimestamp(new Date());

  const lastWorkout = windowedWorkouts[0] ?? null;
  const lastWorkoutText = (() => {
    if (!lastWorkout) {
      return "No workouts";
    }

    const days = Math.max(0, Math.round((currentDay - lastWorkout.dayTimestamp) / DAY_MS));
    if (days <= 0) {
      return "Today";
    }

    return days === 1 ? "1 day ago" : `${days} days ago`;
  })();

  const last7WindowStartDay = currentDay - 6 * DAY_MS;
  const last7Count = windowedWorkouts.filter((entry) => entry.dayTimestamp >= last7WindowStartDay).length;
  const last30Count = windowedWorkouts.length;

  return `
    <div class="progress-activity-grid">
      <p class="progress-activity-label">Last workout</p>
      <p class="progress-activity-value">${escapeHtml(lastWorkoutText)}</p>

      <div class="progress-activity-divider" aria-hidden="true"></div>

      <p class="progress-activity-label">Last 7 days</p>
      <p class="progress-activity-value">${escapeHtml(String(last7Count))} workouts</p>

      <div class="progress-activity-divider" aria-hidden="true"></div>

      <p class="progress-activity-label">Last 30 days</p>
      <p class="progress-activity-value">${escapeHtml(String(last30Count))} workouts</p>
    </div>
  `;
};

type ConsistencySummary = {
  rating: "Very consistent" | "Mostly consistent" | "Irregular";
};

const computeConsistencySummary = (workouts: WorkoutProgressEntry[]): ConsistencySummary => {
  const recentWindowWorkouts = resolveRecentWindowWorkouts(workouts, 30);
  const parsedDates = recentWindowWorkouts.map((entry) => entry.date);

  const workoutCount = parsedDates.length;
  if (workoutCount < 4) {
    return {
      rating: "Irregular",
    };
  }

  const trainingDays = Array.from(
    new Set(recentWindowWorkouts.map((entry) => entry.dayTimestamp)),
  ).sort((left, right) => left - right);
  const distinctTrainingDays = trainingDays.length;
  const workoutsPerDay = new Map<number, number>();
  for (const workoutEntry of recentWindowWorkouts) {
    workoutsPerDay.set(
      workoutEntry.dayTimestamp,
      (workoutsPerDay.get(workoutEntry.dayTimestamp) ?? 0) + 1,
    );
  }
  const maxWorkoutsPerDay = Math.max(...workoutsPerDay.values());

  if (maxWorkoutsPerDay > 1) {
    return {
      rating: "Irregular",
    };
  }

  if (distinctTrainingDays < 3) {
    return {
      rating: "Irregular",
    };
  }

  const windowEnd = new Date();
  const windowEndDay = toLocalDayTimestamp(windowEnd);
  const windowStartDay = windowEndDay - 29 * DAY_MS;

  const gaps: number[] = [];
  const firstTrainingDay = trainingDays[0] ?? windowEndDay;
  const lastTrainingDay = trainingDays[trainingDays.length - 1] ?? windowEndDay;
  gaps.push(Math.round((firstTrainingDay - windowStartDay) / DAY_MS));
  for (let index = 1; index < trainingDays.length; index += 1) {
    const previous = trainingDays[index - 1] ?? trainingDays[index];
    const current = trainingDays[index] ?? trainingDays[index - 1];
    gaps.push(Math.round((current - previous) / DAY_MS));
  }
  gaps.push(Math.round((windowEndDay - lastTrainingDay) / DAY_MS));

  const meanGap = gaps.length > 0 ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : 0;
  const gapVariance =
    gaps.length > 0
      ? gaps.reduce((sum, value) => sum + (value - meanGap) ** 2, 0) / gaps.length
      : 0;
  const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const largeGapCount = gaps.filter((value) => value > 8).length;

  if (maxGap > 10) {
    return {
      rating: "Irregular",
    };
  }

  let maxConsecutiveTrainingDays = trainingDays.length > 0 ? 1 : 0;
  let currentStreak = trainingDays.length > 0 ? 1 : 0;
  for (let index = 1; index < trainingDays.length; index += 1) {
    const previous = trainingDays[index - 1] ?? trainingDays[index];
    const current = trainingDays[index] ?? trainingDays[index - 1];
    const gapDays = Math.round((current - previous) / DAY_MS);
    if (gapDays === 1) {
      currentStreak += 1;
      maxConsecutiveTrainingDays = Math.max(maxConsecutiveTrainingDays, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  const veryConsistent =
    workoutCount >= 6 &&
    distinctTrainingDays >= 6 &&
    gapVariance <= 4 &&
    maxGap <= 6 &&
    maxConsecutiveTrainingDays <= 3;

  if (veryConsistent) {
    return {
      rating: "Very consistent",
    };
  }

  const mostlyConsistent =
    workoutCount >= 4 &&
    distinctTrainingDays >= 4 &&
    gapVariance <= 12 &&
    largeGapCount <= 1 &&
    maxConsecutiveTrainingDays <= 3;

  if (mostlyConsistent) {
    return {
      rating: "Mostly consistent",
    };
  }

  return {
    rating: "Irregular",
  };
};

const consistencyCopy: Record<ConsistencySummary["rating"], string> = {
  "Very consistent":
    "You’ve trained on a steady rhythm in the last 30 days with only small breaks. Keep this cadence going.",
  "Mostly consistent":
    "Your routine is fairly regular, with a few uneven days. A slightly steadier rhythm will boost momentum.",
  Irregular:
    "Your training pattern is still uneven in the last 30 days. A simple weekly plan can help you regain flow.",
};

class PbProgressScreenElement extends HTMLElement {
  #isSideMenuOpen = false;
  #launchingWorkoutId: string | null = null;
  #launchTimeoutId: number | null = null;
  #state: ProgressScreenState = {
    workouts: [],
    isLoading: false,
    errorMessage: null,
    selectedWorkoutId: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.#cancelPendingHeatMapLaunch({ rerender: false });
    this.#syncOutsideClickListener();
  }

  set state(value: ProgressScreenState) {
    this.#state = value;
    this.#render();
  }

  get state(): ProgressScreenState {
    return this.#state;
  }

  #emitUiAction(action: UiAction): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action },
      }),
    );
  }

  #emitUiActionWithPayload(action: UiAction, payload: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent("pb-ui-action", {
        bubbles: true,
        composed: true,
        detail: { action, payload },
      }),
    );
  }

  #syncSideMenuUi(): void {
    const toggleButton = this.querySelector('[data-ui-action="toggle-side-menu"]');
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.setAttribute("aria-expanded", this.#isSideMenuOpen ? "true" : "false");
      toggleButton.setAttribute(
        "aria-label",
        this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu",
      );
    }

    const sideMenuShell = this.querySelector(".side-menu-shell");
    if (sideMenuShell instanceof HTMLElement) {
      sideMenuShell.classList.toggle("is-open", this.#isSideMenuOpen);
      sideMenuShell.setAttribute("aria-hidden", this.#isSideMenuOpen ? "false" : "true");
    }
  }

  #setSideMenuOpen(nextOpen: boolean): void {
    if (this.#isSideMenuOpen === nextOpen) {
      return;
    }

    this.#isSideMenuOpen = nextOpen;
    this.#syncSideMenuUi();
    this.#syncOutsideClickListener();
  }

  #closeSideMenu = (): void => {
    this.#setSideMenuOpen(false);
  };

  #toggleSideMenu = (): void => {
    this.#setSideMenuOpen(!this.#isSideMenuOpen);
  };

  #onGlobalPointerDown = (event: Event): void => {
    if (!this.#isSideMenuOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('[data-ui-action="toggle-side-menu"]')) {
      return;
    }

    if (target.closest(".side-menu-panel")) {
      return;
    }

    this.#closeSideMenu();
  };

  #syncOutsideClickListener(): void {
    if (this.#isSideMenuOpen && this.isConnected) {
      window.addEventListener("pointerdown", this.#onGlobalPointerDown, true);
      return;
    }

    window.removeEventListener("pointerdown", this.#onGlobalPointerDown, true);
  }

  #cancelPendingHeatMapLaunch(options: { rerender?: boolean } = {}): void {
    if (this.#launchTimeoutId !== null) {
      window.clearTimeout(this.#launchTimeoutId);
      this.#launchTimeoutId = null;
    }

    if (this.#launchingWorkoutId === null) {
      return;
    }

    this.#launchingWorkoutId = null;
    if (options.rerender !== false) {
      this.#render();
    }
  }

  #queueHeatMapDrilldown(workoutId: string): void {
    if (this.#launchTimeoutId !== null) {
      window.clearTimeout(this.#launchTimeoutId);
    }

    const shouldRender = this.#launchingWorkoutId !== workoutId;
    this.#launchingWorkoutId = workoutId;
    if (shouldRender) {
      this.#render();
    }

    this.#launchTimeoutId = window.setTimeout(() => {
      this.#launchTimeoutId = null;
      this.#emitUiActionWithPayload("open-workout-detail", { workoutId });
    }, HEATMAP_DRILL_DELAY_MS);
  }

  #onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const actionElement = target.closest<HTMLElement>("[data-ui-action]");
    if (!actionElement || !this.contains(actionElement)) {
      return;
    }

    const action = actionElement.dataset.uiAction as UiAction | undefined;
    if (!action) {
      return;
    }

    if (action !== "open-workout-detail") {
      this.#cancelPendingHeatMapLaunch();
    }

    if (action === "toggle-side-menu") {
      this.#toggleSideMenu();
      return;
    }

    if (action === "close-side-menu") {
      this.#closeSideMenu();
      return;
    }

    if (action === "open-workout-detail") {
      const workoutId = actionElement.dataset.workoutId?.trim() ?? "";
      if (workoutId.length === 0) {
        return;
      }

      this.#queueHeatMapDrilldown(workoutId);
      return;
    }

    this.#setSideMenuOpen(false);
    this.#emitUiAction(action);
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }

    if (!this.#isSideMenuOpen) {
      return;
    }

    event.preventDefault();
    this.#closeSideMenu();
  };

  #render(): void {
    const sideMenuOpenClass = this.#isSideMenuOpen ? " is-open" : "";
    const scored = resolveScoredWorkouts(this.#state.workouts);
    const overallTone = resolveOverallTone(this.#state.workouts);
    const overall = overallCopy[overallTone];
    const heatCells = buildHeatMapCells(this.#state.workouts);
    const consistency = computeConsistencySummary(this.#state.workouts);
    const effectiveSelectedWorkoutId = this.#launchingWorkoutId ?? this.#state.selectedWorkoutId ?? null;

    this.innerHTML = `
      <div class="app-screen-shell start-screen-shell">
        <button
          type="button"
          class="side-menu-toggle"
          data-ui-action="toggle-side-menu"
          aria-label="${this.#isSideMenuOpen ? "Close navigation menu" : "Open navigation menu"}"
          aria-expanded="${this.#isSideMenuOpen ? "true" : "false"}"
          aria-controls="progress-screen-side-menu"
        >
          <span class="side-menu-toggle-lines" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <div class="side-menu-shell${sideMenuOpenClass}" aria-hidden="${this.#isSideMenuOpen ? "false" : "true"}">
          <div class="side-menu-backdrop" role="presentation"></div>
          <nav class="side-menu-panel" id="progress-screen-side-menu" aria-label="Main navigation">
            <p class="side-menu-title">Navigation</p>
            <ul class="side-menu-list">
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-workout">
                  Workout
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="close-side-menu">
                  Progress
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-exercises">
                  Exercises
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-training-plans">
                  Training Plans
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-gyms">
                  Gyms
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-history">
                  History
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-settings">
                  Settings
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="navigate-about">
                  About
                </button>
              </li>
              <li>
                <button type="button" class="side-menu-entry" data-ui-action="logout">
                  Log out
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <section class="screen-panel progress-screen" aria-label="Progress screen">
          <header class="app-header">
            <img class="start-banner" src="/images/banner.png?v=20260401-2" alt="PumpBuddy banner" />
          </header>
          <h2 class="settings-title">Progress</h2>
          <section class="progress-hero progress-hero--${overallTone}">
            <div class="progress-hero-icon" aria-hidden="true">${renderOverallIcon(overallTone)}</div>
            <div class="progress-hero-copy">
              <h3 class="progress-hero-title">${escapeHtml(overall.title)}</h3>
              <p class="progress-hero-subtitle">${escapeHtml(overall.subtitle)}</p>
            </div>
          </section>

          <section class="progress-card progress-card--trend" aria-label="Performance trend">
            <h3 class="progress-card-title">Performance Trend</h3>
            ${renderTrendChart(this.#state.workouts)}
            <p class="progress-card-subtitle">Based on ${escapeHtml(String(scored.length))} workouts with data</p>
          </section>

          <section class="progress-card progress-card--consistency" aria-label="Consistency heat map">
            <h3 class="progress-card-title">Consistency</h3>
            <p class="progress-card-subtitle">Last 30 days</p>
            <div class="progress-heatmap" role="img" aria-label="Consistency heat map of last 30 days">
              ${heatCells
                .map((cell) => {
                  const variantClass =
                    cell.variant === "none" ? "" : ` progress-heatmap-cell--${cell.variant}`;
                  const labelClasses = [
                    "progress-heatmap-cell-label",
                    cell.label === null ? "" : `progress-heatmap-cell-label--${cell.label.kind}`,
                    cell.label?.kind === "date" && cell.variant === "gray"
                      ? "progress-heatmap-cell-label--green-text"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const labelMarkup =
                    cell.label === null
                      ? ""
                      : `<span class="${labelClasses}">${escapeHtml(cell.label.text)}</span>`;
                  if (cell.workoutId === null) {
                    return `<span class="progress-heatmap-cell${variantClass}">${labelMarkup}</span>`;
                  }

                  const selectionClass =
                    effectiveSelectedWorkoutId === cell.workoutId
                      ? " progress-heatmap-cell--selected"
                      : "";
                  const launchingClass =
                    this.#launchingWorkoutId === cell.workoutId
                      ? " progress-heatmap-cell--launching"
                      : "";

                  return `
                    <button
                      type="button"
                      class="progress-heatmap-cell progress-heatmap-cell-button${variantClass}${selectionClass}${launchingClass}"
                      data-ui-action="open-workout-detail"
                      data-workout-id="${escapeAttribute(cell.workoutId)}"
                      aria-label="Open completed workout details"
                    >${labelMarkup}</button>
                  `;
                })
                .join("")}
            </div>
            <p class="progress-consistency-title">${escapeHtml(consistency.rating)}</p>
            <p class="progress-consistency-copy">${escapeHtml(consistencyCopy[consistency.rating])}</p>
          </section>

          <section class="progress-card progress-card--activity" aria-label="Recent activity">
            <h3 class="progress-card-title">Recent Activity</h3>
            ${renderRecentActivity(this.#state.workouts)}
          </section>

          ${
            this.#state.isLoading
              ? '<p class="start-copy" role="status" aria-live="polite">Loading progress…</p>'
              : this.#state.errorMessage
                ? `<p class="start-copy" role="alert">${escapeHtml(this.#state.errorMessage)}</p>`
                : ""
          }
        </section>
      </div>
    `;

    this.#syncSideMenuUi();
  }
}

export const registerPbProgressScreen = (): void => {
  if (!customElements.get(pbProgressScreenTag)) {
    customElements.define(pbProgressScreenTag, PbProgressScreenElement);
  }
};
