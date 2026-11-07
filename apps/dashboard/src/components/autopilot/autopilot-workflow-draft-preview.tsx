"use client";

import {
  ArrowRight01Icon,
  Clock01Icon,
  FlowConnectionIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { AUTOPILOT_WORKFLOW_DRAFT_STATUS } from "@/constants/autopilot-ui";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotWorkflowChange,
  AutopilotWorkflowCompactDraftProps,
  AutopilotWorkflowDraftActionsProps,
  AutopilotWorkflowDraftCanvasSlotProps,
  AutopilotWorkflowDraftChangesProps,
  AutopilotWorkflowDraftIssuesProps,
  AutopilotWorkflowDraftPreviewProps,
  AutopilotWorkflowDraftStatusProps,
  AutopilotWorkflowDraftSummaryProps,
  AutopilotWorkflowOpenLinkProps,
} from "@/types/autopilot-workflows";
import { describeAutopilotWorkflowChanges } from "@/utils/autopilot-workflow-draft";
import { describeAutopilotWorkflowSchedule } from "@/utils/autopilot-workflows";
import lazyComponent from "@/utils/lazy-component";

function CanvasLoading() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

// The canvas brings React Flow along; only load it once a workflow shows.
const AutopilotWorkflowDraftCanvas = lazyComponent(
  () =>
    import("@/components/autopilot/autopilot-workflow-draft-canvas").then(
      (module) => module.AutopilotWorkflowDraftCanvas
    ),
  { loading: CanvasLoading, ssr: false }
);

function DraftStatus({
  status,
  isChange = false,
}: AutopilotWorkflowDraftStatusProps) {
  const t = useTranslations("dashboard.agent.workflowPreview");
  const key =
    isChange && status === "awaiting-approval"
      ? "changesNotSaved"
      : AUTOPILOT_WORKFLOW_DRAFT_STATUS[status].key;
  return (
    <StatusBadge
      appearance={AUTOPILOT_WORKFLOW_DRAFT_STATUS[status].appearance}
      label={t(`status.${key}`)}
    />
  );
}

function OpenWorkflowLink({ path }: AutopilotWorkflowOpenLinkProps) {
  const t = useTranslations("dashboard.agent.workflowPreview");
  return (
    <Link
      className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
      href={path}
    >
      {t("open")}
      <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} size={14} />
    </Link>
  );
}

/** Name and schedule on one line, with the status unless the actions show it. */
function DraftSummary({
  draft,
  showDescription,
  showStatus,
}: AutopilotWorkflowDraftSummaryProps) {
  const t = useTranslations("dashboard.agent.workflowPreview");
  const showSchedule = draft.schedule || draft.status !== "drafting";
  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="truncate font-medium">
            {draft.name ?? t("untitled")}
          </span>
          {showSchedule ? (
            <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Clock01Icon}
                size={13}
                strokeWidth={1.5}
              />
              {describeAutopilotWorkflowSchedule(draft.schedule)}
            </span>
          ) : null}
        </h3>
        {showStatus ? <DraftStatus status={draft.status} /> : null}
      </div>
      {showDescription && draft.description ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {draft.description}
        </p>
      ) : null}
    </div>
  );
}

function DraftIssues({ issues }: AutopilotWorkflowDraftIssuesProps) {
  return issues.length > 0 ? (
    <ul className="text-muted-foreground space-y-0.5 px-3 py-2 text-xs text-pretty">
      {issues.map((issue, index) => (
        <li key={`${index}:${issue}`}>{issue}</li>
      ))}
    </ul>
  ) : null;
}

function changeText(
  change: AutopilotWorkflowChange,
  t: ReturnType<
    typeof useTranslations<"dashboard.agent.workflowPreview.changes">
  >
) {
  switch (change.kind) {
    case "schedule":
    case "name":
      return t(change.kind, { from: change.from, to: change.to });
    case "description":
      return t("description");
    default:
      return t(change.kind, { title: change.title });
  }
}

/**
 * What a change does to the saved workflow, so approving it means knowing
 * what changes rather than comparing two diagrams.
 */
