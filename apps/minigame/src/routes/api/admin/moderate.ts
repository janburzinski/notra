import { createFileRoute } from "@tanstack/react-router";

import { isAdmin } from "@/lib/server/config";
import { forgetTop } from "@/lib/server/leaderboard-cache";
import { guarded, jsonError } from "@/lib/server/request";
import { readSession } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import { moderationSchema } from "@/schemas/api";

/**
 * A moderator's call on a player. `approve` takes them off the review list if their best is still the
 * run the moderator watched (by seed), so a newer best stays flagged; `ban` removes their
 * scores, profile and replay from every board and stops them posting again. Only for the X accounts in
 * MINIGAME_ADMIN_IDS.
 */
async function POST(request: Request) {
  const viewer = await readSession();
  if (!(viewer && isAdmin(viewer.id))) {
    return jsonError("Not allowed", 403);
  }
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const body = moderationSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!body.success) {
    return jsonError("Bad request", 400);
  }
  const { playerId, action } = body.data;
  if (action === "approve") {
    if (!(await store.clearReview(playerId, body.data.seed))) {
      return jsonError("That run is no longer their best", 409);
    }
  } else {
    await store.ban(playerId);
    await store.deletePlayer(playerId);
    forgetTop();
  }
  console.warn("[minigame] moderated player", {
    by: viewer.id,
    player: playerId,
    action,
  });
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/api/admin/moderate")({
  server: {
    handlers: { POST: ({ request }) => guarded(() => POST(request), request) },
  },
});
