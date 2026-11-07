"use client";

import {
  ArrowDown01Icon,
  FlowConnectionIcon,
  FullScreenIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Composer } from "@notra/ui/components/ui/composer";
import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import {
  COMPOSER_ELEVATED_SHADOW,
  COMPOSER_PILL_RADIUS,
  COMPOSER_TRAY_TRANSITION,
} from "@notra/ui/constants/composer";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { AgentQuestionDock } from "@/components/ai/agent-question-dock";
import { AutopilotWorkflowDraftPreview } from "@/components/autopilot/autopilot-workflow-draft-preview";
import { autopilotWorkflowDraftTools } from "@/components/autopilot/autopilot-workflow-draft-tools";
import ChatInput from "@/components/chat-input";
import { ChatQuoteProvider } from "@/components/chat/chat-quote";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";
import { ContentChatActivityConversation } from "@/components/content/content-chat-activity-panel";
import { ContentPanelHeaderButton } from "@/components/content/content-panel-header-button";
import { AGENT_QUESTION_INPUT_RETURN_CLASS } from "@/constants/agent-questions";
import {
  AUTOPILOT_AGENT_DOCK_CARD_CLASS,
  AUTOPILOT_AGENT_DOCK_ENTER,
  AUTOPILOT_AGENT_DOCK_EXIT,
  AUTOPILOT_AGENT_DOCK_FULLSCREEN_CLASS,
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_KIND_META,
} from "@/constants/autopilot-ui";
import {
  AUTOPILOT_AGENT_SUGGESTIONS,
  AUTOPILOT_AUTOMATION_SUGGESTIONS,
  AUTOPILOT_WORKFLOW_SUGGESTIONS,
} from "@/constants/chat-suggestions";
import { localStorageKeys } from "@/constants/storage";
import { useAgentDraftTarget } from "@/lib/hooks/use-agent-handoff";
import {
  useAutopilotDockFocus,
  useAutopilotDockKeys,
} from "@/lib/hooks/use-autopilot-dock";
import { useAgentWorkflowRefresh } from "@/lib/hooks/use-autopilot-workflows";
import { useDashboardAgentChat } from "@/lib/hooks/use-dashboard-agent-chat";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import type {
  AutopilotAgentDockChip,
  AutopilotAgentDockFocus,
  AutopilotAgentDockFocusChipProps,
  AutopilotAgentDockHeaderProps,
  AutopilotAgentDockInputProps,
  AutopilotAgentDockPreviewProps,
  AutopilotAgentDockSuggestionsProps,
  AutopilotAgentDockMode,
  AutopilotAgentDockProps,
} from "@/types/autopilot-workflows";
import { findPendingAgentQuestion } from "@/utils/agent-questions";
import { findAutopilotWorkflowDraft } from "@/utils/autopilot-workflow-draft";
import { upgradeLinkSlug } from "@/utils/chat-upgrade";

function motionOf<T>(reduceMotion: boolean | null, transition: T) {
  return reduceMotion ? { duration: 0 } : transition;
}

function dockLayerClass(fullscreen: boolean) {
  return fullscreen
    ? "absolute inset-0 z-30"
    : "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4";
}

function dockClass(mode: AutopilotAgentDockMode) {
  if (mode === "fullscreen") {
    return AUTOPILOT_AGENT_DOCK_FULLSCREEN_CLASS;
  }
  return cn(
    // Open, the dock always fills this height: the conversation gives up
    // whatever room the questions take, in the same layout pass, so the dock
    // itself never moves.
    "pointer-events-auto flex max-h-[min(41rem,calc(100svh-8rem))] w-full max-w-2xl flex-col border",
    // The pill's own corners, so the open dock and the pill line up.
    COMPOSER_PILL_RADIUS,
    COMPOSER_TRAY_TRANSITION,
    mode === "open"
      ? cn("bg-muted border-sidebar-border p-1", COMPOSER_ELEVATED_SHADOW)
      : "border-transparent bg-transparent"
  );
}

function chatCardClass(fullscreen: boolean) {
  return cn(
    AUTOPILOT_AGENT_DOCK_CARD_CLASS,
    "flex min-h-0 min-w-0 flex-col [grid-area:chat]",
    fullscreen ? "rounded-b-none border-b-0" : "mb-1 h-svh min-h-32 rounded-3xl"
  );
}

