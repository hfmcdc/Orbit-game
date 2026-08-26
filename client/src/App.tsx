import { useEffect, useState } from "react";
import { useGame } from "./lib/useGame";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { WinScreen } from "./screens/WinScreen";
import { Toast } from "./components/Toast";
import { SoloFlow } from "./solo/SoloFlow";

function App() {
  const game = useGame();
  const [prefilledRoom, setPrefilledRoom] = useState<string | null>(null);
  const [view, setView] = useState<"app" | "solo">("app");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setPrefilledRoom(room.toUpperCase());
  }, []);

  if (view === "solo") {
    return <SoloFlow onExit={() => setView("app")} />;
  }

  return (
    <>
      <Toast message={game.error} onDismiss={game.dismissError} variant="error" />
      <Toast message={game.notice} onDismiss={game.dismissNotice} variant="info" />

      {!game.connected && !game.state && (
        <div className="min-h-dvh flex items-center justify-center text-text-dim text-sm">
          Connecting…
        </div>
      )}

      {game.connected && game.screen === "home" && (
        <HomeScreen
          busy={game.busy}
          onCreate={game.createRoom}
          onJoin={game.joinRoom}
          onSolo={() => setView("solo")}
          initialRoomCode={prefilledRoom}
        />
      )}

      {game.screen === "lobby" && game.state && (
        <LobbyScreen
          state={game.state}
          myPlayerId={game.myPlayerId}
          onStart={game.startGame}
          onLeave={game.leaveRoom}
        />
      )}

      {game.screen === "game" && game.state && (
        <GameScreen
          state={game.state}
          myPlayerId={game.myPlayerId}
          flashGuess={game.flashGuess}
          onSubmitGuess={game.submitGuess}
          onLeave={game.leaveRoom}
          onRequestGiveUp={game.requestGiveUp}
          onVote={game.castVote}
        />
      )}

      {game.screen === "win" && game.state && (
        <WinScreen
          state={game.state}
          myPlayerId={game.myPlayerId}
          onPlayAgain={game.playAgain}
          onLeave={game.leaveRoom}
        />
      )}
    </>
  );
}

export default App;
