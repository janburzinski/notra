import { GAME_TITLE, SITE_URL } from "@/constants/site";
import type { SharePreview, Standing } from "@/types/leaderboard";
import { formatScore } from "@/utils/format";
import { modelSpec } from "@/utils/models";

/**
 * Share links carry the score, so a new best is a new URL and X fetches a fresh preview instead of
 * the one it cached for the old score.
 */
export function shareLink(playerId: string, best: Standing) {
  return `${SITE_URL}/s/${encodeURIComponent(playerId)}?v=${best.score}`;
}

/** The card behind a share link, as a path on whatever host serves the page. */
export function cardPath(playerId: string, score: number) {
  return `/api/card/${encodeURIComponent(playerId)}?v=${score}`;
}

export function shareText(best: Standing) {
  return `I'm #${formatScore(best.rank)} on the ${GAME_TITLE} leaderboard with ${formatScore(best.score)} points, flying ${modelSpec(best.model).name}. Can you beat me?`;
}

export function previewTitle(preview: SharePreview) {
  return `@${preview.handle} is #${formatScore(preview.rank)} in ${GAME_TITLE}`;
}