/** The chip for what's on screen: a workflow by its name, or a built-in automation. */
function focusChip({
  focusWorkflow,
  focusAutomation,
}: AutopilotAgentDockFocus): AutopilotAgentDockChip | null {
  if (focusWorkflow) {
    return { name: focusWorkflow.name, icon: FlowConnectionIcon };
  }
  if (focusAutomation) {
    return {
      name: AUTOPILOT_AUTOMATIONS[focusAutomation].name,
      icon: AUTOPILOT_KIND_META[focusAutomation].icon,
    };
  }
  return null;
}

function placeholderKey({
  hasMessages,
  focusWorkflow,
  focusAutomation,
}: AutopilotAgentDockFocus & { hasMessages: boolean }) {
  if (hasMessages) {
    return "promptBar.replyPlaceholder";
  }
  if (focusWorkflow) {
    return "promptBar.workflowPlaceholder";
  }
  return focusAutomation
    ? "promptBar.automationPlaceholder"
    : "promptBar.placeholder";
}

function suggestionsFor({
  focusWorkflow,
  focusAutomation,
}: AutopilotAgentDockFocus) {
  if (focusWorkflow) {
    return AUTOPILOT_WORKFLOW_SUGGESTIONS;
  }
  return focusAutomation
    ? AUTOPILOT_AUTOMATION_SUGGESTIONS
    : AUTOPILOT_AGENT_SUGGESTIONS;
}

function FocusChip({ focus, onRemove }: AutopilotAgentDockFocusChipProps) {
  const t = useTranslations("dashboard.agent");
  return (
    <Composer.Chip
      icon={
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground size-3.5"
          icon={focus.icon}
          strokeWidth={1.5}
        />
      }
      label={focus.name}
      labelClassName="max-w-80"
      onRemove={onRemove}
      removeLabel={t("dock.detachWorkflow", { name: focus.name })}
    />
  );
}

/** An empty conversation offers workflows the agent can build right away. */
function DockSuggestions({
  disabled,
  hidden,
  onSelect,
  suggestions,
}: AutopilotAgentDockSuggestionsProps) {
  return (
    <div className="shrink-0 px-4 pb-2">
      <ChatSuggestions
        disabled={disabled}
        dismissStorageKey={localStorageKeys.autopilotAgentSuggestionsDismissed}
        hidden={hidden}
        layout="list"
        onSelect={onSelect}
        suggestions={suggestions}
      />
    </div>
  );
}

function WorkflowPreviewEmpty() {
  const t = useTranslations("dashboard.agent");
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center">
      <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4.5"
          icon={FlowConnectionIcon}
          strokeWidth={1.5}
        />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("dock.previewEmptyTitle")}</p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("dock.previewEmptyDescription")}
        </p>
      </div>
    </div>
  );
}

/** The title lines up with the messages' left edge below it. */
function AutopilotAgentDockHeader({
  fullscreen,
  onNewChat,
  onToggleFullscreen,
  onMinimize,
}: AutopilotAgentDockHeaderProps) {
  const t = useTranslations("dashboard.agent");
  const tCommon = useTranslations("common");
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 pr-1.5 pl-5 [grid-area:header]">
      <h2 className="text-foreground truncate text-sm leading-5">
        {tCommon("labels.agent")}
      </h2>
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          <ContentPanelHeaderButton
            icon={PlusSignIcon}
            label={tCommon("labels.newChat")}
            onClick={onNewChat}
            tooltip={tCommon("labels.newChat")}
          />
          <ContentPanelHeaderButton
            icon={FullScreenIcon}
            label={t("dock.fullScreen")}
            onClick={onToggleFullscreen}
            pressed={fullscreen}
            tooltip={
              fullscreen ? t("dock.exitFullScreen") : t("dock.fullScreen")
            }
          />
          <ContentPanelHeaderButton
            icon={ArrowDown01Icon}
            label={t("dock.minimize")}
            onClick={onMinimize}
            tooltip={t("dock.minimize")}
          />
        </div>
      </TooltipProvider>
    </header>
  );
}

/** The workflow the agent is building, or what will show here once it does. */
function DockWorkflowPreview({
  draft,
  onApprove,
  onDeny,
}: AutopilotAgentDockPreviewProps) {
  if (!draft) {
    return <WorkflowPreviewEmpty />;
  }
  const { approvalId } = draft;
  return (
    <AutopilotWorkflowDraftPreview
      draft={draft}
      onApprove={approvalId ? () => onApprove(approvalId) : undefined}
      onDeny={approvalId ? () => onDeny(approvalId) : undefined}
      variant="panel"
    />
  );
}

