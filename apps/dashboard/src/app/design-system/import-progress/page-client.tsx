"use client";

import { PauseIcon, PlayIcon, ReplayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Slider } from "@notra/ui/components/ui/slider";
import { useIsMobile } from "@notra/ui/hooks/use-mobile";
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ImportProgressFooter } from "@/components/analytics-import/import-progress-parts";
import { ImportProgressView } from "@/components/analytics-import/import-progress-view";
import { ImportProviderMark } from "@/components/analytics-import/import-provider-mark";
import { Button } from "@/components/button";
import { DesignSystemFrame } from "@/components/design-system/design-system-frame";
import { ANALYTICS_IMPORT_PROGRESS_PHASES } from "@/constants/analytics-import-progress";
import { ANALYTICS_IMPORT_PROVIDER_LABELS } from "@/constants/analytics-imports";
import { useImportProgressTitle } from "@/lib/hooks/use-import-progress-title";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { cn } from "@/lib/utils";
import type {
  ImportProgressDialogPreviewProps,
  ImportProgressScenario,
} from "@/types/design-system/import-progress";

import {
  IMPORT_PROGRESS_DEFAULT_SCENARIO,
  IMPORT_PROGRESS_SCENARIOS,
  scenarioFrame,
  scenarioSummary,
} from "./scenarios";

const TICK_MS = 100;
const SCENARIO_IDS = IMPORT_PROGRESS_SCENARIOS.map((entry) => entry.id);
const WIDTHS = ["dialog", "phone"] as const;
/** Inner width of the dialog (`sm:max-w-lg`) and of an iPhone-sized sheet. */
const PREVIEW_WIDTH = { dialog: 512, phone: 390 } as const;

/**
 * The dialog, or at phone width the bottom sheet, as the real one lays out:
 * the sheet pads its header and footer and insets the body by 16px.
 */
function DialogPreview({
  item,
  layout,
  width,
  children,
}: ImportProgressDialogPreviewProps) {
  const progressTitle = useImportProgressTitle();
  const isMobile = useIsMobile();
  const phone = layout === "phone";
  const noop = () => undefined;
  return (
    <div
      className={cn(
        "bg-background ring-foreground/10 flex w-(--preview-width) shrink-0 flex-col gap-4 text-sm shadow-lg ring-1",
        phone ? "rounded-t-xl" : "rounded-xl p-4"
      )}
      style={{ "--preview-width": `${width}px` } as CSSProperties}
    >
      <div className={cn("flex items-start gap-3", phone && "p-4 pe-12")}>
        <ImportProviderMark provider={item.provider} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-sm leading-5 font-medium">
            {progressTitle(item)}
          </p>
          <p className="text-muted-foreground text-sm">
            {ANALYTICS_IMPORT_PROVIDER_LABELS[item.provider]}
          </p>
        </div>
      </div>
      <div className={cn("flex min-w-0 flex-col", phone && "px-4")}>
        {children}
      </div>
      {/* On a phone the footer pads itself; on a desktop it bleeds out of the dialog's padding. */}
      <div className={cn(phone && !isMobile && "px-4 pb-4")}>
        <ImportProgressFooter
          onBack={noop}
          onClose={noop}
          onViewAnalytics={noop}
          phase={ANALYTICS_IMPORT_PROGRESS_PHASES[item.status]}
        />
      </div>
    </div>
  );
}

