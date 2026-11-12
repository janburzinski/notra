"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { useState } from "react";

import { hasRunningTransition } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";

const LOADING_DOTS = [
  { bounce: "[animation-delay:0ms]", enter: "delay-0" },
  { bounce: "[animation-delay:140ms]", enter: "delay-40" },
  { bounce: "[animation-delay:280ms]", enter: "delay-80" },
] as const;

/**
 * The label and the dots swap with transitions rather than keyframes, so a
 * swap that reverses halfway picks up from where it is instead of restarting.
 * 200ms in, 150ms out.
 */
const SWAP_TRANSITION_CLASS_NAME =
  "transition-[opacity,translate,filter] duration-200 ease-out";
const SWAP_HIDDEN_CLASS_NAME =
  "opacity-0 blur-[4px] duration-150 motion-safe:-translate-y-[0.45em]";
const SWAP_FROM_BELOW_CLASS_NAME =
  "starting:opacity-0 starting:blur-[4px] motion-safe:starting:translate-y-[0.45em]";
const SWAP_FROM_SHOWN_CLASS_NAME =
  "starting:opacity-100 starting:blur-none motion-safe:starting:translate-y-0";

function useLoadingSwap(loading: boolean) {
  const [previousLoading, setPreviousLoading] = useState(loading);
  const [isSwapping, setIsSwapping] = useState(false);
  if (loading !== previousLoading) {
    setPreviousLoading(loading);
    setIsSwapping(true);
  }
  return { finishSwap: () => setIsSwapping(false), isSwapping };
}

function useProgressCompletion(hasProgress: boolean) {
  const [previousHasProgress, setPreviousHasProgress] = useState(hasProgress);
  const [isCompleting, setIsCompleting] = useState(false);
  if (hasProgress !== previousHasProgress) {
    setPreviousHasProgress(hasProgress);
    setIsCompleting(!hasProgress);
  }
  return { finishCompletion: () => setIsCompleting(false), isCompleting };
}

function ButtonProgress({
  completing,
  onFaded,
  value,
}: {
  completing: boolean;
  onFaded: () => void;
  value: number;
}) {
  return (
    <ProgressPrimitive.Root
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        completing && "animate-button-progress-out"
      )}
      data-slot="button-progress"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          onFaded();
        }
      }}
      render={<span />}
      value={value}
    >
      <ProgressPrimitive.Track
        className="absolute inset-0 overflow-hidden"
        render={<span />}
      >
        <ProgressPrimitive.Indicator
          className="absolute inset-y-0 start-0 bg-current/15 transition-[width] duration-slow ease-emphasized motion-reduce:transition-none"
          render={<span />}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

function ButtonLoader({
  entering,
  loading,
}: {
  entering: boolean;
  loading: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center gap-[0.2em]",
        SWAP_TRANSITION_CLASS_NAME,
        !loading && SWAP_HIDDEN_CLASS_NAME
      )}
      data-slot="button-loader"
    >
      {LOADING_DOTS.map(({ bounce, enter }) => (
        <span
          className={cn(
            "block",
            SWAP_TRANSITION_CLASS_NAME,
            loading && entering && `${SWAP_FROM_BELOW_CLASS_NAME} ${enter}`
          )}
          key={enter}
        >
          <span
            className={cn(
              "block size-[0.3em] animate-button-dot rounded-full bg-current motion-reduce:animate-none",
              bounce,
              !loading && "[animation-play-state:paused]"
            )}
          />
        </span>
      ))}
    </span>
  );
}

interface ButtonContentProps {
  children?: React.ReactNode;
  loading: boolean;
  progress: number | undefined;
  progressTextId: string;
}

function ButtonContent({
  children,
  loading,
  progress,
  progressTextId,
}: ButtonContentProps) {
  const hasProgress = progress !== undefined;
  const { finishSwap, isSwapping } = useLoadingSwap(loading);
  const { finishCompletion, isCompleting } = useProgressCompletion(hasProgress);
  const showLoader = loading || isSwapping;
  const showProgress = hasProgress || isCompleting;

  return (
    <>
      {showProgress && (
        <ButtonProgress
          completing={isCompleting}
          onFaded={finishCompletion}
          value={progress ?? 100}
        />
      )}
      {hasProgress && (
        <span hidden id={progressTextId}>
          {`${Math.round(progress)}%`}
        </span>
      )}
      {showLoader || showProgress ? (
        <span
          className={cn(
            "relative inline-flex min-w-0 flex-1 items-center [gap:inherit] [justify-content:inherit]",
            SWAP_TRANSITION_CLASS_NAME,
            loading && SWAP_HIDDEN_CLASS_NAME,
            loading && isSwapping && SWAP_FROM_SHOWN_CLASS_NAME
          )}
          data-clip=""
          data-slot="button-label"
          onTransitionCancel={(event) => {
            // A canceled return (e.g. an ancestor switching transitions off)
            // never fires transitionend, so finish the swap here too. A
            // reversed fade also cancels, but its replacement is already
            // running and fires transitionend itself.
            if (
              !loading &&
              event.target === event.currentTarget &&
              event.propertyName === "opacity" &&
              !hasRunningTransition(event.currentTarget, "opacity")
            ) {
              finishSwap();
            }
          }}
          onTransitionEnd={(event) => {
            // The label's return is the longest leg of the swap; once it is
            // back, the wrapper and the dots can go.
            if (
              !loading &&
              event.target === event.currentTarget &&
              event.propertyName === "opacity"
            ) {
              finishSwap();
            }
          }}
        >
          {children}
        </span>
      ) : (
        children
      )}
      {showLoader && (
        <ButtonLoader entering={isSwapping} loading={loading} />
      )}
    </>
  );
}

export { ButtonContent };
