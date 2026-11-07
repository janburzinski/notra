"use client";

import { useChat } from "@ai-sdk/react";
import { uiMessageSchema } from "@notra/ai/schemas/chat";
import type { ChatAttachment, ChatSessionSummary } from "@notra/ai/types/chat";
import {
  dashboardAgentChatHistoryQueryKey,
  dashboardAgentChatSessionsQueryKey,
} from "@notra/ai/utils/chat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { QueuedMessage } from "@/components/chat/chat-queue";
import {
  AGENT_QUESTION_DISMISSED,
  AGENT_QUESTION_TOOL_NAME,
} from "@/constants/agent-questions";
import { AUTOPILOT_AGENT_CONTINUES_AFTER_DENIAL } from "@/constants/autopilot-workflows";
import { emitAutumnRefresh } from "@/lib/billing/autumn-refresh";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useChatEffort } from "@/lib/hooks/use-chat-effort";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AgentQuestionAnswer } from "@/types/agent-questions";
import type { ContentChatInputHandle } from "@/types/components/chat-input";
import type { UseDashboardAgentChatOptions } from "@/types/components/dashboard-agent";
import type { AgentPanelPrompt } from "@/types/components/right-panel";
import {
  findPendingAgentQuestion,
  findSettledAgentQuestion,
} from "@/utils/agent-questions";
import {
  hasPendingApproval,
  findContinuableDenial,
  shouldContinueAfterApprovalResponse,
} from "@/utils/chat-approvals";
import { handleStandaloneChatError } from "@/utils/chat-error";
import { buildUserMessageParts } from "@/utils/chat-message-parts";
import {
  markQueuedMessageSteering,
  shouldDrainQueueAfterFinish,
} from "@/utils/chat-queue";

/**
 * The dashboard agent's conversation: sending, queueing, steering, stopping,
 * approvals, questions and switching threads. Whoever renders it owns the UI.
 */

