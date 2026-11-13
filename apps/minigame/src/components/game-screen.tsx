import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { GameOver } from "@/components/game-over";
import { Menu } from "@/components/menu";
import { PauseMenu } from "@/components/pause-menu";
import { TouchControls } from "@/components/touch-controls";
import { DEFAULT_MODEL } from "@/constants/models";
import {
  AUTH_MESSAGES,
  NOTICE_MS,
  OFFLINE_MESSAGE,
  SIGNED_OUT,
  STORAGE_KEYS,
} from "@/constants/site";
import { GameSession } from "@/lib/game/session";
import type { ModelId } from "@/types/game";
import type { LeaderboardEntry, ViewerResponse } from "@/types/leaderboard";
import type { FinishedRun, MenuTab, Screen, WatchedRun } from "@/types/session";
import type { GameScreenProps, SubmitState } from "@/types/ui";
import {
  ApiError,
  createRun,
  fetchReplay,
  fetchViewer,
  sendBeat,
  submitRun,
} from "@/utils/api-client";
import { formatScore } from "@/utils/format";
import { isModelId } from "@/utils/models";
import { savePendingRun, takePendingRun } from "@/utils/pending-run";
import { readStored, writeStored } from "@/utils/storage";

export function GameScreen({ initialViewer }: GameScreenProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const launchingRef = useRef(false);
  const sessionRef = useRef<GameSession | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [viewer, setViewer] = useState<ViewerResponse>(initialViewer);
  const [paused, setPaused] = useState(false);
  const [menuTab, setMenuTab] = useState<MenuTab>("play");
  const [watched, setWatched] = useState<WatchedRun | null>(null);
  const [lastRun, setLastRun] = useState<FinishedRun | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [localBest, setLocalBest] = useState(0);
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [touch, setTouch] = useState(false);
  const viewerRef = useRef(viewer);
  // the run the score screen shows, so a slow upload of an earlier run can't overwrite its status
  const shownRunRef = useRef<string | null>(null);
  // bumped by every launch, replay and return to the menu, so a slow replay download that finishes
  // after the player moved on doesn't take over the canvas
  const actionRef = useRef(0);
  useEffect(() => {
    viewerRef.current = viewer;
  }, [viewer]);

  const refreshViewer = useCallback(() => {
    fetchViewer()
      .then(setViewer)
      .catch(() => undefined);
  }, []);

  const saveRun = useCallback(
    async (run: FinishedRun) => {
      if (!run.runId) {
        setSubmit({ status: "offline" });
        return;
      }
      setSubmit({ status: "saving" });
      const shown = () => shownRunRef.current === run.runId;
      try {
        const result = await submitRun(run.runId, run.replay);
        setLeaderboardVersion((version) => version + 1);
        refreshViewer();
        if (shown()) {
          setSubmit({ status: "saved", result });
        }
      } catch (error) {
        if (!shown()) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          savePendingRun(run);
          setSubmit({ status: "signin" });
          setViewer(SIGNED_OUT);
          return;
        }
        setSubmit({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Your score couldn't be saved",
        });
      }
    },
    [refreshViewer]
  );

  const handleOver = useCallback(
    (run: FinishedRun) => {
      shownRunRef.current = run.runId;
      setLastRun(run);
      setScreen("over");
      setPaused(false);
      const best = Number(readStored(STORAGE_KEYS.best) ?? 0);
      setLocalBest(best);
      if (run.stats.score > best) {
        writeStored(STORAGE_KEYS.best, String(run.stats.score));
      }
      if (!run.runId) {
        setSubmit({ status: "offline" });
      } else if (viewerRef.current.player) {
        saveRun(run).catch(() => undefined);
      } else {
        savePendingRun(run);
        setSubmit({ status: "signin" });
      }
    },
    [saveRun]
  );

  // the canvas and its loop live for the whole page; the menu's demo plays on it
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const session = new GameSession(stage, {
      onOver: (run) => handleOver(run),
      onPause: setPaused,
      onBeat: sendBeat,
      onReplayEnd: () => {
        sessionRef.current?.startDemo();
        setMenuTab("leaderboard");
        setScreen("menu");
      },
    });
    sessionRef.current = session;
    const storedMuted = readStored(STORAGE_KEYS.muted) === "true";
    session.sfx.setMuted(storedMuted);
    setMuted(storedMuted);
    const storedModel = readStored(STORAGE_KEYS.model);
    if (isModelId(storedModel)) {
      setModel(storedModel);
    }
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    return () => {
      session.destroy();
      sessionRef.current = null;
    };
  }, [handleOver]);

  // coming back from X sign-in: show the result and save the run that was waiting for it
  useEffect(() => {
    const url = new URL(window.location.href);
    const auth = url.searchParams.get("auth");
    if (!auth) {
      return;
    }
    url.searchParams.delete("auth");
    url.searchParams.delete("resume");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (auth !== "ok") {
      setNotice(AUTH_MESSAGES[auth] ?? AUTH_MESSAGES.failed ?? null);
      return;
    }
    const pending = takePendingRun();
    if (pending) {
      shownRunRef.current = pending.runId;
      setLastRun(pending);
      setModel(pending.model);
      setScreen("over");
      saveRun(pending).catch(() => undefined);
    }
  }, [saveRun]);

  const play = useCallback(async (chosen: ModelId) => {
    const session = sessionRef.current;
    // a double click on Launch would otherwise ask the server for two runs
    if (!session || launchingRef.current) {
      return;
    }
    launchingRef.current = true;
    actionRef.current += 1;
    session.sfx.unlock();
    setScreen("starting");
    setSubmit({ status: "idle" });
    setNotice(null);
    try {
      const run = await createRun(chosen);
      session.startRun(run.runId, run.seed, chosen);
    } catch (error) {
      // the game still plays without the server, it just can't be saved
      session.startRun(null, Math.floor(Math.random() * 2 ** 31), chosen);
      const reason =
        error instanceof ApiError ? error.message : OFFLINE_MESSAGE;
      setNotice(`${reason.replace(/\.$/, "")}. This run won't be saved.`);
    }
    launchingRef.current = false;
    setScreen("playing");
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  const backToMenu = useCallback(() => {
    actionRef.current += 1;
    sessionRef.current?.startDemo();
    setPaused(false);
    setScreen("menu");
  }, []);

  /** Plays a leaderboard entry's best run on the game canvas. */
  const watch = useCallback(async (entry: LeaderboardEntry) => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    session.sfx.unlock();
    setNotice(null);
    actionRef.current += 1;
    const action = actionRef.current;
    try {
      const replay = await fetchReplay(entry.player.id);
      if (actionRef.current !== action) {
        return;
      }
      session.startReplay(replay.seed, replay.model, replay.ticks);
      // the stored replay is the all-time best, which a weekly or model row may not show
      setWatched({ handle: entry.player.handle, score: replay.score });
      setScreen("replay");
    } catch (error) {
      if (actionRef.current !== action) {
        return;
      }
      setNotice(
        error instanceof Error ? error.message : "That replay isn't available"
      );
    }
  }, []);

  const leaveReplay = useCallback(() => {
    actionRef.current += 1;
    sessionRef.current?.startDemo();
    setMenuTab("leaderboard");
    setScreen("menu");
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    sessionRef.current?.sfx.setMuted(next);
    writeStored(STORAGE_KEYS.muted, String(next));
    setMuted(next);
  }, [muted]);

  // an Effect Event reads the latest screen and run, so the listener is added once
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    // shortcuts wait while a dialog such as the share card is open
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      document.querySelector("dialog[open]")
    ) {
      return;
    }
    if (screen === "replay" && event.code === "Escape") {
      event.preventDefault();
      leaveReplay();
    } else if (
      screen === "playing" &&
      (event.code === "Escape" || event.code === "KeyP")
    ) {
      event.preventDefault();
      sessionRef.current?.togglePause();
    } else if (event.code === "KeyM") {
      toggleMute();
    } else if (screen === "over" && event.code === "KeyR") {
      play(lastRun?.model ?? model).catch(() => undefined);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const chooseModel = (next: ModelId) => {
    setModel(next);
    writeStored(STORAGE_KEYS.model, next);
  };

  const inGame = screen === "playing";

  return (
    <main className="bg-space relative h-dvh w-full overflow-hidden select-none">
      <div
        aria-label="Notra Dogfight"
        className={`absolute inset-0 flex touch-none items-center justify-center outline-none ${inGame && !paused ? "cursor-none" : ""}`}
        ref={stageRef}
        role="application"
        tabIndex={-1}
      >
        {inGame && touch && !paused && (
          <TouchControls
            onBomb={() => sessionRef.current?.input.pressBomb()}
            onDash={() => sessionRef.current?.input.pressDash()}
            onPause={() => sessionRef.current?.setPaused(true)}
          />
        )}
      </div>

      {(screen === "menu" || screen === "starting") && (
        <div className="bg-space/75 absolute inset-0 overflow-y-auto">
          <Menu
            leaderboardVersion={leaderboardVersion}
            model={model}
            onModelChange={chooseModel}
            onPlay={() => {
              play(model).catch(() => undefined);
            }}
            initialTab={menuTab}
            onViewerDeleted={() => {
              setViewer(SIGNED_OUT);
              setLeaderboardVersion((version) => version + 1);
              setNotice("Your scores and profile were deleted.");
            }}
            onWatch={(entry) => {
              watch(entry).catch(() => undefined);
            }}
            starting={screen === "starting"}
            viewer={viewer}
          />
        </div>
      )}

      {inGame && paused && (
        <div className="bg-space/70 absolute inset-0 flex overflow-y-auto p-4">
          <PauseMenu
            muted={muted}
            onQuit={backToMenu}
            onResume={() => sessionRef.current?.setPaused(false)}
            onToggleMute={toggleMute}
          />
        </div>
      )}

      {screen === "replay" && watched && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-3 p-3">
          <p className="font-display text-ink-2 text-xs">
            Replay · @{watched.handle} · {formatScore(watched.score)}
          </p>
          <button
            className="px-button text-3xs px-2 py-1"
            onClick={leaveReplay}
            type="button"
          >
            Leave (Esc)
          </button>
        </div>
      )}

      {/* over everything and out of the layout, so a notice never pushes the menu around */}
      {notice && (
        <p
          className="px-panel text-gold pointer-events-none absolute inset-x-4 top-4 z-30 mx-auto w-fit max-w-sm px-3 py-2 text-center text-sm"
          role="status"
        >
          {notice}
        </p>
      )}

      {screen === "over" && lastRun && (
        <div className="bg-space/70 absolute inset-0 flex overflow-y-auto p-4">
          <GameOver
            localBest={localBest}
            model={lastRun.model}
            onMenu={backToMenu}
            onRetry={() => {
              play(lastRun.model).catch(() => undefined);
            }}
            player={viewer.player}
            stats={lastRun.stats}
            submit={submit}
          />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {screen === "over" && lastRun
          ? `Game over. Score ${formatScore(lastRun.stats.score)}.`
          : ""}
      </p>
    </main>
  );
}
