import { createFileRoute } from "@tanstack/react-router";

import { LEADERBOARD_CACHE_CONTROL } from "@/constants/server";
import { cachedTop } from "@/lib/server/leaderboard-cache";
import { guarded, jsonError } from "@/lib/server/request";
import { getStore } from "@/lib/server/store";
import { leaderboardQuerySchema } from "@/schemas/api";
import type { LeaderboardResponse } from "@/types/leaderboard";

async function GET(request: Request) {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const url = new URL(request.url);
  const query = leaderboardQuerySchema.parse({
    period: url.searchParams.get("period") ?? undefined,
    model: url.searchParams.get("model") ?? undefined,
  });
  const response: LeaderboardResponse = {
    ...query,
    entries: await cachedTop(store, query.period, query.model),
  };
  return Response.json(response, {
    headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL },
  });
}

export const Route = createFileRoute("/api/leaderboard")({
  server: { handlers: { GET: ({ request }) => guarded(() => GET(request)) } },
});