/**
 * While the agent waits on questions, they take the input's place. The input
 * stays mounted so its attachments survive.
 */
function DockInput({
  fullscreen,
  pendingQuestion,
  questionsElevated,
  onAnswer,
  onDismissQuestion,
  children,
}: AutopilotAgentDockInputProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 shrink-0 flex-col",
        fullscreen &&
          cn(
            AUTOPILOT_AGENT_DOCK_CARD_CLASS,
            // Continues the chat card above, so the input sits inside it.
            "rounded-t-none border-t-0 px-4 pb-4 [grid-area:input]"
          )
      )}
    >
      {pendingQuestion ? (
        <AgentQuestionDock
          elevated={questionsElevated}
          key={pendingQuestion.toolCallId}
          onDismiss={() => onDismissQuestion(pendingQuestion.toolCallId)}
          onSubmit={(answers) => onAnswer(pendingQuestion.toolCallId, answers)}
          questions={pendingQuestion.questions}
        />
      ) : null}
      <div
        className={AGENT_QUESTION_INPUT_RETURN_CLASS}
        hidden={pendingQuestion !== null}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Autopilot's composer: it grows into the conversation when you send, and
 * goes full screen with the workflow the agent builds beside the chat. All
 * three sizes share one tree, so a half-answered question, attachments and
 * the scroll position survive a change of size.
 */
