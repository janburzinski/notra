import { createRoute } from "@hono/zod-openapi";
import { GeoPersonaNotFoundError } from "@notra/geo-core/geo/errors";
import {
  deleteGeoPersona,
  listGeoPersonas,
  loadGeoPersonaActivity,
  loadGeoPersonaResults,
  restoreGeoPersona,
  updateGeoPersona,
} from "@notra/geo-core/geo/personas";
import { geoWindow } from "@notra/geo-core/geo/window";
import type { GeoPersonaEditableDetails } from "@notra/geo-core/types/geo-personas";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  personaParamsSchema,
  projectParamsSchema,
} from "@notra/schemas/api/geo-params";
import {
  archivePersonaResponseSchema,
  generatePersonasRequestSchema,
  listPersonasResponseSchema,
  patchPersonaRequestSchema,
  personaActivityQuerySchema,
  personaActivityResponseSchema,
  personaGenerationResponseSchema,
  personaResponseSchema,
  personaResultsQuerySchema,
  personaResultsResponseSchema,
  runPersonaResponseSchema,
} from "@notra/schemas/api/geo-personas";
import { Effect } from "effect";

import { API_TRIGGER_SOURCE } from "../constants/analytics";
import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { runGeoEffect, runRemoteGeoEffect } from "../runtime/geo";
import {
  GEO_REMOTE_PERSONA_GENERATION,
  GEO_REMOTE_PERSONA_RUN,
} from "../runtime/geo-remote";
import { trackApiEvent } from "../utils/analytics";
import {
  attachGeoOrganization,
  geoOutcomeResponse,
  geoRemoteErrorResponse,
} from "../utils/geo";
import { getInternalWorkflowUrl } from "../utils/internal-workflow";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import { enforceRatelimit, RATE_LIMITS, ratelimit } from "../utils/ratelimit";

export const geoPersonasRoutes = createOpenApiApp();

const PERSONAS_PATH = "/projects/{projectId}/geo/personas";
const PERSONA_PATH = `${PERSONAS_PATH}/{personaId}`;

