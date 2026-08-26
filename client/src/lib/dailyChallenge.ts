const DAILY_KEY = "orbit_daily_state_v1";

/**
 * Today's UTC calendar date as "YYYY-MM-DD" — matches the server's
 * `getTodayDateKey()` exactly, so the client always asks about (and caches
 * completion for) the same calendar day the server used to pick the word.
 */
export function getTodayDateKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DailyCompletion {
  dateKey: string;
  guessCount: number;
  bestRank: number; // always 1 for a completed daily, since finishing means finding the word
}

export interface DailyState {
  lastCompletedDate: string | null; // "YYYY-MM-DD"
  currentStreak: number;
  longestStreak: number;
  completions: Record<string, DailyCompletion>; // dateKey -> completion, so refresh can show today's result
}

const EMPTY_STATE: DailyState = {
  lastCompletedDate: null,
  currentStreak: 0,
  longestStreak: 0,
  completions: {},
};

function isStorageAvailable(): boolean {
  try {
    const testKey = "__orbit_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadDailyState(): DailyState {
  if (!isStorageAvailable()) return { ...EMPTY_STATE };
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STATE, ...parsed, completions: parsed.completions ?? {} };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveDailyState(state: DailyState) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

/** Calendar dates as "YYYY-MM-DD" strings; true if `dateKey` is exactly one day after `prevDateKey`. */
function isConsecutiveDay(prevDateKey: string, dateKey: string): boolean {
  const prev = new Date(prevDateKey + "T00:00:00Z").getTime();
  const curr = new Date(dateKey + "T00:00:00Z").getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return curr - prev === oneDayMs;
}

export function getTodayCompletion(dateKey: string): DailyCompletion | null {
  const state = loadDailyState();
  return state.completions[dateKey] ?? null;
}

export function isDailyCompleted(dateKey: string): boolean {
  return getTodayCompletion(dateKey) !== null;
}

/** Record today's Daily Challenge completion and update the streak. Call once, right when the round is won. */
export function recordDailyCompletion(dateKey: string, guessCount: number): DailyState {
  const state = loadDailyState();

  // Already recorded (shouldn't normally happen since the UI gates replay, but stay safe/idempotent).
  if (state.completions[dateKey]) return state;

  let newStreak: number;
  if (state.lastCompletedDate && isConsecutiveDay(state.lastCompletedDate, dateKey)) {
    newStreak = state.currentStreak + 1;
  } else {
    // Either this is the very first completion, or a day (or more) was missed.
    newStreak = 1;
  }

  const next: DailyState = {
    lastCompletedDate: dateKey,
    currentStreak: newStreak,
    longestStreak: Math.max(state.longestStreak, newStreak),
    completions: {
      ...state.completions,
      [dateKey]: { dateKey, guessCount, bestRank: 1 },
    },
  };
  saveDailyState(next);
  return next;
}

/**
 * Recompute the *displayed* current streak accounting for missed days, without
 * mutating storage. If more than one day has passed since the last
 * completion, the streak is effectively broken even though the player
 * hasn't attempted (and failed) anything today — this reflects that back to
 * the UI immediately rather than waiting for their next completion.
 */
export function getEffectiveCurrentStreak(todayKey: string): number {
  const state = loadDailyState();
  if (!state.lastCompletedDate) return 0;
  if (state.lastCompletedDate === todayKey) return state.currentStreak;
  if (isConsecutiveDay(state.lastCompletedDate, todayKey)) return state.currentStreak;
  return 0;
}
