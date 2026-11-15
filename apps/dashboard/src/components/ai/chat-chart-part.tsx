"use client";

import type { ToolOutputChartProps } from "@/types/components/chat-tool-chart";
import dynamic from "@/utils/lazy-component";

const ToolOutputChart = dynamic(
  () =>
    import("./chat-tool-block/tool-output-chart").then(
      (mod) => mod.ToolOutputChart
    ),
  { ssr: false }
);

/**
 * A chart the agent drew into its answer: only the card, without the tool
 * line, so it reads as part of the response between the text around it.
 */
export function ChatChartPart({ chart }: Pick<ToolOutputChartProps, "chart">) {
  return <ToolOutputChart chart={chart} className="my-3" />;
}
