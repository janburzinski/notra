import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";

import { buildSite } from "../compiler/build";

const LAUNCH = `---
title: Launch
date: 2026-10-09
tags: [News]
author: jan
image: /images/cover.png
---

[Calm](/blog/calm-software) [Relative](./calm-software#intro) [Tag](/blog/tags/news)
[Author](/blog/author/jan) [Feed](/blog/feed.xml) [Twin](/blog/calm-software.md)
[Changelog](/changelog/2026-10-01-flow) [Origin](https://acme.example.com/changelog)
[Old](/blog/old-launch) [Pricing](/pricing) [Docs](https://acme.example.com/docs)

![Cover](/images/cover.png) ![Mounted](/blog/images/cover.png)

[Encoded](/blog/calm%2Dsoftware) [Slashes](/blog//calm-software/) [Braces](/blog/tags)

<a href={"/blog/author/jan"}>Jan</a>

[Typo](/blog/calm-sofware) [Draft](/blog/draft-idea)

![Missing](/images/covr.png) ![Reference][gone]

[gone]: /images/gone.png
`;

const files: Record<string, string> = {
  "blog.json": JSON.stringify({
    name: "Acme",
    authors: { jan: { name: "Jan" } },
    thumbnails: { enabled: false },
    redirects: [{ source: "/blog/old-launch", destination: "/blog/launch" }],
  }),
  "blog/launch.mdx": LAUNCH,
  "blog/calm-software.md":
    "---\ntitle: Calm\ndate: 2026-10-01\n---\n\n## Intro\n\n[Back](launch)\n",
  "blog/draft-idea.mdx":
    "---\ntitle: Draft\ndate: 2026-10-02\ndraft: true\n---\n\n[Nope](/blog/nope)\n",
  "changelog/2026-10-01-flow.mdx":
    "---\ntitle: Flow\ndate: 2026-10-01\n---\n\n[Launch](/blog/launch)\n",
  "public/images/cover.png": "png",
};

test("builds warn about broken internal links and missing images", async () => {
  const toolchainRoot = resolve(import.meta.dir, "..");
  const scratch = join(toolchainRoot, ".astro");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, "link-diagnostics-"));
  try {
    const siteRoot = join(root, "source");
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(siteRoot, path)), { recursive: true });
      await writeFile(join(siteRoot, path), content);
    }
    const result = await buildSite({
      toolchainRoot,
      siteRoot,
      workDir: join(root, "work"),
      outDir: join(root, "out"),
      target: siteBuildRequestSchema.parse({
        siteId: "link-diagnostics-test",
        deploymentId: "test",
        publicOrigin: "https://acme.example.com",
        mounts: { blog: "/blog", changelog: "/changelog" },
      }),
    });
    expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
    expect(
      result.diagnostics
        .filter((item) => ["link_broken", "image_missing"].includes(item.code))
        .map((item) => `${item.file}:${item.line} ${item.message}`)
    ).toEqual([
      "blog/launch.mdx:20 Broken link to /blog/calm-sofware: no page, file or redirect has this path. Did you mean /blog/calm-software?",
      "blog/launch.mdx:20 Broken link to /blog/draft-idea: no page, file or redirect has this path.",
      "blog/launch.mdx:22 Missing image /images/covr.png: there is no public/images/covr.png in the repository. Did you mean /images/cover.png?",
      "blog/launch.mdx:22 Missing image /images/gone.png: there is no public/images/gone.png in the repository.",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 180_000);
