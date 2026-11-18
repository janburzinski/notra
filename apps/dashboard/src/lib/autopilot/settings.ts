import { db } from "@notra/db/drizzle";
import {
  autopilotSettings,
  projects,
  slackIntegrations,
} from "@notra/db/schema";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import type {
  autopilotSaveInputSchema,
  autopilotUpdateInputSchema,
} from "@notra/schemas/dashboard/autopilot";
import { and, eq, sql } from "drizzle-orm";
import type * as z from "zod";

import { AUTOPILOT_DEFAULT_APPROVALS } from "@/constants/autopilot-publish";
import { cancelHoldsAfterSettingsChange } from "@/lib/autopilot/publish";
import { loadAutopilotSiteTarget } from "@/lib/autopilot/sites";
import { normalizeRepositoryDirectory } from "@/utils/autopilot-paths";
import { normalizeAutopilotReviewers } from "@/utils/autopilot-reviewers";

export class AutopilotSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutopilotSettingsError";
  }
}

const SET_UP_FIRST = "Set up Autopilot first.";

async function assertSlackConnected(
  organizationId: string,
  integrationId: string
) {
  const integration = await db.query.slackIntegrations.findFirst({
    columns: { id: true },
    where: and(
      eq(slackIntegrations.id, integrationId),
      eq(slackIntegrations.organizationId, organizationId),
      eq(slackIntegrations.enabled, true)
    ),
  });
  if (!integration) {
    throw new AutopilotSettingsError("That Slack workspace is not connected.");
  }
}

function toContentPath(path: string | null | undefined) {
  const contentPath = path ? normalizeRepositoryDirectory(path) : null;
  if (path && !contentPath) {
    throw new AutopilotSettingsError(
      "Use a folder path inside the repository."
    );
  }
  return contentPath || null;
}

/** The site posts go to; one without a blog only stays if it is already set. */
async function loadSiteTarget(organizationId: string, siteId: string) {
  const site = await loadAutopilotSiteTarget(organizationId, siteId);
  if (!site) {
    throw new AutopilotSettingsError(
      "That site is not part of this workspace."
    );
  }
  if (!site.contentPath) {
    const current = await db.query.autopilotSettings.findFirst({
      columns: { siteId: true },
      where: eq(autopilotSettings.organizationId, organizationId),
    });
    if (current?.siteId !== siteId) {
      throw new AutopilotSettingsError(
        "That site has no blog. Turn on its blog first."
      );
    }
  }
  return site;
}

export async function saveAutopilotSettings(
  input: z.infer<typeof autopilotSaveInputSchema>,
  /** The user saving it, recorded when this finishes onboarding. */
  userId?: string
) {
  if (input.slack) {
    await assertSlackConnected(input.organizationId, input.slack.integrationId);
  }
  if (input.projectId) {
    const project = await db.query.projects.findFirst({
      columns: { id: true },
      where: and(
        eq(projects.id, input.projectId),
        eq(projects.organizationId, input.organizationId)
      ),
    });
    if (!project) {
      throw new AutopilotSettingsError(
        "That project is not part of this workspace."
      );
    }
  }
  const contentPath = toContentPath(input.contentPath);
  const site = input.siteId
    ? await loadSiteTarget(input.organizationId, input.siteId)
    : null;
  const values = {
    enabled: input.enabled,
    repositoryOwner: site?.repository.owner ?? input.repository?.owner ?? null,
    repositoryName: site?.repository.name ?? input.repository?.name ?? null,
    repositoryBranch:
      site?.repository.branch ?? input.repository?.branch ?? null,
    contentPath: site ? site.contentPath : contentPath,
    ...(input.siteId === undefined ? {} : { siteId: input.siteId }),
    ...(input.approvals ? { approvals: input.approvals } : {}),
    ...(input.draftEmails ? { draftEmails: input.draftEmails } : {}),
    slackIntegrationId: input.slack?.integrationId ?? null,
    slackChannelId: input.slack?.channelId ?? null,
    slackChannelName: input.slack?.channelName ?? null,
    briefHour: input.briefHour,
    timezone: input.timezone,
    ...(input.jobs ? { jobs: input.jobs } : {}),
    maxOpenPullRequests: input.maxOpenPullRequests,
    ...(input.stalePullRequestDays === undefined
      ? {}
      : { stalePullRequestDays: input.stalePullRequestDays }),
    ...(input.projectId ? { projectId: input.projectId } : {}),
  };
  // The first finished onboarding is the one kept.
  const onboarded = input.onboarded
    ? {
        onboardedAt: sql`coalesce(${autopilotSettings.onboardedAt}, now())`,
        onboardedBy: sql`coalesce(${autopilotSettings.onboardedBy}, ${userId ?? null})`,
      }
    : {};
  await db
    .insert(autopilotSettings)
    .values({
      organizationId: input.organizationId,
      ...values,
      ...(input.onboarded
        ? { onboardedAt: new Date(), onboardedBy: userId ?? null }
        : {}),
    })
    .onConflictDoUpdate({
      target: autopilotSettings.organizationId,
      set: { ...values, ...onboarded },
    });
  if (input.approvals || !input.enabled) {
    await cancelHoldsAfterSettingsChange(input.organizationId, {
      enabled: input.enabled,
      approvals: input.approvals ?? AUTOPILOT_DEFAULT_APPROVALS,
    });
  }
}

