import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotSettings,
  organizations,
  slackIntegrations,
} from "@notra/db/schema";
import { and, eq, sql } from "drizzle-orm";

import {
  AUTOPILOT_DEFAULT_TIMEZONE,
  AUTOPILOT_NAV_LINK,
} from "@/constants/autopilot";
import { AUTOPILOT_SLACK_KIND_LABELS } from "@/constants/autopilot-slack";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import { attachSitePreviews } from "@/lib/autopilot/sites";
import {
  callAutopilotSlack,
  postAutopilotSlackMessage,
} from "@/lib/autopilot/slack";
import { isAutopilotOffForOrganization } from "@/lib/billing/autopilot-entitlement";
import type { AutopilotFindingRow as FindingRow } from "@/types/autopilot-runtime";
import type {
  AutopilotBrief,
  AutopilotBriefDelivery,
  AutopilotFindingMessage,
  SlackBlock,
} from "@/types/autopilot-slack";
import { describeBriefCounts, slackThreadUrl } from "@/utils/autopilot-brief";
import { autopilotSlackMessageId } from "@/utils/autopilot-delivery";
import {
  findingDisplayTitle,
  findingSummary,
} from "@/utils/autopilot-findings";
import { formatAutopilotPublishAt } from "@/utils/autopilot-publish";
import { compactSlackText, slackMrkdwn } from "@/utils/autopilot-slack";

function bulletList(title: string, items: string[], limit = 3) {
  if (items.length === 0) {
    return null;
  }
  const more = items.length > limit ? `\n+${items.length - limit} more` : "";
  return `*${title}*\n${items
    .slice(0, limit)
    .map((item) => `• ${item}`)
    .join("\n")}${more}`;
}

function findingPageUrl(slug: string, findingId: string) {
  return `${getAppUrl() ?? ""}/${slug}${AUTOPILOT_NAV_LINK}/findings/${findingId}`;
}

function findingLine(slug: string, finding: FindingRow, timezone: string) {
  let state = "Ready to merge";
  if (finding.status === "suggested") {
    state = "Idea";
  } else if (finding.publishAt) {
    state = `Publishes ${formatAutopilotPublishAt(finding.publishAt, timezone)}`;
  }
  return `<${findingPageUrl(slug, finding.id)}|${compactSlackText(findingDisplayTitle(finding), 100)}> · ${state} · ${AUTOPILOT_SLACK_KIND_LABELS[finding.kind]}`;
}

function findingMessage(
  slug: string,
  finding: FindingRow,
  timezone: string
): AutopilotFindingMessage {
  const isIdea = finding.status === "suggested";
  const title = compactSlackText(findingDisplayTitle(finding), 100);
  const summary = compactSlackText(findingSummary(finding), 180);
  const findingUrl = findingPageUrl(slug, finding.id);
  const publishAt =
    !isIdea && finding.publishAt
      ? `Publishes ${formatAutopilotPublishAt(finding.publishAt, timezone)}`
      : null;
  const meta = [
    isIdea ? "Idea" : (publishAt ?? "Ready to merge"),
    AUTOPILOT_SLACK_KIND_LABELS[finding.kind],
    finding.pullRequestUrl
      ? `<${finding.pullRequestUrl}|PR #${finding.pullRequestNumber}>`
      : null,
    finding.pullRequestUrl
      ? `<${finding.pullRequestUrl}/files|View diff>`
      : null,
    finding.evidence.previewUrl
      ? `<${finding.evidence.previewUrl}|Preview>`
      : null,
  ].filter(Boolean);
  const hint = isIdea
    ? "React 👍 to write it or 👎 if you don't want it"
    : `React 👍 to merge${publishAt ? " now" : ""} or 👎 to close it`;
  const pullRequest = finding.pullRequestUrl
    ? `  ·  <${finding.pullRequestUrl}|PR #${finding.pullRequestNumber}>`
    : "";
  return {
    findingId: finding.id,
    status: isIdea ? "suggested" : "proposed",
    // Slack's plain text is all the agent reads of a thread, so it keeps the
    // whole item; people see one line, and the pre-filled 👍/👎 under it.
    text: `*${title}*\n${summary}\n${meta.join(" · ")} · <${findingUrl}|Open in Notra>\n${hint}`,
    blocks: [
      {
        type: "section",
        text: slackMrkdwn(
          `${isIdea ? "Idea: " : ""}*<${findingUrl}|${title}>*${pullRequest}${publishAt ? `  ·  ${publishAt}` : ""}`
        ),
      },
    ],
  };
}

