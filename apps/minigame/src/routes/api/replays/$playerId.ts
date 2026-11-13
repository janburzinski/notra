import { createFileRoute } from "@tanstack/react-router";

import { REPLAY_CACHE_CONTROL } from "@/constants/server";
import { guarded, jsonError } from "@/lib/server/request";
import { getStore } from "@/lib/server/store";
import { playerIdSchema } from "@/schemas/api";

/**
 * The run behind a player's best score, for anyone to watch. With `?fresh`, a moderator's request,
 * the answer is read now and not cached, so it can't be a best that was replaced a moment ago.
 */
async function GET(playerId: string, fresh: boolean) {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const id = playerIdSchema.safeParse(playerId);
  if (!id.success) {
    return jsonError("Unknown player", 404);
  }
  const replay = await store.getReplay(id.data);
  if (!replay) {
    return jsonError("No replay for this player", 404);
  }
  return Response.json(replay, {
    headers: {
      "Cache-Control": fresh ? "private, no-store" : REPLAY_CACHE_CONTROL,
    },
  });
}

export const Route = createFileRoute("/api/replays/$playerId")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        guarded(() =>
          GET(params.playerId, new URL(request.url).searchParams.has("fresh"))
        ),
    },
  },
});
