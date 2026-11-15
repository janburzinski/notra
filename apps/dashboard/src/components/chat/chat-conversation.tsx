"use client";

import { isTrustedChatFileUrl } from "@notra/ai/schemas/chat";
import { chatTodoListSchema } from "@notra/ai/schemas/todos";
import { artifactPath } from "@notra/ai/utils/artifact-path";
import {
  MessageContent,
  MessageResponse,
} from "@notra/ui/components/ai-elements/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@notra/ui/components/ui/message-scroller";
import { cn } from "@notra/ui/lib/utils";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

import { AgentQuestionCard } from "@/components/ai/agent-question-card";
import { ChatActivityStatus } from "@/components/ai/chat-activity-status";
import { ChatAssistantParts } from "@/components/ai/chat-assistant-parts";
import { ChatEmptyDither } from "@/components/ai/chat-empty-dither";
import { ChatReasoningBlock } from "@/components/ai/chat-reasoning-block";
import { ChatSubagentToolPart } from "@/components/ai/chat-subagent-tool-part";
import { ChatTodoList } from "@/components/ai/chat-todo-list";
import { ChatToolBlock } from "@/components/ai/chat-tool-block";
import {
  getMcpToolServerId,
  isMcpToolName,
} from "@/components/ai/chat-tool-block/mcp/utils";
import { ChatArtifactCard } from "@/components/artifacts/chat-artifact-card";
import { AssistantMetadataHover } from "@/components/chat/assistant-metadata-hover";
import { AttachmentPreviewDialog } from "@/components/chat/attachment-preview";
import { ChatFileAttachment } from "@/components/chat/chat-file-attachment";
import { ChatImageAttachment } from "@/components/chat/chat-image-attachment";
import { ChatInputContextRow } from "@/components/chat/chat-input-context-row";
import { ChatMessageAnnotations } from "@/components/chat/chat-message-annotations";
import { ChatQuoteMessage as Message } from "@/components/chat/chat-quote";
import { ChatScrollOnSend } from "@/components/chat/chat-scroll-on-send";
import { renderTextWithIntegrationReferences } from "@/components/chat/integration-reference";
import { ACTIVITY_STEP_SETTLE_MS } from "@/constants/chat-activity";
import { UPDATE_TODOS_TOOL_NAME } from "@/constants/chat-posts";
import { chatMessageComponents } from "@/lib/chat/message-components";
import { useChatActivityTimer } from "@/lib/hooks/use-chat-activity-timer";
import { useDelayedAppearance } from "@/lib/hooks/use-delayed-appearance";
import { useRouter } from "@/lib/navigation";
import { isImageMimeType } from "@/lib/upload/mime";
import type {
  ChatAssistantMessageProps,
  ChatAttachmentPreview,
  ChatContentPartOptions,
  ChatConversationProps,
  ChatCustomTools,
  ChatToolPart,
  ChatUserMessageProps,
} from "@/types/components/chat-conversation";
import { isAgentQuestionPart } from "@/utils/agent-questions";
import { getChatActivity, hasVisibleChatContent } from "@/utils/chat-activity";
import { parseChatAnnotations } from "@/utils/chat-annotations";
import { parseToolOutputArtifact } from "@/utils/chat-artifact";
import { getChatFilePartFields } from "@/utils/chat-message-parts";
import { isChatSubagentName } from "@/utils/chat-subagents";
import { parseCreatedPostId } from "@/utils/chat-tool-draft";
import {
  getContentChatAttachments,
  hasContentChatAttachments,
} from "@/utils/content-chat-attachments";
import { isContentEditorStandaloneTool } from "@/utils/content-editor-standalone-tool";
import { playCopyShimmerOnSelection } from "@/utils/copy-shimmer";
import { parseChatMessageMetadata } from "@/utils/parse-chat-message-metadata";

/** Panel replies slide in; the page keeps still while history loads. */
const PANEL_MESSAGE_CLASSNAME =
  "translate-y-0 opacity-100 transition-[opacity,translate] duration-fast ease-emphasized starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100";

const PAGE_COLUMN_CLASSNAME = "mx-auto w-full max-w-2xl";

const INLINE_REFERENCE_MARKERS = [
  "integration/github/",
  "integration/linear/",
  "integration/mcp/",
  "@post/",
];

