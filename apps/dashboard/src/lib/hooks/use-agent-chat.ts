"use client";

import { useChat } from "@ai-sdk/react";
import { createdPostToolOutputSchema } from "@notra/ai/schemas/post";
import type {
  ChatAttachment,
  ChatMessagePart,
  ChatUIMessage,
} from "@notra/ai/types/chat";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChatOnFinishCallback, isToolUIPart } from "ai";
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
import { CHAT_ACTIVE_STREAM_POLL_INTERVAL_MS } from "@/constants/chat-active-stream";
import { localStorageKeys } from "@/constants/storage";
import { emitAutumnRefresh } from "@/lib/billing/autumn-refresh";
import { createStandaloneChatTransport } from "@/lib/chat/standalone-chat-transport";
import { markChatSessionRunning } from "@/lib/hooks/use-chat-sessions";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AgentQuestionAnswer } from "@/types/agent-questions";
import type { ChatComposerHandle } from "@/types/components/chat-input";
import type {
  ChatTurnEvent,
  ChatTurnPhase,
} from "@/types/components/chat-page";
import type {
  AgentChatResend,
  UseAgentChatOptions,
} from "@/types/hooks/agent-chat";
import {
  findPendingAgentQuestion,
  findSettledAgentQuestion,
  findAgentTurnToRetry,
} from "@/utils/agent-questions";
import {
  findContinuableDenial,
  hasPendingApproval,
  isTerminalToolState,
  shouldContinueAfterApprovalResponse,
} from "@/utils/chat-approvals";
import { handleStandaloneChatError } from "@/utils/chat-error";
import { chatHistoryQueryOptions } from "@/utils/chat-history-query";
import { buildUserMessageParts } from "@/utils/chat-message-parts";
import {
  markQueuedMessageSteering,
  parseQueuedMessages,
  shouldDrainQueueAfterFinish,
  takeQueuedMessage,
} from "@/utils/chat-queue";
import { getSendableChatMessages } from "@/utils/chat-sendable-messages";
import { updateWasStoppedByUser } from "@/utils/chat-state";
import { nextChatTurnPhase } from "@/utils/chat-turn-phase";

function isDispatchingQueued(phase: ChatTurnPhase): boolean {
  return phase === "sendingQueued" || phase === "stoppingForQueue";
}

function textAndFiles(message: ChatUIMessage) {
  let text = "";
  const attachments: ChatMessagePart[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      text += part.text;
    } else if (part.type === "file") {
      attachments.push({
        type: "file",
        url: part.url,
        mediaType: part.mediaType,
        filename: part.filename,
      });
    }
  }
  return { text, attachments };
}

/**
 * The agent's conversation, wherever it shows: the chat page, the agent
 * panel and the Autopilot dock. It sends, queues, steers and stops, answers
 * approvals and questions, picks a running reply back up, and waits out a
 * reply another tab is still writing. Whoever renders it owns the UI.
 */
