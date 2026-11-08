import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

import {
  RELEASES_DIR,
  buildTracker,
  readReleases,
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
  ["notra.js", 1300, TRACKER_SCRIPT],
  ["notra.plus.js", 1400, TRACKER_PLUS_SCRIPT],
] as const)("%s stays under %d bytes gzipped", (_name, budget, script) => {
  expect(
    gzipSync(Buffer.from(script), { level: 9 }).length
  ).toBeLessThanOrEqual(budget);
});
