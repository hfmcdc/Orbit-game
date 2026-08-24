import { Button } from "../components/Button";
import type { RoomStateForClient } from "../shared/types";

interface WinScreenProps {
  state: RoomStateForClient;
  myPlayerId: string | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function WinScreen({ state, myPlayerId, onPlayAgain, onLeave }: WinScreenProps) {
  const winner = state.winnerId ? state.players.find((p) => p.id === state.winnerId) : undefined;
  const iWon = state.winnerId !== null && state.winnerId === myPlayerId;
  const isHost = myPlayerId === state.hostId;
  const me = state.players.find((p) => p.id === myPlayerId);
  const noWinner = state.winnerId === null;

  const sorted = [...state.players].sort((a, b) => {
    if (a.bestRank === null) return 1;
    if (b.bestRank === null) return -1;
    return a.bestRank - b.bestRank;
  });

  const heading = noWinner
    ? "Round ended"
    : iWon
      ? "You win!"
      : `${winner?.nickname ?? "Someone"} wins!`;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="text-5xl mb-3">{state.endedByGiveUp ? "🏳️" : "🏆"}</div>
        <h1 className="font-display font-800 text-3xl tracking-tight">{heading}</h1>
        {state.endedByGiveUp && (
          <p className="text-text-dim text-sm mt-1">
            {noWinner
              ? "The give-up vote passed before anyone had a ranked guess."
              : "The give-up vote passed — closest guess wins."}
          </p>
        )}

        <div className="mt-6 bg-panel-2 border border-accent-win/30 rounded-2xl px-6 py-5 w-full">
          <p className="text-text-dim text-sm uppercase tracking-wide">The word was</p>
          <p className="font-mono font-bold text-2xl text-accent-win mt-1 uppercase">
            {state.secretWord}
          </p>
        </div>

        {iWon && me?.bestRank && (
          <div className="flex gap-6 mt-6">
            <div>
              <p className="text-text-dim text-xs uppercase tracking-wide">Best rank</p>
              <p className="font-mono text-2xl font-bold text-accent-core">#{me.bestRank}</p>
            </div>
            <div>
              <p className="text-text-dim text-xs uppercase tracking-wide">Guesses</p>
              <p className="font-mono text-2xl font-bold">{me?.guessCount}</p>
            </div>
          </div>
        )}

        <ul className="w-full mt-8 flex flex-col gap-2">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 bg-panel-2 border border-border-subtle rounded-2xl px-4 py-3"
            >
              <span className="text-text-dim font-mono text-sm w-5">{i + 1}</span>
              <span className="flex-1 text-left font-medium">
                {p.id === state.winnerId && (state.endedByGiveUp ? "🏳️ " : "🏆 ")}
                {p.nickname}
                {p.id === myPlayerId && <span className="text-text-dim"> (you)</span>}
              </span>
              <span className="font-mono text-text-dim text-sm">
                {p.bestRank ? `#${p.bestRank}` : "—"}
              </span>
            </li>
          ))}
        </ul>

        <div className="w-full flex flex-col gap-3 mt-8">
          {isHost ? (
            <Button fullWidth onClick={onPlayAgain}>
              Play again
            </Button>
          ) : (
            <p className="text-text-dim text-sm">Waiting for the host to start a new round…</p>
          )}
          <Button variant="secondary" fullWidth onClick={onLeave}>
            Leave game
          </Button>
        </div>
      </div>
    </div>
  );
}
