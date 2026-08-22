import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { ProximityRing } from "../components/ProximityRing";
import { useCountdown } from "../lib/useCountdown";
import type { GuessResult, RoomStateForClient } from "../shared/types";

interface GameScreenProps {
  state: RoomStateForClient;
  myPlayerId: string | null;
  flashGuess: GuessResult | null;
  onSubmitGuess: (word: string, onDone?: (ok: boolean) => void) => void;
  onLeave: () => void;
}

export function GameScreen({ state, myPlayerId, flashGuess, onSubmitGuess, onLeave }: GameScreenProps) {
  const [guessValue, setGuessValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMyTurn = state.currentPlayerId === myPlayerId;
  const remaining = useCountdown(state.turnDeadline, state.turnSeconds);
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const me = state.players.find((p) => p.id === myPlayerId);

  useEffect(() => {
    if (isMyTurn) inputRef.current?.focus();
  }, [isMyTurn]);

  const submit = () => {
    const word = guessValue.trim();
    if (!word || submitting) return;
    setSubmitting(true);
    onSubmitGuess(word, () => {
      setSubmitting(false);
      setGuessValue("");
      inputRef.current?.focus();
    });
  };

  const urgent = remaining <= 5;

  return (
    <div className="min-h-dvh flex flex-col px-4 py-5">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wide font-medium">Orbit</p>
            <p className="font-mono text-sm text-text-dim">{state.roomCode}</p>
          </div>
          <button onClick={onLeave} className="text-text-dim text-sm hover:text-accent-danger">
            Leave
          </button>
        </div>

        {/* Player ranks */}
        <ul className="flex flex-col gap-1.5">
          {state.players.map((p) => {
            const isTurn = p.id === state.currentPlayerId;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                  isTurn
                    ? "bg-accent-core/10 border-accent-core/50"
                    : "bg-panel-2 border-border-subtle"
                } ${!p.connected ? "opacity-50" : ""}`}
              >
                <span className="flex-1 font-medium text-sm truncate">
                  {isTurn && "🔥 "}
                  {p.nickname}
                  {p.id === myPlayerId && <span className="text-text-dim"> (you)</span>}
                </span>
                <span className="font-mono text-sm text-text-dim">
                  {p.bestRank ? `#${p.bestRank}` : "—"}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Turn / timer + ring */}
        <div className="flex flex-col items-center py-2">
          {isMyTurn ? (
            <p className="font-display font-bold text-lg tracking-wide">YOUR TURN</p>
          ) : (
            <p className="text-text-dim font-medium">
              {currentPlayer?.nickname ?? "…"}'s turn
            </p>
          )}
          <div
            className={`font-mono font-bold leading-none mt-1 transition-colors ${
              urgent ? "text-accent-danger" : "text-text-primary"
            }`}
            style={{ fontSize: "3.5rem" }}
            aria-live="polite"
          >
            {remaining}
          </div>

          <div className="mt-2">
            <ProximityRing bestRank={me?.bestRank ?? null} />
          </div>
          <p className="text-text-dim text-sm mt-1">
            {me?.bestRank ? (
              <>
                Best rank: <span className="font-mono text-accent-core">#{me.bestRank}</span>
              </>
            ) : (
              "No guesses yet"
            )}
          </p>
        </div>

        {/* Guess input */}
        <div className="sticky bottom-0 bg-void pt-2 pb-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2"
          >
            <input
              ref={inputRef}
              value={guessValue}
              onChange={(e) => setGuessValue(e.target.value)}
              disabled={!isMyTurn || submitting}
              placeholder={isMyTurn ? "Type a word…" : "Waiting for your turn…"}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl bg-panel-2 border border-border-subtle px-5 py-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-accent-far focus:border-accent-far disabled:opacity-50"
            />
            <Button type="submit" fullWidth disabled={!isMyTurn || !guessValue.trim() || submitting}>
              Guess
            </Button>
          </form>
        </div>

        {/* Flash: most recent guess */}
        {flashGuess && (
          <div className="text-center text-sm text-text-dim -mt-1">
            <span className="font-medium text-text-primary">{flashGuess.nickname}</span> guessed{" "}
            <span className="font-mono uppercase">{flashGuess.word}</span>{" "}
            {flashGuess.rank > 0 ? (
              <span className="font-mono text-accent-core">#{flashGuess.rank}</span>
            ) : (
              <span className="text-text-dim">unranked</span>
            )}
          </div>
        )}

        {/* Guess history */}
        <div className="flex-1 min-h-0">
          <h3 className="text-text-dim text-xs uppercase tracking-wide font-medium mb-2">
            Recent guesses
          </h3>
          <ul className="flex flex-col gap-1 pb-4">
            {state.guesses.slice(0, 20).map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-2 text-sm bg-panel-2/60 rounded-lg px-3 py-2"
              >
                <span className="text-text-dim w-16 truncate">{g.nickname}</span>
                <span className="flex-1 font-mono uppercase truncate">{g.word}</span>
                <span className="font-mono text-text-primary">
                  {g.rank > 0 ? `#${g.rank}` : "—"}
                </span>
              </li>
            ))}
            {state.guesses.length === 0 && (
              <li className="text-text-dim text-sm text-center py-4">
                No guesses yet. Be the first to circle in.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
