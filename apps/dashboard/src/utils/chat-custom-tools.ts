import { getToolName } from "ai";

import type { ChatCustomTools } from "@/types/components/chat-conversation";

/** One set of host-rendered tools; each tool renders with the set that names it. */
export function mergeChatCustomTools(
  ...sets: ChatCustomTools[]
): ChatCustomTools {
  return {
    names: new Set(sets.flatMap((set) => [...set.names])),
    render: (part, context) =>
      sets
        .find((set) => set.names.has(getToolName(part)))
        ?.render(part, context) ?? null,
  };
}
