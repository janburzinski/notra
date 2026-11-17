"use client";

import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CHAT_TITLE_MAX_LENGTH } from "@notra/ai/constants/chat";
import type { ChatSessionSummary } from "@notra/ai/types/chat";
import { normalizeChatTitle } from "@notra/ai/utils/chat";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Input } from "@notra/ui/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@notra/ui/components/ui/sidebar";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { AgentLoader } from "@/components/icons/agent-loader";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useChatRunState } from "@/lib/hooks/use-chat-run-state";
import {
  useChatSessionMutations,
  useChatSessions,
} from "@/lib/hooks/use-chat-sessions";
import { useFormatRelative } from "@/lib/hooks/use-format-relative";
import { useMinuteTick } from "@/lib/hooks/use-minute-tick";
import { usePathname, useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { ChatHistorySourceFilter } from "@/types/chat";
import {
  chatSessionSource,
  chatSessionSources,
  displayChatTitle,
  filterChatSessions,
} from "@/utils/chat-history-groups";
import { chatHistoryQueryOptions } from "@/utils/chat-history-query";

import { ChatHistoryHeader } from "./chat-history-header";
import { ChatHistoryNavLoading } from "./chat-history-nav-loading";
import { ChatSourceIcon } from "./chat-source-icon";
import { SidebarLabel } from "./sidebar-label";
import { SidebarNavLink } from "./sidebar-nav-link";

function chatIdFromPath(path: string): string | undefined {
  const pathSegments = path.split("/").filter(Boolean);
  return pathSegments[1] === "chat" ? pathSegments[2] : undefined;
}

export function ChatHistoryNav() {
  const t = useTranslations("dashboard.chatHistory");
  const tCommon2 = useTranslations("common");
  const tChat = useTranslations("dashboard.chatTitle");
  const tCommon = useTranslations("common.actions");
  const { activeOrganization } = useOrganizationsContext();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [pinningChatId, setPinningChatId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<ChatSessionSummary | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] =
    useState<ChatHistorySourceFilter>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const formatRelative = useFormatRelative();
  // Keeps "5 minutes ago" counting while the sidebar stays open.
  useMinuteTick();

  const slug = activeOrganization?.slug;
  const organizationId = activeOrganization?.id;

  function prefetchChatHistory(chatId: string) {
    if (!organizationId) {
      return;
    }
    void queryClient.prefetchQuery(
      chatHistoryQueryOptions(organizationId, chatId)
    );
  }

  const { sessions, generatingTitleChatIds, isLoading, isError } =
    useChatSessions();
  const showError = isError && sessions.length === 0;
  const showLoading = !showError && isLoading && sessions.length === 0;
  const { renameChat, togglePinned, deleteChat } = useChatSessionMutations();

  const pathSegments = pathname.split("/").filter(Boolean);
  const currentChatId = chatIdFromPath(pathname);
  const isOnChatRoute = pathSegments[1] === "chat";
  const newChatLabel = tCommon2("labels.newChat");
  const sources = chatSessionSources(sessions);
  const { finishedUnseenIds } = useChatRunState({
    organizationId,
    sessions,
    currentChatId,
  });
  const visibleSessions = filterChatSessions(sessions, {
    source: sourceFilter,
    query,
    newChatLabel,
  });

  useEffect(() => {
    if (!editingChatId) {
      return;
    }

    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingChatId]);

  async function submitRename(session: ChatSessionSummary) {
    const nextTitle = normalizeChatTitle(draftTitle);

    if (!nextTitle) {
      toast.error(tChat("emptyTitle"));
      setDraftTitle(session.title);
      setEditingChatId(null);
      return;
    }

    if (nextTitle === session.title) {
      setEditingChatId(null);
      return;
    }

    setRenamingChatId(session.chatId);
    setEditingChatId(null);
    const ok = await renameChat(session.chatId, nextTitle);
    if (!ok) {
      setDraftTitle(session.title);
      setEditingChatId(session.chatId);
    }
    setRenamingChatId(null);
  }

  async function handleDelete() {
    if (!deleteCandidate) {
      return;
    }

    const candidate = deleteCandidate;
    setDeletingChatId(candidate.chatId);
    const ok = await deleteChat(candidate.chatId);
    setDeletingChatId(null);

    if (!ok) {
      return;
    }

    if (candidate.chatId === currentChatId) {
      router.replace(`/${slug}/chat`);
    }
    setDeleteCandidate(null);
    setEditingChatId((current) =>
      current === candidate.chatId ? null : current
    );
  }

  function startEditing(session: ChatSessionSummary) {
    if (generatingTitleChatIds.has(session.chatId)) {
      return;
    }
    setDraftTitle(session.title);
    setEditingChatId(session.chatId);
  }

  async function handleTogglePinned(session: ChatSessionSummary) {
    if (pinningChatId === session.chatId) {
      return;
    }
    setPinningChatId(session.chatId);
    await togglePinned(session);
    setPinningChatId(null);
  }

  function renderSessions(items: ChatSessionSummary[]) {
    return (
      <SidebarMenu className="gap-px">
        {items.map((session) => {
          const isEditing = editingChatId === session.chatId;
          const isRenaming = renamingChatId === session.chatId;
          const isPinning = pinningChatId === session.chatId;
          const isBusy = isRenaming || isPinning;
          const isGeneratingTitle = generatingTitleChatIds.has(session.chatId);
          const sessionHref = `/${slug}/chat/${session.chatId}`;
          const source = chatSessionSource(session);
          const hasUnseenReply =
            !session.isRunning && finishedUnseenIds.has(session.chatId);

          return (
            <ContextMenu key={session.chatId}>
              <ContextMenuTrigger render={<SidebarMenuItem />}>
                <SidebarMenuButton
                  className={cn(
                    "h-auto min-h-12.5 cursor-pointer flex-col items-stretch justify-center gap-0.5 py-1.5",
                    isBusy && "opacity-70"
                  )}
                  isActive={session.chatId === currentChatId}
                  render={
                    isEditing ? (
                      <div className="w-full">
                        <Input
                          className="h-7"
                          disabled={isBusy}
                          maxLength={CHAT_TITLE_MAX_LENGTH}
                          onBlur={() => submitRename(session)}
                          onChange={(event) =>
                            setDraftTitle(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              submitRename(session);
                              return;
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              setDraftTitle(session.title);
                              setEditingChatId(null);
                            }
                          }}
                          ref={editInputRef}
                          value={draftTitle}
                        />
                      </div>
                    ) : (
                      <SidebarNavLink
                        aria-label={
                          isGeneratingTitle ? tChat("generating") : undefined
                        }
                        href={sessionHref}
                        onClick={(event) => {
                          if (window.location.pathname === sessionHref) {
                            event.preventDefault();
                          }
                        }}
                        onFocus={() => prefetchChatHistory(session.chatId)}
                        onMouseEnter={() => prefetchChatHistory(session.chatId)}
                        onPointerDown={() =>
                          prefetchChatHistory(session.chatId)
                        }
                        replace={isOnChatRoute}
                      >
                        {isGeneratingTitle ? (
                          <Skeleton
                            aria-label={tChat("generating")}
                            className="my-0.5 h-4 w-28 max-w-full"
                            role="status"
                          />
                        ) : (
                          <span
                            className={cn(
                              "duration-fast truncate transition-[padding] ease-out group-focus-within/menu-item:pr-6 group-hover/menu-item:pr-6 group-has-data-popup-open/menu-item:pr-6",
                              hasUnseenReply && "font-medium"
                            )}
                          >
                            {displayChatTitle(session.title, newChatLabel)}
                          </span>
                        )}
                        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-normal">
                          {session.isRunning ? (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <AgentLoader className="text-foreground/75 size-3.5! min-h-3.5! min-w-3.5!" />
                              <Shimmer as="span" className="truncate">
                                {t("working")}
                              </Shimmer>
                            </span>
                          ) : (
                            <>
                              {hasUnseenReply && (
                                <span
                                  aria-label={t("newReply")}
                                  className="bg-primary size-1.5 shrink-0 rounded-full"
                                  role="img"
                                />
                              )}
                              <time
                                className="shrink-0 tabular-nums"
                                dateTime={session.updatedAt}
                              >
                                {formatRelative(session.updatedAt)}
                              </time>
                            </>
                          )}
                          {source === "slack" && (
                            <>
                              <ChatSourceIcon source={source} />
                              <span className="sr-only">
                                {t("sources.slack")}
                              </span>
                            </>
                          )}
                          {session.pinnedAt && (
                            <HugeiconsIcon
                              aria-label={t("pinned")}
                              className="size-3.5"
                              icon={PinIcon}
                              role="img"
                            />
                          )}
                        </span>
                      </SidebarNavLink>
                    )
                  }
                />

                {!isEditing && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={t("options")}
                      className="text-muted-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent data-popup-open:text-foreground duration-fast absolute top-1 right-1.5 flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 outline-hidden transition-opacity ease-out group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 data-popup-open:opacity-100 [&>svg]:size-4 [&>svg]:shrink-0"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      <HugeiconsIcon icon={MoreHorizontalIcon} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-44"
                      side="right"
                      sideOffset={6}
                    >
                      <DropdownMenuItem
                        onClick={() => handleTogglePinned(session)}
                      >
                        <HugeiconsIcon
                          icon={session.pinnedAt ? PinOffIcon : PinIcon}
                        />
                        {session.pinnedAt ? tChat("unpin") : tChat("pin")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={isGeneratingTitle}
                        onClick={() => startEditing(session)}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                        {tCommon("rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteCandidate(session)}
                        variant="destructive"
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                        {tCommon("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </ContextMenuTrigger>

              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleTogglePinned(session)}>
                  <HugeiconsIcon
                    icon={session.pinnedAt ? PinOffIcon : PinIcon}
                  />
                  {session.pinnedAt ? tChat("unpin") : tChat("pin")}
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={isGeneratingTitle}
                  onClick={() => startEditing(session)}
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} />
                  {tCommon("rename")}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => setDeleteCandidate(session)}
                  variant="destructive"
                >
                  <HugeiconsIcon icon={Delete02Icon} />
                  {tCommon("delete")}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </SidebarMenu>
    );
  }

  if (!slug) {
    return null;
  }

  return (
    <>
      {/* The rail fades the chats out and hides them with CSS instead of
          unmounting them, and they have no rail tooltips: re-rendering every
          chat when the sidebar toggled held up its first frame. */}
      <div className="duration-fast flex-1 overflow-x-clip transition-[opacity,display] transition-discrete ease-(--sidebar-ease) group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none starting:opacity-0">
        {showError && (
          <div className="space-y-2 p-3" role="alert">
            <p className="text-muted-foreground text-xs">{t("loadFailed")}</p>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              type="button"
              variant="outline"
            >
              {tCommon("refresh")}
            </Button>
          </div>
        )}
        {showLoading && <ChatHistoryNavLoading />}
        {!(showError || showLoading) && sessions.length > 0 && (
          <SidebarGroup className="pt-0">
            {/* Sticks right under the Back row (h-12) above it. */}
            <div className="bg-sidebar sticky top-12 z-10 pb-1">
              <ChatHistoryHeader
                onQueryChange={setQuery}
                onSearchOpenChange={setSearchOpen}
                onSourceChange={setSourceFilter}
                query={query}
                searchOpen={searchOpen}
                source={sourceFilter}
                sources={sources}
              />
            </div>
            <SidebarGroupContent>
              {visibleSessions.length > 0 ? (
                renderSessions(visibleSessions)
              ) : (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">
                  {t("noMatches")}
                </p>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </div>

      <ConfirmDialog
        confirmLabel={tCommon("delete")}
        description={tCommon2("messages.thisWillPermanentlyDeleteTitle", {
          title: deleteCandidate?.title ?? "",
        })}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCandidate(null);
          }
        }}
        open={Boolean(deleteCandidate)}
        pending={Boolean(deletingChatId)}
        title={tChat("deleteTitle")}
        variant="destructive"
      />
    </>
  );
}
