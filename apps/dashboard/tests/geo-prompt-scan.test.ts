import { describe, expect, test } from "bun:test";

import type { GeoTrackedPrompt } from "@notra/geo-core/types/geo";

import {
  findGeoScanPrompts,
  matchGeoScanPrompt,
  matchTrackedPrompt,
} from "@/utils/geo-prompt-scan";

function tracked(id: string, prompt: string, enabled = true): GeoTrackedPrompt {
  return { id, prompt, enabled, source: "custom", createdAt: null };
}

function matchedId(query: string) {
  const result = matchGeoScanPrompt(prompts, query);
  return result.status === "match" ? result.prompt.id : result.status;
}

const prompts = [
  tracked("p1", "What's a good Jira alternative for a small engineering team?"),
  tracked(
    "p2",
    "Which tools do fast-moving product teams use to track issues?"
  ),
  tracked("p3", "Best issue tracker for startups"),
  tracked("p4", "Best Jira alternative for startups", false),
];

describe("matching the prompt the agent names", () => {
  test("takes an id, including the custom prompt's scan id", () => {
    expect(matchedId("p2")).toBe("p2");
    expect(matchedId("custom-p2")).toBe("p2");
  });

  test("takes the wording, ignoring case, quotes and the question mark", () => {
    expect(
      matchedId(
        '"what\'s a good jira alternative for a small engineering team"'
      )
    ).toBe("p1");
  });

  test("takes a part of the wording only one enabled prompt contains", () => {
    // p4 also says "jira alternative" but is paused, so it can't be scanned.
    expect(matchedId("jira alternative")).toBe("p1");
  });

  test("asks to choose instead of guessing between several", () => {
    expect(matchGeoScanPrompt(prompts, "track")).toEqual({
      status: "choose",
      prompts: [
        {
          id: "p2",
          prompt:
            "Which tools do fast-moving product teams use to track issues?",
        },
        { id: "p3", prompt: "Best issue tracker for startups" },
      ],
    });
  });

  test("lists the enabled prompts when nothing matches", () => {
    expect(matchGeoScanPrompt(prompts, "pricing pages")).toEqual({
      status: "not_found",
      prompts: prompts.slice(0, 3).map(({ id, prompt }) => ({ id, prompt })),
    });
  });
});

describe("finding prompts for the agent", () => {
  const ids = (query?: string) =>
    findGeoScanPrompts(prompts, query).prompts.map((prompt) => prompt.id);

  test("lists every enabled prompt without a query", () => {
    expect(findGeoScanPrompts(prompts, undefined)).toMatchObject({ total: 3 });
  });

  test("matches words in any order when the phrase itself isn't there", () => {
    expect(ids("track")).toEqual(["p2", "p3"]);
    expect(ids("startups tracker")).toEqual(["p3"]);
    expect(ids("pricing")).toEqual([]);
  });
});

describe("matching a prompt to move", () => {
  test("finds a paused prompt that a scan can't use", () => {
    const paused = matchTrackedPrompt(prompts, "p4");
    expect(paused.status === "match" ? paused.prompt.id : paused.status).toBe(
      "p4"
    );
    expect(matchedId("p4")).toBe("not_found");
  });
});
