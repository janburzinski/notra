import type { CSSProperties } from "react";

import {
  PIXEL_OCTOPUS_FRAMES,
  PIXEL_OCTOPUS_SIZE,
  PIXEL_OCTOPUS_STEP_MS,
} from "@/constants/pixel-octopus";
import { cn } from "@/lib/utils";
import type {
  PixelOctopusDance,
  PixelOctopusProps,
} from "@/types/components/analytics-import";

const FILLS = {
  "#": "fill-primary",
  e: "fill-white",
  c: "fill-white/35",
} as const;

type Cell = keyof typeof FILLS;

/** One rect per horizontal run of a color, frames laid side by side. */
function stripRuns(dance: PixelOctopusDance) {
  const runs: { x: number; y: number; width: number; cell: Cell }[] = [];
  PIXEL_OCTOPUS_FRAMES[dance].forEach((rows, frame) => {
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const cell = row[x] as Cell | ".";
        let end = x + 1;
        while (end < row.length && row[end] === cell) {
          end += 1;
        }
        if (cell !== ".") {
          runs.push({
            x: frame * PIXEL_OCTOPUS_SIZE.width + x,
            y,
            width: end - x,
            cell,
          });
        }
        x = end;
      }
    });
  });
  return runs;
}

const RUNS = Object.fromEntries(
  Object.keys(PIXEL_OCTOPUS_FRAMES).map((dance) => [
    dance,
    stripRuns(dance as PixelOctopusDance),
  ])
) as Record<PixelOctopusDance, ReturnType<typeof stripRuns>>;

/**
 * A little pixel octopus that dances. Its frames sit side by side in one
 * strip that slides one frame per step behind a one-frame window, so each
 * frame shows whole; with reduced motion it stands still on the first.
 */
export function PixelOctopus({
  dance,
  scale = 4,
  className,
}: PixelOctopusProps) {
  const frames = PIXEL_OCTOPUS_FRAMES[dance].length;
  const { width, height } = PIXEL_OCTOPUS_SIZE;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-(--sprite-h) w-(--sprite-w) overflow-hidden",
        className
      )}
      data-dance={dance}
      dir="ltr"
      style={
        {
          "--sprite-w": `${width * scale}px`,
          "--sprite-h": `${height * scale}px`,
        } as CSSProperties
      }
    >
      <svg
        className="pixel-sprite-strip block"
        height={height * scale}
        shapeRendering="crispEdges"
        style={
          {
            "--sprite-frames": frames,
            "--sprite-step": `${PIXEL_OCTOPUS_STEP_MS[dance]}ms`,
          } as CSSProperties
        }
        viewBox={`0 0 ${width * frames} ${height}`}
        width={width * scale * frames}
      >
        {RUNS[dance].map((run) => (
          <rect
            className={FILLS[run.cell]}
            height={1}
            key={`${run.x}-${run.y}`}
            width={run.width}
            x={run.x}
            y={run.y}
          />
        ))}
      </svg>
    </span>
  );
}
