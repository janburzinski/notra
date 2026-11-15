"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import {
  Analytics01Icon,
  Cancel01Icon,
  PlusSignIcon,
  SidebarRightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Button, buttonVariants } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { EASE } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ChatArtifactDocument } from "@/components/artifacts/chat-artifact-document";
import { useChatQuote } from "@/components/chat/chat-quote";
import { ContentStatusBadge } from "@/components/content/overview/content-status-badge";
import { RightPanel } from "@/components/dashboard/right-panel";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import Link from "@/components/framework/link";
import { RIGHT_PANEL_SHELL_CARD_CLASSNAME } from "@/constants/right-panel";
import { useAnnotationFlash } from "@/lib/hooks/use-annotation-flash";
import { useAnnotationHighlights } from "@/lib/hooks/use-annotation-highlights";
import { useContent } from "@/lib/hooks/use-content";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import { useOutputTypeLabel } from "@/lib/hooks/use-output-type-label";
import type { ChatPostEntry } from "@/types/chat-posts";
import type {
  ChatContentPanelDocumentProps,
  ChatContentPanelEntry,
  ChatContentPanelProps,
  ChatContentPanelTabProps,
  ChatContentPanelTabSurfaceProps,
} from "@/types/components/chat-content-panel";
import { OutputTypeIcon } from "@/utils/output-types";

const TAB_DROP_ANIMATION = {
  duration: 180,
  easing: `cubic-bezier(${EASE.out.join(", ")})`,
};

function noop() {}

function isSocialPost(post: ChatPostEntry) {
  return (
    post.contentType === "twitter_post" || post.contentType === "linkedin_post"
  );
}

function ChatContentPanelDocument({
  focus,
  onAskForChanges,
  organizationId,
  organizationSlug,
  post,
}: ChatContentPanelDocumentProps) {
  const t = useTranslations("chat.contentPanel");
  const tCommon = useTranslations("common");
  const tToolBlock = useTranslations("ai.toolBlock");
  const tPreview = useTranslations("ai.preview");
  const { data: savedPost } = useContent(organizationId, post.postId ?? "");
  const quoteContext = useChatQuote();
  const title =
    savedPost?.content.title ?? (post.title || tCommon("labels.untitled"));
  const markdown = savedPost?.content.markdown ?? post.markdown;
  const { postId } = post;
  const articleRef = useRef<HTMLElement>(null);
  const annotatedPassages = (quoteContext?.annotations ?? []).flatMap(
    (annotation) => (annotation.postId === postId ? [annotation.text] : [])
  );
  useAnnotationHighlights(articleRef, annotatedPassages, markdown);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flashRects = useAnnotationFlash(
    articleRef,
    scrollRef,
    focus ?? null,
    () => toast(t("passageChanged")),
    () => quoteContext?.clearAnnotationFocus()
  );

  // Nothing to say or do yet (not saved, not writing): no footer at all.
  const hasFooter = post.state === "writing" || Boolean(postId);
  // While writing it says so; once saved, the post's status badge. A draft
  // that isn't saved yet shows nothing.
  let status: ReactNode = null;
  if (post.state === "writing") {
    status = (
      <span className="text-muted-foreground truncate text-xs">
        {t("status.writing")}
      </span>
    );
  } else if (postId && savedPost) {
    status = <ContentStatusBadge status={savedPost.content.status} />;
  }

  return (
    <>
      <div
        aria-label={tPreview("contentRegion", { type: title })}
        className={cn(
          RIGHT_PANEL_SHELL_CARD_CLASSNAME,
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 focus-visible:outline-none",
          !hasFooter && "mb-0.5"
        )}
        ref={scrollRef}
        role="region"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scrollable preview must be reachable for keyboard scrolling.
        tabIndex={0}
      >
        <article
          className="relative mx-auto w-full max-w-[42rem]"
          ref={articleRef}
          data-chat-quote-post-id={postId ?? undefined}
          data-chat-quote-post-title={postId ? title : undefined}
          data-chat-quote-source={postId ? quoteContext?.scopeId : undefined}
        >
          {flashRects.map((rect) => (
            <span
              aria-hidden="true"
              className="bg-warning/30 pointer-events-none absolute rounded-sm motion-safe:animate-[annotation-flash_1.6s_ease-out_forwards]"
              key={rect.key}
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              }}
            />
          ))}
          <h1 className="text-foreground mb-4 text-xl leading-snug font-semibold text-balance">
            {title}
          </h1>
          {isSocialPost(post) ? (
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {markdown}
            </p>
          ) : (
            <MessageResponse
              className="text-sm leading-relaxed"
              isAnimating={post.state === "writing"}
              mode={post.state === "writing" ? undefined : "static"}
            >
              {markdown}
            </MessageResponse>
          )}
        </article>
      </div>
      {hasFooter ? (
        <footer className="flex h-12 shrink-0 items-center justify-between gap-2 px-4">
          <div aria-live="polite" className="flex min-w-0 items-center">
            {status}
          </div>
          {postId ? (
            <div className="-mr-1.5 flex items-center gap-1">
              <Button
                onClick={() => onAskForChanges({ ...post, postId, title })}
                size="sm"
                variant="ghost"
              >
                {tPreview("askForChanges")}
              </Button>
              <Button
                nativeButton={false}
                render={
                  <Link href={`/${organizationSlug}/content/${postId}`} />
                }
                size="sm"
                variant="secondary"
              >
                {tToolBlock("openInEditor")}
              </Button>
            </div>
          ) : null}
        </footer>
      ) : null}
    </>
  );
}

