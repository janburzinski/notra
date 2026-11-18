import type { ToolSet } from "@notra/ai/types/orchestration";
import { toolDescription } from "@notra/ai/utils/description";
import { db } from "@notra/db/drizzle";
import { brandSettings, githubIntegrations } from "@notra/db/schema";
import {
  configureGeoAlertBodySchema,
  GEO_ALERT_DEFAULT_THRESHOLDS,
  GEO_ALERT_SOURCE_TYPE,
  type GeoAlertActions,
} from "@notra/schemas/dashboard/automation/geo-alerts";
import {
  configureEventTriggerBodySchema,
  configureScheduleBodySchema,
} from "@notra/schemas/dashboard/integrations";
import { type Tool, tool } from "ai";
import { and, eq } from "drizzle-orm";
import * as z from "zod";

import {
  AUTOMATION_CHAT_APPROVAL_TOOL_NAMES,
  AUTOMATION_CHAT_DESCRIPTION,
  AUTOMATION_CHAT_TOOL_NAMES as NAMES,
  AUTOMATION_CHAT_UNTITLED_SCHEDULE,
} from "@/constants/automation-chat-tools";
import { AutomationServiceError } from "@/lib/automation/errors";
import {
  createGeoAlert,
  deleteGeoAlert,
  findGeoAlert,
  loadGeoAlertDestinations,
  sendGeoAlertTestFor,
  updateGeoAlert,
} from "@/lib/automation/geo-alert-service";
import { listGeoAlertAutomations } from "@/lib/automation/geo-alerts";
import {
  createEventTrigger,
  deleteAutomationTrigger,
  findTriggerInOrganization,
  listEventTriggers,
  listScheduleTriggers,
  runScheduleNow,
  updateEventTrigger,
  updateScheduleTrigger,
} from "@/lib/automation/triggers";
import { resolveAiProductAccess } from "@/lib/billing/ai-product-access";
import {
  automationIdInputSchema,
  createEventTriggerInputSchema,
  createGeoAlertInputSchema,
  listAutomationsInputSchema,
  setAutomationEnabledInputSchema,
  updateEventTriggerInputSchema,
  updateGeoAlertInputSchema,
  updateScheduleInputSchema,
} from "@/schemas/automation-chat-tools";
import type { GeoAlertAutomation } from "@/types/automation/geo-alerts";
import type { AutomationActor } from "@/types/automation/service";
import type { Trigger } from "@/types/triggers/triggers";

type OutputConfig = NonNullable<Trigger["outputConfig"]>;
type OutputConfigPatch = {
  instructions?: string;
  brandVoiceId?: string | null;
  notify?: OutputConfig["notify"];
};

const AUTO_PUBLISH_TYPES = new Set(["changelog", "blog_post"]);

/** Refusals go back to the agent as a result it can explain or fix. */
async function runAutomationTool<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AutomationServiceError) {
      return { status: "error" as const, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { status: "error" as const, message: z.prettifyError(error) };
    }
    throw error;
  }
}

async function assertCanChangeAutomations(organizationId: string) {
  const { hasAccess } = await resolveAiProductAccess(organizationId);
  if (!hasAccess) {
    throw new AutomationServiceError(
      "BAD_REQUEST",
      "Automations need an active subscription. Point the user to Settings, Billing."
    );
  }
}

async function loadRepositoryNames(organizationId: string) {
  const rows = await db
    .select({
      id: githubIntegrations.id,
      owner: githubIntegrations.owner,
      repo: githubIntegrations.repo,
    })
    .from(githubIntegrations)
    .where(eq(githubIntegrations.organizationId, organizationId));
  return new Map(
    rows.map((row) => [
      row.id,
      row.owner && row.repo ? `${row.owner}/${row.repo}` : row.id,
    ])
  );
}

async function assertRepositoriesConnected(
  organizationId: string,
  repositoryIds: readonly string[]
) {
  const names = await loadRepositoryNames(organizationId);
  const missing = repositoryIds.filter((id) => !names.has(id));
  if (missing.length > 0) {
    throw new AutomationServiceError(
      "INTEGRATION_NOT_FOUND",
      `These repositories are not connected to this workspace: ${missing.join(", ")}. Use integrationId values from getAvailableIntegrations.`
    );
  }
}

