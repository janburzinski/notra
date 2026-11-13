import { useEffect, useRef, useState } from "react";

import { CompanyBoard } from "@/components/company-board";
import { LoadError } from "@/components/load-error";
import { ModelSprite } from "@/components/model-sprite";
import { RemoteImage } from "@/components/remote-image";
import { BOARD_PERIODS } from "@/constants/leaderboard";
import { MODELS } from "@/constants/models";
import type { BoardPeriod, ModelFilter } from "@/types/leaderboard";
import type {
  LeaderboardLoadState,
  LeaderboardProps,
  PrefetchedBoard,
} from "@/types/ui";
import {
  fetchLeaderboard,
  fetchReviewQueue,
  moderate,
  takePrefetchedLeaderboard,
} from "@/utils/api-client";
import { formatScore } from "@/utils/format";

export function Leaderboard({
  version,
  viewerId,
  companyId,
  standing,
  onWatch,
  onShare,
  admin,
}: LeaderboardProps) {
  const [banning, setBanning] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  // moderators also see which entries still wait for someone to watch them
  const [review, setReview] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!admin) {
      return;
    }
    let active = true;
    fetchReviewQueue()
      .then((queue) => active && setReview(queue))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [admin, version, refresh]);
  const [period, setPeriod] = useState<BoardPeriod>("all");
  // players are ranked per period; companies have one all-time board of their own
  const [companies, setCompanies] = useState(false);
  const [model, setModel] = useState<ModelFilter>("all");
  // the menu fetches the default board while the player looks at the ships; use it on first show
  const prefetchedRef = useRef<PrefetchedBoard | null | undefined>(undefined);
  if (prefetchedRef.current === undefined) {
    prefetchedRef.current = takePrefetchedLeaderboard("all", "all");
  }
  const [state, setState] = useState<LeaderboardLoadState>(() => {
    const data = prefetchedRef.current?.data;
    return data ? { status: "ready", data } : { status: "loading" };
  });

  useEffect(() => {
    let active = true;
    setState((current) =>
      current.status === "ready" ? current : { status: "loading" }
    );
    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    (prefetched?.promise ?? fetchLeaderboard(period, model))
      .then((data) => active && setState({ status: "ready", data }))
      .catch(
        (error: Error) =>
          active && setState({ status: "error", message: error.message })
      );
    return () => {
      active = false;
    };
  }, [period, model, version, refresh]);

  const entries = state.status === "ready" ? state.data.entries : [];
  // The board comes through a CDN cache and can be a few seconds behind; the viewer's own standing is
  // read fresh, so it fixes their row and is pinned below the list when the board doesn't show it yet.
  const own = model === "all" ? standing[period] : null;
  const listed = entries.find((entry) => entry.player.id === viewerId);
  // when the board lists the viewer, their row already shows the fresher score
  const pinOwn = own !== null && !listed;

  const moderateEntry = async (playerId: string, action: "approve" | "ban") => {
    setModerationError(null);
    try {
      await moderate(playerId, action);
    } catch {
      setModerationError(
        action === "ban"
          ? "Couldn't ban that player."
          : "Couldn't approve that run."
      );
    }
    setRefresh((value) => value + 1);
  };

  return (
    <section
      aria-label="Leaderboard"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      {/* two full-width rows on the same 12px gap as the tabs above: the board, then the model */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          {BOARD_PERIODS.map((entry) => {
            const active = !companies && period === entry.value;
            return (
              <button
                aria-pressed={active}
                className="px-button text-3xs px-0.5 py-1.5 whitespace-nowrap"
                data-variant={active ? "primary" : undefined}
                key={entry.value}
                onClick={() => {
                  setPeriod(entry.value);
                  setCompanies(false);
                }}
                type="button"
              >
                {entry.label}
              </button>
            );
          })}
          <button
            aria-pressed={companies}
            className="px-button text-3xs px-0.5 py-1.5 whitespace-nowrap"
            data-variant={companies ? "primary" : undefined}
            onClick={() => setCompanies(true)}
            type="button"
          >
            Companies
          </button>
        </div>
        {!companies && (
          <div
            aria-label="Filter by model"
            className="grid grid-cols-7 gap-3"
            role="group"
          >
            <button
              aria-pressed={model === "all"}
              className="px-button text-3xs h-8 p-0"
              data-variant={model === "all" ? "primary" : undefined}
              onClick={() => setModel("all")}
              title="All models"
              type="button"
            >
              All
            </button>
            {MODELS.map((entry) => (
              <button
                aria-label={entry.name}
                aria-pressed={model === entry.id}
                className="px-button h-8 p-0"
                data-variant={model === entry.id ? "primary" : undefined}
                key={entry.id}
                onClick={() => setModel(entry.id)}
                title={entry.name}
                type="button"
              >
                <ModelSprite model={entry.id} scale={1.3} />
              </button>
            ))}
          </div>
        )}
      </div>

      {companies ? (
        <CompanyBoard companyId={companyId} version={version} />
      ) : (
        <>
          <div className="bg-space/60 min-h-0 flex-1 overflow-y-auto">
            {state.status === "error" && (
              <LoadError
                message={state.message}
                onRetry={() => setRefresh((value) => value + 1)}
              />
            )}
            {state.status === "loading" && (
              <p className="animate-blink font-display text-ink-3 p-4 text-xs">
                Loading…
              </p>
            )}
            {state.status === "ready" && entries.length === 0 && (
              <p className="text-ink-3 p-4 text-sm">
                No scores yet{period === "week" ? " this week" : ""}. The top
                spot is yours.
              </p>
            )}
            {entries.length > 0 && (
              <ol className="flex flex-col">
                {entries.map((entry) => {
                  const mine = entry.player.id === viewerId;
                  let rowTint = entry.rank % 2 === 0 ? "bg-space/40" : "";
                  if (mine) {
                    rowTint = "bg-violet-deep/30";
                  }
                  return (
                    <li
                      className={`flex items-center gap-2 px-2.5 py-1.5 ${rowTint}`}
                      key={entry.player.id}
                    >
                      <span
                        className={`font-display w-5 shrink-0 text-right text-xs tabular-nums ${entry.rank <= 3 ? "text-gold" : "text-ink-3"}`}
                      >
                        {formatScore(entry.rank)}
                      </span>
                      <RemoteImage
                        // on the narrowest phones the handle needs the room more than the picture
                        className="pixelated bg-space-3 size-6 shrink-0 max-[359px]:hidden"
                        placeholderClassName="bg-space-3 size-6 shrink-0 max-[359px]:hidden"
                        size={24}
                        src={entry.player.avatar}
                      />
                      <a
                        className="hover:text-violet min-w-0 flex-1 truncate text-xs"
                        href={`https://x.com/${entry.player.handle}`}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={
                          entry.player.name
                            ? `${entry.player.name} (@${entry.player.handle})`
                            : `@${entry.player.handle}`
                        }
                      >
                        @{entry.player.handle}
                      </a>
                      <ModelSprite model={entry.model} scale={1.4} />
                      <span className="font-display min-w-16 shrink-0 text-right text-xs tabular-nums">
                        {formatScore(
                          entry.player.id === viewerId && own
                            ? Math.max(entry.score, own.score)
                            : entry.score
                        )}
                      </span>
                      {mine && onShare && <ShareButton onShare={onShare} />}
                      <button
                        aria-label={`Watch @${entry.player.handle}'s all-time best run`}
                        className="text-ink-3 hover:text-ink font-display shrink-0 px-1 text-xs"
                        onClick={() => onWatch(entry)}
                        title="Watch their all-time best run"
                        type="button"
                      >
                        ▶
                      </button>
                      {admin && review.has(entry.player.id) && (
                        <button
                          aria-label={`Approve @${entry.player.handle}'s run`}
                          className="text-gold font-display text-2xs shrink-0 px-1"
                          onClick={() => {
                            moderateEntry(entry.player.id, "approve").catch(
                              () => undefined
                            );
                          }}
                          title="Waiting for review: watch it, then approve"
                          type="button"
                        >
                          ⚑ ✓
                        </button>
                      )}
                      {admin && (
                        <button
                          aria-label={`Remove and ban @${entry.player.handle}`}
                          className="text-danger font-display text-2xs shrink-0 px-1"
                          onClick={() => {
                            // first press arms it, the second removes and bans
                            if (banning !== entry.player.id) {
                              setBanning(entry.player.id);
                              return;
                            }
                            setBanning(null);
                            moderateEntry(entry.player.id, "ban").catch(
                              () => undefined
                            );
                          }}
                          title="Remove and ban"
                          type="button"
                        >
                          {banning === entry.player.id ? "Ban?" : "✕"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          {moderationError && (
            <p className="text-danger shrink-0 text-xs" role="alert">
              {moderationError}
            </p>
          )}
          {pinOwn && own && (
            <div className="bg-violet-deep/30 flex shrink-0 items-center gap-2 px-2.5 py-1.5">
              <span className="font-display text-gold min-w-5 shrink-0 text-right text-xs tabular-nums">
                {formatScore(own.rank)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">You</span>
              <ModelSprite model={own.model} scale={1.4} />
              <span className="font-display min-w-16 shrink-0 text-right text-xs tabular-nums">
                {formatScore(own.score)}
              </span>
              {onShare && <ShareButton onShare={onShare} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      className="text-gold hover:text-ink font-display text-3xs shrink-0 px-1 uppercase"
      onClick={onShare}
      title="Share your rank"
      type="button"
    >
      Share
    </button>
  );
}
