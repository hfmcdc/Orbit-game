/**
 * Shared hint-selection logic.
 *
 * This module knows nothing about rooms, turns, or solo sessions — it just
 * answers two questions given a precomputed rank ordering (from
 * semantics.ts):
 *   1. "What word should the next hint reveal, given a target rank?"
 *   2. "What target rank should the next hint aim for, given the best rank
 *      found so far?"
 *
 * Both multiplayer (server/src/rooms.ts) and Solo mode (server/src/solo.ts)
 * call into this same module so the hint math — and the guarantee that each
 * new hint is closer than the best guess found so far — only exists once.
 */

export interface HintWord {
  word: string;
  rank: number;
}

/**
 * Find a word to reveal as a hint, targeting a specific rank but searching
 * outward from it if that exact word has already been guessed or hinted, so
 * hints never repeat something already on the board.
 *
 * `orderedWords[i]` is expected to hold the word at rank i+1 (i.e. index 0 is
 * the secret word itself, rank 1).
 */
export function findHintWord(
  orderedWords: string[],
  usedWords: Set<string>,
  targetRank: number
): HintWord | null {
  const n = orderedWords.length;
  const target = Math.min(Math.max(targetRank, 2), n); // never hint rank 1 (the answer itself)
  for (let offset = 0; offset < n; offset++) {
    for (const r of [target - offset, target + offset]) {
      if (r >= 2 && r <= n) {
        const word = orderedWords[r - 1];
        if (!usedWords.has(word)) {
          return { word, rank: r };
        }
      }
    }
  }
  return null;
}

/**
 * The rank a fresh hint should target: closer than the best rank found so
 * far. If nobody has found anything ranked yet, halve the distance from the
 * last hint instead so hints still tighten over time.
 */
export function nextHintTargetRank(bestRankSoFar: number | null, lastHintRank: number): number {
  if (bestRankSoFar === null) {
    return Math.max(2, Math.floor(lastHintRank / 2));
  }
  return Math.max(2, Math.floor(bestRankSoFar / 2));
}

/** A generous starting foothold for the very first hint of a round: roughly the top ~5% closest words. */
export function openingHintRank(vocabSize: number): number {
  return Math.max(50, Math.floor(vocabSize / 20));
}
