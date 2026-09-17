import { describe, expect, test } from "bun:test";

import { buildDailySummaryHeadline } from "./daily-summary";

describe("buildDailySummaryHeadline", () => {
  test("reports gains and losses separately", () => {
    expect(
      buildDailySummaryHeadline({
        gained: 2,
        lost: 5,
        mentionRateLabel: "42%",
      })
    ).toBe("You gained 2 prompts but lost 5 yesterday.");
  });

  test("pluralizes one-sided changes", () => {
    expect(
      buildDailySummaryHeadline({
        gained: 1,
        lost: 0,
        mentionRateLabel: "42%",
      })
    ).toBe("You gained 1 prompt yesterday.");
    expect(
      buildDailySummaryHeadline({
        gained: 0,
        lost: 1,
        mentionRateLabel: "42%",
      })
    ).toBe("You lost 1 prompt yesterday.");
  });
});
