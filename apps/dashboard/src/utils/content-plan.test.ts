import { describe, expect, test } from "bun:test";

import type { GeoContentBrief } from "@notra/ai/types/geo-writer";

import { completePlanLink, toKeyedPlan, toSavableBrief } from "./content-plan";

const brief: GeoContentBrief = {
  targetPrompt: "How do content plans work?",
  intent: "Learn",
  contentSubtype: "guide",
  workingTitle: "Content plans",
  audience: "Content teams",
  jobToBeDone: "Create a useful plan",
  sections: [
    { heading: "First", goal: "Explain the first step", claims: [] },
    { heading: "Second", goal: "Explain the second step", claims: [] },
    { heading: "Third", goal: "Explain the third step", claims: [] },
  ],
  questionsToAnswer: [],
  internalLinks: [],
  acceptanceChecklist: [],
};

describe("toSavableBrief", () => {
  test("does not save a draft with an incomplete section", () => {
    const draft = toKeyedPlan(brief);
    const section = draft.sections[0];
    if (!section) {
      throw new Error("Expected a section");
    }
    section.heading = "";

    expect(toSavableBrief(draft)).toBeNull();
    expect(section.goal).toBe("Explain the first step");
  });

  test("does not drop an existing link while its URL is invalid", () => {
    const draft = toKeyedPlan({
      ...brief,
      internalLinks: [
        {
          url: "https://example.com/docs",
          anchor: "Docs",
          why: "More detail",
        },
      ],
    });
    const link = draft.internalLinks[0];
    if (!link) {
      throw new Error("Expected an internal link");
    }
    link.url = "https://example .com";

    expect(toSavableBrief(draft)).toBeNull();
    expect(draft.internalLinks).toHaveLength(1);
  });
});

describe("completePlanLink", () => {
  test("accepts only HTTP and HTTPS URLs", () => {
    expect(
      completePlanLink({ url: "not a url", anchor: "", why: "" })
    ).toBeNull();
    expect(
      completePlanLink({ url: "ftp://example.com/file", anchor: "", why: "" })
    ).toBeNull();
    expect(
      completePlanLink({
        url: "https://example.com/docs/getting-started",
        anchor: "",
        why: "",
      })
    ).toEqual({
      url: "https://example.com/docs/getting-started",
      anchor: "getting started",
      why: "Include this page as an internal link.",
    });
  });
});
