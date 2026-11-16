import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

import {
  DOCS_FILE,
  RELEASES_DIR,
  buildTracker,
  readReleases,
  renderDocs,
  renderModule,
  renderReleases,
  trackerIntegrity,
  trackerVersion,
} from "../scripts/build";
import { TRACKER_RELEASE_FILE_PATTERN } from "../src/constants/script";
import { TRACKER_RELEASES } from "../src/generated/releases";
import { TRACKER_PLUS_SCRIPT, TRACKER_SCRIPT } from "../src/generated/script";
import { TRACKER_PLUS_RELEASE, TRACKER_RELEASE } from "../src/release";

test("the generated scripts and release manifest are up to date", async () => {
  const [fresh, plus] = await Promise.all([buildTracker(), buildTracker(true)]);
  const generated = (file: string) =>
    Bun.file(new URL(`../src/generated/${file}`, import.meta.url)).text();
  expect(await generated("script.ts")).toBe(renderModule(fresh, plus));
  expect(await generated("releases.ts")).toBe(renderReleases(readReleases()));
});

test("the install docs show the current pinned builds and their integrity", async () => {
  const docs = await Bun.file(DOCS_FILE).text();
  expect(docs).toBe(renderDocs(docs, TRACKER_SCRIPT, TRACKER_PLUS_SCRIPT));
  expect(docs).toContain(
    `src="https://static.usenotra.com/${TRACKER_RELEASE.file}" data-key="nwk.…" data-api="https://ingest.usenotra.com/api/collect" integrity="${TRACKER_RELEASE.integrity}" crossorigin="anonymous"`
  );
  expect(docs).toContain(
    `src="https://static.usenotra.com/${TRACKER_PLUS_RELEASE.file}" data-key="nwk.…" data-api="https://ingest.usenotra.com/api/collect" integrity="${TRACKER_PLUS_RELEASE.integrity}" crossorigin="anonymous"`
  );
});

test("renderDocs rewrites each pinned tag to its own build and integrity", () => {
  const stale = [
    '<script src="https://x/notra.000000000000.js" integrity="sha384-old" crossorigin="anonymous"></script>',
    '<script src="https://x/notra.plus.111111111111.js" integrity="sha384-old"></script>',
    "Such as `notra.222222222222.js`, with its `integrity`.",
    "CSP: `'sha384-old'`.",
  ].join("\n");
  expect(renderDocs(stale, "a", "b").split("\n")).toEqual([
    `<script src="https://x/notra.${trackerVersion("a")}.js" integrity="${trackerIntegrity("a")}" crossorigin="anonymous"></script>`,
    `<script src="https://x/notra.plus.${trackerVersion("b")}.js" integrity="${trackerIntegrity("b")}"></script>`,
    `Such as \`notra.${trackerVersion("a")}.js\`, with its \`integrity\`.`,
    `CSP: \`'${trackerIntegrity("a")}'\`.`,
  ]);
});

test("both current builds are archived, byte for byte", () => {
  const releases = readReleases();
  expect(releases.get(TRACKER_RELEASE.file)).toBe(TRACKER_SCRIPT);
  expect(releases.get(TRACKER_PLUS_RELEASE.file)).toBe(TRACKER_PLUS_SCRIPT);
});

test("no archived build has changed since its name and integrity were issued", () => {
  const files = readdirSync(RELEASES_DIR);
  expect(files.every((file) => TRACKER_RELEASE_FILE_PATTERN.test(file))).toBe(
    true
  );
  for (const [file, script] of readReleases()) {
    const [, plus, version] = TRACKER_RELEASE_FILE_PATTERN.exec(file) ?? [];
    expect(trackerVersion(script), file).toBe(version ?? "");
    expect(script.includes("unhandledrejection"), file).toBe(Boolean(plus));
    expect(TRACKER_RELEASES[file]).toEqual({
      script,
      integrity: trackerIntegrity(script),
    });
  }
  expect(Object.keys(TRACKER_RELEASES)).toEqual([...readReleases().keys()]);
});

test.each([
  ["notra.js", 1400, TRACKER_SCRIPT],
  ["notra.plus.js", 1500, TRACKER_PLUS_SCRIPT],
] as const)("%s stays under %d bytes gzipped", (_name, budget, script) => {
  expect(
    gzipSync(Buffer.from(script), { level: 9 }).length
  ).toBeLessThanOrEqual(budget);
});