async function assertBrandVoice(
  organizationId: string,
  brandVoiceId: string | null | undefined
) {
  if (!brandVoiceId) {
    return;
  }
  const voice = await db.query.brandSettings.findFirst({
    where: and(
      eq(brandSettings.organizationId, organizationId),
      eq(brandSettings.id, brandVoiceId)
    ),
    columns: { id: true },
  });
  if (!voice) {
    throw new AutomationServiceError(
      "BAD_REQUEST",
      "That brand voice does not belong to this workspace. Use an id from listBrandIdentities, or null for the default."
    );
  }
}

function mergeOutputConfig(
  existing: Trigger["outputConfig"],
  patch: OutputConfigPatch
): OutputConfig | undefined {
  const next: OutputConfig = { ...existing };
  if (patch.instructions !== undefined) {
    next.instructions = patch.instructions || undefined;
  }
  if (patch.brandVoiceId !== undefined) {
    next.brandVoiceId = patch.brandVoiceId ?? undefined;
  }
  if (patch.notify) {
    next.notify = patch.notify;
  }
  const entries = Object.entries(next).filter(
    ([, value]) => value !== undefined
  );
  return entries.length > 0
    ? (Object.fromEntries(entries) as OutputConfig)
    : undefined;
}

function allowedAutoPublish(outputType: string, autoPublish: boolean) {
  return autoPublish && AUTO_PUBLISH_TYPES.has(outputType);
}

function repositoriesOf(trigger: Trigger, names: Map<string, string>) {
  return trigger.targets.repositoryIds.map((id) => ({
    id,
    name: names.get(id) ?? id,
  }));
}

function summarizeSchedule(trigger: Trigger, names: Map<string, string>) {
  return {
    kind: "schedule" as const,
    id: trigger.id,
    name: trigger.name,
    enabled: trigger.enabled,
    outputType: trigger.outputType,
    cadence: trigger.sourceConfig.cron,
    timezone: "UTC",
    lookbackWindow: trigger.lookbackWindow,
    repositories: repositoriesOf(trigger, names),
    linearIntegrationIds: trigger.targets.linearIntegrationIds,
    instructions: trigger.outputConfig?.instructions,
    brandVoiceId: trigger.outputConfig?.brandVoiceId,
    notify: trigger.outputConfig?.notify,
    autoPublish: trigger.autoPublish,
  };
}

function summarizeEventTrigger(trigger: Trigger, names: Map<string, string>) {
  return {
    kind: "event_trigger" as const,
    id: trigger.id,
    enabled: trigger.enabled,
    eventTypes: trigger.sourceConfig.eventTypes,
    includePreReleases: trigger.sourceConfig.includePreReleases,
    outputType: trigger.outputType,
    repositories: repositoriesOf(trigger, names),
    instructions: trigger.outputConfig?.instructions,
    brandVoiceId: trigger.outputConfig?.brandVoiceId,
    notify: trigger.outputConfig?.notify,
    autoPublish: trigger.autoPublish,
  };
}

function summarizeGeoAlert(alert: GeoAlertAutomation) {
  return {
    kind: "geo_alert" as const,
    id: alert.id,
    name: alert.name,
    enabled: alert.enabled,
    signal: alert.sourceConfig.signal,
    projectId: alert.sourceConfig.projectId,
    threshold:
      alert.sourceConfig.threshold ??
      GEO_ALERT_DEFAULT_THRESHOLDS[alert.sourceConfig.signal],
    actions: alert.actions,
  };
}

/** Channels an alert would use that can't deliver yet. */
async function alertDeliveryWarnings(
  organizationId: string,
  actions: GeoAlertActions
) {
  const destinations = await loadGeoAlertDestinations(organizationId);
  const warnings: string[] = [];
  if (actions.slack && !destinations.slackConnected) {
    warnings.push(
      "Slack has no notification channel yet, so Slack alerts won't arrive until one is set in Integrations."
    );
  }
  if (actions.webhook && destinations.webhookEndpointCount === 0) {
    warnings.push(
      "No webhook endpoint subscribes to geo.alert.triggered, so webhook alerts go nowhere until one does."
    );
  }
  return warnings;
}

