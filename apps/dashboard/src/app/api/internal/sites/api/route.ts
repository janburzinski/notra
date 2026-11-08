import { logError } from "@notra/ai/utils/server-log";
import { internalSiteApiRequestSchema } from "@notra/schemas/api/sites";
import { isSitesConfigured } from "@notra/sites-server/env";
import { isDemoMode } from "@notra/utils/demo-mode";
import { ORPCError } from "@orpc/server";

import { toSitesOrpcError } from "@/lib/sites/orpc-errors";
import { runSiteApiAction } from "@/lib/sites/public-api";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Sites operations for the public API (`/v1/sites`).
 *
 * The API has already authenticated the caller, checked the `sites` scope and
 * resolved the workspace, so this route only scopes every read and write to
 * `organizationId`. Owner/admin actions (settings, domains, rollback, delete)
 * are deliberately absent: API credentials carry scopes, not workspace roles.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = internalSiteApiRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (isDemoMode()) {
    return Response.json(
      { error: "Notra Sites is not available in demo mode" },
      { status: 403 }
    );
  }
  if (!isSitesConfigured()) {
    return Response.json(
      { error: "Notra Sites is not configured on this environment" },
      { status: 503 }
    );
  }

  const input = parsed.data;
  try {
    return Response.json(await runSiteApiAction(input));
  } catch (error) {
    const mapped = toSitesOrpcError(error);
    if (mapped instanceof ORPCError && mapped.status < 500) {
      return Response.json(
        { error: mapped.message },
        { status: mapped.status }
      );
    }
    logError("Sites API action failed", error, {
      organizationId: input.organizationId,
      action: input.action,
    });
    return Response.json({ error: "Sites request failed" }, { status: 502 });
  }
}
