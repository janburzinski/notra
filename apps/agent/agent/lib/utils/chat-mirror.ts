import {
  appendChatMessageIfMissing,
  claimChatSessionForExternalChannel,
  generateChatId,
  getChatMessageById,
  renameChatSession,
  setChatMirrorRunning,
  upsertChatMessageById,
} from "@notra/ai/chat/history";
import {
  publishChatMirrorMessage,
  publishChatMirrorStatus,
} from "@notra/ai/chat/mirror";
import type { MirrorChatStatus } from "@notra/ai/types/chat";
import { getSessionAttribute } from "@notra/tools/utils/session";
import { Effect } from "effect";
import type { SessionContext } from "eve/context";
import {
  call,
  type CallSettled,
  type ContentDelta,
  type InteractionOpened,
} from "eve/events";
import type { HookContext } from "eve/hooks";

import {
  MIRROR_DELTA_THROTTLE_MAX_ENTRIES,
  MIRROR_DELTA_THROTTLE_MS,
  MIRROR_TOOL_NAME_OVERRIDES,
  MIRROR_TOOL_OUTPUT_MAX_CHARS,
  MIRRORED_CHANNEL_KINDS,
} from "../constants/chat-mirror";
import { ASSISTANT_MODEL_ID } from "../constants/models";
import { ChatMirrorError } from "../schemas/chat-mirror";
import type {
  MirrorEventContext,
  MirrorTarget,
  MirrorUiMessage,
} from "../types/chat-mirror";

const SNAKE_SEGMENT_REGEX = /_([a-z0-9])/gu;

const deltaBuffers = new Map<
  string,
  { mirrored: boolean; publishedAt: number; text: string }
>();

function mirrorStep<T>(
  operation: string,
  run: () => Promise<T>
): Effect.Effect<T, ChatMirrorError> {
  return Effect.tryPromise({
    try: run,
    catch: (cause) => new ChatMirrorError({ cause, operation }),
  });
}

export function runMirrorEffect(
  operation: Effect.Effect<unknown, unknown>
): Promise<void> {
  return Effect.runPromise(
    operation.pipe(
      Effect.asVoid,
      Effect.catch((error) =>
        Effect.logWarning("[agent] chat mirror failed", error)
      )
    )
  );
}

function getMirrorTarget(ctx: SessionContext): MirrorTarget | null {
  const organizationId = getSessionAttribute(ctx, "organizationId");
  const chatId = getSessionAttribute(ctx, "chatId");
  if (!(organizationId && chatId)) {
    return null;
  }
  return { organizationId, chatId, sessionId: ctx.session.id };
}

export function resolveMirrorChatId(ctx: HookContext) {
  const kind = ctx.channel.kind;
  if (!(kind && MIRRORED_CHANNEL_KINDS.has(kind))) {
    return null;
  }
  return getSessionAttribute(ctx, "chatId");
}

function publishMirrorMessage(
  organizationId: string,
  chatId: string,
  message: MirrorUiMessage
): Effect.Effect<void> {
  return mirrorStep("publish-mirror-message", () =>
    publishChatMirrorMessage(organizationId, chatId, message)
  ).pipe(
    Effect.catch((error) =>
      Effect.logWarning("[agent] mirror publish failed", error)
    )
  );
}

export function appendAndPublishMirrorMessage(
  organizationId: string,
  chatId: string,
  message: MirrorUiMessage
): Effect.Effect<boolean, ChatMirrorError> {
  return Effect.gen(function* () {
    const appended = yield* mirrorStep("append-mirror-message", () =>
      appendChatMessageIfMissing(organizationId, chatId, message)
    );
    if (appended) {
      yield* publishMirrorMessage(organizationId, chatId, message);
    }
    return appended;
  });
}

function upsertAndPublishMirrorMessage(
  organizationId: string,
  chatId: string,
  message: MirrorUiMessage
): Effect.Effect<boolean, ChatMirrorError> {
  return Effect.gen(function* () {
    const updated = yield* mirrorStep("upsert-mirror-message", () =>
      upsertChatMessageById(organizationId, chatId, message)
    );
    if (updated) {
      yield* publishMirrorMessage(organizationId, chatId, message);
    }
    return updated;
  });
}