export function useDashboardAgentChat({
  organizationId,
  loadSessions,
  autopilotWorkflowId,
  autopilotAutomation,
}: UseDashboardAgentChatOptions) {
  const t = useTranslations("dashboard.agent");
  const tChatErrors = useTranslations("chat.errors");
  const queryClient = useQueryClient();
  const [chatInputValue, setChatInputValue] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string>(() =>
    crypto.randomUUID()
  );
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const messagesRef = useRef<UIMessage[]>([]);
  const isAgentBusyRef = useRef(false);
  const { projectId: activeProjectId, isResolved: isProjectResolved } =
    useActiveProject();
  const effort = useChatEffort();
  const { thinkingLevel } = effort;
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const queuedMessagesRef = useRef<QueuedMessage[]>([]);
  const steerAfterStopRef = useRef<QueuedMessage | null>(null);
  // Steering sends only once the stop request has returned AND the old
  // response has finished, so a late stop() can't abort the steered message.
  const steerStopPendingRef = useRef(false);
  // The queued message currently being sent; restored to the queue if it fails.
  const inFlightQueuedRef = useRef<{
    message: QueuedMessage;
    messageCount: number;
  } | null>(null);
  const wasStoppedByUserRef = useRef(false);
  const drainQueueRef = useRef<() => void>(() => {});
  const flushSteerRef = useRef<() => void>(() => {});
  const chatInputRef = useRef<ContentChatInputHandle | null>(null);
  // Read when a request goes out, so each message carries the page it was
  // sent from, including the sends after an answer or an approval.
  const focusRef = useRef({ autopilotWorkflowId, autopilotAutomation });
  useEffect(() => {
    focusRef.current = { autopilotWorkflowId, autopilotAutomation };
  }, [autopilotAutomation, autopilotWorkflowId]);
  // Questions the user settled here that still owe the agent a resend; each
  // goes back once, so a double press or a stale state can't send twice.
  const unsentAnswersRef = useRef(new Set<string>());
  // Workflows the user discarded with the button. Sending a message also
  // declines what's waiting, but then the message itself goes out, so the
  // agent isn't sent back a second time alongside it.
  const discardedApprovalsRef = useRef(new Set<string>());
  /** Whether the turn ended on a Discard press that still owes the agent a send. */
  const isPressedDiscard = (current: UIMessage[], claim: boolean) => {
    const approvalId = findContinuableDenial(
      current,
      AUTOPILOT_AGENT_CONTINUES_AFTER_DENIAL
    );
    if (!(approvalId && discardedApprovalsRef.current.has(approvalId))) {
      return false;
    }
    if (claim) {
      discardedApprovalsRef.current.delete(approvalId);
    }
    return true;
  };

  const updateQueue = useCallback((next: QueuedMessage[]) => {
    queuedMessagesRef.current = next;
    setQueuedMessages(next);
  }, []);

  const sessionsQuery = useQuery<ChatSessionSummary[]>({
    queryKey: dashboardAgentChatSessionsQueryKey(organizationId),
    queryFn: async () => {
      const { sessions } = await dashboardOrpcClient.chat.sessions.list({
        organizationId,
      });
      return sessions;
    },
    enabled: loadSessions,
    staleTime: 60_000,
  });
  const sessions = (sessionsQuery.data ?? []).filter(
    (session) =>
      !session.externalChannelId || session.externalChannelId.source === "agent"
  );

  const transport = useMemo(
    () =>
      // react-doctor-disable-next-line react-hooks-js/refs -- the transport only reads these refs inside fetch callbacks, never during render
      new DefaultChatTransport({
        api: `/api/organizations/${organizationId}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            chatId: activeChatId,
            projectId:
              isProjectResolved && activeProjectId
                ? activeProjectId
                : undefined,
            thinkingLevel,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            // A response stopped before its first chunk leaves an empty
            // assistant message, which the request schema rejects.
            messages: messages.filter((message) => message.parts.length > 0),
            surface: "dashboard-agent",
            ...focusRef.current,
          },
        }),
        fetch: async (input, init) => {
          const triggerResponse = await fetch(input, init);
          if (!triggerResponse.ok) {
            return triggerResponse;
          }

          const contentType = triggerResponse.headers.get("content-type") ?? "";
          if (contentType.includes("text/event-stream")) {
            return triggerResponse;
          }

          return fetch(
            `/api/organizations/${organizationId}/chat/${encodeURIComponent(activeChatId)}/stream`,
            {
              method: "GET",
              headers: init?.headers,
              credentials: init?.credentials,
              signal: init?.signal,
            }
          );
        },
      }),
    [
      activeChatId,
      activeProjectId,
      isProjectResolved,
      organizationId,
      thinkingLevel,
    ]
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    addToolOutput,
  } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages: current }) => {
      if (
        shouldContinueAfterApprovalResponse({ messages: current }) ||
        // A discarded workflow goes back to the agent, so it asks what to
        // change instead of leaving the user to start over.
        isPressedDiscard(current, true)
      ) {
        return true;
      }
      const answered = findSettledAgentQuestion(current);
      return answered !== null && unsentAnswersRef.current.delete(answered);
    },
    onFinish: ({
      messages: finishedMessages,
      isAbort,
      isDisconnect,
      isError,
    }) => {
      messagesRef.current = finishedMessages;
      if (!isError) {
        inFlightQueuedRef.current = null;
      }
      emitAutumnRefresh();
      if (activeChatId) {
        queryClient.setQueryData(
          dashboardAgentChatHistoryQueryKey(organizationId, activeChatId),
          finishedMessages
        );
      }
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-sessions", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["chat-history", organizationId, activeChatId],
        }),
        // The agent may have built or run an Autopilot workflow.
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.autopilot.workflows.key(),
        }),
      ]).catch((invalidateError) => {
        console.error("Failed to refresh agent chat sessions", invalidateError);
      });
      isAgentBusyRef.current = false;
      if (steerAfterStopRef.current) {
        flushSteerRef.current();
        return;
      }
      if (
        shouldDrainQueueAfterFinish({
          isAbort,
          isError,
          isDisconnect,
          wasStoppedByUser: wasStoppedByUserRef.current,
        })
      ) {
        drainQueueRef.current();
      }
    },
    onError: (err) => {
      isAgentBusyRef.current = false;
      unsentAnswersRef.current.clear();
      const failed = inFlightQueuedRef.current;
      if (failed) {
        inFlightQueuedRef.current = null;
        setMessages((current) => current.slice(0, failed.messageCount));
        updateQueue([failed.message, ...queuedMessagesRef.current]);
      }
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-sessions", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["chat-history", organizationId, activeChatId],
        }),
      ]).catch((invalidateError) => {
        console.error("Failed to refresh agent chat sessions", invalidateError);
      });
      queryClient
        .invalidateQueries({
          queryKey: dashboardAgentChatHistoryQueryKey(
            organizationId,
            activeChatId
          ),
        })
        .catch((invalidateError) => {
          console.error(
            "Failed to refresh agent chat history",
            invalidateError
          );
        });

      // Shown where the input is, with a way to try again.
      handleStandaloneChatError(err, {
        setChatError,
        messages: {
          usageLimit: tChatErrors("usageLimit"),
          fallback: tChatErrors("agentFallback"),
          offline: tChatErrors("offline"),
        },
      });
    },
  });

  const isAgentBusy = status === "streaming" || status === "submitted";
  useLayoutEffect(() => {
    messagesRef.current = messages;
    isAgentBusyRef.current = isAgentBusy || isHydratingHistory;
  }, [isAgentBusy, isHydratingHistory, messages]);

  const resetQueue = () => {
    unsentAnswersRef.current.clear();
    steerAfterStopRef.current = null;
    steerStopPendingRef.current = false;
    inFlightQueuedRef.current = null;
    wasStoppedByUserRef.current = false;
    updateQueue([]);
  };

  const handleSelectChat = async (chatId: string) => {
    if (isAgentBusyRef.current || chatId === activeChatId) {
      return;
    }
    isAgentBusyRef.current = true;
    setIsHydratingHistory(true);
    try {
      const history = await queryClient.fetchQuery({
        queryKey: dashboardAgentChatHistoryQueryKey(organizationId, chatId),
        queryFn: async () => {
          const payload = await dashboardOrpcClient.chat.sessions.get({
            organizationId,
            chatId,
          });
          return uiMessageSchema.array().parse(payload.messages);
        },
        staleTime: 0,
      });
      setChatInputValue("");
      setChatError(null);
      resetQueue();
      setMessages(history);
      setActiveChatId(chatId);
    } catch {
      toast.error(t("historyLoadFailed"));
    }
    setIsHydratingHistory(false);
    isAgentBusyRef.current = false;
  };

  const handleNewChat = () => {
    if (isAgentBusyRef.current) {
      return;
    }
    setChatInputValue("");
    setChatError(null);
    resetQueue();
    if (messagesRef.current.length === 0) {
      return;
    }
    setMessages([]);
    setActiveChatId(crypto.randomUUID());
  };

  const handleApproveTool = (approvalId: string) => {
    addToolApprovalResponse({
      id: approvalId,
      approved: true,
    });
  };

  const handleDenyTool = (approvalId: string) => {
    discardedApprovalsRef.current.add(approvalId);
    addToolApprovalResponse({
      id: approvalId,
      approved: false,
      reason: "discard",
    });
  };

  const settleQuestion = (
    toolCallId: string,
    result:
      | { output: { answers: AgentQuestionAnswer[] } }
      | { state: "output-error"; errorText: string }
  ) => {
    if (unsentAnswersRef.current.has(toolCallId)) {
      return;
    }
    unsentAnswersRef.current.add(toolCallId);
    isAgentBusyRef.current = true;
    wasStoppedByUserRef.current = false;
    Promise.resolve(
      addToolOutput({ tool: AGENT_QUESTION_TOOL_NAME, toolCallId, ...result })
    ).catch((error: unknown) => {
      unsentAnswersRef.current.delete(toolCallId);
      isAgentBusyRef.current = false;
      console.error("Failed to answer the agent's question", error);
    });
  };

  const answerQuestion = (toolCallId: string, answers: AgentQuestionAnswer[]) =>
    settleQuestion(toolCallId, { output: { answers } });

  /** The agent hears that the user skipped its questions, and carries on. */
  const dismissQuestion = (toolCallId: string) =>
    settleQuestion(toolCallId, {
      state: "output-error",
      errorText: AGENT_QUESTION_DISMISSED,
    });

  const dispatchMessage = async (
    instruction: string,
    attachments: ChatAttachment[] = []
  ) => {
    // A message sent while the agent waits on questions answers the first.
    const pending = findPendingAgentQuestion(messagesRef.current);
    if (pending && attachments.length === 0) {
      answerQuestion(
        pending.toolCallId,
        pending.questions.map((_, index) => (index === 0 ? [instruction] : []))
      );
      return;
    }
    for (const message of messagesRef.current) {
      if (message.role !== "assistant") {
        continue;
      }
      for (const part of message.parts) {
        if (!(isToolUIPart(part) && part.state === "approval-requested")) {
          continue;
        }
        const approvalId = part.approval?.id;
        if (!approvalId) {
          continue;
        }
        addToolApprovalResponse({
          id: approvalId,
          approved: false,
          reason: "discard",
        });
      }
    }
    isAgentBusyRef.current = true;
    wasStoppedByUserRef.current = false;
    if (attachments.length > 0) {
      await sendMessage({
        role: "user",
        parts: buildUserMessageParts(instruction, attachments),
      });
      return;
    }
    await sendMessage({ text: instruction });
  };

  const handleSend = async (
    instruction: string,
    attachments: ChatAttachment[] = []
  ) => {
    if (!activeChatId) {
      return;
    }
    if (isAgentBusyRef.current) {
      updateQueue([
        ...queuedMessagesRef.current,
        {
          id: nanoid(10),
          text: instruction,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      ]);
      return;
    }
    await dispatchMessage(instruction, attachments);
  };

  /** Sends a prompt from elsewhere, such as a suggestion or another page. */
  const sendPrompt = (
    prompt: Pick<AgentPanelPrompt, "text" | "attachments">
  ) => {
    handleSend(prompt.text, prompt.attachments ?? []).catch((error) => {
      console.error("Failed to send agent prompt", error);
    });
  };

  const dispatchQueued = (message: QueuedMessage) => {
    updateQueue(queuedMessagesRef.current.filter((m) => m.id !== message.id));
    inFlightQueuedRef.current = {
      message,
      messageCount: messagesRef.current.length,
    };
    dispatchMessage(message.text, message.attachments).catch((error) => {
      console.error("Failed to send queued agent message", error);
      isAgentBusyRef.current = false;
      if (inFlightQueuedRef.current?.message.id === message.id) {
        inFlightQueuedRef.current = null;
        updateQueue([message, ...queuedMessagesRef.current]);
      }
    });
  };

  const flushSteer = () => {
    const steered = steerAfterStopRef.current;
    if (!steered || steerStopPendingRef.current || isAgentBusyRef.current) {
      return;
    }
    steerAfterStopRef.current = null;
    const queued = queuedMessagesRef.current.find((m) => m.id === steered.id);
    if (queued) {
      dispatchQueued({ ...queued, steering: false });
    }
  };

  useEffect(() => {
    flushSteerRef.current = flushSteer;
    drainQueueRef.current = () => {
      const current = messagesRef.current;
      if (
        isAgentBusyRef.current ||
        wasStoppedByUserRef.current ||
        steerAfterStopRef.current ||
        hasPendingApproval(current) ||
        // A queued message would answer the agent's open questions for the user.
        findPendingAgentQuestion(current) !== null ||
        // The SDK resends on its own after an approval or an answer; draining
        // now would double-submit.
        shouldContinueAfterApprovalResponse({ messages: current }) ||
        isPressedDiscard(current, false) ||
        unsentAnswersRef.current.size > 0
      ) {
        return;
      }
      const next = queuedMessagesRef.current[0];
      if (next) {
        dispatchQueued(next);
      }
    };
  });

  const stopResponse = useCallback(async () => {
    const response = await fetch(
      `/api/organizations/${organizationId}/chat/${encodeURIComponent(activeChatId)}/stop`,
      { method: "POST" }
    ).catch((stopError) => {
      console.error("Failed to stop dashboard agent response", stopError);
      return null;
    });

    if (!response?.ok) {
      if (response) {
        console.error(
          `Failed to stop dashboard agent response: status ${response.status}`
        );
      }
      toast.error(t("stopFailed"));
      return false;
    }

    stop();
    return true;
  }, [activeChatId, organizationId, stop, t]);

  const handleStop = async () => {
    steerAfterStopRef.current = null;
    steerStopPendingRef.current = false;
    wasStoppedByUserRef.current = true;
    updateQueue(
      queuedMessagesRef.current.map((message) => ({
        ...message,
        steering: false,
      }))
    );
    await stopResponse();
  };

  const handleRemoveQueued = (id: string) => {
    if (steerAfterStopRef.current?.id === id) {
      steerAfterStopRef.current = null;
    }
    updateQueue(queuedMessagesRef.current.filter((m) => m.id !== id));
  };

  const handleEditQueued = (message: QueuedMessage) => {
    if (
      message.attachments?.length &&
      !chatInputRef.current?.setAttachments(message.attachments)
    ) {
      return;
    }
    if (steerAfterStopRef.current?.id === message.id) {
      steerAfterStopRef.current = null;
    }
    updateQueue(queuedMessagesRef.current.filter((m) => m.id !== message.id));
    setChatInputValue(message.text);
  };

  const handleSteerQueued = async (message: QueuedMessage) => {
    if (
      steerAfterStopRef.current ||
      !queuedMessagesRef.current.some((queued) => queued.id === message.id)
    ) {
      return;
    }
    if (!isAgentBusyRef.current) {
      // dispatchMessage discards a pending approval, which the drain would wait on.
      dispatchQueued(message);
      return;
    }
    updateQueue(
      markQueuedMessageSteering(queuedMessagesRef.current, message.id)
    );
    steerAfterStopRef.current = message;
    steerStopPendingRef.current = true;
    const stopped = await stopResponse();
    steerStopPendingRef.current = false;
    if (stopped) {
      flushSteer();
      return;
    }
    steerAfterStopRef.current = null;
    updateQueue(
      queuedMessagesRef.current.map((queued) => ({
        ...queued,
        steering: false,
      }))
    );
    drainQueueRef.current();
  };

  // A failed request can go out again: the user's message, or the agent's
  // turn picked up after an answer or an approval.
  const lastMessage = messages.at(-1);
  const canRetry =
    chatError !== null &&
    chatError !== tChatErrors("usageLimit") &&
    !isAgentBusy &&
    (lastMessage?.role === "user" ||
      findSettledAgentQuestion(messages) !== null ||
      shouldContinueAfterApprovalResponse({ messages }));
  const retry = () => {
    const last = messagesRef.current.at(-1);
    if (!last) {
      return;
    }
    setChatError(null);
    isAgentBusyRef.current = true;
    wasStoppedByUserRef.current = false;
    (last.role === "user" ? regenerate() : sendMessage()).catch(
      (error: unknown) => {
        isAgentBusyRef.current = false;
        console.error("Failed to retry the agent's message", error);
      }
    );
  };

  return {
    activeChatId,
    answerQuestion,
    canRetry,
    retry,
    chatError,
    dismissQuestion,
    chatInputRef,
    chatInputValue,
    handleApproveTool,
    handleDenyTool,
    handleEditQueued,
    handleNewChat,
    handleRemoveQueued,
    handleSelectChat,
    handleSend,
    handleSteerQueued,
    handleStop,
    isAgentBusy,
    isHydratingHistory,
    isSessionsLoading: sessionsQuery.isPending,
    messages,
    messagesRef,
    effort,
    queuedMessages,
    sendPrompt,
    sessions,
    sessionsData: sessionsQuery.data,
    setChatError,
    setChatInputValue,
    status,
  };
}
