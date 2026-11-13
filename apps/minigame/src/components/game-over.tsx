import { useEffect, useRef, useState } from "react";

import { SignInButton } from "@/components/account";
import { ModelSprite } from "@/components/model-sprite";
import { ShareCardDialog } from "@/components/share-card";
import { XLogo } from "@/components/x-logo";
import { MAX_RUN_TICKS } from "@/constants/game";
import { GAME_TITLE, SITE_URL } from "@/constants/site";
import type { GameOverProps, SavedMessageProps } from "@/types/ui";
import { formatScore, shareUrl } from "@/utils/format";
import { modelSpec } from "@/utils/models";

export function GameOver({
  model,
  stats,
  submit,
  localBest,
  player,
  onRetry,
  onMenu,
}: GameOverProps) {
  const retryRef = useRef<HTMLButtonElement>(null);
  const [sharing, setSharing] = useState(false);
  // a saved best has a spot on the board, so it gets a card instead of a plain post
  const best = submit.status === "saved" ? submit.result.standing.all : null;
  const spec = modelSpec(model);
  // the server decides once it has the run; until then only this browser's own best counts, and a
  // tie isn't a new best
  let newBest = stats.score > 0 && stats.score > localBest;
  if (submit.status === "saved") {
    newBest = submit.result.improved;
  } else if (submit.status === "saving") {
    newBest = false;
  }
  const shareText = `I scored ${formatScore(stats.score)} and reached wave ${stats.wave} flying ${spec.name} in ${GAME_TITLE}. Beat that:`;

  useEffect(() => {
    // focused so Enter flies again, but without the focus ring until someone presses Tab
    retryRef.current?.focus({ focusVisible: false });
  }, []);

  return (
    <div className="px-panel m-auto flex w-full max-w-md flex-col items-center gap-5 p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-danger text-sm">
          {stats.ticks >= MAX_RUN_TICKS ? "Time's up" : "Shot down"}
        </p>
        <ModelSprite model={model} scale={4} />
        <p className="font-display text-4xl leading-none tabular-nums">
          {formatScore(stats.score)}
        </p>
        {newBest && (
          <p className="animate-blink font-display text-gold text-xs">
            New best!
          </p>
        )}
      </div>

      <dl className="grid w-full grid-cols-3 gap-2 text-sm">
        {(
          [
            ["Wave", stats.wave],
            ["Kills", stats.kills],
            ["Bosses", stats.bosses],
          ] as const
        ).map(([label, value]) => (
          <div className="bg-space/60 flex flex-col py-2" key={label}>
            <dt className="font-display text-ink-3 text-3xs uppercase">
              {label}
            </dt>
            <dd className="font-display text-lg tabular-nums">
              {formatScore(value)}
            </dd>
          </div>
        ))}
      </dl>

      <div aria-live="polite" className="text-ink-2 min-h-10 text-sm">
        {submit.status === "saving" && (
          <p className="animate-blink">Checking your run…</p>
        )}
        {submit.status === "saved" && <SavedMessage result={submit.result} />}
        {submit.status === "signin" && !player && (
          <div className="flex flex-col items-center gap-2">
            <p>Sign in with X to put this score on the leaderboard.</p>
            <SignInButton returnTo="/?resume=1">Save with X</SignInButton>
          </div>
        )}
        {submit.status === "offline" && (
          <p className="text-ink-3">
            Scores are offline, so this run can't be saved.
          </p>
        )}
        {submit.status === "error" && (
          <p className="text-danger">{submit.message}</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button
          className="px-button flex-1 py-3 text-sm"
          data-variant="primary"
          onClick={onRetry}
          ref={retryRef}
          type="button"
        >
          Fly again
        </button>
        <button
          className="px-button flex-1 py-3 text-sm"
          onClick={onMenu}
          type="button"
        >
          Menu
        </button>
      </div>
      {player && best ? (
        <button
          className="px-button w-full py-2.5 text-xs"
          data-variant="x"
          onClick={() => setSharing(true)}
          type="button"
        >
          <XLogo />
          Share your rank
        </button>
      ) : stats.score > 0 ? (
        <a
          className="px-button w-full py-2.5 text-xs"
          data-variant="x"
          href={shareUrl(shareText, SITE_URL)}
          rel="noopener noreferrer"
          target="_blank"
        >
          <XLogo />
          Post your score
        </a>
      ) : null}
      {sharing && player && best && (
        <ShareCardDialog
          best={best}
          onClose={() => setSharing(false)}
          player={player}
        />
      )}
    </div>
  );
}

/** What saving did: a new best with its ranks, a run that didn't beat the best, or nothing to save. */
function SavedMessage({ result }: SavedMessageProps) {
  const { all, week } = result.standing;
  if (result.score === 0) {
    return (
      <p className="text-ink-3">
        No points, so nothing to save. Shoot something next time.
      </p>
    );
  }
  if (!(result.improved && all)) {
    return (
      <p>
        Checked. Your best of {formatScore(all?.score ?? result.score)} still
        stands
        {all ? (
          <>
            {" "}
            at <span className="text-gold">#{formatScore(all.rank)}</span> all
            time
          </>
        ) : null}
        .
      </p>
    );
  }
  return (
    <p>
      New best saved. You're{" "}
      <span className="text-gold">#{formatScore(all.rank)}</span> all time
      {week ? (
        <>
          {" "}
          and <span className="text-gold">#{formatScore(week.rank)}</span> this
          week
        </>
      ) : null}
      .
    </p>
  );
}