async function findSchedule(organizationId: string, scheduleId: string) {
  const { triggers } = await listScheduleTriggers(organizationId);
  const schedule = triggers.find((trigger) => trigger.id === scheduleId);
  if (!schedule) {
    throw new AutomationServiceError(
      "NOT_FOUND",
      "Schedule not found. Call listAutomations for the current ids."
    );
  }
  return schedule;
}

async function findEventTrigger(organizationId: string, triggerId: string) {
  const { triggers } = await listEventTriggers(organizationId);
  const trigger = triggers.find((item) => item.id === triggerId);
  if (!trigger) {
    throw new AutomationServiceError(
      "NOT_FOUND",
      "Event trigger not found. Call listAutomations for the current ids."
    );
  }
  return trigger;
}

function scheduleBody(
  existing: Trigger,
  patch: z.infer<typeof updateScheduleInputSchema> & { enabled?: boolean }
) {
  const cronPatch = Object.fromEntries(
    Object.entries({
      frequency: patch.frequency,
      hour: patch.hour,
      minute: patch.minute,
      dayOfWeek: patch.dayOfWeek,
      dayOfMonth: patch.dayOfMonth,
      intervalDays: patch.intervalDays,
    }).filter(([, value]) => value !== undefined)
  );
  const outputType = patch.outputType ?? existing.outputType;
  return configureScheduleBodySchema.parse({
    name: patch.name ?? existing.name,
    sourceType: "cron",
    sourceConfig: {
      cron: {
        ...(existing.sourceConfig.cron ?? {
          frequency: "daily",
          hour: 9,
          minute: 0,
        }),
        ...cronPatch,
      },
    },
    targets: {
      repositoryIds: patch.repositoryIds ?? existing.targets.repositoryIds,
      linearIntegrationIds: existing.targets.linearIntegrationIds,
    },
    outputType,
    outputConfig: mergeOutputConfig(existing.outputConfig, patch),
    enabled: patch.enabled ?? existing.enabled,
    autoPublish: allowedAutoPublish(
      outputType,
      patch.autoPublish ?? existing.autoPublish
    ),
    lookbackWindow: patch.lookbackWindow ?? existing.lookbackWindow,
  });
}

function eventTriggerBody(
  existing: Trigger,
  patch: Omit<
    z.infer<typeof updateEventTriggerInputSchema>,
    "eventTriggerId"
  > & {
    enabled?: boolean;
  }
) {
  const outputType = patch.outputType ?? existing.outputType;
  return configureEventTriggerBodySchema.parse({
    sourceType: "github_webhook",
    sourceConfig: {
      eventTypes: patch.eventTypes ?? existing.sourceConfig.eventTypes,
      includePreReleases:
        patch.includePreReleases ?? existing.sourceConfig.includePreReleases,
      ignoreCommitPatterns: existing.sourceConfig.ignoreCommitPatterns,
    },
    targets: {
      repositoryIds: patch.repositoryIds ?? existing.targets.repositoryIds,
    },
    outputType,
    outputConfig: mergeOutputConfig(existing.outputConfig, patch),
    enabled: patch.enabled ?? existing.enabled,
    autoPublish: allowedAutoPublish(
      outputType,
      patch.autoPublish ?? existing.autoPublish
    ),
  });
}

function geoAlertBody(
  existing: GeoAlertAutomation,
  patch: Omit<z.infer<typeof updateGeoAlertInputSchema>, "alertId"> & {
    enabled?: boolean;
  }
) {
  const signal = patch.signal ?? existing.sourceConfig.signal;
  const hasThreshold = GEO_ALERT_DEFAULT_THRESHOLDS[signal] !== undefined;
  const threshold =
    patch.threshold === undefined
      ? existing.sourceConfig.threshold
      : (patch.threshold ?? undefined);
  return configureGeoAlertBodySchema.parse({
    name: patch.name ?? existing.name,
    sourceConfig: {
      signal,
      projectId:
        patch.projectId === undefined
          ? existing.sourceConfig.projectId
          : patch.projectId,
      threshold: hasThreshold ? threshold : undefined,
    },
    actions: patch.actions ?? existing.actions,
    enabled: patch.enabled ?? existing.enabled,
  });
}

