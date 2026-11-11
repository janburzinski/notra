import { db } from "@notra/db/drizzle";
import {
  autopilotSettings,
  projects,
  slackIntegrations,
} from "@notra/db/schema";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import type { autopilotSaveInputSchema } from "@notra/schemas/dashboard/autopilot";
import { and, eq, sql } from "drizzle-orm";
import type * as z from "zod";

import { normalizeRepositoryDirectory } from "@/utils/autopilot-paths";

export class AutopilotSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutopilotSettingsError";
  }
}

const SET_UP_FIRST = "Set up Autopilot first.";

export async function saveAutopilotSettings(
  input: z.infer<typeof autopilotSaveInputSchema>
) {
  if (input.slack) {
    const integration = await db.query.slackIntegrations.findFirst({
      columns: { id: true },
      where: and(
        eq(slackIntegrations.id, input.slack.integrationId),
        eq(slackIntegrations.organizationId, input.organizationId),
        eq(slackIntegrations.enabled, true)
      ),
    });
    if (!integration) {
      throw new AutopilotSettingsError(
        "That Slack workspace is not connected."
      );
    }
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
  const contentPath = input.contentPath
    ? normalizeRepositoryDirectory(input.contentPath)
    : null;
  if (input.contentPath && !contentPath) {
    throw new AutopilotSettingsError(
      "Use a folder path inside the repository."
    );
  }
  const values = {
    enabled: input.enabled,
    repositoryOwner: input.repository?.owner ?? null,
    repositoryName: input.repository?.name ?? null,
    repositoryBranch: input.repository?.branch ?? null,
    contentPath: contentPath || null,
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
  await db
    .insert(autopilotSettings)
    .values({ organizationId: input.organizationId, ...values })
    .onConflictDoUpdate({
      target: autopilotSettings.organizationId,
      set: values,
    });
}

export async function setAutopilotJob(
  organizationId: string,
  kind: AutopilotJobKind,
  enabled: boolean
) {
  await updateAutopilotSettings(organizationId, { jobs: { [kind]: enabled } });
}

export async function updateAutopilotSettings(
  organizationId: string,
  patch: {
    enabled?: boolean;
    briefHour?: number;
    timezone?: string;
    jobs?: Partial<Record<AutopilotJobKind, boolean>>;
  }
) {
  const jobs = Object.entries(patch.jobs ?? {}).filter(
    (entry): entry is [AutopilotJobKind, boolean] =>
      typeof entry[1] === "boolean"
  );
  const values = {
    ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
    ...(patch.briefHour === undefined ? {} : { briefHour: patch.briefHour }),
    ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
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
    .returning({ organizationId: autopilotSettings.organizationId });
  if (!updated) {
    throw new AutopilotSettingsError(SET_UP_FIRST);
  }
}
