import { useEffect, useRef, useState } from "react";

import { MAX_PAUSED_S } from "@/constants/anti-cheat";
import type { PauseMenuProps } from "@/types/ui";

/** What is left of the run's pause allowance, in whole minutes, or null for a run that isn't saved. */
function minutesLeft(pausedSeconds: number | null) {
  return pausedSeconds === null
    ? null
    : Math.max(0, Math.ceil((MAX_PAUSED_S - pausedSeconds) / 60));
}

export function PauseMenu({
  pausedSeconds,
  onResume,
  onQuit,
  muted,
  onToggleMute,
}: PauseMenuProps) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  const [left, setLeft] = useState(() => minutesLeft(pausedSeconds()));

  useEffect(() => {
    // focused so Enter resumes, but without the focus ring until someone presses Tab
    resumeRef.current?.focus({ focusVisible: false });
  }, []);

  // the server refuses a run paused too long in all, so count down while the menu is open
  useEffect(() => {
    const timer = setInterval(
      () => setLeft(minutesLeft(pausedSeconds())),
      1000
    );
    return () => clearInterval(timer);
  }, [pausedSeconds]);

  return (
    <div className="px-panel m-auto flex w-full max-w-xs flex-col gap-3 p-5">
      <p className="font-display text-center text-2xl">Paused</p>
      <button
        className="px-button py-3 text-sm"
        data-variant="primary"
        onClick={onResume}
        ref={resumeRef}
        type="button"
      >
        Resume
      </button>
      <button
        aria-pressed={!muted}
        className="px-button py-2 text-xs"
        onClick={onToggleMute}
        type="button"
      >
        Sound: {muted ? "off" : "on"}
      </button>
      <button
        className="px-button text-danger py-2 text-xs"
        onClick={onQuit}
        type="button"
      >
        Abandon run
      </button>
      <p className="text-ink-3 text-2xs text-center">
        An abandoned run doesn't count.
      </p>
      {left !== null && (
        <p
          className={`text-2xs text-center ${left === 0 ? "text-danger" : "text-ink-3"}`}
        >
          {left === 0
            ? "Paused too long: this run can't be saved anymore."
            : `${left} min of pause left before this run can't be saved.`}
        </p>
      )}
    </div>
  );
}
