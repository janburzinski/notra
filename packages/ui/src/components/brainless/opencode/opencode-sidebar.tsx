import { OPENCODE_COLORS } from "@notra/ui/constants/brainless-opencode";
import type { OpencodeSidebarProps } from "@notra/ui/types/brainless-opencode";
import { cn } from "@notra/ui/lib/utils";
import type { CSSProperties } from "react";

const DEFAULT_SERVERS: NonNullable<OpencodeSidebarProps["servers"]> = [
  { name: "notra", status: "Connected" },
  { name: "github", status: "Connected" },
  { name: "linear", status: "Connected" },
];

export function OpencodeSidebar({
  title = "New session",
  tokens = "26,167 tokens",
  used = "7% used",
  spent = "$0.00 spent",
  servers = DEFAULT_SERVERS,
  cwd = "~/acme/web",
  version = "1.18.25",
  className,
}: OpencodeSidebarProps) {
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col border-l px-4 py-4 font-mono text-[12px] leading-[1.45]",
        className
      )}
      style={{ borderColor: OPENCODE_COLORS.subtle, color: OPENCODE_COLORS.foreground }}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-5 font-semibold">Context</div>
      <div style={{ color: OPENCODE_COLORS.muted }}>{tokens}</div>
      <div style={{ color: OPENCODE_COLORS.muted }}>{used}</div>
      <div style={{ color: OPENCODE_COLORS.muted }}>{spent}</div>

      <details className="group mt-5" open>
        <summary
          className="flex cursor-pointer list-none items-center gap-2 font-semibold outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--opencode-purple)]/60 [&::-webkit-details-marker]:hidden"
          style={{ "--opencode-purple": OPENCODE_COLORS.purple } as CSSProperties}
        >
          <span
            aria-hidden
            className="inline-block text-[8px] transition-transform group-open:rotate-90"
          >
            ▶
          </span>
          MCP
        </summary>
        <div className="mt-1 space-y-0.5">
          {servers.map((server) => {
            const status = server.status ?? "Connected";
            let indicatorColor: string = OPENCODE_COLORS.muted;

            if (status === "Connected") {
              indicatorColor = OPENCODE_COLORS.green;
            } else if (status === "Error") {
              indicatorColor = OPENCODE_COLORS.orange;
            }

            return (
              <div className="flex min-w-0 items-baseline gap-2" key={server.name}>
                <span aria-hidden style={{ color: indicatorColor }}>
                  •
                </span>
                <span className="truncate">{server.name}</span>
                <span className="truncate" style={{ color: OPENCODE_COLORS.muted }}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      </details>

      <div className="mt-5 font-semibold">LSP</div>
      <div style={{ color: OPENCODE_COLORS.muted }}>LSPs are disabled</div>

      <div className="mt-auto pt-8">
        <div>{cwd}</div>
        <div className="mt-5 flex items-center gap-2">
          <span aria-hidden style={{ color: OPENCODE_COLORS.green }}>•</span>
          <span className="font-semibold" style={{ color: OPENCODE_COLORS.muted }}>
            OpenCode
          </span>
          <span style={{ color: OPENCODE_COLORS.muted }}>{version}</span>
        </div>
      </div>
    </aside>
  );
}
