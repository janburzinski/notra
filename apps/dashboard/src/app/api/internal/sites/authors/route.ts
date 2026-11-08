import { logError } from "@notra/ai/utils/server-log";
import { internalSitesRequestSchema } from "@notra/schemas/api/sites";
import { isSitesConfigured } from "@notra/sites-server/env";
import { isDemoMode } from "@notra/utils/demo-mode";
import { ORPCError } from "@orpc/server";

import { toSitesOrpcError } from "@/lib/sites/orpc-errors";
import { handleSiteAuthorApiRequest } from "@/lib/sites/site-authors-api";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";

/**
 * Sites authors for the public API. Reading and writing blog.json needs the
 * GitHub App and the drafts the Design tab edits, which only the dashboard
 * has, so the API forwards its already authorized requests here.
 */
export async function POST(request: Request) {
  if (!(await verifyInternalWorkflowRequest(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = internalSitesRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const input = parsed.data;
  if (!isSitesConfigured() || isDemoMode()) {
    if (input.action === "postAuthors" || input.action === "listSites") {
      return Response.json(
        input.action === "postAuthors"
          ? { posts: [], sites: [] }
          : { sites: [] }
      );
    }
    return Response.json(
      { error: "Notra Sites is not available on this environment" },
      { status: 503 }
    );
  }
  try {
    return Response.json(await handleSiteAuthorApiRequest(input));
  } catch (error) {
    const mapped = toSitesOrpcError(error);
    if (mapped instanceof ORPCError && mapped.status < 500) {
      const data = (mapped.data ?? {}) as { code?: unknown };
      return Response.json(
        {
          error: mapped.message,
          ...(typeof data.code === "string" ? { code: data.code } : {}),
        },
        { status: mapped.status }
      );
    }
    logError("Sites authors API request failed", error, {
      action: input.action,
      organizationId: input.organizationId,
    });
    return Response.json(
      { error: "Couldn't reach the site's repository. Try again." },
      { status: mapped instanceof ORPCError ? mapped.status : 502 }
    );
  }
}
