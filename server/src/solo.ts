import { randomUUID } from "crypto";
import {
  buildRankingForSecret,
  getTodayDateKey,
  getVocabSize,
  isKnownWord,
  normalizeWord,
  pickDailySecretWord,
  pickSecretWord,
} from "./semantics";
import { findHintWord, nextHintTargetRank, openingHintRank } from "./hints";
import type { SoloGuessResult, SoloMode, SoloStateForClient, SoloStatus } from "./shared/types";

const MAX_SOLO_GUESS_HISTORY = 200;
const HINT_INTERVAL_GUESSES = 5; // Solo has no turns, so hints trigger off completed guesses instead
const HINT_SYSTEM_ID = "system";
const PRACTICE_REPEAT_AVOID_ATTEMPTS = 5;

interface SoloGame {
  id: string;
  socketId: string;
  mode: SoloMode;
  dateKey: string | null;
  secretWord: string;
  rankMap: Map<string, number>;
  orderedWords: string[];
  guesses: SoloGuessResult[]; // most recent first
  guessedWords: Set<string>;
  hintedWords: Set<string>;
  lastHintRank: number;
  bestRank: number | null;
  guessCount: number;
  status: SoloStatus;
  createdAt: number;
}

const soloGames = new Map<string, SoloGame>();
const socketToSoloIds = new Map<string, Set<string>>();
const lastPracticeWordBySocket = new Map<string, string>();

function trackSocketSolo(socketId: string, soloId: string) {
  let set = socketToSoloIds.get(socketId);
  if (!set) {
    set = new Set();
    socketToSoloIds.set(socketId, set);
  }
  set.add(soloId);
}

function pickPracticeWord(socketId: string): string {
  const last = lastPracticeWordBySocket.get(socketId);
  let word = pickSecretWord();
  let attempts = 0;
  while (word === last && attempts < PRACTICE_REPEAT_AVOID_ATTEMPTS) {
    word = pickSecretWord();
    attempts++;
  }
  lastPracticeWordBySocket.set(socketId, word);
  return word;
}

function revealSoloHint(game: SoloGame, targetRank: number) {
  const used = new Set([...game.hintedWords, ...game.guessedWords]);
  const found = findHintWord(game.orderedWords, used, targetRank);
  if (!found) return;
  game.hintedWords.add(found.word);
  game.lastHintRank = found.rank;

  const hint: SoloGuessResult = {
    id: randomUUID(),
    word: found.word,
    rank: found.rank,
    createdAt: Date.now(),
    isHint: true,
  };
  game.guesses.unshift(hint);
  if (game.guesses.length > MAX_SOLO_GUESS_HISTORY) game.guesses.pop();
}

function beginSoloRound(mode: SoloMode, socketId: string): SoloGame {
  const dateKey = mode === "daily" ? getTodayDateKey() : null;
  const secretWord = mode === "daily" ? pickDailySecretWord(dateKey!) : pickPracticeWord(socketId);
  const { rankMap, orderedWords } = buildRankingForSecret(secretWord);

  const game: SoloGame = {
    id: randomUUID(),
    socketId,
    mode,
    dateKey,
    secretWord,
    rankMap,
    orderedWords,
    guesses: [],
    guessedWords: new Set(),
    hintedWords: new Set(),
    lastHintRank: 0,
    bestRank: null,
    guessCount: 0,
    status: "playing",
    createdAt: Date.now(),
  };

  // Opening hint, revealed immediately, before any guesses.
  const opening = openingHintRank(getVocabSize());
  game.lastHintRank = opening;
  revealSoloHint(game, opening);

  soloGames.set(game.id, game);
  trackSocketSolo(socketId, game.id);
  return game;
}

export function toPublicSoloState(game: SoloGame): SoloStateForClient {
  return {
    soloId: game.id,
    mode: game.mode,
    status: game.status,
    dateKey: game.dateKey,
    bestRank: game.bestRank,
    guessCount: game.guessCount,
    guesses: game.guesses.slice(0, MAX_SOLO_GUESS_HISTORY),
    secretWord: game.status === "finished" ? game.secretWord : null,
  };
}

