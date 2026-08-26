import { useEffect, useRef, useState } from "react";
import { useSolo } from "../lib/useSolo";
import { SoloHubScreen } from "../screens/SoloHubScreen";
import { SoloGameScreen } from "../screens/SoloGameScreen";
import { SoloWinScreen } from "../screens/SoloWinScreen";
import { SoloStatsScreen } from "../screens/SoloStatsScreen";
import { Toast } from "../components/Toast";
import {
  getTodayCompletion,
  getTodayDateKeyUTC,
  getEffectiveCurrentStreak,
  loadDailyState,
  recordDailyCompletion,
} from "../lib/dailyChallenge";
import { loadSoloStats, recordBestRankSeen, recordSoloWin } from "../lib/soloStats";

type SoloView = "hub" | "game" | "win" | "stats";

interface SoloFlowProps {
  onExit: () => void;
}

export function SoloFlow({ onExit }: SoloFlowProps) {
  const solo = useSolo();
  const [view, setView] = useState<SoloView>("hub");
  const recordedRef = useRef(false);

  const todayKey = getTodayDateKeyUTC();
  const [dailyCompletion, setDailyCompletion] = useState(() => getTodayCompletion(todayKey));
  const [currentStreak, setCurrentStreak] = useState(() => getEffectiveCurrentStreak(todayKey));
  const dailyState = loadDailyState();
  const soloStats = loadSoloStats();

  // Whenever the solo state updates with a new bestRank, keep the
  // "best rank ever" stat honest even for rounds that are never finished.
  useEffect(() => {
    if (solo.state?.bestRank) {
      recordBestRankSeen(solo.state.bestRank);
    }
  }, [solo.state?.bestRank]);

  // Detect a round finishing and record stats exactly once per round.
  useEffect(() => {
    if (solo.state?.status === "finished" && !recordedRef.current) {
      recordedRef.current = true;
      recordSoloWin(solo.state.guessCount);
      if (solo.state.mode === "daily") {
        recordDailyCompletion(todayKey, solo.state.guessCount);
        setDailyCompletion(getTodayCompletion(todayKey));
        setCurrentStreak(getEffectiveCurrentStreak(todayKey));
      }
      setView("win");
    }
  }, [solo.state?.status, solo.state?.guessCount, solo.state?.mode, todayKey]);

  const startDaily = () => {
    recordedRef.current = false;
    solo.start("daily");
    setView("game");
  };

  const startPractice = () => {
    recordedRef.current = false;
    solo.start("practice");
    setView("game");
  };

  const playAgain = () => {
    recordedRef.current = false;
    solo.playAgain();
    setView("game");
  };

  const backToHub = () => {
    solo.leave(() => setView("hub"));
  };

  return (
    <>
      <Toast message={solo.error} onDismiss={solo.clearError} variant="error" />

      {view === "hub" && (
        <SoloHubScreen
          busy={solo.busy}
          dailyCompletion={dailyCompletion}
          currentStreak={currentStreak}
          onDaily={startDaily}
          onPractice={startPractice}
          onStats={() => setView("stats")}
          onBack={onExit}
        />
      )}

      {view === "game" && solo.state && (
        <SoloGameScreen state={solo.state} onGuess={solo.guess} onBack={backToHub} />
      )}

      {view === "win" && solo.state && (
        <SoloWinScreen
          state={solo.state}
          currentStreak={currentStreak}
          onPlayAgain={playAgain}
          onBackToHome={backToHub}
        />
      )}

      {view === "stats" && (
        <SoloStatsScreen
          stats={soloStats}
          currentStreak={currentStreak}
          longestStreak={dailyState.longestStreak}
          onBack={() => setView("hub")}
        />
      )}
    </>
  );
}
