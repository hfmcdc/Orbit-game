import { useState } from "react";
import { audioManager } from "../lib/audio/AudioManager";
import { useAudioBlocked, useAudioSettings } from "../lib/audio/useGameAudio";
import { AudioSettingsModal } from "./AudioSettingsModal";

/** A small, unobtrusive speaker icon that opens the audio settings modal. Place in a screen's header/corner. */
export function AudioButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const settings = useAudioSettings();
  const blocked = useAudioBlocked();

  const muted = !settings.musicEnabled && !settings.effectsEnabled;

  return (
    <>
      {blocked && (
        <button
          onClick={() => audioManager.retryUnlock()}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 text-xs bg-panel-2 border border-border-subtle rounded-full px-4 py-2 text-text-dim hover:text-text-primary shadow-lg"
        >
          🔈 Tap to enable sound
        </button>
      )}
      <button
        onClick={() => setOpen(true)}
        aria-label="Sound settings"
        title="Sound settings"
        className={`text-lg leading-none px-2 py-1.5 rounded-xl bg-panel-2 border border-border-subtle hover:border-accent-far/60 transition-colors ${className}`}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <AudioSettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