export function startSolo(mode: SoloMode, socketId: string) {
  if (mode !== "practice" && mode !== "daily") {
    return { ok: false as const, error: "Invalid solo mode." };
  }
  const game = beginSoloRound(mode, socketId);
  return { ok: true as const, state: toPublicSoloState(game) };
}

function getOwnedGame(soloId: string, socketId: string) {
  const game = soloGames.get(soloId);
  if (!game) return { ok: false as const, error: "Solo game not found." };
  if (game.socketId !== socketId) {
    return { ok: false as const, error: "This solo game belongs to a different session." };
  }
  return { ok: true as const, game };
}

export function submitSoloGuess(soloId: string, socketId: string, rawWord: string) {
  const owned = getOwnedGame(soloId, socketId);
  if (!owned.ok) return owned;
  const game = owned.game;

  if (game.status !== "playing") {
    return { ok: false as const, error: "This solo game is already finished." };
  }

  const word = normalizeWord(rawWord);
  if (!word) {
    return { ok: false as const, error: "Please enter a word." };
  }
  if (game.guessedWords.has(word)) {
    return { ok: false as const, error: "You already guessed that word." };
  }
  if (!isKnownWord(word)) {
    return { ok: false as const, error: `"${rawWord.trim()}" isn't in the word list. Try another word.` };
  }

  game.guessedWords.add(word);
  const rank = game.rankMap.get(word) ?? -1;
  game.guessCount += 1;
  if (rank > 0 && (game.bestRank === null || rank < game.bestRank)) {
    game.bestRank = rank;
  }

  const guess: SoloGuessResult = {
    id: randomUUID(),
    word,
    rank,
    createdAt: Date.now(),
  };
  game.guesses.unshift(guess);
  if (game.guesses.length > MAX_SOLO_GUESS_HISTORY) game.guesses.pop();

  if (rank === 1) {
    game.status = "finished";
    return { ok: true as const, state: toPublicSoloState(game) };
  }

  // No turns in Solo — hints trigger off completed guesses instead.
  if (game.guessCount % HINT_INTERVAL_GUESSES === 0) {
    revealSoloHint(game, nextHintTargetRank(game.bestRank, game.lastHintRank));
  }

  return { ok: true as const, state: toPublicSoloState(game) };
}

export function newSoloGame(soloId: string, socketId: string) {
  const owned = getOwnedGame(soloId, socketId);
  if (!owned.ok) return owned;
  const game = owned.game;

  if (game.mode === "daily") {
    return {
      ok: false as const,
      error: "The Daily Challenge can only be played once per day. Try Practice for another round.",
    };
  }

  // Replace this slot's state with a fresh practice round, reusing the same soloId.
  const secretWord = pickPracticeWord(socketId);
  const { rankMap, orderedWords } = buildRankingForSecret(secretWord);
  game.secretWord = secretWord;
  game.rankMap = rankMap;
  game.orderedWords = orderedWords;
  game.guesses = [];
  game.guessedWords = new Set();
  game.hintedWords = new Set();
  game.bestRank = null;
  game.guessCount = 0;
  game.status = "playing";

  const opening = openingHintRank(getVocabSize());
  game.lastHintRank = opening;
  revealSoloHint(game, opening);

  return { ok: true as const, state: toPublicSoloState(game) };
}

export function leaveSolo(soloId: string, socketId: string) {
  const owned = getOwnedGame(soloId, socketId);
  if (!owned.ok) return owned;
  soloGames.delete(soloId);
  socketToSoloIds.get(socketId)?.delete(soloId);
  return { ok: true as const };
}

/** Clean up all solo games tied to a socket when it disconnects. */
export function cleanupSoloForSocket(socketId: string) {
  const ids = socketToSoloIds.get(socketId);
  if (ids) {
    for (const id of ids) soloGames.delete(id);
    socketToSoloIds.delete(socketId);
  }
  lastPracticeWordBySocket.delete(socketId);
}