/** Client-only: the scenario and moment come from the URL, which the server render cannot see. */
function ImportProgressPlayground() {
  const [scenarioId, setScenarioId] = useQueryState(
    "scenario",
    parseAsStringLiteral(SCENARIO_IDS).withDefault("api")
  );
  const [width, setWidth] = useQueryState(
    "width",
    parseAsStringLiteral(WIDTHS).withDefault("dialog")
  );
  // `?t=7000&play=false` freezes a moment, for screenshots.
  const [startAt] = useQueryState("t", parseAsInteger.withDefault(0));
  const [autoplay] = useQueryState("play", parseAsBoolean.withDefault(true));
  const scenario =
    IMPORT_PROGRESS_SCENARIOS.find((entry) => entry.id === scenarioId) ??
    IMPORT_PROGRESS_DEFAULT_SCENARIO;
  const startElapsed = Math.min(startAt, scenario.duration);
  const [elapsed, setElapsed] = useState(startElapsed);
  const [item, setItem] = useState(() =>
    scenarioSummary(scenario, startElapsed, Date.now())
  );
  const [playing, setPlaying] = useState(autoplay);
  const elapsedRef = useRef(startElapsed);
  const frameRef = useRef({
    scenario: scenario.id,
    frame: scenarioFrame(scenario, startElapsed),
  });

  // Like a poll, the import only changes when the scenario writes something.
  const seek = useCallback((target: ImportProgressScenario, next: number) => {
    elapsedRef.current = next;
    setElapsed(next);
    const frame = scenarioFrame(target, next);
    if (
      frameRef.current.scenario === target.id &&
      frameRef.current.frame === frame
    ) {
      return;
    }
    frameRef.current = { scenario: target.id, frame };
    setItem(scenarioSummary(target, next, Date.now()));
  }, []);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => {
      const next = Math.min(elapsedRef.current + TICK_MS, scenario.duration);
      seek(scenario, next);
      if (next >= scenario.duration) {
        setPlaying(false);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, scenario, seek]);

  const replay = () => {
    seek(scenario, 0);
    setPlaying(true);
  };

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="Scenario"
            className="bg-muted flex flex-wrap gap-0.5 rounded-3xl border p-1 text-xs"
            role="group"
          >
            {IMPORT_PROGRESS_SCENARIOS.map((entry) => (
              <button
                aria-pressed={entry.id === scenario.id}
                className={cn(
                  "text-muted-foreground rounded-full px-3 py-1.5 whitespace-nowrap transition-colors duration-150",
                  entry.id === scenario.id &&
                    "bg-background text-foreground shadow-sm"
                )}
                key={entry.id}
                onClick={() => {
                  setScenarioId(entry.id).catch(() => undefined);
                  seek(entry, 0);
                  setPlaying(true);
                }}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div
            aria-label="Width"
            className="bg-muted flex gap-0.5 rounded-full border p-1 text-xs"
            role="group"
          >
            {WIDTHS.map((entry) => (
              <button
                aria-pressed={entry === width}
                className={cn(
                  "text-muted-foreground rounded-full px-3 py-1.5 whitespace-nowrap transition-colors duration-150",
                  entry === width && "bg-background text-foreground shadow-sm"
                )}
                key={entry}
                onClick={() => {
                  setWidth(entry).catch(() => undefined);
                }}
                type="button"
              >
                {entry === "dialog" ? "Dialog · 512px" : "Phone · 390px"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() =>
              elapsed >= scenario.duration ? replay() : setPlaying(!playing)
            }
            size="icon"
            variant="outline"
          >
            <HugeiconsIcon icon={playing ? PauseIcon : PlayIcon} />
          </Button>
          <Button onClick={replay} variant="outline">
            <HugeiconsIcon icon={ReplayIcon} />
            Replay
          </Button>
          <Slider
            aria-label="Timeline"
            className="max-w-md min-w-48 flex-1"
            max={scenario.duration}
            onValueChange={(value) => {
              setPlaying(false);
              seek(scenario, Array.isArray(value) ? (value[0] ?? 0) : value);
            }}
            step={TICK_MS}
            value={elapsed}
          />
          <span className="text-muted-foreground w-28 text-xs tabular-nums">
            {(elapsed / 1000).toFixed(1)}s /{" "}
            {(scenario.duration / 1000).toFixed(1)}s
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            {item.status} · {item.chunksDone}/{item.chunksTotal}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{scenario.note}</p>
      </section>
      <div
        className="w-(--preview-width) pb-6"
        data-preview="timeline"
        style={
          { "--preview-width": `${PREVIEW_WIDTH[width]}px` } as CSSProperties
        }
      >
        <DialogPreview item={item} layout={width} width={PREVIEW_WIDTH[width]}>
          <ImportProgressView item={item} />
        </DialogPreview>
      </div>
    </>
  );
}

export default function ImportProgressDesignSystemClientPage() {
  const isClient = useIsClient();
  return (
    <DesignSystemFrame
      description="What the history-import dialog shows after “Start import”: a pixel octopus that sways while the import runs and cheers when it's done, above a title and a line on where it is. It is driven by the AnalyticsImportSummary the dashboard polls every 3 seconds; the scenarios replay what the runner writes, one poll at a time."
      title="Import progress"
    >
      {isClient ? <ImportProgressPlayground /> : null}
    </DesignSystemFrame>
  );
}
