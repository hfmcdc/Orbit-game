// Shared types between client and server

export interface PlayerPublic {
  id: string;
  nickname: string;
  connected: boolean;
  isHost: boolean;
  bestRank: number | null; // lower is better, null = no guesses yet
  guessCount: number;
}

export type GameStatus = "lobby" | "playing" | "finished";

export interface GuessResult {
  id: string;
  playerId: string; // "system" for hints, otherwise a real player's id
  nickname: string;
  word: string;
  rank: number; // 1..vocabSize, or -1 if unranked/unknown word
  createdAt: number;
  isHint?: boolean; // true if this entry is a system-generated hint, not a player guess
}

export interface RoomStateForClient {
  roomCode: string;
  status: GameStatus;
  players: PlayerPublic[];
  hostId: string;
  currentPlayerId: string | null;
  turnDeadline: number | null; // epoch ms, authoritative from server
  turnSeconds: number;
  guesses: GuessResult[]; // most recent first, capped
  winnerId: string | null;
  secretWord: string | null; // only populated when status === 'finished'
  round: number;
}

// ---- Client -> Server events ----
export interface ClientToServerEvents {
  create_room: (
    payload: { nickname: string },
    cb: (res: { ok: true; roomCode: string; playerId: string } | { ok: false; error: string }) => void
  ) => void;
  join_room: (
    payload: { roomCode: string; nickname: string },
    cb: (res: { ok: true; roomCode: string; playerId: string } | { ok: false; error: string }) => void
  ) => void;
  rejoin_room: (
    payload: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  start_game: (payload: {}, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  submit_guess: (
    payload: { word: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  play_again: (payload: {}, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  leave_room: (payload: {}, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
}

// ---- Server -> Client events ----
export interface ServerToClientEvents {
  room_state: (state: RoomStateForClient) => void;
  new_guess: (guess: GuessResult) => void;
  turn_tick: (payload: { currentPlayerId: string; turnDeadline: number }) => void;
  game_started: (state: RoomStateForClient) => void;
  game_over: (payload: { winnerId: string; secretWord: string; state: RoomStateForClient }) => void;
  player_joined: (payload: { player: PlayerPublic }) => void;
  player_left: (payload: { playerId: string }) => void;
  error_message: (payload: { message: string }) => void;
}
