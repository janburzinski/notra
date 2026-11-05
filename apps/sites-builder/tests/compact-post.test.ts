import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";

import { buildSite } from "../compiler/build";

const POST =
  '---\ntitle: "Launch"\ndate: 2026-10-09\nupdated: 2026-10-12\n---\n\n## First\n\nOne.\n\n### Detail\n\nMore.\n\n## Second\n\nTwo.\n\n## Third\n\nThree.\n';

test("compact posts show when they were last edited and a mobile table of contents", async () => {
  const toolchainRoot = resolve(import.meta.dir, "..");
  const scratch = join(toolchainRoot, ".astro");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, "compact-post-build-"));
  try {
    const siteRoot = join(root, "source");
    await mkdir(join(siteRoot, "blog"), { recursive: true });
    await writeFile(join(siteRoot, "blog/launch.mdx"), POST);
    await writeFile(
      join(siteRoot, "blog/first.mdx"),
      '---\ntitle: "First"\ndate: 2026-10-01\n---\n\nNever updated.\n'
    );
    const target = siteBuildRequestSchema.parse({
      siteId: "compact-post-test",
      deploymentId: "test",
      publicOrigin: "https://example.com",
      mounts: { blog: "/blog" },
    });
    for (const timestamp of [true, false]) {
      await writeFile(
        join(siteRoot, "blog.json"),
        JSON.stringify({
          name: "Acme",
          metadata: { timestamp },
          blog: { post: { header: "compact" } },
          thumbnails: { enabled: false },
        })
      );
      const outDir = join(root, String(timestamp));
      const result = await buildSite({
        toolchainRoot,
        siteRoot,
        workDir: join(root, `work-${timestamp}`),
        outDir,
        target,
      });
      expect(
        result.diagnostics.filter((item) => item.severity === "error")
      ).toEqual([]);
      const html = await readFile(
        join(outDir, "blog/launch/index.html"),
        "utf8"
      );
      expect(html).toContain("data-mobile-toc");
      expect(html).toMatch(/>On this page<\/span>/);
      expect(html).toMatch(/>3 sections<\/span>/);
      if (timestamp) {
        expect(html).toMatch(
          /Last edited <time datetime="2026-10-12"[^>]*>[^<]+<\/time>/
        );
        // The date moves under the author, so the meta row doesn't repeat it.
        expect(html).not.toContain("· Updated");
        expect(
          await readFile(join(outDir, "blog/first/index.html"), "utf8")
        ).not.toContain("Last edited");
      } else {
        expect(html).not.toContain("Last edited");
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 180_000);
