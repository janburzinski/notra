import { afterEach, describe, expect, mock, test } from "bun:test";

import type { SlackInteractionAction } from "eve/channels/slack";

import {
  SLACK_LEAVE_ACTION_ID,
  SLACK_STOP_ACTION_ID,
} from "../agent/lib/constants/slack-controls";
import type { SlackControlContext } from "../agent/lib/types/slack-controls";
import {
  handleSlackControl,
  handleSlackControlAction,
  parseSlackControlMessage,
} from "../agent/lib/utils/slack-controls";
import { withToolActivityLabel } from "../agent/lib/utils/tool-activity";

afterEach(() => mock.restore());

function controlContext() {
  const session = {
    id: "session-1",
    cancel: mock(async () => ({
      status: "accepted" as const,
      sessionId: "session-1",
    })),
    reset: mock(async () => ({
      status: "reset" as const,
      previousSessionId: "session-1",
    })),
  };
  const thread = {
    post: mock(async () => ({ id: "message-1", raw: { ok: true } })),
    startTyping: mock(async () => undefined),
  };
  const ctx = {
    thread,
    resolveSession: mock(async () => session),
  } satisfies SlackControlContext;
  return { ctx, session };
}

describe("Slack thread controls", () => {
  test("recognizes only whole commands, including mentions and German aliases", () => {
    for (const text of [
      "stop",
      "STOP!",
      "stopp",
      "<@U123> stop",
      "@Notra: cancel",
    ]) {
      expect(parseSlackControlMessage(text, true)).toBe("stop");
    }
    for (const text of [
      "stop replying",
      "<@U123> leave this thread.",
      "nicht mehr antworten",
    ]) {
      expect(parseSlackControlMessage(text, true)).toBe("leave");
    }
    for (const text of [
      "write a post about stop buttons",
      "stop changing the headline",
      "please explain unsubscribe",
    ]) {
      expect(parseSlackControlMessage(text)).toBeNull();
    }
    expect(parseSlackControlMessage("<@OTHER> stop", false)).toBeNull();
    expect(parseSlackControlMessage("stop", false)).toBe("stop");
  });

  test("stops the pinned turn and its tasks without starting another turn", async () => {
    const { ctx, session } = controlContext();
    await handleSlackControl("stop", ctx, {
      sessionId: session.id,
      turnId: "turn-1",
    });
    expect(session.cancel).toHaveBeenCalledWith({
      tasks: true,
      turnId: "turn-1",
    });
    expect(session.reset).not.toHaveBeenCalled();
    expect(ctx.thread.post).toHaveBeenCalledWith(
      expect.stringContaining("doesn't undo")
    );
  });

  test("leaving retires the thread session and clears typing", async () => {
    const { ctx, session } = controlContext();
    await handleSlackControl("leave", ctx);
    expect(session.reset).toHaveBeenCalledTimes(1);
    expect(session.cancel).not.toHaveBeenCalled();
    expect(ctx.thread.startTyping).not.toHaveBeenCalled();
    expect(ctx.thread.post).toHaveBeenCalledWith(
      expect.stringContaining("Mention @Notra")
    );
  });

  test("an old card cannot stop or retire a replacement session", async () => {
    const { ctx, session } = controlContext();
    for (const control of ["stop", "leave"] as const) {
      await handleSlackControl(control, ctx, {
        sessionId: "old-session",
        turnId: "old-turn",
      });
    }
    expect(session.cancel).not.toHaveBeenCalled();
    expect(session.reset).not.toHaveBeenCalled();
  });

  test("malformed and unrelated interactions cannot cancel a session", async () => {
    const { ctx, session } = controlContext();
    for (const value of [
      undefined,
      "not-json",
      "{}",
      '{"sessionId":"session-1"}',
    ]) {
      await handleSlackControlAction(
        { actionId: SLACK_STOP_ACTION_ID, value, user: { id: "user-1" } },
        ctx
      );
    }
    await handleSlackControlAction(
      {
        actionId: "unrelated",
        value: JSON.stringify({ sessionId: session.id, turnId: "turn-1" }),
        user: { id: "user-1" },
      },
      ctx
    );
    expect(session.cancel).not.toHaveBeenCalled();
    expect(ctx.resolveSession).not.toHaveBeenCalled();
  });

  test("valid button values are bound to their session and turn", async () => {
    const { ctx, session } = controlContext();
    const action: SlackInteractionAction = {
      actionId: SLACK_STOP_ACTION_ID,
      value: JSON.stringify({ sessionId: session.id, turnId: "turn-1" }),
      user: { id: "user-1" },
    };
    await handleSlackControlAction(action, ctx);
    expect(session.cancel).toHaveBeenCalledWith({
      tasks: true,
      turnId: "turn-1",
    });
  });

  test("activity labels retain non-enumerable tool identity metadata", () => {
    const tool = { description: "Read issues" };
    const key = Symbol.for("eve.definition-source-key");
    Object.defineProperty(tool, key, { value: "source-1" });
    const labelled = withToolActivityLabel(tool, "Reading Linear issues");
    expect(Object.is(labelled, tool)).toBe(true);
    expect(Reflect.get(labelled, key)).toBe("source-1");
    expect(labelled.label.start()).toBe("Reading Linear issues");
  });
});
