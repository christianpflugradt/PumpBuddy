import type { WorkoutProgressEntry, WorkoutProgressTone } from "./workout-types";

export const pbProgressScreenTag = "pb-progress-screen";

export type ProgressScreenState = {
  workouts: WorkoutProgressEntry[];
  isLoading: boolean;
  errorMessage: string | null;
};

type UiAction =
  | "toggle-side-menu"
  | "close-side-menu"
  | "open-workout-detail"
  | "navigate-workout"
  | "navigate-progress"
  | "navigate-exercises"
  | "navigate-history"
  | "navigate-settings"
  | "navigate-about"
  | "logout";

type OverallTone = "green" | "yellow" | "red" | "gray";

const MIN_PROGRESS = 0.7;
const MID_PROGRESS = 0.95;
const MAX_PROGRESS = 1.2;

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

const progressToneRank = (tone: WorkoutProgressTone): number => {
  if (tone === "GREEN") {
    return 3;
  }

  if (tone === "YELLOW") {
    return 2;
  }

  if (tone === "RED") {
    return 1;
  }

  return 0;
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

const resolveScoredWorkouts = (workouts: WorkoutProgressEntry[]): WorkoutProgressEntry[] =>
  workouts
    .filter(
      (workout) =>
        workout.workout_progress_status === "AVAILABLE" &&
        typeof workout.workout_progress === "number" &&
        Number.isFinite(workout.workout_progress),
    )
    .sort((left, right) => {
      const leftTime = parseDate(left.completed_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const rightTime = parseDate(right.completed_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
      return leftTime - rightTime;
    });

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

const toDayKey = (value: Date): string =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(
    value.getUTCDate(),
  ).padStart(2, "0")}`;

type HeatMapCell = {
  level: 0 | 1 | 2 | 3;
  workoutId: string | null;
};

const buildHeatMapCells = (workouts: WorkoutProgressEntry[]): HeatMapCell[] => {
  const now = new Date();
  const tonesByDate = new Map<
    string,
    {
      level: 0 | 1 | 2 | 3;
      workoutId: string;
      completedAtMs: number;
    }
  >();

  for (const workout of workouts) {
    const parsed = parseDate(workout.completed_at);
    if (!parsed) {
      continue;
    }

    const nextRank = progressToneRank(workout.progress_tone) as 0 | 1 | 2 | 3;
    if (nextRank === 0) {
      continue;
    }

    const key = toDayKey(parsed);
    const completedAtMs = parsed.getTime();
    const previous = tonesByDate.get(key);
    if (!previous) {
      tonesByDate.set(key, {
        level: nextRank,
        workoutId: workout.id,
        completedAtMs,
      });
      continue;
    }

    if (nextRank > previous.level || (nextRank === previous.level && completedAtMs > previous.completedAtMs)) {
      tonesByDate.set(key, {
        level: nextRank,
        workoutId: workout.id,
        completedAtMs,
      });
    }
  }

  const cells: HeatMapCell[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    day.setUTCDate(day.getUTCDate() - offset);
    const tone = tonesByDate.get(toDayKey(day));
    cells.push({
      level: tone?.level ?? 0,
      workoutId: tone?.workoutId ?? null,
    });
  }

  return cells;
};

const renderRecentActivity = (workouts: WorkoutProgressEntry[]): string => {
  const nowMs = Date.now();
  const parsed = workouts
    .map((workout) => ({
      workout,
      date: parseDate(workout.completed_at),
    }))
    .filter((entry): entry is { workout: WorkoutProgressEntry; date: Date } => entry.date !== null)
    .sort((left, right) => right.date.getTime() - left.date.getTime());

  const lastWorkout = parsed[0]?.date ?? null;
  const lastWorkoutText = (() => {
    if (!lastWorkout) {
      return "No workouts";
    }

    const days = Math.floor((nowMs - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return "Today";
    }

    return days === 1 ? "1 day ago" : `${days} days ago`;
  })();

  const last7Count = parsed.filter(
    (entry) => nowMs - entry.date.getTime() <= 7 * 24 * 60 * 60 * 1000,
  ).length;
  const last30Count = parsed.length;

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

const toUtcDayTimestamp = (value: Date): number =>
  Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());

const DAY_MS = 24 * 60 * 60 * 1000;

type ConsistencySummary = {
  rating: "Very consistent" | "Mostly consistent" | "Irregular";
};

const computeConsistencySummary = (workouts: WorkoutProgressEntry[]): ConsistencySummary => {
  const parsedDates = workouts
    .map((workout) => parseDate(workout.completed_at))
    .filter((value): value is Date => value !== null);

  const workoutCount = parsedDates.length;
  if (workoutCount < 4) {
    return {
      rating: "Irregular",
    };
  }

  const trainingDays = Array.from(
    new Set(parsedDates.map((value) => toUtcDayTimestamp(value))),
  ).sort((left, right) => left - right);
  const distinctTrainingDays = trainingDays.length;
  const workoutsPerDay = new Map<number, number>();
  for (const parsedDate of parsedDates) {
    const key = toUtcDayTimestamp(parsedDate);
    workoutsPerDay.set(key, (workoutsPerDay.get(key) ?? 0) + 1);
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
  const windowEndDay = Date.UTC(
    windowEnd.getUTCFullYear(),
    windowEnd.getUTCMonth(),
    windowEnd.getUTCDate(),
  );
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
  #state: ProgressScreenState = {
    workouts: [],
    isLoading: false,
    errorMessage: null,
  };

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);
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

      this.#emitUiActionWithPayload(action, { workoutId });
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
                  const level = cell.level;
                  const levelClass = level > 0 ? ` progress-heatmap-cell--l${level}` : "";
                  if (cell.workoutId === null) {
                    return `<span class="progress-heatmap-cell${levelClass}"></span>`;
                  }

                  return `
                    <button
                      type="button"
                      class="progress-heatmap-cell progress-heatmap-cell-button${levelClass}"
                      data-ui-action="open-workout-detail"
                      data-workout-id="${escapeAttribute(cell.workoutId)}"
                      aria-label="Open completed workout details"
                    ></button>
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
