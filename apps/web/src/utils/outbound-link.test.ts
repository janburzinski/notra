import { expect, test } from "bun:test";

import { getOutboundLinkDomain } from "@/utils/outbound-link";

test("external links resolve to their domain without www", () => {
  expect(getOutboundLinkDomain("https://github.com/usenotra")).toBe(
    "github.com"
  );
  expect(getOutboundLinkDomain("https://www.granola.ai/")).toBe("granola.ai");
  expect(getOutboundLinkDomain("http://daily.dev")).toBe("daily.dev");
  expect(getOutboundLinkDomain("https://notusenotra.com")).toBe(
    "notusenotra.com"
  );
});

test("first-party, relative and non-http links are skipped", () => {
  for (const href of [
    "https://www.usenotra.com/blog",
    "https://usenotra.com",
    "https://app.usenotra.com/login",
    "/blog/some-post",
    "#section",
    "mailto:hi@example.com",
    undefined,
  ]) {
    expect(getOutboundLinkDomain(href)).toBeNull();
  }
});
