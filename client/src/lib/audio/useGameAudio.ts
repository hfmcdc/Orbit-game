import { useEffect, useRef, useState } from "react";
import { audioManager, bandForRank, type AudioSettings } from "./AudioManager";

/** Subscribes to live audio settings (for the settings modal, the mute icon, etc). */
export function useAudioSettings(): AudioSettings {
  const [settings, setSettings] = useState(audioManager.getSettings());
  useEffect(() => audioManager.onSettingsChange(setSettings), []);
  return settings;
}

/** Subscribes to whether autoplay is currently blocked by the browser. */
export function useAudioBlocked(): boolean {
  const [blocked, setBlocked] = useState(audioManager.isBlocked());
  useEffect(() => audioManager.onBlockedChange(setBlocked), []);
  return blocked;
}

/** Plays a quiet constant ambience for menu-style screens (Home, Lobby, Solo hub). */
export function useMenuAmbience() {
  useEffect(() => {
    audioManager.playMusic("calm");
  }, []);
}

/** Ambient music that shifts intensity with how close the player's best guess is to #1. */
export function useReactiveAmbience(bestRank: number | null) {
  useEffect(() => {
    audioManager.playMusic(bandForRank(bestRank));
  }, [bestRank]);
}

/** Plays a short positive sound the moment the player's best rank improves. Louder/richer for bigger jumps. */
export function useRankFeedback(bestRank: number | null) {
  const prevRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (bestRank !== null && bestRank !== 1 && (prev === null || bestRank < prev)) {
      // Reaching #1 exactly is handled by the victory sting instead, so this
      // hook stays quiet for that specific transition to avoid two feedback
      // sounds firing back-to-back at the winning moment.
      const bigJump = prev !== null && prev - bestRank >= 100;
      const topTier = bestRank <= 20;
      audioManager.playSfx(bigJump || topTier ? "rank-major" : "rank-minor");
    }
    prevRef.current = bestRank;
  }, [bestRank]);
}

/** Plays a soft discovery sound whenever a new hint appears at the front of the guess feed. */
export function useHintFeedback(latestGuessId: string | undefined, latestIsHint: boolean | undefined) {
  const seenRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (latestGuessId && latestGuessId !== seenRef.current) {
      seenRef.current = latestGuessId;
      if (latestIsHint) audioManager.playSfx("hint");
    }
  }, [latestGuessId, latestIsHint]);
}

/**
 * Countdown cues for the local player's own turn: a subtle tension riser at
 * 5s, three rising-pitch beeps at 3/2/1s, and a timeout sound at 0. Purely
 * reactive to the already-computed `remaining` display value (itself driven
 * by the server's authoritative deadline) — no new server events involved.
 */
export function useTimerFeedback(remaining: number, isMyTurn: boolean) {
  const lastFiredRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isMyTurn) {
      lastFiredRef.current = null;
      return;
    }
    if (remaining === lastFiredRef.current) return;
    lastFiredRef.current = remaining;
    if (remaining === 5) audioManager.playSfx("tension");
    else if (remaining === 3) audioManager.playSfx("timer-beep", { playbackRate: 1.0 });
    else if (remaining === 2) audioManager.playSfx("timer-beep", { playbackRate: 1.12 });
    else if (remaining === 1) audioManager.playSfx("timer-beep", { playbackRate: 1.26 });
    else if (remaining === 0) audioManager.playSfx("timeout");
  }, [remaining, isMyTurn]);
}

/** Fires exactly once when a round is won: a victory sting, then a settled victory ambience. */
export function useVictorySequence(won: boolean) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (won && !firedRef.current) {
      firedRef.current = true;
      audioManager.playSfx("victory");
      audioManager.playMusic("victory-ambience");
    }
    if (!won) {
      firedRef.current = false;
    }
  }, [won]);
}
