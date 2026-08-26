import fs from "fs";
import path from "path";

/**
 * Semantic ranking engine.
 *
 * We ship a precomputed vocabulary of ~8000 common English words, each with a
 * 300-dimensional word vector (extracted offline from a standard pretrained
 * embedding model and normalized to unit length). This avoids any expensive
 * ML inference at request time: the server never calls out to an embeddings
 * API and never computes a vector on the fly.
 *
 * For a given secret word, we compute cosine similarity (a simple dot product,
 * since vectors are pre-normalized) between the secret word's vector and every
 * word in the vocabulary ONCE, then sort to produce a full rank list. That
 * rank list is cached in memory for the lifetime of the room's round, so every
 * subsequent guess lookup is an O(1) map lookup instead of a fresh similarity
 * computation. This satisfies "same secret word -> same ranking for everyone"
 * and keeps per-guess cost effectively free.
 */

const DATA_DIR = path.join(__dirname, "..", "data");

const VECTOR_DIM = 300;

class VocabStore {
  words: string[];
  wordToIndex: Map<string, number>;
  vectors: Float32Array; // flattened [numWords * VECTOR_DIM], pre-normalized
  numWords: number;
  secretCandidates: string[];

  constructor() {
    const wordsPath = path.join(DATA_DIR, "words.json");
    const vecPath = path.join(DATA_DIR, "vectors.bin");
    const secretPath = path.join(DATA_DIR, "secret_candidates.json");

    this.words = JSON.parse(fs.readFileSync(wordsPath, "utf-8"));
    this.numWords = this.words.length;

    const buf = fs.readFileSync(vecPath);
    this.vectors = new Float32Array(
      buf.buffer,
      buf.byteOffset,
      buf.byteLength / Float32Array.BYTES_PER_ELEMENT
    );

    this.wordToIndex = new Map();
    this.words.forEach((w, i) => this.wordToIndex.set(w, i));

    this.secretCandidates = JSON.parse(fs.readFileSync(secretPath, "utf-8"));
  }

  hasWord(word: string): boolean {
    return this.wordToIndex.has(word);
  }

  getVector(word: string): Float32Array | null {
    const idx = this.wordToIndex.get(word);
    if (idx === undefined) return null;
    return this.vectors.subarray(idx * VECTOR_DIM, (idx + 1) * VECTOR_DIM);
  }

  randomSecretWord(): string {
    const i = Math.floor(Math.random() * this.secretCandidates.length);
    return this.secretCandidates[i];
  }
}

let store: VocabStore | null = null;

export function loadVocab(): void {
  if (!store) {
    const start = Date.now();
    store = new VocabStore();
    console.log(
      `[semantics] loaded ${store.numWords} word vectors in ${Date.now() - start}ms`
    );
  }
}

export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z]/g, ""); // letters only
}

export function isKnownWord(word: string): boolean {
  if (!store) throw new Error("vocab not loaded");
  return store.hasWord(word);
}

export function pickSecretWord(): string {
  if (!store) throw new Error("vocab not loaded");
  return store.randomSecretWord();
}

/**
 * Deterministically pick a secret word for a given calendar-date key
 * (e.g. "2026-08-25"), so every player who plays the Daily Challenge on the
 * same date gets the same word. Uses a simple string hash rather than
 * Math.random, so the same date key always maps to the same index into the
 * existing secret-word candidate list — no separate word list, no extra
 * data files.
 */
function hashDateKey(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickDailySecretWord(dateKey: string): string {
  if (!store) throw new Error("vocab not loaded");
  const idx = hashDateKey(dateKey) % store.secretCandidates.length;
  return store.secretCandidates[idx];
}

/** Today's UTC calendar date as "YYYY-MM-DD" — the shared key for the Daily Challenge, consistent for every player regardless of local timezone. */
export function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build a full rank list for a secret word: an ordered array of vocab words
 * from most similar (rank 1, the secret word itself) to least similar.
 * Returns both a Map from word -> rank (1-indexed) for O(1) guess lookups,
 * and the ordered word array itself so the server can look up "what word
 * sits at rank N" — used to generate hints at a specific rank.
 */
export interface RankingResult {
  rankMap: Map<string, number>;
  orderedWords: string[]; // orderedWords[i] has rank i+1
}

export function buildRankingForSecret(secretWord: string): RankingResult {
  if (!store) throw new Error("vocab not loaded");
  const secretVec = store.getVector(secretWord);
  if (!secretVec) {
    throw new Error(`secret word "${secretWord}" not found in vocabulary`);
  }

  const n = store.numWords;
  const scores = new Float32Array(n);
  const vectors = store.vectors;

  for (let i = 0; i < n; i++) {
    let dot = 0;
    const base = i * VECTOR_DIM;
    for (let d = 0; d < VECTOR_DIM; d++) {
      dot += vectors[base + d] * secretVec[d];
    }
    scores[i] = dot;
  }

  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);

  const rankMap = new Map<string, number>();
  const orderedWords: string[] = new Array(n);
  for (let rank = 0; rank < indices.length; rank++) {
    const word = store.words[indices[rank]];
    rankMap.set(word, rank + 1);
    orderedWords[rank] = word;
  }
  return { rankMap, orderedWords };
}

export function getVocabSize(): number {
  if (!store) throw new Error("vocab not loaded");
  return store.numWords;
}
