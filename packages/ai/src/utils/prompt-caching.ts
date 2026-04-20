import { ANTHROPIC_PROMPT_CACHING_OPTIONS } from "@notra/ai/constants/prompt-caching";
import type { ModelMessage } from "ai";

// Put the cache breakpoint on the latest user message. The actual "last
// message" flips between user/assistant/tool across multi-step generations,
// so caching there invalidates the prefix every step. The last user turn is
// a stable anchor — everything before it (system, tools, prior turns) gets
// reused from cache on subsequent steps within the same request.
export function addAnthropicPromptCaching(
  messages: ModelMessage[],
  modelId: string
): ModelMessage[] {
  if (messages.length === 0 || !isAnthropicModel(modelId)) {
    return messages;
  }

  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index !== lastUserIndex) {
      return message;
    }

    return {
      ...message,
      providerOptions: {
        ...message.providerOptions,
        anthropic: {
          ...message.providerOptions?.anthropic,
          ...ANTHROPIC_PROMPT_CACHING_OPTIONS.anthropic,
        },
      },
    };
  });
}

function isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith("anthropic/") || modelId.includes("claude");
}
