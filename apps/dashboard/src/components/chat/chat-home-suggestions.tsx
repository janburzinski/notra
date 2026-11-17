"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { EASE } from "@notra/ui/lib/motion";
import { LazyMotion, m, useReducedMotion } from "motion/react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CHAT_HOME_SUGGESTION_COUNT } from "@/constants/chat-suggestions";
import { localStorageKeys } from "@/constants/storage";
import { useStoredDismissal } from "@/lib/hooks/use-stored-dismissal";
import type {
  ChatHomeSuggestionsProps,
  ChatPromptSuggestion,
} from "@/types/components/chat-suggestions";

const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((module) => module.default);

const SKELETON_KEYS = Array.from(
  { length: CHAT_HOME_SUGGESTION_COUNT },
  (_, index) => `skeleton-${index}`
);

function SuggestionCard({
  suggestion,
  disabled,
  showSource,
  onSelect,
}: {
  suggestion: ChatPromptSuggestion;
  disabled: boolean;
  showSource: boolean;
  onSelect: (prompt: string) => void;
}) {
  const t = useTranslations("chat.suggestions.sources");
  return (
    <button
      className="border-table-card-border bg-table-card shadow-table-card hover:bg-muted/30 disabled:hover:bg-table-card focus-visible:ring-ring/50 duration-fast flex h-full w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={() => onSelect(suggestion.prompt)}
      type="button"
    >
      <span className="bg-background text-muted-foreground ring-foreground/10 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1">
        <HugeiconsIcon
          className="size-4"
          icon={suggestion.icon}
          strokeWidth={1.75}
        />
      </span>
      {/* Every line is single so all cards match the skeleton height and the
          composer doesn't move when suggestions load. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className="text-foreground min-w-0 truncate text-sm font-medium tracking-tight"
            title={suggestion.title}
          >
            {suggestion.title}
          </span>
          {showSource ? (
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {t(suggestion.source)}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {suggestion.description}
        </span>
      </span>
    </button>
  );
}

export function ChatHomeSuggestions({
  suggestions,
  heading,
  isLoading,
  disabled = false,
  hidden = false,
  onSelect,
}: ChatHomeSuggestionsProps) {
  const t = useTranslations("chat.suggestions");
  const reduceMotion = useReducedMotion();
  const { dismissed, dismiss } = useStoredDismissal(
    localStorageKeys.chatSuggestionsDismissed
  );

  if (dismissed || (!isLoading && suggestions.length === 0)) {
    return null;
  }

  const itemDisabled = disabled || hidden;
  // Only label cards when some are personal; on an empty workspace every
  // card is a starter and the label would just repeat.
  const showSource = suggestions.some((item) => item.source !== "starter");

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <m.section
        animate={
          reduceMotion
            ? undefined
            : { opacity: hidden ? 0 : 1, y: hidden ? -2 : 0 }
        }
        aria-busy={isLoading}
        aria-hidden={hidden}
        aria-label={t("ariaLabel")}
        className="w-full"
        inert={hidden}
        initial={false}
        transition={{ duration: 0.25, ease: EASE.out }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          {isLoading ? (
            <Skeleton className="h-3 w-28" />
          ) : (
            <p className="text-muted-foreground min-w-0 truncate text-xs font-medium">
              {heading}
            </p>
          )}
          <Button
            aria-label={t("dismiss")}
            disabled={itemDisabled}
            onClick={dismiss}
            size="icon-xs"
            variant="ghost"
          >
            <HugeiconsIcon
              className="text-muted-foreground size-3.5"
              icon={Cancel01Icon}
            />
          </Button>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SKELETON_KEYS.map((key) => (
              <Skeleton className="h-16 rounded-xl" key={key} />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <m.li
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                className="min-w-0"
                initial={reduceMotion ? undefined : { opacity: 0, y: 4 }}
                key={suggestion.id}
                transition={{
                  duration: 0.3,
                  delay: index * 0.04,
                  ease: EASE.out,
                }}
              >
                <SuggestionCard
                  disabled={itemDisabled}
                  onSelect={onSelect}
                  showSource={showSource}
                  suggestion={suggestion}
                />
              </m.li>
            ))}
          </ul>
        )}
      </m.section>
    </LazyMotion>
  );
}
