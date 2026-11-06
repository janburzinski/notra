import {
  isTinybirdConfigured,
  queryGeoTrafficOverview,
  queryGeoTrafficPagesByPaths,
  queryGeoTrafficTimeseries,
} from "@notra/analytics/tinybird/client";
import { db } from "@notra/db/drizzle";
import {
  contentPublications,
  posts,
  siteDeployments,
  sites,
} from "@notra/db/schema";
import {
  siteEntryPagePath,
  siteEntryTrafficPaths,
} from "@notra/sites-core/utils/entries";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  AI_TRAFFIC_DEFAULT_DAYS,
  POST_AGENT_REACH_PAGE_ROWS_PER_PATH,
  POST_AGENT_REACH_POSTS_PER_QUERY,
  POST_AGENT_REACH_QUERY_CONCURRENCY,
} from "../constants/geo";
import type { GeoWindowInput } from "../types/geo";
import type {
  PostAgentReach,
  PostAgentReachSummary,
  PostAgentReachSummaryInput,
  PostAgentReachTarget,
  PostAgentReachToolResult,
} from "../types/post-agent-reach";
import {
  isAiVisitorSource,
  toGeoTrafficSources,
  toGeoTrafficTotals,
  toGeoVisitorType,
} from "../utils/ai-traffic";
import { summarizePostAgentReach } from "../utils/post-agent-reach";
import { geoDb, geoQuery, geoRequiredQuery } from "./effect";
import { geoHiddenSourceParams } from "./hidden-sources";
import { geoTrafficWindowParams } from "./window";

/**
 * Finds where each post is live: published to a Site straight to the branch
 * its production deployment builds, or through a pull request that merged.
 * The path comes from that deployment's mounts, the ones the Sites worker
 * serves and reports traffic with.
 */
export const resolvePostAgentReachTargets = Effect.fn(
  "geo.postAgentReachTargets"
)(function* (organizationId: string, postIds: readonly string[]) {
  if (postIds.length === 0) {
    return [];
  }
  const [rows, merged] = yield* Effect.all(
    [
      geoDb("post agent reach targets", () =>
        db
          .select({
            postId: posts.id,
            publish: posts.githubPublish,
            siteId: sites.id,
            rootDirectory: sites.rootDirectory,
            deployedBranch: siteDeployments.branch,
            target: siteDeployments.target,
          })
          .from(posts)
          .innerJoin(
            sites,
            and(
              eq(sites.id, sql`${posts.githubPublish}->>'siteId'`),
              eq(sites.organizationId, posts.organizationId)
            )
          )
          .innerJoin(
            siteDeployments,
            and(
              eq(siteDeployments.siteId, sites.id),
              eq(siteDeployments.id, sites.activeProductionDeploymentId)
            )
          )
          .where(
            and(
              eq(posts.organizationId, organizationId),
              inArray(posts.id, [...postIds])
            )
          )
      ),
      geoDb("post agent reach publications", () =>
        db
          .select({
            postId: contentPublications.postId,
            repositoryId: contentPublications.repositoryId,
            path: contentPublications.path,
          })
          .from(contentPublications)
          .where(
            and(
              eq(contentPublications.organizationId, organizationId),
              inArray(contentPublications.postId, [...postIds]),
              eq(contentPublications.status, "merged")
            )
          )
      ),
    ],
    { concurrency: "unbounded" }
  );
  // Any merged publication of this file in this repository means the page
  // is live; an open update PR doesn't take the merged version offline.
  const mergedPaths = new Set(
    merged.map(
      (publication) =>
        `${publication.postId}:${publication.repositoryId}:${publication.path}`
    )
  );
  const targets: PostAgentReachTarget[] = [];
  for (const row of rows) {
    const filePath = row.publish?.path;
    const baseBranch = row.publish?.baseBranch;
    const live =
      row.publish?.direct === true ||
      mergedPaths.has(`${row.postId}:${row.publish?.repositoryId}:${filePath}`);
    if (
      typeof filePath !== "string" ||
      !live ||
      (baseBranch && baseBranch !== row.deployedBranch)
    ) {
      continue;
    }
    const path = siteEntryPagePath({
      filePath,
      rootDirectory: row.rootDirectory,
      mounts: row.target.mounts,
    });
    if (path) {
      targets.push({
        postId: row.postId,
        siteId: row.siteId,
        path,
        trafficPaths: siteEntryTrafficPaths(path),
        url: `${row.target.publicOrigin}${path}`,
      });
    }
  }
  return targets;
});

function siteTrafficParams(
  organizationId: string,
  siteId: string,
  window: GeoWindowInput
) {
  return {
    organization_id: organizationId,
    project_id: "",
    include_unassigned: 0,
    site_id: siteId,
    sites: "",
    hosts: "",
    ...geoHiddenSourceParams(),
    ...geoTrafficWindowParams(window, AI_TRAFFIC_DEFAULT_DAYS),
  };
}

