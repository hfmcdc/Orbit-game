# Orbit — a multiplayer word-guessing game

One secret word per lobby. 2–4 players take turns guessing; every guess gets ranked
by how close it is in meaning to the secret word (#1 = the word itself). First
player to hit #1 wins. Inspired by the gameplay idea behind Contexto, built from
scratch with an original name, UI, and codebase.

## Project structure

```
orbit/
├── client/     React + TypeScript + Tailwind (Vite) — the UI
├── server/     Node + TypeScript + Express + Socket.IO — the game server
│               (also serves the built client in production)
├── shared/     TypeScript types shared between client and server (reference copy;
│               client/ and server/ each keep their own copy so they build/deploy
│               independently — see "Keeping shared types in sync" below)
└── render.yaml Render deployment blueprint
```

## How the game works

- **Lobby**: create a room (get a 6-character code) or join one with a code.
  2–4 players. Only the host can start.
- **Turns**: deterministic order (P1 → P2 → P3 → P4 → P1 …). Each player gets
  **15 seconds** per turn, timed by the server, and gets exactly **one guess**
  per turn — the turn ends immediately after that guess (or when the 15
  seconds run out with no guess submitted). Turns themselves are unlimited:
  play just keeps cycling through everyone until someone wins.
- **Hints**: a hint word is revealed automatically at the start of every
  round, and then again every 12 turns as long as nobody has found the
  secret word yet. Each new hint is guaranteed to be ranked closer to the
  secret word than the best guess anyone has found so far, so hints get more
  useful the longer a round drags on.
- **Ranking**: every guess is scored by semantic closeness to the secret word,
  from #1 (exact word) up to the size of the vocabulary. Lower is closer.
- **Win**: first player to guess rank #1 wins immediately. The secret word is
  revealed only at that point — it is never sent to any client beforehand.
- **Give up**: any player can tap the 🏳️ button (top right, during a round)
  to call a vote to end it early. This pauses the turn timer and opens a
  20-second vote. If more players vote yes than no, the round ends
  immediately and whoever has the closest guess so far wins (the word is
  revealed either way). If the vote fails, the round resumes with a fresh
  turn timer, and nobody can call another give-up vote in that room for 5
  minutes.
- **Play again**: the host can start a new round with a new secret word,
  same lobby, same players.

## Local development

Requires Node.js 20+.

### 1. Install and run the server

```bash
cd server
npm install
npm run dev        # starts on http://localhost:3001 with hot reload
```

### 2. Install and run the client (separate terminal)

```bash
cd client
npm install
npm run dev         # starts on http://localhost:5173
```

The client dev server proxies `/socket.io` to `http://localhost:3001`
(see `client/vite.config.ts`), so just open `http://localhost:5173` and it
will talk to your local server automatically. No `.env` needed for local dev.

### Environment variables

| Variable       | Where  | Default | Purpose                                              |
|----------------|--------|---------|-------------------------------------------------------|
| `PORT`         | server | `3001`  | Port the server listens on (Render sets this itself) |
| `TURN_SECONDS` | server | `15`    | Turn length in seconds (mainly for testing)           |
| `VITE_SERVER_URL` | client (build-time) | same origin | Only needed if you deploy the client separately from the server; point it at the server's URL |

No API keys are required — the semantic ranking runs entirely on precomputed
local data, no external ML calls.

## Production build (what Render runs)

From `server/`:

```bash
npm install
npm run build   # 1) compiles the server with tsc
                 # 2) builds the client with vite
                 # 3) copies the client build into server/public
npm start        # node dist/index.js — serves the API, WebSocket, and the
                  # built client all from one process/port
```

## Deploying to Render

This repo includes `render.yaml` at the root, so you can use Render's
"Blueprint" deploy: point Render at this repo and it will pick up the config
automatically. It defines a single Web Service:

- **Root directory**: `server`
- **Build command**: `npm install && npm run build`
- **Start command**: `npm start`
- **Health check**: `/health`
- Listens on `process.env.PORT` (required by Render — already wired up in
  `server/src/index.ts`)

If you'd rather set it up by hand in the Render dashboard: create a new Web
Service, set the root directory to `server`, and use the same build/start
commands above. No database or Redis is required — game state lives in
server memory, which is fine for a single persistent Render instance. (The
room/game logic in `server/src/rooms.ts` is isolated behind a small function
API, so swapping in Redis later — e.g. for multi-instance scaling — would
mean changing that one file's internals, not the Socket.IO handlers.)

## Semantic ranking implementation

To avoid any per-guess ML inference cost, ranking is fully precomputed:

1. **Offline (already done, shipped in `server/data/`)**: ~8,000 common
   English words were pulled from a standard pretrained word-embedding model,
   filtered to real, frequent, inoffensive nouns, and saved as:
   - `words.json` — the vocabulary list
   - `vectors.bin` — a flat `Float32Array` of pre-normalized 300-dim vectors,
     one per word, in the same order as `words.json`
   - `secret_candidates.json` — a curated subset of ~1,500 concrete nouns
     used as possible secret words (so the game never picks something like
     "the" or "very" as the answer)
2. **At round start**: the server picks a random secret word and computes
   cosine similarity (a dot product, since vectors are pre-normalized)
   between it and all 8,000 vocabulary words — once. It sorts the results
   into a rank list and caches it in memory for that room's round.
3. **Per guess**: normalizing the player's text and looking up its rank is an
   **O(1) map lookup** against the cached rank list. No vector math happens
   on the guess path at all.
4. This guarantees the same secret word always produces the same ranking for
   every player in the room, and keeps guess-handling cheap enough to support
   many concurrent small rooms on a single server instance.

Words outside the ~8,000-word vocabulary are treated as "unranked" and
rejected with a friendly error rather than crashing or guessing wildly.

**Hints** reuse the same precomputed rank list: a hint just looks up "the
word at rank N" in the cached ordering for that round. The opening hint
targets a generous starting rank (roughly the top ~5% closest words). Every
12 turns after that, a new hint targets half the distance of the best rank
any player has found so far, so it's always guaranteed closer than what's
already on the board — capped so it never reveals rank #1 itself.

## Multiplayer architecture

- **Transport**: Socket.IO (WebSocket with polling fallback), one Socket.IO
  room per game room, keyed by the 6-character room code.
- **Server authority**: the server is the single source of truth for turn
  order, whose turn it is, the timer deadline, guess validity, ranks, and the
  winner. The client never computes or asserts any of these — it only
  displays what the server broadcasts and sends guess/action requests.
- **Timer**: the server stores an authoritative `turnDeadline` (epoch ms) per
  room and runs its own `setTimeout` to advance the turn when it expires. The
  client's on-screen countdown is purely a display computed from
  `Date.now()` vs. that deadline (see `client/src/lib/useCountdown.ts`) — it
  never decides that time is up on its own.
- **State sync**: `room_state` is broadcast to everyone in the Socket.IO room
  after every meaningful change (join/leave, turn change, guess, game
  start/end). Individual guesses are also broadcast separately as
  `new_guess` events so the guess feed can update immediately without
  waiting for a full state refresh.
- **Reconnection**: the client stores `{ roomCode, playerId }` in
  `localStorage` and calls `rejoin_room` on reconnect. The server keeps a
  disconnected player's slot (and pauses their turn if it was theirs) for 60
  seconds before removing them for good, so a dropped phone connection or a
  quick app-switch doesn't kick anyone out of the game.

## Testing

The core game logic (rooms, turns, timer, guessing rules, ranking, win
condition) was exercised directly with real Socket.IO client connections
during development, covering:

- Room creation/joining, 4-player cap, 5th-player rejection
- Non-host start rejection, host-only start with < 2 players rejected
- Turn enforcement (guessing out of turn is rejected)
- One guess per turn: a second guess attempt in the same turn is rejected,
  and a valid guess immediately advances the turn to the next player
- Duplicate guess rejection, unknown-word rejection, empty-guess rejection
- Automatic turn advancement when the 15-second timer expires
- Hints: an opening hint appears the instant a round starts, a new hint
  appears exactly at turn 12, and each new hint's rank is verified to be
  closer than the best guess found by any player at that point
- Full win flow: correct guess ends the game immediately, no further guesses
  are accepted, and the secret word is confirmed to stay `null` in every
  broadcast state until the round finishes
- Give-up voting: the turn timer pauses while a vote is open, the initiator
  auto-votes yes, a majority-yes vote ends the round with the closest-guess
  player declared winner (or no winner if nobody has a ranked guess yet), a
  majority-no vote resumes play and puts the room's give-up button on a
  5-minute cooldown, and a repeat vote attempt during that cooldown is
  rejected

To re-verify locally, start the server (`npm run dev` in `server/`) and open
several browser tabs/devices to `http://localhost:5173` (or your deployed
URL), each with a different nickname, and play through a full round. Suggested
manual checks:

- **Lobby**: create on one device, join from 1–3 others using the room code;
  confirm a 5th join attempt is rejected.
- **Turns**: confirm play proceeds P1 → P2 → P3 → P4 → P1 in the order
  players joined, and that letting the timer hit 0 skips to the next player.
- **Guessing**: try guessing when it isn't your turn (should be blocked
  client-side and rejected server-side if forced), submit a duplicate word,
  submit gibberish, and confirm a single valid guess ends your turn
  immediately (no second guess allowed until it's your turn again).
- **Hints**: confirm a hint appears in the feed the moment the round starts,
  and that another one appears right after the 12th completed turn.
- **Give up**: tap 🏳️ on one device mid-round; confirm all devices see the
  vote modal with a live countdown and vote tallies. Vote it down and confirm
  the round resumes and the button is disabled/cooldown-limited for 5
  minutes; in a fresh round, vote it through and confirm the round ends with
  the closest guesser declared winner and the word revealed.
- **Winning**: keep guessing until someone reaches #1; confirm the win screen
  shows correctly on all devices, including for non-winners.
- **Mobile**: check at roughly 360×800, 390×844, and 412×915 — the layout is
  built mobile-first with a sticky guess input and should not require
  horizontal scrolling at any of these sizes.
- **Disconnects**: close a tab mid-game and confirm the remaining players are
  notified and the turn moves on if it was that player's turn.

## Keeping shared types in sync

`client/src/shared/types.ts` and `server/src/shared/types.ts` are copies of
`shared/types.ts` at the repo root. They're duplicated (rather than imported
across a monorepo boundary) so that `client/` and `server/` can each be built
and deployed as fully independent projects — which matters for platforms like
Render that build each service from its own root directory. If you change the
shared event/data shapes, update all three copies.