/** Tools that show on their own instead of inside the reply's work log. */
function isStandaloneChatTool(
  part: UIMessage["parts"][number],
  customTools?: ChatCustomTools
): boolean {
  if (isContentEditorStandaloneTool(part) || isAgentQuestionPart(part)) {
    return true;
  }
  if (!isToolUIPart(part)) {
    return false;
  }
  const toolName = getToolName(part);
  return (
    isChatSubagentName(toolName) ||
    toolName === UPDATE_TODOS_TOOL_NAME ||
    toolName === "createImage" ||
    Boolean(customTools?.names.has(toolName))
  );
}

/** A text, file or reasoning part, in a reply or a user's message. */
function renderChatContentPart(
  part: UIMessage["parts"][number],
  key: string,
  options: ChatContentPartOptions
): ReactNode {
  if (part.type === "text") {
    if (!part.text.trim()) {
      return null;
    }
    const annotated = parseChatAnnotations(part.text);
    if (annotated) {
      return (
        <div className="size-full" key={key}>
          <ChatMessageAnnotations annotations={annotated.annotations} />
          {annotated.rest.trim()
            ? renderChatContentPart(
                { ...part, text: annotated.rest },
                `${key}-rest`,
                options
              )
            : null}
        </div>
      );
    }
    if (INLINE_REFERENCE_MARKERS.some((marker) => part.text.includes(marker))) {
      return (
        <div
          className="size-full wrap-break-word whitespace-pre-wrap"
          key={key}
        >
          {renderTextWithIntegrationReferences(
            part.text,
            options.mcpLogosByConnectionId,
            options.postTitlesById
          )}
        </div>
      );
    }
    return (
      <MessageResponse
        components={chatMessageComponents}
        isAnimating={options.isAnimating}
        key={key}
      >
        {part.text}
      </MessageResponse>
    );
  }
  if (part.type === "file") {
    const { url, mediaType, filename } = getChatFilePartFields(part);
    if (!(url && isTrustedChatFileUrl(url))) {
      return null;
    }
    if (isImageMimeType(mediaType)) {
      return (
        <ChatImageAttachment
          filename={filename}
          key={key}
          mediaType={mediaType}
          onClick={() =>
            options.onPreviewAttachment({
              url,
              filename: filename ?? "attachment",
              mediaType,
            })
          }
          url={url}
        />
      );
    }
    return (
      <ChatFileAttachment
        filename={filename}
        key={key}
        mediaType={mediaType}
        url={url}
      />
    );
  }
  if (part.type === "reasoning") {
    return part.text ? (
      <ChatReasoningBlock key={key}>{part.text}</ChatReasoningBlock>
    ) : null;
  }
  return null;
}

/** The plan from the reply's first todo update, at its latest accepted state. */
function ChatTodoPart({
  part,
  parts,
  isActive,
  isStopped,
}: {
  part: ChatToolPart;
  parts: UIMessage["parts"];
  isActive: boolean;
  isStopped?: boolean;
}) {
  const todoParts = parts.filter(
    (entry) =>
      isToolUIPart(entry) && getToolName(entry) === UPDATE_TODOS_TOOL_NAME
  );
  if (todoParts[0] !== part) {
    return null;
  }
  const latest = todoParts.findLast((entry, index) => {
    if (!isToolUIPart(entry)) {
      return false;
    }
    const output = entry.output as { accepted?: boolean } | undefined;
    const isComplete =
      entry.state === "input-available" || entry.state === "output-available";
    return (
      (index === 0 || isComplete) &&
      output?.accepted !== false &&
      chatTodoListSchema.safeParse(entry.input).success
    );
  });
  const todos = chatTodoListSchema.safeParse(
    latest && isToolUIPart(latest) ? latest.input : undefined
  );
  if (!todos.success) {
    return null;
  }
  return (
    <ChatTodoList
      isActive={isActive}
      isStopped={
        isStopped ??
        todos.data.todos.some((todo) => todo.status === "in_progress")
      }
      todos={todos.data.todos}
    />
  );
}