export function AutopilotAgentDock({
  organizationId,
  organizationSlug,
  hidden,
}: AutopilotAgentDockProps) {
  const t = useTranslations("dashboard.agent");
  const tCommon = useTranslations("common");
  const tChatErrors = useTranslations("chat.errors");
  const reduceMotion = useReducedMotion();
  const isDesktop = useDesktopBreakpoint();
  const [mode, setMode] = useState<AutopilotAgentDockMode>("collapsed");
  // Following a link, such as a saved workflow's, folds the dock away so
  // the page shows; the conversation stays and comes back on focus.
  const { focusWorkflowId, focusAutomation, focusWorkflow, detach } =
    useAutopilotDockFocus(organizationId, () => setMode("collapsed"));
  const agent = useDashboardAgentChat({
    organizationId,
    loadSessions: false,
    autopilotWorkflowId: focusWorkflowId ?? undefined,
    autopilotAutomation: focusAutomation ?? undefined,
  });
  const focus = focusChip({ focusWorkflow, focusAutomation });
  const {
    chatError,
    chatInputRef,
    chatInputValue,
    messages,
    setChatError,
    setChatInputValue,
  } = agent;
  const draft = findAutopilotWorkflowDraft(messages);
  useAgentWorkflowRefresh(messages);
  const pendingQuestion = findPendingAgentQuestion(messages);
  const fullscreen = mode === "fullscreen";
  const expanded = mode !== "collapsed";
  const hasMessages = messages.length > 0;
  const dockRef = useRef<HTMLElement | null>(null);
  const keepCollapsedRef = useAutopilotDockKeys({
    dockRef,
    mode,
    setMode,
    hasMessages,
  });

  useAgentDraftTarget(!hidden, (text) => {
    setChatInputValue(text);
    // Focus once the new text has rendered, so the caret lands after it.
    window.requestAnimationFrame(() => chatInputRef.current?.focus());
  });

  const minimize = () => {
    setMode("collapsed");
    // The header goes away with the button; keep the keyboard in the dock.
    keepCollapsedRef.current = true;
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
      keepCollapsedRef.current = false;
    });
  };

  // In full screen the preview sits beside the chat, so the chat's copies
  // shrink to a line. Below lg there's no room for it, and the chat keeps
  // the steps and what changes next to Save.
  const customTools = autopilotWorkflowDraftTools({
    latestToolCallId: draft?.toolCallId ?? null,
    compactAll: fullscreen && isDesktop,
  });

  const placeholder = t(
    placeholderKey({ hasMessages, focusWorkflow, focusAutomation })
  );

  const composer = (
    <ChatInput
      disabled={agent.isHydratingHistory}
      elevated={mode === "collapsed"}
      error={chatError}
      isLoading={agent.isAgentBusy}
      layout="pill"
      onClearError={() => setChatError(null)}
      onRetry={agent.canRetry ? agent.retry : undefined}
      // On a workflow's page, the workflow is attached: it's what "this"
      // means to the agent, until it's taken off.
      chips={focus ? <FocusChip focus={focus} onRemove={detach} /> : undefined}
      // Open, the input keeps its size, so the dock doesn't move under the
      // pointer when focus leaves it for a button.
      pillExpanded={expanded}
      onEditQueued={agent.handleEditQueued}
      onRemoveQueued={agent.handleRemoveQueued}
      onSend={(text, attachments) => {
        if (mode === "collapsed") {
          setMode("open");
        }
        agent.sendPrompt({ text, attachments });
      }}
      onSteerQueued={agent.handleSteerQueued}
      onStop={agent.handleStop}
      onValueChange={setChatInputValue}
      organizationId={organizationId}
      organizationSlug={upgradeLinkSlug(
        chatError,
        tChatErrors("usageLimit"),
        organizationSlug
      )}
      // Short once a conversation is going, so it fits the narrow column.
      placeholder={placeholder}
      queuedMessages={agent.queuedMessages}
      ref={chatInputRef}
      value={chatInputValue}
    />
  );

  // An empty conversation offers workflows the agent can build right away.
  const suggestions =
    !hasMessages && !agent.isAgentBusy ? (
      <DockSuggestions
        disabled={agent.isHydratingHistory}
        hidden={chatInputValue.trim().length > 0}
        onSelect={(prompt) => {
          setChatInputValue(prompt);
          window.requestAnimationFrame(() => chatInputRef.current?.focus());
        }}
        suggestions={suggestionsFor({ focusWorkflow, focusAutomation })}
      />
    ) : null;

  const preview = (
    <DockWorkflowPreview
      draft={draft}
      onApprove={agent.handleApproveTool}
      onDeny={agent.handleDenyTool}
    />
  );

  return (
    <div className={cn(dockLayerClass(fullscreen), hidden && "hidden")}>
      <section
        aria-label={tCommon("labels.agent")}
        className={dockClass(mode)}
        ref={dockRef}
      >
        <LazyMotion features={domAnimation} strict>
          <AnimatePresence initial={false}>
            {expanded ? (
              <m.div
                // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the conversation grows out of the input once per open; a transform would stretch its text
                animate={{ height: "auto", opacity: 1 }}
                // In full screen its children sit on the dock's grid.
                className={
                  fullscreen
                    ? "contents"
                    : "flex min-h-0 flex-col overflow-hidden"
                }
                exit={{
                  // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the conversation folds into the input once per close; a transform would squash its text
                  height: 0,
                  opacity: 0,
                  transition: motionOf(reduceMotion, AUTOPILOT_AGENT_DOCK_EXIT),
                }}
                // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the start of the one-time open above
                initial={{ height: 0, opacity: 0 }}
                key="conversation"
                transition={motionOf(reduceMotion, AUTOPILOT_AGENT_DOCK_ENTER)}
              >
                {/* The title lines up with the messages' left edge below it. */}
                <AutopilotAgentDockHeader
                  fullscreen={fullscreen}
                  onMinimize={minimize}
                  onNewChat={agent.handleNewChat}
                  onToggleFullscreen={() =>
                    setMode(fullscreen ? "open" : "fullscreen")
                  }
                />
                <div className={chatCardClass(fullscreen)}>
                  <ChatQuoteProvider key={agent.activeChatId}>
                    <ContentChatActivityConversation
                      activeChatId={agent.activeChatId}
                      customTools={customTools}
                      hideModel
                      messages={messages}
                      onApproveTool={agent.handleApproveTool}
                      onDenyTool={agent.handleDenyTool}
                      organizationSlug={organizationSlug}
                      status={agent.status}
                    />
                  </ChatQuoteProvider>
                  {suggestions}
                </div>
                {fullscreen ? (
                  <aside
                    aria-label={t("dock.preview")}
                    className={cn(
                      AUTOPILOT_AGENT_DOCK_CARD_CLASS,
                      "hidden min-h-0 min-w-0 [grid-area:aside] lg:flex"
                    )}
                  >
                    {preview}
                  </aside>
                ) : null}
              </m.div>
            ) : null}
          </AnimatePresence>
        </LazyMotion>
        <DockInput
          fullscreen={fullscreen}
          onAnswer={agent.answerQuestion}
          onDismissQuestion={agent.dismissQuestion}
          pendingQuestion={pendingQuestion}
          questionsElevated={mode === "collapsed"}
        >
          {composer}
        </DockInput>
      </section>
    </div>
  );
}
