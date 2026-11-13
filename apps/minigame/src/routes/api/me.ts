import { createFileRoute } from "@tanstack/react-router";

import { isAdmin } from "@/lib/server/config";
import { forgetTop } from "@/lib/server/leaderboard-cache";
import { guarded, jsonError } from "@/lib/server/request";
import { endSession, readSession } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import type { ViewerResponse } from "@/types/leaderboard";

async function GET() {
  const player = await readSession();
  const store = getStore();
  const [all, week] =
    player && store
      ? await Promise.all([
          store.standing("all", player.id),
          store.standing("week", player.id),
        ])
      : [null, null];
  const response: ViewerResponse = {
    player,
    standing: { all, week },
    admin: player ? isAdmin(player.id) : false,
  };
  return Response.json(response, { headers: { "Cache-Control": "no-store" } });
}

/** Removes the player from every board and forgets their X profile, then signs them out. */
async function DELETE() {
  const player = await readSession();
  if (!player) {
    return jsonError("You're not signed in", 401);
  }
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  await store.deletePlayer(player.id);
  forgetTop();
  endSession();
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: () => guarded(GET),
      DELETE: ({ request }) => guarded(DELETE, request),
    },
  },
});
