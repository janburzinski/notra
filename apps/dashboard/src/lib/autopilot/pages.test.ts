import { afterAll, describe, expect, mock, test } from "bun:test";

type Answer =
  | { status: number; location?: string; body?: string }
  | { error: string };

const site: Record<string, Answer> = {
  "https://acme.test/ok": { status: 200 },
  "https://acme.test/gone": { status: 404 },
  "https://acme.test/removed": { status: 410 },
  "https://acme.test/bot-wall": { status: 403 },
  "https://acme.test/rate-limited": { status: 429 },
  "https://acme.test/down": { status: 503 },
  "https://acme.test/timeout": { error: "The operation timed out" },
  "https://acme.test/moved": { status: 301, location: "/moved-here" },
  "https://acme.test/moved-here": { status: 200 },
  "https://acme.test/moved-away": { status: 308, location: "/gone" },
  "https://acme.test/loop": { status: 302, location: "/loop" },
  "https://acme.test/page": {
    status: 200,
    body: '<a href="/ok">Ok</a>',
  },
};

const agents: { url: string; userAgent: string | null }[] = [];

mock.module("@notra/ai/utils/public-fetch", () => ({
  fetchPublicUrl: async (input: string | URL, init?: RequestInit) => {
    agents.push({
      url: String(input),
      userAgent: new Headers(init?.headers).get("user-agent"),
    });
    const answer = site[String(input)] ?? { status: 404 };
    if ("error" in answer) {
      throw new Error(answer.error);
    }
    return new Response(answer.body ?? "", {
      status: answer.status,
      headers: answer.location ? { location: answer.location } : {},
    });
  },
}));

const { checkLinkStatus, fetchPageHtml, resolveLinks } =
  await import("./pages");
const { AUTOPILOT_LINK_CHECK_USER_AGENT } =
  await import("@/constants/autopilot-link-check");
const { AUTOPILOT_RENDERING_CRAWLER_USER_AGENT } =
  await import("@/constants/autopilot-rendering");

afterAll(() => {
  mock.restore();
});

describe("checkLinkStatus", () => {
  test("only 404 and 410 are gone, after following redirects", async () => {
    const status = (path: string) =>
      checkLinkStatus(`https://acme.test${path}`);
    expect(await status("/ok")).toEqual({ kind: "ok" });
    expect(await status("/moved")).toEqual({ kind: "ok" });
    expect(await status("/gone")).toEqual({ kind: "gone", status: 404 });
    expect(await status("/removed")).toEqual({ kind: "gone", status: 410 });
    expect(await status("/moved-away")).toEqual({ kind: "gone", status: 404 });
  });

  test("bot walls work for readers, so they count as working", async () => {
    expect(await checkLinkStatus("https://acme.test/bot-wall")).toEqual({
      kind: "ok",
    });
    expect(await checkLinkStatus("https://acme.test/rate-limited")).toEqual({
      kind: "ok",
    });
  });

  test("server errors, timeouts and loops are unreachable, not gone", async () => {
    for (const path of ["/down", "/timeout", "/loop"]) {
      expect(await checkLinkStatus(`https://acme.test${path}`)).toEqual({
        kind: "unreachable",
      });
    }
  });
});

describe("fetchPageHtml", () => {
  test("the HTML of a page that loads, nothing for one that doesn't", async () => {
    expect(await fetchPageHtml("https://acme.test/page")).toEqual({
      html: '<a href="/ok">Ok</a>',
      url: "https://acme.test/page",
    });
    expect(await fetchPageHtml("https://acme.test/gone")).toBeNull();
    expect(await fetchPageHtml("https://acme.test/timeout")).toBeNull();
  });
});

describe("resolveLinks", () => {
  test("still drops gone links and follows same-site redirects", async () => {
    const { dead, moved } = await resolveLinks([
      "https://acme.test/ok",
      "https://acme.test/gone",
      "https://acme.test/moved",
    ]);
    expect(dead).toEqual(["https://acme.test/gone"]);
    expect([...moved]).toEqual([
      ["https://acme.test/moved", "https://acme.test/moved-here"],
    ]);
  });
});

describe("user agents", () => {
  test("the link check reads pages as a browser; draft link checks keep the crawler", async () => {
    agents.length = 0;
    await fetchPageHtml("https://acme.test/page");
    await checkLinkStatus("https://acme.test/ok");
    expect(agents.map((row) => row.userAgent)).toEqual([
      AUTOPILOT_LINK_CHECK_USER_AGENT,
      AUTOPILOT_LINK_CHECK_USER_AGENT,
    ]);
    agents.length = 0;
    await resolveLinks(["https://acme.test/ok"]);
    expect(agents.map((row) => row.userAgent)).toEqual([
      AUTOPILOT_RENDERING_CRAWLER_USER_AGENT,
    ]);
  });
});
