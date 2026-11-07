import { describe, expect, test } from "bun:test";

import type { SiteConfig } from "@notra/sites-core/types/site-config";

import { brokenLinkDiagnostics } from "../src/links";
import type { LinkCheckContext } from "../src/types/links";
import { validateSite } from "../src/validate";

const post = (body: string, frontmatter = "") =>
  `---\ntitle: Hello\ndate: 2026-10-01\n${frontmatter}---\n\n${body}\n`;

const BUILT = [
  "/blog/index.html",
  "/blog/launch/index.html",
  "/blog/launch/index.md",
  "/blog/calm-software/index.html",
  "/blog/2026/recap/index.html",
  "/blog/tags/index.html",
  "/blog/tags/news/index.html",
  "/blog/feed.xml",
  "/blog/llms.txt",
  "/blog/images/cover.png",
  "/blog/report.pdf",
  "/blog/_notra/og/blog/launch.png",
  "/changelog/index.html",
  "/changelog/2026-10-01-flow/index.html",
  "/changelog/images/cover.png",
  "/changelog/report.pdf",
];

function check(
  files: Record<string, string>,
  context: Partial<LinkCheckContext> = {},
  redirects: SiteConfig["redirects"] = []
) {
  const result = validateSite({
    files: new Map(
      Object.entries({
        "blog.json": JSON.stringify({ name: "Acme", redirects }),
        ...files,
      })
    ),
  });
  expect(result.ok).toBe(true);
  return brokenLinkDiagnostics(result.links, {
    mounts: { blog: "/blog", changelog: "/changelog" },
    publicOrigin: "https://acme.com",
    files: new Set(BUILT),
    publicFiles: new Set(["/images/cover.png", "/report.pdf"]),
    redirects: result.config?.redirects ?? [],
    ...context,
  });
}

const messages = (files: Record<string, string>) =>
  check(files).map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);

