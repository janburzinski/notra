"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Tick02Icon,
  ArrowUp02Icon,
  ArrowTurnBackwardIcon,
  Clock01Icon,
  Heading01Icon,
  Megaphone01Icon,
  PencilEdit02Icon,
  ScissorIcon,
  SourceCodeIcon,
  StudentIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useFormatter } from "use-intl";

import {
  type AgentActivity,
  AgentActivityCard,
} from "@/components/autopilot/autopilot-agent-activity-card";
import { AutopilotFindingStatus } from "@/components/autopilot/autopilot-finding-status";
import { AutopilotMergeMenu } from "@/components/autopilot/autopilot-merge-menu";
import {
  AutopilotChangedBlock,
  AutopilotInlineDiff,
  AutopilotSuggestionChips,
} from "@/components/autopilot/autopilot-post-diff";
import { Button } from "@/components/button";
import { ChatInput } from "@/components/chat/chat-input";
import { useChatQuote } from "@/components/chat/chat-quote";
import { AUTOPILOT_REVISION_SUGGESTIONS } from "@/constants/autopilot-revisions";
import { AUTOPILOT_KIND_META } from "@/constants/autopilot-ui";
import type { AutopilotFindingView } from "@/types/autopilot";
import { findingDisplayTitle } from "@/utils/autopilot-findings";
import { diffWords } from "@/utils/inline-diff";

import { ITERATE_DRAFTS, type IteratePost } from "./fixtures";
import { postContentQueryOptions } from "./post-content";
import {
  type PlanState,
  type PostRevisions,
  type PostVersion,
  WRITE_MS,
} from "./use-post-revisions";

/** One-tap changes to an idea's plan, before anything is written. */
const PLAN_SUGGESTIONS = [
  { label: "More detail", icon: TextIcon },
  { label: "Different angle", icon: StudentIcon },
  { label: "Fewer sections", icon: ScissorIcon },
] as const;

/** What the working line says while a plan changes. */
const PLAN_STEPS = [
  "Rethinking the outline",
  "Checking what people search",
  "Tightening the angle",
  "Asking the founding intern",
];

/** What the working line says while a first draft is written. */
const WRITE_STEPS = [
  "Reading the searches behind it",
  "Outlining the post",
  "Writing the first draft",
  "Dillydallying",
  "Checking the code samples",
  "Founding intern is proofreading",
  "Opening a pull request",
];

/** What kind of item this is, as a badge above the post's title. */
function PostMetaLine({ finding }: { finding: AutopilotFindingView }) {
  const meta = AUTOPILOT_KIND_META[finding.kind];
  // The pull request already has its badge in the pane's top bar.
  return (
    <Badge shape="rounded" size="md" variant="secondary">
      <HugeiconsIcon aria-hidden="true" icon={meta.icon} strokeWidth={1.5} />
      {meta.label}
    </Badge>
  );
}

/**
 * The version on screen, as the artifact page's version menu draws it: a
 * ghost button with the number, the versions newest first in a dropdown.
 */