export function claimMirroredChatSession(input: {
  organizationId: string;
  source: "slack" | "discord";
  externalChannelId: string;
  title: string;
  inboundMessage: MirrorUiMessage | null;
  loadHistory: () => Promise<MirrorUiMessage[]>;
}): Effect.Effect<string, ChatMirrorError> {
  return Effect.gen(function* () {
    const claim = yield* mirrorStep("claim-chat-session", () =>
      claimChatSessionForExternalChannel(
        input.organizationId,
        input.source,
        input.externalChannelId,
        generateChatId()
      )
    );

    if (!claim.created) {
      if (input.inboundMessage) {
        yield* appendAndPublishMirrorMessage(
          input.organizationId,
          claim.chatId,
          input.inboundMessage
        );
      }
      return claim.chatId;
    }

    const history = yield* mirrorStep("load-thread-history", input.loadHistory);
    const seedMessages = [...history];
    if (
      input.inboundMessage &&
      !seedMessages.some((item) => item.id === input.inboundMessage?.id)
    ) {
      seedMessages.push(input.inboundMessage);
    }
    for (const seedMessage of seedMessages) {
      yield* appendAndPublishMirrorMessage(
        input.organizationId,
        claim.chatId,
        seedMessage
      );
    }
    yield* mirrorStep("rename-chat-session", () =>
      renameChatSession(input.organizationId, claim.chatId, input.title)
    );

    return claim.chatId;
  });
}

function toolMessageId(sessionId: string, callId: string) {
  return `eve:${sessionId}:tool:${callId}`;
}

function snakeToCamel(value: string) {
  return value.replace(SNAKE_SEGMENT_REGEX, (_, letter: string) =>
    letter.toUpperCase()
  );
}

function mirrorToolPartType(toolName: string) {
  const mapped = MIRROR_TOOL_NAME_OVERRIDES[toolName] ?? snakeToCamel(toolName);
  return `tool-${mapped}` as const;
}

function truncateToolOutput(output: unknown): unknown {
  const serialized = JSON.stringify(output) ?? "";
  if (serialized.length <= MIRROR_TOOL_OUTPUT_MAX_CHARS) {
    return output;
  }
  return `${serialized.slice(0, MIRROR_TOOL_OUTPUT_MAX_CHARS)} (truncated)`;
}

export async function mirrorSessionStatus(
  ctx: SessionContext,
  status: MirrorChatStatus
): Promise<void> {
  const target = getMirrorTarget(ctx);
  if (!target) {
    return;
  }
  await runMirrorEffect(
    mirrorStep("publish-mirror-status", () =>
      Promise.all([
        publishChatMirrorStatus(target.organizationId, target.chatId, status),
        // The dashboard's chat list reads this to show the turn as running.
        setChatMirrorRunning(
          target.organizationId,
          target.chatId,
          status === "working"
        ),
      ])
    )
  );
}

export function mirrorAssistantMetadata() {
  return { model: ASSISTANT_MODEL_ID };
}

/** The id of the mirrored message for one streamed text part of a reply. */
export function assistantMessageId(sessionId: string, partId: string) {
  return `eve:${sessionId}:${partId}`;
}

function rememberDeltaBuffer(
  messageId: string,
  buffer: { mirrored: boolean; publishedAt: number; text: string }
) {
  if (deltaBuffers.size >= MIRROR_DELTA_THROTTLE_MAX_ENTRIES) {
    const oldestKey = deltaBuffers.keys().next().value;
    if (oldestKey !== undefined) {
      deltaBuffers.delete(oldestKey);
    }
  }
  deltaBuffers.set(messageId, buffer);
}

export async function mirrorAssistantDelta(
  ctx: SessionContext,
  event: ContentDelta
): Promise<void> {
  const target = getMirrorTarget(ctx);
  if (!target) {
    return;
  }

  const { data } = event;
  const messageId = assistantMessageId(target.sessionId, data.partId);
  let buffer = deltaBuffers.get(messageId);
  if (!buffer) {
    // Only the record that announces a part names its kind. Reasoning and
    // parts announced before this process saw them stay unmirrored.
    if (data.kind === undefined) {
      return;
    }
    buffer = { mirrored: data.kind === "text", publishedAt: 0, text: "" };
    rememberDeltaBuffer(messageId, buffer);
  }
  if (!buffer.mirrored) {
    return;
  }
  buffer.text += data.delta;

  const now = Date.now();
  if (
    !buffer.text.trim() ||
    now - buffer.publishedAt < MIRROR_DELTA_THROTTLE_MS
  ) {
    return;
  }
  buffer.publishedAt = now;
  const text = buffer.text;

  await runMirrorEffect(
    mirrorStep("publish-mirror-delta", () =>
      publishChatMirrorMessage(target.organizationId, target.chatId, {
        id: messageId,
        role: "assistant",
        parts: [{ type: "text", text }],
        metadata: mirrorAssistantMetadata(),
      })
    )
  );
}

