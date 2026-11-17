import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import type {
  ApprovalConfiguration,
  ApprovalContext,
  ApprovalResponseContext,
} from "eve/tools/approval";

import {
  AUTOPILOT_APPROVAL_NOT_REQUESTER_MESSAGE,
  AUTOPILOT_APPROVAL_REQUESTER_KEY_PREFIX,
  AUTOPILOT_APPROVAL_REQUESTER_TTL_SECONDS,
} from "../constants/autopilot";
import { SLACK_WEBHOOK_AUTHENTICATOR } from "../constants/slack";

function requesterKey(callId: string) {
  return `${AUTOPILOT_APPROVAL_REQUESTER_KEY_PREFIX}${callId}`;
}

async function rememberRequester(callId: string, principalId: string) {
  if (!redis) {
    return false;
  }
  try {
    await redis.set(requesterKey(callId), principalId, {
      ex: AUTOPILOT_APPROVAL_REQUESTER_TTL_SECONDS,
      nx: true,
    });
    return true;
  } catch (error) {
    logError("Autopilot approval requester could not be saved", error, {
      callId,
    });
    return false;
  }
}

async function readRequester(callId: string) {
  if (!redis) {
    return null;
  }
  try {
    return await redis.get<string>(requesterKey(callId));
  } catch (error) {
    logError("Autopilot approval requester could not be read", error, {
      callId,
    });
    return null;
  }
}

export function autopilotApproval<TInput extends Record<string, unknown>>(
  needsConfirmation: ((input: Readonly<TInput>) => boolean) | null
): ApprovalConfiguration<TInput> {
  return {
    request: async (ctx: ApprovalContext<TInput>) => {
      if (
        !needsConfirmation ||
        (ctx.toolInput && !needsConfirmation(ctx.toolInput))
      ) {
        return "not-applicable";
      }
      const requester = ctx.session.auth.current;
      if (requester?.authenticator !== SLACK_WEBHOOK_AUTHENTICATOR) {
        return {
          type: "denied",
          reason: "Autopilot changes need a person in Slack to confirm them.",
        };
      }
      if (!(await rememberRequester(ctx.callId, requester.principalId))) {
        return {
          type: "denied",
          reason:
            "Autopilot could not record who asked for this change. Try again in a moment.",
        };
      }
      return "user-approval";
    },
    response: async ({
      response,
      request,
    }: ApprovalResponseContext<TInput>) => {
      const responder = response.principal;
      const requester = await readRequester(request.callId);
      return responder.authenticator === SLACK_WEBHOOK_AUTHENTICATOR &&
        requester === responder.principalId
        ? { status: "allowed" }
        : {
            status: "rejected",
            reason: AUTOPILOT_APPROVAL_NOT_REQUESTER_MESSAGE,
          };
    },
  };
}
