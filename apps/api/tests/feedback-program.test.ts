import { describe, expect, mock, test } from "bun:test";

import { PgDialect } from "drizzle-orm/pg-core";
import { Effect } from "effect";

import {
  FeedbackIdempotencyConflictError,
  FeedbackProjectNotFoundError,
} from "../src/errors/feedback";
import { listFeedback, submitFeedback } from "../src/programs/feedback";
import type { AgentFeedbackRow } from "../src/types/feedback";
import { serializeFeedback } from "../src/utils/feedback";

mock.module("@notra/ai/jobs/feedback-classifier", () => ({
  classifyAgentFeedback: mock(async () => ({
    kind: "bug" as const,
    sentiment: "negative" as const,
    title: "Classified title",
  })),
}));

const now = new Date("2026-01-01T00:00:00.000Z");

function feedbackRow(
  overrides: Partial<AgentFeedbackRow> = {}
): AgentFeedbackRow {
  return {
    id: "fb_existing",
    organizationId: "org_a",
    projectId: null,
    source: "api",
    kind: "bug",
    sentiment: "negative",
    status: "new",
    title: "Existing",
    message: "Already filed",
    agentClient: null,
    agentModel: null,
    toolVersion: null,
    userAgent: null,
    contextUrl: null,
    externalId: null,
    idempotencyKey: "idem-1",
    contentKey: null,
    metadata: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("feedback programs", () => {
  test("submitFeedback returns an existing row for a repeated idempotency key", async () => {
    const existing = feedbackRow();
    const db = {
      query: {
        agentFeedback: {
          findFirst: mock(async () => existing),
        },
        projects: {
          findFirst: mock(async () => undefined),
        },
      },
      insert: mock(() => {
        throw new Error("insert should not run");
      }),
    };

    const result = await Effect.runPromise(
      submitFeedback({
        db,
        organizationId: "org_a",
        body: {
          message: "Already filed",
          source: "api",
          idempotencyKey: "idem-1",
          kind: "bug",
          sentiment: "negative",
          title: "Provided title",
        },
      })
    );

    expect(result).toEqual({ feedback: existing, deduplicated: true });
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("submitFeedback does not return another submission for a reused idempotency key", async () => {
    const db = {
      query: {
        agentFeedback: {
          findFirst: mock(async () => feedbackRow()),
        },
        projects: {
          findFirst: mock(async () => undefined),
        },
      },
      insert: mock(() => {
        throw new Error("insert should not run");
      }),
    };

    const failure = await Effect.runPromise(
      Effect.flip(
        submitFeedback({
          db,
          organizationId: "org_a",
          body: {
            message: "Guessing someone else's key",
            source: "api",
            idempotencyKey: "idem-1",
            kind: "bug",
            sentiment: "negative",
            title: "Provided title",
          },
        })
      )
    );

    expect(failure).toBeInstanceOf(FeedbackIdempotencyConflictError);
    expect(db.insert).not.toHaveBeenCalled();
  });

  const repeatBody = {
    message: "Already filed",
    source: "mcp" as const,
    kind: "bug" as const,
    sentiment: "negative" as const,
    title: "Provided title",
  };

  function insertingDb(existing: AgentFeedbackRow | undefined) {
    const inserted: Partial<AgentFeedbackRow>[] = [];
    const db = {
      query: {
        agentFeedback: {
          findFirst: mock(async () => existing),
        },
        projects: {
          findFirst: mock(async () => undefined),
        },
      },
      update: mock(() => ({
        set: () => ({ where: async () => [] }),
      })),
      insert: mock(() => ({
        values: (values: Partial<AgentFeedbackRow>) => {
          inserted.push(values);
          return {
            onConflictDoNothing: () => ({
              returning: async () => [feedbackRow(values)],
            }),
          };
        },
      })),
    };
    return { db, inserted };
  }

  test("submitFeedback returns the recent entry for a repeated submission without a key", async () => {
    const existing = feedbackRow({
      idempotencyKey: null,
      contentKey: "content-key",
      status: "resolved",
      resolvedAt: new Date("2026-01-01T00:05:00.000Z"),
      updatedAt: new Date("2026-01-01T00:05:00.000Z"),
    });
    const { db } = insertingDb(existing);

    const result = await Effect.runPromise(
      submitFeedback({ db, organizationId: "org_a", body: repeatBody })
    );

    expect(result.deduplicated).toBe(true);
    expect(result.feedback.id).toBe(existing.id);
    expect(result.feedback.status).toBe("new");
    expect(result.feedback.resolvedAt).toBeNull();
    expect(result.feedback.updatedAt).toEqual(existing.createdAt);
    expect(db.insert).not.toHaveBeenCalled();
  });

  test("submitFeedback frees an expired content key before filing a new entry", async () => {
    const { db, inserted } = insertingDb(undefined);

    const result = await Effect.runPromise(
      submitFeedback({ db, organizationId: "org_a", body: repeatBody })
    );

    expect(result.deduplicated).toBe(false);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveLength(1);
  });

  test("submitFeedback keys submissions without a client key by sender and content", async () => {
    const submit = async (
      body: typeof repeatBody & {
        title?: string;
        metadata?: Record<string, unknown>;
      },
      sender: string | null
    ) => {
      const { db, inserted } = insertingDb(undefined);
      const result = await Effect.runPromise(
        submitFeedback({ db, organizationId: "org_a", body, sender })
      );
      return { result, values: inserted[0] };
    };

    const first = await submit(repeatBody, null);
    const repeat = await submit(repeatBody, null);
    const otherTitle = await submit({ ...repeatBody, title: "Other" }, null);
    const otherSender = await submit(repeatBody, "key_b");
    const metadataAb = await submit(
      { ...repeatBody, metadata: { a: 1, b: { c: 2, d: 3 } } },
      null
    );
    const metadataBa = await submit(
      { ...repeatBody, metadata: { b: { d: 3, c: 2 }, a: 1 } },
      null
    );

    expect(first.values?.idempotencyKey).toBeNull();
    expect(first.values?.contentKey).toBe(repeat.values?.contentKey);
    expect(otherTitle.values?.contentKey).not.toBe(first.values?.contentKey);
    expect(otherSender.values?.contentKey).not.toBe(first.values?.contentKey);
    expect(metadataBa.values?.contentKey).toBe(metadataAb.values?.contentKey);
    expect(serializeFeedback(first.result.feedback)).not.toHaveProperty(
      "contentKey"
    );
  });

  test("submitFeedback fails when projectId is not in the organization", async () => {
    const db = {
      query: {
        agentFeedback: {
          findFirst: mock(async () => undefined),
        },
        projects: {
          findFirst: mock(async () => undefined),
        },
      },
    };

    const failure = await Effect.runPromise(
      Effect.flip(
        submitFeedback({
          db,
          organizationId: "org_a",
          body: {
            message: "Broken project ref",
            source: "api",
            projectId: "proj_missing",
            kind: "bug",
            sentiment: "negative",
            title: "Title",
          },
        })
      )
    );

    expect(failure).toBeInstanceOf(FeedbackProjectNotFoundError);
  });

  test("listFeedback scopes queries to the requesting organization", async () => {
    const capturedWhere: unknown[] = [];
    let whereCall = 0;
    const db = {
      select: mock(() => ({
        from: mock(() => ({
          where: mock((where: unknown) => {
            capturedWhere.push(where);
            whereCall += 1;
            if (whereCall === 1) {
              return Promise.resolve([{ total: 1 }]);
            }
            return {
              orderBy: mock(() => ({
                limit: mock(() => ({
                  offset: mock(async () => [
                    feedbackRow({ organizationId: "org_b" }),
                  ]),
                })),
              })),
            };
          }),
        })),
      })),
    };

    await Effect.runPromise(
      listFeedback({
        db,
        organizationId: "org_b",
        query: { page: 1, limit: 20 },
      })
    );

    expect(capturedWhere.length).toBe(2);
    const dialect = new PgDialect();
    for (const where of capturedWhere) {
      const { params } = dialect.sqlToQuery(where);
      expect(params).toContain("org_b");
    }
  });
});
