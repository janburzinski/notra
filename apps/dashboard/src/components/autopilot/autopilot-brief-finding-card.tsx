"use client";

import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId, useState } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useFormatter } from "use-intl";

import { AutopilotFindingStatus } from "@/components/autopilot/autopilot-finding-status";
import { AutopilotMergeMenu } from "@/components/autopilot/autopilot-merge-menu";
import { Button } from "@/components/button";
import {
  AUTOPILOT_BRIEF_SOURCE_ICONS,
  AUTOPILOT_KIND_META,
  AUTOPILOT_PUBLISH_AT_FORMAT,
} from "@/constants/autopilot-ui";
import { cn } from "@/lib/utils";
import type {
  AutopilotBriefFindingActionsProps,
  AutopilotBriefFindingCardProps,
  AutopilotBriefFindingListProps,
  AutopilotBriefSource,
  AutopilotFindingView,
} from "@/types/autopilot";
import { briefFindingSources } from "@/utils/autopilot-brief";
import {
  describeFindingReason,
  findingDisplayTitle,
  findingSummary,
} from "@/utils/autopilot-findings";

/**
 * One row of the brief: what it is, what it would change, and the call to
 * make. Once decided, here or with a reaction in Slack, it shows its status.
 */
export function AutopilotBriefFindingCard({
  finding,
  canManage,
  canWrite,
  timeZone,
  merging,
  writing,
  onMerge,
  onWrite,
  onDismiss,
  onOpen,
  onPreview,
}: AutopilotBriefFindingCardProps) {
  const format = useFormatter();
  const meta = AUTOPILOT_KIND_META[finding.kind];
  const title = findingDisplayTitle(finding);
  const pending =
    finding.status === "proposed" || finding.status === "suggested";
  // A scheduled pull request merges on its own; Merge publishes it now.
  let stage = "Ready to merge";
  if (finding.status === "suggested") {
    stage = "Idea";
  } else if (finding.publishAt) {
    stage = `Publishes ${format.dateTime(new Date(finding.publishAt), {
      ...AUTOPILOT_PUBLISH_AT_FORMAT,
      timeZone,
    })}`;
  }
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <HugeiconsIcon
            aria-hidden="true"
            icon={meta.icon}
            size={14}
            strokeWidth={1.5}
          />
          {meta.label}
          {pending ? (
            <>
              <span aria-hidden="true">·</span>
              {stage}
            </>
          ) : null}
        </p>
        <button
          className="text-foreground block text-left text-sm font-medium text-pretty underline-offset-4 hover:underline"
          onClick={onOpen}
          onFocus={onPreview}
          onPointerEnter={onPreview}
          type="button"
        >
          {title}
        </button>
        <p className="text-muted-foreground text-sm text-pretty">
          {findingSummary(finding)}
        </p>
        <AutopilotBriefFindingWhy finding={finding} />
      </div>
      <AutopilotBriefFindingActions
        canManage={canManage}
        canWrite={canWrite}
        finding={finding}
        merging={merging}
        onDismiss={onDismiss}
        onMerge={onMerge}
        onWrite={onWrite}
        title={title}
        writing={writing}
      />
    </div>
  );
}

/**
 * The call to make while an item waits and the viewer may make it: merge
 * (or close) a pull request, write (or close) an idea. Otherwise its status.
 */
export function AutopilotBriefFindingActions({
  finding,
  title,
  canManage,
  canWrite,
  merging,
  writing,
  onMerge,
  onWrite,
  onDismiss,
}: AutopilotBriefFindingActionsProps) {
  const pending =
    finding.status === "proposed" || finding.status === "suggested";
  if (!(pending && canManage)) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <AutopilotFindingStatus finding={finding} linked={false} />
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      {finding.pullRequestUrl ? (
        <AutopilotFindingStatus finding={finding} linked={false} />
      ) : null}
      {finding.status === "proposed" ? (
        <AutopilotMergeMenu
          loading={merging}
          onClosePullRequest={onDismiss}
          onMerge={onMerge}
          size="sm"
        />
      ) : (
        <>
          <Button
            aria-label={`Close ${title}`}
            onClick={onDismiss}
            size="sm"
            variant="outline"
          >
            Close
          </Button>
          <Button
            aria-label={`Write ${title}`}
            disabled={!canWrite}
            loading={writing}
            onClick={onWrite}
            size="sm"
            title={canWrite ? undefined : "Turn Autopilot on to write ideas"}
          >
            Write it
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * How Autopilot got to this item, folded away until asked: the reason in one
 * line, then the pull requests, searches, answers or page it came from.
 */
export function AutopilotBriefFindingWhy({
  finding,
}: {
  finding: AutopilotFindingView;
}) {
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sources = briefFindingSources(finding);
  if (sources.length === 0) {
    return null;
  }
  const reason = describeFindingReason(finding, (date) =>
    format.dateTime(date, { month: "short", day: "numeric" })
  );
  return (
    <div className="pt-1">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 text-xs transition-colors"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Why this
        <span className="text-muted-foreground/70 tabular-nums">
          · {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
        <HugeiconsIcon
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
          icon={ArrowDown01Icon}
          size={12}
          strokeWidth={2}
        />
      </button>
      {open ? (
        <div
          className="border-table-row-border mt-2 space-y-2.5 border-l-2 pl-3"
          id={panelId}
        >
          <p className="text-muted-foreground text-xs/5 text-pretty">
            {reason}
          </p>
          <ul className="space-y-2">
            {sources.map((source) => (
              <SourceItem
                key={`${source.kind}-${source.title}`}
                source={source}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SourceItem({ source }: { source: AutopilotBriefSource }) {
  const body = (
    <>
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground mt-0.5 shrink-0"
        icon={AUTOPILOT_BRIEF_SOURCE_ICONS[source.kind]}
        size={14}
        strokeWidth={1.5}
      />
      <span className="min-w-0">
        <span className="text-foreground block truncate text-xs font-medium">
          {source.title}
        </span>
        {source.detail ? (
          <span className="text-muted-foreground block text-xs text-pretty">
            {source.detail}
          </span>
        ) : null}
      </span>
      {source.href ? (
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-foreground mt-0.5 ml-auto shrink-0 transition-colors"
          icon={ArrowUpRight01Icon}
          size={12}
          strokeWidth={2}
        />
      ) : null}
    </>
  );
  return (
    <li>
      {source.href ? (
        <a
          className="group hover:bg-muted -mx-1.5 flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors"
          href={source.href}
          rel="noreferrer"
          target="_blank"
        >
          {body}
        </a>
      ) : (
        <div className="flex items-start gap-2 py-1">{body}</div>
      )}
    </li>
  );
}

/** Items of one group as rows of a dualtone table, not a box each. */
export function AutopilotBriefFindingList({
  children,
}: AutopilotBriefFindingListProps) {
  return (
    <div className={TABLE_FRAME_CLASS}>
      <div
        className={cn(
          TABLE_BODY_CLASS,
          "divide-table-row-border divide-y overflow-hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
}
