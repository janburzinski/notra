import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";
import { siteManifestSchema } from "@notra/sites-core/schemas/deployment";

import { contentTypeForPath } from "../../../../packages/sites-server/src/utils/content-types";
import { buildSite } from "../../../sites-builder/compiler/build";
import { listFiles } from "../../../sites-builder/compiler/utils/fs";
import { HOSTING_DOMAIN } from "../constants/fixtures";
import type { FixtureBuild, Measurement } from "../types/harness";
import { assertLinkChecks } from "./link-checks";
import { fixtureToolchain } from "./toolchain";

export async function compileFixtures(
  root: string,
  temp: string,
  builds: FixtureBuild[],
  measurements: Measurement[]
) {
  const builder = join(root, "apps/sites-builder");
  const toolchain = fixtureToolchain(root, temp);
  try {
    return await compileWith(root, temp, toolchain, builds, measurements);
  } finally {
    await rm(toolchain, { recursive: true, force: true });
  }
}

async function compileWith(
  root: string,
  temp: string,
  toolchain: string,
  builds: FixtureBuild[],
  measurements: Measurement[]
) {
  const builder = join(root, "apps/sites-builder");
  for (const path of [
    "src",
    "compiler",
    "astro.config.mjs",
    "package.json",
    "tsconfig.json",
  ]) {
    await cp(join(builder, path), join(toolchain, path), { recursive: true });
  }
  await symlink(
    join(builder, "node_modules"),
    join(toolchain, "node_modules"),
    "dir"
  );
  const objects = new Map<string, Uint8Array>();
  const manifests = [];
  for (const {
    siteId,
    deploymentId,
    publicOrigin,
    preview,
    integrations,
  } of builds) {
    const source = join(temp, "source", deploymentId);
    await cp(join(builder, "fixtures/acme"), source, { recursive: true });
    // E2E-only content (every built-in, global CSS/JS) on top of Acme.
    await cp(join(root, "apps/sites-e2e/fixtures/site"), source, {
      recursive: true,
    });
    const configPath = join(source, "blog.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    config.integrations = integrations;
    // Self-hosted faces for both roles; the files are in fixtures/site/public.
    config.fonts = JSON.parse(
      await readFile(join(root, "apps/sites-e2e/fixtures/fonts.json"), "utf8")
    );
    // The only built-in script loaded on demand; content.ts checks it renders under the CSP.
    config.blog = { ...config.blog, hero: { style: "dither" } };
    // Profile links content.ts expects in the author-hero slot and JSON-LD.
    // The javascript: website must only warn and never reach a page.
    config.authors.jan = {
      ...config.authors.jan,
      // oxlint-disable-next-line no-script-url -- Unsafe scheme is a rejection fixture.
      url: "javascript:alert(document.domain)",
      bluesky: "https://bsky.app/profile/janburzinski.bsky.social",
      mastodon: "https://hachyderm.io/@janburzinski",
      threads: "https://www.threads.net/@janburzinski",
      instagram: "https://www.instagram.com/janburzinski",
    };
    // Placeholder redirects; worker.ts checks the Worker fills them in.
    config.redirects = [
      ...config.redirects,
      { source: "/blog/posts/:slug", destination: "/blog/:slug" },
      { source: "/blog/archive/:year/*", destination: "/blog/:year/*" },
    ];
    await writeFile(configPath, JSON.stringify(config));
    const target = siteBuildRequestSchema.parse({
      ...JSON.parse(
        await readFile(join(builder, "fixtures/acme.target.json"), "utf8")
      ),
      siteId,
      deploymentId,
      publicOrigin,
      hostingDomain: HOSTING_DOMAIN,
      analytics: !preview,
      noindex: preview,
      includeDrafts: preview,
    });
    const outDir = join(temp, deploymentId);
    const started = performance.now();
    const result = await buildSite({
      toolchainRoot: toolchain,
      siteRoot: source,
      target,
      outDir,
      workDir: join(temp, "work", deploymentId),
    });
    measurements.push({
      name: `compiler.${deploymentId}`,
      repetition: 1,
      durationMs: performance.now() - started,
    });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(
      result.diagnostics.filter(
        (item) => item.code === "link_broken" || item.code === "image_missing"
      ),
      [],
      "the fixture's internal links, anchors and images all exist"
    );
    const schemeWarnings = result.diagnostics.filter(
      (item) => item.code === "author_link_scheme"
    );
    assert.equal(schemeWarnings.length, 1, JSON.stringify(schemeWarnings));
    assert.equal(schemeWarnings[0]?.severity, "warning");
    assert.equal(schemeWarnings[0]?.file, "blog.json");
    assert.match(
      schemeWarnings[0]?.message ?? "",
      /^authors\.jan\.url: .*Use an https:\/\/ URL\.$/
    );
    if (!preview) {
      await assertLinkChecks(builder, source, outDir, target);
    }
    const files = [];
    for (const file of await listFiles(outDir)) {
      const path = file.slice(outDir.length);
      const body = new Uint8Array(await readFile(file));
      objects.set(`deployments/${siteId}/${deploymentId}/files${path}`, body);
      files.push({
        path,
        size: body.byteLength,
        sha256: createHash("sha256").update(body).digest("hex"),
        contentType: contentTypeForPath(path),
      });
    }
    const manifest = siteManifestSchema.parse({
      version: 1,
      siteId,
      deploymentId,
      commitSha: target.commitSha,
      toolchainVersion: JSON.parse(
        await readFile(join(builder, "package.json"), "utf8")
      ).version,
      target,
      configHash: createHash("sha256")
        .update(JSON.stringify(config))
        .digest("hex"),
      createdAt: new Date().toISOString(),
      totalBytes: result.totalBytes,
      files,
      redirects: result.redirects.map((rule) => ({
        ...rule,
        status: rule.permanent ? 308 : 307,
      })),
      ...(result.contentSecurityPolicy
        ? { contentSecurityPolicy: result.contentSecurityPolicy }
        : {}),
      ...(result.analyticsConsent ? { analyticsConsent: true } : {}),
      ...(result.consentStorageKey
        ? { consentStorageKey: result.consentStorageKey }
        : {}),
    });
    objects.set(
      `deployments/${siteId}/${deploymentId}/manifest.json`,
      new TextEncoder().encode(JSON.stringify(manifest))
    );
    manifests.push(manifest);
  }
  return { objects, manifests };
}