/** AI crawler, citation and referral visits to one post's live page. */
export const loadPostAgentReach = Effect.fn("geo.postAgentReach")(function* (
  organizationId: string,
  postId: string,
  window: GeoWindowInput = {}
) {
  const [target] = yield* resolvePostAgentReachTargets(organizationId, [
    postId,
  ]);
  if (!target) {
    return null;
  }
  const params = {
    ...siteTrafficParams(organizationId, target.siteId, window),
    // `path` keeps older pipe versions answering for the page itself.
    path: target.path,
    page_paths: target.trafficPaths.join(","),
  };
  const query = isTinybirdConfigured() ? geoRequiredQuery : geoQuery;
  const [overview, timeseries] = yield* Effect.all(
    [
      query("post agent reach overview query failed", () =>
        queryGeoTrafficOverview({ ...params, with_paths: 0 })
      ),
      query("post agent reach timeseries query failed", () =>
        queryGeoTrafficTimeseries(params)
      ),
    ],
    { concurrency: "unbounded" }
  );
  const sources = toGeoTrafficSources(overview?.data).filter(isAiVisitorSource);
  const totals = toGeoTrafficTotals(sources);
  const reach: PostAgentReach = {
    postId,
    siteId: target.siteId,
    path: target.path,
    url: target.url,
    configured: isTinybirdConfigured(),
    totals: {
      crawled: totals.crawler - totals.cited,
      cited: totals.cited,
      referred: totals.aiReferral,
      total: totals.crawler + totals.aiReferral,
    },
    sources,
    points: (timeseries?.data ?? []).map((row) => ({
      day: row.day,
      visitorType: toGeoVisitorType(row.visitor_type),
      source: row.source ?? "",
      visits: Number(row.visits),
    })),
  };
  return reach;
});

/**
 * Visit totals for many posts, one Tinybird query per batch of a Site's
 * posts. The path list goes in a POST body; batches bound the rows returned.
 */
export const loadPostsAgentReachSummaries = Effect.fn(
  "geo.postsAgentReachSummaries"
)(function* (
  organizationId: string,
  postIds: readonly string[],
  window: GeoWindowInput = {}
) {
  const targets = yield* resolvePostAgentReachTargets(organizationId, postIds);
  const batches: PostAgentReachTarget[][] = [];
  const openBatch = new Map<string, PostAgentReachTarget[]>();
  for (const target of targets) {
    const batch = openBatch.get(target.siteId);
    if (batch && batch.length < POST_AGENT_REACH_POSTS_PER_QUERY) {
      batch.push(target);
      continue;
    }
    const next = [target];
    openBatch.set(target.siteId, next);
    batches.push(next);
  }
  const results = yield* Effect.forEach(
    batches,
    (siteTargets) => {
      const paths = siteTargets.flatMap((target) => target.trafficPaths);
      const siteId = siteTargets[0]?.siteId ?? "";
      return geoQuery("post agent reach pages query failed", () =>
        queryGeoTrafficPagesByPaths({
          ...siteTrafficParams(organizationId, siteId, window),
          path: "",
          page_paths: paths.join(","),
          visitor: "",
          host: "",
          limit: paths.length * POST_AGENT_REACH_PAGE_ROWS_PER_PATH,
        })
      ).pipe(
        Effect.map((pages) => ({
          siteTargets,
          rows: pages?.data ?? (isTinybirdConfigured() ? undefined : []),
        }))
      );
    },
    { concurrency: POST_AGENT_REACH_QUERY_CONCURRENCY }
  );
  const summaries: PostAgentReachSummary[] = [];
  for (const { siteTargets, rows } of results) {
    for (const target of siteTargets) {
      const paths = new Set(target.trafficPaths);
      const summary: PostAgentReachSummary = {
        postId: target.postId,
        available: rows !== undefined,
        crawler: 0,
        aiReferral: 0,
        total: 0,
      };
      for (const row of rows ?? []) {
        if (!paths.has(row.path)) {
          continue;
        }
        const visits = Number(row.visits);
        const visitorType = toGeoVisitorType(row.visitor_type);
        if (visitorType === "crawler") {
          summary.crawler += visits;
        } else if (visitorType === "ai_referral") {
          summary.aiReferral += visits;
        }
      }
      summary.total = summary.crawler + summary.aiReferral;
      summaries.push(summary);
    }
  }
  return summaries;
});

/** Promise form for AI tools: the compact summary, rejecting on failure. */
export async function loadPostAgentReachSummary(
  input: PostAgentReachSummaryInput
): Promise<PostAgentReachToolResult> {
  const reach = await Effect.runPromise(
    loadPostAgentReach(input.organizationId, input.postId, {
      days: input.days,
      from: input.from,
      to: input.to,
    })
  );
  return summarizePostAgentReach(reach);
}
