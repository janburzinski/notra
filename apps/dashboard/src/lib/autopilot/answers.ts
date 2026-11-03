import { db } from "@notra/db/drizzle";
import { geoMentionChecks, geoSettings } from "@notra/db/schema";
import { ingestAllowedHosts } from "@notra/geo-core/utils/geo-project-domains";
import { and, desc, eq, gte, lt } from "drizzle-orm";

import type { AutopilotRunContext } from "@/types/autopilot";
import type { AutopilotAnswerCheck } from "@/types/autopilot-templates-runtime";
import { autopilotBlogSlug } from "@/utils/autopilot-blog";

/**
 * First-turn AI answers the workspace's scans stored since a date, newest
 * first. ChatGPT, Perplexity and AI Mode answers come from the consumer apps
 * through Olostep, with what the engine searched and cited.
 */
export async function loadAnswerChecks(params: {
  projectId: string;
  since: Date;
  /** Exclusive end; omit for up to now. */
  until?: Date;
  limit: number;
}): Promise<AutopilotAnswerCheck[]> {
  const rows = await db
    .select({
      promptId: geoMentionChecks.promptId,
      prompt: geoMentionChecks.prompt,
      engine: geoMentionChecks.engine,
      capturedAt: geoMentionChecks.capturedAt,
      mentioned: geoMentionChecks.mentioned,
      competitors: geoMentionChecks.competitors,
      excerpt: geoMentionChecks.excerpt,
      grounding: geoMentionChecks.grounding,
      sources: geoMentionChecks.sources,
    })
    .from(geoMentionChecks)
    .where(
      and(
        eq(geoMentionChecks.projectId, params.projectId),
        eq(geoMentionChecks.turn, 0),
        gte(geoMentionChecks.capturedAt, params.since),
        params.until ? lt(geoMentionChecks.capturedAt, params.until) : undefined
      )
    )
    .orderBy(desc(geoMentionChecks.capturedAt))
    .limit(params.limit);
  return rows.map((row) => ({
    promptId: row.promptId,
    prompt: row.prompt,
    engine: row.engine,
    capturedAt: row.capturedAt,
    mentioned: row.mentioned,
    competitors: row.competitors,
    excerpt: row.excerpt,
    queries: row.grounding.queries,
    sourceUrls: [
      ...new Set(
        [...row.grounding.sources, ...row.sources].map((source) => source.url)
      ),
    ],
  }));
}

/** The brand's own hosts: its website plus the domains set in GEO settings. */
export async function loadOwnedHosts(ctx: AutopilotRunContext) {
  const settings = ctx.projectId
    ? await db.query.geoSettings.findFirst({
        columns: { domains: true },
        where: eq(geoSettings.projectId, ctx.projectId),
      })
    : null;
  return ingestAllowedHosts(ctx.brand?.websiteUrl, settings?.domains ?? []);
}

/** Competitors the workspace told GEO to ignore, by slug. */
export async function loadIgnoredCompetitors(projectId: string) {
  const settings = await db.query.geoSettings.findFirst({
    columns: { ignoredCompetitors: true },
    where: eq(geoSettings.projectId, projectId),
  });
  return new Set(
    (settings?.ignoredCompetitors ?? []).map((name) => autopilotBlogSlug(name))
  );
}
