import type {
  GeoPromptFindOutcome,
  GeoPromptFinderInput,
  GeoPromptScanOutcome,
  GeoPromptScanStarterInput,
} from "@notra/ai/types/geo-prompt-scan";
import { listGeoPrompts } from "@notra/geo-core/geo/programs";
import { createLimiter } from "@notra/utils/ratelimit";
import { Effect } from "effect";

import { startAutopilotPromptScan } from "@/lib/autopilot/workflows/scan-prompt";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import {
  findGeoScanPrompts,
  matchGeoScanPrompt,
} from "@/utils/geo-prompt-scan";

const FAILURE_STATUS = { halt: 409, fail: 400, retry: 503 } as const;

// Not in `@/utils/ratelimit`, which reads request headers through TanStack
// Start: the chat's workflow step bundles this file and can't resolve that.
const agentPromptScanLimiter = createLimiter({
  prefix: "ratelimit:geo-agent-prompt-scan",
  requests: 20,
  window: "10m",
});

function failed(error: string, httpStatus: number) {
  const outcome: GeoPromptScanOutcome = { status: "error", error };
  return { outcome, httpStatus };
}

async function loadPrompts(organizationId: string, projectId?: string) {
  const listed = await Effect.runPromise(
    Effect.result(
      listGeoPrompts({ organizationId, projectId }).pipe(
        Effect.provide(geoCoreDashboardLayer)
      )
    )
  );
  if (listed._tag === "Success") {
    return { ok: true as const, prompts: listed.success.prompts };
  }
  return listed.failure._tag === "GeoProjectNotFoundError"
    ? {
        ok: false as const,
        error: "That project doesn't exist in this workspace.",
        httpStatus: 404,
      }
    : {
        ok: false as const,
        error: "The project's prompts couldn't be loaded.",
        httpStatus: 503,
      };
}

/** The enabled tracked prompts a query points at, read-only. */
export async function findGeoPromptsForAgent(
  input: GeoPromptFinderInput
): Promise<{ outcome: GeoPromptFindOutcome; httpStatus: number }> {
  const listed = await loadPrompts(input.organizationId, input.projectId);
  if (!listed.ok) {
    return {
      outcome: { status: "error", error: listed.error },
      httpStatus: listed.httpStatus,
    };
  }
  return {
    outcome: findGeoScanPrompts(listed.prompts, input.query),
    httpStatus: 200,
  };
}

/** The chat's `findGeoPrompts` dependency. */
export async function findGeoPromptsForChat(
  input: GeoPromptFinderInput
): Promise<GeoPromptFindOutcome> {
  return (await findGeoPromptsForAgent(input)).outcome;
}

/**
 * Starts the tracked prompt an agent names, by id or wording, on the given
 * engines. Several or no matches come back as prompts to choose from instead
 * of a scan. Shared by the dashboard chat and Notra's agent in Slack, which
 * reaches it through `/api/internal/geo/prompt-scan`.
 */
export async function startGeoPromptScanForAgent(
  input: GeoPromptScanStarterInput
): Promise<{ outcome: GeoPromptScanOutcome; httpStatus: number }> {
  const { organizationId, projectId, prompt, engines } = input;
  const limit = await agentPromptScanLimiter.limit(organizationId);
  if (!limit.success) {
    return failed("Too many prompt scans. Try again in a few minutes.", 429);
  }

  const listed = await loadPrompts(organizationId, projectId);
  if (!listed.ok) {
    return failed(listed.error, listed.httpStatus);
  }

  const match = matchGeoScanPrompt(listed.prompts, prompt);
  if (match.status !== "match") {
    return { outcome: match, httpStatus: 200 };
  }

  const started = await startAutopilotPromptScan({
    organizationId,
    projectId,
    promptId: match.prompt.id,
    engines,
  });
  if (!started.ok) {
    return failed(started.reason, FAILURE_STATUS[started.outcome]);
  }
  return {
    outcome: {
      status: "started",
      scanId: started.scanId,
      promptId: match.prompt.id,
      prompt: started.prompt,
    },
    httpStatus: 200,
  };
}

/** The chat's `startGeoPromptScan` dependency. */
export async function startGeoPromptScanForChat(
  input: GeoPromptScanStarterInput
): Promise<GeoPromptScanOutcome> {
  return (await startGeoPromptScanForAgent(input)).outcome;
}
