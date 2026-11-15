import { isDemoMode } from "@notra/utils/demo-mode";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import {
  AGENT_CLAIM_PATH,
  AGENT_CLAIM_TOKEN_PARAMS,
} from "@/constants/agent-registration";
import type { AgentClaimPageData } from "@/types/agent-registration";
import type { UiRouteInput } from "@/types/ui-route";

export const loadAgentClaim = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { searchParams } }): Promise<AgentClaimPageData> => {
    if (isDemoMode()) {
      throw notFound();
    }
    const claim = AGENT_CLAIM_TOKEN_PARAMS.map((param) => ({
      param,
      token: searchParams[param],
    })).find(({ token }) => typeof token === "string" && token.length > 0);
    if (!(claim && typeof claim.token === "string")) {
      return { status: "unavailable", reason: "missing" };
    }
    const { param, token } = claim;

    const { getAuthSession } = await import("@/lib/auth/server");
    const session = await getAuthSession();
    if (!session) {
      const returnTo = `${AGENT_CLAIM_PATH}?${param}=${encodeURIComponent(token)}`;
      throw redirect({
        href: `/login?returnTo=${encodeURIComponent(returnTo)}`,
      });
    }

    const { linkAgentClaim } = await import("@/lib/agent-registration/claim");
    return linkAgentClaim(token, session.user);
  });
