import {
  listGitHubAppInstallationsByOrganization,
  listGitHubAppRepositoriesEffect,
} from "@notra/ai/integrations/github";
import { consumeChatGenerationRateLimit } from "@notra/ai/utils/chat-generation-rate-limit";
import { logError } from "@notra/ai/utils/server-log";
import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_SCHEDULED_TRIGGERS,
} from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  slackIntegrations,
} from "@notra/db/schema";
import {
  autopilotDismissInputSchema,
  autopilotFindingInputSchema,
  autopilotJobDecisionsInputSchema,
  autopilotMergeInputSchema,
  autopilotRequestChangesInputSchema,
  autopilotMetricsInputSchema,
  autopilotOrganizationInputSchema,
  autopilotRuleIdInputSchema,
  autopilotRuleInputSchema,
  autopilotRunInputSchema,
  autopilotRunNowInputSchema,
  autopilotOnboardingIntroInputSchema,
  autopilotOnboardingTurnInputSchema,
  autopilotSaveInputSchema,
  autopilotSetCommitFiltersInputSchema,
  autopilotSetJobInputSchema,
  autopilotUpdateInputSchema,
} from "@notra/schemas/dashboard/autopilot";
import { os } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  AUTOPILOT_SETUP_JOBS,
  AUTOPILOT_DEFAULT_STALE_PULL_REQUEST_DAYS,
  AUTOPILOT_RUNS_PAGE_SIZE,
  AUTOPILOT_ACCESS_CHECK_FAILED_MESSAGE,
  AUTOPILOT_UPGRADE_REQUIRED_MESSAGE,
} from "@/constants/autopilot";
import {
  AUTOPILOT_DEFAULT_APPROVALS,
  AUTOPILOT_SETUP_APPROVALS,
} from "@/constants/autopilot-publish";
import { AUTOPILOT_REVISION_ANONYMOUS_REQUESTER } from "@/constants/autopilot-revisions";
import {
  AUTOPILOT_WORKFLOW_NOT_FOUND,
  AUTOPILOT_WORKFLOW_NOT_RUNNING,
  AUTOPILOT_WORKFLOW_RATE_LIMITED,
  AUTOPILOT_WORKFLOW_UNSCHEDULE_FAILED,
} from "@/constants/autopilot-workflows";
import { AUTOPILOT_DAILY_WORKFLOW_KEY } from "@/constants/workflow-engine";
import { loadAutopilotAnalytics } from "@/lib/autopilot/analytics";
import { listRecentPullRequestAuthors } from "@/lib/autopilot/authors";
import { loadTodayBrief } from "@/lib/autopilot/brief-today";
import { resolveAutopilotCredits } from "@/lib/autopilot/credits";
import {
  dismissFindingWithFeedback,
  writeSuggestedFinding,
} from "@/lib/autopilot/finding-actions";
import { loadFindingContent } from "@/lib/autopilot/finding-content";
import {
  listFindings,
  mergeFinding,
  syncFindingPullRequests,
} from "@/lib/autopilot/findings";
import {
  canResetAutopilotOnboarding,
  isAutopilotWorkflowGraphEnabled,
  resolveAutopilotAvailability,
} from "@/lib/autopilot/flag";
import { loadFindingImpacts } from "@/lib/autopilot/impact";
import {
  describeItemRuns,
  listJobDecisions,
  listRunEvents,
} from "@/lib/autopilot/log";
import {
  loadAutopilotMetrics,
  loadAutopilotRunHistory,
} from "@/lib/autopilot/metrics";
import {
  loadOnboardingIntro,
  rememberAutopilotGoal,
  runOnboardingTurn,
} from "@/lib/autopilot/onboarding";
import {
  cancelHoldsAfterSettingsChange,
  holdFinding,
} from "@/lib/autopilot/publish";
import {
  loadFindingConversation,
  prepareFindingRevision,
  withdrawFindingRevision,
} from "@/lib/autopilot/revisions";
import { addRule, deleteRule, listRules } from "@/lib/autopilot/rules";
import { findAutopilotProject } from "@/lib/autopilot/run";
import {
  AutopilotSettingsError,
  resetAutopilotOnboarding,
  saveAutopilotSettings,
  updateAutopilotSettings,
  setAutopilotJob,
} from "@/lib/autopilot/settings";
import { attachSitePreviews, listAutopilotSites } from "@/lib/autopilot/sites";
import { startAutopilot } from "@/lib/autopilot/start";
import { stopAutopilotRun } from "@/lib/autopilot/stop";
import {
  AutopilotWorkflowBusyError,
  deleteAutopilotWorkflow,
  getAutopilotWorkflow,
  getAutopilotWorkflowRunViews,
  listAutopilotWorkflows,
  runAutopilotWorkflow,
  setAutopilotWorkflowEnabled,
  stopAutopilotWorkflowRun,
} from "@/lib/autopilot/workflows/service";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  paymentRequired,
  serviceUnavailable,
  tooManyRequests,
} from "@/lib/orpc/utils/errors";
import { workflowDefinitions } from "@/lib/workflow-engine/definitions/autopilot";
import { getWorkflowRunViews } from "@/lib/workflow-engine/run-view";
import { startGitHubMentionRun } from "@/lib/workflows/start";
import {
  autopilotWorkflowEnabledInputSchema,
  autopilotWorkflowInputSchema,
  autopilotWorkflowRunInputSchema,
} from "@/schemas/autopilot-workflows";
import type { ORPCContext } from "@/types/orpc/context";
import { toAutopilotCommitFilters } from "@/utils/autopilot-commit-filters";
import { canManageAutopilot } from "@/utils/autopilot-permissions";
import { ratelimit } from "@/utils/ratelimit";

