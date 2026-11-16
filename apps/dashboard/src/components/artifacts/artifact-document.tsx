"use client";

import {
  Alert02Icon,
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  MinusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ArtifactBlock } from "@notra/ai/types/artifact";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { InstrumentModule } from "ui/card";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useFormatter, useTranslations } from "use-intl";

import { ToolOutputChartPlot } from "@/components/ai/chat-tool-block/tool-output-chart";
import { ARTIFACT_HEADING_ONLY } from "@/constants/artifacts";
import { cn } from "@/lib/utils";
import type { ArtifactDensity, ArtifactDocumentProps } from "@/types/artifacts";
import { tableCellTrend } from "@/utils/artifact-table";

type Block<T extends ArtifactBlock["type"]> = Extract<
  ArtifactBlock,
  { type: T }
>;

const CALLOUT_TONES = {
  info: { variant: "info", icon: InformationCircleIcon },
  success: { variant: "success", icon: CheckmarkCircle02Icon },
  warning: { variant: "warning", icon: Alert02Icon },
  danger: { variant: "destructive", icon: Alert02Icon },
} as const;

const TREND = {
  up: { icon: ArrowUpRight01Icon, className: "text-success" },
  down: { icon: ArrowDownRight01Icon, className: "text-destructive" },
  flat: { icon: MinusSignIcon, className: "text-muted-foreground" },
} as const;

export function ArtifactBlockTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-3 text-base font-semibold tracking-tight">{children}</h2>
  );
}

function TextBlock({ block }: { block: Block<"text"> }) {
  // A heading on its own introduces the block below it, so it sits close to
  // that block instead of a full block gap away.
  const isLeadIn = ARTIFACT_HEADING_ONLY.test(block.markdown.trim());
  return (
    <div className={cn("text-sm/6", isLeadIn && "mb-3")}>
      <MessageResponse mode="static">{block.markdown}</MessageResponse>
    </div>
  );
}

