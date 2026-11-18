"use client";

import { cn } from "cn";
import { useEffect, useState } from "react";

import { EDGE_LIGHT_FADE_OUT_MS } from "../constants/edge-light";
import type { EdgeLightProps } from "../types/edge-light";

/**
 * A soft light sweeping around the border of its parent, for work in
 * progress. Place it inside a positioned, rounded element the size of the
 * surface; it takes that element's radius. Nothing is rendered while idle.
 */
function EdgeLight({ active, className }: EdgeLightProps) {
  // Stays mounted through the fade out, then leaves the tree so an idle
  // surface carries no layers or animations.
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (active) {
      return;
    }
    const timeout = window.setTimeout(
      () => setMounted(false),
      EDGE_LIGHT_FADE_OUT_MS
    );
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!mounted) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className={cn("edge-light", className)}
      data-active={active ? "" : undefined}
      data-slot="edge-light"
    >
      <span className="edge-light__glow">
        <span className="edge-light__glow-shape">
          <span className="edge-light__turn" data-window="" />
        </span>
      </span>
      <span className="edge-light__rim">
        <span className="edge-light__turn" />
        <span className="edge-light__highlights">
          <span className="edge-light__turn" data-window="" />
        </span>
      </span>
    </span>
  );
}

export { EdgeLight };
