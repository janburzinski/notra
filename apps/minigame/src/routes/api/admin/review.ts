import { createFileRoute } from "@tanstack/react-router";

import { isAdmin } from "@/lib/server/config";
import { guarded, jsonError } from "@/lib/server/request";
import { readSession } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";

/** The players whose new top-10 best still waits for a moderator to watch it. */
async function GET() {
  const viewer = await readSession();
  if (!(viewer && isAdmin(viewer.id))) {
    return jsonError("Not allowed", 403);
  }
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  return Response.json(
    { queue: await store.reviewQueue() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const Route = createFileRoute("/api/admin/review")({
  server: { handlers: { GET: () => guarded(GET) } },
});
