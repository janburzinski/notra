import { createFileRoute } from "@tanstack/react-router";

import { MAX_RUN_TICKS } from "@/constants/game";
import { guarded, jsonError } from "@/lib/server/request";
import { getStore } from "@/lib/server/store";
import { beatBodySchema } from "@/schemas/api";

/**
 * A heartbeat from a live run: its tick and a fingerprint of the game state. The server stamps it with
 * its own clock; on submit, the replay must hit every fingerprint, and the stamps must show the run was
 * played at normal speed. No sign-in needed, so guests' runs can still be saved after signing in.
 */
async function POST(request: Request, runId: string) {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const body = beatBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success || body.data.tick > MAX_RUN_TICKS) {
    return jsonError("Bad heartbeat", 400);
  }
  const added = await store.addBeat(runId, { ...body.data, at: Date.now() });
  return added
    ? new Response(null, { status: 204 })
    : jsonError("This run is no longer live", 410);
}

export const Route = createFileRoute("/api/beats/$runId")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        guarded(() => POST(request, params.runId), request),
    },
  },
});
