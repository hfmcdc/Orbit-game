import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { ProximityRing } from "../components/ProximityRing";
import type { SoloStateForClient } from "../shared/types";

interface SoloGameScreenProps {
  state: SoloStateForClient;
  onGuess: (word: string, onDone?: (ok: boolean) => void) => void;
  onBack: () => void;
}

export function SoloGameScreen({ state, onGuess, onBack }: SoloGameScreenProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const word = value.trim();
    if (!word || submitting) return;
    setSubmitting(true);
    onGuess(word, () => {
      setSubmitting(false);
      setValue("");
      inputRef.current?.focus();
    });
  };

  return (
    <div className="min-h-dvh flex flex-col px-4 py-5">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wide font-medium">
              {state.mode === "daily" ? "Daily Challenge" : "Solo Mode"}
            </p>
            <p className="text-text-primary text-sm font-medium">Find the secret word.</p>
          </div>
          <button onClick={onBack} className="text-text-dim text-sm hover:text-accent-danger">
            Leave
          </button>
        </div>

        <div className="flex flex-col items-center py-2">
          <div className="mt-1">
            <ProximityRing bestRank={state.bestRank} />
          </div>
          <p className="text-text-dim text-sm mt-2">
            {state.bestRank ? (
              <>
                Best rank: <span className="font-mono text-accent-core">#{state.bestRank}</span>
              </>
            ) : (
              "No guesses yet"
            )}
          </p>
          <p className="text-text-dim text-xs mt-1">
            {state.guessCount} {state.guessCount === 1 ? "guess" : "guesses"} so far
          </p>
        </div>

        <div className="pt-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2"
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={submitting}
              placeholder="Type your guess…"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl bg-panel-2 border border-border-subtle px-5 py-4 text-lg text-center focus:outline-none focus:ring-2 focus:ring-accent-far focus:border-accent-far disabled:opacity-50"
            />
            <Button type="submit" fullWidth disabled={!value.trim() || submitting}>
              Guess
            </Button>
          </form>
        </div>

        <div className="flex-1 min-h-0">
          <h3 className="text-text-dim text-xs uppercase tracking-wide font-medium mb-2">
            Recent guesses
          </h3>
          <ul className="flex flex-col gap-1 pb-4">
            {state.guesses.slice(0, 30).map((g) => (
              <li
                key={g.id}
                className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                  g.isHint ? "bg-accent-win/10 border border-accent-win/30" : "bg-panel-2/60"
                }`}
              >
                <span className={`w-16 truncate ${g.isHint ? "text-accent-win font-medium" : "text-text-dim"}`}>
                  {g.isHint ? "💡 Hint" : "You"}
                </span>
                <span className="flex-1 font-mono uppercase truncate">{g.word}</span>
                <span className={`font-mono ${g.isHint ? "text-accent-win" : "text-text-primary"}`}>
                  {g.rank > 0 ? `#${g.rank}` : "—"}
                </span>
              </li>
            ))}
            {state.guesses.length === 0 && (
              <li className="text-text-dim text-sm text-center py-4">
                No guesses yet. Take your first shot.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
