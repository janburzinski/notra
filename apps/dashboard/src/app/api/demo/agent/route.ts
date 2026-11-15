import { logWarn } from "@notra/ai/utils/server-log";
import { isDemoMode } from "@notra/utils/demo-mode";
import { getRequestHeaders as headers } from "@tanstack/react-start/server";

import {
  DEMO_AGENT_AUTH_GUIDE as AUTH_GUIDE,
  DEMO_AGENT_BEARER_REGEX as BEARER_REGEX,
  DEMO_SIGNUP_URL,
} from "@/constants/demo";
import { verifyDemoAgentToken } from "@/lib/demo/agent-auth";
import {
  createDemoSandbox,
  ensureDemoApiKey,
  loadDemoSandbox,
  maintainDemoSandboxPool,
} from "@/lib/demo/sandbox";
import type { DemoAgentSandboxResponse } from "@/types/demo";
import { getDemoClientIp, hashDemoClientIp } from "@/utils/demo-ip-hash";
import { ratelimit } from "@/utils/ratelimit";

function unauthorized() {
  return Response.json(
    {
      error: "Send an agent registration access token as the bearer credential",
      recovery: `Register an anonymous agent identity as described in ${AUTH_GUIDE}`,
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer realm="${AUTH_GUIDE}"` },
    }
  );
}

// ponytail: an anonymous agent registration plus IP and per-registration limits replace Turnstile here; add a separate agent cap if agents crowd out humans
export async function POST(request: Request) {
  if (!isDemoMode()) {
    return new Response(null, { status: 404 });
  }

  const token = BEARER_REGEX.exec(
    request.headers.get("Authorization")?.trim() ?? ""
  )?.[1];
  const registrationId = token ? await verifyDemoAgentToken(token) : null;
  if (!registrationId) {
    return unauthorized();
  }

  const ipHash = hashDemoClientIp(getDemoClientIp(await headers()));
  const [ipLimit, agentLimit] = await Promise.all([
    ratelimit.demoSandboxCreate.limit(ipHash),
    ratelimit.demoAgentSandbox.limit(registrationId),
  ]);
  if (!(ipLimit.success && agentLimit.success)) {
    logWarn("[demo] Agent workspace admission rate limited", {
      reason: "rate_limited",
    });
    return Response.json(
      { error: "Too many demo workspaces for this agent or network" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const sandbox = await createDemoSandbox({ timeZone: null, ipHash });
  if (!sandbox) {
    return Response.json(
      { error: "Demo workspace creation is busy. Please try again." },
      { status: 503, headers: { "Retry-After": "3" } }
    );
  }
  maintainDemoSandboxPool();

  const loaded = await loadDemoSandbox(sandbox.anonymousId);
  const row = loaded ? await ensureDemoApiKey(loaded) : null;
  if (!row?.apiKey) {
    return Response.json(
      { error: "Demo workspace has no API key. Please try again." },
      { status: 503, headers: { "Retry-After": "3" } }
    );
  }

  const body: DemoAgentSandboxResponse = {
    organizationId: sandbox.organizationId,
    apiKey: row.apiKey,
    apiBaseUrl:
      process.env.NOTRA_DEMO_API_URL?.trim() || "https://demo-api.usenotra.com",
    expiresAt: row.expiresAt.toISOString(),
    signupUrl: DEMO_SIGNUP_URL,
  };
  return Response.json(body, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
