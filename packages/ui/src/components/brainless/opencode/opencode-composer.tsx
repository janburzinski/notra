"use client";

import { OPENCODE_COLORS } from "@notra/ui/constants/brainless-opencode";
import type { OpencodeComposerProps } from "@notra/ui/types/brainless-opencode";
import { cn } from "@notra/ui/lib/utils";

export function OpencodeComposer({
  value,
  defaultValue = "",
  onChange,
  onKeyDown,
  placeholder = 'Ask anything... "Fix a TODO in the codebase"',
  agent = "Build",
  model = "GPT-5.6 Sol",
  provider = "OpenAI",
  effort = "low",
  context,
  className,
  inputClassName,
  ref,
}: OpencodeComposerProps) {
  const controlled = value !== undefined;

  return (
    <div className={cn("min-w-0 font-mono", className)}>
      <div
        className="border-l-2 px-4 pt-3 pb-2"
        style={{
          borderColor: OPENCODE_COLORS.purple,
          background: OPENCODE_COLORS.surface,
        }}
      >
        <input
          aria-label="Prompt"
          className={cn(
            "w-full min-w-0 bg-transparent text-[13px] leading-6 outline-none",
            "placeholder:text-[#929292]",
            inputClassName
          )}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          ref={ref}
          type="text"
          {...(controlled ? { value, onChange } : { defaultValue, onChange })}
          style={{ color: OPENCODE_COLORS.foreground, caretColor: OPENCODE_COLORS.foreground }}
        />
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 text-[12px] leading-5">
          <span style={{ color: OPENCODE_COLORS.purple }}>{agent}</span>
          <span style={{ color: OPENCODE_COLORS.muted }}>·</span>
          <span style={{ color: OPENCODE_COLORS.foreground }}>{model}</span>
          <span style={{ color: OPENCODE_COLORS.muted }}>{provider}</span>
          <span style={{ color: OPENCODE_COLORS.muted }}>·</span>
          <span className="font-semibold" style={{ color: OPENCODE_COLORS.orange }}>
            {effort}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-4 px-4 pt-2 text-[11px]">
        <span style={{ color: OPENCODE_COLORS.muted }}>
          <span style={{ color: OPENCODE_COLORS.foreground }}>tab</span> agents
          <span className="ml-4" style={{ color: OPENCODE_COLORS.foreground }}>
            ctrl+p
          </span>{" "}
          commands
        </span>
        {context ? <span style={{ color: OPENCODE_COLORS.muted }}>{context}</span> : null}
      </div>
    </div>
  );
}
