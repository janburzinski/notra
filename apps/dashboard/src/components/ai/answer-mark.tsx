import { cn } from "@notra/ui/lib/utils";

import type { AgentQuestionMarkProps } from "@/types/agent-questions";

/**
 * An answer's number, which is also its key: picked, it fills in. Round for
 * a pick-one choice, square for pick-all-that-apply. The agent's questions
 * and tool approvals both use it; approvals draw it square. It switches
 * without a fade: mid-fade the number and its fill share a colour and the
 * number disappears.
 */
export function AnswerMark({
  className,
  multiple = false,
  picked,
  number,
}: AgentQuestionMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center text-xs font-medium tabular-nums ring-1 ring-inset",
        multiple ? "rounded-md" : "rounded-full",
        picked
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-background text-muted-foreground ring-border",
        className
      )}
    >
      {number}
    </span>
  );
}
