import { expect, test } from "bun:test";

import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";
import type { SiteRedirectRule } from "@notra/sites-core/types/deployment";
import { redirectPatternIssues } from "@notra/sites-core/utils/redirect-patterns";
import {
  matchRedirect,
  siteRedirectRules,
} from "@notra/sites-core/utils/redirects";

const rule = (
  source: string,
  destination: string,
  status: SiteRedirectRule["status"] = 308
): SiteRedirectRule => ({ source, destination, status });

const redirectIssues = (source: string, destination: string) => {
  const parsed = siteConfigSchema.safeParse({
    name: "Acme",
    redirects: [{ source, destination }],
  });
  return parsed.success
    ? []
    : parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
};

test("exact sources match with or without a trailing slash", () => {
  const rules = [
    { source: "/blog/old/", destination: "/blog/new", status: 308 as const },
  ];
  expect(matchRedirect(rules, "/blog/old")).toEqual({
    location: "/blog/new",
    status: 308,
  });
  expect(matchRedirect(rules, "/blog/old/")?.location).toBe("/blog/new");
  expect(matchRedirect(rules, "/blog/older")).toBeNull();
  expect(matchRedirect(rules, "/blog")).toBeNull();
  expect(matchRedirect(rules, "/blog/old/more")).toBeNull();
});

test("wildcards carry the encoded remainder", () => {
  const rules = [
    {
      source: "/docs/*",
      destination: "https://docs.example.com/*",
      status: 307 as const,
    },
  ];
  expect(matchRedirect(rules, "/docs/getting started")?.location).toBe(
    "https://docs.example.com/getting%20started"
  );
  expect(matchRedirect(rules, "/docs")?.location).toBe(
    "https://docs.example.com"
  );
  expect(matchRedirect(rules, "/docs/a/b/")?.location).toBe(
    "https://docs.example.com/a/b"
  );
  expect(matchRedirect(rules, "/docsy")).toBeNull();
});

test("wildcards without a wildcard destination and exact /* destinations stay as written", () => {
  const rules = [
    rule("/old/*", "/new"),
    rule("/literal", "/kept/*"),
    rule("/*", "/root/*"),
  ];
  expect(matchRedirect(rules, "/old/a/b")?.location).toBe("/new");
  expect(matchRedirect(rules, "/literal")?.location).toBe("/kept/*");
  expect(matchRedirect(rules, "/")?.location).toBe("/root/");
  expect(matchRedirect(rules, "/x/y")?.location).toBe("/root/x/y");
});

test("locations are always valid header values", () => {
  const rules = [
    { source: "/jp", destination: "/ブログ/new", status: 308 as const },
    { source: "/nl", destination: "/a\nb", status: 308 as const },
    { source: "/kept", destination: "/a%20b?x=1#y", status: 308 as const },
  ];
  expect(matchRedirect(rules, "/jp")?.location).toBe(
    "/%E3%83%96%E3%83%AD%E3%82%B0/new"
  );
  expect(matchRedirect(rules, "/nl")?.location).toBe("/a%0Ab");
  expect(matchRedirect(rules, "/kept")?.location).toBe("/a%20b?x=1#y");
  for (const path of ["/jp", "/nl"]) {
    const location = matchRedirect(rules, path)?.location ?? "";
    expect(() => new Headers({ location })).not.toThrow();
  }
});

test("placeholders match one segment and fill the destination", () => {
  const rules = [
    rule("/blog/:slug/opengraph-image", "/blog/_notra/og/blog/:slug.png"),
    rule("/posts/:slug", "/blog/:slug", 301),
    rule(
      "/:year/:month/:slug",
      "https://acme.com/blog/:slug?from=:year-:month"
    ),
  ];
  expect(matchRedirect(rules, "/blog/launch/opengraph-image")).toEqual({
    location: "/blog/_notra/og/blog/launch.png",
    status: 308,
  });
  expect(matchRedirect(rules, "/posts/hello-world/")).toEqual({
    location: "/blog/hello-world",
    status: 301,
  });
  expect(matchRedirect(rules, "/2024/05/launch")?.location).toBe(
    "https://acme.com/blog/launch?from=2024-05"
  );
  expect(matchRedirect(rules, "/posts")).toBeNull();
  expect(matchRedirect(rules, "/posts/a/b/c")).toBeNull();
  expect(matchRedirect(rules, "/blog/launch")).toBeNull();
});

test("placeholder names end at the first character that can't be in a name", () => {
  const rules = [
    rule("/a/:id/:id_v2", "/b/:id.json/:id_v2-:id"),
    rule("/c/:x", "https://acme.com:8443/:x"),
  ];
  expect(matchRedirect(rules, "/a/1/2")?.location).toBe("/b/1.json/2-1");
  expect(matchRedirect(rules, "/c/y")?.location).toBe(
    "https://acme.com:8443/y"
  );
});

test("placeholders combine with a trailing /*", () => {
  const rules = [
    rule("/old/:section/*", "/new/:section/*"),
    rule("/team/:name/*", "/people/:name"),
  ];
  expect(matchRedirect(rules, "/old/guides/setup/linux")?.location).toBe(
    "/new/guides/setup/linux"
  );
  expect(matchRedirect(rules, "/old/guides")?.location).toBe("/new/guides");
  expect(matchRedirect(rules, "/old")).toBeNull();
  expect(matchRedirect(rules, "/team/jan/posts/1")?.location).toBe(
    "/people/jan"
  );
});

