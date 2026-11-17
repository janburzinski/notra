"use client";

import {
  ArrowTurnBackwardIcon,
  GitCommitIcon,
  GitPullRequestIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { Badge } from "@notra/ui/components/ui/badge";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  animate,
  m,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { type RefObject, useEffect, useRef, useState } from "react";

import { Button } from "@/components/button";
import { AgentLoader } from "@/components/icons/agent-loader";
import { formatElapsedSeconds } from "@/utils/format-elapsed-seconds";

/**
 * What the agent is doing, in turn. The playground cycles them; the real
 * thing would name the agent's actual steps as they happen.
 */
const WORKING_STEPS = [
  "Reading your request",
  "Rereading the draft",
  "Rewriting the post",
  "Tightening the intro",
  "Dillydallying",
  "Asking the founding intern",
  "Checking it reads well",
  "Hunting for typos",
  "Arguing about commas",
  "Founding intern is on it",
  "Polishing the headline",
  "Making it sound like you",
  "Dillydallying, but productively",
  "Updating the pull request",
];
const WORKING_STEP_MS = 4000;

/** Text swaps: the old line leaves up, the new one rises in under it. */
const SWAP = { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as const;

/** Milliseconds since `startedAt`, refreshed a few times a second. */
function useElapsedMs(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, now - startedAt);
}

/**
 * The status mark. Working, the chat's own agent loader. Done, a disc
 * grows in its place and a check is drawn into it.
 */
function ActivityMark({ done, git }: { done: boolean; git?: GitResult }) {
  return (
    <span
      aria-hidden="true"
      className="text-foreground relative grid size-4 shrink-0 place-items-center"
    >
      <AnimatePresence initial={false}>
        {done && git ? (
          <m.span
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            className="col-start-1 row-start-1 grid place-items-center"
            initial={{ scale: 0.4, opacity: 0, rotate: -90 }}
            key={git.reverted ? "reverted" : "commit"}
            transition={{ duration: 0.4, ease: [0.34, 1.4, 0.64, 1] }}
          >
            <HugeiconsIcon
              className="size-4"
              icon={git.reverted ? ArrowTurnBackwardIcon : GitCommitIcon}
              strokeWidth={2}
            />
          </m.span>
        ) : null}
        {done && !git ? (
          <m.svg
            animate={{ scale: 1, opacity: 1 }}
            className="col-start-1 row-start-1 size-4 overflow-visible"
            initial={{ scale: 0.4, opacity: 0 }}
            key="done"
            transition={{ duration: 0.35, ease: [0.34, 1.4, 0.64, 1] }}
            viewBox="0 0 16 16"
          >
            <circle cx="8" cy="8" fill="currentColor" r="7.25" />
            <m.path
              animate={{ pathLength: 1 }}
              className="stroke-background"
              d="M5.1 8.3 L7.1 10.2 L10.9 6.1"
              fill="none"
              initial={{ pathLength: 0 }}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
              transition={{ duration: 0.3, delay: 0.25 }}
            />
          </m.svg>
        ) : null}
        {done ? null : (
          <m.span
            className="col-start-1 row-start-1"
            exit={{ opacity: 0, scale: 0.6 }}
            key="working"
            transition={{ duration: 0.2 }}
          >
            <AgentLoader className="text-foreground/75 size-4" />
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * A faint dotted light in the card's corner, like the glow of something
 * working underneath. It drifts while the agent works, flares once when the
 * result lands, and follows the pointer while you hover the card.
 */
function ActivityGlow({
  done,
  hovering,
  x,
  y,
  glowRef,
}: {
  done: boolean;
  /** While the pointer is over the card the light sits under it. */
  hovering: boolean;
  /** Offsets from the light's resting corner, written by the card. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  glowRef: RefObject<HTMLDivElement | null>;
}) {
  const reduceMotion = useReducedMotion();
  let animate: Record<string, number | number[]> = {
    opacity: [0.35, 0.6, 0.35],
    x: [-24, 16, -24],
  };
  if (hovering) {
    animate = { opacity: 0.9, x: 0 };
  } else if (done) {
    animate = { opacity: [0.55, 1, 0.35], x: 0 };
  } else if (reduceMotion) {
    animate = { opacity: 0.5 };
  }
  return (
    <m.div
      aria-hidden="true"
      className="pointer-events-none absolute -top-10 right-0 h-28 w-2/3"
      ref={glowRef}
      style={{ x, y }}
    >
      <m.div
        animate={animate}
        className="size-full"
        initial={false}
        style={{
          backgroundImage:
            "radial-gradient(circle at 35% 45%, rgb(94 234 212 / 0.55), transparent 60%), radial-gradient(circle at 70% 55%, rgb(147 197 253 / 0.45), transparent 62%), radial-gradient(circle at 55% 35%, rgb(253 186 116 / 0.3), transparent 55%)",
          // Only the dots of a fine grid show the light, fading at the edges.
          maskImage:
            "radial-gradient(circle, #000 0.75px, transparent 0.9px), radial-gradient(closest-side, #000, transparent)",
          maskSize: "4px 4px, 100% 100%",
          maskComposite: "intersect",
          WebkitMaskImage:
            "radial-gradient(circle, #000 0.75px, transparent 0.9px), radial-gradient(closest-side, #000, transparent)",
          WebkitMaskSize: "4px 4px, 100% 100%",
          WebkitMaskComposite: "source-in",
        }}
        transition={
          hovering || (done && !reduceMotion)
            ? {
                duration: hovering ? 0.3 : 1.4,
                times: hovering ? undefined : [0, 0.3, 1],
                ease: "easeOut",
              }
            : {
                duration: 5,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
    </m.div>
  );
}

/** One line that swaps its text with a short rise and blur. */
function SwapLine({
  text,
  className,
  shimmer = false,
}: {
  text: string;
  className?: string;
  shimmer?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const travel = reduceMotion ? "0%" : "100%";
  return (
    <span className={cn("relative grid min-w-0 overflow-hidden", className)}>
      <AnimatePresence initial={false}>
        <m.span
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          className="col-start-1 row-start-1 truncate"
          exit={{ y: `-${travel}`, opacity: 0, filter: "blur(3px)" }}
          initial={{ y: travel, opacity: 0, filter: "blur(3px)" }}
          key={text}
          transition={SWAP}
        >
          {shimmer ? <Shimmer as="span">{text}</Shimmer> : text}
        </m.span>
      </AnimatePresence>
    </span>
  );
}

/** A commit the agent pushed or reverted on a pull request. */
interface GitResult {
  /** "Committed", "Committed draft" or "Reverted". */
  verb: string;
  sha: string;
  commitUrl: string | null;
  pullRequest: number | null;
  pullRequestUrl: string | null;
  reverted?: boolean;
}

export type AgentActivity =
  | { phase: "working"; startedAt: number }
  | {
      phase: "done";
      version: number;
      note: string | null;
      title?: string;
      /** What happened on the pull request's branch, shown like git. */
      git?: GitResult;
      /** What Undo says it does, e.g. "Revert a1b2c3d". */
      undoLabel?: string;
    };

/**
 * The card's first line: the step it's on while working (each request
 * starts somewhere else in the list, so two posts side by side don't say
 * the same thing, and the step changes half a second off the seconds'
 * tick), or the result once it's done.
 */
function activityTitle(
  activity: AgentActivity,
  steps: string[],
  elapsed: number
) {
  if (activity.phase === "done") {
    return (
      activity.title ??
      (activity.version === 1
        ? "Draft is ready"
        : `Version ${activity.version} is ready`)
    );
  }
  const offset = Math.floor(activity.startedAt / 1000) % steps.length;
  const step = Math.floor((elapsed + 500) / WORKING_STEP_MS);
  return steps[(offset + step) % steps.length] ?? "";
}

/**
 * The result's second line: what changed and the commit it went into. The
 * card grows by this line at once (no animated resize); the note fades in.
 */
function DoneNote({
  activity,
}: {
  activity: Extract<AgentActivity, { phase: "done" }>;
}) {
  return (
    <m.p
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="text-muted-foreground relative mt-1 pl-6.5 text-sm"
      initial={{ opacity: 0, filter: "blur(3px)" }}
      transition={{ ...SWAP, delay: 0.15 }}
    >
      {activity.note ?? "The post is updated."}
    </m.p>
  );
}

/**
 * The result as git says it: the verb, the commit as a mono chip and the
 * pull request as the same green badge the brief uses. Both link to GitHub.
 */
function GitTitle({ git }: { git: GitResult }) {
  const sha = (
    <span className="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">
      {git.sha}
    </span>
  );
  return (
    <m.span
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium"
      initial={{ opacity: 0, filter: "blur(3px)" }}
      transition={SWAP}
    >
      {git.verb}
      {git.commitUrl ? (
        <a
          className="rounded-md transition-opacity hover:opacity-80"
          href={git.commitUrl}
          rel="noreferrer"
          target="_blank"
        >
          {sha}
        </a>
      ) : (
        sha
      )}
      {git.pullRequest ? (
        <>
          <span className="text-muted-foreground font-normal">
            {git.reverted ? "on" : "to"}
          </span>
          <Badge
            render={
              git.pullRequestUrl ? (
                <a
                  aria-label={`Pull request #${git.pullRequest}`}
                  href={git.pullRequestUrl}
                  rel="noreferrer"
                  target="_blank"
                />
              ) : undefined
            }
            shape="rounded"
            size="sm"
            variant="success"
          >
            <HugeiconsIcon icon={GitPullRequestIcon} strokeWidth={2} />
            <span className="tabular-nums">#{git.pullRequest}</span>
          </Badge>
        </>
      ) : null}
    </m.span>
  );
}

/**
 * What the agent is doing with this post, floating just above the composer:
 * the step it's on and what you asked while it works, then the new version
 * with what changed and a way to take it back.
 */
export function AgentActivityCard({
  activity,
  onUndo,
  steps = WORKING_STEPS,
}: {
  activity: AgentActivity;
  /** Absent where there is nothing to go back to, like a first draft. */
  onUndo?: () => void;
  /** What the working line cycles through. */
  steps?: string[];
}) {
  const done = activity.phase === "done";
  const elapsed = useElapsedMs(done ? null : activity.startedAt);
  const seconds = Math.floor(elapsed / 1000);
  const reduceMotion = useReducedMotion();
  const [hovering, setHovering] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);
  const title = activityTitle(activity, steps, elapsed);
  return (
    <m.div
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      className="bg-popover text-popover-foreground shadow-table-card relative overflow-hidden rounded-xl border px-3 py-2.5 dark:shadow-lg"
      exit={{ opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)" }}
      initial={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" }}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => {
        setHovering(false);
        // Back to its corner gently; following the pointer has no delay.
        animate(glowX, 0, { type: "spring", stiffness: 260, damping: 30 });
        animate(glowY, 0, { type: "spring", stiffness: 260, damping: 30 });
      }}
      onPointerMove={(event) => {
        const glow = glowRef.current;
        if (!glow || reduceMotion) {
          return;
        }
        // Straight into the motion values: no render, no easing, so the
        // light stays under the pointer.
        const rect = event.currentTarget.getBoundingClientRect();
        glowX.stop();
        glowY.stop();
        glowX.set(
          event.clientX - rect.left - (glow.offsetLeft + glow.offsetWidth / 2)
        );
        glowY.set(
          event.clientY - rect.top - (glow.offsetTop + glow.offsetHeight / 2)
        );
      }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <ActivityGlow
        done={done}
        glowRef={glowRef}
        hovering={hovering}
        x={glowX}
        y={glowY}
      />
      <span className="sr-only" role="status">
        {title}
      </span>
      {/* The title is announced once by the status above; Undo stays
          reachable. */}
      <div className="relative flex items-center gap-2.5">
        <ActivityMark
          done={done}
          git={activity.phase === "done" ? activity.git : undefined}
        />
        <span aria-hidden="true" className="min-w-0 flex-1">
          {activity.phase === "done" && activity.git ? (
            <GitTitle git={activity.git} />
          ) : (
            <SwapLine
              className="text-sm font-medium"
              shimmer={!done}
              text={title}
            />
          )}
        </span>
        <span className="relative grid h-6 shrink-0 items-center">
          <AnimatePresence initial={false}>
            {done && onUndo ? (
              <m.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="col-start-1 row-start-1 justify-self-end"
                initial={{ opacity: 0, filter: "blur(3px)" }}
                key="undo"
                transition={{ ...SWAP, delay: 0.5 }}
              >
                <Button
                  aria-label={
                    done
                      ? (activity.undoLabel ??
                        `Undo version ${activity.version}`)
                      : undefined
                  }
                  title={done ? activity.undoLabel : undefined}
                  onClick={onUndo}
                  size="xs"
                  variant="ghost"
                >
                  <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
                  Undo
                </Button>
              </m.span>
            ) : null}
            {done ? null : (
              <m.span
                aria-hidden="true"
                className="text-muted-foreground col-start-1 row-start-1 justify-self-end font-mono text-xs tabular-nums"
                exit={{ opacity: 0, filter: "blur(3px)" }}
                key="seconds"
              >
                {formatElapsedSeconds(seconds)}
              </m.span>
            )}
          </AnimatePresence>
        </span>
      </div>
      {/* Working, the card is one line: the step and the seconds, which is
          all that is known until it's done. The result adds its note. */}
      {activity.phase === "done" ? <DoneNote activity={activity} /> : null}
    </m.div>
  );
}
