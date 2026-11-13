import { PREFETCH_MAX_AGE_MS } from "@/constants/leaderboard";
import { REPLAY_VERSION } from "@/constants/replay";
import { OFFLINE_MESSAGE } from "@/constants/site";
import type {
  ModerationAction,
  ReviewItem,
  StoredReplay,
} from "@/types/anti-cheat";
import type { ModelId } from "@/types/game";
import type {
  BoardPeriod,
  CompanyBoardResponse,
  CreateRunResponse,
  LeaderboardResponse,
  ModelFilter,
  SubmitResponse,
  ViewerResponse,
} from "@/types/leaderboard";
import type { PrefetchedBoard } from "@/types/ui";
import { fromBase64Url } from "@/utils/base64url";
import { readReplay } from "@/utils/replay";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  // a dropped connection rejects with the browser's own wording ("Failed to fetch", "Load failed")
  const response = await fetch(input, init).catch(() => {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(body?.error ?? "Something went wrong", response.status);
  }
  return (await response.json()) as T;
}

export function createRun(model: ModelId) {
  return call<CreateRunResponse>("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
}

async function gzip(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function submitRun(runId: string, replay: Uint8Array) {
  return call<SubmitResponse>(`/api/runs/${encodeURIComponent(runId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: (await gzip(replay)) as BodyInit,
  });
}

export function fetchLeaderboard(period: BoardPeriod, model: ModelFilter) {
  // the CDN caches the board for a few seconds; the browser should always ask it
  return call<LeaderboardResponse>(
    `/api/leaderboard?period=${period}&model=${model}`,
    { cache: "no-cache" }
  );
}

/** A board fetched before anyone asked for it, so opening the leaderboard shows it right away. */
let prefetched: PrefetchedBoard | null = null;

export function prefetchLeaderboard(period: BoardPeriod, model: ModelFilter) {
  const entry: PrefetchedBoard = {
    key: `${period}:${model}`,
    at: Date.now(),
    data: null,
    promise: fetchLeaderboard(period, model),
  };
  prefetched = entry;
  entry.promise
    .then((data) => {
      entry.data = data;
    })
    .catch(() => {
      if (prefetched === entry) {
        prefetched = null;
      }
    });
}

/** The prefetched board if it's for this view and still fresh; each one is handed out once. */
export function takePrefetchedLeaderboard(
  period: BoardPeriod,
  model: ModelFilter
) {
  const entry = prefetched;
  prefetched = null;
  if (
    !entry ||
    entry.key !== `${period}:${model}` ||
    Date.now() - entry.at > PREFETCH_MAX_AGE_MS
  ) {
    return null;
  }
  return entry;
}

export function fetchCompanies() {
  return call<CompanyBoardResponse>("/api/companies", { cache: "no-cache" });
}

export function fetchViewer() {
  return call<ViewerResponse>("/api/me", { cache: "no-store" });
}

export async function deleteMyScores() {
  const response = await fetch("/api/me", { method: "DELETE" });
  if (!response.ok) {
    throw new ApiError("Could not delete your scores", response.status);
  }
}

/** Fire-and-forget heartbeat; `keepalive` lets it finish even if the page is closing. */
export function sendBeat(runId: string, tick: number, hash: number) {
  fetch(`/api/beats/${encodeURIComponent(runId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tick, hash }),
    keepalive: true,
  }).catch(() => undefined);
}

/** A player's best run, ready to play back: the seed, the model and one input per tick. */
export async function fetchReplay(playerId: string) {
  const stored = await call<StoredReplay>(
    `/api/replays/${encodeURIComponent(playerId)}`
  );
  if (stored.version !== REPLAY_VERSION) {
    throw new ApiError("That run was set on an older version of the game", 409);
  }
  const stream = new Blob([fromBase64Url(stored.replay) as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const ticks = readReplay(
    new Uint8Array(await new Response(stream).arrayBuffer())
  );
  if (!ticks) {
    throw new ApiError("That replay could not be read", 422);
  }
  return { seed: stored.seed, model: stored.model, score: stored.score, ticks };
}

/** Approves a reviewed best, or removes and bans the player. Moderators only. */
export async function moderate(playerId: string, action: ModerationAction) {
  const response = await fetch("/api/admin/moderate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, action }),
  });
  if (!response.ok) {
    throw new ApiError("Could not moderate that player", response.status);
  }
}

/** Players whose new top-10 best waits for review. Moderators only. */
export async function fetchReviewQueue() {
  const body = await call<{ queue: Record<string, ReviewItem> }>(
    "/api/admin/review",
    { cache: "no-store" }
  );
  return new Set(Object.keys(body.queue));
}
