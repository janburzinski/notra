import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";

import { buildSite } from "../compiler/build";

const TABLE =
  "| Approach | Setup time | Best for |\n| --- | --- | --- |\n| Notra | 5 minutes | Teams wanting zero-maintenance automation |\n";

test("markdown tables scroll in their own box in .md and .mdx posts", async () => {
  const toolchainRoot = resolve(import.meta.dir, "..");
  const scratch = join(toolchainRoot, ".astro");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, "table-scroll-build-"));
  try {
    const siteRoot = join(root, "source");
    await mkdir(join(siteRoot, "blog"), { recursive: true });
    await writeFile(
      join(siteRoot, "blog.json"),
      JSON.stringify({ name: "Acme", thumbnails: { enabled: false } })
    );
    for (const extension of ["md", "mdx"]) {
      await writeFile(
        join(siteRoot, `blog/${extension}.${extension}`),
        `---\ntitle: "${extension}"\ndate: 2026-10-01\n---\n\nIntro.\n\n${TABLE}`
      );
    }
    const outDir = join(root, "out");
    const result = await buildSite({
      toolchainRoot,
      siteRoot,
      workDir: join(root, "work"),
      outDir,
      target: siteBuildRequestSchema.parse({
        siteId: "table-scroll-test",
        deploymentId: "test",
        publicOrigin: "https://example.com",
        mounts: { blog: "/blog" },
      }),
    });
    expect(
      result.diagnostics.filter((item) => item.severity === "error")
    ).toEqual([]);
    for (const slug of ["md", "mdx"]) {
      const html = await readFile(
        join(outDir, `blog/${slug}/index.html`),
        "utf8"
      );
      expect(
        html.match(/<div class="table-scroll" tabindex="0"><table>/g)
      ).toHaveLength(1);
      // The wrapper doesn't leak into the Markdown copy of the post.
      const markdown = await readFile(
        join(outDir, `blog/${slug}/index.md`),
        "utf8"
      );
      expect(markdown).toContain("| Notra    | 5 minutes");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 180_000);
