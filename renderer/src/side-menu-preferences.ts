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

export type SideMenuMiddleClickCounts = Record<SideMenuMiddleScreen, number>;

export const defaultSideMenuMiddleOrder: SideMenuMiddleScreen[] = [
  "progress",
  "history",
  "exercises",
  "training-plans",
  "gyms",
];

const storageKeyPrefix = "pumpbuddy.side-menu.middle-clicks.v1";
const middleScreenSet = new Set<SideMenuMiddleScreen>(defaultSideMenuMiddleOrder);

const emptyCounts = (): SideMenuMiddleClickCounts => ({
  progress: 0,
  history: 0,
  exercises: 0,
  "training-plans": 0,
  gyms: 0,
});

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const resolveSideMenuStorageKey = (userId: string): string =>
  `${storageKeyPrefix}:${encodeURIComponent(userId)}`;

const normalizeUserId = (userId: string | null | undefined): string | null => {
  const normalized = userId?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

export const resolveSideMenuMiddleScreen = (action: string): SideMenuMiddleScreen | null => {
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

const parseStoredCounts = (raw: string | null): SideMenuMiddleClickCounts => {
  if (!raw) {
    return emptyCounts();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyCounts();
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return emptyCounts();
  }

  const counts = emptyCounts();
  for (const [key, value] of Object.entries(parsed)) {
    if (!middleScreenSet.has(key as SideMenuMiddleScreen)) {
      continue;
    }

    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      return emptyCounts();
    }

    counts[key as SideMenuMiddleScreen] = value;
  }

  return counts;
};

export const readSideMenuMiddleClickCounts = (
  userId: string | null | undefined,
  storage: Storage | null = getStorage(),
): SideMenuMiddleClickCounts => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !storage) {
    return emptyCounts();
  }

  try {
    return parseStoredCounts(storage.getItem(resolveSideMenuStorageKey(normalizedUserId)));
  } catch {
    return emptyCounts();
  }
};

export const getOrderedSideMenuMiddleScreens = (
  userId: string | null | undefined,
  storage: Storage | null = getStorage(),
): SideMenuMiddleScreen[] => {
  const counts = readSideMenuMiddleClickCounts(userId, storage);
  return [...defaultSideMenuMiddleOrder].sort((left, right) => {
    const countDelta = counts[right] - counts[left];
    if (countDelta !== 0) {
      return countDelta;
    }

    return defaultSideMenuMiddleOrder.indexOf(left) - defaultSideMenuMiddleOrder.indexOf(right);
  });
};

export const incrementSideMenuMiddleClickCount = (
  userId: string | null | undefined,
  screen: SideMenuMiddleScreen,
  storage: Storage | null = getStorage(),
): void => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !storage) {
    return;
  }

  try {
    const counts = readSideMenuMiddleClickCounts(normalizedUserId, storage);
    counts[screen] = Math.min(Number.MAX_SAFE_INTEGER, counts[screen] + 1);
    storage.setItem(resolveSideMenuStorageKey(normalizedUserId), JSON.stringify(counts));
  } catch {
    // Storage can be unavailable or full; menu ordering should remain a best-effort preference.
  }
};