describe("broken links", () => {
  test("accepts links to pages, files, other areas and public files", () => {
    expect(
      check({
        "blog/launch.mdx": post(
          [
            "[Calm](/blog/calm-software) [Recap](/blog/2026/recap/) [Home](/blog)",
            "[Tag](/blog/tags/news) [Feed](/blog/feed.xml) [Markdown](/blog/launch.md)",
            "[Flow](/changelog/2026-10-01-flow) [Report](/report.pdf) [Mounted](/blog/report.pdf)",
            '<Card title="Changelog" href="/changelog">Shipped.</Card>',
            '<a href="/blog/calm-software?ref=nav">Calm</a>',
            "[Mail](mailto:hi@acme.com) [Phone](tel:+1) [Other site](https://example.com/blog/x)",
            "[ref]: /blog/calm-software",
          ].join("\n\n")
        ),
      })
    ).toEqual([]);
  });

  test("warns about a missing post with the file, line and closest page", () => {
    expect(
      check({
        "blog/launch.mdx": post(
          "Intro.\n\nRead [the post](/blog/calm-sofware)."
        ),
      })
    ).toEqual([
      {
        severity: "warning",
        file: "blog/launch.mdx",
        line: 8,
        column: 6,
        code: "link_broken",
        message:
          "Broken link to /blog/calm-sofware: no page, file or redirect has this path. Did you mean /blog/calm-software?",
      },
    ]);
  });

  test("resolves relative links against the page they are on", () => {
    expect(
      messages({
        "blog/launch.mdx": post(
          [
            "[a](./calm-software) [b](calm-software) [c](../changelog/2026-10-01-flow)",
            "[d](./tags/news) [e](./missing-post)",
          ].join("\n\n")
        ),
        "blog/2026/recap.mdx": post("[up](../calm-software) [sibling](./none)"),
      })
    ).toEqual([
      "link_broken: Broken link to ./missing-post (/blog/missing-post): no page, file or redirect has this path.",
      "link_broken: Broken link to ./none (/blog/2026/none): no page, file or redirect has this path.",
    ]);
  });

  test("accepts links to redirect sources", () => {
    expect(
      check(
        {
          "blog/launch.mdx": post(
            "[old](/blog/old-launch) [docs](/blog/docs/setup/) [gone](/blog/gone)"
          ),
        },
        {},
        [
          {
            source: "/blog/old-launch",
            destination: "/blog/launch",
            permanent: true,
          },
          {
            source: "/blog/docs/*",
            destination: "https://docs.acme.com/*",
            permanent: false,
          },
        ]
      ).map((diagnostic) => diagnostic.message)
    ).toEqual([
      "Broken link to /blog/gone: no page, file or redirect has this path.",
    ]);
  });

  test("accepts links that a placeholder redirect covers", () => {
    expect(
      check(
        {
          "blog/launch.mdx": post(
            "[old](/blog/posts/hello) [card](/blog/hello/opengraph-image) [deep](/blog/posts/a/b)"
          ),
        },
        {},
        [
          {
            source: "/blog/posts/:slug",
            destination: "/blog/:slug",
            permanent: true,
          },
          {
            source: "/blog/:slug/opengraph-image",
            destination: "/blog/_notra/og/blog/:slug.png",
            permanent: true,
          },
        ]
      ).map((diagnostic) => diagnostic.message)
    ).toEqual([
      "Broken link to /blog/posts/a/b: no page, file or redirect has this path.",
    ]);
  });

  test("treats absolute URLs on the public origin as internal", () => {
    expect(
      messages({
        "blog/launch.mdx": post(
          [
            "[a](https://acme.com/blog/calm-software) [b](http://acme.com/changelog)",
            "[c](//acme.com/blog/tags) [d](https://acme.com/blog/nope)",
            "[e](https://www.acme.com/blog/nope) [f](https://acme.com/pricing)",
          ].join("\n\n")
        ),
      })
    ).toEqual([
      "link_broken: Broken link to https://acme.com/blog/nope (/blog/nope): no page, file or redirect has this path.",
    ]);
  });

  test("skips links outside the mounts, which another website may serve", () => {
    expect(
      check({
        "blog/launch.mdx": post(
          "[Pricing](/pricing) [Docs](/docs/start) [Up](../../signup) [Blogs](/blogs)"
        ),
      })
    ).toEqual([]);
    expect(
      check(
        { "blog/launch.mdx": post("[Pricing](/pricing)") },
        {
          mounts: { blog: "/" },
          files: new Set(["/index.html", "/launch/index.html"]),
        }
      ).map((diagnostic) => diagnostic.message)
    ).toEqual([
      "Broken link to /pricing: no page, file or redirect has this path.",
    ]);
  });

  test("checks the path and ignores the fragment", () => {
    expect(
      messages({
        "blog/launch.mdx": post(
          "[a](#intro) [b](/blog/calm-software#setup) [c](./calm-software#x) [d](/blog/nope#setup)"
        ),
      })
    ).toEqual([
      "link_broken: Broken link to /blog/nope: no page, file or redirect has this path.",
    ]);
  });

  test("only checks published entries and flags links to unpublished ones", () => {
    expect(
      messages({
        "blog/launch.mdx": post("[Draft](/blog/draft-idea)"),
        "blog/draft-idea.mdx": post("[Broken](/blog/nope)", "draft: true\n"),
        "changelog/2026-10-01-flow.mdx": post("[Broken](/blog/nope)"),
      })
    ).toEqual([
      "link_broken: Broken link to /blog/draft-idea: no page, file or redirect has this path.",
      "link_broken: Broken link to /blog/nope: no page, file or redirect has this path.",
    ]);
    expect(
      check(
        { "changelog/2026-10-01-flow.mdx": post("[Broken](/blog/nope)") },
        { mounts: { blog: "/blog" } }
      )
    ).toEqual([]);
  });

  test("checks links in Markdown posts, including HTML", () => {
    expect(
      messages({
        "blog/launch.md": post(
          '[Calm](/blog/calm-software)\n\n<p><a class="x" href="/blog/calm-softwar">Calm</a></p>'
        ),
      })
    ).toEqual([
      "link_broken: Broken link to /blog/calm-softwar: no page, file or redirect has this path. Did you mean /blog/calm-software?",
    ]);
  });
});

