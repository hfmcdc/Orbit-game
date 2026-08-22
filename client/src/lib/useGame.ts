import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { clearSession, loadSession, saveSession } from "./session";
import type { GuessResult, RoomStateForClient } from "../shared/types";

export type Screen = "home" | "lobby" | "game" | "win";

export function useGame() {
  const [screen, setScreen] = useState<Screen>("home");
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RoomStateForClient | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flashGuess, setFlashGuess] = useState<GuessResult | null>(null);
  const errorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptedRejoin = useRef(false);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimeout.current) clearTimeout(errorTimeout.current);
    errorTimeout.current = setTimeout(() => setError(null), 4000);
  }, []);

  useEffect(() => {
    socket.connect();

    function onConnect() {
      setConnected(true);
      // attempt to rejoin a previous session once per page load
      const session = loadSession();
      if (session && !attemptedRejoin.current) {
        attemptedRejoin.current = true;
        socket.emit(
          "rejoin_room",
          { roomCode: session.roomCode, playerId: session.playerId },
          (res) => {
            if (res.ok) {
              setMyPlayerId(session.playerId);
            } else {
              clearSession();
            }
          }
        );
      }
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onRoomState(s: RoomStateForClient) {
      setState(s);
      setScreen((prev) => {
        if (s.status === "finished") return "win";
        if (s.status === "playing") return "game";
        if (prev === "home") return prev; // don't force navigation until player has joined
        return "lobby";
      });
    }
    function onGameStarted(s: RoomStateForClient) {
      setState(s);
      setScreen("game");
    }
    function onGameOver(payload: { winnerId: string; secretWord: string; state: RoomStateForClient }) {
      setState(payload.state);
      setScreen("win");
    }
    function onNewGuess(g: GuessResult) {
      setFlashGuess(g);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setFlashGuess(null), 1200);
    }
    function onErrorMessage(payload: { message: string }) {
      showError(payload.message);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room_state", onRoomState);
    socket.on("game_started", onGameStarted);
    socket.on("game_over", onGameOver);
    socket.on("new_guess", onNewGuess);
    socket.on("error_message", onErrorMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room_state", onRoomState);
      socket.off("game_started", onGameStarted);
      socket.off("game_over", onGameOver);
      socket.off("new_guess", onNewGuess);
      socket.off("error_message", onErrorMessage);
    };
  }, [showError]);

  const createRoom = useCallback(
    (nickname: string) => {
      setBusy(true);
      socket.emit("create_room", { nickname }, (res) => {
        setBusy(false);
        if (res.ok) {
          setMyPlayerId(res.playerId);
          saveSession({ roomCode: res.roomCode, playerId: res.playerId, nickname });
          setScreen("lobby");
        } else {
          showError(res.error);
        }
      });
    },
    [showError]
  );

  const joinRoom = useCallback(
    (roomCode: string, nickname: string) => {
      setBusy(true);
      socket.emit("join_room", { roomCode, nickname }, (res) => {
        setBusy(false);
        if (res.ok) {
          setMyPlayerId(res.playerId);
          saveSession({ roomCode: res.roomCode, playerId: res.playerId, nickname });
          setScreen("lobby");
        } else {
          showError(res.error);
        }
      });
    },
    [showError]
  );

  const startGame = useCallback(() => {
    socket.emit("start_game", {}, (res) => {
      if (!res.ok) showError(res.error);
    });
  }, [showError]);

  const submitGuess = useCallback(
    (word: string, onDone?: (ok: boolean) => void) => {
      socket.emit("submit_guess", { word }, (res) => {
        if (!res.ok) {
          showError(res.error);
          onDone?.(false);
        } else {
          onDone?.(true);
        }
      });
    },
    [showError]
  );

  const playAgain = useCallback(() => {
    socket.emit("play_again", {}, (res) => {
      if (!res.ok) showError(res.error);
    });
  }, [showError]);

  const leaveRoom = useCallback(() => {
    socket.emit("leave_room", {}, () => {
      clearSession();
      setState(null);
      setMyPlayerId(null);
      setScreen("home");
    });
  }, []);

  return {
    screen,
    setScreen,
    connected,
    state,
    myPlayerId,
    error,
    busy,
    flashGuess,
    createRoom,
    joinRoom,
    startGame,
    submitGuess,
    playAgain,
    leaveRoom,
    dismissError: () => setError(null),
  };
}
