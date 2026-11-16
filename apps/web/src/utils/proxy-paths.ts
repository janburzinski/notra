import { detectAgent, negotiateFormat } from "@usenotra/agentside";
import { classifyUserAgent } from "@usenotra/sdk/classify";

import { PROXY_EXCLUDED_PATH_PREFIXES } from "../constants/proxy";

export function isProxiedPath(pathname: string) {
  if (pathname === "/api" || pathname === "/favicon.ico") {
    return false;
  }
  return !PROXY_EXCLUDED_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export function isAgentRequest(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const accept = request.headers.get("accept") ?? "";
  return (
    detectAgent(userAgent) !== null ||
    classifyUserAgent(userAgent) !== null ||
    negotiateFormat(accept, "contains") !== "html"
  );
}
