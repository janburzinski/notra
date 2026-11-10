"use client";

import { cva } from "class-variance-authority";
import type { MouseEvent } from "react";
import { useState } from "react";

import { CopyStateIcon } from "@notra/ui/components/ui/copy-button";
import { ClaudeAiIcon } from "@notra/ui/components/ui/svgs/claudeAiIcon";
import { Grok } from "@notra/ui/components/ui/svgs/grok";
import { GrokDark } from "@notra/ui/components/ui/svgs/grokDark";
import { Openai } from "@notra/ui/components/ui/svgs/openai";
import { OpenaiDark } from "@notra/ui/components/ui/svgs/openaiDark";
import { useCopyToClipboard } from "@notra/ui/hooks/use-copy-to-clipboard";
import { cn } from "@notra/ui/lib/utils";
import type {
  AgentLogoStackProps,
  AgentPromptButtonProps,
  AgentPromptSwapLabelProps,
} from "@notra/ui/types/agent-prompt-button";

// Solid circles, so each logo covers the one to its left.
const LOGO_CLASSNAME =
  "bg-background border-foreground/15 relative grid shrink-0 place-items-center rounded-full border";

const LOGO_SIZES = {
  default: { circle: "size-7", overlap: "-ms-2", icon: "size-3.5" },
  sm: { circle: "size-6", overlap: "-ms-1.5", icon: "size-3" },
} as const;

// Same label swap as CopyButton: the old label leaves upwards, the new one
// rises in 70ms later.
const SWAP_IN_CLASSNAME = "animate-button-swap-in [animation-delay:70ms]";
const SWAP_OUT_CLASSNAME = "animate-button-swap-out";

const agentPromptButtonVariants = cva(
  "duration-fast flex cursor-pointer items-center overflow-hidden rounded-full border bg-background font-medium outline-none transition-[background-color,color,scale] ease-out focus-visible:ring-2 active:scale-[0.97] motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default:
          "border-border text-foreground hover:bg-muted focus-visible:ring-ring/50",
        sidebar:
          "w-full border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring",
      },
      size: {
        default: "h-9 gap-2 ps-1 pe-3 text-sm",
        sm: "h-8 gap-2 ps-1 pe-3 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function AgentLogoStack({ size }: AgentLogoStackProps) {
  const { circle, overlap, icon } = LOGO_SIZES[size];
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      <span className={cn(LOGO_CLASSNAME, circle)}>
        <ClaudeAiIcon className={icon} />
      </span>
      <span className={cn(LOGO_CLASSNAME, circle, overlap)}>
        <Openai className={cn(icon, "dark:hidden")} />
        <OpenaiDark className={cn(icon, "hidden dark:block")} />
      </span>
      <span className={cn(LOGO_CLASSNAME, circle, overlap)}>
        <Grok className={cn(icon, "dark:hidden")} />
        <GrokDark className={cn(icon, "hidden dark:block")} />
      </span>
    </span>
  );
}

function SwapLabel({
  copied,
  animate,
  label,
  copiedLabel,
}: AgentPromptSwapLabelProps) {
  const labelAnimation = copied ? SWAP_OUT_CLASSNAME : SWAP_IN_CLASSNAME;
  const copiedAnimation = copied ? SWAP_IN_CLASSNAME : SWAP_OUT_CLASSNAME;

  return (
    <span className="grid min-w-0 flex-1 text-start">
      <span
        aria-hidden={copied}
        className={cn(
          "col-start-1 row-start-1 truncate motion-reduce:animate-none",
          animate && labelAnimation,
          copied && "opacity-0"
        )}
      >
        {label}
      </span>
      <span
        aria-hidden={!copied}
        className={cn(
          "col-start-1 row-start-1 motion-reduce:animate-none",
          animate && copiedAnimation,
          !copied && "opacity-0"
        )}
      >
        {copiedLabel}
      </span>
    </span>
  );
}

/**
 * Pill that copies a prompt for a coding agent: the agent logos, a label that
 * swaps to `copiedLabel`, and a copy icon that turns into a tick.
 */
export function AgentPromptButton({
  prompt,
  label,
  copiedLabel,
  onCopy,
  onCopyError,
  onClick,
  className,
  variant,
  size = "default",
  ...props
}: AgentPromptButtonProps) {
  const { copied, copy } = useCopyToClipboard({ onError: onCopyError });
  const [hasCopied, setHasCopied] = useState(false);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || !(await copy(prompt))) {
      return;
    }
    setHasCopied(true);
    onCopy?.();
  }

  return (
    <button
      aria-label={copied ? copiedLabel : label}
      className={cn(agentPromptButtonVariants({ variant, size }), className)}
      data-slot="agent-prompt-button"
      type="button"
      {...props}
      onClick={handleClick}
    >
      <AgentLogoStack size={size} />
      <SwapLabel
        animate={hasCopied}
        copied={copied}
        copiedLabel={copiedLabel}
        label={label}
      />
      <span className="text-muted-foreground shrink-0">
        <CopyStateIcon
          copied={copied}
          iconClassName="size-3.5"
        />
      </span>
    </button>
  );
}
