import { logError } from "@notra/ai/utils/server-log";
import { toGeoFailureWire } from "@notra/geo-core/geo/failure-wire";
import { runGeoPersonaNow } from "@notra/geo-core/geo/persona-scan";
import { geoPersonaRunInputSchema } from "@notra/geo-core/schemas/geo-personas";
import { Effect } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";
import { ratelimit } from "@/utils/ratelimit";

const GEO_FAILURE_STATUS = 422;

/**
 * Runs one GEO persona conversation on behalf of the public API.
 *
 * Like `sequence-run`, the run calls answer engines and gates billing through
 * `"use step"` capabilities that only exist in the dashboard, so the API hands
 * the work here and maps the returned failure tag with its own mapper.
 */
export async function POST(request: Request) {
  const authorized = await verifyInternalWorkflowRequest(request);
  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = geoPersonaRunInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { success, limit, remaining, reset } =
    await ratelimit.geoPersonaRun.limit(parsed.data.organizationId);
  if (!success) {
    return Response.json(
      { error: "Too many requests", limit, remaining, reset },
      { status: 429 }
    );
  }

  const outcome = await Effect.runPromise(
    Effect.result(
      runGeoPersonaNow(parsed.data, parsed.data.personaId).pipe(
        Effect.provide(geoCoreDashboardLayer)
      )
    )
  );

  if (outcome._tag === "Failure") {
    logError("[GEO] Internal persona run failed", outcome.failure);
    return Response.json(
      { failure: toGeoFailureWire(outcome.failure) },
      { status: GEO_FAILURE_STATUS }
    );
  }

  return Response.json(outcome.success, { status: 200 });
}
