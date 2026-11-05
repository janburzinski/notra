import { logError } from "@notra/ai/utils/server-log";
import { toGeoFailureWire } from "@notra/geo-core/geo/failure-wire";
import { requireGeoPersonaGenerationCapacity } from "@notra/geo-core/geo/personas";
import { Effect } from "effect";

import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import {
  getPersonaGeneration,
  startPersonaGeneration,
} from "@/lib/geo/persona-generation";
import { verifyInternalWorkflowRequest } from "@/lib/workflows/internal-auth";
import { internalPersonaGenerationInputSchema } from "@/schemas/persona-generation";
import type { PersonaGenerationJob } from "@/types/persona-generation";
import { ratelimit } from "@/utils/ratelimit";

const GEO_FAILURE_STATUS = 422;

function toJobBody(job: PersonaGenerationJob | null) {
  return {
    job: job
      ? {
          id: job.id,
          status: job.status,
          personaId: job.personaId ?? null,
          startedAt: job.startedAt,
          error: job.error,
        }
      : null,
  };
}

/**
 * Starts or reads persona generation on behalf of the public API.
 *
 * Generation runs as a dashboard workflow and its job state is reconciled
 * against the workflow runtime, neither of which the API process has.
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

  const parsed = internalPersonaGenerationInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.action === "status") {
    const job = await getPersonaGeneration(
      input.organizationId,
      input.projectId
    );
    return Response.json(toJobBody(job), { status: 200 });
  }

  const capacity = await Effect.runPromise(
    Effect.result(
      requireGeoPersonaGenerationCapacity(
        input,
        input.personaId,
        input.brief
      ).pipe(Effect.provide(geoCoreDashboardLayer))
    )
  );
  if (capacity._tag === "Failure") {
    if (capacity.failure._tag !== "GeoPersonaLimitError") {
      logError("[GEO] Internal persona generation refused", capacity.failure);
    }
    return Response.json(
      { failure: toGeoFailureWire(capacity.failure) },
      { status: GEO_FAILURE_STATUS }
    );
  }

  const { success, limit, remaining, reset } =
    await ratelimit.geoPersonasGenerate.limit(input.organizationId);
  if (!success) {
    return Response.json(
      { error: "Too many requests", limit, remaining, reset },
      { status: 429 }
    );
  }

  const job = await startPersonaGeneration(
    capacity.success.organizationId,
    capacity.success.projectId,
    input.personaId,
    input.brief,
    input.promptsOnly
  );
  return Response.json(toJobBody(job), { status: 200 });
}
