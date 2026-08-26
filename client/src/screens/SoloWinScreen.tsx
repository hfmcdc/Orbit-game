import { Button } from "../components/Button";
import type { SoloStateForClient } from "../shared/types";

interface SoloWinScreenProps {
  state: SoloStateForClient;
  currentStreak: number;
  onPlayAgain: () => void;
  onBackToHome: () => void;
}

export function SoloWinScreen({ state, currentStreak, onPlayAgain, onBackToHome }: SoloWinScreenProps) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="font-display font-800 text-3xl tracking-tight">Word found!</h1>
        <p className="text-text-dim text-sm mt-1">You found the secret word.</p>

        <div className="mt-6 bg-panel-2 border border-accent-win/30 rounded-2xl px-6 py-5 w-full">
          <p className="text-text-dim text-sm uppercase tracking-wide">The word was</p>
          <p className="font-mono font-bold text-2xl text-accent-win mt-1 uppercase">
            {state.secretWord}
          </p>
        </div>

        <div className="flex gap-6 mt-6">
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wide">Guesses</p>
            <p className="font-mono text-2xl font-bold">{state.guessCount}</p>
          </div>
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wide">Best rank</p>
            <p className="font-mono text-2xl font-bold text-accent-core">#{state.bestRank}</p>
          </div>
          {state.mode === "daily" && (
            <div>
              <p className="text-text-dim text-xs uppercase tracking-wide">Streak</p>
              <p className="font-mono text-2xl font-bold">{currentStreak}</p>
            </div>
          )}
        </div>

        <div className="w-full flex flex-col gap-3 mt-8">
          {state.mode === "practice" ? (
            <Button fullWidth onClick={onPlayAgain}>
              Play again
            </Button>
          ) : (
            <p className="text-text-dim text-sm">
              Come back tomorrow for a new Daily Challenge.
            </p>
          )}
          <Button variant="secondary" fullWidth onClick={onBackToHome}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
