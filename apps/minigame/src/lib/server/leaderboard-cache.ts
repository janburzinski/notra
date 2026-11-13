import { LEADERBOARD_MEMO_S } from "@/constants/server";
import type { GameStore } from "@/lib/server/store";
import type {
  BoardPeriod,
  CompanyEntry,
  LeaderboardEntry,
  ModelFilter,
} from "@/types/leaderboard";

const memo = new Map<
  string,
  { expires: number; value: Promise<LeaderboardEntry[] | CompanyEntry[]> }
>();

/**
 * A board, shared for a few seconds inside one server instance. The CDN caches the API response too;
 * this covers the misses, so a burst of them costs one Redis read instead of many. Concurrent callers
 * share the same pending read.
 */
function remember<T extends LeaderboardEntry[] | CompanyEntry[]>(
  key: string,
  read: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && hit.expires > now) {
    return hit.value as Promise<T>;
  }
  const value = read();
  memo.set(key, { expires: now + LEADERBOARD_MEMO_S * 1000, value });
  // a failed read must not stay cached
  value.catch(() => memo.delete(key));
  return value;
}

export function cachedTop(
  store: GameStore,
  period: BoardPeriod,
  model: ModelFilter
) {
  return remember(`${period}:${model}`, () => store.top(period, model));
}

export function cachedCompanies(store: GameStore) {
  return remember("companies", () => store.companies());
}

/** Drops this instance's copies after a score or a deletion, so its next answer is fresh. */
export function forgetTop() {
  memo.clear();
}
