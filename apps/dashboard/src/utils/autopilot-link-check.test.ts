import { describe, expect, test } from "bun:test";

import { describeLinkCheck, extractPageLinks } from "./autopilot-link-check";

describe("extractPageLinks", () => {
  test("every http link once, absolute and without its section", () => {
    const html = `
      <a href="/pricing">Pricing</a>
      <a class="x" href='docs/start?step=1&amp;lang=en#setup'>Docs</a>
      <A HREF=https://other.test/a>Other</A>
      <a href="https://acme.test/pricing#plans">Pricing again</a>
      <a href="#top">Top</a>
      <a href="mailto:hi@acme.test">Mail</a>
      <a href="tel:+491234">Call</a>
      <a href="javascript:void(0)">Nothing</a>
      <a href="ftp://files.acme.test/x">FTP</a>
      <a href="">Empty</a>
      <a name="anchor">No link</a>
      <link href="/style.css" rel="stylesheet">
      <a href="http://[bad">Malformed</a>
    `;
    expect(extractPageLinks(html, "https://acme.test/blog/")).toEqual([
      "https://acme.test/pricing",
      "https://acme.test/blog/docs/start?step=1&lang=en",
      "https://other.test/a",
    ]);
  });
});

describe("extractPageLinks reads links as a browser does", () => {
  test("a data-href is not the link's address", () => {
    expect(
      extractPageLinks(
        '<a data-href="/old" href="/current">x</a><a data-href="/only-data">y</a>',
        "https://acme.test/"
      )
    ).toEqual(["https://acme.test/current"]);
  });

  test("relative links resolve against the page's <base href>", () => {
    const html =
      '<head><base href="/"></head><a href="pricing">p</a><a href="/docs">d</a>';
    expect(extractPageLinks(html, "https://acme.test/docs/start")).toEqual([
      "https://acme.test/pricing",
      "https://acme.test/docs",
    ]);
    expect(
      extractPageLinks(
        '<base href="https://cdn.acme.test/en/"><a href="guide">g</a>',
        "https://acme.test/x"
      )
    ).toEqual(["https://cdn.acme.test/en/guide"]);
    // A broken base is ignored like a browser ignores it.
    expect(
      extractPageLinks(
        '<base href="http://[x"><a href="a">a</a>',
        "https://acme.test/b/"
      )
    ).toEqual(["https://acme.test/b/a"]);
  });
});

describe("describeLinkCheck", () => {
  const base = {
    site: "acme.test",
    pagesChecked: 12,
    pagesFailed: 0,
    linksChecked: 80,
    skipped: 0,
    broken: [],
    unreachable: [],
    missingPages: [],
    days: 7,
  };

  test("a clean site says so in one sentence", () => {
    const { summary, report } = describeLinkCheck(base);
    expect(summary).toBe(
      "Checked 80 links on 12 pages of acme.test: no broken links."
    );
    expect(report).toBe(summary);
  });

  test("own pages first, then visitor 404s and links that didn't answer", () => {
    const { summary, report } = describeLinkCheck({
      ...base,
      pagesFailed: 1,
      skipped: 40,
      broken: [
        {
          url: "https://other.test/gone",
          status: 410,
          internal: false,
          foundOn: ["/blog/a"],
        },
        {
          url: "https://acme.test/old-pricing",
          status: 404,
          internal: true,
          foundOn: ["/", "/docs", "/blog/a", "/blog/b", "/blog/c"],
        },
      ],
      unreachable: [
        {
          url: "https://slow.test/",
          internal: false,
          foundOn: ["/about"],
        },
      ],
      missingPages: [{ path: "/careers", views: 1 }],
      days: 1,
    });
    expect(summary).toBe(
      "Checked 80 links on 12 pages of acme.test: 2 broken links (1 to your own pages), 1 that didn't answer. Visitors opened 1 missing page in the last day. 40 more links weren't checked this time; 1 page didn't load."
    );
    expect(report.split("\n").slice(1)).toEqual([
      "",
      "*Broken links*",
      "• https://acme.test/old-pricing (404) on /, /docs, /blog/a and 2 more",
      "• https://other.test/gone (410) on /blog/a",
      "",
      "*Missing pages visitors opened*",
      "• /careers (1 view)",
      "",
      "*Didn't answer (may be down or blocking checks)*",
      "• https://slow.test/ on /about",
    ]);
  });

  test("long lists end with a count", () => {
    const broken = Array.from({ length: 13 }, (_, index) => ({
      url: `https://acme.test/gone-${index}`,
      status: 404,
      internal: true,
      foundOn: ["/"],
    }));
    const { report } = describeLinkCheck({ ...base, broken });
    expect(report).toContain("• https://acme.test/gone-9 (404) on /");
    expect(report).not.toContain("gone-10");
    expect(report.endsWith("• and 3 more")).toBe(true);
  });
});
