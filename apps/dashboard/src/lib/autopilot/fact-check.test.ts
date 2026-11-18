import { afterEach, describe, expect, mock, test } from "bun:test";

import { AUTOPILOT_FACT_FLAG_HEADINGS } from "@/constants/autopilot-publish";
import { silentAutopilotLogger } from "@/lib/autopilot/log";
import { hasFactCheckFlags } from "@/utils/autopilot-publish";

const PAGE = [
  "## How do the tools compare?",
  "",
  "| What you need | Notra | Jasper |",
  "| --- | --- | --- |",
  "| Drop alerts | Email and Slack | Sends drop alerts |",
  "",
  "Jasper also tracks AI answers for agencies.",
  "",
].join("\n");

const DROP_ALERT_CLAIM = {
  claim: "Jasper sends drop alerts",
  about: "competitor",
  supported: false,
  source: "",
  quote: "",
  fix: {
    find: "| Sends drop alerts |",
    replace: "| Not stated in the material reviewed |",
  },
};
const TRACKING_CLAIM = {
  claim: "Jasper tracks AI answers for agencies",
  about: "competitor",
  supported: false,
  source: "",
  quote: "",
  fix: {
    find: "Jasper also tracks AI answers for agencies.",
    replace: "",
  },
};

function mockModel(
  removalEdits: unknown[],
  claims: unknown[] = [DROP_ALERT_CLAIM, TRACKING_CLAIM]
) {
  const calls: string[] = [];
  mock.module("@/lib/autopilot/llm", () => ({
    generateAutopilotObject: async (params: { tag: string }) => {
      calls.push(params.tag);
      return params.tag === "fact-check" ? { claims } : { edits: removalEdits };
    },
  }));
  return calls;
}

async function check() {
  const { factCheckComparison, factCheckSection } =
    await import("@/lib/autopilot/fact-check");
  const result = await factCheckComparison({
    organizationId: "org-1",
    log: silentAutopilotLogger,
    content: PAGE,
    sources: [{ label: "https://notra.example", text: "Notra alerts." }],
    brand: "Notra",
    competitor: "Jasper",
  });
  return { ...result, section: factCheckSection(result.report) };
}

afterEach(() => {
  mock.restore();
});

describe("factCheckComparison", () => {
  test("marks a gap in a table cell and removes the claim from prose", async () => {
    const calls = mockModel([]);
    const { content, report } = await check();
    expect(calls).toEqual(["fact-check"]);
    expect(content).toContain("| Not stated in the material reviewed |");
    expect(content).not.toContain("Sends drop alerts");
    expect(content).not.toContain("tracks AI answers");
    expect(report.uncut).toEqual([]);
  });

  test("keeps a finished page and holds it when a claim can't be cut", async () => {
    // Neither the fix nor the second try finds the passage in the page.
    const stuck = {
      ...DROP_ALERT_CLAIM,
      fix: { find: "| Sends weekly digests |", replace: "" },
    };
    mockModel(
      [{ claim: stuck.claim, find: "| Sends weekly digests |", replace: "" }],
      [stuck, TRACKING_CLAIM]
    );
    const { content, report, section } = await check();
    expect(content).not.toContain("tracks AI answers");
    expect(report.uncut).toEqual([stuck.claim]);
    expect(section).toContain(AUTOPILOT_FACT_FLAG_HEADINGS.uncut);
    expect(hasFactCheckFlags(section)).toBe(true);
  });
});
