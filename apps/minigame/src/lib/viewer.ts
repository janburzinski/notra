import { createServerFn } from "@tanstack/react-start";

import { isAdmin } from "@/lib/server/config";
import { readSession } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import type { ViewerResponse } from "@/types/leaderboard";

/** The signed-in player and their standing, read during SSR so the menu renders without a flash. */
export const getViewer = createServerFn({ method: "GET" }).handler(
  async (): Promise<ViewerResponse> => {
    const player = await readSession();
    const store = getStore();
    if (!(player && store)) {
      return { player, standing: { all: null, week: null }, admin: false };
    }
    const [all, week] = await Promise.all([
      store.standing("all", player.id).catch(() => null),
      store.standing("week", player.id).catch(() => null),
    ]);
    return { player, standing: { all, week }, admin: isAdmin(player.id) };
  }
);
