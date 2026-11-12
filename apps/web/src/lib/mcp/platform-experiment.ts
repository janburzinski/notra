import { createServerFlagsManager } from "@databuddy/sdk/node";
import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
} from "@tanstack/react-start/server";
import { readRequestConsent } from "c15t/server";
import { z } from "zod";

import {
  MCP_PLATFORM_CONTROL_VARIANT,
  MCP_PLATFORM_VARIANTS,
  MCP_PLATFORM_VISITOR_COOKIE,
} from "@/constants/mcp-platforms";
import type { McpPlatformVariantId } from "@/types/mcp-platforms";

const VISITOR_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
const FLAG_TIMEOUT_MS = 1500;

const databuddyClientId = import.meta.env.NEXT_PUBLIC_DATABUDDY_WEB_WEBSITE_ID;

const flags = createServerFlagsManager({
  clientId: databuddyClientId ?? "",
  disabled: !databuddyClientId,
  autoFetch: false,
  requestTimeoutMs: FLAG_TIMEOUT_MS,
});

function isVariant(value: unknown): value is McpPlatformVariantId {
  return (
    typeof value === "string" && Object.hasOwn(MCP_PLATFORM_VARIANTS, value)
  );
}

function hasMeasurementConsent() {
  const request = getRequest();
  const { state } = readRequestConsent({
    adapter: "@c15t/tanstack-start",
    request: { url: request.url, headers: request.headers },
  });
  return state.initialRecords?.choice?.categories.measurement?.value === true;
}

function getVisitorId() {
  const existing = getCookie(MCP_PLATFORM_VISITOR_COOKIE);
  if (existing) {
    return existing;
  }
  const id = `anon_${crypto.randomUUID()}`;
  setCookie(MCP_PLATFORM_VISITOR_COOKIE, id, {
    maxAge: VISITOR_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  });
  return id;
}

export const getMcpPlatformVariant = createServerFn({ method: "GET" })
  .validator(z.object({ flagKey: z.string() }))
  .handler(async ({ data }): Promise<McpPlatformVariantId> => {
    if (!hasMeasurementConsent()) {
      if (getCookie(MCP_PLATFORM_VISITOR_COOKIE)) {
        deleteCookie(MCP_PLATFORM_VISITOR_COOKIE, { path: "/" });
      }
      return MCP_PLATFORM_CONTROL_VARIANT;
    }
    const result = await flags
      .getFlag(data.flagKey, { userId: getVisitorId() })
      .catch(() => null);
    return isVariant(result?.variant)
      ? result.variant
      : MCP_PLATFORM_CONTROL_VARIANT;
  });
