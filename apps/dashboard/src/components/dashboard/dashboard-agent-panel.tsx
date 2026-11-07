"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { cn } from "@notra/ui/lib/utils";
import { useTranslations } from "use-intl";

import { AgentQuestionDock } from "@/components/ai/agent-question-dock";
import { autopilotWorkflowDraftTools } from "@/components/autopilot/autopilot-workflow-draft-tools";
import ChatInput from "@/components/chat-input";
import { ChatQuoteProvider } from "@/components/chat/chat-quote";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";
import { ContentChatActivityPanel } from "@/components/content/content-chat-activity-panel";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { AGENT_QUESTION_INPUT_RETURN_CLASS } from "@/constants/agent-questions";
import { DASHBOARD_AGENT_SUGGESTIONS } from "@/constants/chat-suggestions";
import { localStorageKeys } from "@/constants/storage";
import {
  useAgentDraftTarget,
  useAgentPromptTarget,
} from "@/lib/hooks/use-agent-handoff";
import { useDashboardAgentChat } from "@/lib/hooks/use-dashboard-agent-chat";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import { useOpenAgentChatPage } from "@/lib/hooks/use-open-agent-chat-page";
import type { DashboardAgentChatProps } from "@/types/components/dashboard-agent";
import { findPendingAgentQuestion } from "@/utils/agent-questions";
import { findAutopilotWorkflowDraft } from "@/utils/autopilot-workflow-draft";
import { upgradeLinkSlug } from "@/utils/chat-upgrade";

function DashboardAgentChat({
  hasOpened,
  organizationId,
  organizationSlug,
  onClose,
}: DashboardAgentChatProps) {
  const t = useTranslations("dashboard.agent");
  const tCommon = useTranslations("common");
  const tChatErrors = useTranslations("chat.errors");
  const { active, expanded } = useRightPanel();
  const isDesktop = useDesktopBreakpoint();
  const open = active === "agent";
  const agent = useDashboardAgentChat({
    organizationId,
    loadSessions: hasOpened,
  });
  const {
    activeChatId,
    chatError,
    chatInputRef,
    chatInputValue,
    isAgentBusy,
    isHydratingHistory,
    messages,
    messagesRef,
    setChatError,
    setChatInputValue,
  } = agent;

  useAgentPromptTarget(hasOpened, agent.sendPrompt);

  useAgentDraftTarget(open, (text) => {
    setChatInputValue(text);
    // Focus once the new text has rendered, so the caret lands after it.
    window.requestAnimationFrame(() => chatInputRef.current?.focus());
  });

  const handleSuggestionSelect = (prompt: string) => {
    setChatInputValue(prompt);
  };

  const handleOpenChat = useOpenAgentChatPage({
    organizationSlug,
    chatId: activeChatId,
    onClose,
    hasConversation: () =>
      messagesRef.current.length > 0 ||
      Boolean(
        agent.sessionsData?.some((session) => session.chatId === activeChatId)
      ),
  });

  const isChatDisabled = isHydratingHistory;
  const pendingQuestion = findPendingAgentQuestion(messages);
  const showExamplePrompts =
    messages.length === 0 && !isAgentBusy && !isHydratingHistory;

  const chat = hasOpened ? (
    <div className="h-full min-h-0 max-w-full min-w-0">
      <ChatQuoteProvider key={activeChatId}>
        <ContentChatActivityPanel
          activeChatId={activeChatId}
          isHistoryLoading={agent.isSessionsLoading || isHydratingHistory}
          messages={messages}
          customTools={autopilotWorkflowDraftTools({
            latestToolCallId:
              findAutopilotWorkflowDraft(messages)?.toolCallId ?? null,
          })}
          onApproveTool={agent.handleApproveTool}
          onClose={onClose}
          onDenyTool={agent.handleDenyTool}
          onNewChat={agent.handleNewChat}
          onOpenChat={handleOpenChat}
          onSelectChat={agent.handleSelectChat}
          organizationSlug={organizationSlug}
          showHistory={false}
          sessions={agent.sessions}
          status={agent.status}
          title={tCommon("labels.agent")}
        >
          {showExamplePrompts ? (
            <div className="px-2">
              <ChatSuggestions
                disabled={isChatDisabled}
                dismissStorageKey={
                  localStorageKeys.dashboardAgentSuggestionsDismissed
                }
                hidden={chatInputValue.trim().length > 0}
                layout="list"
                onSelect={handleSuggestionSelect}
                rotate
                suggestions={DASHBOARD_AGENT_SUGGESTIONS}
              />
            </div>
          ) : null}
          <div className="shrink-0 p-2 pt-1">
            {pendingQuestion ? (
              <AgentQuestionDock
                key={pendingQuestion.toolCallId}
                onDismiss={() =>
                  agent.dismissQuestion(pendingQuestion.toolCallId)
                }
                onSubmit={(answers) =>
                  agent.answerQuestion(pendingQuestion.toolCallId, answers)
                }
                questions={pendingQuestion.questions}
              />
            ) : null}
            {/* Stays mounted under the questions, so its attachments survive. */}
            <div
              className={AGENT_QUESTION_INPUT_RETURN_CLASS}
              hidden={pendingQuestion !== null}
            >
              <ChatInput
                disabled={isChatDisabled}
                error={chatError}
                isLoading={isAgentBusy}
                effort={agent.effort}
                onClearError={() => setChatError(null)}
                onRetry={agent.canRetry ? agent.retry : undefined}
                onEditQueued={agent.handleEditQueued}
                onRemoveQueued={agent.handleRemoveQueued}
                onSend={agent.handleSend}
                onSteerQueued={agent.handleSteerQueued}
                onStop={agent.handleStop}
                onValueChange={setChatInputValue}
                organizationId={organizationId}
                organizationSlug={upgradeLinkSlug(
                  chatError,
                  tChatErrors("usageLimit"),
                  organizationSlug
                )}
                placeholder={t("placeholder")}
                queuedMessages={agent.queuedMessages}
                ref={chatInputRef}
                value={chatInputValue}
              />
            </div>
          </div>
        </ContentChatActivityPanel>
      </ChatQuoteProvider>
    </div>
  ) : null;

  if (isDesktop) {
    return chat;
  }

  return (
    <ResponsiveDialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          expanded
            ? "h-svh max-h-svh max-w-none rounded-none sm:max-w-none"
            : "h-[85svh] max-h-[85svh] sm:max-w-md"
        )}
        drawerClassName={cn(
          "[&>*:not([data-slot=sheet-header]):not([data-slot=sheet-footer]):not([data-slot=sheet-close])]:px-0",
          expanded && "h-svh max-h-svh rounded-none"
        )}
        keepMounted
        showCloseButton={false}
      >
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>
            {tCommon("labels.agent")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {chat}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DashboardAgentHost() {
  const { closePanel, hasOpened } = useRightPanel();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const organizationSlug = activeOrganization?.slug ?? "";

  if (!organizationId) {
    return null;
  }

  return (
    <DashboardAgentChat
      hasOpened={hasOpened.agent}
      key={organizationId}
      onClose={() => closePanel("agent")}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
    />
  );
}
