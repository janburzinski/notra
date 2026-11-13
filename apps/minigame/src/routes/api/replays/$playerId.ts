import { createFileRoute } from "@tanstack/react-router";

import { REPLAY_CACHE_CONTROL } from "@/constants/server";
import { guarded, jsonError } from "@/lib/server/request";
import { getStore } from "@/lib/server/store";
import { playerIdSchema } from "@/schemas/api";

/** The run behind a player's best score, for anyone to watch. */
async function GET(playerId: string) {
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
    headers: { "Cache-Control": REPLAY_CACHE_CONTROL },
  });
}

export const Route = createFileRoute("/api/replays/$playerId")({
  server: {
    handlers: { GET: ({ params }) => guarded(() => GET(params.playerId)) },
  },
});
