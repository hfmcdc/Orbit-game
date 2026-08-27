import { Modal } from "./Modal";
import { Button } from "./Button";
import { audioManager } from "../lib/audio/AudioManager";
import { useAudioSettings } from "../lib/audio/useGameAudio";

interface AudioSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AudioSettingsModal({ open, onClose }: AudioSettingsModalProps) {
  const settings = useAudioSettings();

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl">Sound</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-dim hover:text-text-primary text-lg px-1"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Music</p>
              <p className="text-text-dim text-xs">Ambient background music</p>
            </div>
            <ToggleSwitch
              checked={settings.musicEnabled}
              onChange={(v) => audioManager.setMusicEnabled(v)}
              label="Toggle music"
            />
          </div>
          <VolumeSlider
            label="Music volume"
            value={settings.musicVolume}
            disabled={!settings.musicEnabled}
            onChange={(v) => audioManager.setMusicVolume(v)}
          />

          <div className="h-px bg-border-subtle" />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Effects</p>
              <p className="text-text-dim text-xs">Hints, guesses, timers, wins</p>
            </div>
            <ToggleSwitch
              checked={settings.effectsEnabled}
              onChange={(v) => audioManager.setEffectsEnabled(v)}
              label="Toggle sound effects"
            />
          </div>
          <VolumeSlider
            label="Effects volume"
            value={settings.effectsVolume}
            disabled={!settings.effectsEnabled}
            onChange={(v) => audioManager.setEffectsVolume(v)}
          />
        </div>

        <Button variant="secondary" fullWidth onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-14 h-8 rounded-full shrink-0 transition-colors ${
        checked ? "bg-accent-core" : "bg-panel-2 border border-border-subtle"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-void transition-transform ${
          checked ? "translate-x-6 bg-void" : "translate-x-0 bg-text-dim"
        }`}
      />
    </button>
  );
}

function VolumeSlider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-text-dim">{label}</label>
        <span className="text-xs font-mono text-text-dim">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full h-6 accent-accent-core touch-none"
        aria-label={label}
      />
    </div>
  );
}
