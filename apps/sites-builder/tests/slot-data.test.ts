import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { SITE_SLOT_NAMES } from "@notra/sites-core/constants/site-layout";
import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";

import { buildSite } from "../compiler/build";

const slotExtras: Record<string, string> = {
  "before-post": " data-post-path={post.path}",
  "after-post": " data-post-url={post.url}",
  sidebar: " data-post-path={post.path}",
  "after-changelog-entry": " data-entry-path={entry.path}",
};

const slotSource = (name: string) =>
  name === "before-footer"
    ? '<a data-test-slot="before-footer" data-site={site.name} data-area-id={area} data-page={page} href={section.path}>Back</a>\n'
    : `<a data-test-slot="${name}" data-site={site.name} href={area.path}${slotExtras[name] ?? ""}>Back</a>\n`;

function slotLinks(html: string, name: string): Record<string, string>[] {
  const tags = html.match(
    new RegExp(`<a[^>]*data-test-slot="${name}"[^>]*>`, "g")
  );
  return (tags ?? []).map((tag) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [
        key,
        value,
      ])
    )
  );
}

const blog = { "data-site": "Acme", href: "/blog" };
const changelog = { "data-site": "Acme", href: "/changelog" };
const postPage = "blog/issue-004/index.html";
const expected: [page: string, slot: string, attrs: object][] = [
  [postPage, "before-post", { ...blog, "data-post-path": "/blog/issue-004" }],
  [
    postPage,
    "after-post",
    { ...blog, "data-post-url": "https://example.com/blog/issue-004" },
  ],
  [postPage, "sidebar", { ...blog, "data-post-path": "/blog/issue-004" }],
  [
    postPage,
    "before-footer",
    { ...blog, "data-area-id": "blog", "data-page": "entry" },
  ],
  ["blog/index.html", "blog-hero", blog],
  ["changelog/index.html", "changelog-hero", changelog],
  ...["changelog/index.html", "changelog/release/index.html"].map(
    (page): [string, string, object] => [
      page,
      "after-changelog-entry",
      { ...changelog, "data-entry-path": "/changelog/release" },
    ]
  ),
];

test("every slot gets site and area, with root-relative paths", async () => {
  expect(new Set(expected.map(([, slot]) => slot))).toEqual(
    new Set(SITE_SLOT_NAMES)
  );
  const toolchainRoot = resolve(import.meta.dir, "..");
  const scratch = join(toolchainRoot, ".astro");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, "slot-data-build-"));
  try {
    const siteRoot = join(root, "source");
    const files: Record<string, string> = {
      "blog.json": JSON.stringify({
        name: "Acme",
        blog: {},
        changelog: {},
        thumbnails: { enabled: false },
      }),
      "blog/issue-004.mdx":
        '---\ntitle: "Issue 004"\ndate: 2026-10-09\n---\n\nBody.\n',
      "changelog/release.mdx":
        '---\ntitle: "Release"\ndate: 2026-10-09\nversion: "2.0"\n---\n\nShipped.\n',
      ...Object.fromEntries(
        SITE_SLOT_NAMES.map((name) => [`slots/${name}.mdx`, slotSource(name)])
      ),
    };
    for (const [path, content] of Object.entries(files)) {
      await mkdir(join(siteRoot, path, ".."), { recursive: true });
      await writeFile(join(siteRoot, path), content);
    }
    const outDir = join(root, "out");
    const result = await buildSite({
      toolchainRoot,
      siteRoot,
      workDir: join(root, "work"),
      outDir,
      target: siteBuildRequestSchema.parse({
        siteId: "slot-data-test",
        deploymentId: "test",
        publicOrigin: "https://example.com",
        mounts: { blog: "/blog", changelog: "/changelog" },
      }),
    });
    expect(
      result.diagnostics.filter((item) => item.severity === "error")
    ).toEqual([]);
    expect(result.ok).toBe(true);

    for (const [page, slot, attrs] of expected) {
      const links = slotLinks(await readFile(join(outDir, page), "utf8"), slot);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toEqual({ "data-test-slot": slot, ...attrs });
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 180_000);