function ChatContentPanelEntryIcon({
  entry,
}: {
  entry: ChatContentPanelEntry;
}) {
  if (entry.kind === "artifact") {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3.5 shrink-0"
        icon={Analytics01Icon}
        strokeWidth={1.8}
      />
    );
  }
  return (
    <OutputTypeIcon
      className="size-3.5 shrink-0"
      outputType={entry.post.contentType}
    />
  );
}

function ChatContentPanelTabSurface({
  dragHandleProps,
  isActive,
  isOverlay = false,
  onActivate,
  onClose,
  entry,
}: ChatContentPanelTabSurfaceProps) {
  const t = useTranslations("chat.contentPanel");
  const tCommon = useTranslations("common");
  const title = entry.title || tCommon("labels.untitled");

  return (
    <div
      className={cn(
        buttonVariants({
          variant: isActive ? "secondary" : "ghost",
          size: "sm",
        }),
        "group/tab w-full justify-start gap-0 px-0 text-xs transition-[background-color,color,box-shadow] active:scale-100",
        !isActive && "text-muted-foreground",
        isOverlay && "cursor-grabbing shadow-md"
      )}
    >
      <button
        aria-selected={isActive}
        className={cn(
          "focus-visible:ring-ring flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-[inherit] pl-2.5 outline-none focus-visible:ring-2",
          isOverlay ? "cursor-grabbing" : "cursor-pointer",
          isActive || isOverlay ? "pr-7" : "pr-2.5"
        )}
        onClick={onActivate}
        role="tab"
        tabIndex={isOverlay ? -1 : undefined}
        title={title}
        type="button"
        {...dragHandleProps}
      >
        <ChatContentPanelEntryIcon entry={entry} />
        <span
          className={cn(
            "truncate",
            !(isActive || isOverlay) &&
              "group-focus-within/tab:[mask-image:linear-gradient(to_left,transparent_1.25rem,#000_2.5rem)] group-hover/tab:[mask-image:linear-gradient(to_left,transparent_1.25rem,#000_2.5rem)]"
          )}
        >
          {title}
        </span>
      </button>
      <button
        aria-label={t("closeTab", { title })}
        className={cn(
          "text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2",
          isActive || isOverlay
            ? "opacity-100"
            : "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100"
        )}
        onClick={onClose}
        tabIndex={isOverlay ? -1 : undefined}
        type="button"
      >
        <HugeiconsIcon className="size-3" icon={Cancel01Icon} strokeWidth={2} />
      </button>
    </div>
  );
}

