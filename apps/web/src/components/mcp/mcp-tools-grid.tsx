import { useState } from "react";

import { MCP_PREVIEW_TOOL_COUNT } from "@/constants/mcp";
import type { McpToolCard, McpToolGroup, McpToolsGridProps } from "@/types/mcp";
import {
  formatMcpShowAllToolsLabel,
  formatMcpToolCount,
  groupMcpTools,
  summarizeMcpToolDescription,
} from "@/utils/mcp";

const CARD_CLASSNAME =
  "flex flex-col gap-1 rounded-2xl px-5 py-4 [box-shadow:#ECECEC_0rem_0rem_0rem_0.0625rem] dark:[box-shadow:#FFFFFF14_0rem_0rem_0rem_0.0625rem]";

function ToolCard({ tool }: { tool: McpToolCard }) {
  return (
    <li className={CARD_CLASSNAME}>
      <span className="font-mono text-[0.8125rem] leading-[1.4] font-medium break-all text-[#1E1E1E] dark:text-white">
        {tool.name}
      </span>
      {tool.description ? (
        <span className="line-clamp-2 font-sans text-[0.8125rem] leading-[1.46] text-[#1E1E1EA6] dark:text-white/60">
          {summarizeMcpToolDescription(tool.description)}
        </span>
      ) : null}
    </li>
  );
}

function ToolGroup({ group, limit }: { group: McpToolGroup; limit?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-baseline gap-2 font-sans text-[0.9375rem] leading-[1.3] font-semibold tracking-[-0.01em] text-[#1E1E1E] dark:text-white">
        {group.label}
        <span className="font-normal text-[#1E1E1E80] tabular-nums dark:text-white/45">
          {group.tools.length}
        </span>
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.tools.slice(0, limit).map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </ul>
    </div>
  );
}

/** Every tool the server lists, grouped by what it's for. Starts with a short preview of the first group. */
export function McpToolsGrid({ tools }: McpToolsGridProps) {
  const [showAll, setShowAll] = useState(false);
  const groups = groupMcpTools(tools);
  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[1.75rem] leading-[1.21] font-medium tracking-[-0.02em] text-[#1E1E1E] dark:text-white">
          What your agent can do
        </h2>
        <span className="shrink-0 font-sans text-[0.9375rem] text-[#1E1E1E80] tabular-nums dark:text-white/50">
          {formatMcpToolCount(tools.length)}
        </span>
      </div>
      {(showAll ? groups : groups.slice(0, 1)).map((group) => (
        <ToolGroup
          group={group}
          key={group.id}
          limit={showAll ? undefined : MCP_PREVIEW_TOOL_COUNT}
        />
      ))}
      {showAll ? null : (
        <button
          className="focus-visible:ring-ring flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#E4E4E7] px-5 py-4 transition-colors outline-none hover:border-[#D4D4D8] focus-visible:ring-2 dark:border-white/15 dark:hover:border-white/25"
          onClick={() => setShowAll(true)}
          type="button"
        >
          <span className="font-sans text-[0.875rem] leading-[1.36] font-medium text-[#1E1E1E99] dark:text-white/60">
            {formatMcpShowAllToolsLabel(tools.length)}
          </span>
        </button>
      )}
    </section>
  );
}