function ChatAssistantMessage({
  message,
  isLoading,
  isActive,
  hasInlineActivity,
  isStopped,
  elapsedSeconds,
  organizationId,
  organizationSlug,
  onApproveTool,
  onDenyTool,
  customTools,
  onOpenArtifact,
  onPreviewAttachment,
  mcpLogosByConnectionId,
  postTitlesById,
  isStandalonePartVisible,
  isApprovalInComposer,
}: ChatAssistantMessageProps) {
  const metadata = parseChatMessageMetadata(message.metadata);
  const contentOptions = {
    isAnimating: isActive,
    mcpLogosByConnectionId,
    postTitlesById,
    onPreviewAttachment,
  };

  const renderTool = (part: ChatToolPart) => {
    const toolName = getToolName(part);
    const approvalId =
      part.state === "approval-requested" ? part.approval?.id : undefined;
    const onApprove =
      approvalId && onApproveTool
        ? () => onApproveTool(approvalId, part)
        : undefined;
    const onDeny =
      approvalId && onDenyTool ? () => onDenyTool(approvalId, part) : undefined;

    const savedArtifact =
      part.state === "output-available"
        ? parseToolOutputArtifact(part.output)
        : undefined;
    if (savedArtifact && organizationId) {
      return (
        <ChatArtifactCard
          artifactId={savedArtifact.id}
          key={part.toolCallId}
          onOpen={() => onOpenArtifact(savedArtifact.id)}
          organizationId={organizationId}
          summary={savedArtifact.summary}
          title={savedArtifact.title}
          version={savedArtifact.version}
        />
      );
    }
    if (isAgentQuestionPart(part)) {
      return (
        <div className="py-1" key={part.toolCallId}>
          <AgentQuestionCard
            input={part.input}
            output={part.state === "output-available" ? part.output : undefined}
            state={part.state}
          />
        </div>
      );
    }
    if (customTools?.names.has(toolName)) {
      return customTools.render(part, {
        messageId: message.id,
        isActive,
        hasInlineActivity,
        onApprove,
        onDeny,
      });
    }
    if (toolName === UPDATE_TODOS_TOOL_NAME) {
      return (
        <ChatTodoPart
          isActive={isActive}
          isStopped={isStopped}
          key={part.toolCallId}
          part={part}
          parts={message.parts}
        />
      );
    }
    if (isChatSubagentName(toolName)) {
      return (
        <ChatSubagentToolPart
          isActive={isActive}
          key={part.toolCallId}
          part={part}
        />
      );
    }
    if (part.state === "output-denied" || part.state === "approval-responded") {
      return null;
    }
    const output =
      part.state === "output-error" ? { error: part.errorText } : part.output;
    const toolMetadata =
      part.type === "dynamic-tool" ? part.toolMetadata : undefined;
    const isMcp = isMcpToolName(toolName);
    const mcpLogos = isMcp
      ? mcpLogosByConnectionId?.get(getMcpToolServerId(toolMetadata) ?? "")
      : undefined;
    const postId = parseCreatedPostId(output);
    return (
      <ChatToolBlock
        editorHref={
          organizationSlug && postId
            ? `/${organizationSlug}/content/${postId}`
            : undefined
        }
        input={part.input}
        isActive={isActive}
        isMcp={isMcp}
        key={part.toolCallId}
        mcpLogoDarkUrl={mcpLogos?.darkUrl}
        mcpLogoLightUrl={mcpLogos?.lightUrl}
        approvalInComposer={isApprovalInComposer?.(part) === true}
        onApprove={onApprove}
        onDeny={onDeny}
        output={output}
        state={part.state}
        toolCallId={part.toolCallId}
        toolMetadata={toolMetadata}
        toolName={toolName}
      />
    );
  };

  return (
    <ChatAssistantParts
      activityTimings={metadata?.activityTimings}
      durationMs={metadata?.generationDurationMs}
      elapsedSeconds={elapsedSeconds}
      isLoading={isLoading}
      isStandalonePartVisible={isStandalonePartVisible}
      isStandaloneTool={(part) => isStandaloneChatTool(part, customTools)}
      messageId={message.id}
      parts={message.parts}
      renderStandalone={(part, index) =>
        renderChatContentPart(
          part,
          `${message.id}-${part.type}-${index}`,
          contentOptions
        )
      }
      renderTool={(part) => (isToolUIPart(part) ? renderTool(part) : null)}
    />
  );
}