describe("link sources and paths", () => {
  test("checks reference links and images by how each one is used", () => {
    expect(
      check({
        "blog/launch.mdx": post(
          [
            "![Cover][cover] and [cover page][cover].",
            "![Gone][gone] and [gone page][gone].",
            "[Calm][calm] and [undefined][nope].",
            "[cover]: /images/missing.png",
            "[gone]: /blog/images/gone.png",
            "[calm]: /blog/calm-software",
            "[unused]: /blog/unused",
          ].join("\n\n")
        ),
        "blog/calm-software.md": post("![Cover][c]\n\n[c]: /images/covr.png"),
      }).map(
        (diagnostic) =>
          `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`
      )
    ).toEqual([
      "blog/launch.mdx:6:1 image_missing Missing image /images/missing.png: there is no public/images/missing.png in the repository.",
      "blog/launch.mdx:8:1 image_missing Missing image /blog/images/gone.png: there is no public/images/gone.png in the repository.",
      "blog/launch.mdx:8:19 link_broken Broken link to /blog/images/gone.png: no page, file or redirect has this path.",
      "blog/calm-software.md:6:1 image_missing Missing image /images/covr.png: there is no public/images/covr.png in the repository. Did you mean /images/cover.png?",
    ]);
  });

  test("reads string literals in MDX attribute braces and skips dynamic ones", () => {
    expect(
      messages({
        "blog/launch.mdx": post(
          [
            'export const cover = "/missing.png";',
            'export const slug = "nope";',
            '<img src={"/blog/images/covr.png"} alt="" />',
            "<a href={'/blog/calm-sofware'}>Calm</a>",
            '<Card title="Cover" img={`/gone.png`}>Text.</Card>',
            '<a href={"/blog/calm-software"}>Calm</a>',
            '<img src={cover} alt="" />',
            `<a href={\`/blog/\${slug}\`}>Dynamic</a>`,
            '<a href={"/blog/" + slug}>Joined</a>',
          ].join("\n\n")
        ),
      })
    ).toEqual([
      "image_missing: Missing image /blog/images/covr.png: there is no public/images/covr.png in the repository. Did you mean /blog/images/cover.png?",
      "link_broken: Broken link to /blog/calm-sofware: no page, file or redirect has this path. Did you mean /blog/calm-software?",
      "image_missing: Missing image /gone.png: there is no public/gone.png in the repository.",
    ]);
  });

  test("reads unquoted HTML attributes in Markdown posts", () => {
    expect(
      check({
        "blog/launch.md": post(
          [
            "<p><img src=/images/covr.png alt=Cover></p>",
            "<p><a class=x href=/blog/calm-sofware>Calm</a> <a href=/blog/calm-software>Calm</a></p>",
            "<p><img alt='src=/nope.png' src='/images/cover.png'></p>",
          ].join("\n\n")
        ),
      }).map(
        (diagnostic) =>
          `${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`
      )
    ).toEqual([
      "6:9 image_missing Missing image /images/covr.png: there is no public/images/covr.png in the repository. Did you mean /images/cover.png?",
      "8:15 link_broken Broken link to /blog/calm-sofware: no page, file or redirect has this path. Did you mean /blog/calm-software?",
    ]);
  });

  test("normalizes paths exactly like the worker before looking them up", () => {
    expect(
      messages({
        "blog/launch.mdx": post(
          [
            "[a](/blog/2026%2Frecap) [b](/blog//calm-software) [c](https://acme.com//blog///tags)",
            "[d](/blog/./calm-software/) [e](/blog/calm%2Dsoftware) [f](/blog/caf%C3%A9)",
            "[g](/blog/.well-known/llms.txt) [h](/blog/robots.txt) [i](/blog/100%)",
            "[j](/blog/feed.xml/) [k](/blog/old%20launch)",
          ].join("\n\n")
        ),
      }).concat(
        check({ "blog/launch.mdx": post("[old](/blog/old%20launch/)") }, {}, [
          {
            source: "/blog/old launch",
            destination: "/blog/launch",
            permanent: true,
          },
        ]).map((diagnostic) => diagnostic.message)
      )
    ).toEqual([
      "link_broken: Broken link to /blog/caf%C3%A9 (/blog/café): no page, file or redirect has this path.",
      "link_broken: Broken link to /blog/feed.xml/: no page, file or redirect has this path.",
      "link_broken: Broken link to /blog/old%20launch (/blog/old launch): no page, file or redirect has this path.",
    ]);
  });
});

