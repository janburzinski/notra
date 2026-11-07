"use client";

import {
  Analytics01Icon,
  GitPullRequestIcon,
  PlayIcon,
  Settings01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";

import { AutopilotAnalyticsPanel } from "@/components/autopilot/autopilot-analytics-panel";
import { AutopilotAutomationsOverview } from "@/components/autopilot/autopilot-automations-overview";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotFindingTables } from "@/components/autopilot/autopilot-finding-tables";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotPeriodSelect } from "@/components/autopilot/autopilot-period-select";
import { AutopilotSettingsPanel } from "@/components/autopilot/autopilot-settings-panel";
import { AutopilotSetupFlow } from "@/components/autopilot/autopilot-setup-flow";
import { AutopilotStopButton } from "@/components/autopilot/autopilot-stop-button";
import {
  AutopilotTemplatesPage,
  AutopilotTemplatesSection,
} from "@/components/autopilot/autopilot-templates";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { BackLink } from "@/components/layout/back-link";
import { TabCount } from "@/components/tab-count";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_PAGE_TABS,
} from "@/constants/autopilot-ui";
import { AUTOPILOT_WORKFLOWS_PATH } from "@/constants/autopilot-workflows";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { useAutopilotLinkedAction } from "@/lib/hooks/use-autopilot-linked-action";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotOverviewPageProps,
  AutopilotPageClientProps,
  AutopilotOffPageProps,
  AutopilotOverviewTabsListProps,
  AutopilotOverviewToolbarProps,
  AutopilotPullRequestsTabProps,
  AutopilotSettingsTabProps,
} from "@/types/autopilot";
import type { AutopilotMetricsDays } from "@/types/autopilot-metrics";
import {
  autopilotRunKind,
  findActiveAutopilotRun,
} from "@/utils/autopilot-events";
import { isListedPullRequest } from "@/utils/autopilot-findings";

export default function PageClient({
  organizationSlug,
}: AutopilotPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => (
        <AutopilotOverviewPage
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          overview={overview}
        />
      )}
    </AutopilotPageShell>
  );
}

/** Before Autopilot is on: admins set it up, everyone else is told who can. */
function AutopilotOffPage({
  basePath,
  organizationId,
  overview,
  projectId,
  onTurnedOn,
}: AutopilotOffPageProps) {
  return (
    <>
      <PageHeading title="Autopilot" />
      {overview.canManage ? (
        <AutopilotSetupFlow
          callbackPath={basePath}
          onSaved={onTurnedOn}
          organizationId={organizationId}
          overview={overview}
          projectId={projectId}
          submitLabel="Turn on Autopilot"
        />
      ) : (
        <EmptyState
          description="Ask a workspace admin to turn on Autopilot."
          title="Autopilot is off"
        />
      )}
    </>
  );
}

function AutopilotOverviewTabsList({
  value,
  canManage,
  automationCount,
  pullRequestCount,
}: AutopilotOverviewTabsListProps) {
  return (
    <IconTabsList value={value}>
      <IconTabsTrigger
        icon={<HugeiconsIcon icon={WorkflowSquare03Icon} size={15} />}
        value="automations"
      >
        Automations
        <TabCount count={automationCount} />
      </IconTabsTrigger>
      <IconTabsTrigger
        icon={<HugeiconsIcon icon={GitPullRequestIcon} size={15} />}
        value="pull-requests"
      >
        Pull requests
        <TabCount count={pullRequestCount} />
      </IconTabsTrigger>
      <IconTabsTrigger
        icon={<HugeiconsIcon icon={Analytics01Icon} size={15} />}
        value="analytics"
      >
        Analytics
      </IconTabsTrigger>
      {canManage ? (
        <IconTabsTrigger
          icon={<HugeiconsIcon icon={Settings01Icon} size={15} />}
          value="settings"
        >
          Settings
        </IconTabsTrigger>
      ) : null}
    </IconTabsList>
  );
}

/** Autopilot's pull requests and suggestions, to merge, write or dismiss. */
function AutopilotPullRequestsTab({
  organizationId,
  basePath,
  findings,
  canManage,
}: AutopilotPullRequestsTabProps) {
  const router = useRouter();
  const { merge, writeSuggestion } = useAutopilotActions(organizationId);
  return (
    <AutopilotFindingTables
      findings={findings}
      idPrefix="autopilot"
      mergingId={merge.isPending ? (merge.variables?.findingId ?? null) : null}
      onMerge={(row, method) => merge.mutate({ findingId: row.id, method })}
      onOpen={(row) => router.push(`${basePath}/findings/${row.id}`)}
      onWrite={(row) => writeSuggestion.mutate(row.id)}
      readOnly={!canManage}
      writingId={
        writeSuggestion.isPending ? (writeSuggestion.variables ?? null) : null
      }
    />
  );
}

function AutopilotSettingsTab({
  basePath,
  organizationId,
  overview,
}: AutopilotSettingsTabProps) {
  if (!overview.canManage) {
    return (
      <EmptyState
        description="Ask a workspace admin to change Autopilot's settings."
        title="Only admins can change this"
      />
    );
  }
  return (
    <AutopilotSettingsPanel
      callbackPath={`${basePath}?tab=settings`}
      organizationId={organizationId}
      overview={overview}
    />
  );
}

