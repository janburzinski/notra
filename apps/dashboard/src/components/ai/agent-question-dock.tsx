"use client";

import { COMPOSER_ELEVATED_SHADOW } from "@notra/ui/constants/composer";
import { useIsApplePlatform } from "@notra/ui/hooks/use-is-apple-platform";
import { tween } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  AGENT_QUESTION_ADVANCE_DELAY_MS,
  AGENT_QUESTION_DOCK_ATTRIBUTE,
  AGENT_QUESTION_ROW_CLASS,
  AGENT_QUESTION_ROW_IDLE_CLASS,
  AGENT_QUESTION_ROW_PICKED_CLASS,
} from "@/constants/agent-questions";
import { useAnimatedSize } from "@/lib/hooks/use-animated-size";
import type {
  AgentQuestionAnswer,
  AgentQuestionFooterProps,
  AgentQuestionProgressProps,
  AgentQuestionDockProps,
  AgentQuestionMarkProps,
  AgentQuestionOptionProps,
  AgentQuestionPaneProps,
} from "@/types/agent-questions";

/**
 * The answer's number, which is also its key: picked, it fills in. Round for
 * a pick-one question, square for pick-all-that-apply.
 */
function Mark({ multiple, picked, number }: AgentQuestionMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "duration-fast flex size-5 shrink-0 items-center justify-center text-xs font-medium tabular-nums ring-1 transition-colors ease-out ring-inset",
        multiple ? "rounded-md" : "rounded-full",
        picked
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-background text-muted-foreground ring-border"
      )}
    >
      {number}
    </span>
  );
}

