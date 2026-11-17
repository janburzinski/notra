"use client";

import type { ChatSessionSummary } from "@notra/ai/types/chat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const EMPTY_FINISHED_IDS: string[] = [];

function finishedUnseenQueryKey(organizationId: string | undefined) {
  return ["chat-finished-unseen", organizationId] as const;
}

/**
 * Chats that finished while another chat was open, so the sidebar can mark
 * replies nobody has looked at yet. The list lives in the
 * query cache, so it outlasts the sidebar switching panels.
 */
export function useChatRunState({
  organizationId,
  sessions,
  currentChatId,
}: {
  organizationId: string | undefined;
  sessions: ChatSessionSummary[];
  currentChatId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const { data: finishedIds = EMPTY_FINISHED_IDS } = useQuery({
    queryKey: finishedUnseenQueryKey(organizationId),
    queryFn: async () => EMPTY_FINISHED_IDS,
    enabled: false,
    initialData: EMPTY_FINISHED_IDS,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const previousRunningRef = useRef<Set<string> | null>(null);

  const runningIds = new Set(
    sessions
      .filter((session) => session.isRunning)
      .map((session) => session.chatId)
  );
  const runningKey = [...runningIds].sort().join(",");

  useEffect(() => {
    const running = new Set(runningKey ? runningKey.split(",") : []);
    const previous = previousRunningRef.current;
    previousRunningRef.current = running;
    // The first list after mounting has nothing to compare against.
    if (!previous) {
      return;
    }
    const justFinished = [...previous].filter(
      (chatId) => !running.has(chatId) && chatId !== currentChatId
    );
    if (justFinished.length === 0) {
      return;
    }
    queryClient.setQueryData<string[]>(
      finishedUnseenQueryKey(organizationId),
      (current = []) => [...new Set([...current, ...justFinished])]
    );
  }, [currentChatId, organizationId, queryClient, runningKey]);

  useEffect(() => {
    if (!currentChatId) {
      return;
    }
    queryClient.setQueryData<string[]>(
      finishedUnseenQueryKey(organizationId),
      (current = []) =>
        current.includes(currentChatId)
          ? current.filter((chatId) => chatId !== currentChatId)
          : current
    );
  }, [currentChatId, organizationId, queryClient]);

  return {
    finishedUnseenIds: new Set(finishedIds),
  };
}