function readTools(organizationId: string): Record<string, Tool> {
  return {
    [NAMES.list]: tool({
      description: toolDescription({
        toolName: NAMES.list,
        intro:
          "Lists every automation in this workspace with its id: content schedules, GitHub event triggers and GEO alerts, plus which alert channels are connected.",
        whenToUse:
          "Before changing, pausing, running or deleting an automation, before creating one that might already exist, or when the user asks what runs automatically.",
      }),
      inputSchema: listAutomationsInputSchema,
      execute: async () => {
        const [schedules, events, alerts, destinations, names] =
          await Promise.all([
            listScheduleTriggers(organizationId),
            listEventTriggers(organizationId),
            listGeoAlertAutomations(organizationId),
            loadGeoAlertDestinations(organizationId),
            loadRepositoryNames(organizationId),
          ]);
        return {
          schedules: schedules.triggers.map((trigger) =>
            summarizeSchedule(trigger, names)
          ),
          eventTriggers: events.triggers.map((trigger) =>
            summarizeEventTrigger(trigger, names)
          ),
          geoAlerts: alerts.map(summarizeGeoAlert),
          alertChannels: {
            slack: destinations.slackConnected,
            emailRecipients: destinations.ownerCount,
            webhookEndpoints: destinations.webhookEndpointCount,
          },
        };
      },
    }),
  };
}

