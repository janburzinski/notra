import { publicAiTrafficSnapshotSchema } from "@notra/schemas/api/public-ai-traffic";
import type { PublicAiTrafficSnapshot } from "@notra/schemas/types/api/public-ai-traffic";

import {
  DATA_SNAPSHOT_MEMORY_TTL_MS,
  DATA_SNAPSHOT_PATH,
  DATA_SNAPSHOT_RETRY_MS,
  DATA_SNAPSHOT_TIMEOUT_MS,
} from "@/constants/data";
import { APP_URL } from "@/utils/urls";

let cached: { snapshot: PublicAiTrafficSnapshot; fetchedAt: number } | null =
  null;
let inflight: Promise<PublicAiTrafficSnapshot | null> | null = null;

async function fetchSnapshot(): Promise<PublicAiTrafficSnapshot | null> {
  const origin = process.env.NOTRA_DASHBOARD_URL ?? APP_URL;
  try {
    const response = await fetch(new URL(DATA_SNAPSHOT_PATH, origin), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(DATA_SNAPSHOT_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`AI traffic data request failed: ${response.status}`);
      return null;
    }
    const parsed = publicAiTrafficSnapshotSchema.safeParse(
      await response.json()
    );
    if (!parsed.success) {
      console.error("AI traffic data had an unexpected shape", parsed.error);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error("AI traffic data request failed", error);
    return null;
  }
}

/**
 * The dashboard's daily AI traffic snapshot. A failed fetch keeps serving
 * the last good snapshot, so the page never goes blank over a blip.
 */
export function loadDataSnapshot(): Promise<PublicAiTrafficSnapshot | null> {
  if (cached && Date.now() - cached.fetchedAt < DATA_SNAPSHOT_MEMORY_TTL_MS) {
    return Promise.resolve(cached.snapshot);
  }
  inflight ??= fetchSnapshot()
    .then((snapshot) => {
      if (snapshot) {
        cached = { snapshot, fetchedAt: Date.now() };
      } else if (cached) {
        // Keep serving the last good snapshot and retry after a short delay,
        // so a hanging dashboard doesn't hold every render for the timeout.
        cached = {
          snapshot: cached.snapshot,
          fetchedAt:
            Date.now() - DATA_SNAPSHOT_MEMORY_TTL_MS + DATA_SNAPSHOT_RETRY_MS,
        };
      }
      return snapshot ?? cached?.snapshot ?? null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
