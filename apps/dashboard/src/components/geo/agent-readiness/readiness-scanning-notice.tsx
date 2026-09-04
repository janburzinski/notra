import { AiScanIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { stripWebsiteProtocol } from "@notra/geo-core/utils/geo-website";
import { Shimmer } from "@notra/ui/components/ai-elements/shimmer";

import { Button } from "@/components/button";
import { StatusSpinner } from "@/components/geo/status-spinner";
import type { AgentReadinessScanningNoticeProps } from "@/types/agent-readiness";

export function AgentReadinessScanningNotice({
  targetUrl,
  canRetry = false,
  isRetrying = false,
  onRetry,
}: AgentReadinessScanningNoticeProps) {
  const domain = targetUrl ? stripWebsiteProtocol(targetUrl) : null;

  return (
    <div
      aria-busy="true"
      aria-label={
        domain ? `Running the first scan for ${domain}` : "Running the first scan"
      }
      aria-live="polite"
      className="flex min-h-[28rem] items-center justify-center px-6 py-12 text-center"
    >
      <div className="flex max-w-xl flex-col items-center">
        <div aria-hidden="true" className="relative mb-5">
          <div className="bg-card pointer-events-none absolute bottom-px left-0 size-14 origin-bottom-left -translate-x-0.5 scale-[0.84] -rotate-[10deg] rounded-xl border" />
          <div className="bg-card pointer-events-none absolute right-0 bottom-px size-14 origin-bottom-right translate-x-0.5 scale-[0.84] rotate-[10deg] rounded-xl border" />
          <div className="bg-card text-foreground relative flex size-14 items-center justify-center rounded-xl border shadow-sm/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_rgba(0,0,0,0.04)] dark:before:shadow-[0_-1px_rgba(255,255,255,0.06)]">
            <HugeiconsIcon icon={AiScanIcon} size={24} strokeWidth={1.75} />
          </div>
        </div>
        <h2 className="flex items-center justify-center gap-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          <span className="flex size-5 shrink-0 items-center justify-center [&>span]:size-4">
            <StatusSpinner />
          </span>
          <Shimmer as="span">Running your first scan</Shimmer>
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg text-base leading-relaxed text-pretty">
          Checking how AI agents understand{" "}
          {domain ? (
            <strong className="text-foreground font-medium break-all">
              {domain}
            </strong>
          ) : (
            "your website"
          )}
          . This can take a few minutes.
        </p>
        {canRetry ? (
          <Button
            className="mt-5"
            disabled={isRetrying}
            onClick={onRetry}
            size="sm"
            variant="outline"
          >
            {isRetrying ? "Restarting…" : "Restart setup"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
