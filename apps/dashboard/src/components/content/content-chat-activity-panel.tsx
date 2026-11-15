"use client";

import {
  ArrowShrink01Icon,
  Cancel01Icon,
  Clock01Icon,
  FullScreenIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import { Fragment } from "react";
import { useTranslations } from "use-intl";

import { ChatConversation } from "@/components/chat/chat-conversation";
import { ContentPanelHeaderButton } from "@/components/content/content-panel-header-button";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { RIGHT_PANEL_SHELL_CARD_CLASSNAME } from "@/constants/right-panel";
import type {
  ContentChatActivityHeaderProps,
  ContentChatActivityPanelProps,
  ContentChatHistoryItemsProps,
} from "@/types/components/content-chat-activity-panel";
import { displayChatTitle } from "@/utils/chat-history-groups";
import { getContentChatHistoryGroups } from "@/utils/content-chat-history";

function ContentChatHistoryItems({
  sessions,
  activeChatId,
  isHistoryLoading,
  status,
  onSelectChat,
}: ContentChatHistoryItemsProps) {
  const t = useTranslations("content.chatActivity");
  const tCommon = useTranslations("common");
  if (isHistoryLoading) {
    return (
      <p className="text-muted-foreground px-2 py-1.5 text-center text-xs">
        {t("loadingChats")}
      </p>
    );
  }
  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground px-2 py-1.5 text-center text-xs">
        {t("noPreviousChats")}
      </p>
    );
  }
  const isAgentBusy = status === "streaming" || status === "submitted";
  return getContentChatHistoryGroups(sessions).map((group, groupIndex) => (
    <Fragment key={group.key}>
      {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          {group.key === "previousSevenDays"
            ? t("historyGroups.previousSevenDays")
            : tCommon(`labels.${group.key}`)}
        </DropdownMenuLabel>
        {group.sessions.map((session) => (
          <DropdownMenuItem
            className="data-[active=true]:bg-accent/70"
            data-active={activeChatId === session.chatId}
            disabled={isAgentBusy}
            key={session.chatId}
            onClick={() => onSelectChat(session.chatId)}
            title={displayChatTitle(session.title, tCommon("labels.newChat"))}
          >
            <span className="min-w-0 flex-1 truncate">
              {displayChatTitle(session.title, tCommon("labels.newChat"))}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </Fragment>
  ));
}

function ContentChatActivityHeader({
  sessions,
  activeChatId,
  isHistoryLoading,
  status,
  onNewChat,
  onSelectChat,
  onClose,
  onOpenChat,
  showHistory = true,
  title: titleProp,
  titleSlot,
  surface = "muted",
}: ContentChatActivityHeaderProps) {
  const t = useTranslations("content.chatActivity");
  const tCommon = useTranslations("common");
  const title = titleProp ?? t("defaultTitle");
  const { expanded, toggleExpanded } = useRightPanel();
  const opensInChat = Boolean(onOpenChat);
  const isAgentBusy = status === "streaming" || status === "submitted";
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center justify-between gap-2 rounded-t-[calc(0.75rem-1px)] px-4",
        surface === "muted" && "bg-muted"
      )}
    >
      {titleSlot ?? (
        <h2 className="text-foreground flex h-full min-w-0 items-center truncate text-sm leading-5">
          <span className="truncate">{title}</span>
        </h2>
      )}
      <TooltipProvider>
        <div className="-mr-1.5 flex h-full items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  disabled={isAgentBusy}
                  onClick={onNewChat}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <span className="sr-only">{t("startNewChat")}</span>
              <HugeiconsIcon
                className="size-4"
                icon={PlusSignIcon}
                strokeWidth={1.8}
              />
            </TooltipTrigger>
            <TooltipContent>{tCommon("labels.newChat")}</TooltipContent>
          </Tooltip>
          {showHistory ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      className="inline-flex"
                      disabled={isAgentBusy}
                      render={<Button size="icon-sm" variant="ghost" />}
                    />
                  }
                >
                  <span className="sr-only">{t("openHistory")}</span>
                  <HugeiconsIcon
                    className="size-4"
                    icon={Clock01Icon}
                    strokeWidth={1.8}
                  />
                </TooltipTrigger>
                <TooltipContent>{t("history")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="max-h-72 w-52"
                sideOffset={6}
              >
                <ContentChatHistoryItems
                  sessions={sessions}
                  activeChatId={activeChatId}
                  isHistoryLoading={isHistoryLoading}
                  status={status}
                  onSelectChat={onSelectChat}
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  disabled={isAgentBusy}
                  onClick={onNewChat}
                >
                  <HugeiconsIcon
                    className="size-4 shrink-0"
                    icon={PlusSignIcon}
                    strokeWidth={1.8}
                  />
                  <span>{tCommon("labels.newChat")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <ContentPanelHeaderButton
            icon={opensInChat || !expanded ? FullScreenIcon : ArrowShrink01Icon}
            label={
              opensInChat
                ? t("openInChat")
                : expanded
                  ? t("exitFullscreenTitle", { title })
                  : t("openFullscreenTitle", { title })
            }
            onClick={onOpenChat ?? toggleExpanded}
            pressed={opensInChat ? undefined : expanded}
            tooltip={
              opensInChat
                ? t("openInChat")
                : expanded
                  ? t("exitFullscreen")
                  : t("expandAgent")
            }
          />
          <ContentPanelHeaderButton
            icon={Cancel01Icon}
            label={t("closeTitle", { title })}
            onClick={onClose}
            tooltip={t("closeTitle", { title })}
          />
        </div>
      </TooltipProvider>
    </header>
  );
}

export function ContentChatActivityPanel(props: ContentChatActivityPanelProps) {
  const { children, surface = "muted" } = props;
  const body = (
    <>
      <ChatConversation {...props} />
      {children}
    </>
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ContentChatActivityHeader {...props} />
      {surface === "shell" ? (
        // One card like a normal chat: messages, then the composer.
        <div
          className={cn(
            RIGHT_PANEL_SHELL_CARD_CLASSNAME,
            "mb-0.5 flex min-h-0 flex-1 flex-col overflow-hidden"
          )}
        >
          {body}
        </div>
      ) : (
        <div className="bg-muted flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[calc(0.75rem-1px)]">
          <div className="bg-background flex min-h-0 flex-1 flex-col rounded-t-xl">
            {body}
          </div>
        </div>
      )}
    </div>
  );
}
