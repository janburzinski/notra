import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  rewritePublicAssetUrls,
  rewritePublicCssUrls,
} from "../src/utils/public-assets";

const publicFiles = new Set([
  "/fonts/inter.woff2",
  "/images/tex.jpg",
  "/images/my file.png",
]);

test("absolute public-file urls in CSS get the mount and keep query, hash and quotes", () => {
  const css = [
    '@font-face { src: url("/fonts/inter.woff2") format("woff2"); }',
    "body { background: url('/images/tex.jpg?v=2#top'); }",
    ".bare { background: url( /images/tex.jpg ); }",
    '.spaced { background: url("/images/my%20file.png"); }',
    ".list { background: url(/images/tex.jpg),url(/fonts/inter.woff2); }",
  ].join("\n");
  expect(rewritePublicCssUrls(css, "/blog", publicFiles)).toBe(
    [
      '@font-face { src: url("/blog/fonts/inter.woff2") format("woff2"); }',
      "body { background: url('/blog/images/tex.jpg?v=2#top'); }",
      ".bare { background: url( /blog/images/tex.jpg ); }",
      '.spaced { background: url("/blog/images/my%20file.png"); }',
      ".list { background: url(/blog/images/tex.jpg),url(/blog/fonts/inter.woff2); }",
    ].join("\n")
  );
});

test("CSS urls that are not public files, on a root mount or without public files stay untouched", () => {
  const css = [
    "a { background: url(/images/missing.png); }",
    'b { background: url("//cdn.example.com/fonts/inter.woff2"); }',
    'c { background: url("https://example.com/images/tex.jpg"); }',
    'd { background: url("data:image/png;base64,AAAA"); }',
    'e { background: url("images/tex.jpg"); }',
    'g { background: url("/blog/images/tex.jpg"); }',
    'h { background: URL("/images/tex.jpg"); }',
    'i { --x: my-url("/images/tex.jpg"); }',
    '@import url("/images/tex.jpg");',
  ].join("\n");
  expect(rewritePublicCssUrls(css, "/blog", publicFiles)).toBe(css);
  const asset = 'a { background: url("/images/tex.jpg"); }';
  expect(rewritePublicCssUrls(asset, "/", publicFiles)).toBe(asset);
  expect(rewritePublicCssUrls(asset, "/blog", new Set())).toBe(asset);
});

test("HTML attribute rewriting keeps its existing behaviour", () => {
  const html =
    '<img src="/images/tex.jpg?v=1" srcset="/images/tex.jpg 1x, //cdn.example.com/a.png 2x"><a href="//images/tex.jpg"></a><a href="/missing">';
  expect(rewritePublicAssetUrls(html, "/blog", publicFiles)).toBe(
    '<img src="/blog/images/tex.jpg?v=1" srcset="/blog/images/tex.jpg 1x, //cdn.example.com/a.png 2x"><a href="//images/tex.jpg"></a><a href="/missing">'
  );
});

/**
 * Imports astro.config.mjs in a temp work dir with these mounts, and returns
 * what `script` returns. It sees `root`, `config`, `alias` and `plugin`.
 */
async function inspectAstroConfig(
  mounts: Record<string, string>,
  script: string,
  dev = false
) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "notra-css-urls-")));
  try {
    const paramsPath = join(root, "params.json");
    await writeFile(
      paramsPath,
      JSON.stringify({
        config: {},
        workDir: root,
        area: "blog",
        mount: "/blog",
        mounts,
        publicFiles: ["/fonts/inter.woff2"],
        publicOrigin: "http://localhost:4321",
      })
    );
    const configPath = fileURLToPath(
      new URL("../astro.config.mjs", import.meta.url)
    );
    const child = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `const root = ${JSON.stringify(root)};
const { default: config } = await import(${JSON.stringify(configPath)});
const alias = config.vite.resolve.alias["@notra/custom-css"];
const plugin = config.vite.plugins.find((plugin) => plugin?.name === "notra-dev-public-css-urls");
console.log(JSON.stringify((() => { ${script} })()));`,
      ],
      {
        env: {
          ...process.env,
          NOTRA_BUILD_PARAMS: paramsPath,
          ...(dev ? { NOTRA_DEV_ROOT: root } : {}),
        },
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const [output, errors] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(await child.exited, errors).toBe(0);
    expect(errors).toBe("");
    return { root, result: JSON.parse(output) };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("the dev server mounts site stylesheet urls for the area that imported them", async () => {
  const { root, result } = await inspectAstroConfig(
    { blog: "/blog", changelog: "/product/changes" },
    `const custom = root + "/custom.css";
const t = (id) => plugin.transform('a { src: url("/fonts/inter.woff2"); }', id)?.code ?? null;
return {
  apply: plugin.apply,
  alias,
  blog: t(custom + "?notra-area=blog"),
  changelog: t(custom + "?notra-area=changelog&direct"),
  unknownArea: t(custom + "?notra-area=constructor"),
  siteFile: t(root + "/site/style.CSS"),
  outside: t(root + "-other/style.css"),
  script: t(root + "/site/a.js"),
};`,
    true
  );
  expect(result).toEqual({
    apply: "serve",
    alias: `${join(root, "custom.css")}?notra-area=blog`,
    blog: 'a { src: url("/blog/fonts/inter.woff2"); }',
    changelog: 'a { src: url("/product/changes/fonts/inter.woff2"); }',
    unknownArea: 'a { src: url("/blog/fonts/inter.woff2"); }',
    siteFile: 'a { src: url("/blog/fonts/inter.woff2"); }',
    outside: null,
    script: null,
  });
}, 30_000);

test("production builds import site stylesheets without the dev rewrite", async () => {
  const { root, result } = await inspectAstroConfig(
    { blog: "/blog" },
    "return { plugin: Boolean(plugin), alias };"
  );
  expect(result).toEqual({ plugin: false, alias: join(root, "custom.css") });
}, 30_000);