function ChatUserMessage({
  message,
  surface,
  onPreviewAttachment,
}: ChatUserMessageProps) {
  const t = useTranslations("content.chatActivity");
  const attachments = getContentChatAttachments(message.metadata);
  const imageParts = message.parts.filter(
    (part) =>
      part.type === "file" &&
      typeof part.mediaType === "string" &&
      isImageMimeType(part.mediaType)
  );
  const fileParts = message.parts.filter(
    (part) =>
      part.type === "file" &&
      (typeof part.mediaType !== "string" || !isImageMimeType(part.mediaType))
  );
  const textParts = message.parts.filter(
    (part) => part.type === "text" && part.text.trim()
  );
  const contentOptions = { onPreviewAttachment };
  return (
    <>
      {hasContentChatAttachments(attachments) ? (
        <div
          aria-label={t("attachedContext")}
          className="ml-auto flex max-w-full flex-wrap justify-end gap-1.5"
        >
          <ChatInputContextRow
            context={attachments.context}
            selection={attachments.selection}
          />
        </div>
      ) : null}
      {imageParts.length > 0 ? (
        <div className="ml-auto flex max-w-full flex-col items-end gap-1.5">
          {imageParts.map((part, index) =>
            renderChatContentPart(
              part,
              `${message.id}-image-${index}`,
              contentOptions
            )
          )}
        </div>
      ) : null}
      {fileParts.length > 0 ? (
        <div className="ml-auto flex max-w-full flex-wrap justify-end gap-1.5">
          {fileParts.map((part, index) => (
            <div className="size-28" key={`${message.id}-file-${index}`}>
              {renderChatContentPart(part, "file", contentOptions)}
            </div>
          ))}
        </div>
      ) : null}
      {textParts.length > 0 ? (
        <MessageContent
          className={
            surface === "shell"
              ? "group-[.is-user]:bg-foreground/[0.06] dark:group-[.is-user]:bg-foreground/[0.09]"
              : undefined
          }
        >
          {textParts.map((part, index) =>
            renderChatContentPart(
              part,
              `${message.id}-text-${index}`,
              contentOptions
            )
          )}
        </MessageContent>
      ) : null}
    </>
  );
}

/**
 * A chat's messages in a scroller: the full chat page and every agent panel
 * draw replies, tools, artifacts and the thinking state through this one
 * renderer. Hosts add what only they have, like editing or post previews.
 */
