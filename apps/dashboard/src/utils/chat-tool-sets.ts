import type { ToolSet } from "@notra/ai/types/orchestration";

/**
 * One extra tool set for the chat. Each set still decides whether its own
 * tools may skip approval.
 */
export function mergeChatToolSets(
  ...sets: (ToolSet | undefined)[]
): ToolSet | undefined {
  const present = sets.filter((set): set is ToolSet => set !== undefined);
  if (present.length === 0) {
    return undefined;
  }
  return {
    tools: Object.assign({}, ...present.map((set) => set.tools)),
    descriptions: present.flatMap((set) => set.descriptions),
    approvalToolNames: present.flatMap((set) => set.approvalToolNames ?? []),
    skipsApproval: async (toolName, input) => {
      const owner = present.find((set) => Object.hasOwn(set.tools, toolName));
      return (await owner?.skipsApproval?.(toolName, input)) ?? false;
    },
  };
}
