import { randomUUID } from "crypto";
import {
  buildRankingForSecret,
  getVocabSize,
  isKnownWord,
  normalizeWord,
  pickSecretWord,
} from "./semantics";
import type {
  GameStatus,
  GuessResult,
  PlayerPublic,
  RoomStateForClient,
} from "./shared/types";

export const TURN_SECONDS = process.env.TURN_SECONDS
  ? parseInt(process.env.TURN_SECONDS, 10)
  : 15;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
const MAX_GUESS_HISTORY = 50;
const DISCONNECT_REMOVAL_MS = 60_000; // remove disconnected players after 60s
const HINT_INTERVAL_TURNS = 12; // reveal a new hint every 12 turns (12 x 15s)
const HINT_SYSTEM_ID = "system";
export const VOTE_SECONDS = 20; // how long a give-up vote stays open
export const GIVEUP_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes after a failed vote

interface Player {
  id: string;
  nickname: string;
  socketId: string | null;
  connected: boolean;
  isHost: boolean;
  bestRank: number | null;
  guessCount: number;
  guessedWords: Set<string>;
  disconnectedAt: number | null;
}

interface VoteInternal {
  active: boolean;
  initiatorId: string | null;
  deadline: number | null;
  votes: Map<string, "yes" | "no">;
  timer: NodeJS.Timeout | null;
}

interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  playerOrder: string[]; // player ids in turn order
  status: GameStatus;
  currentTurnIndex: number;
  turnDeadline: number | null;
  turnTimer: NodeJS.Timeout | null;
  secretWord: string | null;
  rankMap: Map<string, number> | null;
  orderedWords: string[] | null; // orderedWords[i] has rank i+1; used to build hints
  guesses: GuessResult[];
  winnerId: string | null;
  round: number;
  createdAt: number;
  turnsCompleted: number; // total turns finished this round, across all players
  hintedWords: Set<string>; // words already revealed as hints this round
  lastHintRank: number; // rank of the most recently revealed hint
  vote: VoteInternal;
  giveUpAvailableAt: number; // epoch ms; a new vote can't be called before this
  endedByGiveUp: boolean;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function activePlayers(room: Room): Player[] {
  return room.playerOrder
    .map((id) => room.players.get(id)!)
    .filter((p) => p && p.connected);
}

export function createRoom(hostNickname: string, hostSocketId: string) {
  const code = generateRoomCode();
  const hostId = randomUUID();
  const host: Player = {
    id: hostId,
    nickname: sanitizeNickname(hostNickname),
    socketId: hostSocketId,
    connected: true,
    isHost: true,
    bestRank: null,
    guessCount: 0,
    guessedWords: new Set(),
    disconnectedAt: null,
  };
  const room: Room = {
    code,
    hostId,
    players: new Map([[hostId, host]]),
    playerOrder: [hostId],
    status: "lobby",
    currentTurnIndex: 0,
    turnDeadline: null,
    turnTimer: null,
    secretWord: null,
    rankMap: null,
    orderedWords: null,
    guesses: [],
    winnerId: null,
    round: 0,
    createdAt: Date.now(),
    turnsCompleted: 0,
    hintedWords: new Set(),
    lastHintRank: 0,
    vote: { active: false, initiatorId: null, deadline: null, votes: new Map(), timer: null },
    giveUpAvailableAt: 0,
    endedByGiveUp: false,
  };
  rooms.set(code, room);
  return { room, playerId: hostId };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function sanitizeNickname(raw: string): string {
  const trimmed = (raw || "").trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "Player";
}

export function joinRoom(code: string, nickname: string, socketId: string) {
  const room = getRoom(code);
  if (!room) return { ok: false as const, error: "Room not found." };
  if (room.status !== "lobby") {
    return { ok: false as const, error: "Game already started." };
  }
  const active = activePlayers(room);
  if (active.length >= MAX_PLAYERS) {
    return { ok: false as const, error: "Room is full." };
  }
  const playerId = randomUUID();
  const player: Player = {
    id: playerId,
    nickname: sanitizeNickname(nickname),
    socketId,
    connected: true,
    isHost: false,
    bestRank: null,
    guessCount: 0,
    guessedWords: new Set(),
    disconnectedAt: null,
  };
  room.players.set(playerId, player);
  room.playerOrder.push(playerId);
  return { ok: true as const, room, playerId };
}

export function findRoomByPlayerId(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return room;
  }
  return undefined;
}

