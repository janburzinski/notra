"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { cn } from "@notra/ui/lib/utils";
import Link from "next/link";

import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import {
  AUTOPILOT_HEALTH_FAILURE_COLUMNS,
  AUTOPILOT_HEALTH_HIGH_FAILURE_RATE,
  AUTOPILOT_HEALTH_LOW_MERGE_RATE,
  AUTOPILOT_HEALTH_MIN_DECIDED,
  AUTOPILOT_HEALTH_MIN_FAILED_RUNS,
  AUTOPILOT_HEALTH_TEMPLATE_COLUMNS,
  AUTOPILOT_HEALTH_WORKFLOW_COLUMNS,
  AUTOPILOT_HEALTH_WORKSPACE_COLUMNS,
  AUTOPILOT_JOB_LABELS,
} from "@/constants/autopilot";
import type {
  AutopilotAdminRun,
  AutopilotHealthEmptyRowProps,
  AutopilotHealthNumberCellProps,
  AutopilotHealthSectionProps,
  AutopilotHealthTableHeaderProps,
  AutopilotHealthViewProps,
} from "@/types/autopilot";
import {
  autopilotFailureRate,
  autopilotMergeRate,
  formatAutopilotRate,
} from "@/utils/autopilot";

const NUMBER_FORMAT = new Intl.NumberFormat("en");

function formatNumber(value: number) {
  return value === 0 ? "–" : NUMBER_FORMAT.format(value);
}

const STATUS_VARIANT: Record<
  AutopilotAdminRun["status"],
  "destructive" | "info" | "secondary" | "success"
> = {
  completed: "success",
  failed: "destructive",
  running: "info",
  stopped: "secondary",
  skipped: "secondary",
};

