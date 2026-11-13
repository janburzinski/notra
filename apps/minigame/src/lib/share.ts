import { createServerFn } from "@tanstack/react-start";

import { readShareCard } from "@/lib/server/share-card";
import { getStore } from "@/lib/server/store";
import { playerIdSchema } from "@/schemas/api";
import type { SharePreview } from "@/types/leaderboard";
import { modelSpec } from "@/utils/models";

/** The player behind a share link, for its link preview. Null when they have no saved score. */
export const getSharePreview = createServerFn({ method: "GET" })
  .validator(playerIdSchema)
  .handler(async ({ data: playerId }): Promise<SharePreview | null> => {
    const store = getStore();
    const card = store
      ? await readShareCard(store, playerId).catch(() => null)
      : null;
    if (!card) {
      return null;
    }
    return {
      playerId: card.player.id,
      handle: card.player.handle,
      rank: card.all.rank,
      score: card.all.score,
      model: modelSpec(card.all.model).name,
    };
  });
