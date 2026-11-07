import { db } from "@notra/db/drizzle";
import {
  agentFeedback,
  brandSettings,
  geoContentGapSnapshots,
  geoPrompts,
  githubIntegrations,
  postCollections,
  posts,
} from "@notra/db/schema";
import type { GeoContentGapsResponse } from "@notra/geo-core/types/geo";
import { and, desc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";

import {
  CHAT_SUGGESTION_DRAFT_MAX_AGE_DAYS,
  CHAT_SUGGESTION_FEEDBACK_MAX_AGE_DAYS,
  CHAT_SUGGESTION_TITLE_MAX_LENGTH,
} from "@/constants/chat-suggestion-signals";
import type { ChatSuggestionSignal, ChatSuggestionSignals } from "@/types/chat";

const DAY_MS = 24 * 60 * 60 * 1000;

function clip(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > CHAT_SUGGESTION_TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, CHAT_SUGGESTION_TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : trimmed;
}

async function loadLatestDraft(
  organizationId: string,
  projectId: string | null
): Promise<ChatSuggestionSignal | null> {
  const since = new Date(
    Date.now() - CHAT_SUGGESTION_DRAFT_MAX_AGE_DAYS * DAY_MS
  );
  const [row] = await db
    .select({ id: posts.id, title: posts.title, updatedAt: posts.updatedAt })
    .from(posts)
    .leftJoin(postCollections, eq(postCollections.id, posts.collectionId))
    .where(
      and(
        eq(posts.organizationId, organizationId),
        eq(posts.status, "draft"),
        eq(posts.hidden, false),
        gte(posts.updatedAt, since),
        projectId
          ? or(
              isNull(postCollections.projectId),
              eq(postCollections.projectId, projectId)
            )
          : undefined
      )
    )
    .orderBy(desc(posts.updatedAt))
    .limit(1);

  if (!row?.title.trim()) {
    return null;
  }
  return {
    kind: "draft",
    postId: row.id,
    title: clip(row.title),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadTopGap(
  organizationId: string,
  projectId: string | null
): Promise<ChatSuggestionSignal | null> {
  const snapshots = await db
    .select({ snapshot: geoContentGapSnapshots.snapshot })
    .from(geoContentGapSnapshots)
    .where(
      and(
        eq(geoContentGapSnapshots.organizationId, organizationId),
        projectId ? eq(geoContentGapSnapshots.projectId, projectId) : undefined
      )
    );

  const gap = snapshots
    .flatMap(
      ({ snapshot }) =>
        (snapshot as GeoContentGapsResponse | null)?.promptGaps ?? []
    )
    .filter((row) => !(row.won || row.brief))
    .toSorted((left, right) => right.opportunity - left.opportunity)
    .at(0);

  if (!gap) {
    return null;
  }
  return {
    kind: "gap",
    title: clip(gap.title ?? gap.prompt),
    prompt: gap.prompt,
    competitor: gap.competitors[0] ?? null,
  };
}

async function loadRepository(
  organizationId: string
): Promise<ChatSuggestionSignal | null> {
  const [row] = await db
    .select({ owner: githubIntegrations.owner, repo: githubIntegrations.repo })
    .from(githubIntegrations)
    .where(
      and(
        eq(githubIntegrations.organizationId, organizationId),
        eq(githubIntegrations.enabled, true),
        eq(githubIntegrations.repositoryEnabled, true),
        isNotNull(githubIntegrations.owner),
        isNotNull(githubIntegrations.repo)
      )
    )
    .orderBy(desc(githubIntegrations.updatedAt))
    .limit(1);

  if (!(row?.owner && row.repo)) {
    return null;
  }
  return { kind: "repo", owner: row.owner, repo: row.repo };
}

async function loadShippedRequest(
  organizationId: string,
  projectId: string | null
): Promise<ChatSuggestionSignal | null> {
  const since = new Date(
    Date.now() - CHAT_SUGGESTION_FEEDBACK_MAX_AGE_DAYS * DAY_MS
  );
  const [row] = await db
    .select({
      id: agentFeedback.id,
      title: agentFeedback.title,
      message: agentFeedback.message,
      resolvedAt: agentFeedback.resolvedAt,
      updatedAt: agentFeedback.updatedAt,
    })
    .from(agentFeedback)
    .where(
      and(
        eq(agentFeedback.organizationId, organizationId),
        eq(agentFeedback.kind, "feature"),
        eq(agentFeedback.status, "resolved"),
        gte(agentFeedback.updatedAt, since),
        projectId
          ? or(
              isNull(agentFeedback.projectId),
              eq(agentFeedback.projectId, projectId)
            )
          : undefined
      )
    )
    .orderBy(desc(agentFeedback.updatedAt))
    .limit(1);

  if (!row) {
    return null;
  }
  return {
    kind: "shipped",
    feedbackId: row.id,
    title: clip(row.title ?? row.message),
    resolvedAt: (row.resolvedAt ?? row.updatedAt).toISOString(),
  };
}

async function loadBrandName(organizationId: string): Promise<string | null> {
  const [row] = await db
    .select({ companyName: brandSettings.companyName })
    .from(brandSettings)
    .where(eq(brandSettings.organizationId, organizationId))
    .orderBy(desc(brandSettings.isDefault))
    .limit(1);
  const name = row?.companyName?.trim();
  return name ? clip(name) : null;
}

async function hasGeoPrompts(
  organizationId: string,
  projectId: string | null
): Promise<boolean> {
  const [row] = await db
    .select({ id: geoPrompts.id })
    .from(geoPrompts)
    .where(
      and(
        eq(geoPrompts.organizationId, organizationId),
        projectId ? eq(geoPrompts.projectId, projectId) : undefined
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Signals for the empty chat screen: what this workspace is working on right
 * now. Each lookup is independent and cheap; a missing or failed one just
 * drops out.
 */
export async function loadChatSuggestionSignals(
  organizationId: string,
  projectId: string | null
): Promise<ChatSuggestionSignals> {
  const [draft, gap, repo, shipped, brandName, hasGeo] = await Promise.all([
    loadLatestDraft(organizationId, projectId).catch(() => null),
    loadTopGap(organizationId, projectId).catch(() => null),
    loadRepository(organizationId).catch(() => null),
    loadShippedRequest(organizationId, projectId).catch(() => null),
    loadBrandName(organizationId).catch(() => null),
    hasGeoPrompts(organizationId, projectId).catch(() => false),
  ]);

  return {
    brandName,
    hasGeo,
    signals: [draft, gap, shipped, repo].filter(
      (signal): signal is ChatSuggestionSignal => signal !== null
    ),
  };
}