/**
 * Starts onboarding over: Autopilot is paused and the workspace counts as
 * not onboarded, so Ollie asks everything again. Settings stay until the
 * new setup saves over them.
 */
export async function resetAutopilotOnboarding(organizationId: string) {
  await db
    .update(autopilotSettings)
    .set({ enabled: false, onboardedAt: null, onboardedBy: null })
    .where(eq(autopilotSettings.organizationId, organizationId));
  await cancelHoldsAfterSettingsChange(organizationId, {
    enabled: false,
    approvals: AUTOPILOT_DEFAULT_APPROVALS,
  });
}

export async function setAutopilotJob(
  organizationId: string,
  kind: AutopilotJobKind,
  enabled: boolean
) {
  await updateAutopilotSettings(organizationId, { jobs: { [kind]: enabled } });
}

/**
 * Changes only the settings it names and leaves the rest as saved, so two
 * changes made at once can't undo each other. Approvals and jobs merge per
 * key in the database.
 */
export async function updateAutopilotSettings(
  organizationId: string,
  patch: Omit<z.infer<typeof autopilotUpdateInputSchema>, "organizationId"> & {
    timezone?: string;
    jobs?: Partial<Record<AutopilotJobKind, boolean>>;
  }
) {
  if (patch.slack) {
    await assertSlackConnected(organizationId, patch.slack.integrationId);
  }
  const site = patch.siteId
    ? await loadSiteTarget(organizationId, patch.siteId)
    : null;
  const repository = site?.repository ?? patch.repository;
  const jobs = Object.entries(patch.jobs ?? {}).filter(
    (entry): entry is [AutopilotJobKind, boolean] =>
      typeof entry[1] === "boolean"
  );
  const approvals = Object.entries(patch.approvals ?? {}).filter(
    (entry) => entry[1] !== undefined
  );
  const values = {
    ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
    ...(patch.siteId === undefined ? {} : { siteId: patch.siteId }),
    ...(repository === undefined
      ? {}
      : {
          repositoryOwner: repository?.owner ?? null,
          repositoryName: repository?.name ?? null,
          repositoryBranch: repository?.branch ?? null,
        }),
    ...(site ? { contentPath: site.contentPath } : {}),
    ...(!site && patch.contentPath !== undefined
      ? { contentPath: toContentPath(patch.contentPath) }
      : {}),
    ...(patch.slack === undefined
      ? {}
      : {
          slackIntegrationId: patch.slack?.integrationId ?? null,
          slackChannelId: patch.slack?.channelId ?? null,
          slackChannelName: patch.slack?.channelName ?? null,
        }),
    ...(patch.briefHour === undefined ? {} : { briefHour: patch.briefHour }),
    ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
    ...(patch.stalePullRequestDays === undefined
      ? {}
      : { stalePullRequestDays: patch.stalePullRequestDays }),
    ...(patch.draftEmails ? { draftEmails: patch.draftEmails } : {}),
    ...(patch.reviewers === undefined
      ? {}
      : { reviewers: normalizeAutopilotReviewers(patch.reviewers) }),
    ...(approvals.length > 0
      ? {
          approvals: sql`coalesce(${autopilotSettings.approvals}, ${JSON.stringify(AUTOPILOT_DEFAULT_APPROVALS)}::jsonb) || ${JSON.stringify(Object.fromEntries(approvals))}::jsonb`,
        }
      : {}),
    ...(jobs.length > 0
      ? {
          jobs: sql`${autopilotSettings.jobs} || ${JSON.stringify(Object.fromEntries(jobs))}::jsonb`,
        }
      : {}),
  };
  if (Object.keys(values).length === 0) {
    throw new AutopilotSettingsError("Change at least one setting.");
  }
  const [updated] = await db
    .update(autopilotSettings)
    .set(values)
    .where(eq(autopilotSettings.organizationId, organizationId))
    .returning({
      organizationId: autopilotSettings.organizationId,
      enabled: autopilotSettings.enabled,
      approvals: autopilotSettings.approvals,
    });
  if (!updated) {
    throw new AutopilotSettingsError(SET_UP_FIRST);
  }
  if (patch.enabled === false || approvals.length > 0) {
    await cancelHoldsAfterSettingsChange(organizationId, {
      enabled: updated.enabled,
      approvals: { ...AUTOPILOT_DEFAULT_APPROVALS, ...updated.approvals },
    });
  }
}