function ChatContentPanelTab({
  isActive,
  onActivate,
  onClose,
  entry,
}: ChatContentPanelTabProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  return (
    <div
      className={cn(
        "max-w-64 min-w-28 flex-1 basis-0",
        "-my-1 overflow-clip py-1 transition-[max-width,min-width,opacity] duration-200 ease-out [overflow-clip-margin:4px] motion-reduce:transition-none starting:max-w-0 starting:min-w-0 starting:opacity-0",
        isDragging && "opacity-35"
      )}
      data-tab-id={entry.id}
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${Math.round(transform.x)}px, 0, 0)`
          : undefined,
        transition,
      }}
    >
      <ChatContentPanelTabSurface
        dragHandleProps={listeners}
        isActive={isActive}
        onActivate={onActivate}
        onClose={onClose}
        entry={entry}
      />
    </div>
  );
}

export function ChatContentPanel({
  activeToolCallId,
  focus,
  onActivateTab,
  onAskForChanges,
  onCloseTab,
  onOpenTab,
  onReorderTabs,
  openToolCallIds,
  organizationId,
  organizationSlug,
  organizationName,
  posts,
  artifacts,
}: ChatContentPanelProps) {
  const t = useTranslations("chat.contentPanel");
  const tCommon = useTranslations("common");
  const getOutputTypeLabel = useOutputTypeLabel();
  const { active, closePanel } = useRightPanel();
  const isDesktop = useDesktopBreakpoint();
  const tArtifacts = useTranslations("artifacts");
  const entries: ChatContentPanelEntry[] = [
    ...posts.map((post) => ({
      kind: "post" as const,
      id: post.toolCallId,
      title: post.title,
      post,
    })),
    ...artifacts.map((artifact) => ({
      kind: "artifact" as const,
      id: artifact.tabId,
      title: artifact.title,
      artifact,
    })),
  ];
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const openEntries = openToolCallIds.flatMap((id) => {
    const entry = entriesById.get(id);
    return entry ? [entry] : [];
  });
  const openIds = new Set(openToolCallIds);
  const closedEntries = entries.filter((entry) => !openIds.has(entry.id));
  const activeEntry = openEntries.find(
    (entry) => entry.id === activeToolCallId
  );
  // Closing the last tab closes the panel; it keeps showing that tab while it
  // slides out instead of flashing the empty state.
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);
  if (activeEntry && activeEntry.id !== lastEntryId) {
    setLastEntryId(activeEntry.id);
  }
  const shownEntry =
    activeEntry ??
    (active !== "preview" && lastEntryId
      ? entriesById.get(lastEntryId)
      : undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const tablistRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingEntry = draggingId ? entriesById.get(draggingId) : undefined;
  const keepInTabBar: Modifier = ({ transform, draggingNodeRect }) => {
    const bar = tablistRef.current?.getBoundingClientRect();
    if (!(bar && draggingNodeRect)) {
      return { ...transform, y: 0 };
    }
    const minX = bar.left - draggingNodeRect.left;
    const maxX = bar.right - draggingNodeRect.right;
    return {
      ...transform,
      x: Math.min(Math.max(transform.x, minX), maxX),
      y: 0,
    };
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over || active.id === over.id) {
      return;
    }
    const ids = openEntries.map((entry) => entry.id);
    onReorderTabs(
      arrayMove(
        ids,
        ids.indexOf(String(active.id)),
        ids.indexOf(String(over.id))
      )
    );
  };

  useEffect(() => {
    const tab = activeToolCallId
      ? tablistRef.current?.querySelector(
          `[data-tab-id="${CSS.escape(activeToolCallId)}"]`
        )
      : null;
    tab?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeToolCallId, openToolCallIds.length]);

  const closeOnLeave = useEffectEvent(() => closePanel("preview"));
  useEffect(() => () => closeOnLeave(), []);

  const content = (
    <>
      <header className="flex h-12 shrink-0 items-center gap-1 px-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => closePanel("preview")}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <span className="sr-only">{t("close")}</span>
              <HugeiconsIcon
                className="size-4"
                icon={SidebarRightIcon}
                strokeWidth={1.8}
              />
            </TooltipTrigger>
            <TooltipContent>{t("close")}</TooltipContent>
          </Tooltip>
          <span
            aria-hidden="true"
            className="bg-border mx-1 h-4 w-px shrink-0"
          />
          <div
            aria-label={t("title")}
            className="flex max-w-(--tabs-max-width) min-w-0 flex-1 scrollbar-none items-center gap-1 overflow-x-auto"
            ref={tablistRef}
            role="tablist"
            style={
              {
                "--tabs-max-width": `calc(${openEntries.length} * 16rem + ${Math.max(openEntries.length - 1, 0)} * 0.25rem)`,
              } as CSSProperties
            }
          >
            <DndContext
              autoScroll={false}
              collisionDetection={closestCenter}
              onDragCancel={() => setDraggingId(null)}
              onDragEnd={handleDragEnd}
              onDragStart={({ active }) => setDraggingId(String(active.id))}
              sensors={sensors}
            >
              <SortableContext
                items={openEntries.map((entry) => entry.id)}
                strategy={horizontalListSortingStrategy}
              >
                {openEntries.map((entry) => (
                  <ChatContentPanelTab
                    entry={entry}
                    isActive={entry.id === activeEntry?.id}
                    key={entry.id}
                    onActivate={() => onActivateTab(entry.id)}
                    onClose={() => onCloseTab(entry.id)}
                  />
                ))}
              </SortableContext>
              {createPortal(
                <DragOverlay
                  dropAnimation={TAB_DROP_ANIMATION}
                  modifiers={[keepInTabBar]}
                  zIndex={60}
                >
                  {draggingEntry ? (
                    <ChatContentPanelTabSurface
                      entry={draggingEntry}
                      isActive={draggingEntry.id === activeEntry?.id}
                      isOverlay
                      onActivate={noop}
                      onClose={noop}
                    />
                  ) : null}
                </DragOverlay>,
                document.body
              )}
            </DndContext>
          </div>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    className="inline-flex shrink-0"
                    disabled={closedEntries.length === 0}
                    render={<Button size="icon-sm" variant="ghost" />}
                  />
                }
              >
                <span className="sr-only">{t("openTab")}</span>
                <HugeiconsIcon
                  className="size-4"
                  icon={PlusSignIcon}
                  strokeWidth={1.8}
                />
              </TooltipTrigger>
              <TooltipContent>{t("openTab")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-72" sideOffset={6}>
              {closedEntries.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onClick={() => onOpenTab(entry.id)}
                >
                  <ChatContentPanelEntryIcon entry={entry} />
                  <span className="min-w-0 flex-1 truncate">
                    {entry.title || tCommon("labels.untitled")}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {entry.kind === "post"
                      ? getOutputTypeLabel(entry.post.contentType)
                      : tArtifacts("label")}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </header>
      {shownEntry?.kind === "post" ? (
        <ChatContentPanelDocument
          focus={
            focus && focus.postId === shownEntry.post.postId ? focus : undefined
          }
          key={shownEntry.id}
          onAskForChanges={onAskForChanges}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          post={shownEntry.post}
        />
      ) : null}
      {shownEntry?.kind === "artifact" ? (
        <ChatArtifactDocument
          entry={shownEntry.artifact}
          key={shownEntry.id}
          onDeleted={() => onCloseTab(shownEntry.id)}
          organizationId={organizationId}
          organizationName={organizationName}
          organizationSlug={organizationSlug}
        />
      ) : null}
      {shownEntry ? null : (
        <p className="text-muted-foreground px-4 text-sm">{t("empty")}</p>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <RightPanel id="preview" size="wide" surface="shell">
        {content}
      </RightPanel>
    );
  }

  return (
    <ResponsiveDialog
      onOpenChange={(open) => {
        if (!open) {
          closePanel("preview");
        }
      }}
      open={active === "preview"}
    >
      <ResponsiveDialogContent
        className="flex h-[85svh] max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        drawerClassName="h-[85svh] max-h-[85svh]"
        showCloseButton={false}
      >
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("empty")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {content}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
