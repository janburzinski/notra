"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@notra/ui/components/shared/responsive-alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Input } from "@notra/ui/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { CHAT_TITLE_MAX_LENGTH } from "@/constants/chat";
import { cn } from "@/lib/utils";
import {
  chatSessionResponseSchema,
  chatSessionsListResponseSchema,
} from "@/schemas/chat";
import type { ChatSessionSummary } from "@/types/chat";
import { normalizeChatTitle, sortChatSessions } from "@/utils/chat";

interface ChatTopbarTitleProps {
  chatId: string;
}

function formatChatIdFallback(chatId: string) {
  if (chatId.length <= 10) {
    return chatId;
  }
  return `${chatId.slice(0, 6)}…${chatId.slice(-3)}`;
}

export function ChatTopbarTitle({ chatId }: ChatTopbarTitleProps) {
  const { activeOrganization } = useOrganizationsContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slug = activeOrganization?.slug;
  const organizationId = activeOrganization?.id;

  const chatSessionsQueryKey = useMemo(
    () => ["chat-sessions", organizationId] as const,
    [organizationId]
  );

  const { data: sessions = [] } = useQuery({
    queryKey: chatSessionsQueryKey,
    queryFn: async () => {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/sessions`
      );
      if (!response.ok) {
        return [];
      }
      const parsed = chatSessionsListResponseSchema.safeParse(
        await response.json()
      );
      return parsed.success ? (parsed.data.sessions ?? []) : [];
    },
    enabled: Boolean(organizationId),
    refetchOnWindowFocus: true,
  });

  const session = sessions.find((item) => item.chatId === chatId);
  const title = session?.title ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renameInFlightRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function replaceSessionInCache(
    updater: (session: ChatSessionSummary) => ChatSessionSummary
  ) {
    queryClient.setQueryData<ChatSessionSummary[]>(
      chatSessionsQueryKey,
      (current = []) =>
        sortChatSessions(
          current.map((item) => (item.chatId === chatId ? updater(item) : item))
        )
    );
  }

  function startEditing() {
    if (!session) {
      return;
    }
    setDraftTitle(session.title);
    setIsEditing(true);
  }

  async function submitRename() {
    if (!(organizationId && session)) {
      return;
    }

    const nextTitle = normalizeChatTitle(draftTitle);

    if (!nextTitle) {
      toast.error("Title can't be empty");
      setDraftTitle(session.title);
      setIsEditing(false);
      return;
    }

    if (nextTitle === session.title) {
      setIsEditing(false);
      return;
    }

    if (renameInFlightRef.current) {
      return;
    }

    renameInFlightRef.current = true;
    setIsRenaming(true);
    const previousSessions =
      queryClient.getQueryData<ChatSessionSummary[]>(chatSessionsQueryKey) ??
      [];

    replaceSessionInCache((item) => ({ ...item, title: nextTitle }));
    setIsEditing(false);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${chatId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: nextTitle }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to rename chat");
      }

      const parsed = chatSessionResponseSchema.safeParse(await response.json());
      if (parsed.success && parsed.data.session) {
        const updated = parsed.data.session;
        replaceSessionInCache(() => updated);
      }
    } catch {
      queryClient.setQueryData(chatSessionsQueryKey, previousSessions);
      setDraftTitle(session.title);
      setIsEditing(true);
      toast.error("Failed to rename chat");
    } finally {
      renameInFlightRef.current = false;
      setIsRenaming(false);
    }
  }

  async function togglePinned() {
    if (!(organizationId && session) || isPinning) {
      return;
    }

    const nextPinned = !session.pinnedAt;
    setIsPinning(true);
    const previousSessions =
      queryClient.getQueryData<ChatSessionSummary[]>(chatSessionsQueryKey) ??
      [];
    const nextPinnedAt = nextPinned ? new Date().toISOString() : null;

    replaceSessionInCache((item) => ({ ...item, pinnedAt: nextPinnedAt }));

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${chatId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: nextPinned }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update pin state");
      }

      const parsed = chatSessionResponseSchema.safeParse(await response.json());
      if (parsed.success && parsed.data.session) {
        const updated = parsed.data.session;
        replaceSessionInCache(() => updated);
      }
    } catch {
      queryClient.setQueryData(chatSessionsQueryKey, previousSessions);
      toast.error("Failed to update chat pin");
    } finally {
      setIsPinning(false);
    }
  }

  async function handleDelete() {
    if (!(organizationId && session)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/chat/${chatId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      queryClient.setQueryData<ChatSessionSummary[]>(
        chatSessionsQueryKey,
        (current = []) => current.filter((item) => item.chatId !== chatId)
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatSessionsQueryKey }),
        queryClient.invalidateQueries({
          queryKey: ["chat-history", organizationId, chatId],
        }),
      ]);

      toast.success("Chat deleted");
      setDeleteOpen(false);
      router.replace(`/${slug}/chat`);
    } catch {
      toast.error("Failed to delete chat");
    } finally {
      setIsDeleting(false);
    }
  }

  const displayTitle = title ?? formatChatIdFallback(chatId);
  const hasTitle = Boolean(title);

  return (
    <>
      <div className="flex min-w-0 items-center gap-1">
        {isEditing ? (
          <Input
            className="h-7 w-56"
            disabled={isRenaming}
            maxLength={CHAT_TITLE_MAX_LENGTH}
            onBlur={submitRename}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitRename();
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setIsEditing(false);
              }
            }}
            ref={inputRef}
            value={draftTitle}
          />
        ) : (
          <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
            <DropdownMenuTrigger
              className={cn(
                "flex min-w-0 max-w-[40ch] cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground text-sm no-underline outline-hidden transition-colors hover:bg-accent hover:no-underline focus-visible:bg-accent",
                (isRenaming || isPinning) && "opacity-70"
              )}
              onDoubleClick={(event) => {
                event.preventDefault();
                startEditing();
              }}
            >
              <span className="relative block min-w-0 truncate">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="block truncate"
                    exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                    initial={{
                      opacity: 0,
                      y: hasTitle ? 4 : 0,
                      filter: hasTitle ? "blur(4px)" : "blur(0px)",
                    }}
                    key={hasTitle ? "title" : "fallback"}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    {displayTitle}
                  </motion.span>
                </AnimatePresence>
              </span>
              <HugeiconsIcon
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                  isMenuOpen && "rotate-180"
                )}
                icon={ArrowDown01Icon}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-44"
              showBackdrop={false}
              sideOffset={6}
            >
              <DropdownMenuItem
                disabled={!session || isPinning}
                onClick={togglePinned}
              >
                <HugeiconsIcon
                  icon={session?.pinnedAt ? PinOffIcon : PinIcon}
                />
                {session?.pinnedAt ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!session} onClick={startEditing}>
                <HugeiconsIcon icon={PencilEdit02Icon} />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!session}
                onClick={() => setDeleteOpen(true)}
                variant="destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <ResponsiveAlertDialog
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteOpen(false);
          }
        }}
        open={deleteOpen}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              Delete chat?
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              This will permanently delete &quot;{session?.title ?? "this chat"}
              &quot;. This action cannot be undone.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel disabled={isDeleting}>
              Cancel
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              variant="destructive"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
}
