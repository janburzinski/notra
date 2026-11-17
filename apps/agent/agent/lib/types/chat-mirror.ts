import type { appendChatMessageIfMissing } from "@notra/ai/chat/history";
import type { SessionContext } from "eve/context";
import type { SessionView } from "eve/events";

export type MirrorUiMessage = Parameters<typeof appendChatMessageIfMissing>[2];

export interface MirrorTarget {
  organizationId: string;
  chatId: string;
  sessionId: string;
}

/** A hook's or channel handler's context: the session, and its view as of the event. */
export type MirrorEventContext = SessionContext & {
  readonly view: SessionView;
};
