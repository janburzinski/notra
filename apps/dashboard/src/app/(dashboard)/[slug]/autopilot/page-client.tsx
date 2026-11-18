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
import { useCallback, useState } from "react";

import { AutopilotAutomationsOverview } from "@/components/autopilot/autopilot-automations-overview";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotFindingTables } from "@/components/autopilot/autopilot-finding-tables";
import { AutopilotOnboarding } from "@/components/autopilot/autopilot-onboarding";
import { AutopilotOutOfCreditsNotice } from "@/components/autopilot/autopilot-out-of-credits-notice";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotPaused } from "@/components/autopilot/autopilot-paused";
import { AutopilotPeriodSelect } from "@/components/autopilot/autopilot-period-select";
import { AutopilotReveal } from "@/components/autopilot/autopilot-reveal";
import { AutopilotSettingsPanel } from "@/components/autopilot/autopilot-settings-panel";
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
import { AUTOPILOT_ONBOARDING_ANCHOR_ATTRIBUTE } from "@/constants/autopilot-onboarding";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_PAGE_TABS,
} from "@/constants/autopilot-ui";
import { AUTOPILOT_WORKFLOWS_PATH } from "@/constants/autopilot-workflows";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { useAutopilotLinkedAction } from "@/lib/hooks/use-autopilot-linked-action";
import { useAutopilotOnboardingSession } from "@/lib/hooks/use-autopilot-onboarding-session";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotOverviewPageProps,
  AutopilotFindingView,
  AutopilotPageClientProps,
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
import dynamic from "@/utils/lazy-component";

const AutopilotAnalyticsPanel = dynamic(() =>
  import("@/components/autopilot/autopilot-analytics-panel").then(
    (module) => module.AutopilotAnalyticsPanel
  )
);

export default function PageClient({
  organizationSlug,
}: AutopilotPageClientProps) {
  return (
    <AutopilotPageShell organizationSlug={organizationSlug}>
      {({ organizationId, overview }) => (
        <AutopilotOverviewPage
          // A new page per workspace: its setup state doesn't carry over.
          key={organizationId}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          overview={overview}
        />
      )}
    </AutopilotPageShell>
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
  onClosePullRequest,
  timezone,
}: AutopilotPullRequestsTabProps) {
  const router = useRouter();
  const { merge, writeSuggestion } = useAutopilotActions(organizationId);
  return (
    <AutopilotFindingTables
      findings={findings}
      idPrefix="autopilot"
      mergingId={merge.isPending ? (merge.variables?.findingId ?? null) : null}
      onClosePullRequest={onClosePullRequest}
      onMerge={(row, method) => merge.mutate({ findingId: row.id, method })}
      onOpen={(row) => router.push(`${basePath}/findings/${row.id}`)}
      onWrite={(row) => writeSuggestion.mutate(row.id)}
      readOnly={!canManage}
      timezone={timezone}
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
  const [closing, setClosing] = useState<AutopilotFindingView | null>(null);
  const basePath = `/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const pullRequests = findings.filter(isListedPullRequest);
  // Ollie sets Autopilot up once per workspace; turned off later, it's
  // paused rather than set up again.
  const [onboarding, setOnboarding] = useState(
    () => !settings.onboarded && canManage
  );
  // The dashboard waits under Ollie's chat and rises in as the chat ends.
  const [revealed, setRevealed] = useState(false);
  const finishOnboarding = useCallback(() => {
    setOnboarding(false);
    setRevealed(false);
  }, []);
  const revealDashboard = useCallback(() => setRevealed(true), []);

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

  // Ollie's setup stays on screen until it has folded into the dock, while
  // the page behind it turns into the dashboard. Same spot in both returns,
  // so the chat keeps its state when Autopilot turns on.
  // A setup still running or stuck on an error, from before you left, also
  // brings Ollie back even though Autopilot was already saved as on.
  const setupUnfinished =
    useAutopilotOnboardingSession(organizationId).phase === "setup";
  const showOnboarding =
    onboarding || setupUnfinished || (!settings.onboarded && canManage);
  const underOnboarding = showOnboarding && !revealed;
  const onboardingLayer = showOnboarding ? (
    <AutopilotOnboarding
      basePath={basePath}
      key="onboarding"
      onDone={finishOnboarding}
      onReveal={revealDashboard}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      overview={overview}
      projectId={projectId}
    />
  ) : null;

  if (!(settings.enabled || showOnboarding) && settings.onboarded) {
    return (
      <AutopilotPaused
        canManage={canManage}
        organizationId={organizationId}
        settings={settings}
      />
    );
  }

  if (!settings.enabled) {
    return (
      <>
        {onboardingLayer}
        {canManage ? (
          <div {...{ [AUTOPILOT_ONBOARDING_ANCHOR_ATTRIBUTE]: "" }}>
            <PageHeading title="Autopilot" />
          </div>
        ) : (
          <>
            <PageHeading title="Autopilot" />
            <EmptyState
              description="Ask a workspace admin to turn on Autopilot."
              title="Autopilot is off"
            />
          </>
        )}
      </>
    );
  }

  const templateActions = {
    canManage,
    jobs: settings.jobs,
    onAddBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      setJob.mutate({ kind, enabled: true }),
    onOpenBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      router.push(`${basePath}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`),
  };

  if (templatesView) {
    return (
      <div className="space-y-3">
        {onboardingLayer}
        <BackLink href={basePath}>Autopilot</BackLink>
        <AutopilotTemplatesPage {...templateActions} />
      </div>
    );
  }

  return (
    <>
      {onboardingLayer}
      <div {...{ [AUTOPILOT_ONBOARDING_ANCHOR_ATTRIBUTE]: "" }}>
        <PageHeading title="Autopilot" />
      </div>
      {overview.outOfCredits ? <AutopilotOutOfCreditsNotice /> : null}

      <Tabs
        onValueChange={(value) => {
          const next = AUTOPILOT_PAGE_TABS.find((option) => option === value);
          void setTab(next ?? "automations");
        }}
        value={shownTab}
      >
        <AutopilotReveal
          className="flex flex-wrap items-center justify-between gap-3"
          hidden={underOnboarding}
          index={0}
        >
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
        </AutopilotReveal>

        <TabsContent className="mt-4" value="automations">
          <AutopilotReveal hidden={underOnboarding} index={1}>
            <AutopilotAutomationsOverview
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
              onTurnOffAutomation={(kind) =>
                setJob.mutate({ kind, enabled: false })
              }
              organizationId={organizationId}
              runDisabled={isRunning || runNow.isPending}
              runningKind={
                runNow.isPending
                  ? (runNow.variables ?? null)
                  : autopilotRunKind(activeRun)
              }
            />
          </AutopilotReveal>
          <AutopilotReveal hidden={underOnboarding} index={2}>
            <AutopilotTemplatesSection
              {...templateActions}
              onMore={() => {
                void setTemplatesView(true);
              }}
            />
          </AutopilotReveal>
        </TabsContent>
        <TabsContent className="mt-4" value="pull-requests">
          <AutopilotPullRequestsTab
            basePath={basePath}
            canManage={canManage}
            findings={findings}
            onClosePullRequest={setClosing}
            organizationId={organizationId}
            timezone={settings.timezone}
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
          setClosing(null);
        }}
        organizationId={organizationId}
        pending={
          linkedAction.pending ??
          (closing ? { kind: "dismiss", finding: closing } : null)
        }
      />
    </>
  );
}
