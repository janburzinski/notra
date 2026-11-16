import type { ToolSet } from "@notra/ai/types/orchestration";

import { CHAT_GEO_TOOLING_NOTE } from "@/constants/chat-extra-tools";
import { buildAutomationChatTools } from "@/lib/automation/chat-tools";
import { buildAutopilotWorkflowTools } from "@/lib/autopilot/workflows/agent-tools";
import { mergeChatToolSets } from "@/utils/chat-tool-sets";

/** The dashboard's own tools for the chat agent: Autopilot and Automations. */
export async function buildChatExtraTools(
  params: Parameters<typeof buildAutopilotWorkflowTools>[0]
): Promise<ToolSet | undefined> {
  const autopilot = await buildAutopilotWorkflowTools(params);
  return mergeChatToolSets(
    { tools: {}, descriptions: [CHAT_GEO_TOOLING_NOTE] },
    autopilot,
    buildAutomationChatTools({
      organizationId: params.organizationId,
      userId: params.userId,
    })
  );
}
