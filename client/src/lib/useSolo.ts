import { useCallback, useState } from "react";
import { socket } from "./socket";
import type { SoloMode, SoloStateForClient } from "../shared/types";

export function useSolo() {
  const [state, setState] = useState<SoloStateForClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback((mode: SoloMode) => {
    setBusy(true);
    setError(null);
    socket.emit("start_solo", { mode }, (res) => {
      setBusy(false);
      if (res.ok) {
        setState(res.state);
      } else {
        setError(res.error);
      }
    });
  }, []);

  const guess = useCallback(
    (word: string, onDone?: (ok: boolean) => void) => {
      if (!state) return;
      socket.emit("solo_guess", { soloId: state.soloId, word }, (res) => {
        if (res.ok) {
          setState(res.state);
          onDone?.(true);
        } else {
          setError(res.error);
          onDone?.(false);
        }
      });
    },
    [state]
  );

  const playAgain = useCallback(() => {
    if (!state) return;
    setBusy(true);
    socket.emit("solo_new_game", { soloId: state.soloId }, (res) => {
      setBusy(false);
      if (res.ok) {
        setState(res.state);
      } else {
        setError(res.error);
      }
    });
  }, [state]);

  const leave = useCallback(
    (onDone?: () => void) => {
      if (!state) {
        onDone?.();
        return;
      }
      socket.emit("leave_solo", { soloId: state.soloId }, () => {
        setState(null);
        onDone?.();
      });
    },
    [state]
  );

  return { state, error, busy, start, guess, playAgain, leave, clearError };
}
