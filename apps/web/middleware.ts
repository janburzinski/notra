import { Tracker } from "@usenotra/geo";
import { waitUntil } from "@vercel/functions";
import { rewrite } from "@vercel/functions/middleware";

import { AGENT_BYPASS_PARAM, GEO_INGEST_ENDPOINT } from "./src/constants/proxy";
import { isAgentRequest, isProxiedPath } from "./src/utils/proxy-paths";

const geoTracker = new Tracker({
  token: process.env.NOTRA_GEO_TOKEN ?? "",
  endpoint: GEO_INGEST_ENDPOINT,
});

export const config = {
  matcher: [
    "/((?!assets/|_serverFn/|api/|docs$|docs/|blog/_notra/|\\.well-known/oauth-authorization-server$|\\.well-known/openid-configuration$).*)",
  ],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  if (!isProxiedPath(url.pathname)) {
    return;
  }

  waitUntil(geoTracker.track(request));

  if (url.searchParams.has(AGENT_BYPASS_PARAM) || !isAgentRequest(request)) {
    return;
  }
  url.searchParams.set(AGENT_BYPASS_PARAM, "1");
  return rewrite(url);
}