function MetricsBlock({
  block,
  density,
}: {
  block: Block<"metrics">;
  density: ArtifactDensity;
}) {
  return (
    <section>
      {block.title ? (
        <ArtifactBlockTitle>{block.title}</ArtifactBlockTitle>
      ) : null}
      <div className={TABLE_FRAME_CLASS}>
        <dl
          className={cn(
            TABLE_BODY_CLASS,
            "bg-table-row-border flex flex-wrap gap-px overflow-hidden"
          )}
        >
          {block.items.map((item) => {
            const trend = item.trend ? TREND[item.trend] : null;
            return (
              <div
                className={cn(
                  "bg-table-card min-w-0 flex-1 px-4 py-3.5",
                  density === "page" ? "basis-40" : "basis-32"
                )}
                key={item.label}
              >
                <dt className="text-muted-foreground truncate text-xs">
                  {item.label}
                </dt>
                <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xl font-semibold tracking-tight tabular-nums">
                    {item.value}
                  </span>
                  {item.change ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                        trend?.className ?? "text-muted-foreground"
                      )}
                    >
                      {trend ? (
                        <HugeiconsIcon
                          aria-hidden="true"
                          className="size-3.5"
                          icon={trend.icon}
                          strokeWidth={2}
                        />
                      ) : null}
                      {item.change}
                    </span>
                  ) : null}
                </dd>
                {item.note ? (
                  <dd className="text-subtle-foreground mt-0.5 truncate text-xs">
                    {item.note}
                  </dd>
                ) : null}
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

/** A chart on the same card the chat and the GEO pages use. */
function ChartBlock({ block }: { block: Block<"chart"> }) {
  const { chart } = block;
  return (
    <InstrumentModule
      eyebrow={chart.title}
      readout={chart.subtitle}
      variant="table"
    >
      <ToolOutputChartPlot chart={chart} />
    </InstrumentModule>
  );
}

function TableBlock({ block }: { block: Block<"table"> }) {
  const format = useFormatter();
  const lowerIsBetter = new Set(block.lowerIsBetter);
  // A column of numbers or changes lines up on the right.
  const numeric = block.columns.map(
    (column, index) =>
      block.rows.length > 0 &&
      block.rows.every((row) => {
        const cell = row[index];
        return (
          cell === null ||
          cell === undefined ||
          typeof cell === "number" ||
          tableCellTrend(cell, lowerIsBetter.has(column)) !== null
        );
      })
  );
  return (
    <section>
      {block.title ? (
        <ArtifactBlockTitle>{block.title}</ArtifactBlockTitle>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            {block.columns.map((column, index) => (
              <TableHead
                className={numeric[index] ? "text-right" : undefined}
                key={column}
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.rows.map((row, rowIndex) => (
            // Rows have no ids; their order is the content.
            <TableRow key={rowIndex}>
              {block.columns.map((column, index) => {
                const cell = row[index];
                let text = "";
                if (typeof cell === "number") {
                  text = format.number(cell);
                } else if (typeof cell === "string") {
                  text = cell;
                }
                const trend = tableCellTrend(cell, lowerIsBetter.has(column));
                // Text wraps so the table fits a phone; numbers stay whole.
                return (
                  <TableCell
                    className={
                      numeric[index]
                        ? "text-right"
                        : "min-w-28 [overflow-wrap:anywhere] whitespace-normal"
                    }
                    key={column}
                  >
                    {/* A change takes the color the metric tiles give it. */}
                    <span
                      className={trend ? TREND[trend].className : undefined}
                    >
                      {text || "—"}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function CalloutBlock({ block }: { block: Block<"callout"> }) {
  const tone = CALLOUT_TONES[block.tone];
  return (
    <Alert variant={tone.variant}>
      <HugeiconsIcon aria-hidden="true" icon={tone.icon} strokeWidth={2} />
      {block.title ? <AlertTitle>{block.title}</AlertTitle> : null}
      <AlertDescription>{block.text}</AlertDescription>
    </Alert>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return url;
  }
}

function SourcesBlock({ block }: { block: Block<"sources"> }) {
  const t = useTranslations("artifacts");
  return (
    <section className="border-t pt-5">
      <h2 className="text-muted-foreground mb-2 text-xs font-medium">
        {t("sources")}
      </h2>
      <ol className="space-y-1.5">
        {block.items.map((item, index) => (
          <li
            className="grid grid-cols-[1.5rem_1fr] items-baseline text-sm"
            key={item.url}
          >
            <span
              aria-hidden="true"
              className="text-muted-foreground/70 font-mono text-xs tabular-nums"
            >
              {index + 1}
            </span>
            <a
              className="hover:text-foreground text-muted-foreground min-w-0 truncate underline-offset-4 transition-colors hover:underline"
              href={item.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {item.title}
              <span className="text-subtle-foreground">
                {" "}
                · {hostname(item.url)}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ArtifactBlockView({
  block,
  density,
  renderAutopilot,
}: {
  block: ArtifactBlock;
  density: ArtifactDensity;
  renderAutopilot: ArtifactDocumentProps["renderAutopilot"];
}) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />;
    case "metrics":
      return <MetricsBlock block={block} density={density} />;
    case "chart":
      return <ChartBlock block={block} />;
    case "table":
      return <TableBlock block={block} />;
    case "callout":
      return <CalloutBlock block={block} />;
    case "autopilot":
      return renderAutopilot(block);
    case "sources":
      return <SourcesBlock block={block} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

/**
 * An artifact as a document: title, summary, then its blocks top to bottom.
 * The same renderer serves the chat panel, the member page and public links,
 * which differ only in how Autopilot items are shown.
 */
export function ArtifactDocument({
  title,
  summary,
  blocks,
  density,
  eyebrow,
  renderAutopilot,
}: ArtifactDocumentProps) {
  return (
    <article className={density === "page" ? "space-y-10" : "space-y-8"}>
      <header>
        {eyebrow ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "font-semibold tracking-tight text-balance",
            eyebrow && "mt-3",
            density === "page"
              ? "text-2xl/tight sm:text-3xl/tight"
              : "text-xl/tight"
          )}
        >
          {title}
        </h1>
        {summary ? (
          <p
            className={cn(
              "text-muted-foreground mt-2 text-pretty",
              density === "page" ? "text-sm/6 sm:text-base/7" : "text-sm/6"
            )}
          >
            {summary}
          </p>
        ) : null}
      </header>
      {blocks.map((block, index) => (
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- blocks have no ids and a saved version never reorders them
        <ArtifactBlockView
          block={block}
          density={density}
          key={`${block.type}-${index}`}
          renderAutopilot={renderAutopilot}
        />
      ))}
    </article>
  );
}
