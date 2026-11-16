import { describe, expect, test } from "bun:test";

import { AUTOPILOT_HOLD_REASONS } from "@/constants/autopilot-publish";
import type { AutopilotHoldInput } from "@/types/autopilot-publish";
import {
  autopilotApprovalGroup,
  autopilotHoldDecision,
  formatAutopilotPublishAt,
  hasFactCheckFlags,
  nextAutopilotPublishAt,
  pullRequestEventHoldReason,
  touchesPathsOutside,
} from "@/utils/autopilot-publish";

describe("nextAutopilotPublishAt", () => {
  test("Monday morning publishes Tuesday 09:00 Berlin time", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-11-09T07:00:00Z"),
      "Europe/Berlin"
    );
    expect(at.toISOString()).toBe("2026-11-10T08:00:00.000Z");
  });

  test("Monday after 09:00 still waits a full day, so Wednesday", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-11-09T09:30:00Z"),
      "Europe/Berlin"
    );
    expect(at.toISOString()).toBe("2026-11-11T08:00:00.000Z");
  });

  test("Friday skips the weekend to Monday", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-11-13T12:00:00Z"),
      "Europe/Berlin"
    );
    expect(at.toISOString()).toBe("2026-11-16T08:00:00.000Z");
  });

  test("Thursday evening waits until Monday, not Friday morning", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-11-12T17:00:00Z"),
      "Europe/Berlin"
    );
    expect(at.toISOString()).toBe("2026-11-16T08:00:00.000Z");
  });

  test("publishes at 09:00 in the workspace timezone", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-11-10T03:00:00Z"),
      "America/Los_Angeles"
    );
    expect(at.toISOString()).toBe("2026-11-11T17:00:00.000Z");
  });

  test("follows daylight saving changes", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-03-27T06:00:00Z"),
      "Europe/Berlin"
    );
    expect(at.toISOString()).toBe("2026-03-30T07:00:00.000Z");
  });

  test("is always at least 24 hours away", () => {
    const start = new Date("2026-11-01T00:00:00Z").getTime();
    for (let hour = 0; hour < 24 * 7; hour += 1) {
      const now = new Date(start + hour * 3_600_000);
      const at = nextAutopilotPublishAt(now, "Asia/Tokyo");
      expect(at.getTime() - now.getTime()).toBeGreaterThanOrEqual(
        24 * 3_600_000
      );
      expect([1, 2, 3, 4, 5]).toContain(
        new Date(at.getTime() + 9 * 3_600_000).getUTCDay()
      );
    }
  });

  test("an unknown timezone falls back to UTC", () => {
    const at = nextAutopilotPublishAt(
      new Date("2026-11-09T07:00:00Z"),
      "Not/AZone"
    );
    expect(at.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  test("formats in the workspace timezone", () => {
    expect(
      formatAutopilotPublishAt(
        new Date("2026-11-10T08:00:00Z"),
        "Europe/Berlin"
      )
    ).toBe("Tue 09:00");
  });
});

const base: AutopilotHoldInput = {
  expectedHeadSha: "abc",
  expectedBaseRef: "main",
  pullRequest: {
    state: "open",
    merged: false,
    draft: false,
    headSha: "abc",
    baseRef: "main",
    mergeable: true,
    mergeableState: "clean",
  },
  reviews: [],
  humanComments: 0,
  truncated: false,
  checks: [{ status: "completed", conclusion: "success" }],
  waitingSince: new Date("2026-11-10T08:00:00Z"),
  now: new Date("2026-11-10T08:05:00Z"),
};

function decide(patch: Partial<AutopilotHoldInput>) {
  return autopilotHoldDecision({ ...base, ...patch });
}

function withPull(patch: Partial<AutopilotHoldInput["pullRequest"]>) {
  return decide({ pullRequest: { ...base.pullRequest, ...patch } });
}

describe("autopilotHoldDecision", () => {
  test("publishes an untouched, clean pull request", () => {
    expect(decide({})).toEqual({ action: "publish" });
    expect(decide({ checks: null })).toEqual({ action: "publish" });
  });

  test("cancels on human activity", () => {
    expect(withPull({ draft: true })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.draft,
    });
    expect(withPull({ headSha: "def" })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.pushed,
    });
    expect(withPull({ baseRef: "release" })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.retargeted,
    });
    expect(decide({ truncated: true })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.tooBusy,
    });
    expect(
      decide({ reviews: [{ state: "CHANGES_REQUESTED", bot: false }] })
    ).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.changesRequested,
    });
    expect(decide({ humanComments: 1 })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.commented,
    });
    expect(decide({ reviews: [{ state: "COMMENTED", bot: false }] })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.commented,
    });
  });

  test("bot reviews and approvals do not cancel", () => {
    expect(
      decide({
        reviews: [
          { state: "COMMENTED", bot: true },
          { state: "CHANGES_REQUESTED", bot: true },
          { state: "APPROVED", bot: false },
        ],
      })
    ).toEqual({ action: "publish" });
  });

  test("cancels on conflicts, failed required checks and protection", () => {
    expect(withPull({ mergeable: false, mergeableState: "dirty" })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.conflict,
    });
    expect(
      decide({
        pullRequest: { ...base.pullRequest, mergeableState: "blocked" },
        checks: [{ status: "completed", conclusion: "failure" }],
      })
    ).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.checksFailed,
    });
    expect(
      decide({
        pullRequest: { ...base.pullRequest, mergeableState: "unstable" },
        checks: [
          { status: "completed", conclusion: "success" },
          { status: "completed", conclusion: "failure" },
        ],
      })
    ).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.checksFailed,
    });
    expect(withPull({ mergeableState: "blocked" })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.blocked,
    });
    expect(withPull({ state: "closed" })).toEqual({
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.closed,
    });
  });

  test("waits for pending checks and unknown mergeability, then gives up", () => {
    const pending = {
      pullRequest: { ...base.pullRequest, mergeableState: "blocked" },
      checks: [{ status: "in_progress", conclusion: null }],
    };
    expect(decide(pending)).toEqual({ action: "wait" });
    expect(withPull({ mergeable: null, mergeableState: "unknown" })).toEqual({
      action: "wait",
    });
    expect(withPull({ mergeableState: "unstable" })).toEqual({
      action: "wait",
    });
    expect(
      decide({
        pullRequest: { ...base.pullRequest, mergeableState: "unstable" },
        checks: [{ status: "queued", conclusion: null }],
      })
    ).toEqual({ action: "wait" });
    expect(
      decide({
        pullRequest: { ...base.pullRequest, mergeableState: "blocked" },
        checks: null,
      })
    ).toEqual({ action: "wait" });
    expect(
      decide({ ...pending, now: new Date("2026-11-18T08:00:00Z") })
    ).toEqual({ action: "cancel", reason: AUTOPILOT_HOLD_REASONS.checksStuck });
  });

  test("an already merged pull request counts as published", () => {
    expect(withPull({ merged: true, state: "closed" })).toEqual({
      action: "publish",
    });
  });
});

