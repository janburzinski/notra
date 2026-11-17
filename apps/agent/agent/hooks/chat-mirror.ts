import { getSessionAttribute } from "@notra/tools/utils/session";
import { defineHook } from "eve/hooks";

import {
  appendAndPublishMirrorMessage,
  assistantMessageId,
  mirrorAssistantMetadata,
  resolveMirrorChatId,
  runMirrorEffect,
} from "../lib/utils/chat-mirror";

export default defineHook({
  events: {
    async "content.completed"(event, ctx) {
      // Narration before tool calls and reasoning stay out of the mirror; only
      // the text that answers the turn is stored.
      const { interrupted, kind, partId, phase, value } = event.data;
      if (kind !== "text" || phase !== "reply" || interrupted) {
        return;
      }
      const messageText = typeof value === "string" ? value : "";
      if (!messageText.trim()) {
        return;
      }

      const organizationId = getSessionAttribute(ctx, "organizationId");
      const chatId = resolveMirrorChatId(ctx);
      if (!(organizationId && chatId)) {
        return;
      }

      await runMirrorEffect(
        appendAndPublishMirrorMessage(organizationId, chatId, {
          id: assistantMessageId(ctx.session.id, partId),
          role: "assistant",
          parts: [{ type: "text", text: messageText }],
          metadata: mirrorAssistantMetadata(),
        })
      );
    },
  },
});