function manageTools(actor: AutomationActor): Record<string, Tool> {
  const { organizationId } = actor;
  return {
    [NAMES.updateSchedule]: tool({
      description: toolDescription({
        toolName: NAMES.updateSchedule,
        intro:
          "Changes a content schedule: name, cadence, output type, repositories, lookback window, instructions, brand voice, notifications or auto-publish.",
        whenToUse:
          "The user wants an existing schedule to run at another time, draft something else or read other repositories.",
        whenNotToUse: `Only pausing or resuming it: use ${NAMES.setEnabled}.`,
        usageNotes:
          "Pass only the fields that change; the rest stay as they are. Times are UTC.",
      }),
      inputSchema: updateScheduleInputSchema,
      execute: (input) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          const existing = await findSchedule(organizationId, input.scheduleId);
          await Promise.all([
            input.repositoryIds
              ? assertRepositoriesConnected(organizationId, input.repositoryIds)
              : undefined,
            assertBrandVoice(organizationId, input.brandVoiceId),
          ]);
          const [{ trigger }, names] = await Promise.all([
            updateScheduleTrigger(
              actor,
              existing.id,
              scheduleBody(existing, input),
              AUTOMATION_CHAT_UNTITLED_SCHEDULE
            ),
            loadRepositoryNames(organizationId),
          ]);
          return {
            status: "updated" as const,
            automation: summarizeSchedule(trigger, names),
          };
        }),
    }),
    [NAMES.runSchedule]: tool({
      description: toolDescription({
        toolName: NAMES.runSchedule,
        intro:
          "Starts one run of a content schedule now instead of waiting for its next time. The draft appears in Content when the run finishes.",
        whenToUse: "The user wants a schedule's draft right away.",
        usageNotes: "The schedule must be enabled. A run spends AI credits.",
      }),
      inputSchema: automationIdInputSchema,
      execute: ({ automationId }) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          const result = await runScheduleNow(actor, automationId);
          return { status: "started" as const, ...result };
        }),
    }),
    [NAMES.createEventTrigger]: tool({
      description: toolDescription({
        toolName: NAMES.createEventTrigger,
        intro:
          "Creates an automation that drafts content whenever a GitHub release is published or commits are pushed in the chosen repositories.",
        whenToUse:
          'The user wants content tied to shipping, like "write a changelog every time we release".',
        whenNotToUse: "Content on a fixed cadence: use createSchedule.",
        usageNotes:
          "Call listAutomations first to avoid duplicates. Ask which repository when more than one is connected and the user named none.",
      }),
      inputSchema: createEventTriggerInputSchema,
      execute: (input) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          await Promise.all([
            assertRepositoriesConnected(organizationId, input.repositoryIds),
            assertBrandVoice(organizationId, input.brandVoiceId),
          ]);
          const [{ trigger }, names] = await Promise.all([
            createEventTrigger(
              actor,
              configureEventTriggerBodySchema.parse({
                sourceType: "github_webhook",
                sourceConfig: {
                  eventTypes: input.eventTypes,
                  includePreReleases: input.includePreReleases,
                },
                targets: { repositoryIds: input.repositoryIds },
                outputType: input.outputType,
                outputConfig: mergeOutputConfig(undefined, input),
                enabled: true,
                autoPublish: allowedAutoPublish(
                  input.outputType,
                  input.autoPublish
                ),
              })
            ),
            loadRepositoryNames(organizationId),
          ]);
          return {
            status: "created" as const,
            automation: summarizeEventTrigger(trigger, names),
          };
        }),
    }),
    [NAMES.updateEventTrigger]: tool({
      description: toolDescription({
        toolName: NAMES.updateEventTrigger,
        intro:
          "Changes a GitHub event trigger: events, repositories, output type, instructions, brand voice, notifications or auto-publish.",
        whenNotToUse: `Only pausing or resuming it: use ${NAMES.setEnabled}.`,
        usageNotes: "Pass only the fields that change.",
      }),
      inputSchema: updateEventTriggerInputSchema,
      execute: ({ eventTriggerId, ...patch }) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          const existing = await findEventTrigger(
            organizationId,
            eventTriggerId
          );
          await Promise.all([
            patch.repositoryIds
              ? assertRepositoriesConnected(organizationId, patch.repositoryIds)
              : undefined,
            assertBrandVoice(organizationId, patch.brandVoiceId),
          ]);
          const [{ trigger }, names] = await Promise.all([
            updateEventTrigger(
              actor,
              existing.id,
              eventTriggerBody(existing, patch)
            ),
            loadRepositoryNames(organizationId),
          ]);
          return {
            status: "updated" as const,
            automation: summarizeEventTrigger(trigger, names),
          };
        }),
    }),
    [NAMES.createGeoAlert]: tool({
      description: toolDescription({
        toolName: NAMES.createGeoAlert,
        intro:
          "Creates a GEO alert that notifies Slack, the workspace owners by email or a webhook when AI visibility changes after a scan.",
        whenToUse:
          'The user wants to hear about visibility changes, like "tell me when we lose mentions" or "send a summary after every scan".',
        usageNotes:
          "Call listAutomations first: there is one alert per signal, project and threshold, and it shows which channels are connected. Name it after what it watches.",
      }),
      inputSchema: createGeoAlertInputSchema,
      execute: (input) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          const body = configureGeoAlertBodySchema.parse({
            name: input.name,
            sourceConfig: {
              signal: input.signal,
              projectId: input.projectId,
              threshold:
                GEO_ALERT_DEFAULT_THRESHOLDS[input.signal] === undefined
                  ? undefined
                  : input.threshold,
            },
            actions: input.actions,
            enabled: true,
          });
          const [{ alert }, warnings] = await Promise.all([
            createGeoAlert(actor, body),
            alertDeliveryWarnings(organizationId, body.actions),
          ]);
          return {
            status: "created" as const,
            automation: summarizeGeoAlert(alert),
            warnings,
          };
        }),
    }),
    [NAMES.updateGeoAlert]: tool({
      description: toolDescription({
        toolName: NAMES.updateGeoAlert,
        intro:
          "Changes a GEO alert: name, signal, project, threshold or where it is sent.",
        whenNotToUse: `Only pausing or resuming it: use ${NAMES.setEnabled}.`,
        usageNotes:
          "Pass only the fields that change. threshold null goes back to the default.",
      }),
      inputSchema: updateGeoAlertInputSchema,
      execute: ({ alertId, ...patch }) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          const existing = await findGeoAlert(organizationId, alertId);
          const body = geoAlertBody(existing, patch);
          const [{ alert }, warnings] = await Promise.all([
            updateGeoAlert(actor, existing.id, body),
            alertDeliveryWarnings(organizationId, body.actions),
          ]);
          return {
            status: "updated" as const,
            automation: summarizeGeoAlert(alert),
            warnings,
          };
        }),
    }),
    [NAMES.testGeoAlert]: tool({
      description: toolDescription({
        toolName: NAMES.testGeoAlert,
        intro:
          "Sends a sample of a GEO alert to its channels so the user can see what it looks like.",
        whenToUse:
          "Right after creating an alert when the user wants to check it, or when they ask to test one.",
      }),
      inputSchema: automationIdInputSchema,
      execute: ({ automationId }) =>
        runAutomationTool(async () => {
          const { delivery } = await sendGeoAlertTestFor(
            organizationId,
            automationId
          );
          return { status: "sent" as const, delivery };
        }),
    }),
    [NAMES.setEnabled]: tool({
      description: toolDescription({
        toolName: NAMES.setEnabled,
        intro:
          "Pauses or resumes any automation: a schedule, an event trigger or a GEO alert. Its settings stay as they are.",
        whenToUse:
          'The user says "pause", "stop for now", "turn off" or "resume".',
        whenNotToUse: `The user wants it gone for good: use ${NAMES.delete}.`,
      }),
      inputSchema: setAutomationEnabledInputSchema,
      execute: ({ automationId, enabled }) =>
        runAutomationTool(async () => {
          await assertCanChangeAutomations(organizationId);
          const row = await findTriggerInOrganization(
            organizationId,
            automationId
          );
          if (row.sourceType === GEO_ALERT_SOURCE_TYPE) {
            const existing = await findGeoAlert(organizationId, row.id);
            const { alert } = await updateGeoAlert(
              actor,
              row.id,
              geoAlertBody(existing, { enabled })
            );
            return {
              status: "updated" as const,
              automation: summarizeGeoAlert(alert),
            };
          }
          const names = await loadRepositoryNames(organizationId);
          if (row.sourceType === "cron") {
            const existing = await findSchedule(organizationId, row.id);
            const { trigger } = await updateScheduleTrigger(
              actor,
              row.id,
              scheduleBody(existing, { scheduleId: row.id, enabled }),
              AUTOMATION_CHAT_UNTITLED_SCHEDULE
            );
            return {
              status: "updated" as const,
              automation: summarizeSchedule(trigger, names),
            };
          }
          if (row.sourceType === "github_webhook") {
            const existing = await findEventTrigger(organizationId, row.id);
            const { trigger } = await updateEventTrigger(
              actor,
              row.id,
              eventTriggerBody(existing, { enabled })
            );
            return {
              status: "updated" as const,
              automation: summarizeEventTrigger(trigger, names),
            };
          }
          throw new AutomationServiceError(
            "BAD_REQUEST",
            "This automation can only be changed on the Automations page."
          );
        }),
    }),
    [NAMES.delete]: tool({
      description: toolDescription({
        toolName: NAMES.delete,
        intro:
          "Deletes a schedule, event trigger or GEO alert for good. Drafts it already made stay.",
        whenToUse:
          "The user explicitly asks to delete or remove an automation.",
        whenNotToUse: `They only want it to stop for a while: use ${NAMES.setEnabled}.`,
      }),
      inputSchema: automationIdInputSchema,
      execute: ({ automationId }) =>
        runAutomationTool(async () => {
          const row = await findTriggerInOrganization(
            organizationId,
            automationId
          );
          await (row.sourceType === GEO_ALERT_SOURCE_TYPE
            ? deleteGeoAlert(actor, row.id)
            : deleteAutomationTrigger(actor, row.id));
          return {
            status: "deleted" as const,
            automationId: row.id,
            name: row.name,
          };
        }),
    }),
  };
}

/** Schedules, event triggers and GEO alerts for the chat agent. */
export function buildAutomationChatTools(params: {
  organizationId: string;
  userId?: string;
}): ToolSet | undefined {
  const { organizationId, userId } = params;
  if (!userId) {
    return undefined;
  }
  return {
    descriptions: [AUTOMATION_CHAT_DESCRIPTION],
    tools: {
      ...readTools(organizationId),
      ...manageTools({ organizationId, userId }),
    },
    approvalToolNames: [...AUTOMATION_CHAT_APPROVAL_TOOL_NAMES],
  };
}