/**
 * Autopilot needs the `autopilot` flag and the `autopilot` plan feature: every
 * procedure but `get` refuses workspaces without both, and `get` returns
 * nothing but `available: false` and whether an upgrade would unlock it.
 */
const withAutopilotFlag = os
  .$context<ORPCContext>()
  .middleware(async ({ next }, input: { organizationId: string }) => {
    const availability = await resolveAutopilotAvailability(
      input.organizationId
    );
    if (availability === "upgrade_required") {
      throw paymentRequired(AUTOPILOT_UPGRADE_REQUIRED_MESSAGE);
    }
    if (availability === "unavailable") {
      throw serviceUnavailable(AUTOPILOT_ACCESS_CHECK_FAILED_MESSAGE);
    }
    if (availability !== "enabled") {
      throw forbidden("Autopilot is not available for this workspace yet.");
    }
    return next();
  });

/** Autopilot writes to the customer's repository, so changes are limited to admins. */
function assertCanManageAutopilot(context: {
  auth: { membership: { role: string } };
}) {
  if (!canManageAutopilot(context.auth.membership.role)) {
    throw forbidden("Only workspace admins can change Autopilot.");
  }
}

/**
 * Only asks billing after a skipped scheduled run, so the notice clears as
 * soon as a top-up or reset lands rather than at the next scheduled run.
 */
async function isOutOfCredits(organizationId: string) {
  const latest = await db.query.autopilotRuns.findFirst({
    columns: { status: true },
    where: and(
      eq(autopilotRuns.organizationId, organizationId),
      inArray(autopilotRuns.trigger, AUTOPILOT_SCHEDULED_TRIGGERS)
    ),
    orderBy: [desc(autopilotRuns.startedAt)],
  });
  return (
    latest?.status === "skipped" &&
    (await resolveAutopilotCredits(organizationId)) === "exhausted"
  );
}

function templateTitle(workflowKey: string | null) {
  return workflowKey &&
    workflowKey !== AUTOPILOT_DAILY_WORKFLOW_KEY &&
    Object.hasOwn(workflowDefinitions, workflowKey)
    ? (workflowDefinitions[workflowKey]?.title ?? null)
    : null;
}

