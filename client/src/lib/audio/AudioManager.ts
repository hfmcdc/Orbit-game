/**
 * Central audio system for Orbit.
 *
 * Deliberately built on plain HTMLAudioElement rather than the full Web
 * Audio API — this game only ever needs a handful of concurrent sounds
 * (one music track + occasional one-shot SFX), so a small manual crossfade
 * over two <audio> elements is simpler and just as reliable as a Web Audio
 * graph, without needing to manage an AudioContext's own unlock lifecycle
 * on top of the browser's autoplay rules.
 *
 * Nothing here is React-specific — it's a standalone singleton so any
 * screen can call into it without prop-drilling, and settings changes made
 * from one screen (e.g. a settings modal) are immediately reflected
 * everywhere else via a small pub/sub layer.
 */

export type MusicTrack = "calm" | "focused" | "tense" | "intense" | "victory-ambience" | null;

export type SfxName =
  | "ui-tap"
  | "rank-minor"
  | "rank-major"
  | "hint"
  | "timer-beep"
  | "timeout"
  | "invalid"
  | "tension"
  | "victory";

const MUSIC_SRC: Record<Exclude<MusicTrack, null>, string> = {
  calm: "/audio/music-calm.mp3",
  focused: "/audio/music-focused.mp3",
  tense: "/audio/music-tense.mp3",
  intense: "/audio/music-intense.mp3",
  "victory-ambience": "/audio/music-calm.mp3", // reuse the calm bed as a settled "post-win" ambience
};

const SFX_SRC: Record<SfxName, string> = {
  "ui-tap": "/audio/sfx-ui-tap.mp3",
  "rank-minor": "/audio/sfx-rank-minor.mp3",
  "rank-major": "/audio/sfx-rank-major.mp3",
  hint: "/audio/sfx-hint.mp3",
  "timer-beep": "/audio/sfx-timer-beep.mp3",
  timeout: "/audio/sfx-timeout.mp3",
  invalid: "/audio/sfx-invalid.mp3",
  tension: "/audio/sfx-tension.mp3",
  victory: "/audio/sfx-victory.mp3",
};

export interface AudioSettings {
  musicEnabled: boolean;
  effectsEnabled: boolean;
  musicVolume: number; // 0..1
  effectsVolume: number; // 0..1
}

const DEFAULT_SETTINGS: AudioSettings = {
  musicEnabled: true,
  effectsEnabled: true,
  musicVolume: 0.3,
  effectsVolume: 0.55,
};

const SETTINGS_KEY = "orbit_audio_settings_v1";
const CROSSFADE_MS = 1500;
const FADE_STEP_MS = 50;

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: AudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors (private browsing, quota, etc.)
  }
}

class AudioManagerImpl {
  private settings: AudioSettings = loadSettings();
  private listeners = new Set<(s: AudioSettings) => void>();

  private unlocked = false;
  private blocked = false;
  private blockedListeners = new Set<(blocked: boolean) => void>();

  // The track we conceptually "want" playing (updated freely, even before
  // unlock) vs. the track actually loaded into an <audio> element right now.
  // Kept separate so calling playMusic() before the first user gesture never
  // triggers an actual play() attempt — it just remembers what to start once
  // unlock() succeeds.
  private desiredTrack: MusicTrack = null;
  private playingTrack: MusicTrack = null;

  // Two music elements so we can crossfade between the current and next track.
  private musicA: HTMLAudioElement | null = null;
  private musicB: HTMLAudioElement | null = null;
  private activeIsA = true;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
  private pausedForVisibility = false;