// react-doctor-disable-next-line react-doctor/no-high-complexity-react-function -- one switch per surface (page, panel, share); split in a dedicated refactor
export function ChatConversation({
  messages,
  status,
  isWorking = false,
  activeChatId,
  organizationId,
  organizationSlug,
  onApproveTool,
  onDenyTool,
  customTools,
  onOpenArtifact,
  mcpLogosByConnectionId,
  postTitlesById,
  surface = "muted",
  layout = "panel",
  wasStoppedByUser = false,
  isStopping = false,
  renderUserMessage,
  getMessageKey,
  getMessageClassName,
  notices,
  overlay,
  isStandalonePartVisible,
  isApprovalInComposer,
}: ChatConversationProps) {
  const tCommon = useTranslations("common");
  const tPage = useTranslations("chat.page");
  const router = useRouter();
  const [previewAttachment, setPreviewAttachment] =
    useState<ChatAttachmentPreview | null>(null);
  const isBusy = isWorking || status === "streaming" || status === "submitted";
  const isPage = layout === "page";
  const lastMessage = messages.at(-1);
  const activitySeconds = useChatActivityTimer(
    isBusy,
    activeChatId ?? "",
    lastMessage?.role === "assistant" ? lastMessage.id : undefined
  );
  const chatActivity = getChatActivity(messages, isBusy, {
    isStandaloneTool: (part) => isStandaloneChatTool(part, customTools),
  });
  const showThinkingIndicator = useDelayedAppearance(
    chatActivity.showThinkingIndicator,
    {
      delayMs: ACTIVITY_STEP_SETTLE_MS,
      immediate: lastMessage?.role !== "assistant",
    }
  );
  const visibleMessages = messages.filter((message) =>
    hasVisibleChatContent(message)
  );
  const lastVisibleMessage = visibleMessages.at(-1);
  const lastAssistantMessageId =
    lastVisibleMessage?.role === "assistant"
      ? lastVisibleMessage.id
      : undefined;
  const lastAssistantId = messages.findLast(
    (message) => message.role === "assistant"
  )?.id;
  // Once the reply is on screen, a pause between steps shows its status inside
  // the reply, where the next step will render, instead of below it.
  const isThinkingInline =
    showThinkingIndicator &&
    lastAssistantMessageId !== undefined &&
    lastAssistantMessageId === lastMessage?.id;
  const thinkingStatus = (
    <span className="text-muted-foreground flex items-center gap-2 text-sm leading-5">
      <ChatActivityStatus
        active={!isStopping}
        label={isStopping ? tPage("stopping") : tCommon("labels.thinkingLabel")}
        seconds={activitySeconds ?? 0}
      />
    </span>
  );
  const openArtifact =
    onOpenArtifact ??
    ((artifactId: string) => router.push(artifactPath(artifactId)));

  return (
    <MessageScrollerProvider autoScroll key={activeChatId ?? ""}>
      <ChatScrollOnSend
        lastUserMessageId={
          visibleMessages.findLast((message) => message.role === "user")?.id
        }
      />
      <MessageScroller
        className={cn(
          "min-h-0 flex-1",
          !isPage && "relative min-w-0 overflow-x-clip"
        )}
      >
        {!isPage && visibleMessages.length === 0 && !showThinkingIndicator ? (
          <ChatEmptyDither />
        ) : null}
        <MessageScrollerViewport className="min-w-0 overflow-x-hidden">
          <MessageScrollerContent
            className={cn(
              "relative min-w-0 gap-8 px-4 pb-8",
              isPage ? "pt-6" : "pt-4"
            )}
            // Copied text gets a quick sweep of light, so a copy is felt.
            onCopy={playCopyShimmerOnSelection}
          >
            {visibleMessages.map((message, index) => {
              const isUser = message.role === "user";
              const isGenerating =
                isBusy && message.id === lastAssistantMessageId;
              return (
                <MessageScrollerItem
                  className={cn(isPage && PAGE_COLUMN_CLASSNAME)}
                  key={getMessageKey?.(message, index) ?? message.id}
                  messageId={message.id}
                >
                  <div className={cn(!isPage && PANEL_MESSAGE_CLASSNAME)}>
                    <Message
                      // Answers, cards and previews line up with the user's
                      // messages on the right instead of stopping short.
                      className={cn(
                        "group/message relative",
                        !(isPage || isUser) && "max-w-full",
                        getMessageClassName?.(message, index)
                      )}
                      from={message.role}
                    >
                      {isUser ? (
                        (renderUserMessage?.(message, index, (part, key) =>
                          renderChatContentPart(part, key, {
                            mcpLogosByConnectionId,
                            postTitlesById,
                            onPreviewAttachment: setPreviewAttachment,
                          })
                        ) ?? (
                          <ChatUserMessage
                            message={message}
                            onPreviewAttachment={setPreviewAttachment}
                            surface={surface}
                          />
                        ))
                      ) : (
                        <MessageContent>
                          <ChatAssistantMessage
                            customTools={customTools}
                            elapsedSeconds={
                              message.id === lastMessage?.id
                                ? activitySeconds
                                : undefined
                            }
                            hasInlineActivity={chatActivity.hasInlineActivity}
                            isActive={
                              message.id === chatActivity.activeMessageId
                            }
                            // Picked up again after an answer or an approval,
                            // it shows as working from the moment the request
                            // goes out, not once the first token arrives.
                            isLoading={isGenerating}
                            isApprovalInComposer={isApprovalInComposer}
                            isStandalonePartVisible={isStandalonePartVisible}
                            isStopped={
                              message.id === lastAssistantId
                                ? wasStoppedByUser
                                : undefined
                            }
                            mcpLogosByConnectionId={mcpLogosByConnectionId}
                            message={message}
                            onApproveTool={onApproveTool}
                            onDenyTool={onDenyTool}
                            onOpenArtifact={openArtifact}
                            onPreviewAttachment={setPreviewAttachment}
                            organizationId={organizationId}
                            organizationSlug={organizationSlug}
                            postTitlesById={postTitlesById}
                          />
                          {isThinkingInline &&
                          message.id === lastAssistantMessageId
                            ? thinkingStatus
                            : null}
                        </MessageContent>
                      )}
                      {isPage && !(isUser || isGenerating) ? (
                        <AssistantMetadataHover
                          metadata={parseChatMessageMetadata(message.metadata)}
                        />
                      ) : null}
                    </Message>
                  </div>
                </MessageScrollerItem>
              );
            })}
            {notices ? (
              <div
                className={cn(
                  "flex flex-col gap-2",
                  isPage && PAGE_COLUMN_CLASSNAME
                )}
              >
                {notices}
              </div>
            ) : null}
            {showThinkingIndicator && !isThinkingInline ? (
              <MessageScrollerItem
                className={cn(
                  "[contain-intrinsic-size:none] [content-visibility:visible]",
                  isPage && PAGE_COLUMN_CLASSNAME
                )}
                messageId="thinking"
                style={{ contentVisibility: "visible" }}
              >
                {thinkingStatus}
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
      {/* Beside the scroller, not in it: positioned against the whole chat
          column, so the input's height doesn't move it off center. */}
      {overlay}
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
          }
        }}
        open={previewAttachment !== null}
      />
    </MessageScrollerProvider>
  );
}
