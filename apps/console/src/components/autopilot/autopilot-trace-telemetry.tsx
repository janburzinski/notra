import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { cn } from "@notra/ui/lib/utils";
import type { CSSProperties } from "react";

import { AUTOPILOT_FINISH_REASON_LABEL } from "@/constants/autopilot";
import type {
  AutopilotEventDetail,
  AutopilotMark,
  AutopilotSpan,
  AutopilotTelemetry,
  AutopilotTraceTelemetryProps,
} from "@/types/autopilot";
import {
  autopilotTimelineTicks,
  formatAutopilotMs,
  formatAutopilotOffset,
  formatAutopilotTick,
  formatAutopilotTokens,
  packAutopilotSpans,
} from "@/utils/autopilot-telemetry";

const SPAN_CLASS: Record<AutopilotSpan["kind"], string> = {
  agent: "bg-chart-1",
  model: "bg-chart-2",
  step: "bg-background ring-1 ring-inset ring-chart-1",
};

const MARK_CLASS: Record<AutopilotMark["level"], string> = {
  error: "bg-destructive",
  action: "bg-foreground",
  decision: "bg-muted-foreground",
  skip: "bg-muted-foreground",
  info: "bg-muted-foreground/40",
};

function position(telemetry: AutopilotTelemetry, at: number) {
  const total = Math.max(1, telemetry.endMs - telemetry.originMs);
  return ((at - telemetry.originMs) / total) * 100;
}

const MARK_LEVEL_LABEL: Record<AutopilotMark["level"], string> = {
  info: "Note",
  skip: "Skip",
  decision: "Decision",
  action: "Action",
  error: "Error",
};

const SPAN_KIND_LABEL: Record<AutopilotSpan["kind"], string> = {
  agent: "Agent loop",
  model: "Model call",
  step: "Agent step",
};

function share(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : null;
}

function TooltipCard({
  title,
  kind,
  lane,
  rows,
}: {
  title: string;
  kind: string;
  lane: string;
  rows: AutopilotEventDetail[];
}) {
  return (
    <div className="grid gap-1.5 py-1 text-xs">
      <div className="grid gap-0.5">
        <span className="font-medium break-words">{title}</span>
        <span className="text-muted-foreground">
          {kind} · <span className="capitalize">{lane}</span>
        </span>
      </div>
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t pt-1.5">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="break-words tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <span className="text-muted-foreground border-t pt-1.5">
        Click to open the event
      </span>
    </div>
  );
}

function spanRows(
  span: AutopilotSpan,
  telemetry: AutopilotTelemetry
): AutopilotEventDetail[] {
  const durationMs = span.endMs - span.startMs;
  const runShare = share(durationMs, telemetry.endMs - telemetry.originMs);
  const tools = span.tools ?? [];
  const toolCounts = new Map<string, number>();
  for (const tool of tools) {
    toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
  }
  const rows: (AutopilotEventDetail | null)[] = [
    span.model ? { label: "Model", value: span.model } : null,
    {
      label: "Duration",
      value: `${formatAutopilotMs(durationMs)}${runShare ? ` · ${runShare} of the run` : ""}`,
    },
    {
      label: "Time",
      value: `${formatAutopilotOffset(span.startMs - telemetry.originMs)} → ${formatAutopilotOffset(span.endMs - telemetry.originMs)}`,
    },
    span.steps === null
      ? null
      : {
          label: "Steps",
          value: `${span.steps} · ${formatAutopilotMs(durationMs / Math.max(1, span.steps))} each on average`,
        },
    span.inputTokens === null
      ? null
      : {
          label: "Input",
          value: `${span.inputTokens.toLocaleString("en-US")} tokens${
            span.cachedInputTokens
              ? ` · ${formatAutopilotTokens(span.cachedInputTokens)} cached (${share(span.cachedInputTokens, span.inputTokens)})`
              : ""
          }`,
        },
    span.outputTokens === null
      ? null
      : {
          label: "Output",
          value: `${span.outputTokens.toLocaleString("en-US")} tokens${
            span.reasoningTokens
              ? ` · ${formatAutopilotTokens(span.reasoningTokens)} reasoning`
              : ""
          }`,
        },
    // A step's time includes its tools, so speed only means something for calls.
    span.kind === "model" && span.outputTokens && durationMs > 0
      ? {
          label: "Speed",
          value: `${Math.round(span.outputTokens / (durationMs / 1000))} output tokens/s`,
        }
      : null,
    tools.length > 0
      ? {
          label: "Tools",
          value: [...toolCounts]
            .map(([tool, calls]) => (calls > 1 ? `${tool} ×${calls}` : tool))
            .join(", "),
        }
      : null,
    span.kind === "step" && span.tools?.length === 0
      ? { label: "Tools", value: "None, the model answered" }
      : null,
    span.finishReason
      ? {
          label: "Finished",
          value:
            AUTOPILOT_FINISH_REASON_LABEL[span.finishReason] ??
            span.finishReason,
        }
      : null,
    ...span.details,
  ];
  return rows.filter((row) => row !== null);
}