export function toPublicState(room: Room): RoomStateForClient {
  const players: PlayerPublic[] = room.playerOrder
    .map((id) => room.players.get(id))
    .filter((p): p is Player => !!p)
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.isHost,
      bestRank: p.bestRank,
      guessCount: p.guessCount,
    }));

  const currentPlayerId =
    room.status === "playing" ? room.playerOrder[room.currentTurnIndex] ?? null : null;

  return {
    roomCode: room.code,
    status: room.status,
    players,
    hostId: room.hostId,
    currentPlayerId,
    turnDeadline: room.turnDeadline,
    turnSeconds: TURN_SECONDS,
    guesses: room.guesses.slice(0, MAX_GUESS_HISTORY),
    winnerId: room.winnerId,
    secretWord: room.status === "finished" ? room.secretWord : null,
    round: room.round,
    vote: {
      active: room.vote.active,
      initiatorId: room.vote.initiatorId,
      deadline: room.vote.deadline,
      voteSeconds: VOTE_SECONDS,
      votes: Object.fromEntries(room.vote.votes),
    },
    giveUpAvailableAt: room.giveUpAvailableAt,
    endedByGiveUp: room.endedByGiveUp,
  };
}

// ---- Game flow ----

type Broadcasters = {
  onRoomState: (room: Room) => void;
  onTurnTick: (room: Room) => void;
  onGameOver: (room: Room) => void;
  onNewGuess: (room: Room, guess: GuessResult) => void;
  onVoteConcluded: (room: Room, passed: boolean) => void;
};

let broadcasters: Broadcasters | null = null;
export function registerBroadcasters(b: Broadcasters) {
  broadcasters = b;
}

