import { ANTHROPIC_PROMPT_CACHING_OPTIONS } from "@notra/ai/constants/prompt-caching";
import type { ModelMessage } from "ai";

export function addAnthropicPromptCaching(
  messages: ModelMessage[],
  modelId: string
): ModelMessage[] {
  if (messages.length === 0 || !isAnthropicModel(modelId)) {
    return messages;
  }

  const lastIndex = messages.length - 1;
  const stableBoundaryIndex = findStableBoundaryIndex(messages, lastIndex);

  return messages.map((message, index) => {
    if (index !== lastIndex && index !== stableBoundaryIndex) {
      return message;
    }

    return withCacheControl(message);
  });
}

export function withCacheControl(message: ModelMessage): ModelMessage {
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
}

export function isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith("anthropic/");
}

function findStableBoundaryIndex(
  messages: ModelMessage[],
  lastIndex: number
): number {
  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const role = messages[index]?.role;
    if (role === "assistant" || role === "tool") {
      return index;
    }
  }
  return -1;
}
