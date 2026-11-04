"use client";

import { parseAsString, useQueryState } from "nuqs";

import { MCP_VERSION_PARAM } from "@/constants/mcp-analytics";

/** MCP server version the analytics are filtered to, empty for every version. */
export function useMcpVersionQuery() {
  return useQueryState(
    MCP_VERSION_PARAM,
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );
}
