import { createFileRoute } from "@tanstack/react-router";

import { REPLAY_VERSION } from "@/constants/replay";
import { RUN_LIMIT, RUN_TTL_S } from "@/constants/server";
import { clientKey, guarded, jsonError } from "@/lib/server/request";
import { getStore } from "@/lib/server/store";
import { createRunSchema } from "@/schemas/api";
import type { CreateRunResponse } from "@/types/leaderboard";
import { randomToken } from "@/utils/base64url";

/** Starts a run: the server picks the seed, so a score can only come from playing that seed. */
async function POST(request: Request) {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const body = createRunSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!body.success) {
    return jsonError("Pick a model", 400);
  }
  if (
    !(await store.allow(
      `run:${await clientKey(request)}`,
      RUN_LIMIT.max,
      RUN_LIMIT.windowS
    ))
  ) {
    return jsonError("Too many runs, take a breather", 429);
  }
  const runId = randomToken(16);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  await store.createRun(
    runId,
    {
      seed,
      model: body.data.model,
      version: REPLAY_VERSION,
      createdAt: Date.now(),
    },
    RUN_TTL_S
  );
  const response: CreateRunResponse = { runId, seed };
  return Response.json(response, { headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/runs/")({
  server: {
    handlers: { POST: ({ request }) => guarded(() => POST(request), request) },
  },
});
