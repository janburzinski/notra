import { describe, expect, test } from "bun:test";

import { applyPageEdits } from "@/utils/autopilot-edits";

const TABLE = [
  "| Question | Writing tools | Notra |",
  "| --- | --- | --- |",
  '| "Does ChatGPT name us?" | Not the main purpose | Core job |',
  "| Drafts content | Core job | Core job |",
].join("\n");

describe("applyPageEdits", () => {
  test("rejects an edit that leaves a table row without its pipes", () => {
    const result = applyPageEdits(TABLE, [
      {
        action: "cut",
        section: "row",
        find: '| "Does ChatGPT name us?" |',
        replace: '"Does ChatGPT name us?" |',
      },
    ]);
    expect(result.content).toBe(TABLE);
    expect(result.rejected[0]?.reason).toBe("The edit breaks a table row");
  });

  test("allows dropping a whole row or editing a cell", () => {
    const result = applyPageEdits(TABLE, [
      {
        action: "cut",
        section: "row",
        find: '| "Does ChatGPT name us?" | Not the main purpose | Core job |\n',
        replace: "",
      },
      {
        action: "cut",
        section: "cell",
        find: "| Drafts content | Core job |",
        replace: "| Drafts content | Main job |",
      },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.content).not.toContain("Does ChatGPT name us?");
    expect(result.content).toContain(
      "| Drafts content | Main job | Core job |"
    );
  });

  test("allows an edit across a row and prose with an inline pipe", () => {
    const page = `${TABLE}\n\nRun \`a | b\` to pipe it.`;
    const result = applyPageEdits(page, [
      {
        action: "cut",
        section: "row and prose",
        find: "| Drafts content | Core job | Core job |\n\nRun `a | b` to pipe it.",
        replace:
          "| Drafts content | Core job | Main job |\n\nRun `a | b` to chain it.",
      },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.content).toContain("to chain it.");
  });
});