function VersionMenu({
  versions,
  viewing,
  onPick,
  onRestore,
}: {
  versions: PostVersion[];
  viewing: number;
  onPick: (version: number) => void;
  /** Makes an older version current again, as a new commit. */
  onRestore: (version: number) => void;
}) {
  const format = useFormatter();
  if (versions.length < 2) {
    return null;
  }
  const latest = versions.at(-1)?.number ?? viewing;
  const isOld = viewing !== latest;
  const viewed = versions.find((version) => version.number === viewing);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="shrink-0 active:scale-100"
            size="sm"
            type="button"
            variant={isOld ? "secondary" : "ghost"}
          />
        }
      >
        <span className="flex items-center gap-1">
          <HugeiconsIcon
            className="size-3.5"
            icon={Clock01Icon}
            strokeWidth={2}
          />
          {/* On an older version the trigger says so, so it's never mistaken
              for what's in the pull request now. */}
          <span className="tabular-nums">
            {isOld ? `v${viewing} of ${latest}` : `v${viewing}`}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" sideOffset={6}>
        <DropdownMenuGroup>
          {versions.toReversed().map((version) => (
            <DropdownMenuItem
              key={version.number}
              onClick={() => onPick(version.number)}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {version.number === viewing ? (
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="size-3.5"
                    icon={Tick02Icon}
                    strokeWidth={2}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  version.number === viewing
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                Version {version.number}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {version.commit}
              </span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                {version.number === latest
                  ? "Latest"
                  : format.dateTime(version.createdAt, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {isOld && viewed ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onRestore(viewed.number)}>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3.5"
                  icon={ArrowTurnBackwardIcon}
                  strokeWidth={2}
                />
                Go back to version {viewed.number}
                <span className="text-muted-foreground ml-auto text-xs">
                  New commit
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPick(latest)}>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3.5"
                  icon={ArrowUp02Icon}
                  strokeWidth={2}
                />
                Show latest
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The post. With changes shown, what the latest request rewrote reads as a
 * diff; selecting text offers the chat's own Annotate.
 */
function PostBody({
  findingId,
  title,
  version,
  latest,
  working,
  showChanges,
  fresh: arrivedNow,
}: {
  findingId: string;
  title: string;
  version: PostVersion;
  latest: boolean;
  working: boolean;
  showChanges: boolean;
  /** It just arrived while this post was open: play the entrance. */
  fresh: boolean;
}) {
  const quote = useChatQuote();
  const container = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const diff = latest && showChanges;
  const fresh = diff && arrivedNow;
  const order = new Map(version.changed.map((index, rank) => [index, rank]));

  // A fresh version brings its first change into view, wherever it is.
  useEffect(() => {
    if (!fresh) {
      return;
    }
    const first = container.current?.querySelector("[data-changed]");
    first?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [fresh, reduceMotion, version.number]);

  return (
    <div
      className={cn(
        "space-y-4 text-base/7 transition-opacity duration-300",
        working && "opacity-40"
      )}
      data-chat-quote-post-id={findingId}
      data-chat-quote-post-title={title}
      data-chat-quote-source={quote?.scopeId}
      ref={container}
    >
      {version.blocks.map((block, index) => {
        const rank = order.get(index);
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- playground fixture, a version never reorders its blocks
        const key = `${version.number}-${index}`;
        if (diff && rank !== undefined) {
          return (
            <AutopilotChangedBlock
              after={block}
              animate={fresh && !reduceMotion}
              before={version.before[index] ?? null}
              key={key}
              order={rank}
            />
          );
        }
        return (
          <div key={key}>
            <MessageResponse mode="static">{block}</MessageResponse>
          </div>
        );
      })}
    </div>
  );
}

/** Up/down between the items of the brief, ↑/↓ or J/K from the keyboard. */
export function ItemStepper({
  index,
  count,
  onStep,
  active = true,
}: {
  index: number;
  count: number;
  onStep: (delta: number) => void;
  /** Off while the pane is closed: the keys belong to the page again. */
  active?: boolean;
}) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    // Not while typing, inside an open menu (its own arrows move through
    // it) or with a modifier held.
    if (
      event.defaultPrevented ||
      target?.closest(
        "textarea, input, select, [contenteditable=true], [role=menu], [role=listbox]"
      ) ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return;
    }
    let delta = 0;
    if (event.key === "j" || event.key === "ArrowDown") {
      delta = 1;
    } else if (event.key === "k" || event.key === "ArrowUp") {
      delta = -1;
    }
    if (delta !== 0) {
      // The arrows step through items here instead of scrolling the post.
      event.preventDefault();
      onStep(delta);
    }
  });
  useEffect(() => {
    if (!active) {
      return;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
  return (
    <div className="flex items-center gap-0.5">
      <Button
        aria-label="Previous item"
        disabled={index <= 0}
        onClick={() => onStep(-1)}
        size="icon-sm"
        title="Previous (↑ or K)"
        variant="ghost"
      >
        <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
      </Button>
      <Button
        aria-label="Next item"
        disabled={index >= count - 1}
        onClick={() => onStep(1)}
        size="icon-sm"
        title="Next (↓ or J)"
        variant="ghost"
      >
        <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
      </Button>
      <span className="text-muted-foreground ml-1 text-xs tabular-nums">
        {index + 1} / {count}
      </span>
    </div>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      aria-label="Close"
      onClick={onClose}
      size="icon-sm"
      title="Close (Esc)"
      variant="ghost"
    >
      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
    </Button>
  );
}

/** Top bar of the pane: close and stepper left, the merge call right. */
export function PaneBar({
  finding,
  working = false,
  children,
}: {
  finding: AutopilotFindingView;
  working?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4">
      <div className="flex min-w-0 items-center gap-2">{children}</div>
      {finding.status === "proposed" ? (
        <div className="flex shrink-0 items-center gap-2">
          <AutopilotFindingStatus finding={finding} working={working} />
          <AutopilotMergeMenu
            onClosePullRequest={() => toast("Closed (playground)")}
            onMerge={() => toast.success("Merged (playground)")}
            size="sm"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * What a new version brings: the diff shows again, the version that just
 * arrived plays its entrance, and the finished card stays a few seconds.
 */
function useVersionArrival(latestNumber: number) {
  const [showChanges, setShowChanges] = useState(true);
  const [seenLatest, setSeenLatest] = useState(latestNumber);
  // One already there when the post opened just shows.
  const [arrived, setArrived] = useState<number | null>(null);
  // The result card stays until the next request lands or you switch post,
  // so Undo is there as long as the change is the latest one.
  const [doneFor, setDoneFor] = useState<number | null>(null);
  const [reverted, setReverted] = useState<RevertedCommit | null>(null);
  if (seenLatest !== latestNumber) {
    const grew = latestNumber > seenLatest;
    setSeenLatest(latestNumber);
    setShowChanges(true);
    setArrived(grew ? latestNumber : null);
    setDoneFor(grew ? latestNumber : null);
    if (grew) {
      setReverted(null);
    }
  }
  return {
    showChanges,
    setShowChanges,
    arrived,
    doneFor,
    reverted,
    setReverted,
  };
}
/** The agent's card: working on a request, or done with the latest one. */
function activityFor({
  startedAt,
  latest,
  doneFor,
  reverted,
  finding,
}: {
  startedAt: number | undefined;
  latest: PostVersion;
  doneFor: number | null;
  reverted: RevertedCommit | null;
  finding: AutopilotFindingView;
}): AgentActivity | null {
  if (startedAt !== undefined) {
    return { phase: "working", startedAt };
  }
  const pullRequest = finding.pullRequestNumber
    ? `#${finding.pullRequestNumber}`
    : "the pull request";
  const commitUrl = (sha: string) =>
    finding.pullRequestUrl ? `${finding.pullRequestUrl}/commits/${sha}` : null;
  const git = (verb: string, sha: string, revertedCommit = false) => ({
    verb,
    sha,
    commitUrl: commitUrl(sha),
    pullRequest: finding.pullRequestNumber,
    pullRequestUrl: finding.pullRequestUrl,
    reverted: revertedCommit,
  });
  if (reverted) {
    return {
      phase: "done",
      version: latest.number,
      title: `Reverted ${reverted.commit} on ${pullRequest}`,
      note: `Back to version ${reverted.backTo}.`,
      git: git("Reverted", reverted.commit, true),
    };
  }
  if (doneFor === latest.number) {
    const verb = latest.number === 1 ? "Committed draft" : "Committed";
    return {
      phase: "done",
      version: latest.number,
      title: `${verb} ${latest.commit} to ${pullRequest}`,
      note: latest.note,
      git: git(verb, latest.commit),
      undoLabel: `Revert ${latest.commit}`,
    };
  }
  return null;
}

/**
 * The latest change can be taken back while its card is up; a first draft
 * has no version before it, and a revert is already the way back.
 */
function undoFor(
  {
    latest,
    doneFor,
    reverted,
  }: {
    latest: PostVersion;
    doneFor: number | null;
    reverted: RevertedCommit | null;
  },
  revert: () => void
) {
  return latest.number > 1 && doneFor === latest.number && !reverted
    ? revert
    : undefined;
}

/** A commit Undo took back, and the version that is current again. */
interface RevertedCommit {
  commit: string;
  backTo: number;
}

/** The post to read, scrolling, with the chat composer under it. */
export function PostWorkbench({
  finding,
  revisions,
}: {
  finding: AutopilotFindingView;
  revisions: PostRevisions;
}) {
  const state = revisions.stateFor(finding.id);
  const startedAt = revisions.working[finding.id];
  const working = startedAt !== undefined;
  // The post itself comes from GitHub; until it's here, a skeleton holds its
  // place under the title the brief already knows.
  // A post written just now is already here; the rest come from GitHub.
  const content = useQuery({
    ...postContentQueryOptions(finding.id),
    enabled: state !== null && revisions.written[finding.id] === undefined,
  });
  const {
    showChanges,
    setShowChanges,
    arrived,
    doneFor,
    reverted,
    setReverted,
  } =
    // No post yet counts as version 0, so a first draft arrives like any other.
    useVersionArrival(state?.versions.at(-1)?.number ?? 0);
  if (!state) {
    return <IdeaPane finding={finding} revisions={revisions} />;
  }
  if (content.isLoading) {
    return <PostSkeleton finding={finding} />;
  }
  const latest = state.versions.at(-1);
  const version =
    state.versions.find((item) => item.number === state.viewing) ?? latest;
  if (!(version && latest)) {
    return null;
  }
  const isLatest = version.number === latest.number;
  const activity = activityFor({
    startedAt,
    latest,
    doneFor,
    reverted,
    finding,
  });
  const undo = undoFor({ latest, doneFor, reverted }, () =>
    setReverted(revisions.undo(finding.id))
  );
  // The diff is of the latest request, so it shows on the latest version.
  const hasChanges = isLatest && version.changed.length > 0;
  const diffShown = hasChanges && showChanges;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-4 pb-12">
        <article className="mx-auto max-w-2xl">
          <PostMetaLine finding={finding} />
          <div className="mt-2 flex items-start justify-between gap-4">
            <h2 className="text-2xl/tight font-semibold tracking-tight text-balance">
              {/* A new title reads as the same inline diff as the body. */}
              {diffShown && version.titleBefore ? (
                <AnimatePresence>
                  <AutopilotInlineDiff
                    animate={arrived === version.number}
                    delay={0}
                    runs={diffWords(version.titleBefore, version.title)}
                  />
                </AnimatePresence>
              ) : (
                version.title
              )}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              {hasChanges ? (
                <Button
                  aria-pressed={showChanges}
                  onClick={() => setShowChanges((value) => !value)}
                  size="sm"
                  variant="ghost"
                >
                  {showChanges ? "Hide changes" : "Show changes"}
                </Button>
              ) : null}
              <VersionMenu
                onPick={(number) => revisions.view(finding.id, number)}
                onRestore={(number) => revisions.restore(finding.id, number)}
                versions={state.versions}
                viewing={version.number}
              />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 mb-8 text-base/7 text-pretty">
            {version.description}
          </p>
          <PostBody
            findingId={finding.id}
            latest={isLatest}
            fresh={arrived === version.number}
            showChanges={showChanges}
            title={version.title}
            version={version}
            working={working}
          />
        </article>
      </div>
      <PostFooter
        activity={activity}
        finding={finding}
        onUndo={undo}
        revisions={revisions}
        working={working}
      />
    </div>
  );
}

/**
 * Under the post: the agent's card, the one-tap requests and the composer.
 * `onUndo` is there when the latest version can be taken back.
 */
function PostFooter({
  activity,
  finding,
  onUndo,
  revisions,
  working,
}: {
  activity: AgentActivity | null;
  finding: AutopilotFindingView;
  onUndo: (() => void) | undefined;
  revisions: PostRevisions;
  working: boolean;
}) {
  // A solid footer, so chips never sit on the text; a short fade above it.
  return (
    <div className="bg-background before:from-background relative shrink-0 px-8 pt-1 pb-5 before:pointer-events-none before:absolute before:inset-x-0 before:-top-10 before:h-10 before:bg-linear-to-t before:to-transparent">
      <div className="mx-auto max-w-2xl space-y-2.5">
        {/* The agent's card floats just above the chips, over the end of
          the post, so the chips and the composer stay usable and never
          move. A chip picked while it works queues like a message. */}
        <div className="relative flex min-h-8 items-center">
          <div className="absolute inset-x-0 bottom-full z-10 pb-2">
            <AnimatePresence>
              {activity ? (
                <AgentActivityCard
                  activity={activity}
                  key="activity"
                  onUndo={onUndo}
                />
              ) : null}
            </AnimatePresence>
          </div>
          <AutopilotSuggestionChips
            disabled={false}
            suggestions={AUTOPILOT_REVISION_SUGGESTIONS}
            onPick={(text) => revisions.ask(finding.id, text, null)}
          />
        </div>
        {/* The Ask agent panel's composer: one dualtone card, fixed size,
          so nothing grows under the pointer. No files for a post. */}
        <ChatInput
          attachments={false}
          isLoading={working}
          layout="card"
          surface="card"
          onRemoveQueued={(id) => revisions.unqueue(finding.id, id)}
          onSend={(text) => revisions.ask(finding.id, text, null)}
          placeholder="Ask for changes to the post…"
          queuedMessages={(revisions.queued[finding.id] ?? []).map((entry) => ({
            id: entry.id,
            text: entry.request,
          }))}
        />
      </div>
    </div>
  );
}

/**
 * A post on its way: the kind and title are known from the brief, so they
 * show at once; the description and body are placeholders shaped like a
 * post, and the composer waits below as it will be.
 */
function PostSkeleton({ finding }: { finding: AutopilotFindingView }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        aria-busy="true"
        className="min-h-0 flex-1 overflow-hidden px-8 pt-4 pb-12"
      >
        <span className="sr-only" role="status">
          Loading the post
        </span>
        <article className="mx-auto max-w-2xl">
          <PostMetaLine finding={finding} />
          <h2 className="mt-2 text-2xl/tight font-semibold tracking-tight text-balance">
            {findingDisplayTitle(finding)}
          </h2>
          <div className="mt-3 mb-9 space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="mt-8 mb-4 h-5 w-2/5" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="mt-8 mb-4 h-5 w-1/3" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
          </div>
        </article>
      </div>
      <div className="bg-background relative shrink-0 px-8 pt-1 pb-5">
        <div className="mx-auto max-w-2xl space-y-2.5">
          <div className="min-h-8" />
          <ChatInput
            attachments={false}
            disabled
            layout="card"
            placeholder="Ask for changes to the post…"
            surface="card"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * An idea before it is a post. Messages and chips change the plan; only
 * "Write it" writes the draft, which then writes itself in, section by
 * section, until its pull request opens.
 */
function IdeaPane({
  finding,
  revisions,
}: {
  finding: AutopilotFindingView;
  revisions: PostRevisions;
}) {
  const plan = revisions.planFor(finding.id);
  const draft = ITERATE_DRAFTS[finding.id];
  const writing = revisions.writes[finding.id];
  const planningSince = revisions.planning[finding.id];
  const busy = Boolean(writing) || planningSince !== undefined;
  const arrival = usePlanArrival(plan?.version ?? 1);
  let activity: AgentActivity | null = null;
  let steps = PLAN_STEPS;
  if (writing) {
    activity = {
      phase: "working",
      startedAt: writing.startedAt,
    };
    steps = WRITE_STEPS;
  } else if (planningSince !== undefined) {
    activity = {
      phase: "working",
      startedAt: planningSince,
    };
  } else if (plan && arrival.doneFor === plan.version && plan.previous) {
    activity = {
      phase: "done",
      version: plan.version,
      title: "Plan updated",
      note: plan.note,
    };
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-4 pb-12">
        <article className="mx-auto max-w-2xl">
          <PostMetaLine finding={finding} />
          <h2 className="mt-2 text-2xl/tight font-semibold tracking-tight text-balance">
            {draft?.title ?? finding.title}
          </h2>
          {writing && draft ? (
            <WritingDraft draft={draft} startedAt={writing.startedAt} />
          ) : (
            <IdeaPlan
              fresh={arrival.arrived === plan?.version}
              finding={finding}
              plan={plan}
              planning={planningSince !== undefined}
            />
          )}
        </article>
      </div>
      <div className="bg-background before:from-background relative shrink-0 px-8 pt-1 pb-5 before:pointer-events-none before:absolute before:inset-x-0 before:-top-10 before:h-10 before:bg-linear-to-t before:to-transparent">
        <div className="mx-auto max-w-2xl space-y-2.5">
          <div className="relative flex min-h-8 items-center">
            <div className="absolute inset-x-0 bottom-full z-10 pb-2">
              <AnimatePresence>
                {activity ? (
                  <AgentActivityCard
                    activity={activity}
                    key="idea-activity"
                    onUndo={
                      activity.phase === "done"
                        ? () => {
                            revisions.undoPlan(finding.id);
                            arrival.dismissDone();
                          }
                        : undefined
                    }
                    steps={steps}
                  />
                ) : null}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                disabled={busy}
                onClick={() => revisions.write(finding.id, null)}
                size="sm"
              >
                <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                Write it
              </Button>
              <AutopilotSuggestionChips
                disabled={busy}
                onPick={(text) => revisions.revisePlan(finding.id, text)}
                suggestions={PLAN_SUGGESTIONS}
              />
            </div>
          </div>
          {/* Before anything is written, the composer changes the plan. */}
          <ChatInput
            attachments={false}
            disabled={busy}
            layout="card"
            onSend={(text) => revisions.revisePlan(finding.id, text)}
            placeholder={
              writing
                ? "Ask for changes to the post once it's written"
                : "Ask for changes to the plan…"
            }
            surface="card"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Like `useVersionArrival`, for an idea's plan: the change that just landed
 * plays its entrance and keeps its card a few seconds.
 */
function usePlanArrival(version: number) {
  const [seen, setSeen] = useState(version);
  const [arrived, setArrived] = useState<number | null>(null);
  // Stays until the next change, like the post's card.
  const [doneFor, setDoneFor] = useState<number | null>(null);
  if (seen !== version) {
    setSeen(version);
    setArrived(version);
    setDoneFor(version);
  }
  return { arrived, doneFor, dismissDone: () => setDoneFor(null) };
}
/**
 * Why it's worth writing and what the draft will cover. After a change, the
 * angle reads as an inline diff and new or dropped sections are marked.
 */
function IdeaPlan({
  finding,
  plan,
  planning,
  fresh,
}: {
  finding: AutopilotFindingView;
  plan: PlanState | null;
  planning: boolean;
  fresh: boolean;
}) {
  const reduceMotion = useReducedMotion();
  if (!plan) {
    return (
      <p className="text-muted-foreground mt-2 text-sm text-pretty">
        Nothing is written yet. Write it, and the draft opens right here to read
        and change before you merge.
      </p>
    );
  }
  const { current, previous } = plan;
  // Sections compare by position, so a reworded one reads as a word diff
  // and only the sections past the old end count as new or dropped.
  const dropped = previous?.outline.slice(current.outline.length) ?? [];
  const animate = fresh && !reduceMotion;
  return (
    <>
      <p className="text-muted-foreground mt-2 mb-8 text-base/7 text-pretty">
        {finding.summary}
      </p>
      <section
        aria-busy={planning}
        aria-label="Plan"
        className={cn(
          "space-y-4 transition-opacity duration-300",
          planning && "opacity-40"
        )}
      >
        <p className="text-muted-foreground text-xs font-medium">
          What Autopilot will write
        </p>
        <p className="text-base/7 text-pretty">
          {previous && previous.angle !== current.angle ? (
            <AnimatePresence>
              <AutopilotInlineDiff
                animate={animate}
                delay={0}
                runs={diffWords(previous.angle, current.angle)}
              />
            </AnimatePresence>
          ) : (
            current.angle
          )}
        </p>
        <ol className="space-y-2.5">
          {current.outline.map((section, index) => {
            const before = previous?.outline[index];
            let text: ReactNode = section;
            if (previous && before === undefined) {
              text = (
                <ins className="bg-foreground/[0.08] rounded-sm box-decoration-clone px-0.5 no-underline">
                  {section}
                </ins>
              );
            } else if (before !== undefined && before !== section) {
              text = (
                <AnimatePresence>
                  <AutopilotInlineDiff
                    animate={animate}
                    delay={index * 0.08}
                    runs={diffWords(before, section)}
                  />
                </AnimatePresence>
              );
            }
            return (
              <m.li
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex items-baseline gap-3 text-sm/6"
                initial={
                  animate && before === undefined && previous
                    ? { opacity: 0, filter: "blur(4px)" }
                    : false
                }
                key={section}
                transition={{ duration: 0.4, delay: index * 0.06 }}
              >
                <span className="text-muted-foreground w-4 shrink-0 text-right font-mono text-xs tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0">{text}</span>
              </m.li>
            );
          })}
          {dropped.map((section) => (
            <li
              className="text-muted-foreground/80 flex items-baseline gap-3 text-sm/6"
              key={`dropped-${section}`}
            >
              <span className="w-4 shrink-0" />
              <del className="decoration-muted-foreground/70 decoration-1">
                {section}
              </del>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/**
 * The draft as it is written: the description first, then each block blurs
 * in on its turn, with a shimmering line where the next one will go.
 */
function WritingDraft({
  draft,
  startedAt,
}: {
  draft: IteratePost;
  startedAt: number;
}) {
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, []);
  // Everything lands a little before the pull request opens.
  const total = draft.blocks.length + 1;
  const step = (WRITE_MS * 0.85) / total;
  const shown = Math.min(total, Math.floor((now - startedAt) / step));
  const blocks = draft.blocks.slice(0, Math.max(0, shown - 1));
  const enter = reduceMotion
    ? false
    : { opacity: 0, y: 6, filter: "blur(6px)" };
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        Writing the draft
      </span>
      <AnimatePresence initial={false}>
        {shown > 0 ? (
          <m.p
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="text-muted-foreground mt-2 text-base/7 text-pretty"
            initial={enter}
            key="description"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {draft.description}
          </m.p>
        ) : null}
      </AnimatePresence>
      <div className="mt-8 space-y-4 text-base/7">
        <AnimatePresence initial={false}>
          {blocks.map((block) => (
            <m.div
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              initial={enter}
              key={block}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <MessageResponse mode="static">{block}</MessageResponse>
            </m.div>
          ))}
        </AnimatePresence>
        {shown < total ? (
          <div aria-hidden="true" className="space-y-2.5 pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
