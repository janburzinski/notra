import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import { autopilotSettings, slackIntegrations } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { AUTOPILOT_SLACK_KIND_LABELS } from "@/constants/autopilot-slack";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { postAutopilotSlackMessage } from "@/lib/autopilot/slack";
import type { AutopilotFindingRow as FindingRow } from "@/types/autopilot-runtime";
import type { SlackBlock } from "@/types/autopilot-slack";
import { autopilotSlackMessageId } from "@/utils/autopilot-delivery";
import { escapeSlackText } from "@/utils/autopilot-slack";

function findingUrl(slug: string, findingId: string, action?: string) {
  const base = `${getAppUrl() ?? ""}/${slug}${AUTOPILOT_NAV_LINK}`;
  const params = new URLSearchParams({ finding: findingId });
  if (action) {
    params.set("action", action);
  }
  return `${base}?${params.toString()}`;
}

function findingBlocks(slug: string, finding: FindingRow): SlackBlock[] {
  const buttons: SlackBlock[] = [
    {
      type: "button",
      style: "primary",
      text: {
        type: "plain_text",
        text: finding.status === "suggested" ? "Review idea" : "Merge",
      },
      url:
        finding.status === "suggested"
          ? `${getAppUrl() ?? ""}/${slug}${AUTOPILOT_NAV_LINK}/findings/${finding.id}`
          : findingUrl(slug, finding.id, "merge"),
      action_id: `autopilot_merge_${finding.id}`,
    },
  ];
  if (finding.pullRequestUrl) {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: "View diff" },
      url: `${finding.pullRequestUrl}/files`,
      action_id: `autopilot_diff_${finding.id}`,
    });
  }
  buttons.push({
    type: "button",
    text: { type: "plain_text", text: "Dismiss" },
    url: findingUrl(slug, finding.id, "dismiss"),
    action_id: `autopilot_dismiss_${finding.id}`,
  });
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${escapeSlackText(finding.title).slice(0, 300)}*\n${escapeSlackText(finding.summary).slice(0, 2000)}${finding.status === "suggested" ? "\nDismiss this idea to prevent automatic writing." : ""}${finding.pullRequestUrl ? `\n<${finding.pullRequestUrl}|${finding.repository}#${finding.pullRequestNumber}>` : ""}`,
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: AUTOPILOT_SLACK_KIND_LABELS[finding.kind] },
      ],
    },
    { type: "actions", elements: buttons },
  ];
}

export function buildAutopilotBrief(params: {
  organizationSlug: string;
  proposed: FindingRow[];
  suggested?: FindingRow[];
  merged: FindingRow[];
  insights: string[];
}): { text: string; blocks: SlackBlock[] } | null {
  const {
    organizationSlug,
    proposed,
    merged,
    insights,
    suggested = [],
  } = params;
  if (
    proposed.length === 0 &&
    suggested.length === 0 &&
    merged.length === 0 &&
    insights.length === 0
  ) {
    return null;
  }
  const headline =
    proposed.length > 0
      ? `Good morning. ${proposed.length === 1 ? "One change is" : `${proposed.length} changes are`} ready to merge.`
      : "Good morning. Nothing new to merge today.";
  const blocks: SlackBlock[] = [
    { type: "section", text: { type: "mrkdwn", text: headline } },
  ];
  // Keep below Slack's 50-block message limit; the dashboard lists the rest.
  for (const finding of [...proposed, ...suggested].slice(0, 10)) {
    blocks.push(
      { type: "divider" },
      ...findingBlocks(organizationSlug, finding)
    );
  }
  const footer = [
    ...merged.map((finding) => `Merged since the last brief: ${finding.title}`),
    ...insights,
  ];
  if (footer.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "context",
        // A context block permits at most ten elements and 3,000 chars per text.
        elements: [
          {
            type: "mrkdwn",
            text: escapeSlackText(footer.join("\n")).slice(0, 2800),
          },
        ],
      }
    );
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `<${getAppUrl() ?? ""}/${organizationSlug}${AUTOPILOT_NAV_LINK}|Open Autopilot in Notra>`,
      },
    ],
  });
  return { text: headline, blocks };
}

/** Posts to the Slack channel picked for Autopilot; returns null when none is set. */
export async function postAutopilotBrief(
  organizationId: string,
  brief: { text: string; blocks: SlackBlock[] },
  runId?: string
) {
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    return null;
  }
  const [destination] = await db
    .select({
      teamId: slackIntegrations.slackTeamId,
      encryptedBotToken: slackIntegrations.encryptedBotToken,
      channelId: autopilotSettings.slackChannelId,
    })
    .from(autopilotSettings)
    .innerJoin(
      slackIntegrations,
      and(
        eq(slackIntegrations.id, autopilotSettings.slackIntegrationId),
        eq(slackIntegrations.organizationId, organizationId),
        eq(slackIntegrations.enabled, true)
      )
    )
    .where(
      and(
        eq(autopilotSettings.organizationId, organizationId),
        eq(autopilotSettings.enabled, true)
      )
    );
  if (!destination?.channelId) {
    return null;
  }
  const delivered = await postAutopilotSlackMessage({
    organizationId,
    encryptedBotToken: destination.encryptedBotToken,
    destination: {
      teamId: destination.teamId,
      channelId: destination.channelId,
    },
    text: brief.text,
    blocks: brief.blocks,
    clientMessageId: runId ? autopilotSlackMessageId(runId) : undefined,
  });
  if (runId) {
    await createAutopilotLogger({ organizationId, runId }, null).action(
      "Delivered the Slack message",
      {
        url: `https://app.slack.com/client/${encodeURIComponent(delivered.teamId)}/${encodeURIComponent(delivered.channel)}/thread/${encodeURIComponent(delivered.channel)}-${encodeURIComponent(delivered.ts)}`,
      }
    );
  }
  return delivered.ts;
}
