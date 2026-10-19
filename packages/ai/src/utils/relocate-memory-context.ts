import type { LanguageModelMiddleware } from "ai";

type CallOptions = Parameters<
  NonNullable<LanguageModelMiddleware["transformParams"]>
>[0]["params"];
type Prompt = CallOptions["prompt"];

const MEMORY_BLOCK =
  /(?:\r?\n)?<supermemory context="user-memories" readonly>[\s\S]*?<\/supermemory>/g;

/**
 * Supermemory appends recalled memories to the system prompt, and they change
 * with every user message. Anything after a change is a prompt-cache miss, so
 * the tool definitions, system prompt, and whole history were re-written on
 * every turn. Moving the block onto the latest user message keeps that prefix
 * byte-identical; the memories still arrive in the same request.
 */
export function relocateMemoryContext(prompt: Prompt): Prompt {
  const blocks: string[] = [];
  const withoutMemory = prompt.map((message) => {
    if (message.role !== "system") {
      return message;
    }
    const content = message.content.replace(MEMORY_BLOCK, (block) => {
      blocks.push(block.trim());
      return "";
    });
    return content === message.content ? message : { ...message, content };
  });
  const lastUserIndex = withoutMemory.findLastIndex(
    (message) => message.role === "user"
  );
  const lastUser = withoutMemory[lastUserIndex];
  if (blocks.length === 0 || !lastUser || lastUser.role !== "user") {
    return prompt;
  }
  withoutMemory[lastUserIndex] = {
    ...lastUser,
    content: [...lastUser.content, { type: "text", text: blocks.join("\n") }],
  };
  return withoutMemory;
}

export const relocateMemoryContextMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  transformParams: ({ params }) =>
    Promise.resolve({
      ...params,
      prompt: relocateMemoryContext(params.prompt),
    }),
};
