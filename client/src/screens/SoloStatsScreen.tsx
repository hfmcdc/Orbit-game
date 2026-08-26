import { Button } from "../components/Button";
import { averageGuesses, type SoloStats } from "../lib/soloStats";

interface SoloStatsScreenProps {
  stats: SoloStats;
  currentStreak: number;
  longestStreak: number;
  onBack: () => void;
}

export function SoloStatsScreen({ stats, currentStreak, longestStreak, onBack }: SoloStatsScreenProps) {
  const avg = averageGuesses(stats);

  const rows: { label: string; value: string }[] = [
    { label: "Games played", value: String(stats.gamesPlayed) },
    { label: "Words found", value: String(stats.wordsFound) },
    { label: "Best guesses", value: stats.bestGuesses !== null ? String(stats.bestGuesses) : "—" },
    { label: "Average guesses", value: avg !== null ? String(avg) : "—" },
    { label: "Best rank", value: stats.bestRankEver !== null ? `#${stats.bestRankEver}` : "—" },
    { label: "Current streak", value: String(currentStreak) },
    { label: "Longest streak", value: String(longestStreak) },
  ];

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <p className="text-text-dim text-sm font-medium tracking-wide uppercase">Orbit</p>
          <h1 className="font-display text-3xl font-800 tracking-tight mt-1">Solo Stats</h1>
        </div>

        <ul className="flex flex-col gap-2 mb-8">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between bg-panel-2 border border-border-subtle rounded-2xl px-5 py-3"
            >
              <span className="text-text-dim text-sm">{row.label}</span>
              <span className="font-mono font-semibold">{row.value}</span>
            </li>
          ))}
        </ul>

        <Button variant="secondary" fullWidth onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
