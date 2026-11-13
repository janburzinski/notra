import { X_LOGO_ART } from "@/constants/render";

/** The X logo drawn in whole pixels; one logo pixel is one pixel of the label's font (1/8 em). */
export function XLogo() {
  return (
    <svg
      aria-hidden="true"
      className="size-[0.875em] shrink-0"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${X_LOGO_ART.length} ${X_LOGO_ART.length}`}
    >
      {X_LOGO_ART.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "#" ? (
            <rect
              fill="currentColor"
              height={1}
              key={`${x}-${y}`}
              width={1}
              x={x}
              y={y}
            />
          ) : null
        )
      )}
    </svg>
  );
}
