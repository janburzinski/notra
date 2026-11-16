"use client";

import {
  ArrowReloadHorizontalIcon,
  File02Icon,
  X,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createdPostToolOutputSchema } from "@notra/ai/schemas/post";
import type {
  ChatAttachment,
  ChatMessagePart,
  ChatUIMessage,
  ContextItem,
  MirrorChatStatus,
} from "@notra/ai/types/chat";
import { linkSavedChatPosts } from "@notra/ai/utils/chat-post";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { EASE } from "@notra/ui/lib/motion";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import {
  type DynamicToolUIPart,
  getToolName,
  isToolUIPart,
  type ToolUIPart,
} from "ai";
import { LazyMotion, m, useReducedMotion } from "motion/react";
import { nanoid } from "nanoid";
import { parseAsString, useQueryState } from "nuqs";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocale, useTranslations } from "use-intl";

import { AgentQuestionDock } from "@/components/ai/agent-question-dock";
import { ChatDraftStreamingPreview } from "@/components/ai/chat-draft-streaming-preview";
import { autopilotWorkflowDraftTools } from "@/components/autopilot/autopilot-workflow-draft-tools";
import { Button } from "@/components/button";
import { ChatContentPanel } from "@/components/chat/chat-content-panel";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { ChatHomeSuggestions } from "@/components/chat/chat-home-suggestions";
import { ChatInput, type ThinkingLevel } from "@/components/chat/chat-input";
import { ChatMinimapRail } from "@/components/chat/chat-minimap-rail";
import { ChatQuoteProvider, useChatQuote } from "@/components/chat/chat-quote";
import { ChatSharePopover } from "@/components/chat/chat-share-popover";
import { MessageAuthorAvatar } from "@/components/chat/message-author-avatar";
import { SlackRelayFooterNotice } from "@/components/chat/slack-relay-footer-notice";
import {
  UserMessageActions,
  UserMessageTextBubble,
} from "@/components/chat/user-message-actions";
import { HeaderActionsPortal } from "@/components/dashboard/header-actions-portal";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { AGENT_QUESTION_INPUT_RETURN_CLASS } from "@/constants/agent-questions";
import { CHAT_PAGE_CARD_TOOL_NAMES } from "@/constants/chat-custom-tools";
import { MAX_VISIBLE_CHAT_IMAGES } from "@/constants/chat-images";
import {
  CHAT_CREATE_TOOL_NAMES,
  CHAT_CREATE_TOOL_TYPES,
  CHAT_POST_EDIT_TOOL_NAMES,
  CHAT_REFERENCE_TOKEN_SPLIT_REGEX,
} from "@/constants/chat-posts";
import { TOOL_TIMER_THRESHOLD_SECONDS } from "@/constants/chat-tool-timer";
import { MIRROR_WORKING_TIMEOUT_MS } from "@/constants/slack-mirror";
import { localStorageKeys } from "@/constants/storage";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { getChatContextKind } from "@/lib/analytics/studio-events";
import { authClient } from "@/lib/auth/client";
import {
  relaySlackApproval,
  relaySlackMirrorMessage,
  SlackRelayError,
} from "@/lib/chat/slack-relay";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useAgentChat } from "@/lib/hooks/use-agent-chat";
import { useChatPromptSuggestions } from "@/lib/hooks/use-chat-prompt-suggestions";
import {
  reconcileCreatedChatTitle,
  useChatSessionMutations,
} from "@/lib/hooks/use-chat-sessions";
import { useChatToolApprovals } from "@/lib/hooks/use-chat-tool-approvals";
import { useElapsedSeconds } from "@/lib/hooks/use-elapsed-seconds";
import { useMcpLogosByConnectionId } from "@/lib/hooks/use-mcp-logos";
import { useSlackMirrorStream } from "@/lib/hooks/use-slack-mirror-stream";
import { useStableValue } from "@/lib/hooks/use-stable-value";
import { usePathname, useRouter } from "@/lib/navigation";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import { dashboardOrpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import type {
  ChatDraftAction,
  ChatToolApprovalDecision,
} from "@/types/analytics/studio-events";
import type { ChatMessageAuthor } from "@/types/chat";
import type { ChatToolPart } from "@/types/components/chat-conversation";
import type { ChatComposerHandle } from "@/types/components/chat-input";
import type {
  StandaloneChatPageClientProps,
  UserImageGridProps,
} from "@/types/components/chat-page";
import type { PublishedSocialPost } from "@/types/content/post-social";
import { findAgentTurnToRetry } from "@/utils/agent-questions";
import { findAutopilotWorkflowDraft } from "@/utils/autopilot-workflow-draft";
import { resolveOrganizationLogo } from "@/utils/avatar";
import { hasVisibleChatContent } from "@/utils/chat-activity";
import {
  parseChatAnnotations,
  restoreChatReferences,
} from "@/utils/chat-annotations";
import {
  artifactTabId,
  getChatArtifacts,
  getLatestArtifactWrite,
} from "@/utils/chat-artifact";
import { mergeChatCustomTools } from "@/utils/chat-custom-tools";
import { chatHistoryQueryOptions } from "@/utils/chat-history-query";
import {
  resolveChatMessageAuthor,
  shouldShowChatAuthorAvatars,
  toChatMessageAuthor,
} from "@/utils/chat-message-author";
import { buildChatMinimapTurns } from "@/utils/chat-minimap";
import { getChatPosts, parsePostReferenceValue } from "@/utils/chat-posts";
import {
  DEFAULT_CHAT_PREFERENCES,
  parseStoredThinkingLevel,
  readStoredChatPreferences,
  subscribeToStoredChatPreferences,
} from "@/utils/chat-preferences";
import { formatLongDate } from "@/utils/dashboard-greeting";
import { getGreetingPeriod } from "@/utils/dashboard-greeting-period";
import { formatElapsedSeconds } from "@/utils/format-elapsed-seconds";
import {
  getReferenceDisplay,
  parseReferenceValue,
} from "@/utils/integration-reference";
import dynamic from "@/utils/lazy-component";
import { getOutputTypePromptLabel } from "@/utils/output-types";
import { buildPublishedChatMessage } from "@/utils/social-publish";

import { ChatPageSkeleton } from "./skeleton";

const BlogChangelogPreview = dynamic(
  () =>
    import("@/components/ai/blog-changelog-preview").then(
      (mod) => mod.BlogChangelogPreview
    ),
  { ssr: false }
);

const TwitterPreview = dynamic(
  () =>
    import("@/components/ai/twitter-preview").then((mod) => mod.TwitterPreview),
  { ssr: false }
);

const LinkedInPreview = dynamic(
  () =>
    import("@/components/ai/linkedin-preview").then(
      (mod) => mod.LinkedInPreview
    ),
  { ssr: false }
);

const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

const emptySubscribe = () => () => {};

function SlackMirrorNotice() {
  const t = useTranslations("chat.page");
  return (
    <div className="border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-center text-sm">
      {t("slackMirrorNotice")}
    </div>
  );
}

function CreateToolPendingIndicator({
  toolCallId,
}: Pick<RenderableToolPart, "toolCallId">) {
  const t = useTranslations("chat.page");
  const elapsedSeconds = useElapsedSeconds(true, toolCallId);

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <span>{t("working")}</span>
      {elapsedSeconds >= TOOL_TIMER_THRESHOLD_SECONDS && (
        <span className="text-subtle-foreground shrink-0 text-xs tabular-nums">
          {formatElapsedSeconds(elapsedSeconds)}
        </span>
      )}
    </div>
  );
}

