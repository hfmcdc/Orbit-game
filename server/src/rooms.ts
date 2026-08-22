import { randomUUID } from "crypto";
import {
  buildRankingForSecret,
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
  guesses: GuessResult[];
  winnerId: string | null;
  round: number;
  createdAt: number;
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
    guesses: [],
    winnerId: null,
    round: 0,
    createdAt: Date.now(),
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
  };
}

// ---- Game flow ----

type Broadcasters = {
  onRoomState: (room: Room) => void;
  onTurnTick: (room: Room) => void;
  onGameOver: (room: Room) => void;
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
  room.rankMap = buildRankingForSecret(room.secretWord);
  room.status = "playing";
  room.round += 1;

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

  // Guess doesn't end the turn; player may keep guessing until timer expires.
  broadcasters?.onRoomState(room); // updates best ranks for all
  return { ok: true as const, guess, wonGame: false };
}

export function skipToNextTurnIfCurrent(room: Room, playerId: string) {
  const currentPlayerId = room.playerOrder[room.currentTurnIndex];
  if (playerId === currentPlayerId && room.status === "playing") {
    advanceTurn(room);
  }
}

export function markDisconnected(room: Room, playerId: string) {
  const player = room.players.get(playerId);
  if (!player) return;
  player.connected = false;
  player.disconnectedAt = Date.now();
  player.socketId = null;

  if (room.status === "playing") {
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
    rooms.delete(room.code);
    return;
  }

  if (wasCurrent && room.status === "playing") {
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