describe("missing images", () => {
  test("accepts images in public/ and files the build made", () => {
    expect(
      check({
        "blog/launch.mdx": post(
          [
            "![Cover](/images/cover.png) ![Mounted](/blog/images/cover.png)",
            '<img src="/images/cover.png" alt="" />',
            '<Card title="Cover" img="/images/cover.png">Text.</Card>',
            '<Video src="/report.pdf" poster="/changelog/images/cover.png" title="Demo" />',
            "![OG](/blog/_notra/og/blog/launch.png) ![Remote](https://cdn.example.com/a.png)",
          ].join("\n\n"),
          "image: /images/cover.png\n"
        ),
      })
    ).toEqual([]);
  });

  test("warns about a missing image with the closest file in public/", () => {
    expect(
      check({
        "blog/launch.mdx": post("![Cover](/images/covr.png)"),
      })
    ).toEqual([
      {
        severity: "warning",
        file: "blog/launch.mdx",
        line: 6,
        column: 1,
        code: "image_missing",
        message:
          "Missing image /images/covr.png: there is no public/images/covr.png in the repository. Did you mean /images/cover.png?",
      },
    ]);
  });

  test("warns about images in HTML, components and frontmatter", () => {
    expect(
      check({
        "blog/launch.mdx": post(
          [
            '<img className="block" src="/blog/images/covr.png" alt="" />',
            '<Card title="Cover" img="/missing.png">Text.</Card>',
            '<Video src="/demo.mp4" title="Demo" />',
          ].join("\n\n"),
          "image: /images/cover.webp\n"
        ),
        "blog/calm-software.md": post(
          '<img alt="" src="./images/gone.png">',
          "image: images/cover.png\n"
        ),
        "blog/2026/recap.mdx": post("Recap.", "image: images/gone.png\n"),
      }).map(
        (diagnostic) =>
          `${diagnostic.file}:${diagnostic.line} ${diagnostic.code} ${diagnostic.message}`
      )
    ).toEqual([
      "blog/launch.mdx:7 image_missing Missing image /blog/images/covr.png: there is no public/images/covr.png in the repository. Did you mean /blog/images/cover.png?",
      "blog/launch.mdx:9 image_missing Missing image /missing.png: there is no public/missing.png in the repository.",
      "blog/launch.mdx:11 image_missing Missing image /demo.mp4: there is no public/demo.mp4 in the repository.",
      "blog/launch.mdx:4 image_missing Missing image /images/cover.webp: there is no public/images/cover.webp in the repository.",
      "blog/calm-software.md:7 image_missing Missing image ./images/gone.png (/blog/images/gone.png): there is no public/images/gone.png in the repository.",
      "blog/2026/recap.mdx:4 image_missing Missing image /images/gone.png: there is no public/images/gone.png in the repository.",
    ]);
  });

  test("skips absolute image URLs outside the mounts", () => {
    expect(
      check({
        "blog/launch.mdx": post("![Logo](https://acme.com/logo.png)"),
      })
    ).toEqual([]);
  });
});
