"use client";

import { GEO_CHAT_SKIN_SURFACE } from "@notra/geo-core/constants/geo";
import type {
  GeoPromptReceiptView,
  GeoPromptResultSummary,
} from "@notra/geo-core/types/geo";
import { engineFamilyLabel } from "@notra/geo-core/utils/geo-engine-family";
import { geoScanEmptyMessage } from "@notra/geo-core/utils/geo-scan";
import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";

import { EngineIcon } from "@/components/geo/engine-icon";
import { GeoPromptAnswerSkeleton } from "@/components/geo/geo-prompt-answer-skeleton";
import { PromptAnswerContent } from "@/components/geo/prompt-answer-content";
import { PromptDetailStatus } from "@/components/geo/prompt-detail-status";
import { PromptReceiptViewSwitch } from "@/components/geo/prompt-receipt-view-switch";
import {
  useGeoPromptHistory,
  useGeoPromptResultDetail,
} from "@/lib/hooks/use-geo";
import { useGeoCompetitorsDb } from "@/lib/hooks/use-geo-db";
import { cn } from "@/lib/utils";
import type { GeoGapAnswerPanelProps } from "@/types/components/geo-gaps";
import { geoChatSkin } from "@/utils/geo-chat-skin";
import { geoPromptDetailState } from "@/utils/geo-prompt-detail";
import {
  latestPromptResults,
  promptOutcomeLabel,
  promptPositionLabel,
} from "@/utils/geo-prompt-history";

/** Engines that already mention you lead, so the strip reads as a scoreboard. */
function byVisibility(
  left: GeoPromptResultSummary,
  right: GeoPromptResultSummary
): number {
  if (left.mentioned !== right.mentioned) {
    return left.mentioned ? -1 : 1;
  }
  return engineFamilyLabel(left.engine).localeCompare(
    engineFamilyLabel(right.engine)
  );
}

function outcomeDetail(result: GeoPromptResultSummary): string {
  const outcome = promptOutcomeLabel(result.mentioned, result.ownedSourceCited);
  return result.mentioned
    ? `${outcome} · ${promptPositionLabel(result.position)}`
    : outcome;
}

function EngineStrip({
  results,
  activeEngine,
  onSelect,
}: {
  results: readonly GeoPromptResultSummary[];
  activeEngine: string;
  onSelect: (engine: string) => void;
}) {
  return (
    <div className="bg-muted/20 flex shrink-0 flex-wrap items-center gap-1 border-b px-4 py-2.5">
      {results.map((result) => (
        <button
          aria-label={`${engineFamilyLabel(result.engine)} — ${outcomeDetail(result)}`}
          aria-pressed={result.engine === activeEngine}
          className={cn(
            "relative inline-flex size-8 items-center justify-center rounded-lg border transition-colors",
            result.engine === activeEngine
              ? "bg-background border-border shadow-xs"
              : "hover:bg-background/60 border-transparent",
            result.mentioned ? undefined : "opacity-45"
          )}
          key={result.engine}
          onClick={() => onSelect(result.engine)}
          title={`${engineFamilyLabel(result.engine)} — ${outcomeDetail(result)}`}
          type="button"
        >
          <EngineIcon className="size-4" engine={result.engine} />
          {result.mentioned ? (
            <span className="bg-geo-up ring-muted/20 absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

/**
 * The gap sheet's body: which engines mention you, and what the engine you
 * picked actually answered. The numbers already live in the table row, so the
 * sheet carries the answer instead of repeating them.
 */
export function GapAnswerPanel({
  organizationId,
  promptId,
  prompt,
  isScanning,
}: GeoGapAnswerPanelProps) {
  const [engine, setEngine] = useState("");
  const [view, setView] = useState<GeoPromptReceiptView>("analysis");
  const history = useGeoPromptHistory(organizationId, promptId, {
    enabled: Boolean(organizationId),
  });
  const results = latestPromptResults(
    [],
    history.data?.checks ?? [],
    promptId,
    prompt
  ).sort(byVisibility);
  const active = results.find((row) => row.engine === engine) ?? results[0];
  const detail = useGeoPromptResultDetail(
    organizationId,
    active?.checkId ?? null
  );
  const { competitors } = useGeoCompetitorsDb(organizationId);
  const detailState = geoPromptDetailState(
    active?.checkId ?? null,
    detail.data,
    detail.isError,
    history.status
  );

  if (history.isPending) {
    return <GeoPromptAnswerSkeleton view={view} />;
  }

  if (history.isError) {
    return <PromptDetailStatus onRetry={history.refetch} status="error" />;
  }

  if (!active) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center px-6">
        <p className="text-muted-foreground text-center text-sm text-pretty">
          {geoScanEmptyMessage(
            isScanning,
            "Run a scan to see how engines answer this"
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <EngineStrip
        activeEngine={active.engine}
        onSelect={setEngine}
        results={results}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <EngineIcon className="size-4 shrink-0" engine={active.engine} />
          <span className="truncate">{engineFamilyLabel(active.engine)}</span>
          <Badge variant={active.mentioned ? "success" : "secondary"}>
            {outcomeDetail(active)}
          </Badge>
        </span>
        <PromptReceiptViewSwitch onChange={setView} view={view} />
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          view === "raw"
            ? GEO_CHAT_SKIN_SURFACE[geoChatSkin(active.engine)]
            : undefined
        )}
      >
        <PromptAnswerContent
          competitors={competitors}
          history={[]}
          isHistoryLoading={false}
          key={active.engine}
          onRetry={detail.refetch}
          organizationId={organizationId}
          prompt={prompt}
          scrollable={false}
          showHistory={false}
          state={detailState}
          view={view}
        />
      </div>
    </>
  );
}
