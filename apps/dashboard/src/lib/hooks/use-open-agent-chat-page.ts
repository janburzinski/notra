"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { usePathname, useRouter } from "@/lib/navigation";
import type { UseOpenAgentChatPageOptions } from "@/types/hooks/agent-panel";
import { dashboardAgentOpenChatPath } from "@/utils/dashboard-agent-chat-path";

/**
 * Opens the agent's conversation on the chat page, and closes the panel once
 * the page has changed, or right away when it's already there.
 */
export function useOpenAgentChatPage({
  organizationSlug,
  chatId,
  onClose,
  hasConversation,
}: UseOpenAgentChatPageOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const closeAfterNavigationRef = useRef(false);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!closeAfterNavigationRef.current) {
      return;
    }
    closeAfterNavigationRef.current = false;
    close();
  }, [pathname]);

  return () => {
    const path = dashboardAgentOpenChatPath(organizationSlug, {
      chatId,
      hasConversation: hasConversation(),
    });
    if (pathname === path) {
      onClose();
      return;
    }
    closeAfterNavigationRef.current = true;
    router.prefetch(path);
    router.push(path, { scroll: false });
  };
}
