"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  MessageResponse,
  type MessageResponseProps,
} from "@notra/ui/components/ai-elements/message";
import { AnimatePresence, m } from "motion/react";

import type { AutopilotRevisionSuggestion } from "@/types/autopilot-revisions";
import {
  type DiffRun,
  type DiffWord,
  diffWords,
  isPlainParagraph,
} from "@/utils/inline-diff";

/** Changed blocks come in one after another, this far apart. */
const STAGGER_S = 0.25;
/** New words write themselves in, this far apart. */
const WORD_S = 0.03;

const INLINE_CODE = "rounded bg-muted px-1.5 py-0.5 font-mono text-sm";

function DiffText({ word }: { word: DiffWord }) {
  if (word.code) {
    return <code className={INLINE_CODE}>{word.text}</code>;
  }
  return word.bold ? <strong>{word.text}</strong> : word.text;
}

/**
 * A rewrite read like a doc's suggestion mode: the sentence flows as one,
 * removed words faintly struck through, new words on a soft neutral highlight.
 * Fresh, the new words write themselves in one after another.
 */
export function AutopilotInlineDiff({
  runs,
  animate,
  delay,
}: {
  runs: DiffRun[];
  animate: boolean;
  delay: number;
}) {
  // Where each added run's first word falls in the order new words appear.
  const firstAdded: number[] = [];
  let count = 0;
  for (const run of runs) {
    firstAdded.push(count);
    if (run.kind === "added") {
      count += run.words.length;
    }
  }
  return (
    <>
      {runs.map((run, runIndex) => {
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- a diff's runs are fixed for its version
        const key = runIndex;
        if (run.kind === "same") {
          return (
            <span key={key}>
              {run.words.map((word, index) => (
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- words have no ids; their order is the text
                <DiffText key={index} word={word} />
              ))}
            </span>
          );
        }
        if (run.kind === "removed") {
          return (
            <m.del
              animate={{ opacity: 1 }}
              className="text-muted-foreground/80 decoration-muted-foreground/70 line-through decoration-1"
              initial={animate ? { opacity: 0 } : false}
              key={key}
              transition={{ duration: 0.3, delay }}
            >
              {run.words.map((word, index) => (
                // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- words have no ids; their order is the text
                <DiffText key={index} word={word} />
              ))}
            </m.del>
          );
        }
        return (
          <ins
            className="bg-foreground/[0.08] text-foreground rounded-[3px] box-decoration-clone px-0.5 no-underline"
            key={key}
          >
            {run.words.map((word, index) => {
              const at =
                delay + 0.15 + ((firstAdded[runIndex] ?? 0) + index) * WORD_S;
              return (
                <m.span
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  initial={
                    animate ? { opacity: 0, filter: "blur(4px)" } : false
                  }
                  // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- words have no ids; their order is the text
                  key={index}
                  transition={{ duration: 0.35, delay: at }}
                >
                  <DiffText word={word} />
                </m.span>
              );
            })}
          </ins>
        );
      })}
    </>
  );
}

/**
 * One changed block. A rewritten paragraph shows its diff inline; anything
 * else that is new or rewritten (a heading, a table, code) shows as it is
 * now. Either way a thin grey bar marks it in the margin.
 */
export function AutopilotChangedBlock({
  before,
  after,
  order,
  animate,
  components,
}: {
  before: string | null;
  after: string;
  order: number;
  animate: boolean;
  /** The post's own renderers, such as its images from the pull request. */
  components?: MessageResponseProps["components"];
}) {
  const delay = order * STAGGER_S;
  const inline =
    before !== null && isPlainParagraph(before) && isPlainParagraph(after);
  // Its own presence boundary: the pane sits in an AnimatePresence with
  // initial={false}, which would otherwise mute this entrance too.
  return (
    <AnimatePresence>
      <div
        className="before:bg-foreground/20 relative before:absolute before:inset-y-1 before:-left-4 before:w-0.5 before:rounded-full"
        data-changed=""
      >
        {inline ? (
          <p className="message-response wrap-anywhere">
            <AutopilotInlineDiff
              animate={animate}
              delay={delay}
              runs={diffWords(before, after)}
            />
          </p>
        ) : (
          <m.div
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            initial={
              animate ? { opacity: 0, y: 6, filter: "blur(6px)" } : false
            }
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
          >
            <MessageResponse components={components} mode="static">
              {after}
            </MessageResponse>
          </m.div>
        )}
      </div>
    </AnimatePresence>
  );
}

/** A block the latest change removed outright, struck through where it was. */
export function AutopilotRemovedBlock({
  markdown,
  components,
}: {
  markdown: string;
  components?: MessageResponseProps["components"];
}) {
  return (
    <del
      className="before:bg-foreground/20 text-muted-foreground/80 decoration-muted-foreground/70 relative block line-through decoration-1 before:absolute before:inset-y-1 before:-left-4 before:w-0.5 before:rounded-full"
      data-changed=""
    >
      <MessageResponse components={components} mode="static">
        {markdown}
      </MessageResponse>
    </del>
  );
}

/** One-tap requests above the composer, styled like the chat's suggestions. */
export function AutopilotSuggestionChips({
  disabled,
  onPick,
  suggestions,
}: {
  disabled: boolean;
  onPick: (text: string) => void;
  suggestions: readonly AutopilotRevisionSuggestion[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((suggestion) => (
        <button
          className="bg-muted/70 hover:bg-muted text-foreground duration-normal inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium tracking-tight transition-colors disabled:pointer-events-none disabled:opacity-50"
          disabled={disabled}
          key={suggestion.label}
          onClick={() => onPick(suggestion.label)}
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
            icon={suggestion.icon}
          />
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
