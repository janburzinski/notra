import { chatErrorPayloadSchema } from "@notra/ai/schemas/chat";

import { TECHNICAL_CHAT_ERROR } from "@/constants/chat-stream";
import type {
  ChatErrorMessages,
  HandleStandaloneChatErrorOptions,
} from "@/utils/chat-error-types";

function getStandaloneChatErrorMessage(
  err: Error,
  messages: ChatErrorMessages
) {
  const errorMessage = err.message || String(err);

  const parsed = (() => {
    try {
      return chatErrorPayloadSchema.safeParse(JSON.parse(errorMessage));
    } catch {
      return null;
    }
  })();

  if (parsed?.success && parsed.data.code === "USAGE_LIMIT_REACHED") {
    return {
      message: messages.usageLimit,
      shouldLog: false,
      isUsageLimit: true,
    };
  }

  // A request that never got through says so in words people can act on,
  // not "fetch failed".
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      message: messages.offline ?? messages.fallback,
      shouldLog: false,
      isUsageLimit: false,
    };
  }

  if (parsed?.success && parsed.data.error) {
    return {
      message: TECHNICAL_CHAT_ERROR.test(parsed.data.error)
        ? messages.fallback
        : parsed.data.error,
      shouldLog: TECHNICAL_CHAT_ERROR.test(parsed.data.error),
      isUsageLimit: false,
    };
  }

  if (
    errorMessage.includes("USAGE_LIMIT_REACHED") ||
    errorMessage.includes("Usage limit reached")
  ) {
    return {
      message: messages.usageLimit,
      shouldLog: false,
      isUsageLimit: true,
    };
  }

  return {
    message:
      errorMessage.trim() && !TECHNICAL_CHAT_ERROR.test(errorMessage)
        ? errorMessage
        : messages.fallback,
    shouldLog: true,
    isUsageLimit: false,
  };
}

export function handleStandaloneChatError(
  err: Error,
  {
    setChatError,
    setPendingMessageId,
    messages,
  }: HandleStandaloneChatErrorOptions
) {
  const { message, shouldLog, isUsageLimit } = getStandaloneChatErrorMessage(
    err,
    messages
  );

  if (shouldLog) {
    console.error("Standalone chat error:", err);
  }

  setChatError(message);
  setPendingMessageId?.(null);
  return { isUsageLimit };
}
