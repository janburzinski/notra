"use client";

import {
  Clock01Icon,
  GitPullRequestIcon,
  PlayIcon,
  Settings01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { useEffect, useState } from "react";

import { AutopilotAutomationsOverview } from "@/components/autopilot/autopilot-automations-overview";
import { AutopilotFindingConfirmDialog } from "@/components/autopilot/autopilot-finding-confirm-dialog";
import { AutopilotFindingTables } from "@/components/autopilot/autopilot-finding-tables";
import { AutopilotPageShell } from "@/components/autopilot/autopilot-page-shell";
import { AutopilotPeriodSelect } from "@/components/autopilot/autopilot-period-select";
import { AutopilotRunsTable } from "@/components/autopilot/autopilot-runs-table";
import { AutopilotSettingsPanel } from "@/components/autopilot/autopilot-settings-panel";
import { AutopilotSetupFlow } from "@/components/autopilot/autopilot-setup-flow";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { TabCount } from "@/components/tab-count";
import {
  AUTOPILOT_AUTOMATION_KINDS,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_LINK_ACTIONS,
  AUTOPILOT_PAGE_TABS,
} from "@/constants/autopilot-ui";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useAutopilotActions } from "@/lib/hooks/use-autopilot";
import { useRouter } from "@/lib/navigation";
import type {
  AutopilotOverviewPageProps,
  AutopilotPageClientProps,
  AutopilotPendingFindingAction,
} from "@/types/autopilot";
import type { AutopilotMetricsDays } from "@/types/autopilot-metrics";
import { isListedPullRequest } from "@/utils/autopilot-findings";

import {
  AutopilotCreateButton,
  AutopilotTemplateEditorView,
  AutopilotTemplatesPage,
  AutopilotTemplatesSection,
  useTemplateEditorOpen,
} from "./_variants";

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

