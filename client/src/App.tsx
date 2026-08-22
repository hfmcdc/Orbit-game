import { useEffect, useState } from "react";
import { useGame } from "./lib/useGame";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { WinScreen } from "./screens/WinScreen";
import { Toast } from "./components/Toast";

function App() {
  const game = useGame();
  const [prefilledRoom, setPrefilledRoom] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setPrefilledRoom(room.toUpperCase());
  }, []);

  return (
    <>
      <Toast message={game.error} onDismiss={game.dismissError} />

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
