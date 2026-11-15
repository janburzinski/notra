import { AutopilotWorkflowDraftPreview } from "@/components/autopilot/autopilot-workflow-draft-preview";
import { AUTOPILOT_WORKFLOW_PREVIEW_TOOLS } from "@/constants/autopilot-workflows";
import type { AutopilotWorkflowDraftToolsOptions } from "@/types/autopilot-workflows";
import type { ChatCustomTools } from "@/types/components/chat-conversation";
import { readAutopilotWorkflowDraft } from "@/utils/autopilot-workflow-draft";

/**
 * Shows the agent's workflow saves in the chat. The latest one shows in full
 * unless the preview sits elsewhere; earlier saves were replaced, so stay small.
 */
export function autopilotWorkflowDraftTools({
  latestToolCallId,
  compactAll = false,
}: AutopilotWorkflowDraftToolsOptions): ChatCustomTools {
  return {
    names: AUTOPILOT_WORKFLOW_PREVIEW_TOOLS,
    render: (part, { onApprove, onDeny }) => {
      const draft = readAutopilotWorkflowDraft(part);
      return draft ? (
        <div className="py-1">
          <AutopilotWorkflowDraftPreview
            draft={draft}
            onApprove={onApprove}
            onDeny={onDeny}
            variant={
              compactAll || draft.toolCallId !== latestToolCallId
                ? "compact"
                : "inline"
            }
          />
        </div>
      ) : null;
    },
  };
}