function SpanBar({
  span,
  telemetry,
}: {
  span: AutopilotSpan;
  telemetry: AutopilotTelemetry;
}) {
  const left = position(telemetry, span.startMs);
  const width = position(telemetry, span.endMs) - left;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            aria-label={`${span.label}, ${formatAutopilotMs(span.endMs - span.startMs)}`}
            className={cn(
              "absolute inset-y-0 left-(--at) w-(--span) min-w-0.5 rounded-sm transition-opacity hover:opacity-80",
              SPAN_CLASS[span.kind]
            )}
            href={`#event-${span.eventId}`}
            style={
              { "--at": `${left}%`, "--span": `${width}%` } as CSSProperties
            }
          />
        }
      />
      <TooltipContent className="max-w-sm">
        <TooltipCard
          kind={SPAN_KIND_LABEL[span.kind]}
          lane={span.lane}
          rows={spanRows(span, telemetry)}
          title={
            span.loopSteps ? `${span.label} of ${span.loopSteps}` : span.label
          }
        />
      </TooltipContent>
    </Tooltip>
  );
}

function MarkDot({
  mark,
  telemetry,
}: {
  mark: AutopilotMark;
  telemetry: AutopilotTelemetry;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            aria-label={mark.label}
            className={cn(
              "absolute top-1/2 left-(--at) -translate-x-1/2 -translate-y-1/2 rounded-full",
              mark.minor ? "size-1.5" : "size-2.5",
              MARK_CLASS[mark.level]
            )}
            href={`#event-${mark.eventId}`}
            style={
              { "--at": `${position(telemetry, mark.atMs)}%` } as CSSProperties
            }
          />
        }
      />
      <TooltipContent className="max-w-sm">
        <TooltipCard
          rows={[
            {
              label: "Time",
              value: formatAutopilotOffset(mark.atMs - telemetry.originMs),
            },
            ...mark.details,
          ]}
          kind={MARK_LEVEL_LABEL[mark.level]}
          lane={mark.lane}
          title={mark.label}
        />
      </TooltipContent>
    </Tooltip>
  );
}

