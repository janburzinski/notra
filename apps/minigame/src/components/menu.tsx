import { useEffect, useRef, useState } from "react";

import { Account } from "@/components/account";
import { Leaderboard } from "@/components/leaderboard";
import { ModelPicker } from "@/components/model-picker";
import { ShareCardDialog } from "@/components/share-card";
import {
  GAME_TITLE,
  MENU_CONTROLS,
  MENU_TABS,
  NOTRA_URL,
} from "@/constants/site";
import type { MenuTab } from "@/types/session";
import type { MenuProps } from "@/types/ui";
import { prefetchLeaderboard } from "@/utils/api-client";

/** One centred box: pick a ship and launch, or look at the leaderboard. */
export function Menu({
  model,
  onModelChange,
  onPlay,
  starting,
  viewer,
  leaderboardVersion,
  onViewerDeleted,
  onWatch,
  initialTab,
  watched,
}: MenuProps) {
  const [tab, setTab] = useState<MenuTab>(initialTab);
  const [sharing, setSharing] = useState(false);
  const { player } = viewer;
  const best = viewer.standing.all;
  const playRef = useRef<HTMLButtonElement>(null);

  // fetch the board while the player picks a ship, so the Leaderboard tab opens without a wait
  useEffect(() => {
    if (initialTab !== "play") {
      return;
    }
    const idle =
      window.requestIdleCallback ?? ((run) => window.setTimeout(run, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => prefetchLeaderboard("all", "all"));
    return () => cancel(handle);
  }, [initialTab]);

  useEffect(() => {
    if (tab === "play") {
      // focused so Enter launches, but without the focus ring until someone presses Tab
      playRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
  }, [tab]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="px-panel flex w-full max-w-md flex-col gap-5 p-5">
        <h1 className="font-display text-center text-2xl leading-none">
          <span className="text-violet">{GAME_TITLE.split(" ")[0]}</span>{" "}
          {GAME_TITLE.split(" ").slice(1).join(" ")}
        </h1>

        <div className="grid grid-cols-2 gap-3" role="tablist">
          {MENU_TABS.map((entry) => (
            <button
              aria-controls={`menu-${entry.value}`}
              aria-selected={tab === entry.value}
              className="px-button text-2xs py-2"
              data-variant={tab === entry.value ? "primary" : undefined}
              id={`tab-${entry.value}`}
              key={entry.value}
              onClick={() => setTab(entry.value)}
              role="tab"
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>

        {/* Play stays laid out under the leaderboard and both share one height, so switching tabs
            never moves anything. The ship picker sits at the top, Launch and its controls at the
            bottom. */}
        <div className="relative grid min-h-64">
          <div
            aria-labelledby="tab-play"
            className={`flex flex-col justify-between gap-5 ${tab === "play" ? "" : "invisible"}`}
            id="menu-play"
            inert={tab !== "play"}
            role="tabpanel"
          >
            <ModelPicker onChange={onModelChange} value={model} />
            <div className="flex flex-col gap-5">
              <button
                className="px-button py-3 text-base"
                data-variant="primary"
                disabled={starting}
                onClick={onPlay}
                ref={playRef}
                type="button"
              >
                {starting ? "Launching…" : "Launch"}
              </button>
              <p className="text-ink-3 text-center text-xs text-balance">
                {MENU_CONTROLS.map((control, index) => (
                  <span key={control}>
                    {index > 0 && " "}
                    <span className="whitespace-nowrap">
                      {control}
                      {index < MENU_CONTROLS.length - 1 && " ·"}
                    </span>
                  </span>
                ))}
              </p>
            </div>
          </div>
          {tab === "leaderboard" && (
            <div
              aria-labelledby="tab-leaderboard"
              className="absolute inset-0 flex flex-col"
              id="menu-leaderboard"
              role="tabpanel"
            >
              <Leaderboard
                admin={viewer.admin}
                onShare={player && best ? () => setSharing(true) : null}
                onWatch={onWatch}
                standing={viewer.standing}
                version={leaderboardVersion}
                viewerId={viewer.player?.id ?? null}
                companyId={viewer.player?.company?.id ?? null}
                watched={watched}
              />
            </div>
          )}
        </div>

        {sharing && player && best && (
          <ShareCardDialog
            best={best}
            onClose={() => setSharing(false)}
            player={player}
          />
        )}

        <div className="border-line/60 flex justify-center border-t pt-5">
          <Account onDeleted={onViewerDeleted} viewer={viewer} />
        </div>
      </div>

      <p className="text-ink-3 text-xs">
        Made by{" "}
        <a
          className="hover:text-ink underline underline-offset-2"
          href={NOTRA_URL}
        >
          Notra
        </a>{" "}
        ·{" "}
        <a
          className="hover:text-ink underline underline-offset-2"
          href={`${NOTRA_URL}/privacy`}
        >
          Privacy
        </a>
      </p>
    </div>
  );
}
