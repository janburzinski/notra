import { OPENCODE_COLORS } from "@notra/ui/constants/brainless-opencode";
import type { OpencodeMessageProps } from "@notra/ui/types/brainless-opencode";
import { cn } from "@notra/ui/lib/utils";

export function OpencodeMessage({
  from = "assistant",
  className,
  children,
}: OpencodeMessageProps) {
  if (from === "user") {
    return (
      <div
        className={cn(
          "border-l-2 px-4 py-3 font-mono text-[13px] leading-[1.6]",
          className
        )}
        style={{
          borderColor: OPENCODE_COLORS.purple,
          background: OPENCODE_COLORS.surface,
          color: OPENCODE_COLORS.foreground,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn("font-mono text-[13px] leading-[1.65]", className)}
      style={{ color: OPENCODE_COLORS.foreground }}
    >
      {children}
    </div>
  );
}
