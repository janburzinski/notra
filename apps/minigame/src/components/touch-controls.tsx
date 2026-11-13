import type { PointerEvent } from "react";

import type { TouchControlsProps } from "@/types/ui";

/** Dash, strike and pause for touch screens; the sticks themselves are drawn on the canvas. */
export function TouchControls({ onDash, onBomb, onPause }: TouchControlsProps) {
  const press = (action: () => void) => (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <>
      <button
        aria-label="Pause"
        className="px-button absolute top-3 left-1/2 size-9 -translate-x-1/2 text-xs"
        onPointerDown={press(onPause)}
        type="button"
      >
        II
      </button>
      <div className="absolute right-4 bottom-[38%] flex flex-col gap-4">
        <button
          className="px-button text-3xs size-14"
          onPointerDown={press(onDash)}
          type="button"
        >
          Dash
        </button>
        <button
          className="px-button text-3xs size-14"
          data-variant="primary"
          onPointerDown={press(onBomb)}
          type="button"
        >
          Strike
        </button>
      </div>
    </>
  );
}
