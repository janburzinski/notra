import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import { autopilotFindings, autopilotSettings } from "@notra/db/schema";
import type { AutopilotDraftKind } from "@notra/email/types/autopilot-draft-ready";
import { and, eq } from "drizzle-orm";

import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { loadSlackDestination } from "@/lib/autopilot/brief";
import { getNotificationData } from "@/lib/email/notification-data";
import { sendAutopilotDraftReadyEmail } from "@/lib/email/send";
import type { AutopilotLogger } from "@/types/autopilot-runtime";
import { toErrorMessage } from "@/utils/error-message";

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Emails the organization's owners that a draft is waiting for them, with the
 * change it is based on. Call it once the draft is recorded as proposed; it
 * reads the saved finding, so the email shows its final title and pull
 * request. With an Autopilot Slack channel the brief announces the draft
 * instead, unless the workspace asked for emails too. Best effort: a failed
 * email never fails the draft.
 */
export async function emailDraftReviewers(params: {
  organizationId: string;
  findingId: string;
  log: AutopilotLogger;
  kind: AutopilotDraftKind;
  /** The title the draft shows; defaults to the finding's. */
  draftTitle?: string;
}) {
  const { log } = params;
  try {
    const settings = await db.query.autopilotSettings.findFirst({
      columns: { draftEmails: true },
      where: eq(autopilotSettings.organizationId, params.organizationId),
    });
    if (
      settings?.draftEmails !== "always" &&
      (await loadSlackDestination(params.organizationId))
    ) {
      return;
    }
    const notification = await getNotificationData({
      organizationId: params.organizationId,
      setting: "autopilotDrafts",
    });
    if (!notification.enabled || notification.ownerEmails.length === 0) {
      return;
    }
    const finding = await db.query.autopilotFindings.findFirst({
      where: and(
        eq(autopilotFindings.organizationId, params.organizationId),
        eq(autopilotFindings.id, params.findingId)
      ),
    });
    if (
      !(
        finding?.repository &&
        finding.pullRequestNumber &&
        finding.pullRequestUrl
      )
    ) {
      return;
    }
    const { pullRequestNumber, pullRequestUrl, repository } = finding;
    const sources = (finding.evidence.pullRequests ?? []).map((source) => ({
      title: source.title,
      url: source.url,
      author: source.author ?? null,
    }));
    const results = await Promise.all(
      notification.ownerEmails.map((recipientEmail) =>
        sendAutopilotDraftReadyEmail({
          recipientEmail,
          findingId: finding.id,
          organizationName: notification.organizationName,
          organizationSlug: notification.organizationSlug,
          draftTitle: params.draftTitle ?? finding.title,
          reason: finding.summary,
          draftKind: params.kind,
          repository,
          pullRequestNumber,
          pullRequestUrl,
          sources,
          reviewLink: `${getAppUrl() ?? ""}/${notification.organizationSlug}${AUTOPILOT_NAV_LINK}/findings/${finding.id}`,
        })
      )
    );
    const failed = results.filter((result) => result.error);
    const suppressed = results.filter((result) => result.data?.skipped);
    const sent = results.length - failed.length - suppressed.length;
    if (sent > 0) {
      await log.action(`Emailed ${plural(sent, "reviewer")} about the draft`);
    }
    if (suppressed.length > 0) {
      await log.skip(
        `${plural(suppressed.length, "reviewer")} got no email because Brew suppresses their address`
      );
    }
    if (failed.length > 0) {
      await log.skip(
        `Could not email ${plural(failed.length, "reviewer")} about the draft`,
        { error: failed.map((result) => result.error?.message).join("; ") }
      );
    }
  } catch (error) {
    await log.skip("Could not email reviewers about the draft", {
      error: toErrorMessage(error, String(error)),
    });
  }
}
