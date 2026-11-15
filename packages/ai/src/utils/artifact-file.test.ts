import { describe, expect, test } from "bun:test";

import type { ArtifactContent } from "@notra/ai/types/artifact";
import {
  parseArtifactFile,
  serializeArtifactFile,
} from "@notra/ai/utils/artifact-file";

const REPORT: ArtifactContent = {
  title: "Weekly AI traffic: what moved",
  summary: "ChatGPT referrals rose 18%.\nClaude doubled.",
  blocks: [
    {
      type: "metrics",
      items: [
        { label: "Visits", value: "12.4k", change: "+18%", trend: "up" },
        { label: "Bounce rate", value: "41%", change: "-3%", trend: "up" },
      ],
    },
    {
      type: "text",
      markdown: "## What changed\n\nReferrals from **ChatGPT** grew.",
    },
    {
      type: "table",
      title: "By source",
      columns: ["Source", "Visits", "Change"],
      rows: [
        ["ChatGPT", 8200, "+18%"],
        ["Claude", 2100, "+104%"],
        ["Perplexity", null, "0%"],
      ],
    },
    {
      type: "text",
      markdown: 'A sample:\n\n```json\n{"not": "a block"}\n```\n\nStill text.',
    },
    {
      type: "callout",
      tone: "warning",
      text: "Gemini fell for the third week.",
    },
    { type: "autopilot", findingIds: ["f1", "f2"] },
    {
      type: "sources",
      items: [{ title: "Analytics", url: "https://example.com/a" }],
    },
  ],
};

describe("artifact file", () => {
  test("round-trips every block kind", () => {
    const file = serializeArtifactFile(REPORT);
    const parsed = parseArtifactFile(file);
    expect(parsed.issues).toEqual([]);
    expect(parsed.content).toEqual({
      ...REPORT,
      // Frontmatter is one line per value.
      summary: "ChatGPT referrals rose 18%. Claude doubled.",
    });
  });

  test("writes one table row per line once the table is too wide", () => {
    const file = serializeArtifactFile({
      title: "Rows",
      blocks: [
        {
          type: "table",
          columns: ["Source", "Visits", "Change", "Note"],
          rows: Array.from({ length: 4 }, (_, row) => [
            `Source ${row}`,
            row * 100,
            `+${row}%`,
            "A note long enough to push the table past one line",
          ]),
        },
      ],
    });
    expect(file).toContain(
      '\n    ["Source 2", 200, "+2%", "A note long enough to push the table past one line"],\n'
    );
  });

  test("reports bad JSON and invalid blocks with their line", () => {
    const parsed = parseArtifactFile(
      [
        "---",
        "title: Broken",
        "---",
        "",
        "Intro.",
        "",
        "```metrics",
        "{ items: [] }",
        "```",
        "",
        "```callout",
        '{"tone":"loud","text":"x"}',
        "```",
      ].join("\n")
    );
    expect(parsed.issues.map((issue) => issue.line)).toEqual([7, 11]);
    expect(parsed.issues[1]?.message).toContain("tone");
    // Readers keep what is fine.
    expect(parsed.content?.blocks).toEqual([
      { type: "text", markdown: "Intro." },
    ]);
  });

  test("needs frontmatter with a title", () => {
    const parsed = parseArtifactFile("Just text.\n");
    expect(parsed.content).toBeNull();
    expect(parsed.issues[0]?.line).toBe(1);
  });

  test("an unclosed block is reported, not swallowed silently", () => {
    const parsed = parseArtifactFile(
      '---\ntitle: T\n---\n\nText.\n\n```table\n{"columns":["A"],"rows":[]}\n'
    );
    expect(parsed.issues).toEqual([
      { line: 7, message: "The table block has no closing ```" },
    ]);
  });

  test("a quoted title survives the round trip", () => {
    const content: ArtifactContent = {
      title: '"Quoted" launch',
      blocks: [{ type: "text", markdown: "Body." }],
    };
    expect(parseArtifactFile(serializeArtifactFile(content)).content).toEqual(
      content
    );
  });

  test("an open code fence in text is closed, so later blocks survive", () => {
    const content: ArtifactContent = {
      title: "Fences",
      blocks: [
        { type: "text", markdown: "Sample:\n\n```ts\nconst a = 1;" },
        { type: "callout", tone: "info", text: "Still a callout." },
      ],
    };
    const parsed = parseArtifactFile(serializeArtifactFile(content));
    expect(parsed.issues).toEqual([]);
    expect(parsed.content?.blocks[1]).toEqual(content.blocks[1]);
  });

  test("a writer's unclosed code fence is an issue, not swallowed blocks", () => {
    const parsed = parseArtifactFile(
      '---\ntitle: T\n---\n\nSample:\n```ts\ncode\n\n```callout\n{"tone":"info","text":"x"}\n```\n'
    );
    expect(parsed.issues).toEqual([
      {
        line: 9,
        message:
          "The callout block starts inside the code fence opened on line 6; close that fence first",
      },
    ]);
    const unclosed = parseArtifactFile("---\ntitle: T\n---\n\n```ts\ncode\n");
    expect(unclosed.issues[0]?.line).toBe(5);
    expect(unclosed.issues[0]?.message).toContain("never closed");
  });
});
