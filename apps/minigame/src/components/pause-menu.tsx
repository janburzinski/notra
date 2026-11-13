import { useEffect, useRef } from "react";

import type { PauseMenuProps } from "@/types/ui";

export function PauseMenu({
  onResume,
  onQuit,
  muted,
  onToggleMute,
}: PauseMenuProps) {
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // focused so Enter resumes, but without the focus ring until someone presses Tab
    resumeRef.current?.focus({ focusVisible: false });
  }, []);

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
    </div>
  );
}
