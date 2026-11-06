import { describe, expect, test } from "bun:test";

import { domainRecheckWindows } from "../src/utils/domain-recheck";
import { redirectedWwwTwin, wwwTwin } from "../src/utils/www-twin";

const now = new Date("2026-11-06T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

// Mirrors the query in recheckDueSiteDomains: a domain is due when it matches a window.
function isDue(
  domain: {
    createdAt: Date;
    lastCheckedAt: Date | null;
    verifiedAt: Date | null;
  },
  at: Date
) {
  return domainRecheckWindows(at).some(
    ({ createdAfter, checkedBefore }) =>
      (createdAfter
        ? domain.verifiedAt === null && domain.createdAt > createdAfter
        : domain.verifiedAt !== null) &&
      (domain.lastCheckedAt === null || domain.lastCheckedAt <= checkedBefore)
  );
}

describe("domainRecheckWindows", () => {
  test("checks a new domain every minute, then every 10 minutes, then hourly, then stops", () => {
    const due = (createdMinutesAgo: number, checkedMinutesAgo: number | null) =>
      isDue(
        {
          createdAt: ago(createdMinutesAgo),
          lastCheckedAt:
            checkedMinutesAgo === null ? null : ago(checkedMinutesAgo),
          verifiedAt: null,
        },
        now
      );
    expect(due(5, null)).toBe(true);
    expect(due(5, 0.5)).toBe(false);
    expect(due(5, 1)).toBe(true);
    expect(due(120, 5)).toBe(false);
    expect(due(120, 10)).toBe(true);
    expect(due(3 * 24 * 60, 30)).toBe(false);
    expect(due(3 * 24 * 60, 60)).toBe(true);
    expect(due(8 * 24 * 60, 600)).toBe(false);
    expect(due(8 * 24 * 60, null)).toBe(false);
  });

  test("checks a domain that worked before hourly, however old it is", () => {
    const domain = {
      createdAt: ago(60 * 24 * 90),
      verifiedAt: ago(60 * 24 * 80),
    };
    expect(isDue({ ...domain, lastCheckedAt: ago(61) }, now)).toBe(true);
    expect(isDue({ ...domain, lastCheckedAt: ago(30) }, now)).toBe(false);
  });
});

describe("www twins", () => {
  const redirect = (location: string, status = 307) =>
    new Response(null, { status, headers: { location } });
  const url = "https://acme.com/blog/_notra/probe.txt";

  test("adds or removes www", () => {
    expect(wwwTwin("acme.com")).toBe("www.acme.com");
    expect(wwwTwin("www.acme.com")).toBe("acme.com");
  });

  test("follows only an HTTPS redirect to the twin", () => {
    expect(
      redirectedWwwTwin(redirect("https://www.acme.com/blog"), url, "acme.com")
    ).toBe("www.acme.com");
    expect(
      redirectedWwwTwin(
        redirect("https://acme.com/x"),
        "https://www.acme.com/x",
        "www.acme.com"
      )
    ).toBe("acme.com");
    expect(
      redirectedWwwTwin(redirect("http://www.acme.com/blog"), url, "acme.com")
    ).toBeNull();
    expect(
      redirectedWwwTwin(redirect("https://evil.example/"), url, "acme.com")
    ).toBeNull();
    expect(
      redirectedWwwTwin(
        redirect("https://www.acme.com.evil.example/"),
        url,
        "acme.com"
      )
    ).toBeNull();
    expect(redirectedWwwTwin(new Response("ok"), url, "acme.com")).toBeNull();
    expect(
      redirectedWwwTwin(redirect("/elsewhere"), url, "acme.com")
    ).toBeNull();
  });
});