function clearTurnTimer(room: Room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function activeOrderIndices(room: Room): number[] {
  const idxs: number[] = [];
  room.playerOrder.forEach((id, i) => {
    const p = room.players.get(id);
    if (p && p.connected) idxs.push(i);
  });
  return idxs;
}

/**
 * Find a word to reveal as a hint, targeting a specific rank but searching
 * outward from it if that exact word has already been guessed or hinted
 * (so hints never repeat something already on the board).
 */
function findHintWord(room: Room, targetRank: number): { word: string; rank: number } | null {
  if (!room.orderedWords) return null;
  const n = room.orderedWords.length;
  const used = new Set(room.hintedWords);
  for (const p of room.players.values()) {
    for (const w of p.guessedWords) used.add(w);
  }

  const target = Math.min(Math.max(targetRank, 2), n); // never hint rank 1 (the answer itself)
  for (let offset = 0; offset < n; offset++) {
    for (const r of [target - offset, target + offset]) {
      if (r >= 2 && r <= n) {
        const word = room.orderedWords[r - 1];
        if (!used.has(word)) {
          return { word, rank: r };
        }
      }
    }
  }
  return null;
}

/** Reveal a hint word at (or near) the given target rank, broadcast it to the room. */
function revealHint(room: Room, targetRank: number) {
  const found = findHintWord(room, targetRank);
  if (!found) return;
  room.hintedWords.add(found.word);
  room.lastHintRank = found.rank;

  const hint: GuessResult = {
    id: randomUUID(),
    playerId: HINT_SYSTEM_ID,
    nickname: "Hint",
    word: found.word,
    rank: found.rank,
    createdAt: Date.now(),
    isHint: true,
  };
  room.guesses.unshift(hint);
  if (room.guesses.length > MAX_GUESS_HISTORY) room.guesses.pop();
  broadcasters?.onNewGuess(room, hint);
}

/** The rank a fresh hint should target: closer than anyone's best guess so far. */
function nextHintTargetRank(room: Room): number {
  let bestRank = Infinity;
  for (const p of room.players.values()) {
    if (p.bestRank !== null && p.bestRank < bestRank) bestRank = p.bestRank;
  }
  if (bestRank === Infinity) {
    // Nobody has found anything ranked yet — halve the distance from the last hint.
    return Math.max(2, Math.floor(room.lastHintRank / 2));
  }
  return Math.max(2, Math.floor(bestRank / 2));
}

function advanceTurn(room: Room) {
  const active = activeOrderIndices(room);
  if (active.length === 0) {
    room.status = "lobby";
    clearTurnTimer(room);
    room.turnDeadline = null;
    broadcasters?.onRoomState(room);
    return;
  }
  if (active.length < MIN_PLAYERS) {
    // Not enough players to continue; pause the game back to lobby.
    room.status = "lobby";
    clearTurnTimer(room);
    room.turnDeadline = null;
    broadcasters?.onRoomState(room);
    return;
  }

  // find next active index after currentTurnIndex, wrapping
  const n = room.playerOrder.length;
  let next = (room.currentTurnIndex + 1) % n;
  let guard = 0;
  while (!active.includes(next) && guard < n) {
    next = (next + 1) % n;
    guard++;
  }
  room.currentTurnIndex = next;

  // Every HINT_INTERVAL_TURNS completed turns, reveal a new hint that's
  // guaranteed closer than the best guess found so far — this only ever
  // fires while the round is still ongoing, i.e. nobody has found #1 yet.
  room.turnsCompleted += 1;
  if (room.turnsCompleted % HINT_INTERVAL_TURNS === 0) {
    revealHint(room, nextHintTargetRank(room));
  }

  startTurnTimer(room);
}

function startTurnTimer(room: Room) {
  clearTurnTimer(room);
  room.turnDeadline = Date.now() + TURN_SECONDS * 1000;
  broadcasters?.onTurnTick(room);
  room.turnTimer = setTimeout(() => {
    // timer expired: skip this player's turn
    if (room.status !== "playing") return;
    advanceTurn(room);
    broadcasters?.onRoomState(room);
  }, TURN_SECONDS * 1000);
}

export function startGame(room: Room, requesterId: string) {
  if (requesterId !== room.hostId) {
    return { ok: false as const, error: "Only the host can start the game." };
  }
  const active = activePlayers(room);
  if (active.length < MIN_PLAYERS) {
    return { ok: false as const, error: "Need at least 2 players to start." };
  }
  if (room.status === "playing") {
    return { ok: false as const, error: "Game already in progress." };
  }

  beginRound(room);
  return { ok: true as const };
}

function beginRound(room: Room) {
  // Reset player round stats but keep them in the lobby/roster
  for (const p of room.players.values()) {
    p.bestRank = null;
    p.guessCount = 0;
    p.guessedWords.clear();
  }
  room.guesses = [];
  room.winnerId = null;
  room.secretWord = pickSecretWord();
  const { rankMap, orderedWords } = buildRankingForSecret(room.secretWord);
  room.rankMap = rankMap;
  room.orderedWords = orderedWords;
  room.status = "playing";
  room.round += 1;
  room.turnsCompleted = 0;
  room.hintedWords = new Set();
  clearVoteTimer(room);
  room.vote = { active: false, initiatorId: null, deadline: null, votes: new Map(), timer: null };
  room.giveUpAvailableAt = 0;
  room.endedByGiveUp = false;

  // Opening hint: a generous starting foothold, revealed before anyone has
  // guessed anything (roughly top ~5% closest words in the vocabulary).
  const vocabSize = getVocabSize();
  const openingHintRank = Math.max(50, Math.floor(vocabSize / 20));
  room.lastHintRank = openingHintRank;
  revealHint(room, openingHintRank);

  // Start with the first active player
  const active = activeOrderIndices(room);
  room.currentTurnIndex = active[0] ?? 0;
  startTurnTimer(room);
  broadcasters?.onRoomState(room);
}

export function playAgain(room: Room, requesterId: string) {
  if (requesterId !== room.hostId) {
    return { ok: false as const, error: "Only the host can start a new round." };
  }
  if (room.status !== "finished") {
    return { ok: false as const, error: "Game is not finished yet." };
  }
  const active = activePlayers(room);
  if (active.length < MIN_PLAYERS) {
    room.status = "lobby";
    broadcasters?.onRoomState(room);
    return { ok: false as const, error: "Need at least 2 players to start." };
  }
  beginRound(room);
  return { ok: true as const };
}

export function submitGuess(room: Room, playerId: string, rawWord: string) {
  if (room.status !== "playing") {
    return { ok: false as const, error: "Game is not in progress." };
  }
  const currentPlayerId = room.playerOrder[room.currentTurnIndex];
  if (playerId !== currentPlayerId) {
    return { ok: false as const, error: "It's not your turn." };
  }
  if (room.turnDeadline !== null && Date.now() > room.turnDeadline) {
    return { ok: false as const, error: "Time's up for this turn." };
  }

  const word = normalizeWord(rawWord);
  if (!word) {
    return { ok: false as const, error: "Please enter a word." };
  }

  const player = room.players.get(playerId);
  if (!player) return { ok: false as const, error: "Player not found." };

  if (player.guessedWords.has(word)) {
    return { ok: false as const, error: "You already guessed that word." };
  }

  if (!isKnownWord(word)) {
    return { ok: false as const, error: `"${rawWord.trim()}" isn't in the word list. Try another word.` };
  }

  player.guessedWords.add(word);

  const rank = room.rankMap?.get(word) ?? -1;
  player.guessCount += 1;
  if (rank > 0 && (player.bestRank === null || rank < player.bestRank)) {
    player.bestRank = rank;
  }

  const guess: GuessResult = {
    id: randomUUID(),
    playerId: player.id,
    nickname: player.nickname,
    word,
    rank,
    createdAt: Date.now(),
  };
  room.guesses.unshift(guess);
  if (room.guesses.length > MAX_GUESS_HISTORY) room.guesses.pop();

  if (rank === 1) {
    // Winner!
    room.status = "finished";
    room.winnerId = player.id;
    clearTurnTimer(room);
    room.turnDeadline = null;
    broadcasters?.onGameOver(room);
    return { ok: true as const, guess, wonGame: true };
  }

  // Each player gets exactly one guess per turn: end this turn right away
  // and hand it to the next player. Turns themselves are unlimited — play
  // keeps cycling through everyone until someone reaches #1.
  clearTurnTimer(room);
  advanceTurn(room);
  return { ok: true as const, guess, wonGame: false };
}

export function skipToNextTurnIfCurrent(room: Room, playerId: string) {
  const currentPlayerId = room.playerOrder[room.currentTurnIndex];
  if (playerId === currentPlayerId && room.status === "playing") {
    advanceTurn(room);
  }
}

// ---- Give-up voting ----

function clearVoteTimer(room: Room) {
  if (room.vote.timer) {
    clearTimeout(room.vote.timer);
    room.vote.timer = null;
  }
}

/**
 * Find the player who reached a given rank first, chronologically, by
 * scanning the (recency-capped) guess history. Used to break ties when two
 * or more players share the same best rank at the moment a give-up vote
 * passes. Falls back to whichever player we already had if history for one
 * side has aged out of the capped guess log.
 */
function earlierAchiever(room: Room, currentWinnerId: string, challengerId: string, rank: number): string {
  let tCurrent = Infinity;
  let tChallenger = Infinity;
  for (const g of room.guesses) {
    if (g.rank !== rank) continue;
    if (g.playerId === currentWinnerId && g.createdAt < tCurrent) tCurrent = g.createdAt;
    if (g.playerId === challengerId && g.createdAt < tChallenger) tChallenger = g.createdAt;
  }
  return tChallenger < tCurrent ? challengerId : currentWinnerId;
}

/** Whoever currently has the closest (lowest) best rank; null if nobody has guessed anything ranked. */
function findBestRankWinner(room: Room): string | null {
  let bestRank = Infinity;
  let winnerId: string | null = null;
  for (const p of room.players.values()) {
    if (p.bestRank === null) continue;
    if (p.bestRank < bestRank) {
      bestRank = p.bestRank;
      winnerId = p.id;
    } else if (p.bestRank === bestRank && winnerId) {
      winnerId = earlierAchiever(room, winnerId, p.id, bestRank);
    }
  }
  return winnerId;
}

function resolveVote(room: Room) {
  if (!room.vote.active) return;
  clearVoteTimer(room);

  let yes = 0;
  let no = 0;
  for (const choice of room.vote.votes.values()) {
    if (choice === "yes") yes++;
    else no++;
  }
  const passed = yes > no;

  room.vote.active = false;
  room.vote.initiatorId = null;
  room.vote.deadline = null;
  room.vote.votes = new Map();

  if (passed) {
    // The vote to give up succeeded: end the round now. Whoever has the
    // closest (lowest) best rank so far wins, even though nobody actually
    // reached #1.
    room.status = "finished";
    room.winnerId = findBestRankWinner(room);
    room.endedByGiveUp = true;
    clearTurnTimer(room);
    room.turnDeadline = null;
    broadcasters?.onGameOver(room);
  } else {
    // Vote failed: the game continues. Put this room's give-up ability on a
    // 5-minute cooldown and resume with a fresh 15 seconds — for the current
    // player if they're still connected, or advance past them if not.
    room.giveUpAvailableAt = Date.now() + GIVEUP_COOLDOWN_MS;
    const currentId = room.playerOrder[room.currentTurnIndex];
    const currentPlayer = room.players.get(currentId);
    if (currentPlayer && currentPlayer.connected) {
      startTurnTimer(room);
    } else {
      advanceTurn(room);
    }
  }

  broadcasters?.onVoteConcluded(room, passed);
  broadcasters?.onRoomState(room);
}

export function requestGiveUp(room: Room, playerId: string) {
  if (room.status !== "playing") {
    return { ok: false as const, error: "There's no active round to give up on." };
  }
  const player = room.players.get(playerId);
  if (!player || !player.connected) {
    return { ok: false as const, error: "Player not found." };
  }
  if (room.vote.active) {
    return { ok: false as const, error: "A give-up vote is already in progress." };
  }
  const now = Date.now();
  if (now < room.giveUpAvailableAt) {
    const mins = Math.ceil((room.giveUpAvailableAt - now) / 60000);
    return {
      ok: false as const,
      error: `You can call another give-up vote in about ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }

  // Pause the turn while voting is in progress.
  clearTurnTimer(room);
  room.turnDeadline = null;

  room.vote.active = true;
  room.vote.initiatorId = playerId;
  room.vote.deadline = now + VOTE_SECONDS * 1000;
  room.vote.votes = new Map([[playerId, "yes"]]); // the person who calls the vote votes yes automatically
  room.vote.timer = setTimeout(() => resolveVote(room), VOTE_SECONDS * 1000);

  broadcasters?.onRoomState(room);
  return { ok: true as const };
}

export function castVote(room: Room, playerId: string, choice: "yes" | "no") {
  if (!room.vote.active) {
    return { ok: false as const, error: "There's no vote in progress." };
  }
  if (choice !== "yes" && choice !== "no") {
    return { ok: false as const, error: "Invalid vote." };
  }
  const player = room.players.get(playerId);
  if (!player || !player.connected) {
    return { ok: false as const, error: "Player not found." };
  }

  room.vote.votes.set(playerId, choice);
  broadcasters?.onRoomState(room);

  // Resolve early once every currently active player has voted.
  const active = activePlayers(room);
  const allVoted = active.every((p) => room.vote.votes.has(p.id));
  if (allVoted) {
    resolveVote(room);
  }
  return { ok: true as const };
}

export function markDisconnected(room: Room, playerId: string) {
  const player = room.players.get(playerId);
  if (!player) return;
  player.connected = false;
  player.disconnectedAt = Date.now();
  player.socketId = null;

  if (room.status === "playing" && !room.vote.active) {
    skipToNextTurnIfCurrent(room, playerId);
  }

  // Reassign host if needed
  if (room.hostId === playerId) {
    const nextHost = room.playerOrder.find((id) => room.players.get(id)?.connected);
    if (nextHost) {
      room.hostId = nextHost;
      const hp = room.players.get(nextHost)!;
      hp.isHost = true;
      player.isHost = false;
    }
  }

  scheduleRemoval(room, playerId);

  // If a vote is in progress and every remaining connected player has now
  // voted (or there simply aren't enough players left to keep waiting),
  // resolve it early instead of leaving it hanging until the vote timer.
  if (room.vote.active) {
    const active = activePlayers(room);
    if (active.length === 0 || active.every((p) => room.vote.votes.has(p.id))) {
      resolveVote(room);
      return;
    }
  }

  broadcasters?.onRoomState(room);
}

const removalTimers = new Map<string, NodeJS.Timeout>();

function scheduleRemoval(room: Room, playerId: string) {
  const key = `${room.code}:${playerId}`;
  const existing = removalTimers.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    const p = room.players.get(playerId);
    if (p && !p.connected) {
      removePlayer(room, playerId);
      broadcasters?.onRoomState(room);
    }
    removalTimers.delete(key);
  }, DISCONNECT_REMOVAL_MS);
  removalTimers.set(key, t);
}

export function removePlayer(room: Room, playerId: string) {
  const idx = room.playerOrder.indexOf(playerId);
  const wasCurrent =
    room.status === "playing" && room.playerOrder[room.currentTurnIndex] === playerId;

  room.players.delete(playerId);
  if (idx >= 0) {
    room.playerOrder.splice(idx, 1);
    if (idx < room.currentTurnIndex) {
      room.currentTurnIndex -= 1;
    } else if (idx === room.currentTurnIndex) {
      room.currentTurnIndex = room.currentTurnIndex % Math.max(room.playerOrder.length, 1);
    }
  }

  if (room.hostId === playerId && room.playerOrder.length > 0) {
    const nextHostId = room.playerOrder[0];
    room.hostId = nextHostId;
    const hp = room.players.get(nextHostId);
    if (hp) hp.isHost = true;
  }

  if (room.playerOrder.length === 0) {
    clearTurnTimer(room);
    clearVoteTimer(room);
    rooms.delete(room.code);
    return;
  }

  // Also clean up this player's vote and clean up when a pending vote is
  // paused entirely.
  if (room.vote.active) {
    room.vote.votes.delete(playerId);
    const active = activePlayers(room);
    if (active.length === 0 || active.every((p) => room.vote.votes.has(p.id))) {
      resolveVote(room);
      return;
    }
  }

  if (wasCurrent && room.status === "playing" && !room.vote.active) {
    const active = activeOrderIndices(room);
    if (active.length < MIN_PLAYERS) {
      room.status = "lobby";
      clearTurnTimer(room);
      room.turnDeadline = null;
    } else {
      room.currentTurnIndex = room.currentTurnIndex % room.playerOrder.length;
      if (!active.includes(room.currentTurnIndex)) {
        room.currentTurnIndex = active[0];
      }
      startTurnTimer(room);
    }
  }
}

export function reconnectPlayer(room: Room, playerId: string, socketId: string) {
  const player = room.players.get(playerId);
  if (!player) return { ok: false as const, error: "Player not found in this room." };
  player.connected = true;
  player.socketId = socketId;
  player.disconnectedAt = null;
  const key = `${room.code}:${playerId}`;
  const t = removalTimers.get(key);
  if (t) {
    clearTimeout(t);
    removalTimers.delete(key);
  }
  broadcasters?.onRoomState(room);
  return { ok: true as const };
}

export function leaveRoom(room: Room, playerId: string) {
  const wasHost = room.hostId === playerId;
  removePlayer(room, playerId);
  if (rooms.has(room.code)) {
    broadcasters?.onRoomState(room);
  }
  return { ok: true as const, wasHost };
}

export type { Room, Player };