const listPersonasRoute = createRoute({
  method: "get",
  path: PERSONAS_PATH,
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoPersonas",
  summary: "List GEO personas",
  description:
    "Buyer personas that hold multi-turn conversations with the answer engines, each with its profile, memories and conversation prompts. Archived personas are included with `archivedAt` set.",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Personas fetched successfully",
      content: { "application/json": { schema: listPersonasResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const patchPersonaRoute = createRoute({
  method: "patch",
  path: PERSONA_PATH,
  tags: [GEO_OPENAPI_TAG],
  operationId: "updateGeoPersona",
  summary: "Update a GEO persona",
  description:
    "Turns a persona on or off for scheduled scans, or edits its details. Editing details clears its conversation prompts, so call `POST …/personas/generate` with `personaId` and `promptsOnly: true` before running it again. Archived personas must be restored first.",
  request: {
    params: personaParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: patchPersonaRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Persona updated successfully",
      content: { "application/json": { schema: personaResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const archivePersonaRoute = createRoute({
  method: "delete",
  path: PERSONA_PATH,
  tags: [GEO_OPENAPI_TAG],
  operationId: "archiveGeoPersona",
  summary: "Archive a GEO persona",
  description:
    "Archives and disables the persona. Its past results stay readable, and it can be restored.",
  request: { params: personaParamsSchema },
  responses: {
    200: {
      description: "Persona archived successfully",
      content: { "application/json": { schema: archivePersonaResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const restorePersonaRoute = createRoute({
  method: "post",
  path: `${PERSONA_PATH}/restore`,
  tags: [GEO_OPENAPI_TAG],
  operationId: "restoreGeoPersona",
  summary: "Restore an archived GEO persona",
  description:
    "Restores the persona as disabled. Fails with 400 when the project already has the maximum number of active personas.",
  request: { params: personaParamsSchema },
  responses: {
    200: {
      description: "Persona restored successfully",
      content: { "application/json": { schema: personaResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const personaResultsRoute = createRoute({
  method: "get",
  path: `${PERSONA_PATH}/results`,
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoPersonaResults",
  summary: "Get a GEO persona's conversation results",
  description:
    "Every turn of one scan's persona conversations, per engine: the prompt, the answer, whether the brand was mentioned, its position, and the sources the engine cited. `scans` lists the scans that played this persona, newest first.",
  request: { params: personaParamsSchema, query: personaResultsQuerySchema },
  responses: {
    200: {
      description: "Persona results fetched successfully",
      content: { "application/json": { schema: personaResultsResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const personaActivityRoute = createRoute({
  method: "get",
  path: `${PERSONAS_PATH}/activity`,
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoPersonaActivity",
  summary: "Get GEO persona activity",
  description:
    "Daily checks and mentions per persona and persona version. Defaults to the last 30 days.",
  request: { params: projectParamsSchema, query: personaActivityQuerySchema },
  responses: {
    200: {
      description: "Persona activity fetched successfully",
      content: {
        "application/json": { schema: personaActivityResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const runPersonaRoute = createRoute({
  method: "post",
  path: `${PERSONA_PATH}/run`,
  tags: [GEO_OPENAPI_TAG],
  operationId: "runGeoPersona",
  summary: "Run a GEO persona now",
  description:
    "Plays the persona's conversation now and uses AI credits at twice the rate of a single prompt check. API-based answer engines run synchronously, so the request can stay open for several minutes; `checks`, `mentions` and `engines` report their result. Tracked consumer apps are queued as a background scan named by `queuedScanId`; poll `GET /v1/projects/{projectId}/geo/scans/{scanId}` for that part. Use a client timeout of at least five minutes. After four minutes the API answers 409 while the run finishes on its own; do not retry, read `GET …/personas/{personaId}/results` instead.",
  request: { params: personaParamsSchema },
  responses: {
    200: {
      description:
        "API-based engines finished; a queued consumer-app scan is named by queuedScanId",
      content: { "application/json": { schema: runPersonaResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    409: errorResponse(
      "Persona run is still running after the internal timeout; do not retry the run"
    ),
    429: rateLimitResponse(
      RATE_LIMITS.personaRun.requests,
      RATE_LIMITS.personaRun.window
    ),
  },
});

const generatePersonasRoute = createRoute({
  method: "post",
  path: `${PERSONAS_PATH}/generate`,
  tags: [GEO_OPENAPI_TAG],
  operationId: "generateGeoPersonas",
  summary: "Generate GEO personas",
  description:
    "Starts AI persona generation in the background and uses AI credits. With no body it creates a full set from the project's brand, prompts and competitors; `brief` adds one persona; `personaId` regenerates one in place (with `promptsOnly`, only its conversation prompts). Only one job runs per project: while one is running, this returns that job instead of starting another. Poll `GET /v1/projects/{projectId}/geo/personas/generation` until `status` is `completed` or `failed`, then list the personas.",
  request: {
    params: projectParamsSchema,
    body: {
      required: false,
      content: {
        "application/json": { schema: generatePersonasRequestSchema },
      },
    },
  },
  responses: {
    202: {
      description: "Generation job queued or already running",
      content: {
        "application/json": { schema: personaGenerationResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.personaGenerate.requests,
      RATE_LIMITS.personaGenerate.window
    ),
  },
});

const personaGenerationRoute = createRoute({
  method: "get",
  path: `${PERSONAS_PATH}/generation`,
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoPersonaGeneration",
  summary: "Get the GEO persona generation status",
  description:
    "The project's latest persona generation job. A job that never started within a few minutes is reported as `failed`.",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Generation status fetched successfully",
      content: {
        "application/json": { schema: personaGenerationResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
    429: rateLimitResponse(
      RATE_LIMITS.personaGenerate.requests,
      RATE_LIMITS.personaGenerate.window
    ),
  },
});

geoPersonasRoutes.openapi(listPersonasRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "personasList",
    listGeoPersonas({ organizationId: base.organizationId, projectId })
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPersonasRoutes.openapi(patchPersonaRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, personaId } = c.req.valid("param");
  const { enabled, profile, ...fields } = c.req.valid("json");
  const scope = { organizationId: base.organizationId, projectId };
  const editsDetails =
    profile !== undefined ||
    Object.values(fields).some((value) => value !== undefined);

  const outcome = await runGeoEffect(
    "personaUpdate",
    Effect.gen(function* () {
      let details: GeoPersonaEditableDetails | undefined;
      if (editsDetails) {
        // geo-core replaces details as a whole, so merge the partial patch onto
        // the stored persona first.
        const { personas } = yield* listGeoPersonas(scope);
        const current = personas.find(
          (persona) => persona.id === personaId && !persona.archivedAt
        );
        if (!current) {
          return yield* Effect.fail(new GeoPersonaNotFoundError({ personaId }));
        }
        details = {
          name: fields.name ?? current.name,
          role: fields.role ?? current.role,
          company: fields.company ?? current.company,
          summary: fields.summary ?? current.summary,
          searchStyle: fields.searchStyle ?? current.searchStyle,
          // JSON has no undefined, so omitted lists are absent keys here.
          profile: { ...current.profile, ...profile },
        };
      }
      const persona = yield* updateGeoPersona(scope, {
        personaId,
        enabled,
        details,
      });
      return { persona };
    })
  );
  if (outcome.ok) {
    trackApiEvent(c, {
      event: POSTHOG_EVENTS.GEO_PERSONA_UPDATED,
      organizationId: base.organizationId,
      projectId,
      properties: {
        trigger: API_TRIGGER_SOURCE,
        persona_id: personaId,
        enabled: enabled ?? null,
      },
    });
  }
  return geoOutcomeResponse(c, outcome, 200);
});

geoPersonasRoutes.openapi(archivePersonaRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, personaId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "personaArchive",
    deleteGeoPersona(
      { organizationId: base.organizationId, projectId },
      personaId
    ).pipe(Effect.as({ id: personaId }))
  );
  if (outcome.ok) {
    trackApiEvent(c, {
      event: POSTHOG_EVENTS.GEO_PERSONA_ARCHIVED,
      organizationId: base.organizationId,
      projectId,
      properties: { trigger: API_TRIGGER_SOURCE, persona_id: personaId },
    });
  }
  return geoOutcomeResponse(c, outcome, 200);
});

geoPersonasRoutes.openapi(restorePersonaRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, personaId } = c.req.valid("param");
  const outcome = await runGeoEffect(
    "personaRestore",
    restoreGeoPersona(
      { organizationId: base.organizationId, projectId },
      personaId
    ).pipe(Effect.map((persona) => ({ persona })))
  );
  if (outcome.ok) {
    trackApiEvent(c, {
      event: POSTHOG_EVENTS.GEO_PERSONA_RESTORED,
      organizationId: base.organizationId,
      projectId,
      properties: { trigger: API_TRIGGER_SOURCE, persona_id: personaId },
    });
  }
  return geoOutcomeResponse(c, outcome, 200);
});

geoPersonasRoutes.openapi(personaResultsRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, personaId } = c.req.valid("param");
  const { scanId } = c.req.valid("query");
  const outcome = await runGeoEffect(
    "personaResults",
    loadGeoPersonaResults(
      { organizationId: base.organizationId, projectId },
      personaId,
      scanId
    )
  );
  return geoOutcomeResponse(c, outcome, 200, (value) => ({
    // The stored snapshot carries the persona agent's system prompt, so only
    // its version leaves the API.
    results: value.results.map(({ personaSnapshot, ...result }) => ({
      scanId: result.scanId,
      turn: result.turn,
      engine: result.engine,
      prompt: result.prompt,
      answer: result.answer,
      mentioned: result.mentioned,
      position: result.position,
      sentiment: result.sentiment,
      excerpt: result.excerpt,
      searchQueries: result.searchQueries,
      sources: result.sources,
      snapshotVersion: personaSnapshot?.version ?? null,
      lastCheckedAt: result.lastCheckedAt,
    })),
    scans: value.scans,
    selectedScanId: value.selectedScanId,
  }));
});

geoPersonasRoutes.openapi(personaActivityRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const query = c.req.valid("query");
  const outcome = await runGeoEffect(
    "personaActivity",
    loadGeoPersonaActivity({
      organizationId: base.organizationId,
      projectId,
      ...geoWindow(query),
    })
  );
  return geoOutcomeResponse(c, outcome, 200);
});

geoPersonasRoutes.openapi(runPersonaRoute, async (c) => {
  const base = c.get("geo");
  const { projectId, personaId } = c.req.valid("param");

  const url = getInternalWorkflowUrl(c.env, GEO_REMOTE_PERSONA_RUN.path);
  if (!url) {
    return c.json({ error: GEO_REMOTE_PERSONA_RUN.unavailableMessage }, 503);
  }

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.personaRun,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const outcome = await runRemoteGeoEffect(GEO_REMOTE_PERSONA_RUN, url, {
    organizationId: base.organizationId,
    projectId,
    personaId,
  });
  if (!outcome.ok) {
    return geoRemoteErrorResponse(c, outcome.failure);
  }

  trackApiEvent(c, {
    event: POSTHOG_EVENTS.GEO_PERSONA_RUN,
    organizationId: base.organizationId,
    projectId,
    properties: {
      trigger: API_TRIGGER_SOURCE,
      persona_id: personaId,
      checks: outcome.value.checks,
      mentions: outcome.value.mentions,
      engine_count: outcome.value.engines.length,
    },
  });

  return c.json(attachGeoOrganization(base.organization, outcome.value), 200);
});

geoPersonasRoutes.openapi(generatePersonasRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");
  const body = c.req.valid("json") ?? {};

  const url = getInternalWorkflowUrl(c.env, GEO_REMOTE_PERSONA_GENERATION.path);
  if (!url) {
    return c.json(
      { error: GEO_REMOTE_PERSONA_GENERATION.unavailableMessage },
      503
    );
  }

  const rateLimited = await enforceRatelimit(
    c,
    ratelimit.personaGenerate,
    "organization"
  );
  if (rateLimited) {
    return rateLimited;
  }

  const outcome = await runRemoteGeoEffect(GEO_REMOTE_PERSONA_GENERATION, url, {
    action: "start",
    organizationId: base.organizationId,
    projectId,
    ...body,
  });
  if (!outcome.ok) {
    return geoRemoteErrorResponse(c, outcome.failure);
  }

  trackApiEvent(c, {
    event: POSTHOG_EVENTS.GEO_PERSONAS_GENERATED,
    organizationId: base.organizationId,
    projectId,
    properties: {
      trigger: API_TRIGGER_SOURCE,
      persona_id: body.personaId ?? null,
      has_brief: Boolean(body.brief),
      prompts_only: body.promptsOnly ?? false,
    },
  });

  return c.json(attachGeoOrganization(base.organization, outcome.value), 202);
});

geoPersonasRoutes.openapi(personaGenerationRoute, async (c) => {
  const base = c.get("geo");
  const { projectId } = c.req.valid("param");

  const url = getInternalWorkflowUrl(c.env, GEO_REMOTE_PERSONA_GENERATION.path);
  if (!url) {
    return c.json(
      { error: GEO_REMOTE_PERSONA_GENERATION.unavailableMessage },
      503
    );
  }

  const outcome = await runRemoteGeoEffect(GEO_REMOTE_PERSONA_GENERATION, url, {
    action: "status",
    organizationId: base.organizationId,
    projectId,
  });
  if (!outcome.ok) {
    return geoRemoteErrorResponse(c, outcome.failure);
  }
  return c.json(attachGeoOrganization(base.organization, outcome.value), 200);
});