test("placeholder values are re-encoded", () => {
  const rules = [rule("/p/:slug", "/blog/:slug")];
  for (const [path, location] of [
    ["/p/a b", "/blog/a%20b"],
    ["/p/€", "/blog/%E2%82%AC"],
    ["/p/a?b#c", "/blog/a%3Fb%23c"],
    ["/p/100%", "/blog/100%25"],
    ["/p/a\r\nSet-Cookie: x", "/blog/a%0D%0ASet-Cookie%3A%20x"],
  ] as const) {
    const match = matchRedirect(rules, path);
    expect(match?.location).toBe(location);
    expect(
      () => new Headers({ location: match?.location ?? "" })
    ).not.toThrow();
  }
});

test("request values never turn a path into another host", () => {
  const rules = [rule("/go/:x", "/:x"), rule("/old/*", "/*")];
  expect(matchRedirect(rules, "/go/\\evil.com")?.location).toBe("/%5Cevil.com");
  expect(matchRedirect(rules, "/go/\tevil.com")?.location).toBe("/%09evil.com");
  expect(matchRedirect(rules, "/go/evil.com")?.location).toBe("/evil.com");
  // A placeholder never matches an empty segment, so `//` can't reach it.
  expect(matchRedirect(rules, "/go//evil.com")).toBeNull();
  expect(matchRedirect(rules, "/old//evil.com")?.location).toBe("/evil.com");
  expect(matchRedirect(rules, "/old/\\evil.com")?.location).toBe(
    "/%5Cevil.com"
  );
});

test("the first matching rule wins", () => {
  const rules = [
    rule("/blog/featured", "/blog/launch"),
    rule("/blog/:slug", "/posts/:slug"),
    rule("/blog/*", "/archive/*"),
    rule("/blog/launch", "/never"),
  ];
  expect(matchRedirect(rules, "/blog/featured")?.location).toBe("/blog/launch");
  expect(matchRedirect(rules, "/blog/launch")?.location).toBe("/posts/launch");
  expect(matchRedirect(rules, "/blog/a/b")?.location).toBe("/archive/a/b");
});

test("rules compile once per rules array and still follow a new array", () => {
  const rules = [rule("/posts/:slug", "/blog/:slug")];
  expect(matchRedirect(rules, "/posts/a")?.location).toBe("/blog/a");
  expect(matchRedirect(rules, "/posts/b")?.location).toBe("/blog/b");
  expect(
    matchRedirect([rule("/posts/:slug", "/news/:slug")], "/posts/a")?.location
  ).toBe("/news/a");
});

test("blog.json placeholder rules become manifest rules as written", () => {
  const config = siteConfigSchema.parse({
    name: "Acme",
    redirects: [
      { source: " /posts/:slug ", destination: "/blog/:slug" },
      {
        source: "/old/:section/*",
        destination: "/new/:section/*",
        permanent: false,
      },
    ],
  });
  expect(siteRedirectRules(config.redirects)).toEqual([
    { source: "/posts/:slug", destination: "/blog/:slug", status: 308 },
    { source: "/old/:section/*", destination: "/new/:section/*", status: 307 },
  ]);
});

test("blog.json accepts placeholders that source defines", () => {
  for (const [source, destination] of [
    ["/blog/old-post", "/blog/new-post"],
    ["/blog/2025/*", "/blog/archive/*"],
    ["/blog/:slug/opengraph-image", "/blog/_notra/og/blog/:slug.png"],
    ["/:year/:month/:slug", "/blog/:slug"],
    ["/old/:section/*", "https://acme.com:8443/new/:section/*"],
    ["/docs/:_page2", "/guides/:_page2"],
    ["/help", "mailto:help@acme.com"],
    ["/time", "/at?t=10:30"],
  ] as const) {
    expect(redirectIssues(source, destination)).toEqual([]);
  }
});

test("blog.json rejects duplicate placeholders but keeps undefined and invalid ones as written", () => {
  expect(redirectIssues("/:slug/:slug", "/blog/:slug")).toEqual([
    "redirects.0.source: :slug is used more than once. Give each placeholder its own name",
  ]);
  // Existing redirects with a colon keep building; the build warns instead.
  expect(redirectIssues("/posts/:slug", "/blog/:id")).toEqual([]);
  expect(
    redirectIssues("/wiki", "https://wiki.example.com/Special:Search")
  ).toEqual([]);
  expect(redirectIssues("/blog/:1st", "/blog")).toEqual([]);
  expect(
    redirectPatternIssues("/posts/:slug", "/blog/:id").map(
      ({ path, severity }) => `${path}:${severity}`
    )
  ).toEqual(["destination:warning"]);
  for (const segment of [":", ":1st", ":my-slug", ":slug.png"]) {
    expect(redirectPatternIssues(`/blog/${segment}`, "/blog")).toEqual([
      {
        path: "source",
        severity: "warning",
        message: `"${segment}" is matched literally because it isn't a valid placeholder. Placeholders start with a letter or underscore and use letters, digits and underscores, like :slug`,
      },
    ]);
  }
});

test("a colon the source doesn't define stays in the location as written", () => {
  expect(
    matchRedirect(
      siteRedirectRules([
        {
          source: "/wiki",
          destination: "https://wiki.example.com/Special:Search",
          permanent: true,
        },
        { source: "/posts/:slug", destination: "/blog/:id", permanent: false },
      ]),
      "/wiki"
    )?.location
  ).toBe("https://wiki.example.com/Special:Search");
  expect(
    matchRedirect(
      siteRedirectRules([
        { source: "/posts/:slug", destination: "/blog/:id", permanent: false },
      ]),
      "/posts/hello"
    )?.location
  ).toBe("/blog/:id");
});
