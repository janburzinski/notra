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
import { findingDisplayTitle } from "@/utils/autopilot-findings";
import { compactSlackText } from "@/utils/autopilot-slack";

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
  const title = compactSlackText(findingDisplayTitle(finding), 100);
  const target = finding.evidence.target;
  const summary = compactSlackText(
    target?.kind === "prompt"
      ? `Your brand appears in ${Math.round(target.before * 100)}% of AI answers for this question.${finding.evidence.competitors?.length ? ` Competing with ${finding.evidence.competitors.slice(0, 3).join(", ")}.` : ""}`
      : finding.kind === "commits"
        ? "A blog post based on your recently shipped changes."
        : finding.summary,
    180
  );
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n${summary}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${AUTOPILOT_SLACK_KIND_LABELS[finding.kind]}${finding.pullRequestUrl ? ` · <${finding.pullRequestUrl}|PR #${finding.pullRequestNumber}>` : ""}${finding.status === "suggested" ? " · Writes automatically unless dismissed" : ""}`,
        },
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
}): { text: string; blocks: SlackBlock[]; findingIds: string[] } | null {
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
  const headline = `Autopilot · ${
    [
      proposed.length > 0 ? `${proposed.length} ready to merge` : null,
      suggested.length > 0
        ? `${suggested.length} ${suggested.length === 1 ? "idea" : "ideas"}`
        : null,
      merged.length > 0 ? `${merged.length} merged` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Daily insights"
  }`;
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Autopilot daily brief" },
    },
    { type: "context", elements: [{ type: "mrkdwn", text: headline }] },
  ];
  // Keep the digest short; the dashboard lists the rest.
  const visible = [...proposed, ...suggested].slice(0, 5);
  for (const [index, finding] of visible.entries()) {
    if (index === 0 || finding.status !== visible[index - 1]?.status) {
      blocks.push(
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              finding.status === "suggested"
                ? "*Ideas for your next post*"
                : "*Ready to merge*",
          },
        }
      );
    } else {
      blocks.push({ type: "divider" });
    }
    blocks.push(...findingBlocks(organizationSlug, finding));
  }
  const footer = [
    ...(merged.length > 0
      ? [
          `*Merged since your last brief*\n${merged
            .slice(0, 3)
            .map((finding) => `• ${compactSlackText(finding.title, 100)}`)
            .join(
              "\n"
            )}${merged.length > 3 ? `\n+${merged.length - 3} more in Notra` : ""}`,
        ]
      : []),
    ...(insights.length > 0
      ? [
          `*Insights*\n${insights
            .slice(0, 3)
            .map((insight) => `• ${compactSlackText(insight, 180)}`)
            .join(
              "\n"
            )}${insights.length > 3 ? `\n+${insights.length - 3} more in Notra` : ""}`,
        ]
      : []),
  ];
  if (footer.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "context",
        // A context block permits at most ten elements and 3,000 chars per text.
        elements: footer.map((text) => ({ type: "mrkdwn", text })),
      }
    );
  }
  const remaining = proposed.length + suggested.length - visible.length;
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `${remaining > 0 ? `+${remaining} more ${remaining === 1 ? "item" : "items"} · ` : ""}<${getAppUrl() ?? ""}/${organizationSlug}${AUTOPILOT_NAV_LINK}|Open Autopilot in Notra>`,
      },
    ],
  });
  return {
    text: headline,
    blocks,
    findingIds: visible.map((finding) => finding.id),
  };
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