function CompletedToolTimer({
  children,
  toolCallId,
}: Pick<RenderableToolPart, "toolCallId"> & { children?: ReactNode }) {
  useElapsedSeconds(false, toolCallId);
  return children ?? null;
}

type RenderableToolPart = DynamicToolUIPart | ToolUIPart;

function UserImageGrid({ children }: UserImageGridProps) {
  const t = useTranslations("chat.page");
  const [isExpanded, setIsExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const imageItems = Children.toArray(children) as ReactElement[];
  const hiddenImageCount = Math.max(
    imageItems.length - MAX_VISIBLE_CHAT_IMAGES,
    0
  );
  const visibleImageCount = isExpanded
    ? imageItems.length
    : imageItems.length - hiddenImageCount;

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(
          `[data-image-index="${MAX_VISIBLE_CHAT_IMAGES}"] button`
        )
        ?.focus();
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [isExpanded]);

  return (
    <m.div
      className="relative flex w-[28rem] max-w-full flex-wrap justify-end gap-1.5"
      layout={!reduceMotion}
      layoutDependency={isExpanded}
      ref={gridRef}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE.out }
      }
    >
      {imageItems.slice(0, visibleImageCount).map((imageItem, index) => {
        const isCovered =
          !isExpanded &&
          hiddenImageCount > 0 &&
          index === MAX_VISIBLE_CHAT_IMAGES - 1;

        return (
          <m.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="aspect-square w-[calc((100%_-_0.75rem)/3)] [&_img]:size-full [&_img]:object-cover [&>*]:m-0 [&>*]:size-full"
            data-image-index={index}
            inert={isCovered ? true : undefined}
            initial={
              reduceMotion || index < MAX_VISIBLE_CHAT_IMAGES
                ? false
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            key={imageItem.key}
            layout={!reduceMotion}
            layoutDependency={isExpanded}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.3, ease: EASE.out }
            }
          >
            {imageItem}
          </m.div>
        );
      })}
      {!isExpanded && hiddenImageCount > 0 && (
        <m.button
          animate={{ opacity: 1 }}
          aria-label={t("showMoreImages", { count: hiddenImageCount })}
          className="focus-visible:ring-ring absolute right-0 bottom-0 z-10 flex aspect-square w-[calc((100%_-_0.75rem)/3)] items-center justify-center rounded-lg border border-white/15 bg-black/60 text-xl font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none"
          initial={reduceMotion ? false : { opacity: 0 }}
          onClick={() => setIsExpanded(true)}
          transition={
            reduceMotion ? { duration: 0 } : { delay: 0.1, duration: 0.2 }
          }
          type="button"
        >
          +{hiddenImageCount}
        </m.button>
      )}
    </m.div>
  );
}

