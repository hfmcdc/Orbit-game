const STATS_KEY = "orbit_solo_stats_v1";

export interface SoloStats {
  gamesPlayed: number;
  wordsFound: number;
  bestGuesses: number | null; // fewest guesses to find the word, across all wins
  totalGuessesOnWins: number; // running sum, used to compute the average
  bestRankEver: number | null; // best (lowest) rank ever recorded, even mid-game
}

const EMPTY_STATS: SoloStats = {
  gamesPlayed: 0,
  wordsFound: 0,
  bestGuesses: null,
  totalGuessesOnWins: 0,
  bestRankEver: null,
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

export function loadSoloStats(): SoloStats {
  if (!isStorageAvailable()) return { ...EMPTY_STATS };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STATS, ...parsed };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function saveSoloStats(stats: SoloStats) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage errors (quota exceeded, private browsing, etc.)
  }
}

/** Record a finished game (practice or daily) — call once, right when a round is won. */
export function recordSoloWin(guessCount: number): SoloStats {
  const stats = loadSoloStats();
  stats.gamesPlayed += 1;
  stats.wordsFound += 1;
  stats.totalGuessesOnWins += guessCount;
  if (stats.bestGuesses === null || guessCount < stats.bestGuesses) {
    stats.bestGuesses = guessCount;
  }
  if (stats.bestRankEver === null || 1 < stats.bestRankEver) {
    stats.bestRankEver = 1;
  }
  saveSoloStats(stats);
  return stats;
}

/** Track the best rank seen even in games that were never finished, so "best rank" reflects real attempts. */
export function recordBestRankSeen(rank: number): void {
  if (rank <= 0) return;
  const stats = loadSoloStats();
  if (stats.bestRankEver === null || rank < stats.bestRankEver) {
    stats.bestRankEver = rank;
    saveSoloStats(stats);
  }
}

export function averageGuesses(stats: SoloStats): number | null {
  if (stats.wordsFound === 0) return null;
  return Math.round(stats.totalGuessesOnWins / stats.wordsFound);
}
