import type { ClaudeCodeTodo } from "@notra/ui/components/ai-skins/claude-code/claude-code-todo-list";

import type {
  McpClient,
  McpTerminalToolCall,
  McpToolCategory,
} from "@/types/mcp";
import { MCP_URL } from "@/utils/urls";

export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    iconSrc: "/mcp/claude-code.svg",
    invertInDark: false,
    command: `claude mcp add --transport http notra ${MCP_URL}`,
  },
  {
    id: "codex",
    label: "Codex",
    iconSrc: "/mcp/codex.svg",
    invertInDark: true,
    command: `codex mcp add notra --url ${MCP_URL}`,
  },
  {
    id: "cursor",
    label: "Cursor",
    iconSrc: "/mcp/cursor.svg",
    invertInDark: true,
    command: `npx add-mcp ${MCP_URL}`,
  },
  {
    id: "hermes",
    label: "Hermes",
    iconSrc: "/mcp/hermes.svg",
    invertInDark: true,
    command: `hermes mcp add notra --url ${MCP_URL}`,
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    iconSrc: "/mcp/openclaw.svg",
    invertInDark: false,
    command: `mcporter config add notra ${MCP_URL}`,
  },
  {
    id: "other",
    label: "Other",
    invertInDark: false,
    command: `npx add-mcp ${MCP_URL}`,
  },
];

export const MCP_HERO_SUBHEAD =
  "Your agent checks what ChatGPT, Claude and Gemini say about you, finds the prompts you're missing and writes the fix.";

/** Tools shown before "Show all", taken from the first category. */
export const MCP_PREVIEW_TOOL_COUNT = 6;

/** Listed first in their category, so the preview leads with what people come for. */
export const MCP_LEAD_TOOLS = [
  "get_geo_snapshot",
  "create_geo_scan",
  "get_geo_visibility_overview",
  "get_geo_changes",
  "list_geo_shelf_sources",
  "get_geo_sentiment",
];

/**
 * How the tool list is grouped on the page, in display order. A tool lands in the first category whose
 * pattern matches its name; anything new and unmatched falls into the last one.
 */
export const MCP_TOOL_CATEGORIES: McpToolCategory[] = [
  {
    id: "visibility",
    label: "AI visibility",
    match:
      /^(get_geo_snapshot|get_geo_changes|create_geo_scan|rescan_geo_prompt|list_geo_scans|get_geo_scan|get_geo_visibility_|list_geo_prompt_result_summaries|get_geo_prompt_result_detail|get_geo_prompt_history|get_geo_language_share|get_geo_sentiment|list_geo_sentiment_evidence|list_geo_shelf_sources)/,
  },
  {
    id: "prompts",
    label: "Prompts and personas",
    match: /geo_prompt|geo_sequence|geo_persona/,
  },
  { id: "competitors", label: "Competitors", match: /geo_competitor/ },
  {
    id: "content-gaps",
    label: "Content gaps and briefs",
    match: /geo_content_/,
  },
  {
    id: "traffic",
    label: "AI traffic and analytics",
    match:
      /geo_traffic|geo_web_analytics|geo_mcp|geo_ingest|geo_analytics_imports|agent_readiness|agent_reach/,
  },
  { id: "posts", label: "Posts", match: /^(?!.*site).*(^|_)posts?(_|$)/ },
  { id: "sites", label: "Sites", match: /(^|_)sites?(_|$)/ },
  { id: "brand", label: "Brand", match: /brand_/ },
  {
    id: "automation",
    label: "Schedules, triggers and skills",
    match: /schedule|event_trigger|webhook|skill/,
  },
  { id: "integrations", label: "Integrations", match: /integration|github/ },
  { id: "workspace", label: "Workspace and settings", match: /.*/ },
];

export const MCP_TERMINAL_TITLE = "claude — ~/acme/web";

export const MCP_TERMINAL_HEADER = {
  version: "v2.1.285",
  model: "Opus 5.5 (1M context)",
  org: "Claude Max",
  cwd: "~/acme/web",
};

export const MCP_TERMINAL_WHATS_NEW_STATIC =
  "MCP tool calls now stream progress. Run `/mcp` to manage servers.";

export const MCP_TERMINAL_USER_MESSAGE =
  "why doesn't chatgpt recommend us for changelog tools? fix it";

export const MCP_TERMINAL_ASSISTANT_MESSAGE =
  "I'll check where you show up with **notra**, see who gets cited instead, then draft the page that closes the gap.";

export const MCP_TERMINAL_TODOS: ClaudeCodeTodo[] = [
  { label: "Check AI visibility across engines", status: "done" },
  { label: "Find the prompts competitors win", status: "done" },
  { label: "Draft the page that fills the gap", status: "active" },
];

export const MCP_TERMINAL_TOOL_CALLS: McpTerminalToolCall[] = [
  {
    tool: "notra - get_geo_snapshot (MCP)",
    arg: 'project: "acme"',
    result: "mentioned in 6 of 40 prompts · ChatGPT 9%, Claude 24%",
  },
  {
    tool: "notra - list_geo_content_gaps (MCP)",
    arg: 'engine: "chatgpt"',
    result: "5 gaps · Shipnote and Releasely cited instead",
  },
  {
    tool: "notra - plan_geo_content_brief (MCP)",
    arg: 'gapId: "gap_31k", autoApprove: true',
    result:
      '"The best changelog tools for dev teams", 7 sections, writer started',
  },
  {
    tool: "notra - get_geo_content_brief (MCP)",
    arg: 'briefId: "brief_31k"',
    result: "writer done, draft post ready in your brand voice",
  },
];

export const MCP_TERMINAL_RESULT_MESSAGE =
  "Done. ChatGPT cites **Shipnote** for 5 prompts you should win. The draft answers all of them and is waiting in Notra for review.";

export const MCP_TERMINAL_TURN_SUMMARY = {
  verb: "Worked",
  duration: "22s",
  doneAt: "9:41 AM",
};

export const MCP_TERMINAL_PROMPT_PLACEHOLDER =
  'Try "what changed in our AI visibility this week?"';