async function describeRuns(
  organizationId: string,
  runs: (typeof autopilotRuns.$inferSelect)[]
) {
  const described = await describeItemRuns(
    organizationId,
    runs
      .filter(
        (run) =>
          !(AUTOPILOT_SCHEDULED_TRIGGERS as readonly string[]).includes(
            run.trigger
          )
      )
      .map((run) => run.id)
  );
  return runs.map((run) => ({
    ...run,
    headline: described.get(run.id)?.headline ?? templateTitle(run.workflowKey),
    outcome: described.get(run.id)?.outcome ?? null,
  }));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function settingsCall(run: () => Promise<void>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof AutopilotSettingsError) {
      throw badRequest(error.message);
    }
    throw error;
  }
}

export const autopilotRouter = {
  analytics: authorizedProcedure
    .input(autopilotMetricsInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const now = new Date();
      const [current, previous] = await Promise.all([
        loadAutopilotAnalytics(input.organizationId, input.days, now),
        loadAutopilotAnalytics(
          input.organizationId,
          input.days,
          new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
        ),
      ]);
      return { ...current, previous: previous.summary };
    }),
  metrics: authorizedProcedure
    .input(autopilotMetricsInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      // The period before, for the trend next to each number.
      const now = new Date();
      const [current, previous, history] = await Promise.all([
        loadAutopilotMetrics(input.organizationId, input.days, now),
        loadAutopilotMetrics(
          input.organizationId,
          input.days,
          new Date(now.getTime() - input.days * 24 * 60 * 60 * 1000)
        ),
        loadAutopilotRunHistory(input.organizationId, now),
      ]);
      return { ...current, previous, history };
    }),
  get: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input, context }) => {
      const { organizationId } = input;
      // Without access nothing about Autopilot leaves the server.
      const availability = await resolveAutopilotAvailability(organizationId);
      // A failed check shows "try again", not "not available" or the paywall.
      if (availability === "unavailable") {
        throw serviceUnavailable(AUTOPILOT_ACCESS_CHECK_FAILED_MESSAGE);
      }
      const enabled = availability === "enabled";
      const [
        settings,
        installations,
        slackRows,
        findings,
        runs,
        rules,
        workflowGraph,
        siteRows,
        onboardingReset,
      ] = await Promise.all([
        enabled
          ? db.query.autopilotSettings.findFirst({
              where: eq(autopilotSettings.organizationId, organizationId),
            })
          : undefined,
        enabled ? listGitHubAppInstallationsByOrganization(organizationId) : [],
        enabled
          ? db
              .select({
                id: slackIntegrations.id,
                teamName: slackIntegrations.slackTeamName,
                notificationChannelId: slackIntegrations.notificationChannelId,
              })
              .from(slackIntegrations)
              .where(
                and(
                  eq(slackIntegrations.organizationId, organizationId),
                  eq(slackIntegrations.enabled, true)
                )
              )
          : [],
        enabled
          ? listFindings(organizationId).then((rows) =>
              attachSitePreviews(organizationId, rows)
            )
          : [],
        enabled
          ? db.query.autopilotRuns.findMany({
              where: eq(autopilotRuns.organizationId, organizationId),
              orderBy: [desc(autopilotRuns.startedAt)],
              limit: AUTOPILOT_RUNS_PAGE_SIZE,
            })
          : [],
        enabled ? listRules(organizationId) : [],
        enabled ? isAutopilotWorkflowGraphEnabled(organizationId) : false,
        enabled ? listAutopilotSites(organizationId) : [],
        enabled && canManageAutopilot(context.auth.membership.role)
          ? canResetAutopilotOnboarding(organizationId, context.auth.user)
          : false,
      ]);
      const [describedRuns, outOfCredits] = await Promise.all([
        describeRuns(organizationId, runs),
        enabled ? isOutOfCredits(organizationId) : false,
      ]);
      return {
        available: enabled,
        outOfCredits,
        upgradeRequired: availability === "upgrade_required",
        canManage: canManageAutopilot(context.auth.membership.role),
        /** Behind a flag: lets this person meet Ollie again. */
        canResetOnboarding: onboardingReset,
        settings: {
          configured: Boolean(settings),
          onboarded: Boolean(settings?.onboardedAt),
          enabled: settings?.enabled ?? false,
          projectId: settings?.projectId ?? null,
          repository:
            settings?.repositoryOwner && settings.repositoryName
              ? {
                  owner: settings.repositoryOwner,
                  name: settings.repositoryName,
                  branch: settings.repositoryBranch ?? "main",
                }
              : null,
          contentPath: settings?.contentPath ?? null,
          slackIntegrationId: settings?.slackIntegrationId ?? null,
          slackChannelId: settings?.slackChannelId ?? null,
          slackChannelName: settings?.slackChannelName ?? null,
          briefHour: settings?.briefHour ?? 9,
          timezone: settings?.timezone ?? "Europe/Berlin",
          jobs: settings
            ? { ...AUTOPILOT_DEFAULT_JOBS, ...settings.jobs }
            : AUTOPILOT_SETUP_JOBS,
          commitFilters: toAutopilotCommitFilters(settings?.commitFilters),
          maxOpenPullRequests: settings?.maxOpenPullRequests ?? 3,
          approvals: settings
            ? { ...AUTOPILOT_DEFAULT_APPROVALS, ...settings.approvals }
            : AUTOPILOT_SETUP_APPROVALS,
          siteId: settings?.siteId ?? null,
          draftEmails: settings?.draftEmails ?? "without_slack",
          reviewers: settings?.reviewers ?? [],
          stalePullRequestDays: settings
            ? settings.stalePullRequestDays
            : AUTOPILOT_DEFAULT_STALE_PULL_REQUEST_DAYS,
          lastRunAt: settings?.lastRunAt ?? null,
        },
        github: {
          accounts: installations.map((row) => row.accountLogin),
        },
        slack: { integrations: slackRows },
        sites: siteRows,
        findings,
        runs: describedRuns,
        rules,
        workflowGraph,
      };
    }),

  /**
   * Today's brief for the sidebar card, or null. Every page asks, so a
   * workspace without Autopilot gets null instead of an error.
   */
  todayBrief: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .handler(({ input }) => loadTodayBrief(input.organizationId)),

  run: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const run = await db.query.autopilotRuns.findFirst({
        where: and(
          eq(autopilotRuns.organizationId, input.organizationId),
          eq(autopilotRuns.id, input.runId)
        ),
      });
      const [described] = run
        ? await describeRuns(input.organizationId, [run])
        : [];
      if (!described) {
        throw notFound("Autopilot run not found");
      }
      return described;
    }),

  finding: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const finding = await db.query.autopilotFindings.findFirst({
        where: and(
          eq(autopilotFindings.organizationId, input.organizationId),
          eq(autopilotFindings.id, input.findingId)
        ),
      });
      if (!finding) {
        throw notFound("Autopilot finding not found");
      }
      const [withPreview = finding] = await attachSitePreviews(
        input.organizationId,
        [finding]
      );
      return withPreview;
    }),

  /** What the item's pull request changes, read from GitHub for the brief's modal. */
  findingContent: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      try {
        return await loadFindingContent(input.organizationId, input.findingId);
      } catch (error) {
        logError("Autopilot finding content failed", error, {
          organizationId: input.organizationId,
        });
        throw badRequest("Couldn't read this pull request from GitHub");
      }
    }),

  /** The requests from Notra on the item's pull request and the agent's replies. */
  conversation: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      try {
        return await loadFindingConversation(
          input.organizationId,
          input.findingId
        );
      } catch (error) {
        logError("Autopilot finding conversation failed", error, {
          organizationId: input.organizationId,
        });
        throw badRequest("Couldn't read this pull request from GitHub");
      }
    }),

  /** Posts the request on the pull request and lets the agent change the branch. */
  requestChanges: authorizedProcedure
    .input(autopilotRequestChangesInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      let mention: Awaited<ReturnType<typeof prepareFindingRevision>>;
      try {
        mention = await prepareFindingRevision({
          organizationId: input.organizationId,
          findingId: input.findingId,
          userId: context.auth.user.id,
          // The comment is public on GitHub: a name, never an email address.
          requester:
            context.auth.user.name?.trim() ||
            AUTOPILOT_REVISION_ANONYMOUS_REQUESTER,
          instruction: input.instruction,
        });
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
      try {
        await startGitHubMentionRun(mention);
      } catch (error) {
        // Without a run nobody answers the request, so it must not read as working.
        await withdrawFindingRevision(input.organizationId, mention).catch(
          () => undefined
        );
        throw error;
      }
      return { success: true as const };
    }),

  impact: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      const [settings, finding] = await Promise.all([
        db.query.autopilotSettings.findFirst({
          columns: { projectId: true },
          where: eq(autopilotSettings.organizationId, input.organizationId),
        }),
        db.query.autopilotFindings.findFirst({
          where: and(
            eq(autopilotFindings.organizationId, input.organizationId),
            eq(autopilotFindings.id, input.findingId),
            inArray(autopilotFindings.status, ["proposed", "merged"])
          ),
        }),
      ]);
      if (!finding) {
        return null;
      }
      const project = await findAutopilotProject(
        input.organizationId,
        settings?.projectId ?? null
      );
      const impacts = await loadFindingImpacts(project ?? null, [finding]);
      return impacts[finding.id] ?? null;
    }),

  repositories: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const repositories = await Effect.runPromise(
        listGitHubAppRepositoriesEffect(input.organizationId)
      ).catch(() => []);
      return repositories.map((repository) => ({
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        private: repository.private,
        pushedAt: repository.pushedAt ?? null,
      }));
    }),

  /** Recent pull request authors in the watched repositories, for the skip list. */
  authorSuggestions: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      // Admins only: the list names people from private repositories.
      assertCanManageAutopilot(context);
      const settings = await db.query.autopilotSettings.findFirst({
        columns: { commitFilters: true },
        where: eq(autopilotSettings.organizationId, input.organizationId),
      });
      return listRecentPullRequestAuthors(
        input.organizationId,
        toAutopilotCommitFilters(settings?.commitFilters)
      );
    }),

  save: authorizedProcedure
    .input(autopilotSaveInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      await settingsCall(() =>
        saveAutopilotSettings(
          input,
          input.onboarded ? context.auth.user.id : undefined
        )
      );
      if (input.goal) {
        // Memory is a nice-to-have here: setup still counts without it.
        // Credited to the setup, not a person: memory outlives members.
        await rememberAutopilotGoal({
          organizationId: input.organizationId,
          goal: input.goal,
          createdBy: "Autopilot setup",
        }).catch((error: unknown) =>
          logError("Autopilot goal could not be remembered", error, {
            organizationId: input.organizationId,
          })
        );
      }
      return { success: true as const };
    }),

  /** Ollie reads up on the workspace before the setup chat starts. */
  onboardingIntro: authorizedProcedure
    .input(autopilotOnboardingIntroInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const rate = await ratelimit.autopilotOnboardingIntro.limit(
        input.organizationId
      );
      return loadOnboardingIntro({
        ...input,
        personName: context.user.name,
        // Over the limit Ollie still says hello, just without reading up.
        skipModel: !rate.success,
      });
    }),

  /** Ollie reads an answer typed in the team's own words during setup. */
  onboardingTurn: authorizedProcedure
    .input(autopilotOnboardingTurnInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const rate = await ratelimit.autopilotOnboardingTurn.limit(
        input.organizationId
      );
      if (!rate.success) {
        throw badRequest(
          "Ollie needs a short break. Pick one of the answers, or try again in a few minutes."
        );
      }
      try {
        return await runOnboardingTurn(input);
      } catch (error) {
        logError("Autopilot setup answer could not be read", error, {
          organizationId: input.organizationId,
        });
        throw badRequest("Ollie couldn't read that. Try again in a moment.");
      }
    }),

  /** One settings change, merged into the saved settings on the server. */
  /** Behind a flag: the workspace isn't onboarded anymore and Ollie starts over. */
  resetOnboarding: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      if (
        !(await canResetAutopilotOnboarding(
          input.organizationId,
          context.auth.user
        ))
      ) {
        throw forbidden("Resetting onboarding isn't turned on for you.");
      }
      await resetAutopilotOnboarding(input.organizationId);
      return { success: true as const };
    }),

  update: authorizedProcedure
    .input(autopilotUpdateInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const { organizationId, ...patch } = input;
      await settingsCall(() => updateAutopilotSettings(organizationId, patch));
      return { success: true as const };
    }),

  setJob: authorizedProcedure
    .input(autopilotSetJobInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      await settingsCall(() =>
        setAutopilotJob(input.organizationId, input.kind, input.enabled)
      );
      return { success: true as const };
    }),

  setCommitFilters: authorizedProcedure
    .input(autopilotSetCommitFiltersInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const [updated] = await db
        .update(autopilotSettings)
        // Merged in the database, so two saves of different fields can't
        // undo each other whatever the client last read.
        .set({
          commitFilters: sql`coalesce(${autopilotSettings.commitFilters}, '{}'::jsonb) || ${JSON.stringify(input.filters)}::jsonb`,
        })
        .where(eq(autopilotSettings.organizationId, input.organizationId))
        .returning({ organizationId: autopilotSettings.organizationId });
      if (!updated) {
        throw badRequest("Set up Autopilot first.");
      }
      return { success: true as const };
    }),

  runNow: authorizedProcedure
    .input(autopilotRunNowInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        return await startAutopilot(
          input.organizationId,
          input.trigger,
          input.kind
        );
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  stop: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const stopped = await stopAutopilotRun({
        organizationId: input.organizationId,
        runId: input.runId,
      });
      if (!stopped) {
        throw badRequest("This run isn't running anymore.");
      }
      return { success: true as const };
    }),

  jobDecisions: authorizedProcedure
    .input(autopilotJobDecisionsInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(({ input }) => listJobDecisions(input.organizationId, input.kind)),

  runEvents: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(({ input }) => listRunEvents(input.organizationId, input.runId)),

  runGraph: authorizedProcedure
    .input(autopilotRunInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input }) => {
      if (!(await isAutopilotWorkflowGraphEnabled(input.organizationId))) {
        throw forbidden(
          "The workflow view is not available for this workspace."
        );
      }
      return await getWorkflowRunViews(input.organizationId, input.runId);
    }),

  sync: authorizedProcedure
    .input(autopilotOrganizationInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      // Sync writes finding status and deletes finished branches on GitHub.
      assertCanManageAutopilot(context);
      await syncFindingPullRequests(input.organizationId);
      return { success: true as const };
    }),

  merge: authorizedProcedure
    .input(autopilotMergeInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        const finding = await mergeFinding(
          input.organizationId,
          input.findingId,
          input.method,
          undefined,
          false,
          input.headSha
        );
        return { status: finding.status };
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  hold: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        await holdFinding(input.organizationId, input.findingId);
        return { success: true as const };
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  writeSuggestion: authorizedProcedure
    .input(autopilotFindingInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        await writeSuggestedFinding(input.organizationId, input.findingId);
        return { success: true as const };
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  dismiss: authorizedProcedure
    .input(autopilotDismissInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      try {
        const { finding, rule } = await dismissFindingWithFeedback({
          organizationId: input.organizationId,
          findingId: input.findingId,
          reason: input.reason,
          createdBy: context.auth.user.email,
          origin: "dashboard",
        });
        return { status: finding.status, rule };
      } catch (error) {
        throw badRequest(errorMessage(error));
      }
    }),

  addRule: authorizedProcedure
    .input(autopilotRuleInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      const saved = await addRule({
        organizationId: input.organizationId,
        text: input.text,
        source: "dashboard",
        createdBy: context.auth.user.email,
      });
      if (saved.status === "full") {
        throw badRequest("Remove a rule before adding another.");
      }
      return { status: saved.status };
    }),

  deleteRule: authorizedProcedure
    .input(autopilotRuleIdInputSchema)
    .use(withOrganizationAccess)
    .use(withAutopilotFlag)
    .handler(async ({ input, context }) => {
      assertCanManageAutopilot(context);
      await deleteRule(input.organizationId, input.ruleId);
      return { success: true as const };
    }),

  workflows: {
    list: authorizedProcedure
      .input(autopilotOrganizationInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(({ input }) => listAutopilotWorkflows(input.organizationId)),

    get: authorizedProcedure
      .input(autopilotWorkflowInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(async ({ input }) => {
        const workflow = await getAutopilotWorkflow(
          input.organizationId,
          input.workflowId
        );
        if (!workflow) {
          throw notFound(AUTOPILOT_WORKFLOW_NOT_FOUND);
        }
        return workflow;
      }),

    runGraph: authorizedProcedure
      .input(autopilotWorkflowRunInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(({ input }) =>
        getAutopilotWorkflowRunViews(input.organizationId, input.runId)
      ),

    run: authorizedProcedure
      .input(autopilotWorkflowInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(async ({ input, context }) => {
        assertCanManageAutopilot(context);
        const limit = await consumeChatGenerationRateLimit(
          input.organizationId,
          context.auth.user.id
        );
        if (!limit.success) {
          throw tooManyRequests(AUTOPILOT_WORKFLOW_RATE_LIMITED, {
            reset: limit.reset,
          });
        }
        let runId: string | null;
        try {
          runId = await runAutopilotWorkflow({
            organizationId: input.organizationId,
            workflowId: input.workflowId,
            trigger: "manual",
          });
        } catch (error) {
          if (error instanceof AutopilotWorkflowBusyError) {
            throw conflict(error.message);
          }
          throw error;
        }
        if (!runId) {
          throw notFound(AUTOPILOT_WORKFLOW_NOT_FOUND);
        }
        return { runId };
      }),

    stop: authorizedProcedure
      .input(autopilotWorkflowRunInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(async ({ input, context }) => {
        assertCanManageAutopilot(context);
        const stopped = await stopAutopilotWorkflowRun(
          input.organizationId,
          input.runId
        );
        if (!stopped) {
          throw badRequest(AUTOPILOT_WORKFLOW_NOT_RUNNING);
        }
        return { success: true as const };
      }),

    setEnabled: authorizedProcedure
      .input(autopilotWorkflowEnabledInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(async ({ input, context }) => {
        assertCanManageAutopilot(context);
        const result = await setAutopilotWorkflowEnabled(
          input.organizationId,
          input.workflowId,
          input.enabled
        );
        if (!result) {
          throw notFound(AUTOPILOT_WORKFLOW_NOT_FOUND);
        }
        return result;
      }),

    delete: authorizedProcedure
      .input(autopilotWorkflowInputSchema)
      .use(withOrganizationAccess)
      .use(withAutopilotFlag)
      .handler(async ({ input, context }) => {
        assertCanManageAutopilot(context);
        const result = await deleteAutopilotWorkflow(
          input.organizationId,
          input.workflowId
        );
        if (result === "missing") {
          throw notFound(AUTOPILOT_WORKFLOW_NOT_FOUND);
        }
        if (result === "schedule-failed") {
          throw serviceUnavailable(AUTOPILOT_WORKFLOW_UNSCHEDULE_FAILED);
        }
        return { success: true as const };
      }),
  },
};