  private sfxCache = new Map<SfxName, HTMLAudioElement>();

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => this.handleVisibilityChange());
    }
  }

  // ---- Settings ----

  getSettings(): AudioSettings {
    return this.settings;
  }

  onSettingsChange(cb: (s: AudioSettings) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emitSettings() {
    for (const cb of this.listeners) cb(this.settings);
  }

  private updateSettings(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.applyVolumesToActiveElements();
    this.emitSettings();
  }

  setMusicEnabled(enabled: boolean) {
    this.updateSettings({ musicEnabled: enabled });
    if (!enabled) {
      this.stopMusic();
    } else if (this.desiredTrack) {
      this.applyMusic(this.desiredTrack);
    }
  }

  setEffectsEnabled(enabled: boolean) {
    this.updateSettings({ effectsEnabled: enabled });
  }

  setMusicVolume(volume: number) {
    this.updateSettings({ musicVolume: Math.max(0, Math.min(1, volume)) });
  }

  setEffectsVolume(volume: number) {
    this.updateSettings({ effectsVolume: Math.max(0, Math.min(1, volume)) });
  }

  private applyVolumesToActiveElements() {
    const vol = this.settings.musicEnabled ? this.settings.musicVolume : 0;
    if (this.musicA && !this.musicA.paused) this.musicA.volume = this.activeIsA ? vol : this.musicA.volume;
    if (this.musicB && !this.musicB.paused) this.musicB.volume = !this.activeIsA ? vol : this.musicB.volume;
  }

  // ---- Mobile autoplay unlock ----

  /**
   * Call this from a real user-initiated event handler (button tap, etc).
   * Cheap and idempotent — safe to call from every primary action in the
   * app. If a track is already desired (e.g. a menu screen queued up its
   * ambience before the user had interacted with anything), this plays it
   * directly — one real play() call both unlocks audio for the session and
   * starts the actual music. Otherwise it primes permission with a tiny
   * real audio file (a source-less element's play() promise can hang
   * forever in some browsers rather than resolving or rejecting, so we
   * always give it real, if silent-in-effect, content to load).
   */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    if (this.desiredTrack) {
      this.applyMusic(this.desiredTrack);
      return;
    }

    const probe = this.getOrCreateMusicElement(true);
    probe.src = SFX_SRC["ui-tap"];
    probe.volume = 0;
    const playPromise = probe.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          probe.pause();
          probe.currentTime = 0;
          probe.removeAttribute("src");
          this.setBlocked(false);
        })
        .catch(() => {
          // Autoplay blocked — not an error, just means we show a manual "enable sound" control.
          this.setBlocked(true);
        });
    }
  }

  isBlocked(): boolean {
    return this.blocked;
  }

  onBlockedChange(cb: (blocked: boolean) => void): () => void {
    this.blockedListeners.add(cb);
    return () => this.blockedListeners.delete(cb);
  }

  private setBlocked(blocked: boolean) {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    for (const cb of this.blockedListeners) cb(blocked);
  }

  /** Manual retry, e.g. from a small "tap to enable sound" control. */
  retryUnlock() {
    this.unlocked = false;
    this.unlock();
  }

  // ---- Music ----

  private getOrCreateMusicElement(forA: boolean): HTMLAudioElement {
    if (forA) {
      if (!this.musicA) {
        this.musicA = new Audio();
        this.musicA.loop = true;
        this.musicA.preload = "auto";
      }
      return this.musicA;
    }
    if (!this.musicB) {
      this.musicB = new Audio();
      this.musicB.loop = true;
      this.musicB.preload = "auto";
    }
    return this.musicB;
  }

  /**
   * Set which track should be playing. Safe to call at any time, including
   * before the first user gesture — if audio isn't unlocked yet, this just
   * remembers the desired track; `unlock()` will start it once permitted.
   * Calling with the track already playing is a harmless no-op, and
   * switching tracks crossfades rather than cutting abruptly.
   */
  playMusic(track: MusicTrack) {
    if (track === this.desiredTrack) return; // avoid restarting the same track redundantly
    this.desiredTrack = track;
    if (!this.unlocked) return; // nothing to actually play yet — no user gesture has happened
    this.applyMusic(track);
  }

  private applyMusic(track: MusicTrack) {
    if (track === this.playingTrack) return;
    this.playingTrack = track;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (!track || !this.settings.musicEnabled) {
      this.stopMusic();
      return;
    }

    const incoming = this.getOrCreateMusicElement(!this.activeIsA);
    const outgoing = this.activeIsA ? this.musicA : this.musicB;

    const src = new URL(MUSIC_SRC[track], window.location.origin).toString();
    if (incoming.src !== src) {
      incoming.src = src;
    }
    incoming.currentTime = 0;
    incoming.volume = 0;

    const playPromise = incoming.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => this.setBlocked(true));
    }

    const targetVol = this.settings.musicVolume;
    const steps = Math.max(1, Math.round(CROSSFADE_MS / FADE_STEP_MS));
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      incoming.volume = targetVol * t;
      if (outgoing && !outgoing.paused) {
        outgoing.volume = targetVol * (1 - t);
      }
      if (t >= 1) {
        if (this.fadeTimer) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (outgoing && outgoing !== incoming) {
          outgoing.pause();
          outgoing.currentTime = 0;
        }
      }
    }, FADE_STEP_MS);

    this.activeIsA = !this.activeIsA;
  }

  stopMusic(fadeMs = CROSSFADE_MS) {
    this.desiredTrack = null;
    this.playingTrack = null;
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    const active = this.activeIsA ? this.musicB : this.musicA; // last one we swapped to was "incoming"
    const other = this.activeIsA ? this.musicA : this.musicB;
    for (const el of [active, other]) {
      if (!el || el.paused) continue;
      const startVol = el.volume;
      const steps = Math.max(1, Math.round(fadeMs / FADE_STEP_MS));
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const t = Math.min(1, step / steps);
        el.volume = startVol * (1 - t);
        if (t >= 1) {
          clearInterval(timer);
          el.pause();
          el.currentTime = 0;
        }
      }, FADE_STEP_MS);
    }
  }

  private handleVisibilityChange() {
    const active = this.activeIsA ? this.musicB : this.musicA;
    if (document.hidden) {
      if (active && !active.paused) {
        active.pause();
        this.pausedForVisibility = true;
      }
    } else if (this.pausedForVisibility) {
      this.pausedForVisibility = false;
      if (active && this.settings.musicEnabled && this.playingTrack) {
        active.play().catch(() => this.setBlocked(true));
      }
    }
  }

  // ---- SFX ----

  private getOrCreateSfx(name: SfxName): HTMLAudioElement {
    let el = this.sfxCache.get(name);
    if (!el) {
      el = new Audio(SFX_SRC[name]);
      el.preload = "none"; // lazy-load: only fetched the first time this specific sound is actually needed
      this.sfxCache.set(name, el);
    }
    return el;
  }

  /**
   * Play a one-shot effect. `playbackRate` lets a single asset serve
   * multiple pitches (used for the 3/2/1 timer countdown) without shipping
   * three near-identical files.
   */
  playSfx(name: SfxName, opts: { playbackRate?: number } = {}) {
    if (!this.settings.effectsEnabled) return;
    const template = this.getOrCreateSfx(name);
    // Clone so rapid repeats (e.g. quick successive guesses) don't cut each other off.
    const el = template.cloneNode(true) as HTMLAudioElement;
    el.volume = this.settings.effectsVolume;
    el.playbackRate = opts.playbackRate ?? 1;
    el.play().catch(() => {
      // Effects are non-essential; if blocked, fail silently.
    });
  }
}

export const audioManager = new AudioManagerImpl();

/** Convenience used by every primary button: unlocks audio on first use and plays a soft tap. */
export function handleAudioTap() {
  audioManager.unlock();
  audioManager.playSfx("ui-tap");
}

/** Maps a best-rank value to the ambient intensity band it should play. */
export function bandForRank(bestRank: number | null): MusicTrack {
  if (bestRank === null) return "calm";
  if (bestRank === 1) return "victory-ambience";
  if (bestRank <= 20) return "intense";
  if (bestRank <= 100) return "tense";
  if (bestRank <= 500) return "focused";
  return "calm";
}
