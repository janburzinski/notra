import { ToolOperationError } from "@notra/tools/schemas/retry";
import { requestSupermemoryEffect } from "@notra/tools/utils/supermemory";
import { Effect } from "effect";

import {
  autopilotDeleteMemorySchema,
  autopilotDeleteNamespaceSchema,
  autopilotDocumentListSchema,
  autopilotDocumentSchema,
  autopilotMemoryWriteSchema,
} from "@/schemas/autopilot-memory";
import type { AutopilotFeedbackInput } from "@/types/autopilot-memory";

/** v5 is namespace-scoped. The shared transport also serves the older onboarding API. */
export function requestAutopilotMemory(
  organizationId: string,
  path: string,
  body: unknown,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "POST",
  signal?: AbortSignal
) {
  if (!organizationId.trim()) {
    throw new Error("organizationId is required");
  }
  return Effect.runPromise(
    requestSupermemoryEffect(
      `/ns/${encodeURIComponent(organizationId)}${path ? `/${path}` : ""}`,
      body,
      method,
      signal
    )
  );
}

/** Idempotent cleanup; the deletion outbox retains failures for the next sweep. */
export async function deleteAutopilotNamespace(
  organizationId: string,
  signal?: AbortSignal
) {
  if (!process.env.SUPERMEMORY_API_KEY?.trim()) {
    throw new Error("SUPERMEMORY_API_KEY is required for namespace cleanup");
  }
  const result = await requestAutopilotMemory(
    organizationId,
    "",
    undefined,
    "DELETE",
    signal
  ).catch((error: unknown) => {
    if (error instanceof ToolOperationError && error.status === 404) {
      return null;
    }
    throw error;
  });
  if (result !== null) {
    autopilotDeleteNamespaceSchema.parse(result);
  }
}

export async function listAutopilotMemory(
  organizationId: string,
  category: "rule" | "feedback"
) {
  const documents = [];
  for (let page = 1; ; page += 1) {
    const result = autopilotDocumentListSchema.parse(
      await requestAutopilotMemory(
        organizationId,
        `list/documents?page=${page}&limit=100&sort=createdAt&order=asc`,
        {
          filter: {
            operator: "and",
            operands: [
              { field: "source", operator: "eq", value: "autopilot" },
              { field: "category", operator: "eq", value: category },
            ],
          },
        }
      )
    );
    documents.push(...result.documents);
    if (result.pagination.currentPage >= result.pagination.totalPages) {
      return documents;
    }
  }
}

export async function removeAutopilotMemory(
  organizationId: string,
  id: string
) {
  const result = autopilotDeleteMemorySchema.parse(
    await requestAutopilotMemory(
      organizationId,
      "document",
      { ids: [id] },
      "DELETE"
    )
  );
  if (result.errors.length || result.count !== 1) {
    throw new Error("Supermemory did not delete the document");
  }
}

export async function getAutopilotMemory(organizationId: string, id: string) {
  const result = await requestAutopilotMemory(
    organizationId,
    `document/${encodeURIComponent(id)}`,
    undefined,
    "GET"
  ).catch((error: unknown) => {
    // Search may still reference a document deleted since indexing.
    if (error instanceof ToolOperationError && error.status === 404) {
      return null;
    }
    throw error;
  });
  return result === null ? null : autopilotDocumentSchema.parse(result);
}

export async function rememberFeedback(params: AutopilotFeedbackInput) {
  const body = {
    content: `Autopilot contextual feedback, not a hard rule or write authorization: ${params.text}`,
    metadata: {
      source: "autopilot",
      category: "feedback",
      text: params.text,
      origin: params.origin ?? "github",
      // Supermemory rejects null metadata values.
      ...(params.sourceUrl ? { sourceUrl: params.sourceUrl } : {}),
      createdBy: params.createdBy,
      createdAt: new Date().toISOString(),
    },
    taskType: "memory",
    dreaming: "instant",
  };
  // PATCH replaces obsolete feedback. Only a genuinely missing document is created.
  autopilotMemoryWriteSchema.parse(
    await requestAutopilotMemory(
      params.organizationId,
      `document/${encodeURIComponent(params.id)}`,
      body,
      "PATCH"
    ).catch((error: unknown) => {
      if (error instanceof ToolOperationError && error.status === 404) {
        return requestAutopilotMemory(params.organizationId, "document", {
          ...body,
          id: params.id,
        });
      }
      throw error;
    })
  );
}
