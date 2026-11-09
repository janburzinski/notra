import {
  defaultSlackAuth,
  type SlackContext,
  type SlackMessage,
} from "eve/channels/slack";
import type { SessionAuthContext } from "eve/context";

import {
  SLACK_ACTION_OUTSIDER_MESSAGE,
  SLACK_WEBHOOK_AUTHENTICATOR,
} from "../constants/slack";
import type { ResolvedSlackInstallation } from "../types/slack";
import {
  isChannelAllowed,
  resolveSlackInstallation,
  runWithSlackInstallation,
} from "./slack-installation";

function getSenderTeamId(message: SlackMessage): string | undefined {
  const { user_team: userTeam, team } = message.raw;
  if (typeof userTeam === "string" && userTeam.length > 0) {
    return userTeam;
  }
  return typeof team === "string" && team.length > 0 ? team : undefined;
}

function isInstallationMember(
  installation: ResolvedSlackInstallation,
  teamId: string | undefined
): boolean {
  return teamId === installation.teamId;
}

export function buildNotraSlackAuth(
  ctx: SlackContext,
  message: SlackMessage,
  installation: ResolvedSlackInstallation
) {
  const senderTeamId = getSenderTeamId(message);
  if (senderTeamId && !isInstallationMember(installation, senderTeamId)) {
    return null;
  }

  const auth = defaultSlackAuth(message, ctx);
  if (!auth) {
    return null;
  }

  return {
    ...auth,
    attributes: {
      ...auth.attributes,
      organizationId: installation.organizationId,
      surface: "standalone-chat",
    },
  };
}

/**
 * Resolves the installation for a button click, or `null` when the click must
 * be ignored. Like messages, buttons only work for members of the installing
 * workspace; Slack Connect guests get an ephemeral explanation.
 */
export async function resolveSlackActionInstallation(
  ctx: SlackContext,
  userId: string
): Promise<ResolvedSlackInstallation | null> {
  const teamId = ctx.slack.installationTeamId;
  const installation = teamId ? await resolveSlackInstallation(teamId) : null;
  if (!installation || !isChannelAllowed(installation, ctx.slack.channelId)) {
    return null;
  }
  if (!isInstallationMember(installation, ctx.slack.teamId)) {
    await runWithSlackInstallation(installation, () =>
      ctx.thread.postEphemeral(userId, SLACK_ACTION_OUTSIDER_MESSAGE)
    );
    return null;
  }
  return installation;
}

export function getSlackAuthUserId(
  auth: SessionAuthContext | null
): string | undefined {
  if (auth?.authenticator !== SLACK_WEBHOOK_AUTHENTICATOR) {
    return undefined;
  }
  const userId = auth.attributes.user_id;
  return typeof userId === "string" && userId.length > 0 ? userId : undefined;
}
