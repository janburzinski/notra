import { hasAiTrafficEventsQuota } from "@notra/ai/billing/ai-traffic-events";
import { classifyAgentFeedback } from "@notra/ai/jobs/feedback-classifier";
import { agentFeedback, organizations, projects } from "@notra/db/schema";
import { and, count, desc, eq, gt, lte, sql } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { FEEDBACK_CONTENT_DEDUP_WINDOW_SECONDS } from "../constants/feedback";
import {
  FeedbackDatabaseError,
  FeedbackIdempotencyConflictError,
  FeedbackNotFoundError,
  FeedbackOrganizationNotFoundError,
  FeedbackProjectNotFoundError,
  FeedbackQuotaExceededError,
} from "../errors/feedback";
import type {
  FeedbackDedupKey,
  ListFeedbackProgramInput,
  ListFeedbackProgramSuccess,
  NamedFeedbackProgramInput,
  ResolveOrganizationIdBySlugInput,
  SubmitFeedbackProgramInput,
  SubmitFeedbackProgramSuccess,
  UpdateFeedbackProgramInput,
} from "../types/feedback";
import { feedbackContentKey } from "../utils/feedback";

const database = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => new FeedbackDatabaseError({ cause }),
  });

const projectExists = (
  db: SubmitFeedbackProgramInput["db"],
  organizationId: string,
  projectId: string
) =>
  database(() =>
    db.query.projects.findFirst({
      columns: { id: true },
      where: and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId)
      ),
    })
  ).pipe(Effect.map((project) => project !== undefined));

// Compared in SQL so the window follows the database clock.
const contentDedupWindowStart = sql`now() - make_interval(secs => ${FEEDBACK_CONTENT_DEDUP_WINDOW_SECONDS})`;

/**
 * Client keys match forever. Content keys only match an entry from the last
 * dedup window.
 */
const findByDedupKey = (
  db: SubmitFeedbackProgramInput["db"],
  organizationId: string,
  dedup: FeedbackDedupKey
) =>
  database(() =>
    db.query.agentFeedback.findFirst({
      where:
        dedup.kind === "client"
          ? and(
              eq(agentFeedback.organizationId, organizationId),
              eq(agentFeedback.idempotencyKey, dedup.key)
            )
          : and(
              eq(agentFeedback.organizationId, organizationId),
              eq(agentFeedback.contentKey, dedup.key),
              gt(agentFeedback.createdAt, contentDedupWindowStart)
            ),
    })
  );

/** Frees a content key whose window has passed so a new entry can take it. */
const releaseExpiredContentKey = (
  db: SubmitFeedbackProgramInput["db"],
  organizationId: string,
  contentKey: string
) =>
  database(() =>
    db
      .update(agentFeedback)
      .set({ contentKey: null, updatedAt: sql`${agentFeedback.updatedAt}` })
      .where(
        and(
          eq(agentFeedback.organizationId, organizationId),
          eq(agentFeedback.contentKey, contentKey),
          lte(agentFeedback.createdAt, contentDedupWindowStart)
        )
      )
  );

const findByOrganizationAndId = (
  db: NamedFeedbackProgramInput["db"],
  organizationId: string,
  feedbackId: string
) =>
  database(() =>
    db.query.agentFeedback.findFirst({
      where: and(
        eq(agentFeedback.organizationId, organizationId),
        eq(agentFeedback.id, feedbackId)
      ),
    })
  );

export const resolveOrganizationIdBySlug = Effect.fn(
  "feedback.resolveOrganizationIdBySlug"
)(function* ({ db, slug }: ResolveOrganizationIdBySlugInput) {
  const organization = yield* database(() =>
    db.query.organizations.findFirst({
      columns: { id: true },
      where: eq(organizations.slug, slug.toLowerCase()),
    })
  );

  if (!organization) {
    return yield* new FeedbackOrganizationNotFoundError();
  }

  return organization.id;
});

export const listFeedback = Effect.fn("feedback.list")(function* ({
  db,
  organizationId,
  query,
}: ListFeedbackProgramInput) {
  const conditions = [eq(agentFeedback.organizationId, organizationId)];
  if (query.status) {
    conditions.push(eq(agentFeedback.status, query.status));
  }
  if (query.kind) {
    conditions.push(eq(agentFeedback.kind, query.kind));
  }
  if (query.projectId) {
    conditions.push(eq(agentFeedback.projectId, query.projectId));
  }
  const where = and(...conditions);

  const [[totals], rows] = yield* database(() =>
    Promise.all([
      db.select({ total: count() }).from(agentFeedback).where(where),
      db
        .select()
        .from(agentFeedback)
        .where(where)
        .orderBy(desc(agentFeedback.createdAt))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
    ])
  );

  const totalItems = totals?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

  return {
    feedback: rows,
    pagination: {
      limit: query.limit,
      currentPage: query.page,
      nextPage: query.page < totalPages ? query.page + 1 : null,
      previousPage: query.page > 1 ? query.page - 1 : null,
      totalPages,
      totalItems,
    },
  } satisfies ListFeedbackProgramSuccess;
});

