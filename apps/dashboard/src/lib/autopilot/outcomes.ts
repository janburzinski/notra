import type { AutopilotPostResult } from "@notra/ai/types/autopilot-planner";
import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import type { AutopilotFindingEvidence } from "@notra/db/types/autopilot";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import {
  AUTOPILOT_OUTCOME_MAX_FINDINGS,
  AUTOPILOT_OUTCOME_RECHECK_MS,
} from "@/constants/autopilot-outcome";
import { AUTOPILOT_NEW_POST_KINDS } from "@/constants/autopilot-publish";
import {
  AUTOPILOT_RESULTS_MAX_AGE_MS,
  AUTOPILOT_RESULTS_MIN_AGE_MS,
} from "@/constants/autopilot-results";
import type { AutopilotRunContext } from "@/types/autopilot";

import { loadOwnedHosts } from "./answers";
import { loadPostSite, resolveLiveUrl } from "./live";
import { measurePosts } from "./results";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Measures the workspace's merged new posts and saves each verdict on the
 * finding, so the budget and the refresh job read every post, not only the
 * newest few, and a post that worked once is never forgotten. A worked post
 * is settled; the rest are measured again at most every
 * AUTOPILOT_OUTCOME_RECHECK_MS, least recently measured first.
 */
export async function updatePostOutcomes(
  ctx: AutopilotRunContext,
  now = new Date()
) {
  // Without a GEO project there are no citations, but a Site's assistant
  // visits still tell whether a post worked.
  const repository = ctx.repository;
  if (!repository) {
    return;
  }
  const evidence = autopilotFindings.evidence;
  const findings = await db
    .select()
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, ctx.organizationId),
        sql`lower(${autopilotFindings.repository}) = ${`${repository.owner}/${repository.name}`.toLowerCase()}`,
        eq(autopilotFindings.status, "merged"),
        inArray(autopilotFindings.kind, AUTOPILOT_NEW_POST_KINDS),
        sql`coalesce(jsonb_typeof(${evidence}->'updatePage'), 'null') = 'null'`,
        gte(
          autopilotFindings.mergedAt,
          new Date(now.getTime() - AUTOPILOT_RESULTS_MAX_AGE_MS)
        ),
        lte(
          autopilotFindings.mergedAt,
          new Date(now.getTime() - AUTOPILOT_RESULTS_MIN_AGE_MS)
        ),
        sql`coalesce(${evidence}->'outcome'->>'verdict', '') <> 'worked'`,
        sql`coalesce(${evidence}->>'outcomeCheckedAt', '') < ${new Date(now.getTime() - AUTOPILOT_OUTCOME_RECHECK_MS).toISOString()}`
      )
    )
    .orderBy(
      sql`${evidence}->>'outcomeCheckedAt' asc nulls first`,
      asc(autopilotFindings.mergedAt)
    )
    .limit(AUTOPILOT_OUTCOME_MAX_FINDINGS);
  if (findings.length === 0) {
    return;
  }
  // Claimed first: the planner and the refresh job of one run both ask.
  await db
    .update(autopilotFindings)
    .set({
      evidence: sql`jsonb_set(${evidence}, '{outcomeCheckedAt}', to_jsonb(${now.toISOString()}::text))`,
    })
    .where(
      inArray(
        autopilotFindings.id,
        findings.map((finding) => finding.id)
      )
    );
  // Posts merged before pages were followed have no live URL saved yet, and
  // only a live page can be looked for in the answers.
  const unfollowed = findings.filter(
    (finding) => !finding.evidence.live && finding.evidence.filePath
  );
  if (unfollowed.length > 0) {
    const [site, ownedHosts] = await Promise.all([
      loadPostSite(ctx),
      loadOwnedHosts(ctx),
    ]);
    // Saves the live URL on each finding whose page loads; a few at most.
    await Promise.all(
      unfollowed.map((finding) =>
        resolveLiveUrl({ ctx, finding, site, ownedHosts, now }).catch(
          () => null
        )
      )
    );
  }
  // Visits since the oldest merge cover each page since its own merge: the
  // page did not exist before.
  const oldest = Math.min(
    ...findings.map((finding) => (finding.mergedAt ?? now).getTime())
  );
  const measured = await measurePosts(
    ctx,
    findings,
    now,
    Math.ceil((now.getTime() - oldest) / DAY_MS) + 1
  );
  await Promise.all(
    findings.map((finding) => {
      const outcome = nextOutcome(
        finding.evidence.outcome ?? null,
        measured.get(finding.id),
        now
      );
      if (outcome === undefined) {
        return null;
      }
      return db
        .update(autopilotFindings)
        .set({
          evidence: sql`jsonb_set(${evidence}, '{outcome}', ${JSON.stringify(outcome)}::jsonb)`,
        })
        .where(eq(autopilotFindings.id, finding.id));
    })
  );
}

/**
 * The verdict to save, or undefined to keep the saved one. A miss survives a
 * read that knows nothing new, but not a citation or an assistant visit.
 */
function nextOutcome(
  saved: AutopilotFindingEvidence["outcome"],
  result: AutopilotPostResult | undefined,
  now: Date
): AutopilotFindingEvidence["outcome"] | undefined {
  const verdict = result?.outcome;
  if (verdict === "worked" || verdict === "missed") {
    return saved?.verdict === verdict
      ? undefined
      : { verdict, at: now.toISOString() };
  }
  const active =
    (result?.aiCitations ?? 0) > 0 ||
    (result?.aiAnswerFetches ?? 0) + (result?.aiClicks ?? 0) > 0;
  return saved?.verdict === "missed" && active ? null : undefined;
}

/**
 * Merged new posts whose saved verdict was reached since `since`: the
 * autonomous budget weighs them next to the posts people merged and closed.
 */
export async function countPostOutcomes(organizationId: string, since: Date) {
  const evidence = autopilotFindings.evidence;
  const settledSince = sql`(${evidence}->'outcome'->>'at')::timestamptz >= ${since.toISOString()}::timestamptz`;
  const [row] = await db
    .select({
      worked: sql<number>`count(*) filter (where ${evidence}->'outcome'->>'verdict' = 'worked' and ${settledSince})::int`,
      missed: sql<number>`count(*) filter (where ${evidence}->'outcome'->>'verdict' = 'missed' and ${settledSince})::int`,
    })
    .from(autopilotFindings)
    .where(
      and(
        eq(autopilotFindings.organizationId, organizationId),
        eq(autopilotFindings.status, "merged"),
        inArray(autopilotFindings.kind, AUTOPILOT_NEW_POST_KINDS)
      )
    );
  return { worked: row?.worked ?? 0, missed: row?.missed ?? 0 };
}
