"use client";

import { CpuIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatAttachment, ContextItem } from "@notra/ai/types/chat";
import {
  ALLOWED_CHAT_MIME_TYPES,
  PASTE_TO_ATTACHMENT_THRESHOLD,
} from "@notra/schemas/constants/dashboard/upload";
import { Composer } from "@notra/ui/components/ui/composer";
import { Kbd } from "@notra/ui/components/ui/kbd";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Linear } from "@notra/ui/components/ui/svgs/linear";
import {
  type Dispatch,
  type KeyboardEvent,
  type Ref,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ChatAnnotationsPreview } from "@/components/chat/chat-annotations-preview";
import { ChatQuotePreview, useChatQuote } from "@/components/chat/chat-quote";
import Link from "@/components/framework/link";
import { AGENT_QUESTION_INPUT_RETURN_CLASS } from "@/constants/agent-questions";
import { CHAT_COMPOSER_DRAFT_PERSIST_MS } from "@/constants/chat-composer";
import { useChatComposerAttachments } from "@/lib/hooks/use-chat-composer-attachments";
import { useChatComposerUsage } from "@/lib/hooks/use-chat-composer-usage";
import { useChatContextOptions } from "@/lib/hooks/use-chat-context-options";
import { useChatSkillSlash } from "@/lib/hooks/use-chat-skill-slash";
import { useOutputTypeLabel } from "@/lib/hooks/use-output-type-label";
import { useTextFocusWithin } from "@/lib/hooks/use-text-focus-within";
import { playUiSound } from "@/lib/ui-sounds/player";
import {
  CHAT_FILE_TYPES_LABEL,
  isAllowedChatMimeType,
  isHeicFile,
} from "@/lib/upload/mime";
import { cn } from "@/lib/utils";
import type { ChatAnnotation } from "@/types/chat-annotations";
import type { ChatPostMention } from "@/types/chat-posts";
import type {
  ChatInputProps,
  ChatMentionOption,
} from "@/types/components/chat-input";
import type { PendingChatUpload } from "@/types/hooks/chat-composer-attachments";
import type { SkillSlashOption } from "@/types/skills/slash";
import {
  buildComposerPrefix,
  parseChatAnnotations,
  prependComposerPrefix,
  toChatDisplayLabel,
} from "@/utils/chat-annotations";
import { hasChatComposerNudge } from "@/utils/chat-composer-nudge";
import {
  contextItemsEqual,
  mergeChatAttachments,
  renamePastedFiles,
} from "@/utils/chat-input";
import { getPostReferenceValue } from "@/utils/chat-posts";
import {
  extractIntegrationReferences,
  getIntegrationReferenceValue,
} from "@/utils/integration-reference";
import { OutputTypeIcon } from "@/utils/output-types";
import {
  extractSkillDraftTokens,
  parseSkillDraftNames,
  skillDraftStorageKey,
  getSlashSkillQuery,
  handleSlashMenuKeyDown,
  prependTaggedSkills,
} from "@/utils/slash-skill-query";

import { AttachmentPreviewDialog } from "./attachment-preview";
import { ChatApprovalCard } from "./chat-approval-card";
import {
  ChatComposerAttachButton,
  ChatComposerDropOverlay,
} from "./chat-composer-attachments";
import {
  ChatComposerContextPicker,
  ChatComposerNudge,
  ChatComposerSendButton,
} from "./chat-composer-parts";
import { ChatContextOptionContent } from "./chat-context-option-content";
import { ChatEffortMenu } from "./chat-effort-menu";
import { ChatSkillSlashMenu } from "./chat-skill-slash-menu";
import {
  createPostReferenceElement,
  serializeEditorWithReferences,
  setEditorTextWithPostReferences,
  serializeFragmentWithReferences,
} from "./integration-reference";