export function AutopilotHealthSection({
  title,
  description,
  action,
  children,
}: AutopilotHealthSectionProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HealthTableHeader({ columns }: AutopilotHealthTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((column) => (
          <TableHead
            className={column.numeric ? "text-right" : undefined}
            key={column.label}
          >
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function EmptyRow({ columns, label }: AutopilotHealthEmptyRowProps) {
  return (
    <TableRow>
      <TableCell className="text-center" colSpan={columns}>
        <span className="text-muted-foreground text-sm">{label}</span>
      </TableCell>
    </TableRow>
  );
}

const NUMBER_TONE = {
  destructive: "text-destructive font-medium",
  warning: "text-warning font-medium",
} as const;

/** A right-aligned count, an optional tone and a second muted line. */
function NumberCell({ value, note, tone }: AutopilotHealthNumberCellProps) {
  return (
    <TableCell className="text-right">
      <span className={cn("tabular-nums", tone ? NUMBER_TONE[tone] : null)}>
        {value}
      </span>
      {note ? (
        <span className="text-muted-foreground block text-xs tabular-nums">
          {note}
        </span>
      ) : null}
    </TableCell>
  );
}

function RunStatus({ status }: Pick<AutopilotAdminRun, "status">) {
  return (
    <Badge shape="rounded" variant={STATUS_VARIANT[status]}>
      {status}
    </Badge>
  );
}

export function AutopilotTemplatesTable({
  health,
}: Pick<AutopilotHealthViewProps, "health">) {
  const templates = [...health.templates].sort(
    (a, b) =>
      b.runs - a.runs ||
      b.enabledWorkspaces - a.enabledWorkspaces ||
      a.kind.localeCompare(b.kind)
  );

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <HealthTableHeader columns={AUTOPILOT_HEALTH_TEMPLATE_COLUMNS} />
        <TableBody>
          {templates.map((template) => {
            const failureRate = autopilotFailureRate(template);
            const { decided, rate } = autopilotMergeRate(template);
            const failing =
              failureRate !== null &&
              template.failedRuns >= AUTOPILOT_HEALTH_MIN_FAILED_RUNS &&
              failureRate > AUTOPILOT_HEALTH_HIGH_FAILURE_RATE;
            const lowMerges =
              rate !== null &&
              decided >= AUTOPILOT_HEALTH_MIN_DECIDED &&
              rate < AUTOPILOT_HEALTH_LOW_MERGE_RATE;
            return (
              <TableRow key={template.kind}>
                <TableCell>
                  <span className="font-medium">
                    {AUTOPILOT_JOB_LABELS[template.kind]}
                  </span>
                  <span className="text-muted-foreground block font-mono text-xs">
                    {template.kind}
                  </span>
                </TableCell>
                <NumberCell value={formatNumber(template.enabledWorkspaces)} />
                <NumberCell value={formatNumber(template.runs)} />
                <NumberCell
                  note={
                    template.failedRuns > 0
                      ? formatAutopilotRate(failureRate)
                      : null
                  }
                  tone={failing ? "destructive" : undefined}
                  value={formatNumber(template.failedRuns)}
                />
                <NumberCell value={formatNumber(template.ideas)} />
                <NumberCell value={formatNumber(template.drafts)} />
                <NumberCell value={formatNumber(template.merged)} />
                <NumberCell
                  note={
                    template.expired > 0 ? `${template.expired} auto` : null
                  }
                  value={formatNumber(template.dismissed + template.expired)}
                />
                <NumberCell
                  tone={lowMerges ? "warning" : undefined}
                  value={formatAutopilotRate(rate)}
                />
                <NumberCell value={formatNumber(template.inReview)} />
                <NumberCell value={formatNumber(template.credits)} />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function AutopilotFailuresTable({
  health,
  slug,
}: AutopilotHealthViewProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <HealthTableHeader columns={AUTOPILOT_HEALTH_FAILURE_COLUMNS} />
        <TableBody>
          {health.failures.length === 0 ? (
            <EmptyRow
              columns={AUTOPILOT_HEALTH_FAILURE_COLUMNS.length}
              label="No errors in this range."
            />
          ) : null}
          {health.failures.map((failure) => (
            <TableRow key={`${failure.job ?? "run"}:${failure.message}`}>
              <TableCell>
                <Badge className="mb-1" shape="rounded" variant="secondary">
                  {failure.job
                    ? AUTOPILOT_JOB_LABELS[failure.job]
                    : "Whole run"}
                </Badge>
                <span className="block max-w-xl font-mono text-xs break-words whitespace-normal">
                  {failure.message}
                </span>
              </TableCell>
              <NumberCell
                note={
                  failure.occurrences > failure.runs
                    ? `${failure.occurrences}×`
                    : null
                }
                value={formatNumber(failure.runs)}
              />
              <NumberCell value={formatNumber(failure.workspaces)} />
              <TableCell>
                <SiteRelativeTime
                  className="text-muted-foreground text-xs"
                  date={failure.lastSeenAt}
                />
              </TableCell>
              <TableCell>
                <Link
                  className="text-xs underline-offset-4 hover:underline"
                  href={`/${slug}/autopilot/${encodeURIComponent(failure.exampleRunId)}`}
                >
                  {failure.exampleOrganizationSlug}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AutopilotWorkspacesTable({
  health,
  slug,
}: AutopilotHealthViewProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <HealthTableHeader columns={AUTOPILOT_HEALTH_WORKSPACE_COLUMNS} />
        <TableBody>
          {health.workspaces.length === 0 ? (
            <EmptyRow
              columns={AUTOPILOT_HEALTH_WORKSPACE_COLUMNS.length}
              label="No workspace has Autopilot on."
            />
          ) : null}
          {health.workspaces.map((workspace) => (
            <TableRow key={workspace.organizationId}>
              <TableCell>
                <span className="block max-w-56 truncate font-medium">
                  {workspace.name}
                </span>
                <span className="text-muted-foreground block max-w-56 truncate font-mono text-xs">
                  {workspace.slug}
                </span>
              </TableCell>
              <TableCell>
                {workspace.enabled ? null : (
                  <Badge className="mr-1" shape="rounded" variant="secondary">
                    Off
                  </Badge>
                )}
                <span
                  className={cn(
                    "font-mono text-xs",
                    workspace.repository ? null : "text-warning"
                  )}
                >
                  {workspace.repository ?? "No repository"}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {workspace.slack ? "Slack brief" : "No Slack"}
                </span>
              </TableCell>
              <NumberCell value={workspace.jobsOn} />
              <NumberCell value={formatNumber(workspace.runs)} />
              <NumberCell
                tone={workspace.failed > 0 ? "destructive" : undefined}
                value={formatNumber(workspace.failed)}
              />
              <TableCell>
                {workspace.lastRunId &&
                workspace.lastRunStatus &&
                workspace.lastRunAt ? (
                  <Link
                    className="flex items-center gap-2 text-xs"
                    href={`/${slug}/autopilot/${encodeURIComponent(workspace.lastRunId)}`}
                  >
                    {workspace.lastRunStuck ? (
                      <Badge shape="rounded" variant="destructive">
                        stuck
                      </Badge>
                    ) : (
                      <RunStatus status={workspace.lastRunStatus} />
                    )}
                    <SiteRelativeTime
                      className="text-muted-foreground"
                      date={workspace.lastRunAt}
                      inline
                    />
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">Never</span>
                )}
              </TableCell>
              <NumberCell value={formatNumber(workspace.inReview)} />
              <NumberCell value={formatNumber(workspace.merged)} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AutopilotWorkflowsTable({
  health,
}: Pick<AutopilotHealthViewProps, "health">) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <HealthTableHeader columns={AUTOPILOT_HEALTH_WORKFLOW_COLUMNS} />
        <TableBody>
          {health.workflows.top.length === 0 ? (
            <EmptyRow
              columns={AUTOPILOT_HEALTH_WORKFLOW_COLUMNS.length}
              label="No workspace has made a workflow."
            />
          ) : null}
          {health.workflows.top.map((workflow) => (
            <TableRow key={workflow.id}>
              <TableCell>
                <span className="flex max-w-64 items-center gap-2">
                  <span className="truncate font-medium">{workflow.name}</span>
                  {workflow.enabled ? null : (
                    <Badge shape="rounded" variant="secondary">
                      Off
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground block max-w-64 truncate font-mono text-xs">
                  {workflow.organizationSlug}
                </span>
              </TableCell>
              <NumberCell value={formatNumber(workflow.runs)} />
              <NumberCell
                tone={workflow.failed > 0 ? "destructive" : undefined}
                value={formatNumber(workflow.failed)}
              />
              <TableCell>
                {workflow.lastRunAt ? (
                  <SiteRelativeTime
                    className="text-muted-foreground text-xs"
                    date={workflow.lastRunAt}
                  />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    None in range
                  </span>
                )}
              </TableCell>
              <TableCell>
                {workflow.lastError ? (
                  <span className="block max-w-sm truncate font-mono text-xs">
                    {workflow.lastError}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">–</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
