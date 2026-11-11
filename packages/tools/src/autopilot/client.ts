import { AUTOPILOT_AGENT_PATH } from "@notra/ai/constants/slack";
import { getBaseUrl } from "@notra/ai/qstash/triggers";
import {
  autopilotAgentErrorSchema,
  autopilotAgentRequestSchema,
} from "@notra/ai/schemas/autopilot-agent";

import { AUTOPILOT_AGENT_TIMEOUT_MS } from "../constants/autopilot";
import type { AutopilotAgentAction } from "../types/autopilot";
import type { OrganizationContext } from "../types/organization";
import { getOrganizationId } from "../utils/organization";

function readAttribute(
  attributes: Readonly<Record<string, unknown>>,
  name: string
) {
  const value = attributes[name];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getAutopilotSlackRequester(ctx: OrganizationContext) {
  const auth = ctx.session.auth.current;
  if (auth?.authenticator !== "slack-webhook") {
    return null;
  }
  const userId = readAttribute(auth.attributes, "user_id");
  const teamId = readAttribute(auth.attributes, "team_id");
  if (!(userId && teamId)) {
    return null;
  }
  const channelId = readAttribute(auth.attributes, "channel_id");
  const threadTs = readAttribute(auth.attributes, "thread_ts");
  return {
    principalId: auth.principalId,
    teamId,
    userId,
    ...(channelId ? { channelId } : {}),
    ...(threadTs ? { threadTs } : {}),
  };
}

export async function callAutopilotAgent(
  ctx: OrganizationContext,
  action: AutopilotAgentAction
): Promise<unknown> {
  const organizationId = getOrganizationId(ctx);
  if (!organizationId) {
    throw new Error("No organization is bound to this session.");
  }
  const requester = getAutopilotSlackRequester(ctx);
  if (!requester) {
    throw new Error(
      "Autopilot can only be controlled by a person in Slack. Point them to the Autopilot page in Notra."
    );
  }
  const baseUrl = getBaseUrl();
  const secret = process.env.INTERNAL_WORKFLOW_SECRET?.trim();
  if (!(baseUrl && secret)) {
    throw new Error("Autopilot control is not configured");
  }
  const slack = {
    teamId: requester.teamId,
    userId: requester.userId,
    channelId: requester.channelId,
    threadTs: requester.threadTs,
  };
  const response = await fetch(`${baseUrl}${AUTOPILOT_AGENT_PATH}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(
      autopilotAgentRequestSchema.parse({ organizationId, slack, action })
    ),
    signal: AbortSignal.timeout(AUTOPILOT_AGENT_TIMEOUT_MS),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = autopilotAgentErrorSchema.safeParse(result);
    throw new Error(
      parsed.success
        ? parsed.data.error
        : `Autopilot request failed (${response.status})`
    );
  }
  return result;
}
