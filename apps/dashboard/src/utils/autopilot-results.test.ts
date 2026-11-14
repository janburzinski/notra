import { describe, expect, test } from "bun:test";

import { addPageVisits, resultPage } from "./autopilot-results";

const noSite = () => null;

describe("post results", () => {
  test("finds the page from the update URL, the Site path or the file slug", () => {
    expect(
      resultPage(
        { updatePage: { url: "https://acme.dev/blog/x/", title: "X" } },
        noSite
      )
    ).toEqual({ match: "path", value: "/blog/x" });
    expect(
      resultPage({ filePath: "content/blog/x.mdx" }, () => "/blog/x")
    ).toEqual({ match: "path", value: "/blog/x" });
    expect(resultPage({ filePath: "content/blog/x/index.md" }, noSite)).toEqual(
      { match: "slug", value: "x" }
    );
    expect(resultPage({}, noSite)).toBeNull();
  });

  test("counts the page's Markdown copy and slash variants, and nothing else", () => {
    const visits = {
      ai: [
        { path: "/blog/x", visitorType: "crawler", answering: true, visits: 4 },
        {
          path: "/blog/x.md",
          visitorType: "crawler",
          answering: false,
          visits: 3,
        },
        {
          path: "/blog/x/",
          visitorType: "ai_referral",
          answering: false,
          visits: 2,
        },
        {
          path: "/blog/x/index.md",
          visitorType: "crawler",
          answering: false,
          visits: 5,
        },
        {
          path: "/blog/x-two",
          visitorType: "crawler",
          answering: true,
          visits: 50,
        },
      ],
      human: [
        { path: "/blog/x", views: 10 },
        { path: "/blog/x-two", views: 99 },
      ],
      humanCutOff: false,
    };
    const counts = {
      aiCrawls: 12,
      aiAnswerFetches: 4,
      aiClicks: 2,
      humanViews: 10,
    };
    expect(addPageVisits({ match: "path", value: "/blog/x" }, visits)).toEqual(
      counts
    );
    expect(addPageVisits({ match: "slug", value: "x" }, visits)).toEqual(
      counts
    );
  });

  test("a cut-off list leaves what it may miss unknown, not zero", () => {
    expect(
      addPageVisits(
        { match: "path", value: "/blog/y" },
        { ai: null, human: [{ path: "/blog/x", views: 3 }], humanCutOff: true }
      )
    ).toEqual({
      aiCrawls: null,
      aiAnswerFetches: null,
      aiClicks: null,
      humanViews: null,
    });
    expect(
      addPageVisits(
        { match: "path", value: "/blog/y" },
        { ai: [], human: [], humanCutOff: false }
      )
    ).toEqual({ aiCrawls: 0, aiAnswerFetches: 0, aiClicks: 0, humanViews: 0 });
  });
});