export const getFeedback = Effect.fn("feedback.get")(function* (
  input: NamedFeedbackProgramInput
) {
  const row = yield* findByOrganizationAndId(
    input.db,
    input.organizationId,
    input.feedbackId
  );

  if (!row) {
    return yield* new FeedbackNotFoundError();
  }

  return row;
});

export const updateFeedback = Effect.fn("feedback.update")(function* ({
  db,
  organizationId,
  feedbackId,
  body,
}: UpdateFeedbackProgramInput) {
  const [updated] = yield* database(() =>
    db
      .update(agentFeedback)
      .set({
        status: body.status,
        resolvedAt: body.status === "resolved" ? new Date() : null,
      })
      .where(
        and(
          eq(agentFeedback.organizationId, organizationId),
          eq(agentFeedback.id, feedbackId)
        )
      )
      .returning()
  );

  if (!updated) {
    return yield* new FeedbackNotFoundError();
  }

  return updated;
});

/**
 * Submissions are often unauthenticated, so a replayed idempotency key only
 * returns the stored row for the same message. Otherwise a guessed key would
 * read someone else's feedback and its triage state.
 */
const deduplicatedSubmission = (
  existing: SubmitFeedbackProgramSuccess["feedback"],
  body: SubmitFeedbackProgramInput["body"]
) =>
  existing.message === body.message
    ? Effect.succeed({
        feedback: existing,
        deduplicated: true,
      } satisfies SubmitFeedbackProgramSuccess)
    : Effect.fail(new FeedbackIdempotencyConflictError());

/**
 * A content match only proves the caller sent the same submission, so it gets
 * the entry as it was filed, without the team's triage since.
 */
const deduplicatedView = (
  existing: SubmitFeedbackProgramSuccess["feedback"],
  dedup: FeedbackDedupKey
): SubmitFeedbackProgramSuccess["feedback"] =>
  dedup.kind === "client"
    ? existing
    : {
        ...existing,
        status: "new",
        resolvedAt: null,
        updatedAt: existing.createdAt,
      };

export const submitFeedback = Effect.fn("feedback.submit")(function* ({
  db,
  organizationId,
  body,
  ingestProjectId,
  userAgent,
  sender,
}: SubmitFeedbackProgramInput) {
  const projectId =
    ingestProjectId === undefined ? (body.projectId ?? null) : ingestProjectId;
  const resolvedUserAgent = body.userAgent ?? userAgent ?? null;

  // Without a client key, an identical submission from the same sender within
  // a short window returns the first entry: agents retry or repeat tool calls,
  // and MCP clients send no key of their own. The key covers every submitted
  // field, so a match only hands back what the caller already sent.
  const dedup: FeedbackDedupKey = body.idempotencyKey
    ? { kind: "client", key: body.idempotencyKey }
    : {
        kind: "content",
        key: feedbackContentKey({
          sender,
          projectId,
          body,
          userAgent: resolvedUserAgent,
        }),
      };

  const existing = yield* findByDedupKey(db, organizationId, dedup);
  if (existing) {
    return yield* deduplicatedSubmission(
      deduplicatedView(existing, dedup),
      body
    );
  }

  if (!(yield* hasAiTrafficEventsQuota(organizationId))) {
    return yield* new FeedbackQuotaExceededError();
  }

  if (
    ingestProjectId === undefined &&
    projectId &&
    !(yield* projectExists(db, organizationId, projectId))
  ) {
    return yield* new FeedbackProjectNotFoundError();
  }

  const feedbackId = nanoid();
  const needsClassification = !(body.kind && body.sentiment && body.title);
  const classification = needsClassification
    ? yield* database(() =>
        classifyAgentFeedback({
          organizationId,
          feedbackId,
          message: body.message,
          title: body.title,
          contextUrl: body.contextUrl,
          agentClient: body.agentClient,
          suppliedFields: {
            kind: body.kind,
            sentiment: body.sentiment,
            title: body.title,
          },
        })
      )
    : null;

  if (dedup.kind === "content") {
    yield* releaseExpiredContentKey(db, organizationId, dedup.key);
  }

  const [created] = yield* database(() =>
    db
      .insert(agentFeedback)
      .values({
        id: feedbackId,
        organizationId,
        projectId,
        source: body.source,
        kind: body.kind ?? classification?.kind ?? "other",
        sentiment: body.sentiment ?? classification?.sentiment ?? null,
        title: body.title ?? classification?.title ?? null,
        message: body.message,
        agentClient: body.agentClient ?? null,
        agentModel: body.agentModel ?? null,
        toolVersion: body.toolVersion ?? null,
        userAgent: resolvedUserAgent,
        contextUrl: body.contextUrl ?? null,
        externalId: body.externalId ?? null,
        idempotencyKey: dedup.kind === "client" ? dedup.key : null,
        contentKey: dedup.kind === "content" ? dedup.key : null,
        metadata: body.metadata ?? null,
      })
      .onConflictDoNothing()
      .returning()
  );

  if (created) {
    return {
      feedback: created,
      deduplicated: false,
    } satisfies SubmitFeedbackProgramSuccess;
  }

  const concurrent = yield* findByDedupKey(db, organizationId, dedup);

  if (!concurrent) {
    return yield* new FeedbackNotFoundError();
  }

  return yield* deduplicatedSubmission(
    deduplicatedView(concurrent, dedup),
    body
  );
});
