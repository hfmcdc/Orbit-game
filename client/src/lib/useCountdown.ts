import { useEffect, useState } from "react";

/**
 * Ticks down a display countdown purely from a server-provided deadline
 * (epoch ms). The server is the source of truth for when a turn actually
 * ends; this hook only computes what number to show, recalculating from
 * Date.now() vs. the deadline every tick so client clock drift can't cause
 * the game to disagree with the server about when time is up.
 */
export function useCountdown(deadline: number | null, turnSeconds: number): number {
  const [remaining, setRemaining] = useState<number>(turnSeconds);

  useEffect(() => {
    if (!deadline) {
      setRemaining(turnSeconds);
      return;
    }
    const tick = () => {
      const ms = deadline - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline, turnSeconds]);

  return remaining;
}