/** The period for the numbers, and starting or stopping a run. */
function AutopilotOverviewToolbar({
  organizationId,
  canManage,
  activeRun,
  running,
  showPeriod,
  days,
  onDaysChange,
  onRunNow,
}: AutopilotOverviewToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {showPeriod ? (
        <AutopilotPeriodSelect onChange={onDaysChange} value={days} />
      ) : null}
      {canManage && activeRun?.workflowKey ? (
        <AutopilotStopButton
          organizationId={organizationId}
          runId={activeRun.id}
        />
      ) : null}
      {canManage ? (
        <Button
          disabled={Boolean(activeRun)}
          loading={running}
          onClick={onRunNow}
          size="sm"
        >
          <HugeiconsIcon icon={PlayIcon} size={16} />
          Run now
        </Button>
      ) : null}
    </div>
  );
}

function AutopilotOverviewPage({
  organizationId,
  organizationSlug,
  overview,
}: AutopilotOverviewPageProps) {
  const router = useRouter();
  const { projectId } = useActiveProject();
  const { runNow, setJob } = useAutopilotActions(organizationId);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(AUTOPILOT_PAGE_TABS)
      .withDefault("automations")
      .withOptions({ clearOnDefault: true })
  );
  const [templatesView, setTemplatesView] = useQueryState(
    "templates",
    parseAsBoolean
  );
  const [days, setDays] = useState<AutopilotMetricsDays>(30);
  const { settings, findings, runs, canManage } = overview;
  const linkedAction = useAutopilotLinkedAction(findings, canManage);
  const basePath = `/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const pullRequests = findings.filter(isListedPullRequest);

  const workflowsQuery = useQuery(
    dashboardOrpc.autopilot.workflows.list.queryOptions({
      input: { organizationId },
    })
  );
  const activeRun = findActiveAutopilotRun(runs);
  const isRunning = Boolean(activeRun);
  // A Slack button's merge or dismiss is about a pull request, so that tab
  // shows behind its dialog, and stays once it closes.
  const shownTab = linkedAction.pending ? "pull-requests" : tab;

  if (!settings.enabled) {
    return (
      <AutopilotOffPage
        basePath={basePath}
        onTurnedOn={() => runNow.mutate(undefined)}
        organizationId={organizationId}
        overview={overview}
        projectId={projectId}
      />
    );
  }

  const templateActions = {
    canManage,
    isAdding: setJob.isPending,
    jobs: settings.jobs,
    onAddBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      setJob.mutate({ kind, enabled: true }),
    onOpenBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      router.push(`${basePath}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`),
  };

  if (templatesView) {
    return (
      <div className="space-y-3">
        <BackLink href={basePath}>Autopilot</BackLink>
        <AutopilotTemplatesPage {...templateActions} />
      </div>
    );
  }

  return (
    <>
      <PageHeading title="Autopilot" />

      <Tabs
        onValueChange={(value) => {
          const next = AUTOPILOT_PAGE_TABS.find((option) => option === value);
          void setTab(next ?? "automations");
        }}
        value={shownTab}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto">
            <AutopilotOverviewTabsList
              automationCount={
                AUTOPILOT_AUTOMATION_KINDS.filter((kind) => settings.jobs[kind])
                  .length + (workflowsQuery.data?.length ?? 0)
              }
              canManage={canManage}
              pullRequestCount={pullRequests.length}
              value={shownTab}
            />
          </div>
          <AutopilotOverviewToolbar
            activeRun={activeRun}
            canManage={canManage}
            days={days}
            onDaysChange={setDays}
            onRunNow={() => runNow.mutate(undefined)}
            organizationId={organizationId}
            running={runNow.isPending || isRunning}
            showPeriod={shownTab === "automations" || shownTab === "analytics"}
          />
        </div>

        <TabsContent className="mt-4" value="automations">
          <AutopilotAutomationsOverview
            addingKind={
              setJob.isPending && setJob.variables.enabled
                ? setJob.variables.kind
                : null
            }
            canManage={canManage}
            days={days}
            isRunning={runs.some((run) => run.status === "running")}
            jobs={settings.jobs}
            onAddAutomation={(kind) => setJob.mutate({ kind, enabled: true })}
            onOpenAutomation={(kind) =>
              router.push(`${basePath}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`)
            }
            onOpenWorkflow={(workflowId) =>
              router.push(
                `${basePath}${AUTOPILOT_WORKFLOWS_PATH}/${workflowId}`
              )
            }
            onRunAutomation={(kind) => runNow.mutate(kind)}
            organizationId={organizationId}
            runDisabled={isRunning || runNow.isPending}
            runningKind={
              runNow.isPending
                ? (runNow.variables ?? null)
                : autopilotRunKind(activeRun)
            }
          />
          <AutopilotTemplatesSection
            {...templateActions}
            onMore={() => {
              void setTemplatesView(true);
            }}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="pull-requests">
          <AutopilotPullRequestsTab
            basePath={basePath}
            canManage={canManage}
            findings={findings}
            organizationId={organizationId}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="analytics">
          <AutopilotAnalyticsPanel
            days={days}
            onSelectRun={(run) => router.push(`${basePath}/runs/${run.id}`)}
            organizationId={organizationId}
            runs={runs}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="settings">
          <AutopilotSettingsTab
            basePath={basePath}
            organizationId={organizationId}
            overview={overview}
          />
        </TabsContent>
      </Tabs>

      <AutopilotFindingConfirmDialog
        branch={settings.repository?.branch ?? null}
        onClose={() => {
          if (linkedAction.pending) {
            void setTab("pull-requests");
          }
          linkedAction.close();
        }}
        organizationId={organizationId}
        pending={linkedAction.pending}
      />
    </>
  );
}
