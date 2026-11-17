"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import { Badge } from "@notra/ui/components/ui/badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  type AgentActivity,
  AgentActivityCard,
} from "@/components/autopilot/autopilot-agent-activity-card";
import {
  OtherFiles,
  ReadFailed,
} from "@/components/autopilot/autopilot-brief-item-dialog";
import { AutopilotFindingStatus } from "@/components/autopilot/autopilot-finding-status";
import {
  AutopilotChangedBlock,
  AutopilotInlineDiff,
  AutopilotRemovedBlock,
  AutopilotSuggestionChips,
} from "@/components/autopilot/autopilot-post-diff";
import { Button } from "@/components/button";
import { ChatInput } from "@/components/chat/chat-input";
import {
  AUTOPILOT_REVISION_STEPS,
  AUTOPILOT_REVISION_SUGGESTIONS,
} from "@/constants/autopilot-revisions";
import { AUTOPILOT_KIND_META } from "@/constants/autopilot-ui";
import { useFindingRevisions } from "@/lib/hooks/use-finding-revisions";
import type {
  AutopilotFindingPost,
  AutopilotFindingView,
} from "@/types/autopilot";
import type {
  AutopilotPostChange,
  AutopilotPostChanges,
  AutopilotPostWorkbenchProps,
  AutopilotRevisionResult,
} from "@/types/autopilot-revisions";
import { findingDisplayTitle } from "@/utils/autopilot-findings";
import { postImageComponents } from "@/utils/autopilot-post-images";
import { diffWords } from "@/utils/inline-diff";

type Revisions = ReturnType<typeof useFindingRevisions>;

/** The agent's card: working on the request, or how it went. */
function activityFor(
  finding: AutopilotFindingView,
  working: boolean,
  startedAt: number,
  result: AutopilotRevisionResult | null
): AgentActivity | null {
  if (working) {
    return { phase: "working", startedAt };
  }
  if (!result) {
    return null;
  }
  if (!result.commitSha) {
    return {
      phase: "done",
      version: 0,
      title: "Autopilot replied on the pull request",
      note: result.note,
    };
  }
  return {
    phase: "done",
    version: 0,
    note: result.note,
    git: {
      verb: "Committed",
      sha: result.commitSha.slice(0, 7),
      commitUrl: finding.pullRequestUrl
        ? `${finding.pullRequestUrl}/commits/${result.commitSha}`
        : null,
      pullRequest: finding.pullRequestNumber,
      pullRequestUrl: finding.pullRequestUrl,
    },
  };
}

/**
 * Keys for a post's blocks from their text, counted for repeats, so a block
 * keeps its key when blocks before it come or go.
 */
function keyedBlocks(blocks: readonly string[]) {
  const seen = new Map<string, number>();
  return blocks.map((block) => {
    const count = (seen.get(block) ?? 0) + 1;
    seen.set(block, count);
    return { block, key: `${count}:${block}` };
  });
}

/**
 * One post's body. With changes shown, the blocks the latest commit touched
 * read as an inline diff and removed ones are struck through where they were;
 * the rest is the post as it is.
 */
