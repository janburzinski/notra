// Bundles usenotra.com's navbar and dither backgrounds into apps/blog/scripts/web-chrome.js, a
// plain browser script that Notra Sites loads on every blog page. Run `bun run blog:chrome` after
// changing the navbar or the dither components; `--check` (CI) fails when the file is out of date.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import type { Plugin } from "vite";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const embedDir = join(webDir, "src/embed/blog-chrome");
const output = fileURLToPath(
  new URL("../../blog/scripts/web-chrome.js", import.meta.url)
);
const licensesOutput = fileURLToPath(
  new URL("../../blog/public/licenses/web-chrome.txt", import.meta.url)
);
const NODE_MODULES = "/node_modules/";
const SOURCE_FILE = /\.(tsx?|jsx?|mjs)$/;
// The blog already loads the same Inter Variable and Satoshi faces, and library builds inline fonts.
const FONT_FACE_RULE = /@font-face\s*\{[^}]*\}/g;
const LICENSE_SECTION_NAME = /^## (\S+) - /;
// Packages that ship no LICENSE file, so Vite finds no text for them; the texts are in
// scripts/licenses, taken from each project's repository.
const LICENSE_FALLBACKS: Record<string, string> = {
  "@databuddy/sdk": "databuddy-sdk.txt",
  "@scritto/core": "scritto.txt",
  "@scritto/react": "scritto.txt",
};

// Every bundled package needs its license text in the file the bundle points to.
async function completeLicenses(markdown: string): Promise<string> {
  const sections = await Promise.all(
    markdown.split(/(?=^## )/m).map(async (section) => {
      const name = LICENSE_SECTION_NAME.exec(section)?.[1];
      if (!name || section.slice(section.indexOf("\n")).trim()) {
        return section;
      }
      const fallback = LICENSE_FALLBACKS[name];
      if (!fallback) {
        throw new Error(
          `${name} ships no license text. Add it to apps/web/scripts/licenses and LICENSE_FALLBACKS.`
        );
      }
      const text = await readFile(
        join(webDir, "scripts/licenses", fallback),
        "utf8"
      );
      return `${section.trimEnd()}\n\n${text.trim()}\n\n`;
    })
  );
  return sections.join("");
}

async function bundle(stylesheet: string, outDir: string, plugin?: Plugin) {
  await build({
    configFile: false,
    root: webDir,
    logLevel: "warn",
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      tsconfigPaths: true,
      alias: [
        {
          find: /^@\/components\/ui\//,
          replacement: join(webDir, "../../packages/ui/src/components/ui/"),
        },
        {
          find: "@tanstack/react-router",
          replacement: join(embedDir, "router.tsx"),
        },
        { find: "@/styles/globals.css", replacement: stylesheet },
      ],
    },
    plugins: [tailwindcss(), react(), ...(plugin ? [plugin] : [])],
    build: {
      outDir,
      emptyOutDir: true,
      copyPublicDir: false,
      minify: true,
      assetsInlineLimit: 0,
      license: { fileName: "licenses.md" },
      lib: {
        entry: join(embedDir, "entry.tsx"),
        formats: ["iife"],
        name: "NotraWebChrome",
        fileName: () => "web-chrome.js",
        cssFileName: "web-chrome",
      },
    },
  });
}

const workDir = await mkdtemp(join(tmpdir(), "notra-blog-chrome-"));
try {
  // Pass 1 finds the source files in the bundle, so pass 2 generates only the utilities they use.
  const sources = new Set<string>();
  // Vite collects each bundled package's LICENSE, but Apache-2.0 NOTICE files must ship too.
  const notices = new Map<string, string>();
  const empty = join(workDir, "empty.css");
  await writeFile(empty, "");
  await bundle(empty, join(workDir, "scan"), {
    name: "collect-sources",
    generateBundle(_options, output_) {
      for (const chunk of Object.values(output_)) {
        if (chunk.type === "chunk") {
          for (const id of Object.keys(chunk.modules)) {
            const at = id.lastIndexOf(NODE_MODULES) + NODE_MODULES.length;
            if (at >= NODE_MODULES.length) {
              const parts = id.slice(at).split("/");
              const name = parts
                .slice(0, parts[0]?.startsWith("@") ? 2 : 1)
                .join("/");
              const notice = join(id.slice(0, at), name, "NOTICE");
              if (existsSync(notice)) {
                notices.set(name, notice);
              }
            }
            if (
              SOURCE_FILE.test(id) &&
              !id.includes("\0") &&
              !id.includes("/node_modules/")
            ) {
              sources.add(id);
            }
          }
        }
      }
    },
  });
  const stylesheet = join(workDir, "web-chrome.css");
  await writeFile(
    stylesheet,
    [
      `@import "tailwindcss" source(none);`,
      `@import ${JSON.stringify(join(webDir, "src/styles/theme.css"))};`,
      ...[...sources].sort().map((file) => `@source ${JSON.stringify(file)};`),
    ].join("\n")
  );
  const outDir = join(workDir, "out");
  await bundle(stylesheet, outDir);
  const [script, css, licenses] = await Promise.all([
    readFile(join(outDir, "web-chrome.js"), "utf8"),
    readFile(join(outDir, "web-chrome.css"), "utf8"),
    readFile(join(outDir, "licenses.md"), "utf8"),
  ]);
  const noticeSections = await Promise.all(
    [...notices]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        async ([name, file]) =>
          `## ${name}\n\n${(await readFile(file, "utf8")).trim()}\n`
      )
  );
  const licenseText = `${(await completeLicenses(licenses)).trim()}\n\n# NOTICE files\n\n${noticeSections.join("\n")}`;
  const banner =
    "/*! Generated by apps/web/scripts/build-blog-chrome.ts. Do not edit by hand. Third-party licenses and notices: /blog/licenses/web-chrome.txt */\n";
  const bundled = `${banner}var __WEB_CHROME_CSS__=${JSON.stringify(css.replace(FONT_FACE_RULE, ""))};\n${script}`;
  if (process.argv.includes("--check")) {
    const [committed, committedLicenses] = await Promise.all([
      readFile(output, "utf8").catch(() => ""),
      readFile(licensesOutput, "utf8").catch(() => ""),
    ]);
    if (committed !== bundled || committedLicenses !== licenseText) {
      throw new Error(
        "apps/blog/scripts/web-chrome.js or its license file is stale. Run bun run blog:chrome in apps/web and commit the result."
      );
    }
    console.log(`${output} is up to date.`);
  } else {
    await mkdir(dirname(licensesOutput), { recursive: true });
    await Promise.all([
      writeFile(output, bundled),
      writeFile(licensesOutput, licenseText),
    ]);
    console.log(
      `Wrote ${output}: ${sources.size} source files, ${Math.round(script.length / 1024)} KB script, ${Math.round(css.length / 1024)} KB CSS`
    );
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}
