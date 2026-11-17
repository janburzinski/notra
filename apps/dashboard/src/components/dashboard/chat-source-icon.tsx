import { Slack } from "@notra/ui/components/ui/svgs/slack";

import { cn } from "@/lib/utils";
import type { ChatSourceIconProps } from "@/types/components/chat-history";

/** Marks chats mirrored from Slack; dashboard chats have no icon. */
export function ChatSourceIcon({ source, className }: ChatSourceIconProps) {
  if (source !== "slack") {
    return null;
  }
  // Slack's mark fills its whole box, so it is drawn smaller than other icons;
  // `!` beats the sidebar button's svg sizing.
  return (
    <Slack
      aria-hidden
      className={cn("size-3! min-h-3! min-w-3! shrink-0", className)}
    />
  );
}
