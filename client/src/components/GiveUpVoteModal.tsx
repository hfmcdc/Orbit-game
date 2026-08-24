import { Modal } from "./Modal";
import { Button } from "./Button";
import { useCountdown } from "../lib/useCountdown";
import type { RoomStateForClient, VoteChoice } from "../shared/types";

interface GiveUpVoteModalProps {
  state: RoomStateForClient;
  myPlayerId: string | null;
  onVote: (choice: VoteChoice) => void;
}

export function GiveUpVoteModal({ state, myPlayerId, onVote }: GiveUpVoteModalProps) {
  const vote = state.vote;
  const remaining = useCountdown(vote.deadline, vote.voteSeconds);
  const initiator = state.players.find((p) => p.id === vote.initiatorId);
  const myVote = myPlayerId ? vote.votes[myPlayerId] : undefined;

  const yesCount = Object.values(vote.votes).filter((v) => v === "yes").length;
  const noCount = Object.values(vote.votes).filter((v) => v === "no").length;

  return (
    <Modal open={vote.active} dismissible={false}>
      <div className="flex flex-col items-center text-center gap-1">
        <span className="text-4xl">🏳️</span>
        <h2 className="font-display font-bold text-xl mt-2">Give up this round?</h2>
        <p className="text-text-dim text-sm">
          {initiator ? `${initiator.nickname} wants to end the round early.` : "A player wants to end the round early."}
        </p>
        <p className="text-text-dim text-sm mt-1">
          If most players vote yes, the round ends now — whoever has the closest guess wins.
        </p>

        <div className="font-mono text-3xl font-bold mt-4 text-accent-danger" aria-live="polite">
          {remaining}
        </div>

        <div className="flex gap-3 w-full mt-5">
          <Button
            variant={myVote === "no" ? "primary" : "secondary"}
            fullWidth
            onClick={() => onVote("no")}
          >
            No ({noCount})
          </Button>
          <Button
            variant={myVote === "yes" ? "primary" : "secondary"}
            fullWidth
            onClick={() => onVote("yes")}
          >
            Yes ({yesCount})
          </Button>
        </div>

        <div className="w-full mt-5 flex flex-col gap-1.5">
          {state.players.map((p) => {
            const choice = vote.votes[p.id];
            return (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm bg-panel-2 rounded-xl px-3 py-2"
              >
                <span className="truncate">{p.nickname}</span>
                <span
                  className={
                    choice === "yes"
                      ? "text-accent-core font-medium"
                      : choice === "no"
                        ? "text-accent-far font-medium"
                        : "text-text-dim"
                  }
                >
                  {choice === "yes" ? "Voted yes" : choice === "no" ? "Voted no" : "Waiting…"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
