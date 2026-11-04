import { Effect, Result } from "effect";

import {
  SLACK_API_BASE_URL,
  SLACK_CHANNEL_NAME_MAX_LENGTH,
  SLACK_CONNECT_DOMAIN_PURPOSE_PREFIX,
  SLACK_REQUEST_TIMEOUT_MS,
} from "../constants/slack";
import {
  SlackApiError,
  SlackConfigurationError,
  SlackInputError,
  SlackRequestError,
  SlackResponseError,
  SlackSetupError,
  slackConversationMembersResponseSchema,
  slackConversationsListResponseSchema,
  slackCreateChannelResponseSchema,
  slackInviteSharedResponseSchema,
  slackOkResponseSchema,
  slackUserInfoResponseSchema,
} from "../schemas/slack";
import type {
  CreateSlackConnectChannelInput,
  CreateSlackConnectChannelInviteInput,
  CreateSlackConnectChannelInviteResult,
  SlackChannelSummary,
  SlackConnectChannel,
  SlackConnectInviteInput,
  SlackConnectInviteResult,
  SlackInviteRecipient,
} from "../types/slack";

const getSlackBotToken = Effect.fn("getSlackBotToken")(function* () {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) {
    return yield* new SlackConfigurationError({
      variable: "SLACK_BOT_TOKEN",
    });
  }
  return token;
});

const getSlackSupportMemberIds = Effect.fn("getSlackSupportMemberIds")(
  function* () {
    const memberIds = process.env.SLACK_SUPPORT_MEMBER_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!memberIds?.length) {
      return yield* new SlackConfigurationError({
        variable: "SLACK_SUPPORT_MEMBER_IDS",
      });
    }
    return memberIds;
  }
);

const resolveInviteRecipient = Effect.fn("resolveInviteRecipient")(function* (
  email: string | undefined,
  userId: string | undefined
) {
  const trimmedEmail = email?.trim();
  const trimmedUserId = userId?.trim();
  const hasEmail = Boolean(trimmedEmail);
  const hasUserId = Boolean(trimmedUserId);

  if (hasEmail === hasUserId) {
    return yield* new SlackInputError({
      message:
        "Slack Connect invites require exactly one non-empty email or userId",
    });
  }

  return (
    trimmedEmail
      ? { emails: [trimmedEmail] }
      : { user_ids: [trimmedUserId ?? ""] }
  ) satisfies SlackInviteRecipient;
});

const requestSlack = Effect.fn("requestSlack")(function* (
  method: string,
  body: Record<string, unknown>,
  httpMethod: "GET" | "POST" = "POST"
) {
  const token = yield* getSlackBotToken();
  const isGet = httpMethod === "GET";
  const query = isGet
    ? `?${new URLSearchParams(
        Object.entries(body).map(([key, value]) => [key, String(value)])
      )}`
    : "";
  const response = yield* Effect.tryPromise({
    try: (effectSignal) =>
      fetch(`${SLACK_API_BASE_URL}/${method}${query}`, {
        ...(isGet ? {} : { body: JSON.stringify(body) }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        method: httpMethod,
        signal: AbortSignal.any([
          effectSignal,
          AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS),
        ]),
      }),
    catch: (cause) => new SlackRequestError({ cause, operation: method }),
  });

  if (!response.ok) {
    return yield* new SlackRequestError({
      cause: new Error(
        `Slack ${method} request failed with status ${response.status}`
      ),
      operation: method,
      status: response.status,
    });
  }

  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new SlackResponseError({ cause, operation: method }),
  });
});

export function hasSlackConnectConfigured(): boolean {
  return Boolean(
    process.env.SLACK_BOT_TOKEN?.trim() &&
    process.env.SLACK_SUPPORT_MEMBER_IDS?.split(",").some((id) => id.trim())
  );
}

const inviteToSlackConnectEffect = Effect.fn("inviteToSlackConnect")(function* (
  input: SlackConnectInviteInput
) {
  const { channelId, email, userId, externalLimited } = input;
  const recipient = yield* resolveInviteRecipient(email, userId);

  const operation = "conversations.inviteShared";
  const response = yield* requestSlack(operation, {
    channel: channelId,
    ...recipient,
    ...(externalLimited === undefined
      ? {}
      : { external_limited: externalLimited }),
  });
  const payload = yield* Effect.try({
    try: () => slackInviteSharedResponseSchema.parse(response),
    catch: (cause) => new SlackResponseError({ cause, operation }),
  });

  if (!payload.ok) {
    return yield* new SlackApiError({
      code: payload.error ?? "unknown_error",
      operation,
    });
  }

  if (!payload.invite_id) {
    return yield* new SlackResponseError({
      cause: new Error(
        "Slack Connect invite succeeded but returned no invite_id"
      ),
      operation,
    });
  }

  return {
    inviteId: payload.invite_id,
    isLegacySharedChannel: payload.is_legacy_shared_channel ?? false,
  } satisfies SlackConnectInviteResult;
});

