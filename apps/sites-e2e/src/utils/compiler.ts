import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { siteBuildRequestSchema } from "@notra/sites-core/schemas/build";
import { siteManifestSchema } from "@notra/sites-core/schemas/deployment";

import { contentTypeForPath } from "../../../../packages/sites-server/src/utils/content-types";
import { buildSite } from "../../../sites-builder/compiler/build";
import { listFiles } from "../../../sites-builder/compiler/utils/fs";
import { analyticsIntegrations } from "../../emulators/browser";
import { SITE_ID } from "../constants/fixtures";
import type { Measurement } from "../types/harness";

export async function compileFixtures(
  root: string,
  temp: string,
  origin: string,
  previewOrigin: string,
  measurements: Measurement[]
) {
  const builder = join(root, "apps/sites-builder");
  const toolchain = join(temp, "toolchain");
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
  const source = join(temp, "source");
  await cp(join(builder, "fixtures/acme"), source, { recursive: true });
  // E2E-only content (every built-in, global CSS/JS) on top of Acme.
  await cp(join(root, "apps/sites-e2e/fixtures/site"), source, {
    recursive: true,
  });
  const configPath = join(source, "blog.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.integrations = analyticsIntegrations();
  await writeFile(configPath, JSON.stringify(config));
  const objects = new Map<string, Uint8Array>();
  const manifests = [];
  for (const [deploymentId, publicOrigin, preview] of [
    ["dep_live", origin, false],
    ["dep_preview", previewOrigin, true],
  ] as const) {
    const target = siteBuildRequestSchema.parse({
      ...JSON.parse(
        await readFile(join(builder, "fixtures/acme.target.json"), "utf8")
      ),
      siteId: SITE_ID,
      deploymentId,
      publicOrigin,
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
    const files = [];
    for (const file of await listFiles(outDir)) {
      const path = file.slice(outDir.length);
      const body = new Uint8Array(await readFile(file));
      objects.set(`deployments/${SITE_ID}/${deploymentId}/files${path}`, body);
      files.push({
        path,
        size: body.byteLength,
        sha256: createHash("sha256").update(body).digest("hex"),
        contentType: contentTypeForPath(path),
      });
    }
    const manifest = siteManifestSchema.parse({
      version: 1,
      siteId: SITE_ID,
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
    });
    objects.set(
      `deployments/${SITE_ID}/${deploymentId}/manifest.json`,
      new TextEncoder().encode(JSON.stringify(manifest))
    );
    manifests.push(manifest);
  }
  return { objects, manifests };
}
