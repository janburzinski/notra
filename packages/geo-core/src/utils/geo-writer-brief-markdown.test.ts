import { describe, expect, test } from "bun:test";

import type { GeoContentBrief } from "@notra/ai/types/geo-writer";

import {
  geoBriefToMarkdown,
  markdownToGeoBrief,
} from "./geo-writer-brief-markdown";

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
  questionsToAnswer: ["What is a content plan?"],
  internalLinks: [
    {
      anchor: "Function docs",
      url: "https://example.com/docs/function_(programming)",
      why: "Provides implementation details",
    },
  ],
  acceptanceChecklist: ["Answer the target prompt"],
};

const fallback = {
  workingTitle: brief.workingTitle,
  contentSubtype: brief.contentSubtype,
};

describe("markdownToGeoBrief", () => {
  test("preserves internal-link URLs containing parentheses", () => {
    const parsed = markdownToGeoBrief(geoBriefToMarkdown(brief), fallback);

    expect(parsed?.internalLinks[0]?.url).toBe(
      "https://example.com/docs/function_(programming)"
    );
    expect(parsed?.internalLinks[0]?.anchor).toBe("Function docs");
    expect(parsed?.internalLinks[0]?.why).toBe(
      "Provides implementation details"
    );
  });

  test("preserves an internal-link URL with an unmatched parenthesis", () => {
    const input = {
      ...brief,
      internalLinks: [
        {
          anchor: "Function docs",
          url: "https://example.com/docs/function_(programming",
          why: "Provides implementation details",
        },
      ],
    };

    const parsed = markdownToGeoBrief(geoBriefToMarkdown(input), fallback);

    expect(parsed?.internalLinks[0]?.url).toBe(
      "https://example.com/docs/function_(programming"
    );
  });

  for (const heading of ["FAQ", "Internal links", "Acceptance checklist"]) {
    test(`keeps an outline section named ${heading}`, () => {
      const input = {
        ...brief,
        sections: brief.sections.map((section, index) =>
          index === 1 ? { ...section, heading } : section
        ),
      };

      const parsed = markdownToGeoBrief(geoBriefToMarkdown(input), fallback);

      expect(JSON.stringify(parsed?.sections)).toBe(
        JSON.stringify(input.sections)
      );
    });
  }

  test("rejects reordered required blocks", () => {
    const markdown = geoBriefToMarkdown(brief);
    const faqStart = markdown.indexOf("## FAQ");
    const linksStart = markdown.indexOf("## Internal links");
    const checklistStart = markdown.indexOf("## Acceptance checklist");
    const prefix = markdown.slice(0, faqStart);
    const faq = markdown.slice(faqStart, linksStart);
    const links = markdown.slice(linksStart, checklistStart);
    const checklist = markdown.slice(checklistStart);

    expect(
      markdownToGeoBrief(`${prefix}${links}${faq}${checklist}`, fallback)
    ).toBe(null);
  });
});