function AutopilotOverviewPage({
  organizationId,
  organizationSlug,
  overview,
}: AutopilotOverviewPageProps) {
  const router = useRouter();
  const { projectId } = useActiveProject();
  const { runNow, setJob, writeSuggestion, merge } =
    useAutopilotActions(organizationId);
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
  const templateEditorOpen = useTemplateEditorOpen();
  const [days, setDays] = useState<AutopilotMetricsDays>(30);
  const [pending, setPending] = useState<AutopilotPendingFindingAction | null>(
    null
  );
  const [link, setLink] = useQueryStates({
    finding: parseAsString,
    action: parseAsStringLiteral(AUTOPILOT_LINK_ACTIONS),
  });
  const { settings, findings, runs, canManage } = overview;
  const basePath = `/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const pullRequests = findings.filter(isListedPullRequest);

  // Slack brief buttons link here with ?finding=…&action=merge|dismiss. The
  // params are dropped once read, so a reload doesn't ask again.
  useEffect(() => {
    if (!(link.finding && link.action)) {
      return;
    }
    const finding = findings.find((row) => row.id === link.finding);
    if (
      canManage &&
      finding &&
      (finding.status === "proposed" ||
        (finding.status === "suggested" && link.action === "dismiss"))
    ) {
      setPending({ kind: link.action, finding });
      void setTab("pull-requests");
    }
    void setLink(null);
  }, [canManage, findings, link, setLink, setTab]);

  const isRunning = runs.some(
    (run) =>
      run.status === "running" &&
      (AUTOPILOT_SCHEDULED_TRIGGERS as readonly string[]).includes(run.trigger)
  );

  if (!settings.enabled) {
    return (
      <>
        <PageHeading title="Autopilot" />
        {canManage ? (
          <AutopilotSetupFlow
            callbackPath={basePath}
            onSaved={() => runNow.mutate()}
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

  const templateActions = {
    jobs: settings.jobs,
    onAddBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      setJob.mutate({ kind, enabled: true }),
    onOpenBuiltIn: (kind: (typeof AUTOPILOT_AUTOMATION_KINDS)[number]) =>
      router.push(`${basePath}/${AUTOPILOT_AUTOMATION_SLUGS[kind]}`),
  };

  if (
    process.env.NODE_ENV === "development" &&
    canManage &&
    templateEditorOpen
  ) {
    return <AutopilotTemplateEditorView />;
  }

  if (process.env.NODE_ENV === "development" && canManage && templatesView) {
    return (
      <AutopilotTemplatesPage
        {...templateActions}
        onBack={() => {
          void setTemplatesView(null);
        }}
      />
    );
  }

  return (
    <>
      <PageHeading title="Autopilot">
        {canManage ? (
          <div className="flex items-center gap-2">
            {process.env.NODE_ENV === "development" ? (
              <AutopilotCreateButton />
            ) : null}
            <Button
              disabled={isRunning}
              loading={runNow.isPending || isRunning}
              onClick={() => runNow.mutate()}
              size="sm"
            >
              <HugeiconsIcon icon={PlayIcon} size={16} />
              Run now
            </Button>
          </div>
        ) : null}
      </PageHeading>

      <Tabs
        onValueChange={(value) => {
          const next = AUTOPILOT_PAGE_TABS.find((option) => option === value);
          void setTab(next ?? "automations");
        }}
        value={tab}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto">
            <IconTabsList value={tab}>
              <IconTabsTrigger
                icon={<HugeiconsIcon icon={WorkflowSquare03Icon} size={15} />}
                value="automations"
              >
                Automations
                <TabCount
                  count={
                    AUTOPILOT_AUTOMATION_KINDS.filter(
                      (kind) => settings.jobs[kind]
                    ).length
                  }
                />
              </IconTabsTrigger>
              <IconTabsTrigger
                icon={<HugeiconsIcon icon={GitPullRequestIcon} size={15} />}
                value="pull-requests"
              >
                Pull requests
                <TabCount count={pullRequests.length} />
              </IconTabsTrigger>
              <IconTabsTrigger
                icon={<HugeiconsIcon icon={Clock01Icon} size={15} />}
                value="runs"
              >
                Runs
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
          </div>
          {tab === "automations" ? (
            <AutopilotPeriodSelect onChange={setDays} value={days} />
          ) : null}
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
            organizationId={organizationId}
          />
          {process.env.NODE_ENV === "development" && canManage ? (
            <AutopilotTemplatesSection
              {...templateActions}
              onMore={() => {
                void setTemplatesView(true);
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent className="mt-4" value="pull-requests">
          <AutopilotFindingTables
            findings={findings}
            idPrefix="autopilot"
            mergingId={
              merge.isPending ? (merge.variables?.findingId ?? null) : null
            }
            onMerge={(row, method) =>
              merge.mutate({ findingId: row.id, method })
            }
            onOpen={(row) => router.push(`${basePath}/findings/${row.id}`)}
            onWrite={
              settings.enabled
                ? (row) => writeSuggestion.mutate(row.id)
                : undefined
            }
            readOnly={!canManage}
            settings={settings}
            writingId={
              writeSuggestion.isPending
                ? (writeSuggestion.variables ?? null)
                : null
            }
          />
        </TabsContent>
        <TabsContent className="mt-4" value="runs">
          <AutopilotRunsTable
            onSelect={(run) => router.push(`${basePath}/runs/${run.id}`)}
            runs={runs}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="settings">
          {canManage ? (
            <AutopilotSettingsPanel
              callbackPath={`${basePath}?tab=settings`}
              organizationId={organizationId}
              overview={overview}
            />
          ) : (
            <EmptyState
              description="Ask a workspace admin to change Autopilot's settings."
              title="Only admins can change this"
            />
          )}
        </TabsContent>
      </Tabs>

      <AutopilotFindingConfirmDialog
        branch={settings.repository?.branch ?? null}
        onClose={() => setPending(null)}
        organizationId={organizationId}
        pending={pending}
      />
    </>
  );
}