const createSlackConnectChannelEffect = Effect.fn("createSlackConnectChannel")(
  function* (input: CreateSlackConnectChannelInput) {
    const operation = "conversations.create";
    const response = yield* requestSlack(operation, {
      name: input.channelName,
      is_private: input.isPrivate ?? true,
    });
    const payload = yield* Effect.try({
      try: () => slackCreateChannelResponseSchema.parse(response),
      catch: (cause) => new SlackResponseError({ cause, operation }),
    });

    if (!payload.ok) {
      return yield* new SlackApiError({
        code: payload.error ?? "unknown_error",
        operation,
      });
    }

    if (!payload.channel) {
      return yield* new SlackResponseError({
        cause: new Error("Slack channel creation returned no channel"),
        operation,
      });
    }

    return {
      channelId: payload.channel.id,
      channelName: payload.channel.name,
    } satisfies SlackConnectChannel;
  }
);

const inviteSlackMemberToChannelEffect = Effect.fn(
  "inviteSlackMemberToChannel"
)(function* (channelId: string, memberId: string) {
  const operation = "conversations.invite";
  const response = yield* requestSlack(operation, {
    channel: channelId,
    users: memberId,
  });
  const payload = yield* Effect.try({
    try: () => slackOkResponseSchema.parse(response),
    catch: (cause) => new SlackResponseError({ cause, operation }),
  });

  if (!payload.ok && payload.error !== "already_in_channel") {
    return yield* new SlackApiError({
      code: payload.error ?? "unknown_error",
      operation,
    });
  }
});

const archiveSlackChannelEffect = Effect.fn("archiveSlackChannel")(function* (
  channelId: string
) {
  const operation = "conversations.archive";
  const response = yield* requestSlack(operation, { channel: channelId });
  const payload = yield* Effect.try({
    try: () => slackOkResponseSchema.parse(response),
    catch: (cause) => new SlackResponseError({ cause, operation }),
  });

  if (!payload.ok) {
    return yield* new SlackApiError({
      code: payload.error ?? "unknown_error",
      operation,
    });
  }
});

