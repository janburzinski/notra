import { expect, test } from "bun:test";

import { resolveChatMessageAuthor } from "@/utils/chat-message-author";

const MEMBER = { id: "user_1", name: "Ada", image: null, seed: "ada@x.dev" };
const membersById = new Map([[MEMBER.id, MEMBER]]);
const SLACK_AUTHOR = { userId: "U1", name: "Someone else" };

test("a Slack sender can't override the member who sent the message", () => {
  const author = resolveChatMessageAuthor({
    metadata: { authorUserId: MEMBER.id, slackAuthor: SLACK_AUTHOR },
    membersById,
    sessionUser: undefined,
    isSlackMirrored: true,
  });

  expect(author).toEqual(MEMBER);
});

test("Slack senders only count in chats mirrored from Slack", () => {
  const author = resolveChatMessageAuthor({
    metadata: { slackAuthor: SLACK_AUTHOR },
    membersById,
    sessionUser: undefined,
    isSlackMirrored: false,
  });

  expect(author).toBeNull();
});

test("a Slack thread names its senders", () => {
  const author = resolveChatMessageAuthor({
    metadata: { slackAuthor: SLACK_AUTHOR },
    membersById,
    sessionUser: undefined,
    isSlackMirrored: true,
  });

  expect(author).toMatchObject({ name: "Someone else", fromSlack: true });
});
