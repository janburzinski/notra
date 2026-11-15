export const CREATE_ARTIFACT_TOOL_NAME = "createArtifact";
export const UPDATE_ARTIFACT_TOOL_NAME = "updateArtifact";
export const GET_ARTIFACT_TOOL_NAME = "getArtifact";
export const LIST_ARTIFACTS_TOOL_NAME = "listArtifacts";

export const ARTIFACT_SOURCES = ["chat", "slack", "autopilot"] as const;
/** Who saved a version: a source, a member restoring one, or a lost row update caught up from git. */
export const ARTIFACT_ACTORS = [
  ...ARTIFACT_SOURCES,
  "member",
  "recovered",
] as const;

/** The commit author of each kind of write, so the history says who wrote it. */
export const ARTIFACT_AUTHORS = {
  chat: { name: "Notra agent", email: "agent@usenotra.com" },
  slack: { name: "Notra agent in Slack", email: "agent@usenotra.com" },
  autopilot: { name: "Notra Autopilot", email: "autopilot@usenotra.com" },
  member: { name: "Workspace member", email: "members@usenotra.com" },
  recovered: { name: "Notra", email: "agent@usenotra.com" },
} as const;

export const ARTIFACT_PATH = "/artifact";
/** Next to shared chats, so it adds no new top-level path. */
export const ARTIFACT_SHARE_PATH = "/share/artifact";

export const ARTIFACT_ID_LENGTH = 16;
export const ARTIFACT_SHARE_ID_LENGTH = 21;

export const ARTIFACT_LIMITS = {
  title: 120,
  summary: 400,
  blocks: 40,
  blockTitle: 120,
  markdown: 6000,
  metricItems: 6,
  metricLabel: 60,
  metricValue: 40,
  metricNote: 120,
  tableColumns: 8,
  tableRows: 100,
  tableCell: 300,
  calloutText: 1000,
  findingIds: 20,
  sources: 20,
  sourceTitle: 200,
  /** Versions listed in the picker; older ones stay stored. */
  versionsListed: 50,
  /** Artifacts the list tool returns at most. */
  listed: 20,
} as const;

export const ARTIFACT_CALLOUT_TONES = [
  "info",
  "success",
  "warning",
  "danger",
] as const;

export const ARTIFACT_METRIC_TRENDS = ["up", "down", "flat"] as const;

/** Every artifact is one file in its own code.storage repository. */
export const ARTIFACT_FILE_PATH = "artifact.md";
export const ARTIFACT_REPO_PREFIX = "notra-artifact-";
/**
 * A new repository is queued for deletion before it exists and leaves the
 * queue with its row; if the row never lands, it goes after this long.
 */
export const ARTIFACT_CREATE_GRACE_MS = 60 * 60 * 1000;
/** Block kinds written as a fenced JSON section; everything else is Markdown. */
export const ARTIFACT_FENCED_TYPES = [
  "metrics",
  "chart",
  "table",
  "callout",
  "autopilot",
  "sources",
] as const;
export const ARTIFACT_FRONTMATTER_KEYS = ["title", "summary"] as const;
/** Nested JSON stays on one line while it fits, so a diff shows the row that changed. */
export const ARTIFACT_JSON_LINE_WIDTH = 100;
export const ARTIFACT_FENCE_OPEN = /^```([a-z]+)\s*$/;
export const ARTIFACT_FENCE_CLOSE = /^```\s*$/;
/** Any other fence inside Markdown, so a code sample never reads as a block. */
export const ARTIFACT_MARKDOWN_FENCE = /^(`{3,}|~{3,})/;
export const ARTIFACT_FRONTMATTER_LINE = /^([a-z]+):\s?(.*)$/;

/** How the file is written; shared by the tools that write one. */
export const ARTIFACT_FILE_GUIDE = `The file starts with frontmatter, then the blocks in order:
---
title: Specific title, like Weekly AI traffic
summary: One or two sentences with the main takeaway (optional)
---
Text is GitHub-flavored Markdown: ## headings, paragraphs, lists, bold, links. Every other block is a fenced JSON object, its kind after the backticks:
\`\`\`metrics
{ "title": "Last 7 days", "items": [{ "label": "Visits", "value": "12.4k", "change": "+18%", "trend": "up", "note": "Nov 8 to Nov 14" }] }
\`\`\`
\`\`\`chart
{ "chart": { "kind": "area", "title": "Daily visits", "series": [{ "name": "ChatGPT", "points": [{ "x": "Nov 8", "y": 1050 }] }] } }
\`\`\`
A bar or pie chart has "segments": [{ "label": "ChatGPT", "value": 8200 }] instead of series.
\`\`\`table
{ "title": "By source", "columns": ["Source", "Visits", "Change"], "rows": [["ChatGPT", 8200, "+18%"]], "lowerIsBetter": ["Bounce rate"] }
\`\`\`
\`\`\`callout
{ "tone": "info | success | warning | danger", "title": "Optional", "text": "The takeaway, a warning or a next step" }
\`\`\`
\`\`\`autopilot
{ "title": "Optional", "findingIds": ["Autopilot finding ids from the Autopilot status"] }
\`\`\`
\`\`\`sources
{ "items": [{ "title": "Notra analytics", "url": "https://app.usenotra.com/analytics" }] }
\`\`\`
Only list sources with a real URL a tool returned; leave the block out otherwise.
Only title, trend, note, change and lowerIsBetter are optional. Up to ${ARTIFACT_LIMITS.blocks} blocks; a metrics row holds up to ${ARTIFACT_LIMITS.metricItems} items, a table up to ${ARTIFACT_LIMITS.tableColumns} columns and ${ARTIFACT_LIMITS.tableRows} rows. Write table changes as signed text, like +18%.`;
