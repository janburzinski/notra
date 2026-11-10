import { MCP_LEAD_TOOLS, MCP_TOOL_CATEGORIES } from "@/constants/mcp";
import type { McpToolCard, McpToolGroup } from "@/types/mcp";

export function formatMcpShowAllToolsLabel(toolCount: number): string {
  return `Show all ${toolCount} tools`;
}

export function formatMcpToolCount(toolCount: number): string {
  return `${toolCount} tools`;
}

/** The first sentence of a tool description; the rest is guidance written for agents, not people. */
export function summarizeMcpToolDescription(description: string): string {
  const match = /^(.+?[.!?])(?=\s+[A-Z(`]|$)/s.exec(description.trim());
  return match?.[1] ?? description.trim();
}

/** Sorts tools into the page's categories, in category order, dropping empty ones. */
export function groupMcpTools(tools: McpToolCard[]): McpToolGroup[] {
  const groups = MCP_TOOL_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    tools: [] as McpToolCard[],
  }));
  for (const tool of tools) {
    const index = MCP_TOOL_CATEGORIES.findIndex((category) =>
      category.match.test(tool.name)
    );
    groups[index === -1 ? groups.length - 1 : index]?.tools.push(tool);
  }
  const rank = (tool: McpToolCard) => {
    const index = MCP_LEAD_TOOLS.indexOf(tool.name);
    return index === -1 ? MCP_LEAD_TOOLS.length : index;
  };
  for (const group of groups) {
    // stable, so everything not in the lead list keeps the server's order
    group.tools.sort((a, b) => rank(a) - rank(b));
  }
  return groups.filter((group) => group.tools.length > 0);
}

export function formatMcpWhatsNewDiscovery(toolCount: number): string {
  return `notra MCP · ${toolCount} tools discovered automatically`;
}

export function formatMcpUseCasesCalloutLabel(useCaseCount: number): string {
  return `${useCaseCount} copy-paste workflows for visibility tracking, content and reporting, each with the exact prompt and the integrations it uses.`;
}
