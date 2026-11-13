import { createFileRoute } from "@tanstack/react-router";

import { CARD_CACHE_CONTROL } from "@/constants/share-card";
import { guarded, jsonError } from "@/lib/server/request";
import { readShareCard, renderShareCard } from "@/lib/server/share-card";
import { getStore } from "@/lib/server/store";

/** A player's spot on the board as a PNG, for link previews and for saving. */
async function GET(playerId: string) {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const card = await readShareCard(store, playerId);
  if (!card) {
    return jsonError("This player has no score yet", 404);
  }
  return new Response(renderShareCard(card), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": CARD_CACHE_CONTROL,
    },
  });
}

export const Route = createFileRoute("/api/card/$playerId")({
  server: {
    handlers: { GET: ({ params }) => guarded(() => GET(params.playerId)) },
  },
});
