import { createFileRoute } from "@tanstack/react-router";

import { LEADERBOARD_CACHE_CONTROL } from "@/constants/server";
import { cachedCompanies } from "@/lib/server/leaderboard-cache";
import { guarded, jsonError } from "@/lib/server/request";
import { getStore } from "@/lib/server/store";
import type { CompanyBoardResponse } from "@/types/leaderboard";

/** Companies by the all-time bests of their top pilots, for players with an X affiliation badge. */
async function GET() {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const response: CompanyBoardResponse = {
    entries: await cachedCompanies(store),
  };
  return Response.json(response, {
    headers: { "Cache-Control": LEADERBOARD_CACHE_CONTROL },
  });
}

export const Route = createFileRoute("/api/companies")({
  server: { handlers: { GET: () => guarded(GET) } },
});
