import { describe, expect, test } from "bun:test";

import type { MentionTrendRow } from "@/types/geo";
import { fitMentionTrendLine } from "@/utils/geo-charts";

const TOTAL_KEY = "total";

describe("fitMentionTrendLine", () => {
  test("projects through today without fitting today's partial total", () => {
    const rows: MentionTrendRow[] = [
      { day: "Aug 25", rawDay: "2026-08-25", [TOTAL_KEY]: 10 },
      { day: "Aug 26", rawDay: "2026-08-26", [TOTAL_KEY]: 20 },
      { day: "Aug 27", rawDay: "2026-08-27", [TOTAL_KEY]: 2 },
    ];

    expect(fitMentionTrendLine(rows, TOTAL_KEY, "2026-08-27")).toEqual([
      10, 20, 30,
    ]);
  });
});