function Waterfall({ telemetry }: { telemetry: AutopilotTelemetry }) {
  const ticks = autopilotTimelineTicks(telemetry.endMs - telemetry.originMs);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="grid min-w-[40rem] grid-cols-[7rem_1fr] gap-x-3 p-4">
        <div />
        <div className="text-muted-foreground relative mb-2 h-4 text-xs tabular-nums">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute left-(--at) -translate-x-1/2 whitespace-nowrap first:translate-x-0"
              style={
                {
                  "--at": `${position(telemetry, telemetry.originMs + tick)}%`,
                } as CSSProperties
              }
            >
              {formatAutopilotTick(tick)}
            </span>
          ))}
        </div>
        {telemetry.lanes.map((lane) => {
          const spans = telemetry.spans.filter(
            (span) => span.lane === lane.lane
          );
          const callRows = packAutopilotSpans(
            spans.filter((span) => span.kind !== "step")
          );
          const steps = spans.filter((span) => span.kind === "step");
          const marks = telemetry.marks.filter(
            (mark) => mark.lane === lane.lane
          );
          return (
            <div key={lane.lane} className="contents">
              <div className="border-t py-2 text-sm font-medium capitalize">
                {lane.lane}
              </div>
              <div className="relative grid gap-1 border-t py-2">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    aria-hidden
                    className="bg-border absolute inset-y-0 left-(--at) w-px"
                    style={
                      {
                        "--at": `${position(telemetry, telemetry.originMs + tick)}%`,
                      } as CSSProperties
                    }
                  />
                ))}
                {callRows.map((row) => (
                  <div key={row[0]?.id} className="relative h-3">
                    {row.map((span) => (
                      <SpanBar
                        key={span.id}
                        span={span}
                        telemetry={telemetry}
                      />
                    ))}
                  </div>
                ))}
                {steps.length > 0 ? (
                  <div className="relative h-2">
                    {steps.map((span) => (
                      <SpanBar
                        key={span.id}
                        span={span}
                        telemetry={telemetry}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="relative h-3">
                  {marks.map((mark) => (
                    <MarkDot
                      key={mark.eventId}
                      mark={mark}
                      telemetry={telemetry}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="bg-chart-1 h-2.5 w-4 rounded-sm" /> Agent loop
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-background ring-chart-1 h-2 w-4 rounded-sm ring-1 ring-inset" />{" "}
          Agent step
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-chart-2 h-2.5 w-4 rounded-sm" /> Model call
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-foreground size-2.5 rounded-full" /> Action
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-muted-foreground size-2.5 rounded-full" />{" "}
          Decision or skip
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-destructive size-2.5 rounded-full" /> Error
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-muted-foreground/40 size-1.5 rounded-full" /> Tool
          call or note
        </li>
      </ul>
    </div>
  );
}

export function AutopilotTraceTelemetry({
  telemetry,
  truncated,
}: AutopilotTraceTelemetryProps) {
  const { totals } = telemetry;
  if (telemetry.spans.length === 0 && telemetry.marks.length === 0) {
    return null;
  }
  const stats = [
    {
      label: "Wall time",
      value: formatAutopilotMs(telemetry.endMs - telemetry.originMs),
    },
    {
      label: "Model time",
      value: formatAutopilotMs(totals.modelTimeMs),
      hint: "Summed across concurrent calls",
    },
    { label: "Model calls", value: totals.calls.toLocaleString("en-US") },
    {
      label: "Agent steps / tool calls",
      value: `${totals.steps} / ${totals.toolCalls ?? "–"}`,
    },
    {
      label: "Tokens in / out",
      value: `${formatAutopilotTokens(totals.inputTokens)} / ${formatAutopilotTokens(totals.outputTokens)}`,
      hint:
        totals.cachedInputTokens > 0
          ? `${formatAutopilotTokens(totals.cachedInputTokens)} agent input read from cache`
          : undefined,
    },
    {
      label: "Errors / retries",
      value: `${totals.errors} / ${totals.retries}`,
    },
  ];
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Telemetry</h2>
      {truncated ? (
        <p role="status" className="text-sm">
          Built from the first 500 events, so these numbers are partial.
        </p>
      ) : null}
      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-muted-foreground text-sm">{stat.label}</dt>
            <dd className="font-medium tabular-nums">{stat.value}</dd>
            {stat.hint ? (
              <dd className="text-muted-foreground text-xs">{stat.hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>
      <Waterfall telemetry={telemetry} />
      <div className="overflow-x-auto rounded-lg border tabular-nums">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead className="text-right">Wall time</TableHead>
              <TableHead className="text-right">Model time</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="text-right">Tools</TableHead>
              <TableHead className="text-right">Tokens in</TableHead>
              <TableHead className="text-right">Tokens out</TableHead>
              <TableHead className="text-right">PRs</TableHead>
              <TableHead className="text-right">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {telemetry.lanes.map((lane) => (
              <TableRow key={lane.lane}>
                <TableCell>
                  <span className="capitalize">{lane.lane}</span>
                </TableCell>
                <TableCell className="text-right">
                  {lane.endMs > lane.startMs
                    ? formatAutopilotMs(lane.endMs - lane.startMs)
                    : "–"}
                </TableCell>
                <TableCell className="text-right">
                  {lane.calls > 0 ? formatAutopilotMs(lane.modelTimeMs) : "–"}
                </TableCell>
                <TableCell className="text-right">{lane.calls}</TableCell>
                <TableCell className="text-right">{lane.steps}</TableCell>
                <TableCell className="text-right">
                  {lane.toolCalls ?? "–"}
                </TableCell>
                <TableCell className="text-right">
                  {formatAutopilotTokens(lane.inputTokens)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAutopilotTokens(lane.outputTokens)}
                </TableCell>
                <TableCell className="text-right">
                  {lane.pullRequests}
                </TableCell>
                <TableCell className="text-right">{lane.errors}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {telemetry.models.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border tabular-nums">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Steps</TableHead>
                <TableHead className="text-right">Model time</TableHead>
                <TableHead className="text-right">Tokens in</TableHead>
                <TableHead className="text-right">Cached in</TableHead>
                <TableHead className="text-right">Tokens out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {telemetry.models.map((model) => (
                <TableRow key={model.model}>
                  <TableCell>
                    <span className="font-mono text-xs">{model.model}</span>
                  </TableCell>
                  <TableCell className="text-right">{model.calls}</TableCell>
                  <TableCell className="text-right">{model.steps}</TableCell>
                  <TableCell className="text-right">
                    {formatAutopilotMs(model.modelTimeMs)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAutopilotTokens(model.inputTokens)}
                  </TableCell>
                  <TableCell className="text-right">
                    {model.cachedInputTokens > 0
                      ? formatAutopilotTokens(model.cachedInputTokens)
                      : "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAutopilotTokens(model.outputTokens)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