function PostBody({
  post,
  change,
  fresh,
}: {
  post: AutopilotFindingPost;
  change: AutopilotPostChange | null;
  fresh: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const components = postImageComponents(post.images);
  if (!change) {
    return (
      <MessageResponse components={components} mode="static">
        {post.body}
      </MessageResponse>
    );
  }
  const order = new Map(change.changed.map((index, rank) => [index, rank]));
  const removedComponents = postImageComponents(change.imagesBefore);
  const removedAt = (index: number) =>
    keyedBlocks(change.removed[index] ?? []).map(({ block, key }) => (
      <AutopilotRemovedBlock
        components={removedComponents}
        key={`removed:${key}`}
        markdown={block}
      />
    ));
  return (
    <div className="space-y-4">
      {keyedBlocks(change.blocks).map(({ block, key }, index) => {
        const rank = order.get(index);
        return (
          <div className="space-y-4" key={key}>
            {removedAt(index)}
            {rank === undefined ? (
              <MessageResponse components={components} mode="static">
                {block}
              </MessageResponse>
            ) : (
              <AutopilotChangedBlock
                after={block}
                animate={fresh && !reduceMotion}
                before={change.before[index] ?? null}
                components={components}
                order={rank}
              />
            )}
          </div>
        );
      })}
      {removedAt(change.blocks.length)}
    </div>
  );
}

function PostTitle({
  title,
  change,
}: {
  title: string;
  change: AutopilotPostChange | null;
}) {
  if (!change?.titleBefore) {
    return title;
  }
  return (
    <AnimatePresence>
      <AutopilotInlineDiff
        animate
        delay={0}
        runs={diffWords(change.titleBefore, title)}
      />
    </AnimatePresence>
  );
}

function PostSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-6 h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

/** Kind, pull request, the changes toggle and the merge actions, above the title. */
function PostMetaBar({
  finding,
  working,
  changes,
  showChanges,
  onToggleChanges,
  children,
}: {
  finding: AutopilotFindingView;
  working: boolean;
  changes: AutopilotPostChanges | null;
  showChanges: boolean;
  onToggleChanges: () => void;
  children: ReactNode;
}) {
  const meta = AUTOPILOT_KIND_META[finding.kind];
  const hasChanges = changes !== null && Object.keys(changes.posts).length > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Badge shape="rounded" size="md" variant="secondary">
          <HugeiconsIcon
            aria-hidden="true"
            icon={meta.icon}
            strokeWidth={1.5}
          />
          {meta.label}
        </Badge>
        <AutopilotFindingStatus finding={finding} working={working} />
      </div>
      <div className="flex items-center gap-2">
        {hasChanges ? (
          <Button
            aria-pressed={showChanges}
            onClick={onToggleChanges}
            size="sm"
            variant="ghost"
          >
            {showChanges ? "Hide changes" : "Show changes"}
          </Button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** Every post the pull request writes; one post takes the page title itself. */
function PostList({
  finding,
  revisions,
  showChanges,
}: {
  finding: AutopilotFindingView;
  revisions: Revisions;
  showChanges: boolean;
}) {
  const { shown, changes } = revisions;
  const posts = shown?.posts ?? [];
  const single = posts.length === 1 ? posts[0] : null;
  const changeFor = (post: AutopilotFindingPost) =>
    showChanges ? (changes?.posts[post.path] ?? null) : null;
  return (
    <>
      <h1 className="mt-4 text-3xl/tight font-semibold tracking-tight text-balance">
        <PostTitle
          change={single ? changeFor(single) : null}
          title={single?.title ?? findingDisplayTitle(finding)}
        />
      </h1>
      {single?.description ? (
        <p className="text-muted-foreground mt-3 text-base/7 text-pretty">
          {single.description}
        </p>
      ) : null}
      <div
        className={cn(
          "mt-8 space-y-10 text-base/7 transition-opacity duration-300",
          revisions.working && "opacity-50"
        )}
      >
        {revisions.loading && !shown ? <PostSkeleton /> : null}
        {revisions.failed && !shown ? (
          <ReadFailed pullRequestUrl={finding.pullRequestUrl} />
        ) : null}
        {posts.map((post) => (
          <section className="space-y-3" key={post.path}>
            {single ? null : (
              <div className="space-y-1">
                <p className="text-muted-foreground font-mono text-xs">
                  {post.path}
                </p>
                {post.title ? (
                  <h2 className="text-xl font-semibold text-pretty">
                    <PostTitle change={changeFor(post)} title={post.title} />
                  </h2>
                ) : null}
              </div>
            )}
            <PostBody
              change={changeFor(post)}
              fresh={showChanges}
              post={post}
            />
          </section>
        ))}
        {shown ? <OtherFiles content={shown} /> : null}
      </div>
    </>
  );
}

/** Under the post: the agent's card, the one-tap requests and the composer. */
function RevisionComposer({
  finding,
  revisions,
}: {
  finding: AutopilotFindingView;
  revisions: Revisions;
}) {
  const { working } = revisions;
  const activity = activityFor(
    finding,
    working,
    revisions.startedAt,
    revisions.result
  );
  // Solid under the chips, with a short fade above so text never sits
  // behind them.
  return (
    <div className="bg-background before:from-background sticky bottom-0 z-10 -mx-4 mt-8 px-4 pt-1 pb-5 before:pointer-events-none before:absolute before:inset-x-0 before:-top-10 before:h-10 before:bg-linear-to-t before:to-transparent">
      <div className="mx-auto max-w-2xl space-y-2.5">
        <div className="relative flex min-h-8 items-center">
          <div className="absolute inset-x-0 bottom-full z-10 pb-2">
            <AnimatePresence>
              {activity ? (
                <AgentActivityCard
                  activity={activity}
                  key="activity"
                  steps={AUTOPILOT_REVISION_STEPS}
                />
              ) : null}
            </AnimatePresence>
          </div>
          <AutopilotSuggestionChips
            disabled={working}
            onPick={revisions.ask}
            suggestions={AUTOPILOT_REVISION_SUGGESTIONS}
          />
        </div>
        <ChatInput
          attachments={false}
          disabled={working}
          error={revisions.error}
          layout="card"
          onClearError={revisions.clearError}
          onSend={(text) => revisions.ask(text)}
          placeholder="Ask for changes to the post…"
          surface="card"
        />
      </div>
    </div>
  );
}

/**
 * An Autopilot pull request as the post it writes: read it, ask for changes
 * in your own words, and see each commit as an inline diff of what it
 * changed. `children` sits under the post, above the composer.
 */
export function AutopilotPostWorkbench({
  finding,
  organizationId,
  canRequest,
  actions,
  children,
}: AutopilotPostWorkbenchProps) {
  const revisions = useFindingRevisions(organizationId, finding);
  const { changes } = revisions;
  const [hidden, setHidden] = useState<string | null>(null);
  const showChanges = changes !== null && hidden !== changes.headSha;
  const article = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // A new commit brings its first change into view.
  const changedSha = changes?.headSha ?? null;
  useEffect(() => {
    if (!changedSha) {
      return;
    }
    article.current?.querySelector("[data-changed]")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [changedSha, reduceMotion]);

  return (
    <LazyMotion features={domAnimation}>
      <div className="relative">
        <article className="mx-auto max-w-2xl pb-10" ref={article}>
          <PostMetaBar
            changes={changes}
            finding={finding}
            onToggleChanges={() =>
              setHidden(showChanges ? (changes?.headSha ?? null) : null)
            }
            showChanges={showChanges}
            working={revisions.working}
          >
            {actions?.({
              headSha: revisions.shown?.headSha ?? null,
              working: revisions.working,
            })}
          </PostMetaBar>
          <PostList
            finding={finding}
            revisions={revisions}
            showChanges={showChanges}
          />
        </article>
        {children}
        {canRequest ? (
          <RevisionComposer finding={finding} revisions={revisions} />
        ) : null}
      </div>
    </LazyMotion>
  );
}
