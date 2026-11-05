import {
  BrowserIcon,
  Rocket01Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

import { CHART_PRIMARY_COLOR } from "@/constants/charts";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import type {
  McpOutcomeBadgeVariant,
  McpRpcErrorKey,
  McpServerRequestKey,
  McpSetupTransport,
} from "@/types/mcp-analytics";

export const MCP_ANALYTICS_NAV_LINK = "/geo/traffic/mcp";

export const MCP_TOOLS_SKELETON_ROWS = 5;

/** Tables grow with their rows up to this many, then scroll. */
export const MCP_TABLE_MAX_ROWS = 8;

/** Compact rows for the tables inside the tool, session and request sheets. */
export const MCP_SHEET_ROW_HEIGHT = 44;

/** Empty tables keep room for the icon, title and opt-in hint. */
export const MCP_TABLE_EMPTY_HEIGHT = 300;

/** The request log keeps one height for every filter. */
export const MCP_LOG_TABLE_HEIGHT = (MCP_TABLE_MAX_ROWS + 1) * TABLE_ROW_HEIGHT;

export const JSON_RPC_ERROR_KEYS: Partial<Record<number, McpRpcErrorKey>> = {
  [-32_700]: "parse",
  [-32_600]: "invalidRequest",
  [-32_601]: "methodNotFound",
  [-32_602]: "invalidParams",
  [-32_603]: "internal",
  [-32_002]: "resourceNotFound",
};

export const MCP_ELICITATION_OUTCOME_VARIANTS = {
  accept: "success",
  decline: "warning",
  cancel: "secondary",
} as const satisfies Record<string, McpOutcomeBadgeVariant>;

export const MCP_SERVER_REQUEST_KEYS: Partial<
  Record<string, McpServerRequestKey>
> = {
  "elicitation/create": "elicitation",
  "sampling/createMessage": "sampling",
};

export const MCP_LOG_FILTERS = ["all", "success", "errors"] as const;

export const MCP_SETUP_TRANSPORTS = ["http", "stdio"] as const;

export const MCP_SETUP_DEFAULT_TRANSPORT: McpSetupTransport = "http";

export const MCP_SETUP_FILE = "server.ts";

export const MCP_SETUP_TRANSPORT_LABELS = {
  http: "Streamable HTTP",
  stdio: "stdio",
} as const satisfies Record<McpSetupTransport, string>;

export const MCP_SETUP_SNIPPETS = {
  http: `import { trackMcpTransport } from "@usenotra/geo/mcp";

// The StreamableHTTPServerTransport your server already creates
await server.connect(
  trackMcpTransport(transport, {
    token: process.env.NOTRA_GEO_TOKEN ?? "",
  })
);`,
  stdio: `import { trackMcpTransport } from "@usenotra/geo/mcp";

// The StdioServerTransport your server already creates
await server.connect(
  trackMcpTransport(transport, {
    token: process.env.NOTRA_GEO_TOKEN ?? "",
  })
);`,
} as const satisfies Record<McpSetupTransport, string>;

export const MCP_VERSION_PARAM = "version";

/** Select value for every version; the URL drops the param instead. */
export const MCP_VERSION_ALL = "*";

export const MCP_METRIC_SERIES_KEY = "value";

/** The metric charts are 160px tall; more than four steps crowd the labels. */
export const MCP_AXIS_MAX_STEPS = 4;

export const MCP_AXIS_NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/** Above these, tick labels switch to "12K" and "2.5 s" to stay narrow. */
export const MCP_AXIS_COMPACT_COUNT = 10_000;
export const MCP_AXIS_SECONDS_FROM_MS = 1000;

export const MCP_HOURS_PER_DAY = 24;
export const MCP_HOUR_MS = 3_600_000;

export const MCP_METRIC_COLOR = CHART_PRIMARY_COLOR;

/** Same shell rim as the website hero, one per metric. */
export const MCP_METRIC_CARD_CLASS =
  "min-w-0 rounded-2xl border border-shell-border bg-shell px-0.5 pb-0.5";

export const MCP_METRIC_CHART_SURFACE_CLASS =
  "border-table-card-border bg-table-card shadow-table-card rounded-[14px] border px-3 pt-3 pb-2";

/** Marks the newest server version in the version select. */
export const MCP_LATEST_VERSION_BADGE: StatusBadgeAppearance = {
  variant: "success",
  icon: Rocket01Icon,
};

/** Tags tools that declare an MCP Apps ui:// interface. */
export const MCP_UI_TOOL_BADGE: StatusBadgeAppearance = {
  variant: "info",
  icon: BrowserIcon,
};

/** Header tile of the tool sheet. */
export const MCP_TOOL_SHEET_ICON = Wrench01Icon;