describe("hold rules", () => {
  test("maps jobs to approval switches", () => {
    expect(autopilotApprovalGroup("keywords", false)).toBe("posts");
    expect(autopilotApprovalGroup("commits", true)).toBe("updates");
    expect(autopilotApprovalGroup("links", false)).toBe("updates");
    expect(autopilotApprovalGroup("readiness", false)).toBe("fixes");
    expect(autopilotApprovalGroup("prompts", false)).toBeNull();
  });

  test("spots fact check flags in the pull request body", () => {
    expect(hasFactCheckFlags("All good")).toBe(false);
    expect(
      hasFactCheckFlags("**Figures no source contains, please check**\n`40%`")
    ).toBe(true);
    expect(
      hasFactCheckFlags("**Please confirm, about your product with no source**")
    ).toBe(true);
  });

  test("cancels from webhooks on drafts and pushes by people only", () => {
    expect(pullRequestEventHoldReason("converted_to_draft", "User")).toBe(
      AUTOPILOT_HOLD_REASONS.draft
    );
    expect(pullRequestEventHoldReason("synchronize", "User")).toBe(
      AUTOPILOT_HOLD_REASONS.pushed
    );
    expect(pullRequestEventHoldReason("synchronize", "Bot")).toBeNull();
    expect(pullRequestEventHoldReason("ready_for_review", "User")).toBeNull();
    expect(pullRequestEventHoldReason("edited", "User", true)).toBe(
      AUTOPILOT_HOLD_REASONS.retargeted
    );
    expect(pullRequestEventHoldReason("edited", "User")).toBeNull();
  });

  test("finds files outside the content folders", () => {
    expect(touchesPathsOutside(["blog/a.mdx"], ["/blog/", null])).toBe(false);
    expect(
      touchesPathsOutside(["blog/a.mdx", "app/layout.tsx"], ["blog"])
    ).toBe(true);
    expect(touchesPathsOutside(["blogs/a.mdx"], ["blog"])).toBe(true);
  });

  test("lets crawler-only files through, never code next to them", () => {
    expect(
      touchesPathsOutside(
        [
          "public/llms.txt",
          "public/llms-full.txt",
          "robots.txt",
          "apps/web/public/sitemap.xml",
          "public/.well-known/llms.txt",
        ],
        [null]
      )
    ).toBe(false);
    expect(touchesPathsOutside(["app/robots.ts"], [null])).toBe(true);
    expect(touchesPathsOutside(["public/llms.txt.js"], [null])).toBe(true);
    expect(
      touchesPathsOutside(["public/.well-known/assetlinks.json"], [null])
    ).toBe(true);
    expect(
      touchesPathsOutside(["public/llms.txt", "app/layout.tsx"], [null])
    ).toBe(true);
  });
});
