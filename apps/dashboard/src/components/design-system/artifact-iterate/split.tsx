"use client";

import { Notra } from "@notra/ui/components/ui/svgs/notra";
import { cn } from "@notra/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  ArtifactBlockTitle,
  ArtifactDocument,
} from "@/components/artifacts/artifact-document";
import { ArtifactEyebrow } from "@/components/artifacts/artifact-eyebrow";
import {
  AutopilotBriefFindingCard,
  AutopilotBriefFindingList,
} from "@/components/autopilot/autopilot-brief-finding-card";
import { ChatQuoteProvider } from "@/components/chat/chat-quote";
import type { AutopilotFindingView } from "@/types/autopilot";

import { ITERATE_ARTIFACT, ITERATE_FINDINGS } from "./fixtures";
import { prefetchPostContent } from "./post-content";
import {
  CloseButton,
  ItemStepper,
  PaneBar,
  PostWorkbench,
} from "./post-workbench";
import type { PostRevisions } from "./use-post-revisions";

const BRIEF_DATE = new Date("2026-11-16T08:00:00Z");
/**
 * One transition for the brief and the post, a drawer's curve: quick off the
 * mark, long soft landing. Both are CSS, so they can't drift apart.
 */
const SLIDE_CLASS =
  "transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

function findingById(id: string | null) {
  return ITERATE_FINDINGS.find((finding) => finding.id === id) ?? null;
}

/** An idea that has been written is a post with an open pull request now. */
function liveFinding(
  finding: AutopilotFindingView | null,
  written: Record<string, number>
): AutopilotFindingView | null {
  const number = finding ? written[finding.id] : undefined;
  if (!(finding && number)) {
    return finding;
  }
  return {
    ...finding,
    status: "proposed",
    pullRequestNumber: number,
    pullRequestUrl: `https://github.com/acme/website/pull/${number}`,
    headSha: `draft-${number}`,
  };
}

/**
 * The page splits in half. The brief keeps one width in both states (it fits
 * half the page), so opening never reflows it: it only slides from the
 * middle to the middle of the left half while the post slides in over the
 * right half, both as transforms on the same curve. Below `lg` the post
 * covers the page instead.
 */
export function SplitView({
  revisions,
  openId,
  setOpenId,
}: {
  revisions: PostRevisions;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const finding = liveFinding(findingById(openId), revisions.written);
  const isOpen = finding !== null;
  // The last post opened stays in the pane while it slides out.
  const [shown, setShown] = useState(finding);
  if (
    finding &&
    (finding.id !== shown?.id || finding.status !== shown.status)
  ) {
    setShown(finding);
  }
  // A row opened with the mouse keeps focus on its title. Closing with Esc
  // would then show a keyboard focus ring there, so the focus goes away;
  // opened from the keyboard, it stays where you were.
  const briefRef = useRef<HTMLDivElement>(null);
  const openedWithPointer = useRef(false);
  const close = useCallback(() => {
    setOpenId(null);
    const focused = document.activeElement;
    if (
      openedWithPointer.current &&
      focused instanceof HTMLElement &&
      briefRef.current?.contains(focused)
    ) {
      focused.blur();
    }
  }, [setOpenId]);
  const index = ITERATE_FINDINGS.findIndex((item) => item.id === openId);
  const queryClient = useQueryClient();
  const prefetch = useCallback(
    (id: string) => prefetchPostContent(queryClient, id),
    [queryClient]
  );
  // With a post open, the ones above and below load in the background, so
  // stepping with the arrows lands on a post that's already there.
  useEffect(() => {
    if (index < 0) {
      return;
    }
    for (const neighbour of [
      ITERATE_FINDINGS[index - 1],
      ITERATE_FINDINGS[index + 1],
    ]) {
      if (neighbour) {
        prefetch(neighbour.id);
      }
    }
  }, [index, prefetch]);
  const step = useCallback(
    (delta: number) => {
      const next = ITERATE_FINDINGS[index + delta];
      if (next) {
        setOpenId(next.id);
      }
    },
    [index, setOpenId]
  );

  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      event.key === "Escape" &&
      !target?.closest("textarea, input, [contenteditable]") &&
      !window.getSelection()?.toString()
    ) {
      close();
    }
  });
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen]);

  return (
    // Annotations belong to the post they were made on: switching clears
    // them, so they never go out with another post's request.
    <ChatQuoteProvider conversationId={openId}>
      <LazyMotion features={domAnimation} strict>
        <main className="bg-background relative h-svh overflow-hidden">
          <div
            className="h-full overflow-y-auto"
            onKeyDownCapture={(event) => {
              // Only keys that reach or open a row; Esc closes the pane.
              if (["Enter", " ", "Tab"].includes(event.key)) {
                openedWithPointer.current = false;
              }
            }}
            onPointerDownCapture={() => {
              openedWithPointer.current = true;
            }}
            ref={briefRef}
          >
            <div
              className={cn(
                SLIDE_CLASS,
                "mx-auto w-[min(42rem,calc(100vw-2rem))] pt-8 pb-24 lg:w-[min(42rem,calc(50vw-3rem))]",
                isOpen && "lg:-translate-x-[25vw]"
              )}
            >
              <nav className="mb-8 flex items-center gap-2 text-sm font-medium">
                <span className="dark:bg-foreground flex size-5 shrink-0 items-center justify-center rounded-sm">
                  <Notra className="size-4.5 dark:size-4" />
                </span>
                Acme
              </nav>
              <BriefDocument
                onOpen={setOpenId}
                // Writing from the brief opens the pane to watch it happen.
                onWrite={(id) => {
                  revisions.write(id, null);
                  setOpenId(id);
                }}
                prefetch={prefetch}
                writes={revisions.writes}
                working={revisions.working}
                written={revisions.written}
              />
            </div>
          </div>
          {/* Always mounted, so it slides out with the post it showed. */}
          <section
            aria-hidden={!isOpen}
            aria-label="Post"
            className={cn(
              SLIDE_CLASS,
              "border-table-row-border bg-background absolute inset-y-0 right-0 left-0 flex flex-col lg:left-1/2 lg:border-l",
              !isOpen && "translate-x-full"
            )}
            inert={!isOpen}
          >
            {shown ? (
              <PaneBar
                finding={shown}
                working={revisions.working[shown.id] !== undefined}
              >
                <CloseButton onClose={close} />
                <ItemStepper
                  active={isOpen}
                  count={ITERATE_FINDINGS.length}
                  index={index}
                  onStep={step}
                />
              </PaneBar>
            ) : null}
            {/* Switching items swaps the post in place; the pane stays. */}
            <AnimatePresence initial={false} mode="popLayout">
              {shown ? (
                <m.div
                  animate={{ opacity: 1 }}
                  className="flex min-h-0 flex-1 flex-col"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key={shown.id}
                  transition={{ duration: 0.15 }}
                >
                  <PostWorkbench finding={shown} revisions={revisions} />
                </m.div>
              ) : null}
            </AnimatePresence>
          </section>
        </main>
      </LazyMotion>
    </ChatQuoteProvider>
  );
}