const THINKING_LEVELS = ["off", "low", "medium", "high"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

function getSubmitTooltipText({
  canQueue,
  isEmpty,
  isLoading,
  isQueued,
  isStopping,
  isUsageBlocked,
}: {
  canQueue: boolean;
  isEmpty: boolean;
  isLoading: boolean;
  isQueued: boolean;
  isStopping: boolean;
  isUsageBlocked: boolean;
}):
  | "stopping"
  | "queuedPending"
  | "stopGenerating"
  | "noCredits"
  | "queueHint"
  | "sendHint" {
  if (isLoading && isStopping) {
    return "stopping";
  }
  if (isQueued) {
    return "queuedPending";
  }
  if (isLoading && isEmpty) {
    return "stopGenerating";
  }
  if (isUsageBlocked) {
    return "noCredits";
  }
  if (canQueue) {
    return "queueHint";
  }
  return "sendHint";
}

function getSendLabelKey({
  canQueue,
  isEmpty,
  isLoading,
}: {
  canQueue: boolean;
  isEmpty: boolean;
  isLoading: boolean;
}): "stopGenerating" | "queueMessage" | "sendMessage" {
  if (isLoading && isEmpty) {
    return "stopGenerating";
  }
  if (canQueue) {
    return "queueMessage";
  }
  return "sendMessage";
}

function getComposerSendState({
  attachmentCount,
  hasUnsupportedAttachments,
  isEmpty,
  isLoading,
  isQueued,
  isStopping,
  isUsageBlocked,
  canStop,
  pendingUploadCount,
}: {
  attachmentCount: number;
  hasUnsupportedAttachments: boolean;
  isEmpty: boolean;
  isLoading: boolean;
  isQueued: boolean;
  isStopping: boolean;
  isUsageBlocked: boolean;
  canStop: boolean;
  pendingUploadCount: number;
}) {
  const hasAnyContent =
    !isEmpty || attachmentCount > 0 || pendingUploadCount > 0;
  const canQueue = isLoading && hasAnyContent && !hasUnsupportedAttachments;
  const showStop = isLoading && !hasAnyContent;

  let disabled = hasUnsupportedAttachments || !hasAnyContent;
  if (isQueued || canQueue) {
    disabled = false;
  } else if (showStop) {
    disabled = !canStop || isStopping;
  } else if (isUsageBlocked) {
    disabled = true;
  }

  // What the button does; the component maps it to a handler.
  let action: "send" | "cancelQueue" | "stop" = "send";
  if (isQueued) {
    action = "cancelQueue";
  } else if (showStop && canStop) {
    action = "stop";
  }

  let icon: "send" | "stop" | "queued" = "send";
  if (isQueued) {
    icon = "queued";
  } else if (showStop) {
    icon = "stop";
  }

  return {
    busy: Boolean(isLoading && isStopping),
    disabled,
    icon,
    labelKey: getSendLabelKey({ canQueue, isEmpty: !hasAnyContent, isLoading }),
    action,
    tooltipKey: getSubmitTooltipText({
      canQueue,
      isEmpty: !hasAnyContent,
      isLoading,
      isQueued,
      isStopping,
      isUsageBlocked,
    }),
  };
}

function getContextPickerDisabledReason(isLoading: boolean, isQueued: boolean) {
  if (isQueued) {
    return "disabledQueued";
  }
  if (isLoading) {
    return "disabledLoading";
  }
  return null;
}

function getMentionGroup(option: ChatMentionOption | undefined) {
  if (option?.kind === "post") {
    return "post";
  }
  return option?.kind === "mcp" ? "mcp" : "context";
}

function ChatPostMentionContent({ post }: { post: ChatPostMention }) {
  const getOutputTypeLabel = useOutputTypeLabel();
  return (
    <>
      <OutputTypeIcon
        className="size-3.5 shrink-0"
        outputType={post.contentType}
      />
      <span className="min-w-0 flex-1 truncate">{post.title}</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {getOutputTypeLabel(post.contentType)}
      </span>
    </>
  );
}

const MENTION_EMPTY_LOGOS = [
  { key: "github", icon: <Github className="size-3.5" /> },
  { key: "linear", icon: <Linear className="size-3.5" /> },
  {
    key: "mcp",
    icon: (
      <HugeiconsIcon className="size-3.5" icon={CpuIcon} strokeWidth={1.8} />
    ),
  },
];

/** The @ menu before anything is connected: what @ is for, and where to start. */
function ChatMentionEmptyNote({
  organizationSlug,
}: {
  organizationSlug?: string;
}) {
  const t = useTranslations("chat.input.mention");
  return (
    <div className="flex flex-col p-3.5">
      <div aria-hidden="true" className="mb-2.5 flex">
        {MENTION_EMPTY_LOGOS.map((logo) => (
          <span
            className="bg-muted border-popover -ml-1.5 flex size-7 items-center justify-center rounded-lg border-2 first:ml-0"
            key={logo.key}
          >
            {logo.icon}
          </span>
        ))}
      </div>
      <p className="text-sm font-medium">{t("emptyTitle")}</p>
      <p className="text-muted-foreground mt-0.5 text-xs text-pretty">
        {t("emptyDescription")}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        {organizationSlug ? (
          <Button
            nativeButton={false}
            render={<Link href={`/${organizationSlug}/integrations`} />}
            size="sm"
            variant="outline"
          >
            {t("connectIntegrations")}
          </Button>
        ) : (
          <span />
        )}
        <Kbd>Esc</Kbd>
      </div>
    </div>
  );
}

function ChatMentionMenu({
  hasPostMentions,
  contextOptionsCount,
  filteredMentionItems,
  insertMention,
  isInContext,
  listboxId,
  mentionIndex,
  mentionListRef,
  organizationSlug,
}: {
  hasPostMentions: boolean;
  contextOptionsCount: number;
  filteredMentionItems: ChatMentionOption[];
  insertMention: (option: ChatMentionOption) => void;
  isInContext: (item: ContextItem) => boolean;
  listboxId: string;
  mentionIndex: number;
  mentionListRef: Ref<HTMLDivElement>;
  organizationSlug?: string;
}) {
  const t = useTranslations("chat.input");
  const tChatShared = useTranslations("chat.shared");
  const tCommon2 = useTranslations("common");
  let emptyState: ReactNode = null;
  if (filteredMentionItems.length === 0) {
    emptyState =
      contextOptionsCount === 0 && !hasPostMentions ? (
        <ChatMentionEmptyNote organizationSlug={organizationSlug} />
      ) : (
        <p className="text-muted-foreground px-3 py-4 text-center text-xs">
          {t("mention.noMatches")}
        </p>
      );
  }

  return (
    <div
      className="absolute bottom-full left-1 z-50 mb-1 w-72"
      ref={mentionListRef}
    >
      <div className="border-border bg-popover text-popover-foreground overflow-hidden rounded-md border shadow-md">
        <div
          aria-label={tChatShared("context")}
          className={
            filteredMentionItems.length > 0
              ? "max-h-64 overflow-y-auto p-1"
              : undefined
          }
          id={listboxId}
          role="listbox"
        >
          {filteredMentionItems.map((option, idx) => {
            const inContext =
              option.kind !== "post" && isInContext(option.contextItem);
            const previousOption = filteredMentionItems[idx - 1];
            const startsGroup =
              idx === 0 ||
              getMentionGroup(previousOption) !== getMentionGroup(option);
            const selected = idx === mentionIndex;
            return (
              <div key={option.id}>
                {startsGroup ? (
                  <div className="px-2 py-1.5 text-xs font-semibold">
                    {getMentionGroup(option) === "post"
                      ? t("mention.postsGroup")
                      : null}
                    {getMentionGroup(option) === "mcp"
                      ? t("contextPicker.mcpGroup")
                      : null}
                    {getMentionGroup(option) === "context"
                      ? tChatShared("context")
                      : null}
                  </div>
                ) : null}
                <button
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors outline-none ${
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                  id={`chat-mention-option-${option.id}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(option);
                  }}
                  role="option"
                  type="button"
                >
                  {option.kind === "post" ? (
                    <ChatPostMentionContent post={option.post} />
                  ) : (
                    <ChatContextOptionContent option={option} />
                  )}
                  {inContext ? (
                    <span className="text-success shrink-0 text-xs">
                      {tCommon2("labels.added")}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
        {filteredMentionItems.length > 0 && organizationSlug ? (
          <div className="border-border border-t p-1">
            <Link
              className="hover:bg-accent hover:text-accent-foreground flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none"
              href={`/${organizationSlug}/integrations`}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
            >
              {tChatShared("manageIntegrations")}
            </Link>
          </div>
        ) : null}
        {emptyState}
      </div>
    </div>
  );
}

const EMPTY_POST_MENTIONS: readonly ChatPostMention[] = [];
const EMPTY_ANNOTATIONS: readonly ChatAnnotation[] = [];

/** Focuses the editor with the caret after its text. */
function focusEditorEnd(editor: HTMLDivElement) {
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

interface QueuedSendSnapshot {
  value: string;
  attachments: ChatAttachment[];
  pendingUploadIds: string[];
  annotationIds: string[];
}

function handleComposerEditorKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  {
    editor,
    filteredMentionItems,
    handleSend,
    insertMention,
    mentionAnchorRef,
    mentionIndex,
    mentionQuery,
    setMentionIndex,
    setMentionQuery,
  }: {
    editor: HTMLDivElement | null;
    filteredMentionItems: ChatMentionOption[];
    handleSend: () => void;
    insertMention: (option: ChatMentionOption) => void;
    mentionAnchorRef: RefObject<{ node: Node; offset: number } | null>;
    mentionIndex: number;
    mentionQuery: string | null;
    setMentionIndex: Dispatch<SetStateAction<number>>;
    setMentionQuery: Dispatch<SetStateAction<string | null>>;
  }
) {
  if (mentionQuery !== null && filteredMentionItems.length > 0) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionIndex((prev) =>
        prev < filteredMentionItems.length - 1 ? prev + 1 : 0
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionIndex((prev) =>
        prev > 0 ? prev - 1 : filteredMentionItems.length - 1
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredMentionItems[mentionIndex];
      if (selected) {
        insertMention(selected);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setMentionQuery(null);
      mentionAnchorRef.current = null;
      return;
    }
  }

  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
    return;
  }

  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    // A trailing <br> draws no line of its own, so the caret would stay on
    // the line above; a second one gives the new line somewhere to be.
    const next = br.nextSibling;
    if (!next || (next.nodeType === Node.TEXT_NODE && !next.textContent)) {
      br.after(document.createElement("br"));
    }
    const after = document.createRange();
    after.setStartAfter(br);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    editor?.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** Sends now, or holds the message until its uploads finish. */
function sendOrQueueComposer({
  annotationIds,
  quote,
  attachments,
  clearError,
  editor,
  ensureCanSend,
  hasUnsupportedAttachments,
  isUploading,
  pendingUploads,
  sendSnapshot,
  setPendingSend,
  taggedSkillNames,
}: {
  annotationIds: string[];
  quote?: string | null;
  attachments: ChatAttachment[];
  clearError: () => void;
  editor: HTMLDivElement;
  ensureCanSend: () => boolean;
  hasUnsupportedAttachments: boolean;
  isUploading: boolean;
  pendingUploads: PendingChatUpload[];
  sendSnapshot: (
    value: string,
    attachments: ChatAttachment[],
    sentAnnotationIds?: readonly string[]
  ) => boolean;
  setPendingSend: Dispatch<SetStateAction<QueuedSendSnapshot | null>>;
  taggedSkillNames: readonly string[];
}) {
  const outbound = prependTaggedSkills(
    serializeEditorWithReferences(editor).trim(),
    taggedSkillNames
  );
  if (!isUploading) {
    sendSnapshot(
      prependComposerPrefix(outbound, quote),
      [...attachments],
      annotationIds
    );
    return;
  }
  const hasContent =
    outbound.length > 0 ||
    Boolean(quote) ||
    attachments.length > 0 ||
    pendingUploads.length > 0;
  if (!hasContent || hasUnsupportedAttachments) {
    return;
  }
  clearError();
  if (!ensureCanSend()) {
    return;
  }
  setPendingSend({
    value: prependComposerPrefix(outbound, quote),
    attachments: [...attachments],
    pendingUploadIds: pendingUploads.map((pending) => pending.id),
    annotationIds,
  });
}

/**
 * The chat composer, everywhere: the chat page, the agent panel, the content
 * editor and the Autopilot dock. A rich editor that turns @ into context and
 * post chips and / into skills, with files, a queue and credits around it.
 */
export function ChatInput({
  onSend,
  onStop,
  initialValue,
  isLoading = false,
  isStopping = false,
  organizationSlug,
  organizationId,
  context = [],
  onAddContext,
  onRemoveContext,
  error: externalError,
  onClearError,
  connectedTop = false,
  queuedMessages = [],
  onEditQueued,
  onRemoveQueued,
  onSteerQueued,
  authorsById,
  showAuthorAvatars = false,
  onEmptyChange,
  draftStorageKey,
  postMentions = EMPTY_POST_MENTIONS,
  ref,
  disabled = false,
  selection,
  onClearSelection,
  value,
  onValueChange,
  onRetry,
  chips,
  placeholder,
  editingTarget,
  effort,
  layout = "card",
  pillExpanded,
  elevated,
  surface,
  dropZone = "element",
  approval,
}: ChatInputProps) {
  const t = useTranslations("chat.input");
  const tCommon2 = useTranslations("common");
  const tAnnotations = useTranslations("chat.annotations");
  const tChatShared = useTranslations("chat.shared");
  const quoteContext = useChatQuote();
  const quoteContextRef = useRef(quoteContext);
  const postTitlesById = useMemo(
    () => new Map(postMentions.map((post) => [post.postId, post.title])),
    [postMentions]
  );
  const postTitlesByIdRef = useRef(postTitlesById);
  const untitledLabelRef = useRef(tCommon2("labels.untitled"));
  useEffect(() => {
    quoteContextRef.current = quoteContext;
    postTitlesByIdRef.current = postTitlesById;
    untitledLabelRef.current = tCommon2("labels.untitled");
  }, [postTitlesById, quoteContext, tCommon2]);
  const formatQueuedLabel = useCallback(
    (text: string) =>
      toChatDisplayLabel(text, postTitlesById, (count) =>
        tAnnotations("count", { count })
      ),
    [postTitlesById, tAnnotations]
  );
  const composerPrefix = buildComposerPrefix(
    quoteContext?.quote,
    quoteContext?.annotations ?? EMPTY_ANNOTATIONS
  );
  const contextPickerId = useId();
  const slashListId = useId();
  const mentionListId = useId();
  const editingTargetId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const focusWithin = useTextFocusWithin(sectionRef, layout === "pill");
  const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionAnchorRef = useRef<{ node: Node; offset: number } | null>(null);
  const slashAnchorRef = useRef<{ node: Node; offset: number } | null>(null);
  const {
    skills,
    isSkillsReady,
    filteredSkills,
    slashIndex,
    isSlashMenuOpen,
    slashListRef,
    taggedSkillsRef,
    closeSlashMenu,
    syncSlashQuery,
    moveSlashIndex,
    taggedSkills,
    tagSkill,
    untagSkill,
    clearTaggedSkills,
  } = useChatSkillSlash(organizationId);
  const taggedSkillNames = useMemo(
    () => taggedSkills.map((skill) => skill.name),
    [taggedSkills]
  );
  const editorRef = useRef<HTMLDivElement | null>(null);
  const persistDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const mentionListRef = useRef<HTMLDivElement | null>(null);
  const lastInitialValueRef = useRef<string | undefined>(undefined);
  const contextRef = useRef(context);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  const {
    attachments,
    dragHandlers,
    fileInputRef,
    handleFilesSelected,
    isDraggingFile,
    isUploading,
    onFileInputChange,
    pendingUploads,
    previewAttachment,
    removeAttachment,
    restoreAttachments,
    setPreviewAttachment,
    submitAttachments,
    takeCompletedUploads,
  } = useChatComposerAttachments({ dropZone });
  const [pendingSend, setPendingSend] = useState<QueuedSendSnapshot | null>(
    null
  );
  const isQueued = pendingSend !== null;
  const isLocked = disabled || isQueued;
  const contextPickerDisabledReasonKey = getContextPickerDisabledReason(
    isLoading || disabled,
    isQueued
  );
  const contextPickerDisabledReason = contextPickerDisabledReasonKey
    ? t(`contextPicker.${contextPickerDisabledReasonKey}`)
    : null;
  const hasUnsupportedAttachments = attachments.some(
    (attachment) => !isAllowedChatMimeType(attachment.mediaType)
  );

  const onEmptyChangeRef = useRef(onEmptyChange);

  useEffect(() => {
    onEmptyChangeRef.current = onEmptyChange;
  }, [onEmptyChange]);

  useEffect(() => {
    onEmptyChangeRef.current?.(isEmpty);
  }, [isEmpty]);

  const {
    clearError,
    ensureCanSend,
    isUsageBlocked,
    remainingChatCredits,
    setInternalError,
    shouldShowLowCredits,
    usageLimitError,
  } = useChatComposerUsage({ externalError, onClearError });
  const contextOptions = useChatContextOptions(organizationId, {
    includeMcp: true,
  });

  const isInContext = useCallback(
    (item: ContextItem) =>
      context.some((contextItem) => contextItemsEqual(contextItem, item)),
    [context]
  );

  const postMentionOptions = useMemo(
    () =>
      postMentions.map((post): ChatMentionOption => ({
        id: `post-${post.postId}`,
        kind: "post",
        label: post.title,
        searchText: `${post.title} ${post.contentType.replaceAll("_", " ")}`,
        post,
      })),
    [postMentions]
  );

  // The @ menu offers this chat's posts, and context when the host takes it.
  const canMention = Boolean(onAddContext) || postMentionOptions.length > 0;
  const filteredMentionItems = useMemo((): ChatMentionOption[] => {
    if (mentionQuery === null) {
      return [];
    }
    const q = mentionQuery.trim().toLowerCase();
    return [
      ...postMentionOptions,
      ...(onAddContext ? contextOptions : []),
    ].filter((option) => option.searchText.toLowerCase().includes(q));
  }, [contextOptions, mentionQuery, onAddContext, postMentionOptions]);

  const readEditorText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return "";
    }
    return (editor.innerText ?? "").replace(/\u00A0/g, " ");
  }, []);
  const submitRef = useRef<() => void>(() => {});

  const insertPostChip = useCallback(
    (post: { postId: string; title: string }, range: Range) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const spacer = document.createTextNode("\u00A0");
      range.deleteContents();
      range.insertNode(spacer);
      range.insertNode(createPostReferenceElement(post));
      const caret = document.createRange();
      caret.setStartAfter(spacer);
      caret.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.focus();
    },
    []
  );

  // A host that holds the text (`value`) hears every change and can replace
  // it; the editor stays the source while you type. Nothing is emitted yet on
  // mount, so a remounted composer starts with the host's text.
  const onValueChangeRef = useRef(onValueChange);
  const emittedValueRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);
  const emitValue = useCallback((next: string) => {
    emittedValueRef.current = next;
    onValueChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === undefined || value === emittedValueRef.current) {
      return;
    }
    emittedValueRef.current = value;
    setEditorTextWithPostReferences(
      editor,
      value,
      postTitlesByIdRef.current,
      untitledLabelRef.current
    );
    setIsEmpty(value.trim().length === 0);
    if (value && document.activeElement === editor) {
      focusEditorEnd(editor);
    }
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      setText: (text: string) => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        const parsed = parseChatAnnotations(text);
        if (parsed && quoteContextRef.current) {
          quoteContextRef.current.setAnnotations(
            parsed.annotations.map((annotation) => ({
              ...annotation,
              id: crypto.randomUUID(),
            }))
          );
        }
        const body = parsed ? parsed.rest : text;
        setEditorTextWithPostReferences(
          editor,
          body,
          postTitlesByIdRef.current,
          untitledLabelRef.current
        );
        setIsEmpty(body.trim().length === 0);
        emitValue(serializeEditorWithReferences(editor));
        focusEditorEnd(editor);
      },
      insertPostReference: (post) => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        const existing = Array.from(
          editor.querySelectorAll<HTMLElement>("[data-integration-reference]")
        ).some(
          (chip) => chip.dataset.value === getPostReferenceValue(post.postId)
        );
        if (existing) {
          editor.focus();
          return;
        }
        const selection = window.getSelection();
        const current =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0)
            : null;
        let range: Range;
        if (current && editor.contains(current.startContainer)) {
          range = current;
        } else {
          range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          const text = editor.textContent ?? "";
          if (text && !/\s$/.test(text)) {
            range.insertNode(document.createTextNode("\u00A0"));
            range.collapse(false);
          }
        }
        insertPostChip(post, range);
      },
      setAttachments: restoreAttachments,
      focus: () => {
        if (editorRef.current) {
          focusEditorEnd(editorRef.current);
        }
      },
      isVisible: () => {
        const editor = editorRef.current;
        return Boolean(editor?.checkVisibility() && !editor.closest("[inert]"));
      },
      submit: () => {
        submitRef.current();
      },
    }),
    [emitValue, insertPostChip, restoreAttachments]
  );

  const persistDraft = useCallback(
    (draftContext: readonly ContextItem[]) => {
      const editor = editorRef.current;
      if (!(editor && draftStorageKey)) {
        return;
      }

      try {
        const text = serializeEditorWithReferences(editor).trim();
        const references = draftContext
          .map(getIntegrationReferenceValue)
          .join("\n");
        const draft = [text, references].filter(Boolean).join("\n");
        const skillKey = skillDraftStorageKey(draftStorageKey);
        const skillNames = taggedSkillsRef.current.map((skill) => skill.name);
        if (draft) {
          window.localStorage.setItem(draftStorageKey, draft);
        } else {
          window.localStorage.removeItem(draftStorageKey);
        }
        if (skillNames.length > 0) {
          window.localStorage.setItem(skillKey, JSON.stringify(skillNames));
        } else {
          window.localStorage.removeItem(skillKey);
        }
      } catch {
        // noop
      }
    },
    [draftStorageKey, taggedSkillsRef]
  );

  const schedulePersistDraft = useCallback(
    (draftContext: readonly ContextItem[]) => {
      if (persistDraftTimeoutRef.current !== null) {
        clearTimeout(persistDraftTimeoutRef.current);
      }
      persistDraftTimeoutRef.current = setTimeout(() => {
        persistDraftTimeoutRef.current = null;
        persistDraft(draftContext);
      }, CHAT_COMPOSER_DRAFT_PERSIST_MS);
    },
    [persistDraft]
  );

  const flushPendingDraft = useCallback(() => {
    if (persistDraftTimeoutRef.current === null) {
      return;
    }
    clearTimeout(persistDraftTimeoutRef.current);
    persistDraftTimeoutRef.current = null;
    persistDraft(contextRef.current);
  }, [persistDraft]);

  useLayoutEffect(() => {
    return flushPendingDraft;
  }, [flushPendingDraft]);

  useEffect(() => {
    window.addEventListener("pagehide", flushPendingDraft);
    return () => window.removeEventListener("pagehide", flushPendingDraft);
  }, [flushPendingDraft]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    setIsEmpty(readEditorText().trim().length === 0);
    emitValue(serializeEditorWithReferences(editor));
    schedulePersistDraft(contextRef.current);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setMentionQuery(null);
      mentionAnchorRef.current = null;
      slashAnchorRef.current = null;
      closeSlashMenu();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.startContainer)) {
      setMentionQuery(null);
      mentionAnchorRef.current = null;
      slashAnchorRef.current = null;
      closeSlashMenu();
      return;
    }

    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const nodeText = range.startContainer.textContent ?? "";
      const textBefore = nodeText.slice(0, range.startOffset);
      const slash = getSlashSkillQuery(textBefore, textBefore.length);

      if (slash) {
        slashAnchorRef.current = {
          node: range.startContainer,
          offset: slash.start,
        };
        syncSlashQuery(textBefore, textBefore.length);
        setMentionQuery(null);
        mentionAnchorRef.current = null;
        return;
      }

      const atIndex = canMention ? textBefore.lastIndexOf("@") : -1;
      if (atIndex !== -1) {
        const charBefore = atIndex > 0 ? textBefore[atIndex - 1] : " ";
        const isBoundary =
          atIndex === 0 ||
          charBefore === " " ||
          charBefore === "\n" ||
          charBefore === "\u00A0";
        if (isBoundary) {
          const query = textBefore.slice(atIndex + 1);
          if (
            !(
              query.includes(" ") ||
              query.includes("\n") ||
              query.includes("\u00A0")
            )
          ) {
            mentionAnchorRef.current = {
              node: range.startContainer,
              offset: atIndex,
            };
            setMentionQuery(query);
            setMentionIndex(0);
            slashAnchorRef.current = null;
            closeSlashMenu();
            return;
          }
        }
      }
    }

    mentionAnchorRef.current = null;
    setMentionQuery(null);
    slashAnchorRef.current = null;
    closeSlashMenu();
  }, [
    canMention,
    closeSlashMenu,
    emitValue,
    schedulePersistDraft,
    readEditorText,
    syncSlashQuery,
  ]);

  const restoredDraftKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!draftStorageKey || restoredDraftKeyRef.current === draftStorageKey) {
      return;
    }
    if (!isSkillsReady) {
      return;
    }
    restoredDraftKeyRef.current = draftStorageKey;
    const editor = editorRef.current;
    if (!editor || initialValue || readEditorText().trim().length > 0) {
      return;
    }
    let draft: string | null = null;
    let storedSkillNames: string[] = [];
    try {
      draft = window.localStorage.getItem(draftStorageKey);
      storedSkillNames = parseSkillDraftNames(
        window.localStorage.getItem(skillDraftStorageKey(draftStorageKey))
      );
    } catch {
      return;
    }
    if (!draft && storedSkillNames.length === 0) {
      return;
    }
    const restoredDraft = extractIntegrationReferences(draft ?? "");
    const restoredSkills =
      storedSkillNames.length > 0
        ? { names: storedSkillNames, text: restoredDraft.text }
        : extractSkillDraftTokens(restoredDraft.text);
    for (const referencedItem of restoredDraft.items) {
      onAddContext?.(referencedItem);
    }
    const skillsByName = new Map(
      skills.map((skill) => [skill.name, skill] as const)
    );
    for (const name of restoredSkills.names) {
      const skill = skillsByName.get(name);
      if (skill) {
        tagSkill(skill);
      }
    }
    const restoredText = restoredSkills.text.trim();
    setEditorTextWithPostReferences(
      editor,
      restoredText,
      new Map(postMentions.map((post) => [post.postId, post.title])),
      tCommon2("labels.untitled")
    );
    setIsEmpty(restoredText.length === 0);
    persistDraft(restoredDraft.items);
  }, [
    draftStorageKey,
    initialValue,
    isSkillsReady,
    onAddContext,
    persistDraft,
    postMentions,
    readEditorText,
    skills,
    tCommon2,
    tagSkill,
  ]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || initialValue === lastInitialValueRef.current) {
      return;
    }

    lastInitialValueRef.current = initialValue;
    editor.replaceChildren();

    if (initialValue) {
      editor.append(document.createTextNode(initialValue));
    }

    setIsEmpty(!(initialValue?.trim().length ?? 0));
    setMentionQuery(null);
    mentionAnchorRef.current = null;
    slashAnchorRef.current = null;
    closeSlashMenu();

    if (!initialValue) {
      return;
    }

    focusEditorEnd(editor);
  }, [closeSlashMenu, initialValue]);

  const insertMention = useCallback(
    (option: ChatMentionOption) => {
      const editor = editorRef.current;
      const anchor = mentionAnchorRef.current;
      if (!editor || !anchor) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        return;
      }
      const cursor = sel.getRangeAt(0);
      if (!editor.contains(cursor.startContainer)) {
        return;
      }

      const replaceRange = document.createRange();
      replaceRange.setStart(anchor.node, anchor.offset);
      replaceRange.setEnd(cursor.startContainer, cursor.startOffset);

      if (option.kind === "post") {
        mentionAnchorRef.current = null;
        setMentionQuery(null);
        insertPostChip(option.post, replaceRange);
        return;
      }

      replaceRange.deleteContents();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(replaceRange);
      let nextContext = contextRef.current;
      if (
        !contextRef.current.some((item) =>
          contextItemsEqual(item, option.contextItem)
        )
      ) {
        nextContext = [...contextRef.current, option.contextItem];
        onAddContext?.(option.contextItem);
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      persistDraft(nextContext);

      mentionAnchorRef.current = null;
      setMentionQuery(null);
      editor.focus();
    },
    [insertPostChip, onAddContext, persistDraft]
  );

  const insertSlashSkill = useCallback(
    (skill: SkillSlashOption) => {
      const editor = editorRef.current;
      const anchor = slashAnchorRef.current;
      if (!editor || !anchor) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        return;
      }
      const cursor = sel.getRangeAt(0);
      if (!editor.contains(cursor.startContainer)) {
        return;
      }

      const replaceRange = document.createRange();
      replaceRange.setStart(anchor.node, anchor.offset);
      replaceRange.setEnd(cursor.startContainer, cursor.startOffset);
      replaceRange.deleteContents();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(replaceRange);

      tagSkill(skill);
      slashAnchorRef.current = null;
      closeSlashMenu();
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      persistDraft(contextRef.current);
      editor.focus();
    },
    [closeSlashMenu, persistDraft, tagSkill]
  );

  const handleUntagSkill = useCallback(
    (name: string) => {
      untagSkill(name);
      persistDraft(contextRef.current);
    },
    [persistDraft, untagSkill]
  );

  const addContext = useCallback(
    (item: ContextItem) => {
      if (contextRef.current.some((c) => contextItemsEqual(c, item))) {
        return;
      }
      onAddContext?.(item);
      persistDraft([...contextRef.current, item]);
      editorRef.current?.focus();
    },
    [onAddContext, persistDraft]
  );

  const removeContext = useCallback(
    (item: ContextItem) => {
      onRemoveContext?.(item);
      persistDraft(
        contextRef.current.filter(
          (contextItem) => !contextItemsEqual(contextItem, item)
        )
      );
    },
    [onRemoveContext, persistDraft]
  );

  const insertTextAtRange = useCallback(
    (text: string, targetRange?: Range) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const selection = window.getSelection();
      let range: Range | null = null;

      if (
        targetRange?.startContainer.isConnected &&
        editor.contains(targetRange.startContainer)
      ) {
        range = targetRange;
      } else if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }

      if (!range) {
        return;
      }

      range.deleteContents();

      const pastedContent = extractIntegrationReferences(text);
      let nextContext = contextRef.current;
      for (const referencedItem of pastedContent.items) {
        if (
          !nextContext.some((item) => contextItemsEqual(item, referencedItem))
        ) {
          nextContext = [...nextContext, referencedItem];
          onAddContext?.(referencedItem);
        }
      }
      const textNode = document.createTextNode(pastedContent.text);
      range.insertNode(textNode);

      const after = document.createRange();
      after.setStartAfter(textNode);
      after.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(after);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      persistDraft(nextContext);
    },
    [onAddContext, persistDraft]
  );

  const clearComposer = useCallback(
    (sentAnnotationIds?: readonly string[]) => {
      const editor = editorRef.current;
      if (editor) {
        editor.innerHTML = "";
      }
      if (draftStorageKey) {
        try {
          window.localStorage.removeItem(draftStorageKey);
          window.localStorage.removeItem(skillDraftStorageKey(draftStorageKey));
        } catch {
          // noop
        }
      }
      setIsEmpty(true);
      emitValue("");
      onClearSelection?.();
      submitAttachments([]);
      setPendingSend(null);
      for (const item of contextRef.current) {
        onRemoveContext?.(item);
      }
      clearTaggedSkills();
      quoteContext?.setQuote(null);
      if (sentAnnotationIds) {
        const sent = new Set(sentAnnotationIds);
        quoteContext?.setAnnotations((current) =>
          current.filter((annotation) => !sent.has(annotation.id))
        );
      } else {
        quoteContext?.setAnnotations([]);
      }
    },
    [
      clearTaggedSkills,
      draftStorageKey,
      emitValue,
      onClearSelection,
      onRemoveContext,
      quoteContext,
      submitAttachments,
    ]
  );

  // A message sent while a tool waits on you answers it: no, do this instead.
  const approvalRef = useRef(approval);
  useEffect(() => {
    approvalRef.current = approval;
  }, [approval]);
  const sendToHost = useCallback(
    (text: string, sent: ChatAttachment[]) => {
      approvalRef.current?.onDeny();
      onSend?.(text, sent);
    },
    [onSend]
  );

  const sendSnapshot = useCallback(
    (
      value: string,
      snapshotAttachments: ChatAttachment[],
      sentAnnotationIds?: readonly string[]
    ) => {
      if (!(value || snapshotAttachments.length > 0)) {
        return false;
      }
      clearError();
      if (
        snapshotAttachments.some(
          (attachment) => !isAllowedChatMimeType(attachment.mediaType)
        )
      ) {
        return false;
      }
      if (!ensureCanSend()) {
        return false;
      }
      submitAttachments(snapshotAttachments);
      playUiSound("send");
      sendToHost(value, snapshotAttachments);
      clearComposer(sentAnnotationIds);
      return true;
    },
    [clearComposer, clearError, ensureCanSend, sendToHost, submitAttachments]
  );

  const handleSend = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    sendOrQueueComposer({
      annotationIds: (quoteContext?.annotations ?? EMPTY_ANNOTATIONS).map(
        (annotation) => annotation.id
      ),
      quote: composerPrefix,
      attachments,
      clearError,
      editor,
      ensureCanSend,
      hasUnsupportedAttachments,
      isUploading,
      pendingUploads,
      sendSnapshot,
      setPendingSend,
      taggedSkillNames,
    });
  }, [
    attachments,
    clearError,
    ensureCanSend,
    isUploading,
    hasUnsupportedAttachments,
    pendingUploads,
    sendSnapshot,
    taggedSkillNames,
    composerPrefix,
    quoteContext?.annotations,
  ]);

  useEffect(() => {
    submitRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    if (!(pendingSend && !isUploading)) {
      return;
    }
    const resolvedAttachments = takeCompletedUploads(
      pendingSend.pendingUploadIds
    );
    if (!resolvedAttachments) {
      // react-doctor-disable-next-line react-hooks-js/set-state-in-effect -- runs when the upload store reports the files done
      setPendingSend(null);
      setInternalError(t("upload.someFailed"));
      return;
    }

    sendSnapshot(
      pendingSend.value,
      mergeChatAttachments(pendingSend.attachments, resolvedAttachments),
      pendingSend.annotationIds
    );
  }, [
    isUploading,
    pendingSend,
    sendSnapshot,
    setInternalError,
    t,
    takeCompletedUploads,
  ]);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const pastedFiles = renamePastedFiles(
        Array.from(event.clipboardData.files)
      );
      const text = event.clipboardData.getData("text/plain");
      event.preventDefault();
      // Rich clipboards can carry an image rendering next to the text; only
      // treat the paste as files when they can be attached or there's no text.
      if (
        pastedFiles.length > 0 &&
        (!text ||
          pastedFiles.some(
            (file) => isAllowedChatMimeType(file.type) || isHeicFile(file)
          ))
      ) {
        handleFilesSelected(pastedFiles).catch(() => undefined);
        return;
      }

      if (text.length >= PASTE_TO_ATTACHMENT_THRESHOLD) {
        const selection = window.getSelection();
        const fallbackRange =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0).cloneRange()
            : undefined;
        const file = new File([text], `pasted-${Date.now()}.txt`, {
          type: "text/plain",
        });
        handleFilesSelected([file])
          .then((uploaded) => {
            if (!uploaded) {
              insertTextAtRange(text, fallbackRange);
            }
          })
          .catch(() => {
            insertTextAtRange(text, fallbackRange);
          });
        return;
      }

      insertTextAtRange(text);
    },
    [handleFilesSelected, insertTextAtRange]
  );

  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer) || range.collapsed) {
        return;
      }

      event.preventDefault();
      const fragment = range.cloneContents();
      const serialized = serializeFragmentWithReferences(fragment);
      event.clipboardData.setData("text/plain", serialized);
    },
    []
  );

  const handleCut = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer) || range.collapsed) {
        return;
      }

      event.preventDefault();
      const fragment = range.cloneContents();
      const serialized = serializeFragmentWithReferences(fragment);
      event.clipboardData.setData("text/plain", serialized);

      range.deleteContents();
      selection.removeAllRanges();
      selection.addRange(range);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const slashHandled = handleSlashMenuKeyDown(event, {
        isOpen: isSlashMenuOpen,
        matchCount: filteredSkills.length,
        onMove: moveSlashIndex,
        onSelect: () => {
          const selected = filteredSkills[slashIndex];
          if (selected) {
            insertSlashSkill(selected);
          }
        },
        onClose: () => {
          slashAnchorRef.current = null;
          closeSlashMenu();
        },
      });
      if (slashHandled) {
        return;
      }

      handleComposerEditorKeyDown(event, {
        editor: editorRef.current,
        filteredMentionItems,
        handleSend,
        insertMention,
        mentionAnchorRef,
        mentionIndex,
        mentionQuery,
        setMentionIndex,
        setMentionQuery,
      });
    },
    [
      closeSlashMenu,
      filteredMentionItems,
      filteredSkills,
      handleSend,
      insertMention,
      insertSlashSkill,
      isSlashMenuOpen,
      mentionIndex,
      mentionQuery,
      moveSlashIndex,
      slashIndex,
    ]
  );

  const nudgeState = {
    attachments,
    chips,
    context,
    editingTarget,
    pendingUploads,
    queuedMessages,
    selection,
    shouldShowLowCredits,
    taggedSkills,
    usageLimitError,
  };
  const send = getComposerSendState({
    attachmentCount: attachments.length,
    hasUnsupportedAttachments,
    isEmpty: isEmpty && taggedSkills.length === 0 && !composerPrefix,
    isLoading,
    isQueued,
    isStopping,
    isUsageBlocked,
    canStop: Boolean(onStop),
    pendingUploadCount: pendingUploads.length,
  });
  const handleSendButtonClick = () => {
    if (send.action === "cancelQueue") {
      setPendingSend(null);
    } else if (send.action === "stop") {
      onStop?.();
    } else {
      handleSend();
    }
  };
  const isMentionMenuOpen = mentionQuery !== null;
  const isComposerPopupOpen = isSlashMenuOpen || isMentionMenuOpen;
  const selectedSlashOption = isSlashMenuOpen
    ? filteredSkills[slashIndex]
    : undefined;
  const selectedMentionOption = isMentionMenuOpen
    ? filteredMentionItems[mentionIndex]
    : undefined;
  let composerActiveDescendant: string | undefined;
  if (selectedSlashOption) {
    composerActiveDescendant = `chat-skill-slash-option-${selectedSlashOption.name}`;
  } else if (selectedMentionOption) {
    composerActiveDescendant = `chat-mention-option-${selectedMentionOption.id}`;
  }
  let composerListboxId: string | undefined;
  if (isSlashMenuOpen) {
    composerListboxId = slashListId;
  } else if (isMentionMenuOpen) {
    composerListboxId = mentionListId;
  }

  let editorPlaceholder = placeholder ?? t("editor.placeholder");
  if (isLoading) {
    editorPlaceholder = tChatShared("queueAMessage");
  }
  const pill = layout === "pill";
  const approvalInPlace = approval && !pill ? approval : null;
  // Once an approval has stood in its place, the input fades back in when it
  // returns, like it does after the agent's questions. Before that it just
  // shows, so a page load doesn't fade it in.
  const [fadesBackIn, setFadesBackIn] = useState(false);
  if (approvalInPlace && !fadesBackIn) {
    setFadesBackIn(true);
  }
  const replyToApproval = (text: string) => {
    if (!ensureCanSend()) {
      return false;
    }
    playUiSound("send");
    sendToHost(text, []);
    return true;
  };
  // The pill opens to two rows while you write, then settles back to one.
  const pillOpen = pill && (pillExpanded === true || focusWithin || !isEmpty);

  const editor = (
    <div className="relative flex min-w-0 flex-1 cursor-text [--lh:1lh]">
      {/* biome-ignore lint/a11y/useSemanticElements: rich mention editor requires a contentEditable host instead of a native textarea. */}
      <div
        aria-activedescendant={composerActiveDescendant}
        aria-autocomplete={isComposerPopupOpen ? "list" : undefined}
        aria-controls={composerListboxId}
        aria-describedby={editingTarget ? editingTargetId : undefined}
        aria-disabled={isLocked}
        aria-expanded={isComposerPopupOpen}
        aria-haspopup={isComposerPopupOpen ? "listbox" : undefined}
        aria-label={tChatShared("sendAMessage")}
        className={cn(
          "text-foreground caret-foreground data-[empty=true]:before:text-muted-foreground relative w-full min-w-0 overflow-y-auto text-sm leading-6 wrap-anywhere whitespace-pre-wrap outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-[empty=true]:before:pointer-events-none data-[empty=true]:before:absolute data-[empty=true]:before:content-[attr(data-placeholder)]",
          pill
            ? "max-h-40 min-h-8 px-1.5 py-1 data-[empty=true]:before:top-1 data-[empty=true]:before:left-1.5"
            : "max-h-50 min-h-12 rounded-t-[12px] px-3 py-2 data-[empty=true]:before:top-2 data-[empty=true]:before:left-3"
        )}
        contentEditable={!isLocked}
        data-empty={isEmpty ? "true" : "false"}
        data-placeholder={editorPlaceholder}
        onBlur={() => {
          setTimeout(() => {
            const active = document.activeElement;
            if (
              !(
                mentionListRef.current?.contains(active) ||
                slashListRef.current?.contains(active)
              )
            ) {
              setMentionQuery(null);
              mentionAnchorRef.current = null;
              slashAnchorRef.current = null;
              closeSlashMenu();
            }
          }, 150);
        }}
        onCopy={handleCopy}
        onCut={handleCut}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        ref={editorRef}
        role="combobox"
        suppressContentEditableWarning
        tabIndex={isLoading || isLocked ? -1 : 0}
      />
    </div>
  );
  const attachButton = (
    <ChatComposerAttachButton
      attachmentCount={attachments.length}
      disabled={isLocked}
      filled={pill}
      onAttach={() => fileInputRef.current?.click()}
      pendingUploadCount={pendingUploads.length}
      tooltip={t("attach.files")}
    />
  );
  const sendButton = (
    <ChatComposerSendButton
      busy={send.busy}
      disabled={send.disabled || (disabled && send.icon === "send")}
      icon={send.icon}
      label={t(`send.${send.labelKey}`)}
      onClick={handleSendButtonClick}
      tooltip={t(`send.${send.tooltipKey}`)}
    />
  );

  return (
    <>
      {isDraggingFile ? (
        <ChatComposerDropOverlay
          acceptedFileTypesLabel={CHAT_FILE_TYPES_LABEL}
        />
      ) : null}
      <div
        className="relative w-full min-w-0"
        data-chat-quote-composer={quoteContext?.scopeId}
        {...dragHandlers}
      >
        {mentionQuery === null ? null : (
          <ChatMentionMenu
            contextOptionsCount={onAddContext ? contextOptions.length : 0}
            hasPostMentions={postMentionOptions.length > 0}
            filteredMentionItems={filteredMentionItems}
            insertMention={insertMention}
            isInContext={isInContext}
            listboxId={mentionListId}
            mentionIndex={mentionIndex}
            mentionListRef={mentionListRef}
            organizationSlug={organizationSlug}
          />
        )}
        {isSlashMenuOpen ? (
          <ChatSkillSlashMenu
            filteredSkills={filteredSkills}
            listboxId={slashListId}
            onSelect={insertSlashSkill}
            skillCount={skills.length}
            slashIndex={slashIndex}
            slashListRef={slashListRef}
          />
        ) : null}
        <Composer.Frame
          connectedTop={connectedTop}
          elevated={pill && elevated !== false}
          flat={pill}
          // An approval in the input's place stands without the grey rim.
          rimless={approvalInPlace !== null}
          // The inner light is for the pill floating on its own. Inside the
          // open dock it sits beside the conversation card and matches it.
          highlight={pill && pillExpanded !== true}
          nudge={
            hasChatComposerNudge(nudgeState) ? (
              <ChatComposerNudge
                {...nudgeState}
                authorsById={authorsById}
                formatQueuedLabel={formatQueuedLabel}
                locked={isQueued}
                onClearSelection={onClearSelection}
                onEditQueued={onEditQueued}
                onRemoveContext={removeContext}
                onRemoveQueued={onRemoveQueued}
                onRetry={onRetry}
                onSteerQueued={onSteerQueued}
                organizationSlug={organizationSlug}
                remainingChatCredits={remainingChatCredits}
                removeAttachment={removeAttachment}
                setPreviewAttachment={setPreviewAttachment}
                showAuthorAvatars={showAuthorAvatars}
                untagSkill={handleUntagSkill}
              />
            ) : null
          }
          surface={surface}
        >
          {/* A tool waiting on you takes the input's place. The input stays
              mounted underneath, so a draft and its attachments survive. */}
          {approvalInPlace ? (
            <ChatApprovalCard
              approval={approvalInPlace}
              key={approvalInPlace.part.toolCallId}
              onReply={replyToApproval}
            />
          ) : null}
          <section
            aria-label={tChatShared("chatInputDropArea")}
            className={cn(
              pill && "relative p-2",
              fadesBackIn && AGENT_QUESTION_INPUT_RETURN_CLASS
            )}
            hidden={approvalInPlace !== null}
            ref={sectionRef}
          >
            {editingTarget ? (
              <span className="sr-only" id={editingTargetId}>
                {editingTarget.description}
              </span>
            ) : null}
            <ChatQuotePreview disabled={isQueued} />
            <ChatAnnotationsPreview disabled={isQueued} />
            <input
              accept={`${ALLOWED_CHAT_MIME_TYPES.join(",")},image/heic,.heic`}
              className="hidden"
              multiple
              onChange={onFileInputChange}
              ref={fileInputRef}
              type="file"
            />
            {pill ? (
              <>
                <div className="absolute bottom-2 left-2 z-10 flex h-8 items-center">
                  {attachButton}
                </div>
                {/* Closed: one row between the buttons. Open: the text takes
                    the full width, in line with the round "+" below it, and
                    the buttons get a row of their own, in one smooth motion. */}
                <div
                  className={cn(
                    "duration-normal ease-emphasized transition-[padding,margin] motion-reduce:transition-none",
                    pillOpen ? "-ml-1.25 pb-10" : "pr-10 pl-10"
                  )}
                >
                  {editor}
                </div>
                <div className="absolute right-2 bottom-2 flex h-8 items-center">
                  {sendButton}
                </div>
              </>
            ) : (
              <>
                {editor}
                <Composer.Toolbar>
                  {attachButton}
                  <div className="ml-auto flex min-w-0 items-center gap-1">
                    {onAddContext ? (
                      <ChatComposerContextPicker
                        contextOptions={contextOptions}
                        contextPickerId={contextPickerId}
                        disabledReason={contextPickerDisabledReason}
                        isInContext={isInContext}
                        isOpen={isContextPickerOpen}
                        onOpenChange={setIsContextPickerOpen}
                        organizationSlug={organizationSlug}
                        toggleContextItem={(item, inContext) => {
                          if (inContext) {
                            removeContext(item);
                            return;
                          }
                          addContext(item);
                        }}
                      />
                    ) : null}
                    {effort ? (
                      <ChatEffortMenu {...effort} disabled={isLocked} />
                    ) : null}
                    {sendButton}
                  </div>
                </Composer.Toolbar>
              </>
            )}
          </section>
        </Composer.Frame>
      </div>
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
          }
        }}
        open={previewAttachment !== null}
      />
    </>
  );
}
