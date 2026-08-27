import { useState } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { HowToPlayModal } from "../components/HowToPlayModal";
import { InstallPrompt } from "../components/InstallPrompt";
import { AudioButton } from "../components/AudioButton";
import { useMenuAmbience } from "../lib/audio/useGameAudio";

interface HomeScreenProps {
  busy: boolean;
  onCreate: (nickname: string) => void;
  onJoin: (roomCode: string, nickname: string) => void;
  onSolo: () => void;
  initialRoomCode?: string | null;
}

export function HomeScreen({ busy, onCreate, onJoin, onSolo, initialRoomCode }: HomeScreenProps) {
  useMenuAmbience();
  const [mode, setMode] = useState<"start" | "create" | "join">(
    initialRoomCode ? "join" : "start"
  );
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 relative">
      <div className="absolute top-4 right-4">
        <AudioButton />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10 text-center">
          <OrbitMark />
          <h1 className="font-display text-4xl font-800 tracking-tight mt-4">
            Orbit
          </h1>
          <p className="text-text-dim mt-2">
            One secret word. Everyone circles in.
          </p>
        </div>

        {mode === "start" && (
          <div className="flex flex-col gap-3">
            <InstallPrompt />
            <Button fullWidth onClick={() => setMode("create")}>
              Create a room
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setMode("join")}>
              Join a room
            </Button>
            <Button fullWidth variant="secondary" onClick={onSolo}>
              Solo
            </Button>
            <button
              type="button"
              onClick={() => setHowToPlayOpen(true)}
              className="text-text-dim hover:text-text-primary text-sm mt-1 py-1 underline underline-offset-4"
            >
              How to play
            </button>

            <div className="mt-3 bg-panel-2/60 border border-border-subtle rounded-2xl px-4 py-3 text-center">
              <p className="text-accent-danger/90 text-xs font-semibold uppercase tracking-wide">
                This game is currently a demo
              </p>
              <p className="text-text-dim text-xs mt-1.5 leading-relaxed">
                There may be bugs, glitches, or unexpected crashes while playing. Please
                cooperate with us while we continue testing and improving Orbit.
              </p>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <p className="text-text-dim text-xs">Have feedback or found a bug?</p>
              <a
                href="https://ap.surveymars.com/q/yCX2beWhD"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-accent-far underline underline-offset-4"
              >
                Send Feedback
              </a>
            </div>
          </div>
        )}

        {mode === "create" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (nickname.trim()) onCreate(nickname.trim());
            }}
          >
            <TextField
              id="nickname"
              label="Your nickname"
              placeholder="Alex"
              value={nickname}
              maxLength={16}
              autoFocus
              onChange={(e) => setNickname(e.target.value)}
            />
            <Button type="submit" fullWidth disabled={busy || !nickname.trim()}>
              {busy ? "Creating…" : "Create room"}
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={() => setMode("start")}>
              Back
            </Button>
          </form>
        )}

        {mode === "join" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (nickname.trim() && roomCode.trim()) {
                onJoin(roomCode.trim().toUpperCase(), nickname.trim());
              }
            }}
          >
            <TextField
              id="roomCode"
              label="Room code"
              placeholder="X7K2PQ"
              value={roomCode}
              maxLength={6}
              autoFocus
              autoCapitalize="characters"
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="tracking-[0.3em] font-mono text-center uppercase"
            />
            <TextField
              id="nickname2"
              label="Your nickname"
              placeholder="Rahul"
              value={nickname}
              maxLength={16}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              disabled={busy || !nickname.trim() || roomCode.trim().length < 4}
            >
              {busy ? "Joining…" : "Join room"}
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={() => setMode("start")}>
              Back
            </Button>
          </form>
        )}
      </div>
      <HowToPlayModal open={howToPlayOpen} onClose={() => setHowToPlayOpen(false)} />
    </div>
  );
}

function OrbitMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <circle cx="28" cy="28" r="24" fill="none" stroke="#2A3350" strokeWidth="1.5" />
      <circle cx="28" cy="28" r="16" fill="none" stroke="#5B7CFA" strokeWidth="1.5" opacity="0.6" />
      <circle cx="28" cy="28" r="6" fill="#FFB454" />
      <circle cx="48" cy="28" r="3" fill="#FFD166" />
    </svg>
  );
}
