import { SLACK_REQUEST_TIMEOUT_MS } from "@notra/ai/constants/slack";
import { getSlackIntegrationBotToken } from "@notra/ai/integrations/slack-workspace";
import { Effect } from "effect";

import { AUTOPILOT_SLACK_POST_MESSAGE_URL } from "@/constants/autopilot-slack";
import { AutopilotSlackDeliveryError } from "@/lib/autopilot/errors";
import { slackPostMessageResponseSchema } from "@/schemas/autopilot-slack";
import type {
  PostAutopilotSlackMessageInput,
  PostAutopilotSlackMessageResult,
} from "@/types/autopilot-slack";

const postMessage = Effect.fn("Autopilot.postSlackMessage")(function* (
  input: PostAutopilotSlackMessageInput
) {
  const fail = (code: string, cause?: unknown) =>
    new AutopilotSlackDeliveryError({
      message: `Slack chat.postMessage failed: ${code}`,
      code,
      organizationId: input.organizationId,
      cause,
    });

  const token = yield* Effect.try({
    try: () => getSlackIntegrationBotToken(input),
    catch: (cause) => fail("token_error", cause),
  });
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(AUTOPILOT_SLACK_POST_MESSAGE_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          channel: input.destination.channelId,
          text: input.text,
          blocks: input.blocks,
          ...(input.clientMessageId
            ? { client_msg_id: input.clientMessageId }
            : {}),
        }),
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS),
        ]),
      }),
    catch: (cause) => fail("network_error", cause),
  });
  if (!response.ok) {
    return yield* Effect.fail(fail(`http_${response.status}`));
  }

  const body = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => fail("invalid_response", cause),
  });
  const parsed = slackPostMessageResponseSchema.safeParse(body);
  if (!parsed.success) {
    return yield* Effect.fail(fail("invalid_response", parsed.error));
  }
  if (!parsed.data.ok) {
    return yield* Effect.fail(fail(parsed.data.error ?? "unknown_error"));
  }
  return {
    channel: parsed.data.channel,
    ts: parsed.data.ts,
    teamId: input.destination.teamId,
  };
});

/** Posts once; an uncertain provider write must not be automatically retried. */
export function postAutopilotSlackMessage(
  input: PostAutopilotSlackMessageInput
): Promise<PostAutopilotSlackMessageResult> {
  return Effect.runPromise(postMessage(input));
}
