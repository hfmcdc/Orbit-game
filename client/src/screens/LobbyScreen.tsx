import { useState } from "react";
import { Button } from "../components/Button";
import { HowToPlayModal } from "../components/HowToPlayModal";
import type { RoomStateForClient } from "../shared/types";

interface LobbyScreenProps {
  state: RoomStateForClient;
  myPlayerId: string | null;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyScreen({ state, myPlayerId, onStart, onLeave }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const isHost = myPlayerId === state.hostId;
  const count = state.players.length;
  const canStart = count >= 2;

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/?room=${state.roomCode}` : "";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Orbit game",
          text: `Join my Orbit game with code ${state.roomCode}`,
          url: shareUrl,
        });
      } catch {
        // user cancelled share — no-op
      }
    } else {
      copyCode();
    }
  };

  return (
    <div className="min-h-dvh flex flex-col px-6 py-8">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
        <div className="text-center mb-8">
          <p className="text-text-dim text-sm font-medium tracking-wide uppercase">Orbit</p>
          <p className="text-text-dim/50 text-[11px] mt-0.5">
            Made by <span className="text-text-dim/70">Mr.Mallu_gg</span>
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-panel-2 border border-border-subtle rounded-2xl px-5 py-3">
            <span className="font-mono text-2xl tracking-[0.2em]">{state.roomCode}</span>
          </div>
          <div className="flex gap-2 justify-center mt-3">
            <button
              onClick={copyCode}
              className="text-sm text-text-dim hover:text-text-primary px-3 py-2 rounded-xl bg-panel-2 border border-border-subtle transition-colors"
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
            <button
              onClick={share}
              className="text-sm text-text-dim hover:text-text-primary px-3 py-2 rounded-xl bg-panel-2 border border-border-subtle transition-colors"
            >
              Share link
            </button>
          </div>
          <button
            onClick={() => setHowToPlayOpen(true)}
            className="text-text-dim hover:text-text-primary text-sm mt-3 underline underline-offset-4"
          >
            How to play
          </button>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-lg">Players</h2>
            <span className="text-text-dim text-sm font-mono">{count}/4</span>
          </div>
          <ul className="flex flex-col gap-2">
            {state.players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 bg-panel-2 border border-border-subtle rounded-2xl px-4 py-3"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    p.connected ? "bg-accent-core" : "bg-text-dim"
                  }`}
                  aria-hidden
                />
                <span className="flex-1 font-medium">
                  {p.nickname}
                  {p.id === myPlayerId && <span className="text-text-dim"> (you)</span>}
                </span>
                {p.isHost && (
                  <span className="text-xs uppercase tracking-wide text-accent-win font-semibold">
                    Host
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {isHost ? (
            <>
              <Button fullWidth disabled={!canStart} onClick={onStart}>
                {canStart ? "Start game" : "Need at least 2 players"}
              </Button>
            </>
          ) : (
            <p className="text-center text-text-dim text-sm py-2">
              Waiting for the host to start the game…
            </p>
          )}
          <Button variant="danger" fullWidth onClick={onLeave}>
            Leave lobby
          </Button>
        </div>
      </div>
      <HowToPlayModal open={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
    </div>
  );
}