function DraftChanges({ draft }: AutopilotWorkflowDraftChangesProps) {
  const t = useTranslations("dashboard.agent.workflowPreview.changes");
  const { activeOrganization } = useOrganizationsContext();
  const { data: saved } = useQuery(
    dashboardOrpc.autopilot.workflows.get.queryOptions({
      input: {
        organizationId: activeOrganization?.id ?? "",
        workflowId: draft.workflowId ?? "",
      },
      enabled: Boolean(draft.workflowId && activeOrganization),
    })
  );
  // Once saved, the saved version is this one; there's nothing to compare.
  if (
    !saved ||
    draft.status === "drafting" ||
    draft.status === "saved" ||
    draft.status === "saving" ||
    draft.status === "discarded"
  ) {
    return null;
  }
  const changes = describeAutopilotWorkflowChanges(saved, draft);
  return (
    <div className="space-y-1 px-3 py-2 text-xs">
      <p className="text-muted-foreground">{t("title")}</p>
      {changes.length > 0 ? (
        <ul className="space-y-0.5">
          {changes.map((change) => (
            <li
              className="text-pretty"
              key={"id" in change ? `${change.kind}:${change.id}` : change.kind}
            >
              {changeText(change, t)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("none")}</p>
      )}
    </div>
  );
}

/** Saving waits for the user: they see the steps, then save or ask for changes. */
function DraftActions({
  status,
  isChange,
  onApprove,
  onDeny,
}: AutopilotWorkflowDraftActionsProps) {
  const t = useTranslations("dashboard.agent.workflowPreview");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <DraftStatus isChange={isChange} status={status} />
      <div className="flex shrink-0 items-center gap-1.5">
        <Button onClick={onDeny} size="xs" variant="ghost">
          {t("discard")}
        </Button>
        <Button onClick={onApprove} size="xs">
          {isChange ? t("saveChanges") : t("save")}
        </Button>
      </div>
    </div>
  );
}

/** An earlier save, or any save beside a full preview: one line. */
function CompactDraft({ draft, actions }: AutopilotWorkflowCompactDraftProps) {
  const t = useTranslations("dashboard.agent.workflowPreview");
  const saved = draft.status === "saved" && draft.path;
  return (
    <div className={cn(TABLE_FRAME_CLASS, "w-full min-w-0")}>
      <div
        className={cn(
          TABLE_BODY_CLASS,
          "flex min-w-0 items-center gap-3 py-2 pr-2 pl-3"
        )}
      >
        <HugeiconsIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
          icon={FlowConnectionIcon}
          strokeWidth={1.5}
        />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">{draft.name ?? t("untitled")}</span>
          <span className="text-muted-foreground tabular-nums">
            {" · "}
            {t("steps", { count: draft.view.nodes.length })}
          </span>
        </p>
        {saved ? <OpenWorkflowLink path={draft.path ?? ""} /> : null}
        {saved || actions ? null : <DraftStatus status={draft.status} />}
      </div>
      {actions}
    </div>
  );
}

/** The steps on the canvas, or a placeholder while the agent writes them. */
function DraftCanvas({ draft, panel }: AutopilotWorkflowDraftCanvasSlotProps) {
  const t = useTranslations("dashboard.agent.workflowPreview");
  if (draft.view.nodes.length === 0) {
    // A finished save without usable steps keeps its status and issues only.
    if (draft.status !== "drafting") {
      return null;
    }
    return (
      <Skeleton
        aria-busy="true"
        aria-label={t("writingSteps")}
        className={panel ? "m-3 min-h-0 flex-1" : "h-64 rounded-xl"}
        role="status"
      />
    );
  }
  return (
    <AutopilotWorkflowDraftCanvas
      className={
        panel
          ? "min-h-0 flex-1 rounded-none border-0"
          : cn(TABLE_BODY_CLASS, "h-64")
      }
      draft={draft}
    />
  );
}

/** What the agent is building, on the workflow canvas, as it writes it. */
export function AutopilotWorkflowDraftPreview({
  draft,
  variant,
  onApprove,
  onDeny,
}: AutopilotWorkflowDraftPreviewProps) {
  const saved = draft.status === "saved" && draft.path;
  const actions =
    onApprove && onDeny ? (
      <DraftActions
        isChange={draft.isChange}
        onApprove={onApprove}
        onDeny={onDeny}
        status={draft.status}
      />
    ) : null;

  if (variant === "compact") {
    return <CompactDraft actions={actions} draft={draft} />;
  }

  const canvas = <DraftCanvas draft={draft} panel={variant === "panel"} />;

  if (variant === "panel") {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-col">
        <div className="flex shrink-0 items-start gap-3 border-b px-4 py-3">
          <DraftSummary
            draft={draft}
            showDescription
            showStatus={actions === null}
          />
          {saved ? <OpenWorkflowLink path={draft.path ?? ""} /> : null}
        </div>
        {actions ? <div className="shrink-0 border-b">{actions}</div> : null}
        {draft.isChange ? <DraftChanges draft={draft} /> : null}
        <DraftIssues issues={draft.issues} />
        {canvas}
      </div>
    );
  }

  // In the chat: the grey shell holds the summary, the canvas is the card.
  return (
    <div className={cn(TABLE_FRAME_CLASS, "w-full min-w-0")}>
      <div className="flex min-h-9 items-center gap-3 py-1.5 pr-1.5 pl-3">
        <DraftSummary
          draft={draft}
          showDescription={false}
          showStatus={actions === null}
        />
        {saved ? <OpenWorkflowLink path={draft.path ?? ""} /> : null}
      </div>
      {draft.isChange ? <DraftChanges draft={draft} /> : null}
      <DraftIssues issues={draft.issues} />
      {canvas}
      {actions}
    </div>
  );
}
