import {
  chatErrorPayloadSchema,
  chatMessageMetadataSchema,
  uiMessageSchema,
} from "@notra/ai/schemas/chat";
import type { ChatUIMessage } from "@notra/ai/types/chat";

export class SlackRelayError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super(`Failed to send message to Slack (${status})`);
    this.status = status;
    this.code = code;
  }
}

export async function relaySlackMirrorMessage(
  organizationId: string,
  chatId: string,
  text: string
): Promise<ChatUIMessage | null> {
  const res = await fetch(
    `/api/organizations/${organizationId}/chat/${encodeURIComponent(chatId)}/relay`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) {
    const payload = chatErrorPayloadSchema.safeParse(
      await res.json().catch(() => null)
    );
    throw new SlackRelayError(
      res.status,
      payload.success ? payload.data.code : undefined
    );
  }
  const data = await res.json();
  const parsed = uiMessageSchema.safeParse(data?.message);
  if (!parsed.success) {
    return null;
  }
  const metadata = chatMessageMetadataSchema.safeParse(parsed.data.metadata);
  return {
    ...parsed.data,
    metadata: metadata.success ? metadata.data : undefined,
  };
}

export async function relaySlackApproval(
  organizationId: string,
  chatId: string,
  requestId: string,
  approved: boolean
): Promise<void> {
  const res = await fetch(
    `/api/organizations/${organizationId}/chat/${encodeURIComponent(chatId)}/relay-approval`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, approved }),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to send the approval to Slack");
  }
}
