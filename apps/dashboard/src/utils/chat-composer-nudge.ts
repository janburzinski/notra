import type { ChatComposerNudgeProps } from "@/types/components/chat-composer-parts";

/** Whether the sheet above the composer has anything to show. */
export function hasChatComposerNudge(
  props: Pick<
    ChatComposerNudgeProps,
    | "chips"
    | "editingTarget"
    | "queuedMessages"
    | "taggedSkills"
    | "context"
    | "selection"
    | "attachments"
    | "pendingUploads"
    | "shouldShowLowCredits"
    | "usageLimitError"
  >
): boolean {
  return (
    hasNudgeChips(props) ||
    props.shouldShowLowCredits ||
    Boolean(props.usageLimitError)
  );
}

export function hasNudgeChips({
  chips,
  editingTarget,
  queuedMessages,
  taggedSkills,
  context,
  selection,
  attachments,
  pendingUploads,
}: Pick<
  ChatComposerNudgeProps,
  | "chips"
  | "editingTarget"
  | "queuedMessages"
  | "taggedSkills"
  | "context"
  | "selection"
  | "attachments"
  | "pendingUploads"
>): boolean {
  return (
    Boolean(chips) ||
    Boolean(editingTarget) ||
    queuedMessages.length > 0 ||
    taggedSkills.length > 0 ||
    context.length > 0 ||
    Boolean(selection) ||
    attachments.length > 0 ||
    pendingUploads.length > 0
  );
}