export function buildAutopilotBrief(params: {
  organizationSlug: string;
  timezone: string;
  proposed: FindingRow[];
  suggested?: FindingRow[];
  merged: FindingRow[];
  insights: string[];
  /** The day's brief page; the message leads with its words and links to it. */
  page?: {
    url: string;
    headline: string;
    summary?: string;
    lead?: { findingId: string; why: string } | null;
  };
  recentDays?: { date: string; note: string }[];
}): AutopilotBrief | null {
  const {
    organizationSlug,
    timezone,
    proposed,
    merged,
    insights,
    page,
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
  const linkUrl =
    page?.url ??
    `${getAppUrl() ?? ""}/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const counts = describeBriefCounts({
    proposed: proposed.length,
    suggested: suggested.length,
    merged: merged.length,
  });
  const pending = [...proposed, ...suggested];
  // The thread gets one votable reply per item; the brief page lists the rest.
  const items = pending
    .slice(0, 5)
    .map((finding) => findingMessage(organizationSlug, finding, timezone));
  const headline =
    page && page.headline !== counts
      ? compactSlackText(page.headline, 150)
      : null;
  const summary = page?.summary ? compactSlackText(page.summary, 600) : null;
  const lead = page?.lead
    ? pending.find((finding) => finding.id === page.lead?.findingId)
    : undefined;
  // The agent reads only plain text, so recent days ride along for context.
  const recentDays = (params.recentDays ?? [])
    .map((day) => compactSlackText(day.note, 600))
    .join("\n\n");
  const text = `Autopilot: ${headline ? `${headline} · ` : ""}${summary ? `${summary} · ` : ""}${counts}${page ? ` · ${page.url}` : ""}${recentDays ? `\n\nRecent days:\n${recentDays}` : ""}`;

  const paragraphs = [
    `*${headline ?? "Autopilot daily brief"}*\n${summary ?? counts}`,
    lead && page?.lead
      ? `*Start with* <${findingPageUrl(organizationSlug, lead.id)}|${compactSlackText(findingDisplayTitle(lead), 100)}>\n${compactSlackText(page.lead.why, 300)}`
      : null,
    bulletList(
      `Waiting on you (${describeBriefCounts({ proposed: proposed.length, suggested: suggested.length, merged: 0 })})`,
      pending.map((finding) =>
        findingLine(organizationSlug, finding, timezone)
      ),
      5
    ),
    bulletList(
      "Merged since your last brief",
      merged.map((finding) =>
        compactSlackText(findingDisplayTitle(finding), 100)
      )
    ),
    bulletList(
      "Worth knowing",
      insights.map((insight) => compactSlackText(insight, 180))
    ),
  ].filter((paragraph): paragraph is string => Boolean(paragraph));
  const blocks: SlackBlock[] = [
    // One section per paragraph keeps each under Slack's 3,000-char limit.
    ...paragraphs.map((paragraph) => ({
      type: "section",
      text: slackMrkdwn(paragraph),
    })),
    {
      type: "context",
      elements: [
        slackMrkdwn(
          `${items.length > 0 ? "React 👍 or 👎 on each item in the thread  ·  " : ""}<${linkUrl}|${page ? "Read the full brief" : "Open Autopilot"}>`
        ),
      ],
    },
  ];
  return { text, blocks, items };
}

/** The Autopilot channel and bot token, or null when Slack is off for Autopilot. */
export async function loadSlackDestination(organizationId: string) {
  if (await isAutopilotOffForOrganization(organizationId)) {
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
  return {
    organizationId,
    encryptedBotToken: destination.encryptedBotToken,
    destination: {
      teamId: destination.teamId,
      channelId: destination.channelId,
    },
  };
}

type SlackDestination = NonNullable<
  Awaited<ReturnType<typeof loadSlackDestination>>
>;

/**
 * Posts one votable item into a thread. Its address is saved before the
 * reactions go on, so an early 👍 already finds the item.
 */
async function postFindingReply(
  send: SlackDestination,
  item: AutopilotFindingMessage,
  threadTs: string,
  clientMessageId?: string
) {
  const reply = await postAutopilotSlackMessage({
    ...send,
    text: item.text,
    blocks: item.blocks,
    threadTs,
    clientMessageId,
  });
  const slackMessage = JSON.stringify({
    channel: reply.channel,
    ts: reply.ts,
    threadTs,
    status: item.status,
  });
  const saved = await db
    .update(autopilotFindings)
    .set({
      evidence: sql`(${autopilotFindings.evidence} - 'slackActingAt') || jsonb_build_object('slackMessage', ${slackMessage}::jsonb)`,
    })
    .where(
      and(
        eq(autopilotFindings.organizationId, send.organizationId),
        eq(autopilotFindings.id, item.findingId),
        // A slow, older reply must not replace the address of a newer one or
        // of a finding that has moved on (e.g. an idea that is now a PR).
        eq(autopilotFindings.status, item.status),
        sql`coalesce((${autopilotFindings.evidence}->'slackMessage'->>'ts')::numeric, 0) < ${reply.ts}::numeric`
      )
    )
    .returning({ id: autopilotFindings.id });
  if (saved.length === 0) {
    // Votes on this reply could never be matched, so it must not stay up.
    await callAutopilotSlack({
      ...send,
      method: "chat.delete",
      body: { channel: reply.channel, ts: reply.ts },
    }).catch(() => undefined);
    throw new Error("The item changed while its Slack reply was posted");
  }
  // Pre-filled votes make it one tap; in order, so 👍 comes first. Older installs lack reactions:write.
  for (const name of ["+1", "-1"]) {
    await callAutopilotSlack({
      ...send,
      method: "reactions.add",
      body: { channel: reply.channel, timestamp: reply.ts, name },
    }).catch(() => undefined);
  }
}

/** Posts to the Slack channel picked for Autopilot; returns null when none is set. */
export async function postAutopilotBrief(
  organizationId: string,
  brief: AutopilotBrief,
  runId?: string
): Promise<AutopilotBriefDelivery | null> {
  const send = await loadSlackDestination(organizationId);
  if (!send) {
    return null;
  }
  const delivered = await postAutopilotSlackMessage({
    ...send,
    text: brief.text,
    blocks: brief.blocks,
    clientMessageId: runId ? autopilotSlackMessageId(runId) : undefined,
  });
  const items: AutopilotBriefDelivery["items"] = [];
  // One at a time so the thread keeps the brief's order.
  for (const item of brief.items) {
    try {
      await postFindingReply(
        send,
        item,
        delivered.ts,
        runId
          ? autopilotSlackMessageId(`${runId}:${item.findingId}`)
          : undefined
      );
      items.push({ findingId: item.findingId, status: item.status });
    } catch (error) {
      logError("Autopilot brief reply failed", error, {
        organizationId,
        findingId: item.findingId,
      });
    }
  }
  if (runId) {
    await createAutopilotLogger({ organizationId, runId }, null).action(
      "Delivered the Slack message",
      {
        url: slackThreadUrl(delivered.teamId, delivered.channel, delivered.ts),
      }
    );
  }
  return {
    teamId: delivered.teamId,
    channel: delivered.channel,
    ts: delivered.ts,
    items,
  };
}

/**
 * After a write someone asked for from Slack, answers in that item's thread:
 * the new pull request as a votable reply, or why nothing was written (a
 * failure, or rules that kept it an idea).
 */
export async function reportAutopilotWriteInSlack(
  organizationId: string,
  findingId: string,
  reason?: string
) {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  const thread = finding?.evidence.slackMessage;
  if (!(finding && thread)) {
    return;
  }
  const send = await loadSlackDestination(organizationId);
  if (send?.destination.channelId !== thread.channel) {
    return;
  }
  if (finding.status === "proposed") {
    const [organization, settings] = await Promise.all([
      db.query.organizations.findFirst({
        columns: { slug: true },
        where: eq(organizations.id, organizationId),
      }),
      db.query.autopilotSettings.findFirst({
        columns: { timezone: true },
        where: eq(autopilotSettings.organizationId, organizationId),
      }),
    ]);
    if (organization) {
      const [withPreview = finding] = await attachSitePreviews(organizationId, [
        finding,
      ]);
      await postFindingReply(
        send,
        findingMessage(
          organization.slug,
          withPreview,
          settings?.timezone ?? AUTOPILOT_DEFAULT_TIMEZONE
        ),
        thread.threadTs
      );
      // Announced here, so the next brief does not post the same PR again.
      await db
        .update(autopilotFindings)
        .set({
          evidence: sql`jsonb_set(${autopilotFindings.evidence}, '{briefed}', coalesce(${autopilotFindings.evidence}->'briefed', '[]'::jsonb) || '["proposed"]'::jsonb)`,
        })
        .where(eq(autopilotFindings.id, finding.id));
    }
    return;
  }
  await db
    .update(autopilotFindings)
    .set({ evidence: sql`${autopilotFindings.evidence} - 'slackActingAt'` })
    .where(eq(autopilotFindings.id, finding.id));
  if (reason) {
    const text = `Couldn't write this one: ${compactSlackText(reason, 200)}`;
    await postAutopilotSlackMessage({
      ...send,
      threadTs: thread.threadTs,
      text,
      blocks: [{ type: "section", text: slackMrkdwn(text) }],
    });
  }
}