function ChatContentPanelToggle({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("chat.contentPanel");
  const label = t("toggle", { count });
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={open}
            className="hidden lg:inline-flex"
            data-content-toggle=""
            onClick={onToggle}
            size="sm"
            variant={open ? "secondary" : "outline"}
          />
        }
      >
        <HugeiconsIcon className="size-4" icon={File02Icon} strokeWidth={1.8} />
        <span aria-hidden="true" className="tabular-nums">
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ProjectScopeLoadingInput() {
  const t = useTranslations("chat.page");
  return (
    <Skeleton
      aria-label={t("loadingProject")}
      className="bg-muted/50 h-24 rounded-xl"
      role="status"
    />
  );
}

function discardFailedNewChatFromSidebar({
  chatId,
  initialChatId,
  organizationId,
  queryClient,
  removePendingChatSession,
}: {
  chatId: string;
  initialChatId: string | undefined;
  organizationId: string;
  queryClient: QueryClient;
  removePendingChatSession: (chatId: string) => void;
}) {
  if (initialChatId) {
    return;
  }
  removePendingChatSession(chatId);
  queryClient.invalidateQueries({
    queryKey: ["chat-sessions", organizationId],
  });
}

// react-doctor-disable-next-line react-doctor/no-high-complexity-react-function -- standalone chat page predates the complexity cap; split in a dedicated refactor
function StandaloneChatPageClient({
  organizationSlug,
  chatId: initialChatId,
}: StandaloneChatPageClientProps) {
  const t = useTranslations("chat.page");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const tChatErrors = useTranslations("chat.errors");
  const locale = useLocale();
  const router = useRouter();
  const [initialQuery, setInitialQuery] = useQueryState(
    "q",
    parseAsString.withOptions({ history: "replace" })
  );
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const orgFromList = getOrganization(organizationSlug);
  const organization =
    activeOrganization?.slug === organizationSlug
      ? activeOrganization
      : orgFromList;
  const organizationId = organization?.id ?? "";
  const { projectId: activeProjectId, isResolved: isProjectResolved } =
    useActiveProject();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const { insertPendingChatSession, removePendingChatSession } =
    useChatSessionMutations();
  const { data: membersData } = useQuery({
    queryKey: ["members", organizationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: { organizationId },
      });
      if (error) {
        throw new Error("Failed to fetch organization members");
      }
      return data;
    },
    enabled: Boolean(organizationId),
    staleTime: 1000 * 60 * 5,
  });
  const mcpLogosByConnectionId = useMcpLogosByConnectionId(organizationId);
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [context, setContext] = useState<ContextItem[]>([]);
  const [hasCustomizedContext, setHasCustomizedContext] = useState(false);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(
    DEFAULT_CHAT_PREFERENCES.thinkingLevel
  );
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageBranches, setMessageBranches] = useState<
    Record<string, { tails: ChatUIMessage[][]; active: number }>
  >({});
  const [isInputEmpty, setIsInputEmpty] = useState(true);
  const chatInputRef = useRef<ChatComposerHandle | null>(null);
  const reduceMotion = useReducedMotion();

  const {
    data: chatHistoryData,
    isLoading: isChatHistoryLoading,
    isPending: isChatHistoryPending,
  } = useQuery(chatHistoryQueryOptions(organizationId, initialChatId));
  const isSlackMirrored =
    chatHistoryData?.externalChannelId?.source === "slack";
  const isProjectScopePending = !initialChatId && !isProjectResolved;
  const currentAuthorUserId = session?.user.id;

  const [isFirstMessageTransition, setIsFirstMessageTransition] =
    useState(false);
  const firstMessageTransitionTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const triggerFirstMessageTransition = useCallback(() => {
    if (firstMessageTransitionTimerRef.current) {
      clearTimeout(firstMessageTransitionTimerRef.current);
    }
    setIsFirstMessageTransition(true);
    firstMessageTransitionTimerRef.current = setTimeout(() => {
      setIsFirstMessageTransition(false);
      firstMessageTransitionTimerRef.current = null;
    }, 600);
  }, []);
  useEffect(
    () => () => {
      if (firstMessageTransitionTimerRef.current) {
        clearTimeout(firstMessageTransitionTimerRef.current);
      }
    },
    []
  );

  const agent = useAgentChat({
    organizationId,
    initialChatId,
    projectId: activeProjectId,
    thinkingLevel,
    context,
    hasCustomizedContext,
    authorUserId: currentAuthorUserId,
    chatInputRef,
    persistQueue: true,
    canSend: !isProjectScopePending,
    paused: isSlackMirrored,
    onBeforeSend: ({ chatId, isEmptyChat, isFirstInNewChat }) => {
      if (isEmptyChat) {
        triggerFirstMessageTransition();
      }
      if (isFirstInNewChat) {
        insertPendingChatSession(chatId);
      }
    },
    onChatCreated: (chatId) => {
      void reconcileCreatedChatTitle(
        queryClient,
        organizationId,
        activeProjectId,
        chatId
      );
    },
    onNewChatReplied: ({ chatId, messages: replied, wasStoppedByUser }) => {
      queryClient.setQueryData(["chat-history", organizationId, chatId], {
        messages: replied,
        lastResponseStopped: wasStoppedByUser,
        activeStreamId: null,
        externalChannelId: null,
        slackThreadUrl: null,
      });
      router.replace(`/${organizationSlug}/chat/${chatId}`, {
        scroll: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["chat-sessions", organizationId],
      });
    },
    onError: (chatId) =>
      discardFailedNewChatFromSidebar({
        chatId,
        initialChatId,
        organizationId,
        queryClient,
        removePendingChatSession,
      }),
  });
  const {
    chatId: stableChatId,
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
    queuedMessages,
    authorMetadata,
    handleStop,
    handleRemoveQueued,
    handleEditQueued,
    handleSteerQueued,
    handleSend: sendToAgent,
    resendFrom,
    retry,
    pendingQuestion,
    answerQuestion,
    dismissQuestion,
  } = agent;

  const handleSuggestionSelect = useCallback((text: string) => {
    chatInputRef.current?.setText(text);
  }, []);
  const promptSuggestions = useChatPromptSuggestions({
    organizationId,
    projectId: activeProjectId,
    enabled: isProjectResolved && !initialChatId,
  });

  const chatPosts = useMemo(() => getChatPosts(messages), [messages]);
  const chatArtifacts = useMemo(() => getChatArtifacts(messages), [messages]);
  const previewCount = chatPosts.length + chatArtifacts.length;
  const mentionsDraft = chatPosts.flatMap((post) =>
    post.postId
      ? [
          {
            postId: post.postId,
            title: post.title || tCommon("labels.untitled"),
            contentType: post.contentType,
          },
        ]
      : []
  );
  const postMentions = useStableValue(
    mentionsDraft,
    mentionsDraft
      .map(
        (post) => `${post.postId}\u0000${post.title}\u0000${post.contentType}`
      )
      .join("\n")
  );
  const postTitlesById = useMemo(
    () => new Map(postMentions.map((post) => [post.postId, post.title])),
    [postMentions]
  );
  const { active: activeRightPanel, closePanel, openPanel } = useRightPanel();
  const isPreviewOpen = activeRightPanel === "preview";
  const [storedPreviewTabIds, setPreviewTabIds] = useState<string[]>([]);
  const [storedPreviewToolCallId, setPreviewToolCallId] = useState<
    string | null
  >(null);
  const previewTabIds = useMemo(() => {
    const postIds = new Set([
      ...chatPosts.map((post) => post.toolCallId),
      ...chatArtifacts.map((artifact) => artifact.tabId),
    ]);
    return storedPreviewTabIds.filter((id) => postIds.has(id));
  }, [chatArtifacts, chatPosts, storedPreviewTabIds]);
  const previewToolCallId =
    storedPreviewToolCallId && previewTabIds.includes(storedPreviewToolCallId)
      ? storedPreviewToolCallId
      : (previewTabIds.at(-1) ?? null);
  const openPostPreview = useCallback(
    (toolCallId: string) => {
      setPreviewTabIds((tabs) =>
        tabs.includes(toolCallId) ? tabs : [...tabs, toolCallId]
      );
      setPreviewToolCallId(toolCallId);
      openPanel("preview");
    },
    [openPanel]
  );
  const closePostPreviewTab = useCallback(
    (toolCallId: string) => {
      const index = previewTabIds.indexOf(toolCallId);
      const remaining = previewTabIds.filter((id) => id !== toolCallId);
      setPreviewTabIds(remaining);
      if (previewToolCallId === toolCallId) {
        setPreviewToolCallId(
          remaining[Math.min(index, remaining.length - 1)] ?? null
        );
      }
      if (remaining.length === 0) {
        closePanel("preview");
      }
    },
    [closePanel, previewTabIds, previewToolCallId]
  );
  const openArtifact = useCallback(
    (artifactId: string) => openPostPreview(artifactTabId(artifactId)),
    [openPostPreview]
  );
  const openContentPanel = useCallback(() => {
    const activeTab =
      previewToolCallId && previewTabIds.includes(previewToolCallId)
        ? previewToolCallId
        : (previewTabIds.at(-1) ??
          chatPosts.at(-1)?.toolCallId ??
          chatArtifacts.at(-1)?.tabId);
    if (activeTab) {
      openPostPreview(activeTab);
    }
  }, [
    chatArtifacts,
    chatPosts,
    openPostPreview,
    previewTabIds,
    previewToolCallId,
  ]);
  const handleAskForPostChanges = useCallback(
    (post: { postId: string; title: string }) => {
      chatInputRef.current?.insertPostReference({
        postId: post.postId,
        title: post.title || tCommon("labels.untitled"),
      });
    },
    [tCommon]
  );

  const annotationFocus = useChatQuote()?.annotationFocus ?? null;
  const openFocusedPost = useEffectEvent((postId: string) => {
    const post = chatPosts.find((entry) => entry.postId === postId);
    if (post) {
      openPostPreview(post.toolCallId);
    }
  });
  useEffect(() => {
    if (annotationFocus) {
      openFocusedPost(annotationFocus.postId);
    }
  }, [annotationFocus]);

  const latestPostToolCallId = chatPosts.at(-1)?.toolCallId ?? null;
  const [followedPostToolCallId, setFollowedPostToolCallId] =
    useState(latestPostToolCallId);
  if (followedPostToolCallId !== latestPostToolCallId) {
    setFollowedPostToolCallId(latestPostToolCallId);
    if (isPreviewOpen && latestPostToolCallId) {
      setPreviewTabIds((tabs) =>
        tabs.includes(latestPostToolCallId)
          ? tabs
          : [...tabs, latestPostToolCallId]
      );
      setPreviewToolCallId(latestPostToolCallId);
    }
  }

  const refreshedPostEditsRef = useRef(new Set<string>());
  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role !== "assistant") {
      return;
    }
    for (const part of lastMessage.parts) {
      if (
        !isToolUIPart(part) ||
        part.state !== "output-available" ||
        !CHAT_POST_EDIT_TOOL_NAMES.has(getToolName(part)) ||
        refreshedPostEditsRef.current.has(part.toolCallId)
      ) {
        continue;
      }
      refreshedPostEditsRef.current.add(part.toolCallId);
      const edited = createdPostToolOutputSchema.safeParse(part.output);
      if (edited.success) {
        void queryClient.invalidateQueries({
          queryKey: dashboardOrpc.content.get.queryKey({
            input: { organizationId, contentId: edited.data.postId },
          }),
        });
      }
    }
  }, [messages, organizationId, queryClient]);

  useEffect(() => {
    function syncChatPreferencesFromStorage() {
      const storedPreferences = readStoredChatPreferences();
      if (!storedPreferences) {
        return;
      }

      setThinkingLevel(storedPreferences.thinkingLevel);
    }

    // Existing chats restore their level from history; only an explicit
    // change in the shared effort picker (agent panel, other tab) replaces it.
    if (initialChatId) {
      return subscribeToStoredChatPreferences(syncChatPreferencesFromStorage);
    }

    syncChatPreferencesFromStorage();
    const unsubscribe = subscribeToStoredChatPreferences(
      syncChatPreferencesFromStorage
    );
    window.addEventListener("focus", syncChatPreferencesFromStorage);
    document.addEventListener(
      "visibilitychange",
      syncChatPreferencesFromStorage
    );

    return () => {
      unsubscribe();
      window.removeEventListener("focus", syncChatPreferencesFromStorage);
      document.removeEventListener(
        "visibilitychange",
        syncChatPreferencesFromStorage
      );
    };
  }, [initialChatId]);

  const messageAuthorsById = useMemo(() => {
    const authors = new Map<string, ChatMessageAuthor>();
    for (const member of membersData?.members ?? []) {
      authors.set(member.user.id, toChatMessageAuthor(member.user));
    }
    return authors;
  }, [membersData?.members]);
  const showMessageAuthorAvatars = shouldShowChatAuthorAvatars({
    isSlackMirrored,
    memberCount: messageAuthorsById.size,
  });

  const appendMirroredMessage = useCallback(
    (message: ChatUIMessage | null) => {
      if (!message) {
        return;
      }
      setMessages((prev) =>
        prev.some((item) => item.id === message.id)
          ? prev.map((item) => (item.id === message.id ? message : item))
          : [...prev, message]
      );
    },
    [setMessages]
  );

  const [isMirrorWorking, setIsMirrorWorking] = useState(false);

  const handleMirrorStatus = useCallback((status: MirrorChatStatus) => {
    setIsMirrorWorking(status === "working");
  }, []);

  useSlackMirrorStream(
    organizationId,
    initialChatId ?? null,
    isSlackMirrored,
    appendMirroredMessage,
    handleMirrorStatus
  );

  useEffect(() => {
    if (!isMirrorWorking) {
      return;
    }
    const timeout = setTimeout(() => {
      setIsMirrorWorking(false);
    }, MIRROR_WORKING_TIMEOUT_MS);
    return () => {
      clearTimeout(timeout);
    };
  }, [isMirrorWorking]);

  const relayApprovalMutation = useMutation({
    mutationFn: (input: { requestId: string; approved: boolean }) => {
      if (!initialChatId) {
        return Promise.resolve();
      }
      return relaySlackApproval(
        organizationId,
        initialChatId,
        input.requestId,
        input.approved
      );
    },
  });
  const relayMessageMutation = useMutation({
    mutationFn: (input: { text: string; tempId: string }) => {
      if (!initialChatId) {
        return Promise.resolve(null);
      }
      return relaySlackMirrorMessage(organizationId, initialChatId, input.text);
    },
    onSuccess: (message, input) => {
      setMessages((prev) => {
        const withoutTemp = prev.filter((item) => item.id !== input.tempId);
        if (!message || withoutTemp.some((item) => item.id === message.id)) {
          return withoutTemp;
        }
        return [...withoutTemp, message];
      });
      // Mark stale without refetching so the live mirror stream keeps owning
      // the open chat, and the next visit loads the relayed message.
      queryClient.invalidateQueries({
        queryKey: chatHistoryQueryOptions(organizationId, initialChatId)
          .queryKey,
        refetchType: "none",
      });
    },
    onError: (error, input) => {
      setMessages((prev) => prev.filter((item) => item.id !== input.tempId));
      setIsMirrorWorking(false);
      const relayError = error instanceof SlackRelayError ? error : null;
      if (relayError?.code === "USAGE_LIMIT_REACHED") {
        setChatError(tChatErrors("usageLimit"));
      } else if (relayError?.status === 429) {
        setChatError(t("slackRateLimited"));
      } else {
        setChatError(t("slackSendFailed"));
      }
    },
  });
  const relayMessage = useCallback(
    async (text: string) => {
      const tempId = `relay-pending-${nanoid(10)}`;
      setMessages((prev) => [
        ...prev,
        { id: tempId, role: "user", parts: [{ type: "text", text }] },
      ]);
      setIsMirrorWorking(true);
      try {
        await relayMessageMutation.mutateAsync({ text, tempId });
        return true;
      } catch {
        return false;
      }
    },
    [relayMessageMutation, setMessages]
  );

  const relayApproval = useCallback(
    (requestId: string, approved: boolean) =>
      relayApprovalMutation.mutateAsync({ requestId, approved }),
    [relayApprovalMutation]
  );

  // A saved chat picks its effort back up from the last message that set it.
  useLayoutEffect(() => {
    const historyMessages = chatHistoryData?.messages;
    if (!historyMessages?.length) {
      return;
    }
    for (let index = historyMessages.length - 1; index >= 0; index -= 1) {
      const thinkingLevelToRestore =
        historyMessages[index]?.metadata?.requestedThinkingLevel;
      const parsedThinkingLevel = thinkingLevelToRestore
        ? parseStoredThinkingLevel(thinkingLevelToRestore)
        : null;
      if (parsedThinkingLevel) {
        setThinkingLevel(parsedThinkingLevel);
        break;
      }
    }
  }, [chatHistoryData]);

  const pathname = usePathname();
  const navigationKey = useLocation({
    select: (location) => location.state.__TSR_key,
  });
  const previousNavigationKeyRef = useRef(navigationKey);
  const startOverInNewChat = useEffectEvent(() => {
    agent.startNewChat();
    setContext([]);
    setHasCustomizedContext(false);
  });
  // Opening the new-chat link again from a chat that started here starts over.
  const returnToNewChat = useEffectEvent(() => {
    if (agent.hasSentInNewChat() && agent.isIdle()) {
      startOverInNewChat();
    }
  });
  useEffect(() => {
    const hasNavigated = previousNavigationKeyRef.current !== navigationKey;
    previousNavigationKeyRef.current = navigationKey;
    if (
      !initialChatId &&
      hasNavigated &&
      pathname === `/${organizationSlug}/chat`
    ) {
      returnToNewChat();
    }
  }, [initialChatId, navigationKey, organizationSlug, pathname]);

  const draftStorageKey = localStorageKeys.chatDraft(
    initialChatId ?? `new:${organizationSlug}`
  );
  const pendingHistoryMessages = chatHistoryData?.messages?.length ?? 0;
  const isLoadingHistory =
    Boolean(initialChatId) &&
    messages.length === 0 &&
    (isChatHistoryLoading ||
      isChatHistoryPending ||
      pendingHistoryMessages > 0);

  // An artifact the agent writes while replying opens in the side panel; the
  // ones already in the chat when it loads stay closed.
  const [hasReplied, setHasReplied] = useState(false);
  if (isLoading && !hasReplied) {
    setHasReplied(true);
  }
  const latestArtifactWrite = useMemo(
    () => getLatestArtifactWrite(messages),
    [messages]
  );
  const latestArtifactWriteCallId = latestArtifactWrite?.toolCallId;
  const latestWrittenArtifactId = latestArtifactWrite?.artifactId;
  const openWrittenArtifact = useEffectEvent((artifactId: string) => {
    if (hasReplied) {
      openArtifact(artifactId);
    }
  });
  useEffect(() => {
    if (latestArtifactWriteCallId && latestWrittenArtifactId) {
      // react-doctor-disable-next-line react-hooks-js/set-state-in-effect -- the tool output arrives from the stream; opening the shared right panel can't happen during render
      openWrittenArtifact(latestWrittenArtifactId);
    }
  }, [latestArtifactWriteCallId, latestWrittenArtifactId]);
  const isPendingAutoSubmit =
    !initialChatId && Boolean(initialQuery?.trim()) && messages.length === 0;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true;
      }
      return target.isContentEditable;
    }

    function handleAutoFocus(event: KeyboardEvent) {
      if (isSlackMirrored) {
        return;
      }
      if (event.defaultPrevented) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key.length !== 1) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      chatInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleAutoFocus);
    return () => {
      window.removeEventListener("keydown", handleAutoFocus);
    };
  }, [isSlackMirrored]);

  const handleAddContext = useCallback((item: ContextItem) => {
    setHasCustomizedContext(true);
    trackEvent(POSTHOG_EVENTS.CHAT_CONTEXT_ADDED, {
      kind: getChatContextKind(item.type),
    });
    setContext((prev) => {
      const exists = prev.some((c) => {
        if (c.type !== item.type) {
          return false;
        }
        if (c.type === "github-repo" && item.type === "github-repo") {
          return c.owner === item.owner && c.repo === item.repo;
        }
        return c.integrationId === item.integrationId;
      });
      if (exists) {
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const handleRemoveContext = useCallback((item: ContextItem) => {
    setHasCustomizedContext(true);
    trackEvent(POSTHOG_EVENTS.CHAT_CONTEXT_REMOVED, {
      kind: getChatContextKind(item.type),
    });
    setContext((prev) =>
      prev.filter((c) => {
        if (c.type !== item.type) {
          return true;
        }
        if (c.type === "github-repo" && item.type === "github-repo") {
          return !(c.owner === item.owner && c.repo === item.repo);
        }
        return c.integrationId !== item.integrationId;
      })
    );
  }, []);

  const extractUserMessageContent = useCallback((message: ChatUIMessage) => {
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
  }, []);

  const getUserMessageText = useCallback(
    (message: ChatUIMessage) => extractUserMessageContent(message).text,
    [extractUserMessageContent]
  );

  const toDisplayText = useCallback(
    (serialized: string) => {
      const annotated = parseChatAnnotations(serialized);
      const text = annotated ? annotated.rest : serialized;
      return text.replace(CHAT_REFERENCE_TOKEN_SPLIT_REGEX, (match) => {
        const postId = parsePostReferenceValue(match);
        if (postId) {
          return `@${postTitlesById.get(postId) ?? tCommon("labels.untitled")}`;
        }
        const item = parseReferenceValue(match);
        return item ? getReferenceDisplay(item) : match;
      });
    },
    [postTitlesById, tCommon]
  );

  const handleStartEditMessage = useCallback((messageId: string) => {
    setEditingMessageId(messageId);
  }, []);

  const handleCancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const resendFromUserMessage = useCallback(
    async (
      userMessageId: string,
      text: string,
      attachments: ChatMessagePart[]
    ) => {
      if (isSlackMirrored) {
        return;
      }

      const current = messagesRef.current;
      const index = current.findIndex((m) => m.id === userMessageId);
      if (index === -1) {
        return;
      }

      const currentTail = current.slice(index);

      setMessageBranches((prev) => {
        const existing = prev[userMessageId];
        if (!existing) {
          return {
            ...prev,
            [userMessageId]: { tails: [currentTail, []], active: 1 },
          };
        }
        const tails = [...existing.tails];
        tails[existing.active] = currentTail;
        tails.push([]);
        return {
          ...prev,
          [userMessageId]: { tails, active: tails.length - 1 },
        };
      });

      await resendFrom(userMessageId, text, attachments);
    },
    [isSlackMirrored, messagesRef, resendFrom]
  );

  const handleEditMessage = useCallback(
    async (userMessageId: string, newText: string) => {
      setEditingMessageId(null);
      trackEvent(POSTHOG_EVENTS.CHAT_MESSAGE_EDITED, { chat_id: stableChatId });
      const current = messagesRef.current;
      const message = current.find((m) => m.id === userMessageId);
      const original = message
        ? extractUserMessageContent(message)
        : { text: "", attachments: [] };
      await resendFromUserMessage(
        userMessageId,
        restoreChatReferences(original.text, newText, postTitlesById),
        original.attachments
      );
    },
    [
      extractUserMessageContent,
      messagesRef,
      postTitlesById,
      resendFromUserMessage,
      stableChatId,
    ]
  );

  const handleRetryMessage = useCallback(
    async (userMessageId: string) => {
      const current = messagesRef.current;
      const message = current.find((m) => m.id === userMessageId);
      if (!message) {
        return;
      }
      const { text, attachments } = extractUserMessageContent(message);
      if (!text.trim() && attachments.length === 0) {
        return;
      }
      trackEvent(POSTHOG_EVENTS.CHAT_RETRY, { chat_id: stableChatId });
      await resendFromUserMessage(userMessageId, text, attachments);
    },
    [
      extractUserMessageContent,
      messagesRef,
      resendFromUserMessage,
      stableChatId,
    ]
  );

  const [branchSwitchSignal, setBranchSwitchSignal] = useState<{
    userMessageId: string;
    tick: number;
  } | null>(null);

  const handleSwitchBranch = useCallback(
    (userMessageId: string, direction: "prev" | "next") => {
      const existing = messageBranches[userMessageId];
      if (!existing || existing.tails.length <= 1) {
        return;
      }
      const current = messagesRef.current;
      const index = current.findIndex((m) => m.id === userMessageId);
      if (index === -1) {
        return;
      }
      const before = current.slice(0, index);
      const currentTail = current.slice(index);

      const tails = [...existing.tails];
      tails[existing.active] = currentTail;
      const total = tails.length;
      const active =
        direction === "next"
          ? (existing.active + 1) % total
          : (existing.active - 1 + total) % total;

      setMessageBranches((prev) => ({
        ...prev,
        [userMessageId]: { tails, active },
      }));
      setMessages([...before, ...(tails[active] ?? [])]);

      setBranchSwitchSignal({ userMessageId, tick: Date.now() });
      trackEvent(POSTHOG_EVENTS.CHAT_BRANCH_SWITCHED, {
        chat_id: stableChatId,
        direction,
        branch_count: total,
      });
    },
    [messageBranches, messagesRef, setMessages, stableChatId]
  );

  const handleSend = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      if (isSlackMirrored) {
        const trimmed = text.trim();
        if (trimmed.length > 0) {
          relayMessage(trimmed);
        }
        return;
      }
      await sendToAgent(text, attachments);
    },
    [isSlackMirrored, relayMessage, sendToAgent]
  );

  const autoSubmittedQueryRef = useRef<string | null>(null);
  const pendingInitialQueryResetRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialChatId) {
      return;
    }
    const trimmedInitialQuery = initialQuery?.trim();
    if (!trimmedInitialQuery) {
      autoSubmittedQueryRef.current = null;
      pendingInitialQueryResetRef.current = null;
      return;
    }
    if (autoSubmittedQueryRef.current === trimmedInitialQuery) {
      return;
    }
    if (!organizationId || !isProjectResolved) {
      return;
    }
    if (messagesRef.current.length > 0) {
      if (pendingInitialQueryResetRef.current === trimmedInitialQuery) {
        return;
      }
      pendingInitialQueryResetRef.current = trimmedInitialQuery;
      startOverInNewChat();
      return;
    }

    const queryToSubmit = trimmedInitialQuery;
    let cancelled = false;
    let attempts = 0;

    function submitWhenComposerIsReady() {
      if (cancelled) {
        return;
      }

      const chatInput = chatInputRef.current;
      if (!chatInput) {
        attempts += 1;
        if (attempts < 10) {
          window.requestAnimationFrame(submitWhenComposerIsReady);
        }
        return;
      }

      autoSubmittedQueryRef.current = queryToSubmit;
      pendingInitialQueryResetRef.current = null;
      chatInput.setText(queryToSubmit);
      window.requestAnimationFrame(() => {
        chatInput.submit();
        setInitialQuery(null);
      });
    }

    submitWhenComposerIsReady();

    return () => {
      cancelled = true;
    };
  }, [
    chatInputRef,
    initialChatId,
    initialQuery,
    isProjectResolved,
    messagesRef,
    organizationId,
    setInitialQuery,
  ]);

  useEffect(() => {
    function handleGlobalKeydown(event: KeyboardEvent) {
      if (isSlackMirrored) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key.length !== 1) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      chatInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleGlobalKeydown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
    };
  }, [isSlackMirrored]);

  const handleClearError = useCallback(
    () => setChatError(null),
    [setChatError]
  );

  const handleRetryAfterError = useCallback(async () => {
    // A failed send after an answer or an approval goes out again from the
    // agent's turn, so the answer stays in the conversation.
    if (findAgentTurnToRetry(messagesRef.current)) {
      retry();
      return;
    }
    let lastUserMessage: ChatUIMessage | undefined;
    for (const message of messagesRef.current) {
      if (message.role === "user") {
        lastUserMessage = message;
      }
    }
    if (!lastUserMessage) {
      return;
    }
    setChatError(null);
    await handleRetryMessage(lastUserMessage.id);
  }, [handleRetryMessage, messagesRef, retry, setChatError]);

  const trackToolApproval = (
    part: ChatToolPart,
    decision: ChatToolApprovalDecision
  ) =>
    trackEvent(POSTHOG_EVENTS.CHAT_TOOL_APPROVAL, {
      tool: getToolName(part),
      decision,
      chat_id: stableChatId,
      relayed_to_slack: isSlackMirrored,
    });
  const handleApproveTool = (approvalId: string, part: ChatToolPart) => {
    trackToolApproval(part, "approved");
    return isSlackMirrored
      ? relayApproval(approvalId, true)
      : agent.handleApproveTool(approvalId);
  };
  const handleDenyTool = (approvalId: string, part: ChatToolPart) => {
    trackToolApproval(part, "denied");
    return isSlackMirrored
      ? relayApproval(approvalId, false)
      : agent.handleDenyTool(approvalId);
  };

  const { approval: composerApproval, isApprovalInComposer } =
    useChatToolApprovals({
      chatId: stableChatId,
      messages,
      ownCardToolNames: CHAT_PAGE_CARD_TOOL_NAMES,
      onApprove: handleApproveTool,
      onDeny: handleDenyTool,
    });

  /** A draft the agent writes: streams in, then waits to be saved or sent back. */
  function renderCreateTool(
    toolPart: ChatToolPart,
    isActive: boolean,
    hasInlineActivity: boolean
  ) {
    const contentType =
      CHAT_CREATE_TOOL_TYPES[
        `tool-${getToolName(toolPart)}` as keyof typeof CHAT_CREATE_TOOL_TYPES
      ];
    const input = toolPart.input as
      | { title?: string; markdown?: string }
      | undefined;
    const title = input?.title ?? tCommon("labels.untitled");
    const markdown = input?.markdown ?? "";

    if (
      toolPart.state === "input-streaming" ||
      toolPart.state === "input-available"
    ) {
      if (!isActive) {
        return (
          <CompletedToolTimer
            key={toolPart.toolCallId}
            toolCallId={toolPart.toolCallId}
          >
            <span className="text-muted-foreground text-sm">
              Draft generation interrupted
            </span>
          </CompletedToolTimer>
        );
      }
      const hasDraftText = Boolean(input?.title || markdown);
      if (hasInlineActivity) {
        return hasDraftText ? (
          <ChatDraftStreamingPreview
            key={toolPart.toolCallId}
            markdown={markdown}
            title={input?.title}
          />
        ) : null;
      }
      return (
        <div className="flex flex-col gap-2" key={toolPart.toolCallId}>
          <CreateToolPendingIndicator toolCallId={toolPart.toolCallId} />
          {hasDraftText ? (
            <ChatDraftStreamingPreview
              markdown={markdown}
              title={input?.title}
            />
          ) : null}
        </div>
      );
    }

    if (toolPart.state === "output-error") {
      return (
        <CompletedToolTimer
          key={toolPart.toolCallId}
          toolCallId={toolPart.toolCallId}
        >
          <div className="bg-destructive/10 text-destructive flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs">
            <HugeiconsIcon className="size-3.5" icon={X} />
            <span>{t("draftGenerationFailed")}</span>
          </div>
        </CompletedToolTimer>
      );
    }

    if (toolPart.state === "output-denied") {
      return (
        <CompletedToolTimer
          key={toolPart.toolCallId}
          toolCallId={toolPart.toolCallId}
        />
      );
    }

    if (toolPart.approval?.reason === "discard") {
      return (
        <CompletedToolTimer
          key={toolPart.toolCallId}
          toolCallId={toolPart.toolCallId}
        />
      );
    }

    const savedPostResult = createdPostToolOutputSchema.safeParse(
      toolPart.output
    );
    const savedPost = savedPostResult.success
      ? savedPostResult.data
      : undefined;
    const previewState: "draft" | "finished" =
      toolPart.state === "output-available" ||
      toolPart.approval?.reason === "manual-draft" ||
      toolPart.approval?.reason === "manual-published"
        ? "finished"
        : "draft";
    const persistedStatus: "draft" | "published" =
      savedPost?.status === "published" ||
      toolPart.approval?.reason === "manual-published"
        ? "published"
        : "draft";

    const approvalId =
      toolPart.state === "approval-requested"
        ? toolPart.approval.id
        : undefined;
    const trackDraftAction = (action: ChatDraftAction) => {
      trackEvent(POSTHOG_EVENTS.CHAT_DRAFT_ACTION, {
        action,
        type: contentType,
        chat_id: stableChatId,
        relayed_to_slack: isSlackMirrored,
      });
    };
    const handleApprove = approvalId
      ? () => {
          trackDraftAction("approve");
          return isSlackMirrored
            ? relayApproval(approvalId, true)
            : addToolApprovalResponse({
                id: approvalId,
                approved: true,
              });
        }
      : undefined;
    const handleDeny = approvalId
      ? () => {
          trackDraftAction("deny");
          return isSlackMirrored
            ? relayApproval(approvalId, false)
            : addToolApprovalResponse({
                id: approvalId,
                approved: false,
                reason: "discard",
              });
        }
      : undefined;
    const handlePersist =
      approvalId && !isSlackMirrored
        ? async (
            status: "draft" | "published",
            payload: { title: string; markdown: string }
          ) => {
            trackDraftAction(
              status === "published" ? "save_published" : "save_draft"
            );
            const savedPost = await dashboardOrpcClient.chat.posts
              .create({
                ...payload,
                organizationId,
                chatId: stableChatId,
                toolCallId: toolPart.toolCallId,
                contentType,
                status,
              })
              .catch(() => {
                throw new Error(tCommon("errors.generic"));
              });
            setMessages((current) =>
              linkSavedChatPosts(current, [
                {
                  postId: savedPost.postId,
                  toolCallId: toolPart.toolCallId,
                  title: payload.title,
                  markdown: payload.markdown,
                  contentType,
                  status,
                },
              ])
            );
            queryClient.invalidateQueries({
              queryKey: ["chat-sessions", organizationId],
            });
          }
        : undefined;
    const handleRegenerate = approvalId
      ? async (
          instructions: string,
          payload: { title: string; markdown: string }
        ) => {
          trackDraftAction("regenerate");
          const regeneratePrompt = `Regenerate the ${getOutputTypePromptLabel(contentType)} with these changes: ${instructions}\n\nCurrent title: ${payload.title}\n\nCurrent draft:\n${payload.markdown}`;
          if (isSlackMirrored) {
            const sent = await relayMessage(regeneratePrompt);
            if (sent) {
              await relayApproval(approvalId, false);
            }
            return;
          }
          await addToolApprovalResponse({
            id: approvalId,
            approved: false,
            reason: "discard",
          });
          sendMessage({
            text: regeneratePrompt,
            metadata: authorMetadata,
          });
        }
      : undefined;

    const handlePublished = (published: PublishedSocialPost) => {
      trackEvent(POSTHOG_EVENTS.CHAT_DRAFT_ACTION, {
        action: "publish_social",
        type: contentType,
        chat_id: stableChatId,
        platform: published.platform,
        relayed_to_slack: isSlackMirrored,
      });
      sendMessage({
        text: buildPublishedChatMessage(published),
        metadata: authorMetadata,
      });
    };

    if (contentType === "twitter_post") {
      return (
        <CompletedToolTimer
          key={toolPart.toolCallId}
          toolCallId={toolPart.toolCallId}
        >
          <TwitterPreview
            markdown={markdown}
            onApprove={handleApprove}
            onDeny={handleDeny}
            onPersist={handlePersist}
            onPublished={handlePublished}
            onRegenerate={handleRegenerate}
            organization={{
              name: organization?.name ?? tCommon("labels.yourName"),
              logo: resolveOrganizationLogo(organization?.logo) ?? null,
            }}
            organizationId={organizationId}
            persistedStatus={persistedStatus}
            state={previewState}
            title={title}
          />
        </CompletedToolTimer>
      );
    }

    if (contentType === "linkedin_post") {
      return (
        <CompletedToolTimer
          key={toolPart.toolCallId}
          toolCallId={toolPart.toolCallId}
        >
          <LinkedInPreview
            markdown={markdown}
            onApprove={handleApprove}
            onDeny={handleDeny}
            onPersist={handlePersist}
            onPublished={handlePublished}
            onRegenerate={handleRegenerate}
            organization={{
              name: organization?.name ?? tCommon("labels.yourName"),
              logo: resolveOrganizationLogo(organization?.logo) ?? null,
            }}
            organizationId={organizationId}
            persistedStatus={persistedStatus}
            state={previewState}
            title={title}
          />
        </CompletedToolTimer>
      );
    }

    return (
      <CompletedToolTimer
        key={toolPart.toolCallId}
        toolCallId={toolPart.toolCallId}
      >
        <BlogChangelogPreview
          contentType={contentType}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          postId={savedPost?.postId}
          onOpenPreview={() => openPostPreview(toolPart.toolCallId)}
          onRevise={() => {
            if (savedPost?.postId) {
              handleAskForPostChanges({ postId: savedPost.postId, title });
            } else if (isInputEmpty) {
              chatInputRef.current?.setText(t("revisePrefill", { title }));
            } else {
              chatInputRef.current?.focus();
            }
          }}
          markdown={markdown}
          onApprove={handleApprove}
          onDeny={handleDeny}
          onPersist={handlePersist}
          persistedStatus={persistedStatus}
          state={previewState}
          title={title}
        />
      </CompletedToolTimer>
    );
  }

  const customTools = mergeChatCustomTools(
    {
      names: CHAT_CREATE_TOOL_NAMES,
      render: (part, { isActive, hasInlineActivity }) =>
        renderCreateTool(part, isActive, hasInlineActivity),
    },
    autopilotWorkflowDraftTools({
      latestToolCallId:
        findAutopilotWorkflowDraft(messages)?.toolCallId ?? null,
    })
  );

  if (isLoadingHistory) {
    return <ChatPageSkeleton />;
  }

  if (!(hasMessages || isPendingAutoSubmit || isLoading)) {
    if (isSlackMirrored) {
      return (
        <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center px-4">
          <div className="mx-auto w-full max-w-2xl min-w-0">
            <SlackMirrorNotice />
          </div>
        </div>
      );
    }

    const now = isHydrated ? new Date() : null;
    const userName = isHydrated
      ? session?.user?.name?.split(" ")[0]
      : undefined;
    const period = now ? getGreetingPeriod(now) : null;
    let greeting = t("welcome");
    if (period && userName) {
      greeting = tHome("greetingWithName", { period, name: userName });
    } else if (period) {
      greeting = tHome("greeting", { period });
    }
    const dateStr = now ? formatLongDate(now, locale) : "\u00A0";

    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4">
          <div className="w-full space-y-1">
            <p className="text-muted-foreground text-xs">{dateStr}</p>
            <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">
              {greeting}
            </h1>
          </div>
          <div className="w-full min-w-0">
            {isProjectScopePending ? (
              <ProjectScopeLoadingInput />
            ) : (
              <ChatInput
                approval={composerApproval}
                dropZone="document"
                authorsById={messageAuthorsById}
                context={context}
                draftStorageKey={draftStorageKey}
                error={chatError}
                initialValue={initialQuery ?? undefined}
                isLoading={isLoading}
                isStopping={isStopping}
                onAddContext={handleAddContext}
                onClearError={handleClearError}
                onEditQueued={handleEditQueued}
                onEmptyChange={setIsInputEmpty}
                onRemoveContext={handleRemoveContext}
                onRemoveQueued={handleRemoveQueued}
                onSend={handleSend}
                onSteerQueued={handleSteerQueued}
                onStop={handleStop}
                organizationId={organizationId}
                organizationSlug={organizationSlug}
                queuedMessages={queuedMessages}
                ref={chatInputRef}
                showAuthorAvatars={showMessageAuthorAvatars}
              />
            )}
          </div>
          <ChatHomeSuggestions
            disabled={isLoading || isProjectScopePending}
            heading={promptSuggestions.heading}
            hidden={!isInputEmpty}
            isLoading={promptSuggestions.isLoading}
            onSelect={handleSuggestionSelect}
            suggestions={promptSuggestions.suggestions}
          />
        </div>
      </div>
    );
  }

  const visibleMessages = messages.filter((message) =>
    hasVisibleChatContent(message)
  );
  const branchPointIndex = branchSwitchSignal
    ? visibleMessages.findIndex(
        (message) => message.id === branchSwitchSignal.userMessageId
      )
    : -1;
  const minimapTurns = buildChatMinimapTurns(visibleMessages, (message) =>
    toDisplayText(getUserMessageText(message))
  );

  return (
    <>
      <LazyMotion features={loadMotionFeatures} strict>
        <div className="@container/chat relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {visibleMessages.length > 0 ? (
            <HeaderActionsPortal>
              <div className="flex items-center gap-2">
                {previewCount > 0 ? (
                  <ChatContentPanelToggle
                    count={previewCount}
                    onToggle={() =>
                      isPreviewOpen ? closePanel("preview") : openContentPanel()
                    }
                    open={isPreviewOpen}
                  />
                ) : null}
                <ChatSharePopover chatId={stableChatId} />
              </div>
            </HeaderActionsPortal>
          ) : null}
          <ChatConversation
            activeChatId={stableChatId}
            customTools={customTools}
            getMessageClassName={(_message, index) =>
              branchPointIndex !== -1 &&
              index > branchPointIndex &&
              "chat-branch-fade-in"
            }
            getMessageKey={(message, index) =>
              branchPointIndex !== -1 && index > branchPointIndex
                ? `${message.id}-${branchSwitchSignal?.tick}`
                : message.id
            }
            isStandalonePartVisible={(content) =>
              !isValidElement<ComponentProps<typeof CompletedToolTimer>>(
                content
              ) ||
              content.type !== CompletedToolTimer ||
              content.props.children != null
            }
            isApprovalInComposer={isApprovalInComposer}
            isStopping={isStopping}
            isWorking={isMirrorWorking}
            layout="page"
            mcpLogosByConnectionId={mcpLogosByConnectionId}
            messages={messages}
            notices={
              <>
                {wasStoppedByUser && !isLoading && (
                  <div className="bg-destructive/10 text-destructive flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs">
                    <HugeiconsIcon className="size-3.5" icon={X} />
                    <span>{t("responseStopped")}</span>
                  </div>
                )}
                {chatError && !isLoading && (
                  <div className="bg-destructive/10 text-destructive flex w-fit flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 text-xs">
                    <HugeiconsIcon className="size-3.5 shrink-0" icon={X} />
                    <span>{chatError}</span>
                    {!isSlackMirrored && (
                      <button
                        className="focus-visible:ring-ring inline-flex items-center gap-1 rounded font-medium underline-offset-2 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        onClick={handleRetryAfterError}
                        type="button"
                      >
                        <HugeiconsIcon
                          className="size-3.5"
                          icon={ArrowReloadHorizontalIcon}
                        />
                        <span>{tCommon("actions.retry")}</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            }
            onApproveTool={handleApproveTool}
            onDenyTool={handleDenyTool}
            onOpenArtifact={openArtifact}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            overlay={<ChatMinimapRail turns={minimapTurns} />}
            postTitlesById={postTitlesById}
            renderUserMessage={(uiMessage, _index, renderContentPart) => {
              const message = uiMessage as ChatUIMessage;
              const isEditing = editingMessageId === message.id;
              const contentParts = message.parts.filter(
                (part) => part.type !== "file"
              );
              const attachmentParts = message.parts.filter(
                (part) => part.type === "file"
              );
              const branches = messageBranches[message.id];
              const branchTotal = branches?.tails.length ?? 0;
              const messageAuthor = showMessageAuthorAvatars
                ? resolveChatMessageAuthor({
                    metadata: message.metadata,
                    membersById: messageAuthorsById,
                    sessionUser: session?.user,
                  })
                : null;
              const messageText = toDisplayText(getUserMessageText(message));
              return (
                <>
                  <m.div
                    className="ml-auto flex w-full max-w-full items-start justify-end gap-2"
                    layout={!reduceMotion}
                    // Animates opening and closing the editor only; a resized
                    // chat column (a side panel opening) must not glide every
                    // bubble.
                    layoutDependency={isEditing}
                    transition={{ duration: 0.22, ease: EASE.out }}
                  >
                    <div className="flex w-full min-w-0 flex-col items-end gap-2">
                      {attachmentParts.length > 0 && (
                        <UserImageGrid>
                          {attachmentParts.map((part, index) =>
                            renderContentPart(
                              part,
                              `${message.id}-file-${index}`
                            )
                          )}
                        </UserImageGrid>
                      )}
                      {(isEditing || contentParts.length > 0) && (
                        <UserMessageTextBubble
                          initialText={messageText}
                          isEditing={isEditing}
                          onCancel={handleCancelEditMessage}
                          onSubmit={(text) =>
                            handleEditMessage(message.id, text)
                          }
                        >
                          {contentParts.map((part, index) =>
                            renderContentPart(
                              part,
                              `${message.id}-text-${index}`
                            )
                          )}
                        </UserMessageTextBubble>
                      )}
                    </div>
                    {messageAuthor ? (
                      <MessageAuthorAvatar author={messageAuthor} />
                    ) : null}
                  </m.div>
                  {!isSlackMirrored && (
                    <UserMessageActions
                      branchIndex={
                        branchTotal > 1 ? (branches?.active ?? 0) : undefined
                      }
                      branchTotal={branchTotal > 1 ? branchTotal : undefined}
                      canInteract={!isLoading}
                      className={messageAuthor ? "pr-10" : undefined}
                      isEditing={isEditing}
                      messageText={messageText}
                      onEdit={() => handleStartEditMessage(message.id)}
                      onNextBranch={() =>
                        handleSwitchBranch(message.id, "next")
                      }
                      onPreviousBranch={() =>
                        handleSwitchBranch(message.id, "prev")
                      }
                      onRetry={() => handleRetryMessage(message.id)}
                    />
                  )}
                </>
              );
            }}
            status={status}
            wasStoppedByUser={wasStoppedByUser}
          />
          <div
            className={cn(
              "bg-background z-10 px-4 pb-4",
              isFirstMessageTransition && "chat-input-slide-down"
            )}
          >
            <div className="mx-auto w-full max-w-2xl min-w-0">
              {isWaitingForActiveStream && (
                <p
                  className="text-muted-foreground mx-auto mb-2 w-full max-w-2xl text-xs"
                  role="status"
                >
                  {t("waitingForPreviousResponse")}
                </p>
              )}
              {isSlackMirrored && (
                <div className="mb-2 flex justify-center">
                  <SlackRelayFooterNotice
                    threadUrl={chatHistoryData?.slackThreadUrl ?? null}
                  />
                </div>
              )}
              {pendingQuestion ? (
                <AgentQuestionDock
                  key={pendingQuestion.toolCallId}
                  onDismiss={() => dismissQuestion(pendingQuestion.toolCallId)}
                  onSubmit={(answers) =>
                    answerQuestion(pendingQuestion.toolCallId, answers)
                  }
                  questions={pendingQuestion.questions}
                />
              ) : null}
              {isProjectScopePending ? (
                <ProjectScopeLoadingInput />
              ) : (
                // Stays mounted under the questions, so its draft survives.
                <div
                  className={AGENT_QUESTION_INPUT_RETURN_CLASS}
                  hidden={pendingQuestion !== null}
                >
                  <ChatInput
                    approval={composerApproval}
                    // Hidden under the questions, it takes no files dropped on the page.
                    dropZone={pendingQuestion ? "element" : "document"}
                    authorsById={messageAuthorsById}
                    context={context}
                    draftStorageKey={draftStorageKey}
                    error={null}
                    initialValue={initialQuery ?? undefined}
                    postMentions={postMentions}
                    isLoading={isLoading}
                    isStopping={isStopping}
                    onAddContext={handleAddContext}
                    onClearError={handleClearError}
                    onEditQueued={handleEditQueued}
                    onRemoveContext={handleRemoveContext}
                    onRemoveQueued={handleRemoveQueued}
                    onSend={handleSend}
                    onSteerQueued={handleSteerQueued}
                    onStop={handleStop}
                    organizationId={organizationId}
                    organizationSlug={organizationSlug}
                    queuedMessages={queuedMessages}
                    ref={chatInputRef}
                    showAuthorAvatars={showMessageAuthorAvatars}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </LazyMotion>
      {previewCount > 0 ? (
        <ChatContentPanel
          activeToolCallId={previewToolCallId}
          focus={annotationFocus}
          onActivateTab={setPreviewToolCallId}
          onAskForChanges={handleAskForPostChanges}
          onCloseTab={closePostPreviewTab}
          onOpenTab={openPostPreview}
          onReorderTabs={setPreviewTabIds}
          openToolCallIds={previewTabIds}
          organizationId={organizationId}
          artifacts={chatArtifacts}
          organizationName={organization?.name ?? ""}
          organizationSlug={organizationSlug}
          posts={chatPosts}
        />
      ) : null}
    </>
  );
}

export default function PageClient(props: StandaloneChatPageClientProps) {
  return (
    <ChatQuoteProvider key={props.chatId ?? "__new"}>
      <StandaloneChatPageClient
        chatId={props.chatId}
        key={props.chatId ?? "__new"}
        organizationSlug={props.organizationSlug}
      />
    </ChatQuoteProvider>
  );
}
