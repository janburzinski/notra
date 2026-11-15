"use client";

import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";
import { TRANSITION } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useTranslations } from "use-intl";

import { AgentLoader } from "@/components/icons/agent-loader";
import type { ChatActivityStatusProps } from "@/types/components/chat-activity-group";
import { formatElapsedSeconds } from "@/utils/format-elapsed-seconds";

export function ChatActivityStatus({
  children,
  seconds,
  label,
  active = true,
}: ChatActivityStatusProps) {
  const tCommon = useTranslations("common");
  const reduceMotion = useReducedMotion();
  const resolvedLabel = label ?? tCommon("labels.thinkingLabel");
  return (
    <span className="text-muted-foreground inline-flex min-h-5 items-center gap-2 text-sm leading-5">
      <LazyMotion features={domMax}>
        <AgentLoader
          active={active}
          className={cn(
            "size-3.5 transition-colors duration-300",
            active ? "text-foreground/75" : "text-subtle-foreground"
          )}
        />
        <span className="relative inline-flex h-5 items-center overflow-hidden">
          <span className="sr-only" role="status">
            {resolvedLabel}
          </span>
          {/* The labels roll like an odometer: each moves a full line, so the
              old one has left the clipped line before the new one is read,
              instead of the two overlapping half way. */}
          <AnimatePresence initial={false} mode="popLayout">
            <m.span
              aria-hidden="true"
              className="inline-flex h-5 items-center whitespace-nowrap"
              key={active ? resolvedLabel : "done"}
              initial={{
                opacity: 0,
                transform: reduceMotion ? "none" : "translateY(100%)",
              }}
              animate={{
                opacity: 1,
                transform: reduceMotion ? "none" : "translateY(0%)",
              }}
              exit={{
                opacity: 0,
                transform: reduceMotion ? "none" : "translateY(-100%)",
              }}
              transition={TRANSITION.enter}
            >
              {active ? (
                <Shimmer as="span">{resolvedLabel}</Shimmer>
              ) : (
                resolvedLabel
              )}
            </m.span>
          </AnimatePresence>
        </span>
        <m.span
          className="inline-flex h-5 shrink-0 items-center gap-1"
          layout={reduceMotion ? false : "position"}
          transition={TRANSITION.enter}
        >
          {active ? (
            <span
              aria-hidden="true"
              className="font-mono text-sm leading-5 tabular-nums"
            >
              {formatElapsedSeconds(seconds)}
            </span>
          ) : null}
          {children}
        </m.span>
      </LazyMotion>
    </span>
  );
}