/** The daily brief as the artifact page draws it, with fixture items. */
function BriefDocument({
  onOpen,
  onWrite,
  prefetch,
  working,
  writes,
  written,
}: {
  onOpen: (id: string) => void;
  onWrite: (id: string) => void;
  prefetch: (id: string) => void;
  /** Items Autopilot is changing right now; their PR badge spins. */
  working: Record<string, number>;
  /** Ideas being written: their Write button shows it's busy. */
  writes: Record<string, unknown>;
  /** Ideas written into pull requests, which show as posts now. */
  written: Record<string, number>;
}) {
  return (
    <ArtifactDocument
      blocks={ITERATE_ARTIFACT.blocks}
      density="page"
      eyebrow={<ArtifactEyebrow date={BRIEF_DATE} source="autopilot" />}
      renderAutopilot={(block) => {
        const rows = block.findingIds
          .map((id) => liveFinding(findingById(id), written))
          .filter((finding) => finding !== null);
        return (
          <section>
            {block.title ? (
              <ArtifactBlockTitle>{block.title}</ArtifactBlockTitle>
            ) : null}
            <AutopilotBriefFindingList>
              {rows.map((finding) => (
                // The whole row preloads its post, not just the title: the
                // pointer usually crosses the row on its way to the title.
                <div
                  key={finding.id}
                  onFocusCapture={() => prefetch(finding.id)}
                  onPointerEnter={() => prefetch(finding.id)}
                >
                  <AutopilotBriefFindingCard
                    canManage
                    canWrite
                    finding={finding}
                    merging={false}
                    onDismiss={() => toast("Closed (playground)")}
                    onMerge={() => toast.success("Merged (playground)")}
                    onOpen={() => onOpen(finding.id)}
                    onPreview={() => prefetch(finding.id)}
                    working={working[finding.id] !== undefined}
                    onWrite={() => onWrite(finding.id)}
                    timeZone="Europe/Berlin"
                    writing={writes[finding.id] !== undefined}
                  />
                </div>
              ))}
            </AutopilotBriefFindingList>
          </section>
        );
      }}
      summary={ITERATE_ARTIFACT.summary}
      title={ITERATE_ARTIFACT.title}
    />
  );
}
