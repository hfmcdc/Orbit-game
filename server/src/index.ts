import express from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { Server, Socket } from "socket.io";
import { loadVocab } from "./semantics";
import {
  castVote,
  createRoom,
  findRoomByPlayerId,
  getRoom,
  joinRoom,
  leaveRoom,
  markDisconnected,
  playAgain,
  reconnectPlayer,
  registerBroadcasters,
  removePlayer,
  requestGiveUp,
  sanitizeNickname,
  startGame,
  submitGuess,
  toPublicState,
  type Room,
} from "./rooms";
import { cleanupSoloForSocket, leaveSolo, newSoloGame, startSolo, submitSoloGuess } from "./solo";

loadVocab();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// socketId -> playerId, for disconnect handling
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

registerBroadcasters({
  onRoomState: (room: Room) => {
    io.to(room.code).emit("room_state", toPublicState(room));
  },
  onTurnTick: (room: Room) => {
    const currentPlayerId = room.playerOrder[room.currentTurnIndex];
    if (room.turnDeadline) {
      io.to(room.code).emit("turn_tick", {
        currentPlayerId,
        turnDeadline: room.turnDeadline,
      });
    }
    io.to(room.code).emit("room_state", toPublicState(room));
  },
  onGameOver: (room: Room) => {
    io.to(room.code).emit("game_over", {
      winnerId: room.winnerId,
      secretWord: room.secretWord!,
      state: toPublicState(room),
    });
  },
  onNewGuess: (room: Room, guess) => {
    io.to(room.code).emit("new_guess", guess);
  },
  onVoteConcluded: (room: Room, passed: boolean) => {
    io.to(room.code).emit("vote_concluded", { passed });
  },
});

