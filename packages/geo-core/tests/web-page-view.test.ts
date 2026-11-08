import { describe, expect, mock, test } from "bun:test";

// Visitor ids read the daily salt from Redis; keep this test off any real one.
mock.module("@notra/ai/utils/redis", () => ({ redis: null }));

const { classifyWebReferrer, describeUserAgent, webLanguage, webVisitorId } =
  await import("../src/ingest/web");
import type { WebPageViewInput } from "../src/types/ingest";
import { scrubWebErrorText } from "../src/utils/web-error-scrub";
import { isHumanPageView, webPagePath } from "../src/utils/web-page-view";
import { scrubWebPath } from "../src/utils/web-path-scrub";
import { CHROME } from "./constants/web-page-view";

process.env.GEO_INGEST_SECRET = "test-secret";

function input(overrides: Partial<WebPageViewInput> = {}): WebPageViewInput {
  return {
    identity: { organizationId: "org", projectId: "prj", generation: 1 },
    payload: { method: "GET", url: "https://acme.com/blog", userAgent: CHROME },
    url: new URL("https://acme.com/blog"),
    capturedAt: new Date("2026-10-06T12:00:00Z"),
    classification: {
      visitorType: "human",
      source: "human",
      agent: "",
      category: "",
      confidence: "",
    },
    ...overrides,
  } as WebPageViewInput;
}

describe("isHumanPageView", () => {
  test("counts people and AI referrals, nothing else", () => {
    expect(isHumanPageView(input())).toBe(true);
    expect(
      isHumanPageView(
        input({
          classification: { ...input().classification, visitorType: "crawler" },
        })
      )
    ).toBe(false);
  });

  test("skips prefetches, redirects, non-AI bots and files for machines", () => {
    const base = input();
    expect(
      isHumanPageView({
        ...base,
        payload: {
          ...base.payload,
          signals: {
            clientHints: true,
            fetchMode: null,
            tracing: false,
            prefetch: true,
          },
        },
      })
    ).toBe(false);
    expect(
      isHumanPageView({ ...base, payload: { ...base.payload, status: 301 } })
    ).toBe(false);
    expect(
      isHumanPageView({ ...base, payload: { ...base.payload, status: 404 } })
    ).toBe(true);
    expect(
      isHumanPageView({
        ...base,
        payload: {
          ...base.payload,
          userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
        },
      })
    ).toBe(false);
    expect(
      isHumanPageView({
        ...base,
        url: new URL("https://acme.com/blog/post.md"),
      })
    ).toBe(false);
    expect(
      isHumanPageView({ ...base, url: new URL("https://acme.com/llms.txt") })
    ).toBe(false);
  });
});

describe("referrers", () => {
  test("groups search, social, internal, direct and AI", () => {
    expect(
      classifyWebReferrer("https://www.google.de/", "acme.com", null)
    ).toMatchObject({ group: "search", source: "google" });
    expect(
      classifyWebReferrer("https://t.co/abc", "acme.com", null)
    ).toMatchObject({ group: "social", source: "x" });
    expect(
      classifyWebReferrer("https://www.acme.com/pricing", "acme.com", null)
    ).toMatchObject({ group: "internal" });
    expect(classifyWebReferrer(undefined, "acme.com", null)).toMatchObject({
      group: "direct",
    });
    expect(
      classifyWebReferrer("https://example.org/", "acme.com", null)
    ).toMatchObject({ group: "other", source: "example.org" });
    expect(
      classifyWebReferrer("https://chatgpt.com/", "acme.com", "chatgpt")
    ).toMatchObject({ group: "ai", source: "chatgpt", aiProduct: "openai" });
  });
});

describe("visitor id", () => {
  test("stable within a day, different the next day and per site", async () => {
    const day = new Date("2026-10-06T08:00:00Z");
    const later = new Date("2026-10-06T22:00:00Z");
    const next = new Date("2026-10-07T08:00:00Z");
    const id = await webVisitorId("site_a", "1.2.3.4", CHROME, day);
    expect(id).toHaveLength(16);
    expect(await webVisitorId("site_a", "1.2.3.4", CHROME, later)).toBe(id);
    expect(await webVisitorId("site_a", "1.2.3.4", CHROME, next)).not.toBe(id);
    expect(await webVisitorId("site_b", "1.2.3.4", CHROME, day)).not.toBe(id);
  });
});

test("user agents become coarse classes", () => {
  expect(describeUserAgent(CHROME)).toEqual({
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
  });
  expect(
    describeUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    )
  ).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
});

test("hash routes are kept only on request, path-like, scrubbed and capped", () => {
  const path = (url: string, hashRoutes = true) =>
    webPagePath(new URL(`https://acme.com${url}`), hashRoutes);
  expect(path("/#/pricing", false)).toBe("/");
  expect(path("/#/pricing?plan=pro")).toBe("/#/pricing");
  expect(path("/app#!/settings/team&tab=1")).toBe("/app#!/settings/team");
  expect(path("/#section")).toBe("/");
  expect(path("/#access_token=abc.def&x=1")).toBe("/");
  expect(path("/app#/invite/Zx8Kq2LmP4wR7tYu9VbN3cHj")).toBe(
    "/app#/invite/:id"
  );
  expect(path(`/#/${"a".repeat(400)}`)).toHaveLength(1 + 256);
});

test("language is the primary subtag of the first Accept-Language entry", () => {
  expect(webLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
  expect(webLanguage("*")).toBe("");
});

test("error text loses emails, numbers, tokens, keys and URL queries, and is capped", () => {
  expect(
    scrubWebErrorText(
      "Cannot read 'x' of user a.b+c@mail.co id 98765 hash 3f9a1c2b7d8e4f60aa https://x.test/a?b=1#c\n  next"
    )
  ).toBe("Cannot read 'x' of user [email] id # hash # https://x.test/a next");
  expect(
    scrubWebErrorText(
      "401 for eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXZhbHVl with sk_live_51HxYzAbCdEfGhIjKl from /api/me?token=abc&x=1 or (./data.json?v=2)"
    )
  ).toBe("401 for # with # from /api/me or (./data.json)");
  expect(scrubWebErrorText("uncaught-exception-in-the-checkout-flow")).toBe(
    "uncaught-exception-in-the-checkout-flow"
  );
  expect(scrubWebErrorText("a".repeat(400))).toHaveLength(300);
});

test("ids and personal data in paths become :id, readable slugs stay", () => {
  expect(
    scrubWebPath(
      "/u/jan@example.com/jan%40example.com/3f2b8c1e-9a4d-4e6f-b1c2-7d8e9f0a1b2c/48213/Zx8Kq2LmP4wR7tYu9VbN3cHj/pdf"
    )
  ).toBe("/u/:id/:id/:id/:id/:id/pdf");
  expect(scrubWebPath("/blog/how-to-install-notra-on-any-website")).toBe(
    "/blog/how-to-install-notra-on-any-website"
  );
  expect(scrubWebPath("/docs/getting-started/Introduction")).toBe(
    "/docs/getting-started/Introduction"
  );
});