function Option({
  label,
  description,
  multiple,
  picked,
  shortcut,
  onPick,
  ref,
}: AgentQuestionOptionProps) {
  return (
    <button
      aria-checked={picked}
      aria-keyshortcuts={shortcut <= 9 ? String(shortcut) : undefined}
      className={cn(
        AGENT_QUESTION_ROW_CLASS,
        picked ? AGENT_QUESTION_ROW_PICKED_CLASS : AGENT_QUESTION_ROW_IDLE_CLASS
      )}
      data-question-row=""
      onClick={onPick}
      ref={ref}
      role={multiple ? "checkbox" : "radio"}
      type="button"
    >
      <Mark multiple={multiple} number={shortcut} picked={picked} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm text-pretty">{label}</span>
        {description ? (
          <span className="text-muted-foreground block text-xs text-pretty">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** One question with its answers and a row for your own words. */
function QuestionPane({
  question,
  active,
  titleId,
  picked,
  ownAnswer,
  ownAnswerOn,
  onPick,
  onToggleOwnAnswer,
  onChooseOwnAnswer,
  onOwnAnswerChange,
  onOwnAnswerEnter,
  rowRef,
  ownAnswerRef,
}: AgentQuestionPaneProps) {
  const t = useTranslations("ai.agentQuestion");
  const multiple = question.multiple === true;
  const options = question.options;
  const pickedLabels = new Set(picked);

  return (
    <div
      aria-hidden={!active}
      className={cn(
        "flex min-w-0 flex-col transition motion-reduce:transition-none",
        // The shown question sets the height; the one you leave lifts out of
        // the flow and fades as the next fades in, a beat later.
        active
          ? "duration-normal relative opacity-100 blur-none delay-75 ease-out"
          : "duration-fast pointer-events-none absolute inset-x-0 top-0 opacity-0 blur-xs ease-in"
      )}
      inert={!active}
    >
      <div className="space-y-1 px-4 pb-3">
        <p className="text-sm font-medium text-pretty" id={titleId}>
          {question.question}
        </p>
        <p className="text-muted-foreground text-xs">
          {multiple ? t("pickMany") : t("pickOne")}
        </p>
      </div>
      <div
        aria-labelledby={titleId}
        className="flex flex-col gap-1.5 px-3"
        role={multiple ? "group" : "radiogroup"}
      >
        {options.map((option, index) => (
          <Option
            description={option.description}
            key={option.label}
            label={option.label}
            multiple={multiple}
            onPick={() => onPick(option.label)}
            picked={pickedLabels.has(option.label)}
            ref={rowRef ? (element) => rowRef(index, element) : undefined}
            shortcut={index + 1}
          />
        ))}
        {/* There is always a way to answer in your own words. */}
        <div
          className={cn(
            AGENT_QUESTION_ROW_CLASS,
            "items-center py-1.5",
            ownAnswerOn
              ? AGENT_QUESTION_ROW_PICKED_CLASS
              : AGENT_QUESTION_ROW_IDLE_CLASS
          )}
        >
          <button
            aria-checked={ownAnswerOn}
            aria-label={t("useOwnAnswer")}
            className="focus-visible:ring-ring/50 -my-1 flex shrink-0 rounded-full py-1 outline-none focus-visible:ring-2"
            data-question-row=""
            onClick={onToggleOwnAnswer}
            ref={
              rowRef ? (element) => rowRef(options.length, element) : undefined
            }
            role={multiple ? "checkbox" : "radio"}
            type="button"
          >
            <Mark
              multiple={multiple}
              number={options.length + 1}
              picked={ownAnswerOn}
            />
          </button>
          <input
            aria-label={t("customPlaceholder")}
            className="placeholder:text-foreground/80 h-7 min-w-0 flex-1 bg-transparent text-sm outline-none"
            onChange={(event) => onOwnAnswerChange(event.target.value)}
            onFocus={() => {
              if (!ownAnswerOn) {
                onChooseOwnAnswer();
              }
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.repeat &&
                !event.nativeEvent.isComposing &&
                !(event.metaKey || event.ctrlKey)
              ) {
                event.preventDefault();
                onOwnAnswerEnter();
              }
            }}
            placeholder={t("customPlaceholder")}
            ref={ownAnswerRef}
            value={ownAnswer}
          />
        </div>
      </div>
    </div>
  );
}

/** Which question of several is showing, with a dot to jump to each. */
function QuestionProgress({
  questions,
  tab,
  answered,
  onGo,
}: AgentQuestionProgressProps) {
  const t = useTranslations("ai.agentQuestion");
  const total = questions.length;
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-4 pt-1">
      <span className="text-muted-foreground text-xs tabular-nums">
        {total > 1 ? t("progress", { current: tab + 1, total }) : t("title")}
      </span>
      {total > 1 ? (
        <div className="flex items-center">
          {questions.map((item, index) => (
            <button
              aria-current={index === tab ? "step" : undefined}
              aria-label={t("questionNumber", { number: index + 1 })}
              className="focus-visible:ring-ring/50 flex h-5 items-center justify-center rounded px-0.5 outline-none focus-visible:ring-2"
              key={item.question}
              onClick={() => onGo(index)}
              type="button"
            >
              <span
                className={cn(
                  "duration-fast h-1 w-3.5 rounded-full transition-colors ease-out",
                  index === tab && "bg-foreground/70",
                  index !== tab && answered(index) && "bg-primary",
                  index !== tab && !answered(index) && "bg-border"
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuestionFooter({
  last,
  canSubmit,
  onBack,
  onNext,
  onDismiss,
}: AgentQuestionFooterProps) {
  const t = useTranslations("ai.agentQuestion");
  const shortcut = useIsApplePlatform() ? "⌘" : "Ctrl";
  return (
    <footer className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
      <Button
        aria-keyshortcuts="Escape"
        onClick={onDismiss}
        size="sm"
        variant="ghost"
      >
        {t("dismiss")}
      </Button>
      <div className="flex items-center gap-2">
        {onBack ? (
          <Button onClick={onBack} size="sm" variant="outline">
            {t("back")}
          </Button>
        ) : null}
        <Button
          aria-keyshortcuts="Meta+Enter Control+Enter"
          disabled={last && !canSubmit}
          onClick={onNext}
          size="sm"
          variant={last ? "default" : "outline"}
        >
          {last ? t("submit") : t("next")}
          <span aria-hidden="true" className="text-xs opacity-60">
            {shortcut}↵
          </span>
        </Button>
      </div>
    </footer>
  );
}

/**
 * The agent's questions, shown where the chat input was: pick an option or
 * write your own, step through several, then submit. Every question is laid
 * out in the same spot, so the dock is as tall as the longest one and keeps
 * that height while you step through them.
 */
export function AgentQuestionDock({
  questions,
  onSubmit,
  onDismiss,
  elevated = false,
  className,
}: AgentQuestionDockProps) {
  const t = useTranslations("ai.agentQuestion");
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  // The panel takes the height of the question on show, smoothly.
  const { ref: contentRef, size } = useAnimatedSize();
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState<AgentQuestionAnswer[]>(() =>
    questions.map(() => [])
  );
  const [custom, setCustom] = useState<string[]>(() => questions.map(() => ""));
  const [customOn, setCustomOn] = useState<boolean[]>(() =>
    questions.map(() => false)
  );
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef<(HTMLElement | null)[]>([]);
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const advanceTimerRef = useRef<number | undefined>(undefined);

  const total = questions.length;
  const question = questions[Math.min(tab, total - 1)];
  const multiple = question?.multiple === true;
  const last = tab >= total - 1;
  const options = question?.options ?? [];

  const answersFor = (index: number) => {
    const own = custom[index]?.trim() ?? "";
    return [...(picked[index] ?? []), ...(customOn[index] && own ? [own] : [])];
  };
  const answered = (index: number) => answersFor(index).length > 0;
  const anyAnswered = questions.some((_, index) => answered(index));

  // Arriving questions take the keyboard from the input they replace, but
  // never from something else the user is typing in.
  useEffect(() => {
    const active = document.activeElement;
    // The input they replace is being hidden, so it counts as nothing.
    if (!active || active === document.body || active.closest("[hidden]")) {
      sectionRef.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), []);

  const update = <T,>(
    setter: (updater: (current: T[]) => T[]) => void,
    value: T
  ) =>
    setter((current) =>
      current.map((item, index) => (index === tab ? value : item))
    );

  // The panel keeps the keyboard (numbers, arrows, ⌘↵) without drawing a
  // focus ring on an answer nobody chose.
  const focusPanel = () =>
    window.requestAnimationFrame(() =>
      sectionRef.current?.focus({ preventScroll: true })
    );

  const go = (next: number) => {
    window.clearTimeout(advanceTimerRef.current);
    rowsRef.current = [];
    setTab(next);
    focusPanel();
  };

  const pick = (label: string) => {
    const current = picked[tab] ?? [];
    if (multiple) {
      update(
        setPicked,
        current.includes(label)
          ? current.filter((item) => item !== label)
          : [...current, label]
      );
      return;
    }
    update(setPicked, [label]);
    update(setCustomOn, false);
    // A pick-one question needs one answer, so it moves on once the pick has
    // shown. The last one waits for Submit.
    if (!last) {
      const from = tab;
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = window.setTimeout(() => {
        rowsRef.current = [];
        setTab((current) => (current === from ? from + 1 : current));
        focusPanel();
      }, AGENT_QUESTION_ADVANCE_DELAY_MS);
    }
  };

  const chooseOwnAnswer = () => {
    window.clearTimeout(advanceTimerRef.current);
    update(setCustomOn, true);
    if (!multiple) {
      update(setPicked, []);
    }
    customInputRef.current?.focus();
  };

  /** In a pick-many question, your own answer checks and unchecks like the rest. */
  const toggleOwnAnswer = () => {
    if (multiple && customOn[tab]) {
      update(setCustomOn, false);
      return;
    }
    chooseOwnAnswer();
  };

  const advance = () => {
    if (!last) {
      go(tab + 1);
      return;
    }
    if (anyAnswered) {
      window.clearTimeout(advanceTimerRef.current);
      onSubmit(questions.map((_, index) => answersFor(index)));
    }
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    // A held key would race through every question.
    if (event.isComposing || event.repeat) {
      return;
    }
    const typing = event.target === customInputRef.current;
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      advance();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      // A surrounding dialog would close on the same Escape otherwise.
      event.stopPropagation();
      if (typing) {
        rowsRef.current[options.length]?.focus();
        return;
      }
      window.clearTimeout(advanceTimerRef.current);
      onDismiss();
      return;
    }
    if (typing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const rows = rowsRef.current.slice(0, options.length + 1);
    const at = rows.indexOf(document.activeElement as HTMLElement);
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < options.length) {
        event.preventDefault();
        pick(options[index]?.label ?? "");
        rows[index]?.focus();
      } else if (index === options.length) {
        event.preventDefault();
        toggleOwnAnswer();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      rows[Math.max(0, Math.min(rows.length - 1, at + step))]?.focus();
    }
  });

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) {
      return;
    }
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    element.addEventListener("keydown", listener);
    return () => element.removeEventListener("keydown", listener);
  }, []);

  if (!question) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "bg-background border-border/70 flex max-h-[min(30rem,calc(100svh-20rem))] min-h-0 w-full flex-col rounded-3xl border outline-none",
        "duration-normal opacity-100 transition-opacity ease-out motion-reduce:transition-none starting:opacity-0",
        elevated && COMPOSER_ELEVATED_SHADOW,
        className
      )}
      ref={sectionRef}
      tabIndex={-1}
      {...{ [AGENT_QUESTION_DOCK_ATTRIBUTE]: "" }}
    >
      <QuestionProgress
        answered={answered}
        onGo={go}
        questions={questions}
        tab={tab}
      />

      <LazyMotion features={domAnimation} strict>
        <m.div
          // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the panel eases between two questions' heights, a short bounded change; a transform would squash the text
          animate={{ height: size?.height ?? "auto" }}
          className="min-h-0 overflow-y-auto"
          initial={false}
          transition={
            reduceMotion ? { duration: 0 } : tween("normal", "emphasized")
          }
        >
          <div className="relative" ref={contentRef}>
            {questions.map((item, index) => {
              const active = index === tab;
              return (
                <QuestionPane
                  active={active}
                  key={item.question}
                  onChooseOwnAnswer={chooseOwnAnswer}
                  onOwnAnswerChange={(value) => {
                    update(setCustom, value);
                    if (!customOn[tab]) {
                      update(setCustomOn, true);
                      if (!multiple) {
                        update(setPicked, []);
                      }
                    }
                  }}
                  onOwnAnswerEnter={advance}
                  onPick={pick}
                  onToggleOwnAnswer={toggleOwnAnswer}
                  ownAnswer={custom[index] ?? ""}
                  ownAnswerOn={customOn[index] === true}
                  ownAnswerRef={
                    active
                      ? (element) => {
                          customInputRef.current = element;
                        }
                      : undefined
                  }
                  picked={picked[index] ?? []}
                  question={item}
                  rowRef={
                    active
                      ? (row, element) => {
                          rowsRef.current[row] = element;
                        }
                      : undefined
                  }
                  titleId={active ? titleId : undefined}
                />
              );
            })}
          </div>
        </m.div>
      </LazyMotion>

      <QuestionFooter
        canSubmit={anyAnswered}
        last={last}
        onBack={tab > 0 ? () => go(tab - 1) : undefined}
        onDismiss={() => {
          window.clearTimeout(advanceTimerRef.current);
          onDismiss();
        }}
        onNext={advance}
      />
    </section>
  );
}
