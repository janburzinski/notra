import { detectAIBot, negotiateFormat } from "@dualmark/core";
import { classifyUserAgent } from "@usenotra/geo/classify";

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
    detectAIBot(userAgent).isBot ||
    classifyUserAgent(userAgent) !== null ||
    (accept !== "" && negotiateFormat(accept) !== "html")
  );
}
