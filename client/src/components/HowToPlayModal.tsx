import { Modal } from "./Modal";
import { Button } from "./Button";

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

const RULES: string[] = [
  "One secret word per round. Everyone in the lobby is trying to find the same word.",
  "Every guess gets ranked by how close it is in meaning to the secret word — #1 means you found it exactly.",
  "Players take turns in order. Each turn is 15 seconds and you get exactly one guess.",
  "Turns keep cycling through everyone, unlimited, until someone reaches #1.",
  "Hints appear automatically: one at the very start of the round, then another every 12 turns if nobody's found the word yet. Each new hint is guaranteed closer than the best guess so far.",
  "Anyone can call a Give Up vote (🏳️) during the round. If most players vote yes, the round ends immediately and whoever had the closest guess wins.",
  "If the give-up vote fails, the round continues — and nobody can call another vote for 5 minutes.",
  "First to guess the secret word (or win a give-up vote) wins the round. Play again anytime with the same group.",
];

export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xl">How to play</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-dim hover:text-text-primary text-lg px-1"
          >
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {RULES.map((rule, i) => (
            <li key={i} className="flex gap-3 text-sm text-text-primary leading-relaxed">
              <span className="text-accent-core font-mono shrink-0">{i + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        <Button variant="secondary" fullWidth onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
