import { Button } from "../components/Button";
import type { DailyCompletion } from "../lib/dailyChallenge";

interface SoloHubScreenProps {
  busy: boolean;
  dailyCompletion: DailyCompletion | null;
  currentStreak: number;
  onDaily: () => void;
  onPractice: () => void;
  onStats: () => void;
  onBack: () => void;
}

export function SoloHubScreen({
  busy,
  dailyCompletion,
  currentStreak,
  onDaily,
  onPractice,
  onStats,
  onBack,
}: SoloHubScreenProps) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <p className="text-text-dim text-sm font-medium tracking-wide uppercase">Orbit</p>
          <h1 className="font-display text-3xl font-800 tracking-tight mt-1">Solo</h1>
          <p className="text-text-dim mt-2 text-sm">Play alone. Same word, same rules.</p>
        </div>

        {dailyCompletion ? (
          <div className="bg-panel-2 border border-accent-win/30 rounded-2xl px-5 py-4 mb-4 text-center">
            <p className="text-accent-win text-xs font-semibold uppercase tracking-wide">
              Daily Challenge
            </p>
            <p className="text-text-primary text-sm mt-1">Today's challenge is complete.</p>
            <div className="flex justify-center gap-6 mt-3">
              <div>
                <p className="text-text-dim text-[11px] uppercase">Guesses</p>
                <p className="font-mono font-bold">{dailyCompletion.guessCount}</p>
              </div>
              <div>
                <p className="text-text-dim text-[11px] uppercase">Best rank</p>
                <p className="font-mono font-bold text-accent-core">#{dailyCompletion.bestRank}</p>
              </div>
              <div>
                <p className="text-text-dim text-[11px] uppercase">Streak</p>
                <p className="font-mono font-bold">{currentStreak}</p>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={onDaily}
            disabled={busy}
            className="w-full text-left bg-panel-2 border border-border-subtle hover:border-accent-core/60 rounded-2xl px-5 py-4 mb-4 transition-colors disabled:opacity-50"
          >
            <p className="font-display font-semibold">Daily Challenge</p>
            <p className="text-text-dim text-sm mt-0.5">One puzzle for today. Same word for everyone.</p>
            {currentStreak > 0 && (
              <p className="text-accent-core text-xs font-medium mt-2">🔥 {currentStreak} day streak</p>
            )}
          </button>
        )}

        <button
          onClick={onPractice}
          disabled={busy}
          className="w-full text-left bg-panel-2 border border-border-subtle hover:border-accent-far/60 rounded-2xl px-5 py-4 mb-4 transition-colors disabled:opacity-50"
        >
          <p className="font-display font-semibold">Practice</p>
          <p className="text-text-dim text-sm mt-0.5">Unlimited random rounds, play whenever.</p>
        </button>

        <Button variant="secondary" fullWidth onClick={onStats}>
          Solo Stats
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack} className="mt-2">
          Back
        </Button>
      </div>
    </div>
  );
}