io.on("connection", (socket: Socket) => {
  socket.on("create_room", (payload, cb) => {
    try {
      const nickname = sanitizeNickname(payload?.nickname);
      const { room, playerId } = createRoom(nickname, socket.id);
      socket.join(room.code);
      socketToPlayer.set(socket.id, { roomCode: room.code, playerId });
      cb({ ok: true, roomCode: room.code, playerId });
      io.to(room.code).emit("room_state", toPublicState(room));
    } catch (e) {
      cb({ ok: false, error: "Failed to create room." });
    }
  });

  socket.on("join_room", (payload, cb) => {
    try {
      const code = (payload?.roomCode || "").toUpperCase().trim();
      const result = joinRoom(code, payload?.nickname, socket.id);
      if (!result.ok) {
        cb({ ok: false, error: result.error });
        return;
      }
      const { room, playerId } = result;
      socket.join(room.code);
      socketToPlayer.set(socket.id, { roomCode: room.code, playerId });
      cb({ ok: true, roomCode: room.code, playerId });
      io.to(room.code).emit("room_state", toPublicState(room));
    } catch (e) {
      cb({ ok: false, error: "Failed to join room." });
    }
  });

  socket.on("rejoin_room", (payload, cb) => {
    try {
      const code = (payload?.roomCode || "").toUpperCase().trim();
      const room = getRoom(code);
      if (!room) {
        cb({ ok: false, error: "Room not found." });
        return;
      }
      const result = reconnectPlayer(room, payload?.playerId, socket.id);
      if (!result.ok) {
        cb({ ok: false, error: result.error });
        return;
      }
      socket.join(room.code);
      socketToPlayer.set(socket.id, { roomCode: room.code, playerId: payload.playerId });
      cb({ ok: true });
      io.to(room.code).emit("room_state", toPublicState(room));
    } catch (e) {
      cb({ ok: false, error: "Failed to rejoin room." });
    }
  });

  socket.on("start_game", (_payload, cb) => {
    try {
      const info = socketToPlayer.get(socket.id);
      if (!info) return cb({ ok: false, error: "Not in a room." });
      const room = getRoom(info.roomCode);
      if (!room) return cb({ ok: false, error: "Room not found." });
      const result = startGame(room, info.playerId);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true });
      io.to(room.code).emit("game_started", toPublicState(room));
    } catch (e) {
      cb({ ok: false, error: "Failed to start game." });
    }
  });

  socket.on("submit_guess", (payload, cb) => {
    try {
      const info = socketToPlayer.get(socket.id);
      if (!info) return cb({ ok: false, error: "Not in a room." });
      const room = getRoom(info.roomCode);
      if (!room) return cb({ ok: false, error: "Room not found." });
      const result = submitGuess(room, info.playerId, payload?.word || "");
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true });
      io.to(room.code).emit("new_guess", result.guess);
    } catch (e) {
      cb({ ok: false, error: "Failed to submit guess." });
    }
  });

  socket.on("request_give_up", (_payload, cb) => {
    try {
      const info = socketToPlayer.get(socket.id);
      if (!info) return cb({ ok: false, error: "Not in a room." });
      const room = getRoom(info.roomCode);
      if (!room) return cb({ ok: false, error: "Room not found." });
      const result = requestGiveUp(room, info.playerId);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true });
    } catch (e) {
      cb({ ok: false, error: "Failed to start a give-up vote." });
    }
  });

  socket.on("cast_vote", (payload, cb) => {
    try {
      const info = socketToPlayer.get(socket.id);
      if (!info) return cb({ ok: false, error: "Not in a room." });
      const room = getRoom(info.roomCode);
      if (!room) return cb({ ok: false, error: "Room not found." });
      const result = castVote(room, info.playerId, payload?.choice);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true });
    } catch (e) {
      cb({ ok: false, error: "Failed to cast vote." });
    }
  });

  socket.on("play_again", (_payload, cb) => {
    try {
      const info = socketToPlayer.get(socket.id);
      if (!info) return cb({ ok: false, error: "Not in a room." });
      const room = getRoom(info.roomCode);
      if (!room) return cb({ ok: false, error: "Room not found." });
      const result = playAgain(room, info.playerId);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true });
      io.to(room.code).emit("game_started", toPublicState(room));
    } catch (e) {
      cb({ ok: false, error: "Failed to start new round." });
    }
  });

  socket.on("leave_room", (_payload, cb) => {
    try {
      const info = socketToPlayer.get(socket.id);
      if (!info) return cb({ ok: true });
      const room = getRoom(info.roomCode);
      if (room) {
        leaveRoom(room, info.playerId);
        socket.leave(room.code);
      }
      socketToPlayer.delete(socket.id);
      cb({ ok: true });
    } catch (e) {
      cb({ ok: false, error: "Failed to leave room." });
    }
  });

  socket.on("start_solo", (payload, cb) => {
    try {
      const result = startSolo(payload?.mode, socket.id);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true, state: result.state });
    } catch (e) {
      cb({ ok: false, error: "Failed to start solo game." });
    }
  });

  socket.on("solo_guess", (payload, cb) => {
    try {
      const result = submitSoloGuess(payload?.soloId, socket.id, payload?.word || "");
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true, state: result.state });
    } catch (e) {
      cb({ ok: false, error: "Failed to submit guess." });
    }
  });

  socket.on("solo_new_game", (payload, cb) => {
    try {
      const result = newSoloGame(payload?.soloId, socket.id);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true, state: result.state });
    } catch (e) {
      cb({ ok: false, error: "Failed to start a new solo game." });
    }
  });

  socket.on("leave_solo", (payload, cb) => {
    try {
      const result = leaveSolo(payload?.soloId, socket.id);
      if (!result.ok) return cb({ ok: false, error: result.error });
      cb({ ok: true });
    } catch (e) {
      cb({ ok: false, error: "Failed to leave solo game." });
    }
  });

  socket.on("disconnect", () => {
    const info = socketToPlayer.get(socket.id);
    if (info) {
      const room = getRoom(info.roomCode);
      if (room) {
        markDisconnected(room, info.playerId);
      }
      socketToPlayer.delete(socket.id);
    }
    cleanupSoloForSocket(socket.id);
  });
});

// ---- Serve built client (production) ----
const clientDist = path.join(__dirname, "..", "public");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io") || req.path === "/health") return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
server.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