const listSlackChannelsEffect = Effect.fn("listSlackChannels")(function* () {
  const operation = "conversations.list";
  const channels: SlackChannelSummary[] = [];
  let cursor = "";
  do {
    const response = yield* requestSlack(
      operation,
      {
        exclude_archived: true,
        limit: 1000,
        types: "public_channel,private_channel",
        ...(cursor ? { cursor } : {}),
      },
      "GET"
    );
    const payload = yield* Effect.try({
      try: () => slackConversationsListResponseSchema.parse(response),
      catch: (cause) => new SlackResponseError({ cause, operation }),
    });
    if (!payload.ok) {
      return yield* new SlackApiError({
        code: payload.error ?? "unknown_error",
        operation,
      });
    }
    channels.push(...(payload.channels ?? []));
    cursor = payload.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return channels;
});

const listSlackChannelMemberIdsEffect = Effect.fn("listSlackChannelMemberIds")(
  function* (channelId: string) {
    const operation = "conversations.members";
    const memberIds: string[] = [];
    let cursor = "";
    do {
      const response = yield* requestSlack(
        operation,
        { channel: channelId, limit: 1000, ...(cursor ? { cursor } : {}) },
        "GET"
      );
      const payload = yield* Effect.try({
        try: () => slackConversationMembersResponseSchema.parse(response),
        catch: (cause) => new SlackResponseError({ cause, operation }),
      });
      if (!payload.ok) {
        return yield* new SlackApiError({
          code: payload.error ?? "unknown_error",
          operation,
        });
      }
      memberIds.push(...(payload.members ?? []));
      cursor = payload.response_metadata?.next_cursor ?? "";
    } while (cursor);
    return memberIds;
  }
);

const getSlackUserEffect = Effect.fn("getSlackUser")(function* (
  userId: string
) {
  const operation = "users.info";
  const response = yield* requestSlack(operation, { user: userId }, "GET");
  const payload = yield* Effect.try({
    try: () => slackUserInfoResponseSchema.parse(response),
    catch: (cause) => new SlackResponseError({ cause, operation }),
  });
  if (!payload.ok) {
    return yield* new SlackApiError({
      code: payload.error ?? "unknown_error",
      operation,
    });
  }
  return {
    email: payload.user?.profile?.email?.toLowerCase(),
    isBot: payload.user?.is_bot ?? false,
  };
});

const createSlackConnectChannelWithInviteEffect = Effect.fn(
  "createSlackConnectChannelWithInvite"
)(function* (input: CreateSlackConnectChannelInviteInput) {
  yield* resolveInviteRecipient(input.email, input.userId);
  const supportMemberIds = yield* getSlackSupportMemberIds();

  const channel = yield* createSlackConnectChannelEffect({
    channelName: input.channelName,
    isPrivate: input.isPrivate,
  }).pipe(
    Effect.catchIf(
      (error) => error._tag === "SlackApiError" && error.code === "name_taken",
      () =>
        createSlackConnectChannelEffect({
          channelName: `${input.channelName.slice(0, SLACK_CHANNEL_NAME_MAX_LENGTH - 5)}-${crypto.randomUUID().slice(0, 4)}`,
          isPrivate: input.isPrivate,
        })
    )
  );

  const inviteEffect = Effect.gen(function* () {
    for (const memberId of supportMemberIds) {
      yield* inviteSlackMemberToChannelEffect(channel.channelId, memberId).pipe(
        Effect.catch((error) =>
          Effect.logWarning("Slack support member invite failed").pipe(
            Effect.annotateLogs({
              channelId: channel.channelId,
              memberId,
              error,
            })
          )
        )
      );
    }
    const invite = yield* inviteToSlackConnectEffect({
      channelId: channel.channelId,
      email: input.email,
      userId: input.userId,
      externalLimited: input.externalLimited,
    });
    if (input.domain) {
      yield* setSlackChannelPurposeEffect(
        channel.channelId,
        `${SLACK_CONNECT_DOMAIN_PURPOSE_PREFIX}${input.domain}`
      ).pipe(
        Effect.catch((error) =>
          Effect.logWarning("Slack channel purpose update failed").pipe(
            Effect.annotateLogs({ channelId: channel.channelId, error })
          )
        )
      );
    }
    return invite;
  });

  return yield* Effect.matchEffect(inviteEffect, {
    onFailure: (cause) =>
      archiveSlackChannelEffect(channel.channelId).pipe(
        Effect.matchEffect({
          onFailure: (archiveCause) =>
            Effect.fail(
              new SlackSetupError({
                archiveCause,
                archived: false,
                cause,
                channelName: channel.channelName,
              })
            ),
          onSuccess: () =>
            Effect.fail(
              new SlackSetupError({
                archived: true,
                cause,
                channelName: channel.channelName,
              })
            ),
        })
      ),
    onSuccess: (invite) =>
      Effect.succeed({
        channelId: channel.channelId,
        channelName: channel.channelName,
        ...invite,
      } satisfies CreateSlackConnectChannelInviteResult),
  });
});

// ponytail: scans every Slack Connect channel per signup; index domain -> channel if it gets slow
const setSlackChannelPurposeEffect = Effect.fn("setSlackChannelPurpose")(
  function* (channelId: string, purpose: string) {
    const operation = "conversations.setPurpose";
    const response = yield* requestSlack(operation, {
      channel: channelId,
      purpose,
    });
    const payload = yield* Effect.try({
      try: () => slackOkResponseSchema.parse(response),
      catch: (cause) => new SlackResponseError({ cause, operation }),
    });

    if (!payload.ok) {
      return yield* new SlackApiError({
        code: payload.error ?? "unknown_error",
        operation,
      });
    }
  }
);

const channelHasDomainMemberEffect = Effect.fn("channelHasDomainMember")(
  function* (channelId: string, domain: string, supportMemberIds: string[]) {
    const memberIds = yield* listSlackChannelMemberIdsEffect(channelId);
    const others = memberIds.filter((id) => !supportMemberIds.includes(id));
    const users = yield* Effect.forEach(others, getSlackUserEffect, {
      concurrency: 5,
    });
    return users.some((user) => user.email?.endsWith(`@${domain}`));
  }
);

const hasSlackConnectChannelForDomainEffect = Effect.fn(
  "hasSlackConnectChannelForDomain"
)(function* (domain: string) {
  const supportMemberIds = yield* getSlackSupportMemberIds();
  const channels = yield* listSlackChannelsEffect();
  const purpose = `${SLACK_CONNECT_DOMAIN_PURPOSE_PREFIX}${domain}`;
  if (channels.some((channel) => channel.purpose?.value === purpose)) {
    return true;
  }
  let lookupError: unknown;
  for (const channel of channels) {
    if (!channel.is_ext_shared) {
      continue;
    }
    const lookup = yield* channelHasDomainMemberEffect(
      channel.id,
      domain,
      supportMemberIds
    ).pipe(Effect.retry({ times: 2 }), Effect.result);
    if (Result.isFailure(lookup)) {
      lookupError = lookup.failure;
    } else if (lookup.success) {
      return true;
    }
  }
  if (lookupError) {
    return yield* Effect.fail(lookupError);
  }
  return false;
});

export function hasSlackConnectChannelForDomain(
  domain: string
): Promise<boolean> {
  return Effect.runPromise(hasSlackConnectChannelForDomainEffect(domain));
}

export function createSlackConnectChannelWithInvite(
  input: CreateSlackConnectChannelInviteInput
): Promise<CreateSlackConnectChannelInviteResult> {
  return Effect.runPromise(createSlackConnectChannelWithInviteEffect(input));
}
