import type { CSSProperties } from "react";

import type { McpToolUsageCellProps } from "@/types/mcp-analytics";

/** A tool's call count beside a slim bar sized against the busiest tool. */
export function McpToolUsageCell({ share, children }: McpToolUsageCellProps) {
  return (
    <span className="flex min-w-0 items-center justify-end gap-3">
      <span
        aria-hidden
        className="bg-muted relative h-1.5 w-full max-w-28 min-w-8 overflow-hidden rounded-full"
      >
        <span
          className="bg-muted-foreground/60 absolute inset-y-0 left-0 w-(--tool-share) rounded-full"
          style={
            {
              "--tool-share": `${Math.max(share, 0.02) * 100}%`,
            } as CSSProperties
          }
        />
      </span>
      <span className="w-14 shrink-0 text-right tabular-nums">{children}</span>
    </span>
  );
}
