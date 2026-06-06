export type SideMenuMiddleScreen =
  | "progress"
  | "history"
  | "exercises"
  | "training-plans"
  | "gyms";

export type SideMenuMiddleAction =
  | "navigate-progress"
  | "navigate-history"
  | "navigate-exercises"
  | "navigate-training-plans"
  | "navigate-gyms";

export type SideMenuMiddleApiScreen =
  | "progress"
  | "history"
  | "exercises"
  | "training_plans"
  | "gyms";

export type SideMenuMiddleClickCounts = Record<SideMenuMiddleScreen, number>;

type SideMenuMiddleCountPayload = Partial<
  Record<SideMenuMiddleScreen | SideMenuMiddleApiScreen, unknown>
>;

export const defaultSideMenuMiddleOrder: SideMenuMiddleScreen[] = [
  "progress",
  "history",
  "exercises",
  "training-plans",
  "gyms",
];

export const emptySideMenuMiddleClickCounts =
  (): SideMenuMiddleClickCounts => ({
    progress: 0,
    history: 0,
    exercises: 0,
    "training-plans": 0,
    gyms: 0,
  });

export const resolveSideMenuMiddleScreen = (
  action: string,
): SideMenuMiddleScreen | null => {
  if (action === "navigate-progress") {
    return "progress";
  }

  if (action === "navigate-history") {
    return "history";
  }

  if (action === "navigate-exercises") {
    return "exercises";
  }

  if (action === "navigate-training-plans") {
    return "training-plans";
  }

  if (action === "navigate-gyms") {
    return "gyms";
  }

  return null;
};

export const sideMenuMiddleScreenToApiScreen = (
  screen: SideMenuMiddleScreen,
): SideMenuMiddleApiScreen =>
  screen === "training-plans" ? "training_plans" : screen;

const parseCount = (value: unknown): number | null => {
  if (value === undefined) {
    return 0;
  }

  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return value;
};

export const normalizeSideMenuMiddleClickCounts = (
  raw: unknown,
): SideMenuMiddleClickCounts => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptySideMenuMiddleClickCounts();
  }

  const payload = raw as SideMenuMiddleCountPayload;
  const progress = parseCount(payload.progress);
  const history = parseCount(payload.history);
  const exercises = parseCount(payload.exercises);
  const trainingPlans = parseCount(
    payload["training-plans"] ?? payload.training_plans,
  );
  const gyms = parseCount(payload.gyms);

  if (
    progress === null ||
    history === null ||
    exercises === null ||
    trainingPlans === null ||
    gyms === null
  ) {
    return emptySideMenuMiddleClickCounts();
  }

  return {
    progress,
    history,
    exercises,
    "training-plans": trainingPlans,
    gyms,
  };
};

export const getOrderedSideMenuMiddleScreens = (
  countsInput: unknown,
): SideMenuMiddleScreen[] => {
  const counts = normalizeSideMenuMiddleClickCounts(countsInput);
  return [...defaultSideMenuMiddleOrder].sort((left, right) => {
    const countDelta = counts[right] - counts[left];
    if (countDelta !== 0) {
      return countDelta;
    }

    return (
      defaultSideMenuMiddleOrder.indexOf(left) -
      defaultSideMenuMiddleOrder.indexOf(right)
    );
  });
};

export const incrementSideMenuMiddleClickCounts = (
  countsInput: unknown,
  screen: SideMenuMiddleScreen,
): SideMenuMiddleClickCounts => {
  const counts = normalizeSideMenuMiddleClickCounts(countsInput);
  counts[screen] = Math.min(Number.MAX_SAFE_INTEGER, counts[screen] + 1);
  return counts;
};
