import { getToolName, isToolUIPart, type UIMessage } from "ai";

const TERMINAL_APPROVAL_STEP_STATES = new Set([
  "output-available",
  "output-error",
  "output-denied",
  "approval-responded",
]);

export function isTerminalToolState(state: string): boolean {
  return (
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied"
  );
}

export function hasPendingApproval(messages: readonly UIMessage[]): boolean {
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      if (isToolUIPart(part) && part.state === "approval-requested") {
        return true;
      }
    }
  }
  return false;
}

export function shouldContinueAfterApprovalResponse({
  messages,
}: {
  messages: UIMessage[];
}): boolean {
  const message = messages.at(-1);

  if (!message || message.role !== "assistant") {
    return false;
  }

  const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => {
    return part.type === "step-start" ? index : lastIndex;
  }, -1);

  const toolParts = message.parts
    .slice(lastStepStartIndex + 1)
    .filter(isToolUIPart);

  const approvalResponses = toolParts.filter(
    (part) => part.state === "approval-responded"
  );

  return (
    approvalResponses.length > 0 &&
    approvalResponses.every((part) => part.approval.approved) &&
    toolParts.every((part) => TERMINAL_APPROVAL_STEP_STATES.has(part.state))
  );
}

/**
 * The approval the user declined for one of these tools, when the last step
 * ended on it with nothing else still open; null otherwise.
 */
export function findContinuableDenial(
  messages: UIMessage[],
  toolNames: ReadonlySet<string>
): string | null {
  const message = messages.at(-1);
  if (!message || message.role !== "assistant") {
    return null;
  }
  const lastStepStartIndex = message.parts.findLastIndex(
    (part) => part.type === "step-start"
  );
  const toolParts = message.parts
    .slice(lastStepStartIndex + 1)
    .filter(isToolUIPart);
  if (
    !toolParts.every((part) => TERMINAL_APPROVAL_STEP_STATES.has(part.state))
  ) {
    return null;
  }
  const denied = toolParts.find(
    (part) =>
      part.state === "approval-responded" &&
      !part.approval.approved &&
      toolNames.has(getToolName(part))
  );
  return denied?.state === "approval-responded" ? denied.approval.id : null;
}
