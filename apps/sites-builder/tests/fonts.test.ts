import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import { siteFontFallbacks } from "../compiler/utils/font-fallbacks";
import type { FontFallback } from "../src/types/theme";
import { preloadFaces } from "../src/utils/theme-fonts";

const INTER_400 = join(
  import.meta.dir,
  "../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2"
);
const THEME = join(import.meta.dir, "../src/lib/theme.ts");
// global.css declares "Inter Fallback" with these values.
const INTER_FALLBACK = {
  local: "Arial",
  sizeAdjust: 107.12,
  ascentOverride: 90.44,
  descentOverride: 22.52,
  lineGapOverride: 0,
};

const dirs: string[] = [];
async function tempDir(files: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "notra-fonts-"));
  dirs.push(dir);
  for (const [path, from] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await cp(from, join(dir, path));
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

function config(fonts: unknown) {
  return siteConfigSchema.parse({ name: "Acme", fonts });
}

/** The inline CSS and preload URLs Base.astro renders for a config. */
async function renderTheme(
  fonts: unknown,
  fontFallbacks?: FontFallback[]
): Promise<{ css: string; preloads: string[] }> {
  const paramsPath = join(await tempDir(), "params.json");
  await writeFile(
    paramsPath,
    JSON.stringify({
      area: "blog",
      mount: "/blog",
      publicOrigin: "https://acme.example",
      publicFiles: ["/fonts/display-300.woff2", "/fonts/display-500.woff2"],
      fontFallbacks,
      mounts: { blog: "/blog" },
      config: config(fonts),
    })
  );
  const script = `const t = await import(${JSON.stringify(THEME)}); console.log(JSON.stringify({ css: t.fontFaces() + t.themeStyle(), preloads: t.fontPreloads() }));`;
  const child = Bun.spawn([process.execPath, "-e", script], {
    env: { ...process.env, NOTRA_BUILD_PARAMS: paramsPath },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(await child.exited, stderr).toBe(0);
  return JSON.parse(stdout);
}

test.each([
  [
    "the role's upright file, not its italic",
    {
      body: {
        family: "Acme Text",
        source: "/fonts/text-var.woff2",
        faces: [{ source: "/fonts/text-italic.woff2", style: "italic" }],
      },
    },
    ["/fonts/text-var.woff2"],
  ],
  [
    "the face whose weight range covers the role",
    {
      heading: {
        family: "Acme Display",
        weight: 600,
        faces: [
          { source: "/fonts/display-300.woff2", weight: 300 },
          { source: "/fonts/display-var.woff2", weight: "500 700" },
        ],
      },
    },
    ["/fonts/display-var.woff2"],
  ],
  ["nothing for Google fonts", { family: "Inter" }, []],
  [
    "nothing for remote files",
    { family: "Acme", source: "https://cdn.acme.example/acme.woff2" },
    [],
  ],
  [
    "nothing for woff files",
    { family: "Acme", source: "/fonts/acme.woff", format: "woff" },
    [],
  ],
])("preloads %s", (_, fonts, sources) => {
  expect(preloadFaces(config(fonts).fonts).map((face) => face.source)).toEqual(
    sources
  );
});

test("configs without faces or fallbacks keep their font CSS", async () => {
  const { css, preloads } = await renderTheme({
    heading: { family: "Instrument Serif", weight: 400 },
    body: { family: "Acme Text", source: "/fonts/text.woff2" },
  });
  expect(css).toStartWith(
    '@font-face{font-family:"Acme Text";src:url("/fonts/text.woff2") format("woff2");font-weight:100 900;font-display:swap}html:root{'
  );
  expect(css).toContain(
    '--font-body: "Acme Text", ui-sans-serif, system-ui, sans-serif;--font-heading: "Instrument Serif", var(--font-body);'
  );
  expect(preloads).toEqual(["/fonts/text.woff2"]);
});

test("emits a face per file, mount-aware preloads and sized fallbacks", async () => {
  const { css, preloads } = await renderTheme(
    {
      heading: {
        family: "Acme Display",
        weight: 500,
        faces: [
          { source: "/fonts/display-300.woff2", weight: 300 },
          { source: "/fonts/display-500.woff2", weight: 500 },
          { source: "/fonts/display-italic.woff2", style: "italic" },
        ],
      },
    },
    [{ family: "Acme Display", ...INTER_FALLBACK }]
  );
  expect(css).toContain(
    '@font-face{font-family:"Acme Display";src:url("/blog/fonts/display-300.woff2") format("woff2");font-weight:300;font-display:swap}' +
      '@font-face{font-family:"Acme Display";src:url("/blog/fonts/display-500.woff2") format("woff2");font-weight:500;font-display:swap}' +
      // Not in public/, so left unmounted like every other missing asset.
      '@font-face{font-family:"Acme Display";src:url("/fonts/display-italic.woff2") format("woff2");font-weight:100 900;font-style:italic;font-display:swap}' +
      '@font-face{font-family:"Acme Display Fallback";src:local("Arial");size-adjust:107.12%;ascent-override:90.44%;descent-override:22.52%;line-gap-override:0%}'
  );
  expect(css).toContain(
    '--font-heading: "Acme Display", "Acme Display Fallback", var(--font-body)'
  );
  expect(preloads).toEqual(["/blog/fonts/display-500.woff2"]);
});

test("fallbacks match the theme's hand-tuned Inter fallback, for primary files and faces", async () => {
  const work = await tempDir({
    "public/fonts/text.woff2": INTER_400,
    "public/fonts/heading.woff2": INTER_400,
  });
  const result = await siteFontFallbacks(
    config({
      body: { family: "Acme Text", source: "/fonts/text.woff2" },
      heading: {
        family: "Acme Heading",
        weight: 600,
        faces: [{ source: "/fonts/heading.woff2", weight: 600 }],
      },
    }),
    {
      siteRoot: work,
      workDir: join(work, "work"),
      publicFiles: new Set(["/fonts/text.woff2", "/fonts/heading.woff2"]),
    }
  );
  expect(result).toEqual({
    fallbacks: [
      { family: "Acme Text", ...INTER_FALLBACK },
      { family: "Acme Heading", ...INTER_FALLBACK },
    ],
    diagnostics: [],
  });
});

test("fallbacks warn instead of failing when a font can't be measured", async () => {
  const work = await tempDir();
  await mkdir(join(work, "public/fonts"), { recursive: true });
  await writeFile(join(work, "public/fonts/broken.woff2"), "not a font");
  const result = await siteFontFallbacks(
    config({
      body: { family: "Broken", source: "/fonts/broken.woff2" },
      heading: { family: "Missing", source: "/fonts/missing.woff2" },
    }),
    {
      siteRoot: work,
      workDir: join(work, "work"),
      publicFiles: new Set(["/fonts/broken.woff2"]),
    }
  );
  expect(result.fallbacks).toEqual([]);
  expect(result.diagnostics.map((item) => [item.severity, item.code])).toEqual([
    ["warning", "font_fallback"],
    ["warning", "font_fallback"],
  ]);
  expect(result.diagnostics[1]?.message).toContain("/fonts/missing.woff2");
});

test("fallbacks measure the latin upright file of a downloaded Google font", async () => {
  const dir = "work/site/public/_notra/assets/fonts/abc";
  const work = await tempDir({ [`${dir}/font-latin.woff2`]: INTER_400 });
  const face = (subset: string, style: string, file: string) =>
    `/* ${subset} */\n@font-face {\n  font-family: 'Inter';\n  font-style: ${style};\n  font-weight: 300 800;\n  src: url("./${file}") format('woff2');\n}`;
  await writeFile(
    join(work, dir, "fonts-1.css"),
    [
      face("cyrillic", "normal", "font-cyr.woff2"),
      face("latin", "italic", "font-italic.woff2"),
      face("latin", "normal", "font-latin.woff2"),
    ].join("\n")
  );
  const result = await siteFontFallbacks(config({ family: "Inter" }), {
    siteRoot: work,
    workDir: join(work, "work"),
    publicFiles: new Set(),
    stylesheet: "/_notra/assets/fonts/abc/fonts-1.css",
  });
  expect(result).toEqual({
    fallbacks: [{ family: "Inter", ...INTER_FALLBACK }],
    diagnostics: [],
  });
});
