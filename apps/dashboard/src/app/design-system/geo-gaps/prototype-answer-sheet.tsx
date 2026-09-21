"use client";

import type {
  GeoPromptReceiptView,
  GeoPromptResult,
} from "@notra/geo-core/types/geo";
import { engineFamilyLabel } from "@notra/geo-core/utils/geo-engine-family";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@notra/ui/components/ui/sheet";
import { useState } from "react";

import { Button } from "@/components/button";
import { EngineIcon } from "@/components/geo/engine-icon";
import { PromptAnswerContent } from "@/components/geo/prompt-answer-content";
import { PromptReceiptViewSwitch } from "@/components/geo/prompt-receipt-view-switch";
import {
  DESIGN_SYSTEM_GAP_RESULTS,
  DESIGN_SYSTEM_PROMPT_GAP,
} from "@/constants/design-system-gaps";
import { cn } from "@/lib/utils";

function outcomeLabel(result: GeoPromptResult): string {
  if (!result.mentioned) {
    return "Not mentioned";
  }
  return result.position === null
    ? "Mentions you"
    : `Mentions you · #${result.position}`;
}

export function PrototypeAnswerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const results = DESIGN_SYSTEM_GAP_RESULTS;
  const [engine, setEngine] = useState(results[0]?.engine ?? "");
  const [view, setView] = useState<GeoPromptReceiptView>("analysis");
  const active = results.find((row) => row.engine === engine) ?? results[0];
  const mentioning = results.filter((row) => row.mentioned).length;

  if (!active) {
    return null;
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent side="right" variant="inset">
        <SheetHeader className="bg-muted/50 shrink-0 gap-1.5 border-b pr-14">
          <Badge variant="secondary">Prompt gap</Badge>
          <SheetTitle className="text-base leading-snug text-balance break-words">
            {DESIGN_SYSTEM_PROMPT_GAP.prompt}
          </SheetTitle>
          <SheetDescription>
            {mentioning} of {results.length} engines mention you
          </SheetDescription>
        </SheetHeader>

        <div className="bg-muted/20 flex shrink-0 flex-wrap items-center gap-1 border-b px-4 py-2.5">
          {results.map((row) => (
            <button
              aria-label={`View ${engineFamilyLabel(row.engine)} answer — ${outcomeLabel(row)}`}
              aria-pressed={row.engine === active.engine}
              className={cn(
                "relative inline-flex size-8 items-center justify-center rounded-lg border transition-colors",
                row.engine === active.engine
                  ? "bg-background border-border shadow-xs"
                  : "hover:bg-background/60 border-transparent",
                row.mentioned ? undefined : "opacity-45"
              )}
              key={row.engine}
              onClick={() => setEngine(row.engine)}
              title={`${engineFamilyLabel(row.engine)} — ${outcomeLabel(row)}`}
              type="button"
            >
              <EngineIcon className="size-4" engine={row.engine} />
              {row.mentioned ? (
                <span className="bg-geo-up ring-muted/20 absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <EngineIcon className="size-4 shrink-0" engine={active.engine} />
            <span className="truncate">{engineFamilyLabel(active.engine)}</span>
            <Badge variant={active.mentioned ? "success" : "secondary"}>
              {outcomeLabel(active)}
            </Badge>
          </span>
          <PromptReceiptViewSwitch onChange={setView} view={view} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <PromptAnswerContent
            history={[]}
            isHistoryLoading={false}
            key={active.engine}
            onRetry={() => undefined}
            prompt={DESIGN_SYSTEM_PROMPT_GAP.prompt}
            scrollable={false}
            showHistory={false}
            state={{ status: "ready", result: active }}
            view={view}
          />
        </div>

        <SheetFooter className="shrink-0 flex-row justify-end border-t p-4">
          <Button variant="ghost">Ignore</Button>
          <Button>Write</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
