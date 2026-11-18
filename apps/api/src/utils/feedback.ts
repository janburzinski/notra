import { createHash } from "node:crypto";

import { stableStringify } from "@notra/sites-core/utils/stable-stringify";
import { Effect } from "effect";
import type { Context } from "hono";

import {
  FEEDBACK_NOT_FOUND_ERROR,
  FEEDBACK_ORGANIZATION_NOT_FOUND_ERROR,
  FEEDBACK_PROJECT_NOT_FOUND_ERROR,
} from "../constants/feedback";
import type { FeedbackDatabaseError } from "../errors/feedback";
import { isIngestAuth } from "../types/auth";
import type {
  AgentFeedbackRow,
  SubmitFeedbackBody,
  FeedbackDomainError,
  SerializedAgentFeedback,
} from "../types/feedback";

const PUBLIC_FEEDBACK_INGEST_PATH_REGEX = /^\/v1\/feedback\/[^/]+\/?$/;
const FEEDBACK_API_PATH_REGEX = /^\/v1\/feedback(?:\/|$)/;
const FEEDBACK_SUBMISSION_PATH_REGEX = /^\/v1\/feedback\/?$/;

/**
 * Hash of the sender and every submitted field. Retries of the same tool call
 * match; anyone else must reproduce the whole submission to match.
 */
export function feedbackContentKey(input: {
  sender: string | null | undefined;
  projectId: string | null;
  body: SubmitFeedbackBody;
  userAgent: string | null;
}): string {
  const { body } = input;
  return createHash("sha256")
    .update(
      // Stable key order, so reordered metadata still matches.
      stableStringify([
        input.sender ?? null,
        input.projectId,
        body.source,
        body.message,
        body.title ?? null,
        body.kind ?? null,
        body.sentiment ?? null,
        body.agentClient ?? null,
        body.agentModel ?? null,
        body.toolVersion ?? null,
        input.userAgent,
        body.contextUrl ?? null,
        body.externalId ?? null,
        body.metadata ?? null,
      ])
    )
    .digest("base64url");
}

export function serializeFeedback({
  contentKey: _contentKey,
  ...row
}: AgentFeedbackRow): SerializedAgentFeedback {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

export function getIngestProjectId(c: Context): string | undefined {
  const auth = c.get("auth");
  if (!auth || !isIngestAuth(auth)) {
    return undefined;
  }
  return auth.projectId ?? undefined;
}

export function isPublicFeedbackIngestRequest(
  pathname: string,
  method: string
): boolean {
  return method === "POST" && PUBLIC_FEEDBACK_INGEST_PATH_REGEX.test(pathname);
}

export function isFeedbackSubmissionRequest(
  pathname: string,
  method: string
): boolean {
  return method === "POST" && FEEDBACK_SUBMISSION_PATH_REGEX.test(pathname);
}

export function isFeedbackApiRequest(pathname: string): boolean {
  return FEEDBACK_API_PATH_REGEX.test(pathname);
}

export function runFeedbackProgram<A, E extends FeedbackDomainError>(
  program: Effect.Effect<A, E | FeedbackDatabaseError>
) {
  return Effect.runPromise(
    Effect.result(
      program.pipe(
        Effect.catchTag("FeedbackDatabaseError", (failure) =>
          Effect.die(failure.cause)
        )
      )
    )
  );
}

export function respondToFeedbackFailure(
  c: Context,
  failure: FeedbackDomainError
) {
  if (failure._tag === "FeedbackOrganizationNotFoundError") {
    return c.json({ error: FEEDBACK_ORGANIZATION_NOT_FOUND_ERROR }, 404);
  }
  if (failure._tag === "FeedbackProjectNotFoundError") {
    return c.json({ error: FEEDBACK_PROJECT_NOT_FOUND_ERROR }, 404);
  }
  return c.json({ error: FEEDBACK_NOT_FOUND_ERROR }, 404);
}
