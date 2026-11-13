import { createFileRoute } from "@tanstack/react-router";

import { REVIEW_TOP_RANK } from "@/constants/anti-cheat";
import { REPLAY_VERSION } from "@/constants/replay";
import { SUBMIT_LIMIT } from "@/constants/server";
import { verifyRun } from "@/lib/game/verify-run";
import { forgetTop } from "@/lib/server/leaderboard-cache";
import { guarded, jsonError, readReplayBody } from "@/lib/server/request";
import { readSession } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import type { SubmitResponse } from "@/types/leaderboard";
import { toBase64Url } from "@/utils/base64url";
import { readReplay } from "@/utils/replay";

/**
 * Saves a finished run. The client sends only its inputs. The server replays them from the run's seed,
 * checks them against the heartbeats it received while the run was live (see verifyRun) and records
 * whatever score that produces, so neither an edited score nor a doctored or slowed-down run gets on
 * the board. The best run of each player is kept, so anyone can watch how it was done.
 */
async function POST(request: Request, runId: string) {
  const store = getStore();
  if (!store) {
    return jsonError("Scores are offline right now", 503);
  }
  const player = await readSession();
  if (!player) {
    return jsonError("Sign in with X to save your score", 401);
  }
  if (await store.isBanned(player.id)) {
    return jsonError("This account can't post scores", 403);
  }
  if (
    !(await store.allow(
      `submit:${player.id}`,
      SUBMIT_LIMIT.max,
      SUBMIT_LIMIT.windowS
    ))
  ) {
    return jsonError("Too many scores, try again later", 429);
  }
  const body = await readReplayBody(request);
  if (!body) {
    return jsonError("That replay could not be read", 400);
  }
  const taken = await store.takeRun(runId);
  if (!taken) {
    return jsonError("This run expired or was already saved", 410);
  }
  const { run, beats } = taken;
  if (run.version !== REPLAY_VERSION || body.bytes[0] !== REPLAY_VERSION) {
    return jsonError(
      "The game was updated during your run. Reload to play the new version.",
      409
    );
  }
  const ticks = readReplay(body.bytes);
  if (!ticks) {
    return jsonError("That replay could not be read", 400);
  }
  const verdict = verifyRun({
    seed: run.seed,
    model: run.model,
    createdAt: run.createdAt,
    ticks,
    beats,
  });
  if (!verdict.ok) {
    console.warn("[minigame] rejected run", {
      player: player.id,
      runId,
      reason: verdict.reason,
      ticks: ticks.length,
      beats: beats.length,
    });
    return jsonError(`Score not saved: ${verdict.reason.toLowerCase()}`, 422);
  }
  const { result } = verdict;
  // the ban is checked again inside submit, so a ban during the upload still wins
  const outcome =
    result.score > 0
      ? await store.submit(
          player,
          {
            score: result.score,
            wave: result.wave,
            kills: result.kills,
            model: result.model,
            at: Date.now(),
          },
          {
            seed: run.seed,
            model: run.model,
            version: run.version,
            score: result.score,
            replay: toBase64Url(body.compressed),
          }
        )
      : "kept";
  if (outcome === "banned") {
    return jsonError("This account can't post scores", 403);
  }
  const improved = outcome === "improved";
  if (improved) {
    forgetTop();
  }
  const [all, week] = await Promise.all([
    store.standing("all", player.id),
    store.standing("week", player.id),
  ]);
  // A real-time bot passes every check above, so a person looks at whatever reaches the top:
  // each new best in the all-time top ten goes on the moderators' review list.
  if (improved && all && all.rank <= REVIEW_TOP_RANK) {
    await store.flagForReview(player.id, {
      score: result.score,
      rank: all.rank,
      at: Date.now(),
    });
  }
  const response: SubmitResponse = {
    score: result.score,
    wave: result.wave,
    kills: result.kills,
    bosses: result.bosses,
    model: result.model,
    improved,
    standing: { all, week },
  };
  return Response.json(response, { headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/runs/$runId")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        guarded(() => POST(request, params.runId), request),
    },
  },
});