// react-doctor-disable-next-line react-doctor/no-high-complexity-react-function -- one conversation's whole send lifecycle; its parts share the same refs
export function useAgentChat({
  organizationId,
  initialChatId,
  projectId,
  thinkingLevel,
  context = [],
  hasCustomizedContext = false,
  focus,
  chatInputRef: hostChatInputRef,
  authorUserId,
  persistQueue = false,
  canSend = true,
  paused = false,
  fallbackError,
  onBeforeSend,
  onChatCreated,
  onNewChatReplied,
  onError,
}: UseAgentChatOptions) {
  const tChatErrors = useTranslations("chat.errors");
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState(
    () => initialChatId ?? crypto.randomUUID()
  );
  const isExistingChat = chatId === initialChatId;
  const [initialMessages] = useState(
    () =>
      queryClient.getQueryData(
        chatHistoryQueryOptions(organizationId, initialChatId).queryKey
      )?.messages ?? []
  );
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [historyStreamId, setHistoryStreamId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [wasStoppedByUser, setWasStoppedByUser] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [turnPhase, setTurnPhase] = useState<ChatTurnPhase>("idle");
  const ownChatInputRef = useRef<ChatComposerHandle | null>(null);
  const chatInputRef = hostChatInputRef ?? ownChatInputRef;

  // Read when a request goes out, so each one carries what's current.
  const live = useRef({
    canSend,
    paused,
    isExistingChat,
    onBeforeSend,
    onChatCreated,
    onNewChatReplied,
    onError,
  });
  const contextRef = useRef(context);
  const hasCustomizedContextRef = useRef(hasCustomizedContext);
  const organizationIdRef = useRef(organizationId);
  const projectIdRef = useRef(projectId);
  const thinkingLevelRef = useRef<string>(thinkingLevel);
  const focusRef = useRef(focus);
  const onChatCreatedRef = useRef<((id: string) => void) | undefined>(
    undefined
  );
  useEffect(() => {
    live.current = {
      canSend,
      paused,
      isExistingChat,
      onBeforeSend,
      onChatCreated,
      onNewChatReplied,
      onError,
    };
    contextRef.current = context;
    hasCustomizedContextRef.current = hasCustomizedContext;
    organizationIdRef.current = organizationId;
    projectIdRef.current = projectId;
    thinkingLevelRef.current = thinkingLevel;
    focusRef.current = focus;
    onChatCreatedRef.current = isExistingChat ? undefined : onChatCreated;
  });

  const activeStreamConflictRef = useRef<string | null>(null);
  const requeueConflictedMessageRef = useRef<(messageId: string) => boolean>(
    () => false
  );
  // The queued message going out now, and how long the chat was before it.
  // A failed send puts it back at the front of the queue.
  const inFlightQueuedRef = useRef<{
    message: QueuedMessage;
    messageCount: number;
  } | null>(null);
  const restoreFailedQueuedRef = useRef<() => void>(() => {});
  // react-doctor-disable-next-line react-hooks-js/refs -- the transport only reads these refs inside fetch callbacks, never during render
  const [transport] = useState(() =>
    createStandaloneChatTransport({
      getSendableMessages: getSendableChatMessages,
      live: {
        activeProjectId: projectIdRef,
        context: contextRef,
        focus: focusRef,
        hasCustomizedContext: hasCustomizedContextRef,
        onChatCreated: onChatCreatedRef,
        organizationId: organizationIdRef,
        streamConflict: activeStreamConflictRef,
        thinkingLevel: thinkingLevelRef,
      },
      setPendingMessageId,
    })
  );

  const wasStoppedByUserRef = useRef(false);
  const drainQueueRef = useRef<() => void>(() => {});
  const flushSteerAfterStopRef = useRef<() => void>(() => {});
  const steerAfterStopRef = useRef<QueuedMessage | null>(null);
  const queuedMessagesRef = useRef<QueuedMessage[]>([]);
  const messagesRef = useRef<ChatUIMessage[]>([]);
  const turnPhaseRef = useRef<ChatTurnPhase>("idle");
  const dispatchTurn = useCallback((event: ChatTurnEvent) => {
    const next = nextChatTurnPhase(turnPhaseRef.current, event);
    turnPhaseRef.current = next;
    setTurnPhase(next);
  }, []);
  const isStoppingResponseRef = useRef(false);
  const finishAfterStopRef = useRef<(() => void) | null>(null);
  // A new chat's first reply hands it to `onNewChatReplied` once it settles.
  const hasPendingNewChatReplyRef = useRef(false);
  const hasSentInNewChatRef = useRef(false);
  // Questions the user settled that still owe the agent a resend; each goes
  // back once, so a double press or a stale state can't send twice.
  const unsentAnswersRef = useRef(new Set<string>());
  // Workflow saves the user discarded with the button go back to the agent,
  // so it asks what to change instead of leaving the user to start over.
  const discardedApprovalsRef = useRef(new Set<string>());
  /** Whether the turn ended on a Discard press that still owes the agent a send. */
  const isPressedDiscard = (current: ChatUIMessage[], claim: boolean) => {
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

  const setQueue = useCallback((next: QueuedMessage[]) => {
    queuedMessagesRef.current = next;
    setQueuedMessages(next);
  }, []);
  const setStoppedByUser = useCallback((value: boolean) => {
    updateWasStoppedByUser(value, wasStoppedByUserRef, setWasStoppedByUser);
  }, []);

  const handleFinish = useCallback<ChatOnFinishCallback<ChatUIMessage>>(
    ({
      message,
      messages: finishedMessages,
      isAbort,
      isError,
      isDisconnect,
    }) => {
      messagesRef.current = finishedMessages;
      if (!isError) {
        inFlightQueuedRef.current = null;
      }
      if (!isError && !isDisconnect) {
        queryClient.setQueryData(
          chatHistoryQueryOptions(organizationId, chatId).queryKey,
          (current) =>
            current
              ? {
                  ...current,
                  messages: finishedMessages,
                  lastResponseStopped: isAbort || wasStoppedByUserRef.current,
                  activeStreamId: null,
                }
              : current
        );
      }
      setPendingMessageId(null);
      emitAutumnRefresh();
      queryClient.invalidateQueries({
        queryKey: ["chat-sessions", organizationId],
      });
      for (const part of message.parts) {
        if (!isToolUIPart(part) || part.state !== "output-available") {
          continue;
        }
        const savedPost = createdPostToolOutputSchema.safeParse(part.output);
        if (savedPost.success) {
          queryClient.invalidateQueries({
            queryKey: dashboardOrpc.content.get.queryKey({
              input: { organizationId, contentId: savedPost.data.postId },
            }),
          });
        }
      }
      // The agent may have built or run an Autopilot workflow.
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.workflows.key(),
      });
      const finishQueue = () => {
        const wasInterruptedForQueue =
          turnPhaseRef.current === "stoppingForQueue" ||
          turnPhaseRef.current === "stoppedForQueue";
        dispatchTurn("settled");
        if (steerAfterStopRef.current) {
          flushSteerAfterStopRef.current();
          return;
        }
        if (
          shouldDrainQueueAfterFinish({
            isAbort,
            isError,
            isDisconnect,
            wasInterruptedForQueue,
            wasStoppedByUser: wasStoppedByUserRef.current,
          })
        ) {
          drainQueueRef.current();
        }
        const onReplied = live.current.onNewChatReplied;
        if (
          !isError &&
          !isDisconnect &&
          onReplied &&
          hasPendingNewChatReplyRef.current &&
          !isDispatchingQueued(turnPhaseRef.current) &&
          turnPhaseRef.current !== "waitingForActiveStream" &&
          queuedMessagesRef.current.length === 0
        ) {
          hasPendingNewChatReplyRef.current = false;
          onReplied({
            chatId,
            message,
            messages: [
              ...messagesRef.current.filter((item) => item.id !== message.id),
              message,
            ],
            wasStoppedByUser: wasStoppedByUserRef.current,
          });
        } else if (
          (isError || isDisconnect) &&
          turnPhaseRef.current !== "waitingForActiveStream"
        ) {
          hasPendingNewChatReplyRef.current = false;
        }
      };
      if (isStoppingResponseRef.current) {
        finishAfterStopRef.current = finishQueue;
        return;
      }
      finishQueue();
    },
    [chatId, dispatchTurn, organizationId, queryClient]
  );

  const {
    messages,
    setMessages,
    sendMessage,
    addToolApprovalResponse,
    addToolOutput,
    regenerate,
    status,
    stop,
  } = useChat<ChatUIMessage>({
    id: chatId,
    messages: isExistingChat ? initialMessages : [],
    resume: Boolean(
      isExistingChat && historyStreamId && pendingMessageId === historyStreamId
    ),
    experimental_throttle: 90,
    transport,
    sendAutomaticallyWhen: ({ messages: current }) => {
      if (
        shouldContinueAfterApprovalResponse({ messages: current }) ||
        isPressedDiscard(current, true)
      ) {
        return true;
      }
      const answered = findSettledAgentQuestion(current);
      return answered !== null && unsentAnswersRef.current.delete(answered);
    },
    onFinish: handleFinish,
    onError: (err) => {
      unsentAnswersRef.current.clear();
      if (steerAfterStopRef.current) {
        return;
      }
      const conflictedMessageId = activeStreamConflictRef.current;
      activeStreamConflictRef.current = null;
      if (
        conflictedMessageId &&
        requeueConflictedMessageRef.current(conflictedMessageId)
      ) {
        inFlightQueuedRef.current = null;
        return;
      }
      restoreFailedQueuedRef.current();
      live.current.onError?.(chatId);
      handleStandaloneChatError(err, {
        setChatError,
        setPendingMessageId,
        messages: {
          usageLimit: tChatErrors("usageLimit"),
          fallback: fallbackError ?? tChatErrors("fallback"),
          offline: tChatErrors("offline"),
        },
      });
    },
  });

  useLayoutEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keeps the sidebar's running state in step with this chat: optimistic on
  // send, then confirmed (and a new chat listed) once the stream starts.
  useEffect(() => {
    if (status === "submitted") {
      markChatSessionRunning(queryClient, organizationId, chatId);
    } else if (status === "streaming") {
      queryClient.invalidateQueries({
        queryKey: ["chat-sessions", organizationId],
      });
    }
  }, [chatId, organizationId, queryClient, status]);

  const historyQuery = useQuery(
    chatHistoryQueryOptions(
      organizationId,
      isExistingChat ? initialChatId : undefined
    )
  );
  const history = historyQuery.data;
  useLayoutEffect(() => {
    if (!history) {
      return;
    }
    if (history.messages?.length) {
      setMessages(history.messages);
    }
    setStoppedByUser(Boolean(history.lastResponseStopped));
    setHistoryStreamId(history.activeStreamId ?? null);
    setPendingMessageId(history.activeStreamId ?? null);
  }, [history, setMessages, setStoppedByUser]);

  const queueStorageKey =
    persistQueue && authorUserId
      ? localStorageKeys.chatQueue(chatId, authorUserId)
      : null;
  const loadedQueueKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (paused || !queueStorageKey) {
      return;
    }
    if (loadedQueueKeyRef.current === queueStorageKey) {
      return;
    }
    loadedQueueKeyRef.current = queueStorageKey;
    try {
      const raw = window.localStorage.getItem(queueStorageKey);
      setQueue(raw ? parseQueuedMessages(JSON.parse(raw)) : []);
    } catch {
      setQueue([]);
    }
  }, [paused, queueStorageKey, setQueue]);
  useEffect(() => {
    if (!queueStorageKey || loadedQueueKeyRef.current !== queueStorageKey) {
      return;
    }
    try {
      if (queuedMessages.length === 0) {
        window.localStorage.removeItem(queueStorageKey);
      } else {
        window.localStorage.setItem(
          queueStorageKey,
          JSON.stringify(queuedMessages)
        );
      }
    } catch {
      // Storage can be full or blocked; the queue still works in memory.
    }
  }, [queueStorageKey, queuedMessages]);

  const isLoading = status === "streaming" || status === "submitted";
  useLayoutEffect(() => {
    if (isLoading) {
      dispatchTurn("send");
    }
  }, [dispatchTurn, isLoading]);

  const authorMetadata = useMemo(
    () => (authorUserId ? { authorUserId } : undefined),
    [authorUserId]
  );

  /**
   * Asks the server to stop the reply and stops reading it. When the server
   * refuses, the reply keeps running there, so it keeps streaming here too.
   * Resolves to false only when the server refused; `notify` tells the user.
   */
  const stopActiveResponse = useCallback(
    async (notify = true) => {
      // A stop is already on its way.
      if (isStoppingResponseRef.current) {
        return true;
      }
      isStoppingResponseRef.current = true;
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${encodeURIComponent(chatId)}/stop`,
        { method: "POST" }
      ).catch((stopError: unknown) => {
        console.error("[Chat] Failed to notify server to stop:", stopError);
        return null;
      });
      const stopped = response?.ok === true;
      if (stopped) {
        stop();
      } else {
        if (response) {
          console.error(`[Chat] Failed to stop: status ${response.status}`);
        }
        if (notify) {
          toast.error(tChatErrors("stopFailed"));
        }
      }
      isStoppingResponseRef.current = false;
      const finish = finishAfterStopRef.current;
      finishAfterStopRef.current = null;
      finish?.();
      return stopped;
    },
    [chatId, organizationId, stop, tChatErrors]
  );

  const handleStop = useCallback(async () => {
    dispatchTurn("userStopped");
    steerAfterStopRef.current = null;
    setQueue(
      queuedMessagesRef.current.map((message) => ({
        ...message,
        steering: false,
      }))
    );
    setIsStopping(true);
    setStoppedByUser(true);
    if (!(await stopActiveResponse())) {
      setIsStopping(false);
      setStoppedByUser(false);
      // The reply may have ended while the stop was on its way.
      drainQueueRef.current();
    }
  }, [dispatchTurn, setQueue, setStoppedByUser, stopActiveResponse]);

  const settleQuestion = useCallback(
    (
      toolCallId: string,
      result:
        | { output: { answers: AgentQuestionAnswer[] } }
        | { state: "output-error"; errorText: string }
    ) => {
      if (unsentAnswersRef.current.has(toolCallId)) {
        return;
      }
      unsentAnswersRef.current.add(toolCallId);
      setChatError(null);
      setStoppedByUser(false);
      Promise.resolve(
        addToolOutput({ tool: AGENT_QUESTION_TOOL_NAME, toolCallId, ...result })
      ).catch((error: unknown) => {
        unsentAnswersRef.current.delete(toolCallId);
        console.error("[Chat] Failed to answer the agent's question:", error);
      });
    },
    [addToolOutput, setStoppedByUser]
  );

  const answerQuestion = useCallback(
    (toolCallId: string, answers: AgentQuestionAnswer[]) =>
      settleQuestion(toolCallId, { output: { answers } }),
    [settleQuestion]
  );

  /** The agent hears that the user skipped its questions, and carries on. */
  const dismissQuestion = useCallback(
    (toolCallId: string) =>
      settleQuestion(toolCallId, {
        state: "output-error",
        errorText: AGENT_QUESTION_DISMISSED,
      }),
    [settleQuestion]
  );

  /** Marks a message as going out: the turn starts and a new chat waits for its reply. */
  const beginSend = useCallback(() => {
    inFlightQueuedRef.current = null;
    setIsStopping(false);
    setStoppedByUser(false);
    setChatError(null);
    dispatchTurn("send");
    if (!live.current.isExistingChat) {
      hasPendingNewChatReplyRef.current = true;
    }
  }, [dispatchTurn, setStoppedByUser]);

  const dispatchMessage = useCallback(
    async (
      text: string,
      attachments: ChatAttachment[] = [],
      queued?: QueuedMessage
    ) => {
      const { canSend: sendable, paused: isPaused } = live.current;
      if (isPaused || !sendable) {
        return;
      }
      if (text.trim().length === 0 && attachments.length === 0) {
        return;
      }

      // A message sent while the agent waits on questions answers the first.
      const pendingQuestion = findPendingAgentQuestion(messagesRef.current);
      if (pendingQuestion && attachments.length === 0) {
        answerQuestion(
          pendingQuestion.toolCallId,
          pendingQuestion.questions.map((_, index) =>
            index === 0 ? [text] : []
          )
        );
        return;
      }

      const isFirstInNewChat =
        !live.current.isExistingChat && !hasSentInNewChatRef.current;
      live.current.onBeforeSend?.({
        chatId,
        isEmptyChat: messagesRef.current.length === 0,
        isFirstInNewChat,
      });
      const messageCount = messagesRef.current.length;
      beginSend();
      if (queued) {
        inFlightQueuedRef.current = { message: queued, messageCount };
      }
      // Sending moves on from whatever was waiting for approval.
      for (const message of messagesRef.current) {
        if (message.role !== "assistant") {
          continue;
        }
        for (const part of message.parts) {
          if (!(isToolUIPart(part) && part.state === "approval-requested")) {
            continue;
          }
          const approvalId = part.approval?.id;
          if (approvalId) {
            addToolApprovalResponse({ id: approvalId, approved: false });
          }
        }
      }
      hasSentInNewChatRef.current = true;
      if (attachments.length > 0) {
        await sendMessage({
          role: "user",
          parts: buildUserMessageParts(text, attachments),
          metadata: authorMetadata,
        });
        return;
      }
      await sendMessage({ text, metadata: authorMetadata });
    },
    [
      addToolApprovalResponse,
      answerQuestion,
      authorMetadata,
      beginSend,
      chatId,
      sendMessage,
    ]
  );

  const handleSend = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      if (turnPhaseRef.current !== "idle" || isLoading) {
        setQueue([
          ...queuedMessagesRef.current,
          {
            id: nanoid(10),
            text,
            authorUserId,
            ...(attachments.length > 0 ? { attachments } : {}),
          },
        ]);
        return;
      }
      await dispatchMessage(text, attachments);
    },
    [authorUserId, dispatchMessage, isLoading, setQueue]
  );

  /** Sends again from one of the user's messages, dropping what came after it. */
  const resendFrom = useCallback<AgentChatResend>(
    async (userMessageId, text, attachments) => {
      if (live.current.paused) {
        return;
      }
      const current = messagesRef.current;
      const index = current.findIndex((m) => m.id === userMessageId);
      if (index === -1) {
        return;
      }
      setMessages(current.slice(0, index + 1));
      beginSend();
      if (attachments.length > 0) {
        await sendMessage({
          role: "user",
          parts: [
            ...(text.length > 0 ? [{ type: "text" as const, text }] : []),
            ...attachments,
          ],
          messageId: userMessageId,
          metadata: authorMetadata,
        });
        return;
      }
      await sendMessage({
        text,
        messageId: userMessageId,
        metadata: authorMetadata,
      });
    },
    [authorMetadata, beginSend, sendMessage, setMessages]
  );

  /** Puts a queued message that failed to send back at the front of the queue. */
  const restoreFailedQueued = useCallback(() => {
    const failed = inFlightQueuedRef.current;
    if (!failed) {
      return;
    }
    inFlightQueuedRef.current = null;
    setMessages(messagesRef.current.slice(0, failed.messageCount));
    setQueue([failed.message, ...queuedMessagesRef.current]);
  }, [setMessages, setQueue]);
  useEffect(() => {
    restoreFailedQueuedRef.current = restoreFailedQueued;
  }, [restoreFailedQueued]);

  /** Sends a message taken off the queue; it goes back there if it fails. */
  const sendQueued = useCallback(
    (message: QueuedMessage) => {
      dispatchMessage(message.text, message.attachments, message).catch(
        (error: unknown) => {
          console.error("[Chat] Failed to send queued message:", error);
          dispatchTurn("settled");
          restoreFailedQueued();
        }
      );
    },
    [dispatchMessage, dispatchTurn, restoreFailedQueued]
  );

  const handleRemoveQueued = useCallback(
    (id: string) => {
      if (steerAfterStopRef.current?.id === id) {
        steerAfterStopRef.current = null;
        setStoppedByUser(true);
      }
      setQueue(queuedMessagesRef.current.filter((m) => m.id !== id));
    },
    [setQueue, setStoppedByUser]
  );

  /** Takes a queued message back into the composer. */
  const takeQueuedForEdit = useCallback(
    (message: QueuedMessage) => {
      if (
        message.attachments?.length &&
        !chatInputRef.current?.setAttachments(message.attachments)
      ) {
        return false;
      }
      if (steerAfterStopRef.current?.id === message.id) {
        steerAfterStopRef.current = null;
        setStoppedByUser(true);
      }
      setQueue(queuedMessagesRef.current.filter((m) => m.id !== message.id));
      return true;
    },
    [chatInputRef, setQueue, setStoppedByUser]
  );

  const handleEditQueued = useCallback(
    (message: QueuedMessage) => {
      if (takeQueuedForEdit(message)) {
        chatInputRef.current?.setText(message.text);
      }
    },
    [chatInputRef, takeQueuedForEdit]
  );

  const sendSteeredQueued = useCallback(
    (message: QueuedMessage) => {
      const taken = takeQueuedMessage(queuedMessagesRef.current, message.id);
      if (!taken) {
        return;
      }
      setQueue(taken.remaining);
      dispatchTurn("sendQueued");
      setStoppedByUser(false);
      sendQueued(message);
    },
    [dispatchTurn, sendQueued, setQueue, setStoppedByUser]
  );

  const flushSteerAfterStop = useCallback(() => {
    const next = steerAfterStopRef.current;
    if (!next) {
      return;
    }
    steerAfterStopRef.current = null;
    sendSteeredQueued(next);
  }, [sendSteeredQueued]);

  const handleSteerQueued = useCallback(
    (message: QueuedMessage) => {
      if (steerAfterStopRef.current) {
        return;
      }
      if (
        !queuedMessagesRef.current.some((queued) => queued.id === message.id)
      ) {
        return;
      }
      if (turnPhaseRef.current === "idle" && !isLoading) {
        sendSteeredQueued(message);
        return;
      }
      setQueue(
        markQueuedMessageSteering(queuedMessagesRef.current, message.id)
      );
      steerAfterStopRef.current = message;
      setStoppedByUser(false);
      stopActiveResponse().then((stopped) => {
        // The reply goes on; the message waits its turn in the queue. If the
        // reply ended meanwhile, it already went out.
        if (stopped || steerAfterStopRef.current?.id !== message.id) {
          return;
        }
        steerAfterStopRef.current = null;
        setQueue(
          queuedMessagesRef.current.map((queued) => ({
            ...queued,
            steering: false,
          }))
        );
      });
    },
    [
      isLoading,
      sendSteeredQueued,
      setQueue,
      setStoppedByUser,
      stopActiveResponse,
    ]
  );

  useEffect(() => {
    flushSteerAfterStopRef.current = flushSteerAfterStop;
  }, [flushSteerAfterStop]);

  useEffect(() => {
    drainQueueRef.current = () => {
      if (live.current.paused) {
        return;
      }
      if (turnPhaseRef.current !== "idle") {
        return;
      }
      if (wasStoppedByUserRef.current || steerAfterStopRef.current) {
        return;
      }
      const current = messagesRef.current;
      if (
        hasPendingApproval(current) ||
        // A queued message would answer the agent's open questions for the user.
        findPendingAgentQuestion(current) !== null ||
        // The SDK resends on its own after an answer or a discard; draining
        // now would double-submit.
        unsentAnswersRef.current.size > 0 ||
        isPressedDiscard(current, false)
      ) {
        return;
      }
      const [next, ...remaining] = queuedMessagesRef.current;
      if (!next) {
        return;
      }
      dispatchTurn("sendQueued");
      setQueue(remaining);
      sendQueued(next);
    };
  });

  // Another tab may still be writing a reply in this chat. The message waits
  // in the queue and goes out once that reply ends.
  const activeStreamPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const stopActiveStreamPolling = useCallback(() => {
    if (activeStreamPollRef.current) {
      clearInterval(activeStreamPollRef.current);
      activeStreamPollRef.current = null;
    }
  }, []);
  const checkActiveStream = useCallback(async () => {
    const data = await dashboardOrpcClient.chat.sessions
      .get({ organizationId, chatId })
      .catch((error: unknown) => {
        if (error instanceof ORPCError) {
          return null;
        }
        throw error;
      });
    if (!data || data.activeStreamId || !activeStreamPollRef.current) {
      return;
    }
    stopActiveStreamPolling();
    if (data.messages?.length) {
      setMessages(data.messages);
    }
    dispatchTurn("activeStreamEnded");
  }, [
    chatId,
    dispatchTurn,
    organizationId,
    setMessages,
    stopActiveStreamPolling,
  ]);
  const startActiveStreamPolling = useCallback(() => {
    stopActiveStreamPolling();
    let isChecking = false;
    activeStreamPollRef.current = setInterval(() => {
      if (isChecking) {
        return;
      }
      isChecking = true;
      checkActiveStream()
        .catch((error) => {
          console.error("[Chat] Failed to check the active response:", error);
        })
        .finally(() => {
          isChecking = false;
        });
    }, CHAT_ACTIVE_STREAM_POLL_INTERVAL_MS);
  }, [checkActiveStream, stopActiveStreamPolling]);
  useEffect(() => stopActiveStreamPolling, [stopActiveStreamPolling]);

  useEffect(() => {
    requeueConflictedMessageRef.current = (messageId) => {
      const current = messagesRef.current;
      const index = current.findIndex((message) => message.id === messageId);
      const message = current[index];
      if (!message || message.role !== "user") {
        return false;
      }
      const { text, attachments } = textAndFiles(message);
      if (attachments.length > 0 || !text.trim()) {
        return false;
      }
      setMessages(current.slice(0, index));
      setQueue([
        { id: nanoid(10), text, authorUserId },
        ...queuedMessagesRef.current,
      ]);
      dispatchTurn("streamConflict");
      setPendingMessageId(null);
      startActiveStreamPolling();
      return true;
    };
  }, [
    authorUserId,
    dispatchTurn,
    setMessages,
    setQueue,
    startActiveStreamPolling,
  ]);

  const isWaitingForActiveStream = turnPhase === "waitingForActiveStream";
  const wasWaitingForActiveStreamRef = useRef(false);
  useEffect(() => {
    if (isWaitingForActiveStream) {
      wasWaitingForActiveStreamRef.current = true;
      return;
    }
    if (!wasWaitingForActiveStreamRef.current || isLoading) {
      return;
    }
    wasWaitingForActiveStreamRef.current = false;
    if (steerAfterStopRef.current) {
      flushSteerAfterStopRef.current();
      return;
    }
    drainQueueRef.current();
  }, [isLoading, isWaitingForActiveStream]);

  // A queued message goes out at the next finished tool call instead of
  // waiting for the whole reply: the reply stops there and the message sends.
  const seenToolOutputsRef = useRef<Set<string>>(new Set());
  const prevIsLoadingRef = useRef(false);
  useEffect(() => {
    if (isLoading && !prevIsLoadingRef.current) {
      const snapshot = new Set<string>();
      for (const message of messagesRef.current) {
        if (message.role !== "assistant") {
          continue;
        }
        for (const part of message.parts) {
          if (isToolUIPart(part) && isTerminalToolState(part.state)) {
            snapshot.add(part.toolCallId);
          }
        }
      }
      seenToolOutputsRef.current = snapshot;
      dispatchTurn("streamStarted");
    }
    prevIsLoadingRef.current = isLoading;
  }, [dispatchTurn, isLoading]);

  useEffect(() => {
    if (
      paused ||
      !isLoading ||
      isDispatchingQueued(turnPhaseRef.current) ||
      wasStoppedByUser ||
      queuedMessages.length === 0 ||
      hasPendingApproval(messages)
    ) {
      return;
    }

    let hasNewToolOutput = false;
    for (const message of messages) {
      if (message.role !== "assistant") {
        continue;
      }
      for (const part of message.parts) {
        if (
          isToolUIPart(part) &&
          isTerminalToolState(part.state) &&
          !seenToolOutputsRef.current.has(part.toolCallId)
        ) {
          seenToolOutputsRef.current.add(part.toolCallId);
          hasNewToolOutput = true;
        }
      }
    }
    if (!hasNewToolOutput) {
      return;
    }

    dispatchTurn("stopForQueue");
    stopActiveResponse(false).then((stopped) => {
      if (!stopped) {
        dispatchTurn("stopForQueueFailed");
      }
    });
  }, [
    dispatchTurn,
    isLoading,
    messages,
    paused,
    queuedMessages.length,
    stopActiveResponse,
    wasStoppedByUser,
  ]);

  const handleApproveTool = useCallback(
    (approvalId: string) =>
      addToolApprovalResponse({ id: approvalId, approved: true }),
    [addToolApprovalResponse]
  );

  const handleDenyTool = useCallback(
    (approvalId: string) => {
      discardedApprovalsRef.current.add(approvalId);
      return addToolApprovalResponse({ id: approvalId, approved: false });
    },
    [addToolApprovalResponse]
  );

  // A failed request can go out again: the user's message, or the agent's
  // turn picked up after an answer or an approval.
  const lastMessage = messages.at(-1);
  const canRetry =
    chatError !== null &&
    chatError !== tChatErrors("usageLimit") &&
    !isLoading &&
    !paused &&
    (lastMessage?.role === "user" || findAgentTurnToRetry(messages) !== null);
  const retry = useCallback(() => {
    const current = messagesRef.current;
    const last = current.at(-1);
    if (!last) {
      return;
    }
    // The agent's turn picks up where it failed, keeping the user's answer.
    const continuation =
      last.role === "user" ? null : findAgentTurnToRetry(current);
    if (continuation && continuation !== current) {
      setMessages(continuation);
    }
    beginSend();
    (last.role === "user" ? regenerate() : sendMessage()).catch(
      (error: unknown) => {
        dispatchTurn("settled");
        console.error("[Chat] Failed to retry the agent's message:", error);
      }
    );
  }, [beginSend, dispatchTurn, regenerate, sendMessage, setMessages]);

  /** Starts over in a new, empty chat. */
  const startNewChat = useCallback(() => {
    stopActiveStreamPolling();
    // A message waiting out another tab's reply belongs to the old chat.
    turnPhaseRef.current = "idle";
    setTurnPhase("idle");
    inFlightQueuedRef.current = null;
    steerAfterStopRef.current = null;
    unsentAnswersRef.current.clear();
    discardedApprovalsRef.current.clear();
    hasPendingNewChatReplyRef.current = false;
    hasSentInNewChatRef.current = false;
    setQueue([]);
    setChatError(null);
    setPendingMessageId(null);
    setHistoryStreamId(null);
    setIsStopping(false);
    setStoppedByUser(false);
    setMessages([]);
    setChatId(crypto.randomUUID());
  }, [setMessages, setQueue, setStoppedByUser, stopActiveStreamPolling]);

  return {
    chatId,
    isExistingChat,
    /** Whether a new chat has sent its first message. */
    hasSentInNewChat: () => hasSentInNewChatRef.current,
    isIdle: () => turnPhaseRef.current === "idle",
    history,
    historyQuery,
    messages,
    messagesRef,
    setMessages,
    sendMessage,
    addToolApprovalResponse,
    status,
    isLoading,
    isStopping,
    wasStoppedByUser,
    isWaitingForActiveStream,
    chatError,
    setChatError,
    canRetry,
    retry,
    queuedMessages,
    chatInputRef,
    authorMetadata,
    handleSend,
    handleStop,
    handleRemoveQueued,
    handleEditQueued,
    takeQueuedForEdit,
    handleSteerQueued,
    handleApproveTool,
    handleDenyTool,
    answerQuestion,
    dismissQuestion,
    pendingQuestion: paused ? null : findPendingAgentQuestion(messages),
    resendFrom,
    startNewChat,
  };
}
