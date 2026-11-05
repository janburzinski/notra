import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";

import { buildSite } from "../compiler/build";

const SCRIPT_SRC = /<script[^>]*\ssrc="([^"]+)"/g;
const CHUNK_IMPORT = /import\(\s*["'`]\.\/([^"'`]+\.js)["'`]\s*\)/g;
// Paper adds this attribute to the shader host. Only its own chunk contains it.
const SHADER_MARKER = "data-paper-shader";

// The scripts a visitor's browser loads for a page: its <script src> tags and the chunks they
// import on demand. Astro writes every component's script to disk, but only pages that render the
// component reference it.
async function loadedScripts(outDir: string, page: string) {
  const assets = join(outDir, "blog/_notra/assets");
  const html = await readFile(join(outDir, page), "utf8");
  const queue = [...html.matchAll(SCRIPT_SRC)].map((match) =>
    basename(match[1] ?? "")
  );
  const loaded = new Map<string, string>();
  for (let file = queue.shift(); file; file = queue.shift()) {
    if (!loaded.has(file)) {
      const code = await readFile(join(assets, file), "utf8");
      loaded.set(file, code);
      queue.push(
        ...[...code.matchAll(CHUNK_IMPORT)].map((match) => match[1] ?? "")
      );
    }
  }
  return { html, code: [...loaded.values()].join("\n") };
}

test("the dither hero loads Paper, with its notice, only on sites that use it", async () => {
  const toolchainRoot = resolve(import.meta.dir, "..");
  const scratch = join(toolchainRoot, ".astro");
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, "hero-dither-build-"));
  try {
    const siteRoot = join(root, "source");
    await mkdir(join(siteRoot, "blog"), { recursive: true });
    await writeFile(
      join(siteRoot, "blog/launch.mdx"),
      '---\ntitle: "Launch"\ndate: 2026-10-09\n---\n\nHello.\n'
    );
    const target = siteBuildRequestSchema.parse({
      siteId: "hero-dither-test",
      deploymentId: "test",
      publicOrigin: "https://example.com",
      mounts: { blog: "/blog" },
    });
    for (const style of ["dither", "wash"] as const) {
      await writeFile(
        join(siteRoot, "blog.json"),
        JSON.stringify({
          name: "Acme",
          colors: { primary: "#2563EB", light: "#60A5FA" },
          blog: { hero: { style } },
          thumbnails: { enabled: false },
        })
      );
      const outDir = join(root, style);
      const result = await buildSite({
        toolchainRoot,
        siteRoot,
        workDir: join(root, `work-${style}`),
        outDir,
        target,
      });
      expect(
        result.diagnostics.filter((item) => item.severity === "error")
      ).toEqual([]);
      expect(result.ok).toBe(true);
      const { html, code } = await loadedScripts(outDir, "blog/index.html");
      if (style === "dither") {
        expect(html).toMatch(
          /<div aria-hidden="true"[^>]*data-notra-dither[^>]*data-color="#2563EB"[^>]*data-color-dark="#60A5FA"/
        );
        expect(code).toContain(SHADER_MARKER);
        // Apache-2.0 asks to pass on Paper's notice, so the minifier must keep it.
        expect(code).toContain("Powered by Paper Shaders");
      } else {
        expect(html).not.toContain("data-notra-dither");
        expect(code).not.toContain(SHADER_MARKER);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 180_000);
