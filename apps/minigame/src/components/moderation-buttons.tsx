import { useState } from "react";

import type { ModerationRequest } from "@/types/anti-cheat";
import type { ModerationButtonsProps } from "@/types/ui";
import { ApiError, moderate } from "@/utils/api-client";

async function moderationError(request: ModerationRequest) {
  try {
    await moderate(request);
    return null;
  } catch (error) {
    if (request.action === "ban") {
      return "Couldn't ban that player.";
    }
    return error instanceof ApiError && error.status === 409
      ? "A newer run came in. Watch it, then approve."
      : "Couldn't approve that run.";
  }
}

/** A moderator's approve (for a flagged best) and remove-and-ban buttons on a leaderboard row. */
export function ModerationButtons({
  player,
  flagged,
  watched,
  onDone,
}: ModerationButtonsProps) {
  const [arming, setArming] = useState(false);

  const run = (request: ModerationRequest) => {
    moderationError(request)
      .then(onDone)
      .catch(() => undefined);
  };

  /** Approves the run the moderator watched, not whatever is flagged now. */
  const approve = () => {
    if (watched?.playerId !== player.id) {
      onDone("Watch the run first, then approve.");
      return;
    }
    run({ playerId: player.id, action: "approve", seed: watched.seed });
  };

  return (
    <>
      {flagged && (
        <button
          aria-label={`Approve @${player.handle}'s run`}
          className="text-gold font-display text-2xs shrink-0 px-1"
          onClick={approve}
          title="Waiting for review: watch it, then approve"
          type="button"
        >
          ⚑ ✓
        </button>
      )}
      <button
        aria-label={`Remove and ban @${player.handle}`}
        className="text-danger font-display text-2xs shrink-0 px-1"
        onClick={() => {
          // first press arms it, the second removes and bans
          if (!arming) {
            setArming(true);
            return;
          }
          setArming(false);
          run({ playerId: player.id, action: "ban" });
        }}
        onBlur={() => setArming(false)}
        title="Remove and ban"
        type="button"
      >
        {arming ? "Ban?" : "✕"}
      </button>
    </>
  );
}