export async function mirrorToolApprovals(
  ctx: MirrorEventContext,
  event: InteractionOpened
): Promise<void> {
  const { data } = event;
  if (data.request.kind !== "approval" || !("callId" in data.subject)) {
    return;
  }
  const target = getMirrorTarget(ctx);
  if (!target) {
    return;
  }

  // A subagent's approval is relayed with the child's call as its origin.
  const relayed = data.origin?.call;
  const observed = relayed ? undefined : call(ctx.view, data.subject.callId);
  const callId = relayed?.callId ?? data.subject.callId;
  const toolName = relayed?.name ?? observed?.name;
  if (!toolName) {
    return;
  }
  const message: MirrorUiMessage = {
    id: toolMessageId(target.sessionId, callId),
    role: "assistant",
    parts: [
      {
        type: mirrorToolPartType(toolName),
        toolCallId: callId,
        state: "approval-requested",
        input: (relayed ? relayed.input : observed?.input) ?? {},
        approval: { id: data.interactionId },
      },
    ],
  };
  await runMirrorEffect(
    upsertAndPublishMirrorMessage(target.organizationId, target.chatId, message)
  );
}

function findExistingToolPart(
  existing: MirrorUiMessage | null,
  callId: string
): { input: unknown; approvalId: string | null } {
  if (existing) {
    for (const part of existing.parts) {
      if ("toolCallId" in part && part.toolCallId === callId) {
        return {
          input: "input" in part ? part.input : {},
          approvalId: part.approval?.id ?? null,
        };
      }
    }
  }
  return { input: {}, approvalId: null };
}

function toolErrorText(event: CallSettled): string {
  const { error, output } = event.data;
  const message = error?.message ?? (typeof output === "string" ? output : "");
  return message
    ? message.slice(0, MIRROR_TOOL_OUTPUT_MAX_CHARS)
    : "Tool call failed";
}

export async function mirrorToolResult(
  ctx: MirrorEventContext,
  event: CallSettled
): Promise<void> {
  const { data } = event;
  const observed = call(ctx.view, data.callId);
  // Task waits and cancels and skill loads were never tool results.
  if (!(observed && (observed.kind === "tool" || observed.kind === "agent"))) {
    return;
  }
  const target = getMirrorTarget(ctx);
  if (!target) {
    return;
  }

  const messageId = toolMessageId(target.sessionId, data.callId);
  await runMirrorEffect(
    Effect.gen(function* () {
      const existing = yield* mirrorStep("load-mirror-message", () =>
        getChatMessageById(target.organizationId, target.chatId, messageId)
      );
      const stored = findExistingToolPart(existing, data.callId);
      const input = observed.input ?? stored.input;
      const { approvalId } = stored;

      const type = mirrorToolPartType(observed.name);
      let part: MirrorUiMessage["parts"][number];
      if (data.outcome === "rejected") {
        part = {
          type,
          toolCallId: data.callId,
          state: "output-denied",
          input,
          approval: {
            id: approvalId ?? data.callId,
            approved: false,
            reason: "discard",
          },
        };
      } else if (data.outcome === "completed") {
        part = {
          type,
          toolCallId: data.callId,
          state: "output-available",
          input,
          output: truncateToolOutput(
            data.output ?? observed.output ?? data.outputRef?.preview ?? null
          ),
          ...(approvalId
            ? { approval: { id: approvalId, approved: true as const } }
            : {}),
        };
      } else {
        part = {
          type,
          toolCallId: data.callId,
          state: "output-error",
          input,
          errorText: toolErrorText(event),
        };
      }

      const message: MirrorUiMessage = {
        id: messageId,
        role: "assistant",
        parts: [part],
      };
      yield* upsertAndPublishMirrorMessage(
        target.organizationId,
        target.chatId,
        message
      );
    })
  );
}
