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

export type VoteChoice = "yes" | "no";

export interface VoteState {
  active: boolean;
  initiatorId: string | null;
  deadline: number | null; // epoch ms, authoritative from server
  voteSeconds: number;
  votes: Record<string, VoteChoice>; // playerId -> choice, only includes players who voted
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
  vote: VoteState;
  giveUpAvailableAt: number; // epoch ms; 0 or <= now means available right now
  endedByGiveUp: boolean; // true if the round ended via a successful give-up vote
}

export type SoloMode = "practice" | "daily";
export type SoloStatus = "playing" | "finished";

export interface SoloGuessResult {
  id: string;
  word: string;
  rank: number; // 1..vocabSize, or -1 if unranked
  createdAt: number;
  isHint?: boolean;
}

export interface SoloStateForClient {
  soloId: string;
  mode: SoloMode;
  status: SoloStatus;
  dateKey: string | null; // set for daily mode, the calendar date this challenge belongs to
  bestRank: number | null;
  guessCount: number;
  guesses: SoloGuessResult[]; // most recent first
  secretWord: string | null; // only populated when status === 'finished'
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
  request_give_up: (payload: {}, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  cast_vote: (
    payload: { choice: VoteChoice },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  start_solo: (
    payload: { mode: SoloMode },
    cb: (res: { ok: true; state: SoloStateForClient } | { ok: false; error: string }) => void
  ) => void;
  solo_guess: (
    payload: { soloId: string; word: string },
    cb: (res: { ok: true; state: SoloStateForClient } | { ok: false; error: string }) => void
  ) => void;
  solo_new_game: (
    payload: { soloId: string },
    cb: (res: { ok: true; state: SoloStateForClient } | { ok: false; error: string }) => void
  ) => void;
  leave_solo: (payload: { soloId: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
}

// ---- Server -> Client events ----
export interface ServerToClientEvents {
  room_state: (state: RoomStateForClient) => void;
  new_guess: (guess: GuessResult) => void;
  turn_tick: (payload: { currentPlayerId: string; turnDeadline: number }) => void;
  game_started: (state: RoomStateForClient) => void;
  game_over: (payload: { winnerId: string | null; secretWord: string; state: RoomStateForClient }) => void;
  vote_concluded: (payload: { passed: boolean }) => void;
  player_joined: (payload: { player: PlayerPublic }) => void;
  player_left: (payload: { playerId: string }) => void;
  error_message: (payload: { message: string }) => void;
}
